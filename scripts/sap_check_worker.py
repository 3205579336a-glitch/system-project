from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import quote

import requests
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


SAP_STATUSES = {"Pass", "Failed", "Error"}
DEFAULT_ENV_FILE = Path(__file__).with_name("sap_check_worker.env")


@dataclass
class MdsRecord:
    id: str
    part_number: str
    supplier_code: str
    action_type: str


@dataclass
class SapCheckResult:
    record_id: str
    status: str
    message: str
    info_record: str | None = None
    deletion_flag: bool | None = None

    def to_payload(self) -> dict[str, Any]:
        return {
            "recordId": self.record_id,
            "status": self.status,
            "message": self.message,
            "infoRecord": self.info_record,
            "deletionFlag": self.deletion_flag,
        }


class SupabaseQueue:
    def __init__(self) -> None:
        self.url = require_env("SUPABASE_URL").rstrip("/")
        self.key = require_env("SUPABASE_SERVICE_ROLE_KEY")
        self.headers = {
            "apikey": self.key,
            "authorization": f"Bearer {self.key}",
            "content-type": "application/json",
        }

    def get_next_job(self) -> dict[str, Any] | None:
        response = requests.get(
            f"{self.url}/rest/v1/sap_check_jobs",
            headers=self.headers,
            params={
                "status": "eq.Queued",
                "select": "*",
                "order": "created_at.asc",
                "limit": "1",
            },
            timeout=30,
        )
        response.raise_for_status()
        jobs = response.json()
        return jobs[0] if jobs else None

    def mark_job(self, job_id: str, status: str, error_message: str | None = None) -> None:
        payload: dict[str, Any] = {"status": status}
        now = utc_now()
        if status == "Checking":
            payload["started_at"] = now
        if status in {"Done", "Error"}:
            payload["finished_at"] = now
            payload["error_message"] = error_message

        response = requests.patch(
            f"{self.url}/rest/v1/sap_check_jobs?id=eq.{quote(job_id)}",
            headers=self.headers,
            data=json.dumps(payload),
            timeout=30,
        )
        response.raise_for_status()

    def mark_records_checking(self, record_ids: list[str], job_id: str) -> None:
        if not record_ids:
            return

        encoded_ids = ",".join(quote(record_id) for record_id in record_ids)
        response = requests.patch(
            f"{self.url}/rest/v1/mds_requests?id=in.({encoded_ids})",
            headers=self.headers,
            data=json.dumps({
                "sap_check_status": "Checking",
                "sap_check_message": "SAP Web automation is running",
                "sap_check_run_id": job_id,
            }),
            timeout=30,
        )
        response.raise_for_status()

    def get_records(self, record_ids: list[str]) -> list[MdsRecord]:
        if not record_ids:
            return []

        encoded_ids = ",".join(quote(record_id) for record_id in record_ids)
        response = requests.get(
            f"{self.url}/rest/v1/mds_requests",
            headers=self.headers,
            params={
                "id": f"in.({encoded_ids})",
                "select": "id,part_number,supplier_code,action_type",
            },
            timeout=30,
        )
        response.raise_for_status()

        rows = response.json()
        by_id = {
            row["id"]: MdsRecord(
                id=row["id"],
                part_number=row["part_number"],
                supplier_code=row["supplier_code"],
                action_type=row.get("action_type") or "request",
            )
            for row in rows
        }
        return [by_id[record_id] for record_id in record_ids if record_id in by_id]


class SapWebChecker:
    def __init__(self) -> None:
        self.sap_url = require_env("SAP_WEB_URL")
        self.query_url_template = os.getenv("SAP_QUERY_URL_TEMPLATE", "")
        self.webgui_tcode = os.getenv("SAP_WEBGUI_TCODE", "")
        self.webgui_base_url = os.getenv(
            "SAP_WEBGUI_BASE_URL",
            "https://ui5ce.volvo.com/sap/bc/gui/sap/its/webgui?~transaction={tcode}#",
        )
        self.timeout_ms = int(os.getenv("SAP_TIMEOUT_MS", "15000"))
        self.nav_timeout_ms = int(os.getenv("SAP_NAV_TIMEOUT_MS", "30000"))
        self.login_wait_seconds = int(os.getenv("SAP_LOGIN_WAIT_SECONDS", "120"))

    def login_if_needed(self, page: Page) -> None:
        user_selector = os.getenv("SAP_USER_SELECTOR", "")
        password_selector = os.getenv("SAP_PASSWORD_SELECTOR", "")
        submit_selector = os.getenv("SAP_LOGIN_SUBMIT_SELECTOR", "")
        user_field_name = os.getenv("SAP_USER_FIELD_NAME", "")
        password_field_name = os.getenv("SAP_PASSWORD_FIELD_NAME", "")
        login_button_name = os.getenv("SAP_LOGIN_BUTTON_NAME", "")
        user = os.getenv("SAP_USER", "")
        password = os.getenv("SAP_PASSWORD", "")

        if not user or not password:
            return

        try:
            if user_selector and password_selector:
                if page.locator(user_selector).count() == 0:
                    return
                page.locator(user_selector).fill(user, timeout=self.timeout_ms)
                page.locator(password_selector).fill(password, timeout=self.timeout_ms)
                if submit_selector:
                    page.locator(submit_selector).click(timeout=self.timeout_ms)
                elif login_button_name:
                    page.get_by_role("button", name=login_button_name).click(timeout=self.timeout_ms)
                page.wait_for_load_state("networkidle", timeout=self.timeout_ms)
                return

            if user_field_name and password_field_name:
                page.get_by_label(user_field_name, exact=True).fill(user, timeout=self.timeout_ms)
                page.get_by_label(password_field_name, exact=True).fill(password, timeout=self.timeout_ms)
                if login_button_name:
                    page.get_by_role("button", name=login_button_name).click(timeout=self.timeout_ms)
                page.wait_for_load_state("networkidle", timeout=self.timeout_ms)
                return

            self.try_common_login_selectors(page, user, password)
        except Exception as exc:
            print(f"[{utc_now()}] SAP auto login skipped/failed: {exc}")

    def try_common_login_selectors(self, page: Page, user: str, password: str) -> None:
        common_user_selectors = [
            'input[name="sap-user"]',
            'input[id*="user" i]',
            'input[name*="user" i]',
            'input[type="text"]',
        ]
        common_password_selectors = [
            'input[name="sap-password"]',
            'input[id*="password" i]',
            'input[name*="password" i]',
            'input[type="password"]',
        ]

        user_locator = None
        password_locator = None
        for selector in common_user_selectors:
            locator = page.locator(selector)
            if locator.count() > 0:
                user_locator = locator.first
                break
        for selector in common_password_selectors:
            locator = page.locator(selector)
            if locator.count() > 0:
                password_locator = locator.first
                break

        if user_locator is None or password_locator is None:
            return

        user_locator.fill(user, timeout=self.timeout_ms)
        password_locator.fill(password, timeout=self.timeout_ms)

        for button_name in ["Log On", "Logon", "Login", "Sign in", "Continue"]:
            try:
                page.get_by_role("button", name=button_name).click(timeout=3_000)
                page.wait_for_load_state("networkidle", timeout=self.timeout_ms)
                return
            except Exception:
                pass
        password_locator.press("Enter")
        page.wait_for_load_state("networkidle", timeout=self.timeout_ms)

    def prepare_session(self, page: Page) -> None:
        warmup_tcode = os.getenv("SAP_LOGIN_TCODE") or self.webgui_tcode
        ready_field = os.getenv("SAP_LOGIN_READY_FIELD_NAME") or os.getenv("SAP_MATERIAL_FIELD_NAME", "")

        if warmup_tcode:
            print(f"[{utc_now()}] Opening SAP WebGUI warmup T-code: {warmup_tcode}")
            self.goto_tcode(page, warmup_tcode)
        else:
            print(f"[{utc_now()}] Opening SAP URL: {self.sap_url}")
            page.goto(self.sap_url, timeout=self.nav_timeout_ms, wait_until="commit")

        self.login_if_needed(page)

        if not ready_field:
            return

        frame = self.frame_with_visible(page, ready_field, timeout_sec=self.login_wait_seconds)
        if frame is None:
            if os.getenv("SAP_USER", "") and os.getenv("SAP_PASSWORD", ""):
                raise RuntimeError(f"SAP login did not reach ready field: {ready_field}")
            raise RuntimeError(
                f"SAP is not ready. Complete manual login and make sure field '{ready_field}' is visible."
            )
        print(f"[{utc_now()}] SAP session ready, found field: {ready_field}")

    def check_record(self, page: Page, record: MdsRecord) -> SapCheckResult:
        try:
            self.open_record(page, record)
            info_record, info_message = self.read_info_record_status(page)
            deletion_flag = self.read_deletion_flag_status(page)
            status_message = self.read_text(page, "SAP_STATUS_MESSAGE_SELECTOR") or ""

            if not info_record:
                return SapCheckResult(
                    record_id=record.id,
                    status="Failed",
                    message=status_message or info_message or "No Info Record found",
                    info_record=None,
                    deletion_flag=deletion_flag,
                )

            if record.action_type == "cancel":
                if deletion_flag is True:
                    return SapCheckResult(
                        record_id=record.id,
                        status="Pass",
                        message="Info Record is marked with Deletion Flag",
                        info_record=info_record,
                        deletion_flag=deletion_flag,
                    )
                return SapCheckResult(
                    record_id=record.id,
                    status="Failed",
                    message="Deletion Flag is not set",
                    info_record=info_record,
                    deletion_flag=deletion_flag,
                )

            if deletion_flag is True:
                return SapCheckResult(
                    record_id=record.id,
                    status="Failed",
                    message="Info Record exists but is marked for deletion",
                    info_record=info_record,
                    deletion_flag=deletion_flag,
                )

            return SapCheckResult(
                record_id=record.id,
                status="Pass",
                message="Valid Info Record found",
                info_record=info_record,
                deletion_flag=deletion_flag,
            )
        except Exception as exc:
            return SapCheckResult(
                record_id=record.id,
                status="Error",
                message=f"SAP automation error: {exc}",
            )

    def open_record(self, page: Page, record: MdsRecord) -> None:
        if self.webgui_tcode:
            self.open_record_in_webgui_tcode(page, record)
            return

        if self.query_url_template:
            page.goto(self.query_url_template.format(
                part_number=quote(record.part_number),
                supplier_code=quote(record.supplier_code),
                action_type=quote(record.action_type),
            ))
            page.wait_for_load_state("networkidle", timeout=self.timeout_ms)
            return

        part_selector = require_env("SAP_PART_SELECTOR")
        supplier_selector = require_env("SAP_SUPPLIER_SELECTOR")
        search_selector = require_env("SAP_SEARCH_SELECTOR")

        page.goto(self.sap_url)
        page.wait_for_load_state("networkidle", timeout=self.timeout_ms)
        self.login_if_needed(page)
        page.locator(part_selector).fill(record.part_number, timeout=self.timeout_ms)
        page.locator(supplier_selector).fill(record.supplier_code, timeout=self.timeout_ms)
        page.locator(search_selector).click(timeout=self.timeout_ms)
        page.wait_for_load_state("networkidle", timeout=self.timeout_ms)

    def open_record_in_webgui_tcode(self, page: Page, record: MdsRecord) -> None:
        self.goto_tcode(page, self.webgui_tcode)
        self.login_if_needed(page)

        material_label = require_env("SAP_MATERIAL_FIELD_NAME")
        vendor_label = require_env("SAP_VENDOR_FIELD_NAME")
        execute_name = os.getenv("SAP_EXECUTE_BUTTON_NAME", "Execute  Emphasized")
        plant_label = os.getenv("SAP_PLANT_FIELD_NAME", "")
        plant_value = os.getenv("SAP_PLANT_VALUE", "")
        purchasing_org_label = os.getenv("SAP_PURCH_ORG_FIELD_NAME", "")
        purchasing_org_value = os.getenv("SAP_PURCH_ORG_VALUE", "")

        frame = self.frame_with_visible(page, material_label, timeout_sec=45)
        if frame is None:
            raise RuntimeError(f"Could not find SAP field: {material_label}")

        self.fill_sap_textbox(frame, material_label, record.part_number)
        self.fill_sap_textbox(frame, vendor_label, record.supplier_code)

        if plant_label and plant_value:
            self.try_fill_sap_textbox(frame, plant_label, plant_value)
        if purchasing_org_label and purchasing_org_value:
            self.try_fill_sap_textbox(frame, purchasing_org_label, purchasing_org_value)

        frame.get_by_role("button", name=execute_name).click(timeout=self.timeout_ms)
        self.dismiss_info_dialog(page)
        try:
            page.wait_for_load_state("networkidle", timeout=5_000)
        except PlaywrightTimeoutError:
            pass

    def goto_tcode(self, page: Page, tcode: str) -> None:
        target_url = self.webgui_base_url.format(tcode=tcode)
        try:
            page.goto(target_url, timeout=self.nav_timeout_ms, wait_until="commit")
        except PlaywrightTimeoutError:
            print(f"[{utc_now()}] Navigation to {tcode} timed out, trying reload.")
            try:
                page.reload(timeout=self.nav_timeout_ms, wait_until="commit")
                page.goto(target_url, timeout=self.nav_timeout_ms, wait_until="commit")
            except Exception:
                pass

    def find_frame(self, page: Page, predicate, timeout_sec: int = 25, interval: float = 0.5):
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            for frame in page.frames:
                try:
                    if predicate(frame):
                        return frame
                except Exception:
                    pass
            time.sleep(interval)
        return None

    def frame_with_visible(self, page: Page, textbox_name: str, timeout_sec: int = 25):
        return self.find_frame(
            page,
            lambda frame: frame.get_by_role("textbox", name=textbox_name, exact=True).is_visible(),
            timeout_sec=timeout_sec,
        )

    def fill_sap_textbox(self, frame, textbox_name: str, value: str) -> None:
        locator = frame.get_by_role("textbox", name=textbox_name, exact=True).and_(frame.locator("input")).first
        locator.click(timeout=self.timeout_ms)
        locator.fill(value, timeout=self.timeout_ms)
        locator.dispatch_event("input")
        locator.dispatch_event("change")
        time.sleep(0.1)
        locator.press("Tab")

    def try_fill_sap_textbox(self, frame, textbox_name: str, value: str) -> None:
        try:
            self.fill_sap_textbox(frame, textbox_name, value)
        except Exception as exc:
            print(f"[{utc_now()}] Optional field not filled ({textbox_name}): {exc}")

    def dismiss_info_dialog(self, page: Page) -> None:
        try:
            page.get_by_role("button", name="Continue").wait_for(timeout=3_000)
            page.get_by_role("button", name="Continue").click(timeout=self.timeout_ms)
        except PlaywrightTimeoutError:
            pass

    def read_text(self, page: Page, selector_env: str) -> str | None:
        selector = os.getenv(selector_env, "")
        if not selector:
            return None
        locator = page.locator(selector)
        if locator.count() == 0:
            return None
        text = locator.first.inner_text(timeout=self.timeout_ms).strip()
        return text or None

    def read_deletion_flag(self, page: Page) -> bool | None:
        selector = os.getenv("SAP_DELETION_FLAG_SELECTOR", "")
        if not selector:
            return None
        locator = page.locator(selector)
        if locator.count() == 0:
            return None
        return locator.first.evaluate(
            """element => {
              if (element instanceof HTMLInputElement) return Boolean(element.checked);
              const text = (element.innerText || element.textContent || '').trim().toLowerCase();
              return ['x', 'true', 'yes', 'y', 'checked', '1'].includes(text);
            }""",
            timeout=self.timeout_ms,
        )

    def read_info_record_status(self, page: Page) -> tuple[str | None, str | None]:
        selector_value = self.read_text(page, "SAP_INFO_RECORD_SELECTOR")
        if selector_value:
            return selector_value, None

        all_text = self.collect_all_frame_text(page)
        no_data_pattern = os.getenv(
            "SAP_NO_DATA_REGEX",
            r"No\s+data\s+satisfying|No\s+list\s+entries|not\s+found|does\s+not\s+exist",
        )
        if re.search(no_data_pattern, all_text, re.IGNORECASE):
            return None, "No Info Record found"

        info_regex = os.getenv("SAP_INFO_RECORD_REGEX", "")
        if info_regex:
            match = re.search(info_regex, all_text, re.IGNORECASE)
            if match:
                return match.group(1) if match.groups() else match.group(0), None

        if self.has_grid_rows(page):
            return "SAP_GRID_RESULT", None

        return None, "Could not determine Info Record from SAP page"

    def read_deletion_flag_status(self, page: Page) -> bool | None:
        selector_value = self.read_deletion_flag(page)
        if selector_value is not None:
            return selector_value

        all_text = self.collect_all_frame_text(page)
        flag_regex = os.getenv("SAP_DELETION_FLAG_TRUE_REGEX", "")
        if flag_regex and re.search(flag_regex, all_text, re.IGNORECASE):
            return True

        no_flag_regex = os.getenv("SAP_DELETION_FLAG_FALSE_REGEX", "")
        if no_flag_regex and re.search(no_flag_regex, all_text, re.IGNORECASE):
            return False

        return None

    def collect_all_frame_text(self, page: Page) -> str:
        chunks: list[str] = []
        for frame in page.frames:
            try:
                chunks.append(frame.evaluate("""
                () => {
                  const values = [];
                  if (document.body) {
                    values.push(document.body.innerText || "");
                    values.push(document.body.textContent || "");
                  }
                  document.querySelectorAll('[title], [aria-label], input, textarea').forEach(element => {
                    values.push(element.getAttribute('title') || '');
                    values.push(element.getAttribute('aria-label') || '');
                    values.push(element.value || '');
                  });
                  return values.join(' ');
                }
                """))
            except Exception:
                pass
        return " ".join(chunks).replace("\xa0", " ")

    def has_grid_rows(self, page: Page) -> bool:
        for frame in page.frames:
            try:
                if frame.locator('[id^="grid#"][id*="#1,"]').count() > 0:
                    return True
            except Exception:
                pass
        return False


def post_callback(job_id: str, results: list[SapCheckResult], status: str = "Done", error_message: str | None = None) -> None:
    callback_url = require_env("SAP_CHECK_CALLBACK_URL")
    token = os.getenv("SAP_CHECK_CALLBACK_TOKEN", "")
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"

    response = requests.post(
        callback_url,
        headers=headers,
        data=json.dumps({
            "jobId": job_id,
            "status": status,
            "errorMessage": error_message,
            "results": [result.to_payload() for result in results],
        }),
        timeout=60,
    )
    response.raise_for_status()


def run_once(queue: SupabaseQueue, checker: SapWebChecker) -> bool:
    job = queue.get_next_job()
    if not job:
        print(f"[{utc_now()}] No queued SAP check job found.")
        return False

    job_id = job["id"]
    record_ids = job.get("record_ids") or []
    print(f"[{utc_now()}] Picked job {job_id} with {len(record_ids)} record(s).")
    queue.mark_job(job_id, "Checking")
    queue.mark_records_checking(record_ids, job_id)

    try:
        records = queue.get_records(record_ids)
        print(f"[{utc_now()}] Loaded {len(records)} record(s) from Supabase.")
        results: list[SapCheckResult] = []

        with sync_playwright() as playwright:
            headless = os.getenv("SAP_HEADLESS", "false").lower() == "true"
            user_data_dir = os.getenv("SAP_PLAYWRIGHT_PROFILE", ".sap-playwright-profile")
            browser_context = playwright.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=headless,
                viewport={"width": 1440, "height": 950},
            )
            page = browser_context.pages[0] if browser_context.pages else browser_context.new_page()
            page.on("dialog", lambda dialog: dialog.accept())
            checker.prepare_session(page)

            for record in records:
                print(f"[{utc_now()}] Checking {record.supplier_code}/{record.part_number} ({record.action_type})")
                results.append(checker.check_record(page, record))

            browser_context.close()

        post_callback(job_id, results)
        print(f"[{utc_now()}] Job {job_id} completed and callback posted.")
        return True
    except Exception as exc:
        print(f"[{utc_now()}] Job {job_id} failed: {exc}")
        queue.mark_job(job_id, "Error", str(exc))
        post_callback(job_id, [], status="Error", error_message=str(exc))
        return True


def serve_http(queue: SupabaseQueue, checker: SapWebChecker) -> None:
    host = os.getenv("SAP_CHECK_WORKER_HOST", "127.0.0.1")
    port = int(os.getenv("SAP_CHECK_WORKER_PORT", "8765"))
    cors_origin = os.getenv("SAP_CHECK_WORKER_CORS_ORIGIN", "*")
    run_lock = threading.Lock()

    class SapCheckWorkerHandler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            print(f"[{utc_now()}] HTTP {self.address_string()} - {format % args}")

        def end_headers(self) -> None:
            self.send_header("Access-Control-Allow-Origin", cors_origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "content-type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            super().end_headers()

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.end_headers()

        def do_GET(self) -> None:
            if self.path.rstrip("/") == "/health":
                self.write_json(200, {
                    "success": True,
                    "running": run_lock.locked(),
                    "time": utc_now(),
                })
                return
            self.write_json(404, {"success": False, "error": "Not found"})

        def do_POST(self) -> None:
            if self.path.rstrip("/") != "/run-once":
                self.write_json(404, {"success": False, "error": "Not found"})
                return

            if run_lock.locked():
                self.write_json(202, {
                    "success": True,
                    "running": True,
                    "message": "SAP check worker is already running.",
                })
                return

            thread = threading.Thread(target=self.run_job_once, daemon=True)
            thread.start()
            self.write_json(202, {
                "success": True,
                "running": True,
                "message": "SAP check worker started.",
            })

        def run_job_once(self) -> None:
            with run_lock:
                try:
                    run_once(queue, checker)
                except Exception as exc:
                    print(f"[{utc_now()}] Worker HTTP run failed: {exc}")

        def write_json(self, status: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer((host, port), SapCheckWorkerHandler)
    print(f"[{utc_now()}] SAP Check Worker HTTP server listening on http://{host}:{port}")
    print(f"[{utc_now()}] Admin UI can wake it with POST http://{host}:{port}/run-once")
    server.serve_forever()


def main() -> None:
    load_env_file()
    print_startup_summary()
    queue = SupabaseQueue()
    checker = SapWebChecker()
    poll_seconds = int(os.getenv("SAP_CHECK_POLL_SECONDS", "10"))
    once = "--once" in sys.argv
    serve = "--serve" in sys.argv

    if serve:
        serve_http(queue, checker)
        return

    while True:
        did_work = run_once(queue, checker)
        if once:
            break
        if not did_work:
            time.sleep(poll_seconds)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def load_env_file() -> None:
    env_file = Path(os.getenv("SAP_CHECK_ENV_FILE", DEFAULT_ENV_FILE))
    if not env_file.exists():
        print(f"[{utc_now()}] Env file not found, using process environment only: {env_file}")
        return

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)

    print(f"[{utc_now()}] Loaded env file: {env_file}")


def print_startup_summary() -> None:
    masked_supabase = mask_value(os.getenv("SUPABASE_URL", ""))
    callback_url = os.getenv("SAP_CHECK_CALLBACK_URL", "")
    sap_url = os.getenv("SAP_WEB_URL", "")
    headless = os.getenv("SAP_HEADLESS", "false")
    profile = os.getenv("SAP_PLAYWRIGHT_PROFILE", ".sap-playwright-profile")
    sap_user = os.getenv("SAP_USER", "")

    print("[SAP Check Worker]")
    print(f"  SUPABASE_URL: {masked_supabase or '(missing)'}")
    print(f"  CALLBACK_URL: {callback_url or '(missing)'}")
    print(f"  SAP_WEB_URL: {sap_url or '(missing)'}")
    print(f"  SAP_HEADLESS: {headless}")
    print(f"  PROFILE: {profile}")
    print(f"  SAP_USER: {mask_value(sap_user) if sap_user else '(SSO/manual)'}")


def mask_value(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 12:
        return "***"
    return f"{value[:8]}...{value[-4:]}"


if __name__ == "__main__":
    main()
