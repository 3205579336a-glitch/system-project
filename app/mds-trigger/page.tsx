"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Info,
  Languages,
  Layers,
  Search,
  Send,
  TableProperties,
  Upload,
  X,
  XCircle,
  Zap,
} from "lucide-react";

type Language = "zh" | "en";
type RequestStatus = "New" | "Processing" | "Done" | "Rejected";
type SubmitMode = "single" | "bulk";
type ActionType = "request" | "cancel";
type BulkErrorCode = "missingPart" | "missingSupplier" | "duplicateUpload" | "duplicateDatabase";

type MDSRecord = {
  id: string;
  partNumber: string;
  supplierCode: string;
  actionType?: ActionType;
  status: RequestStatus;
  createdAt: string;
};

type BulkRow = {
  partNumber: string;
  supplierCode: string;
  errorCode?: BulkErrorCode;
};

type BulkSubmitResponse = {
  success?: boolean;
  error?: string;
  warning?: string;
  count?: number;
  records?: MDSRecord[];
  duplicatePartNumbers?: string[];
  duplicateRows?: Array<{ partNumber: string; supplierCode: string }>;
};

type SubmitResponse = {
  success?: boolean;
  error?: string;
  warning?: string;
  record?: MDSRecord;
};

type ValidationResponse = {
  success?: boolean;
  error?: string;
  duplicateRows?: Array<{ partNumber: string; supplierCode: string; source: "upload" | "database" }>;
};

const copy = {
  zh: {
    languageButton: "English",
    title: "MDS Trigger",
    subtitle: "Material Data Sheet 请求、取消与批量流转工作台",
    total: "Total",
    new: "New",
    processing: "Processing",
    done: "Done",
    rejected: "Rejected",
    singleSubmit: "单条提交",
    bulkUpload: "批量上传",
    email: "你的邮箱 (Email)",
    emailTitle: "请使用 @volvo.com 邮箱",
    partNumber: "物料号 (Part Number)",
    supplierCode: "供应商代码 (Supplier Code)",
    required: "*",
    requestRuleTitle: "Request 前提条件",
    requestRuleDesc: "触发 MDS Request 前，该物料必须已在 SAP 中存在有效的 Info Record (IR)，否则系统将拒绝该请求。",
    cancelRuleTitle: "Cancel 前提条件",
    cancelRuleDesc: "提交 Cancel 前，该物料对应的 Info Record (IR) 必须已在 SAP 中标记 Deletion Flag，否则取消操作无效。",
    submitRequest: "提交 Request",
    submitCancel: "提交 Cancel",
    processingAction: "处理中...",
    csvTemplate: "CSV 模板",
    csvTemplateDesc: "包含 partNumber / supplierCode，可混合多个 PARMA",
    downloadTemplate: "下载模板",
    uploadPrompt: "拖拽 CSV 或点击上传",
    uploadHint: "支持 .csv 格式，建议使用 UTF-8 编码",
    validatingFile: "正在校验重复...",
    fileReady: "文件已解析并完成校验",
    validRows: "条有效",
    errorRows: "条错误",
    uploadAgain: "点击重新上传",
    bulkSubmitting: "批量提交中...",
    duplicateValidating: "重复校验中...",
    bulkSubmit: "批量提交",
    preview: "预览",
    valid: "有效",
    error: "错误",
    missing: "缺失",
    triggerRules: "触发规则",
    ruleRequestTitle: "Request - 需要 Info Record",
    ruleRequestDesc: "触发前，物料必须在 SAP 中存在有效的 Info Record (IR)，否则系统将拒绝该请求。",
    ruleCancelTitle: "Cancel - IR 须标记 Deletion Flag",
    ruleCancelDesc: "提交取消时，对应的 Info Record 必须已在 SAP 中设置为 Deletion Flag，才可执行取消。",
    ruleAutoTitle: "自动发送",
    ruleAutoDesc: "Info Record 成功建立后，MDS 邮件将自动触发发送至供应商，无需手动操作。",
    historyTitle: "我的 MDS 请求记录",
    searchPlaceholder: "搜索物料号或供应商...",
    tablePart: "物料号",
    tableSupplier: "供应商",
    tableType: "类型",
    tableTime: "触发时间",
    tableStatus: "状态",
    emptyTitle: "暂无匹配记录",
    emptyDesc: "提交 Request 或上传批量 CSV 后，记录会显示在这里。",
    totalRecords: "共",
    recordsUnit: "条记录",
    page: "第",
    pageUnit: "页",
    previous: "上一页",
    next: "下一页",
    workflowIr: "IR 创建",
    workflowProcessing: "Processing",
    workflowDone: "Done - 自动发送",
    workflowDeletion: "IR Deletion Flag",
    dashboardTitle: "Global MDS Dashboard",
    dashboardSubtitle: "Global 队列总览与 SAP 处理状态",
    openPowerBi: "打开 Power BI",
    liveData: "Live Data (SAP)",
    useVolvoEmail: "请使用 @volvo.com 邮箱提交",
    submitSuccess: "已成功提交",
    requestSubmitted: "Request 已成功提交",
    cancelSubmitted: "Cancel 已成功提交",
    submitFailed: "提交失败，请检查网络或后台服务",
    requestFailed: "Request 提交失败，请稍后重试",
    cancelFailed: "Cancel 提交失败，请稍后重试",
    csvOnly: "请上传 .csv 格式文件",
    emptyCsv: "CSV 文件为空或格式有误",
    duplicateFound: "发现",
    duplicateRecords: "条数据库重复记录",
    noValidData: "没有有效数据可提交",
    bulkDone: "批量提交完成",
    sameBatch: "条已归入同一批次",
    bulkFailed: "批量提交过程中出现错误",
    validationFailed: "重复校验失败",
    errors: {
      missingPart: "物料号缺失",
      missingSupplier: "供应商代码缺失",
      duplicateUpload: "文件内重复 PARMA + Material",
      duplicateDatabase: "数据库已有相同操作",
    },
    status: {
      New: "新建",
      Processing: "处理中",
      Done: "已完成",
      Rejected: "已退回",
    },
  },
  en: {
    languageButton: "中文",
    title: "MDS Trigger",
    subtitle: "A clean workspace for MDS requests, cancellations, and batch handoff",
    total: "Total",
    new: "New",
    processing: "Processing",
    done: "Done",
    rejected: "Rejected",
    singleSubmit: "Single",
    bulkUpload: "Batch Upload",
    email: "Email",
    emailTitle: "Please use a @volvo.com email address",
    partNumber: "Part Number",
    supplierCode: "Supplier Code",
    required: "*",
    requestRuleTitle: "Request requirement",
    requestRuleDesc: "Before an MDS Request is triggered, the material must have a valid Info Record (IR) in SAP. Otherwise, the request will be rejected.",
    cancelRuleTitle: "Cancel requirement",
    cancelRuleDesc: "Before a Cancel request is submitted, the corresponding Info Record (IR) must be marked with Deletion Flag in SAP. Otherwise, the cancellation is invalid.",
    submitRequest: "Submit Request",
    submitCancel: "Submit Cancel",
    processingAction: "Processing...",
    csvTemplate: "CSV Template",
    csvTemplateDesc: "Use partNumber / supplierCode. Mixed PARMAs are supported.",
    downloadTemplate: "Download",
    uploadPrompt: "Drop CSV here or click to upload",
    uploadHint: "CSV only. UTF-8 encoding is recommended.",
    validatingFile: "Checking duplicates...",
    fileReady: "File parsed and validated",
    validRows: "valid",
    errorRows: "errors",
    uploadAgain: "Click to upload again",
    bulkSubmitting: "Submitting batch...",
    duplicateValidating: "Checking duplicates...",
    bulkSubmit: "Submit Batch",
    preview: "Preview",
    valid: "Valid",
    error: "Errors",
    missing: "Missing",
    triggerRules: "Trigger Rules",
    ruleRequestTitle: "Request - Info Record required",
    ruleRequestDesc: "Before triggering, the material must have a valid Info Record (IR) in SAP. Otherwise, the system will reject the request.",
    ruleCancelTitle: "Cancel - Deletion Flag required",
    ruleCancelDesc: "For cancellation, the corresponding Info Record must already be marked with Deletion Flag in SAP.",
    ruleAutoTitle: "Auto Send",
    ruleAutoDesc: "After the Info Record is created successfully, the MDS email is sent to the supplier automatically.",
    historyTitle: "My MDS Request History",
    searchPlaceholder: "Search material or supplier...",
    tablePart: "Part Number",
    tableSupplier: "Supplier",
    tableType: "Type",
    tableTime: "Triggered At",
    tableStatus: "Status",
    emptyTitle: "No matching records",
    emptyDesc: "After you submit a request or upload a batch CSV, records will appear here.",
    totalRecords: "Total",
    recordsUnit: "records",
    page: "Page",
    pageUnit: "",
    previous: "Previous",
    next: "Next",
    workflowIr: "IR Created",
    workflowProcessing: "Processing",
    workflowDone: "Done - Auto Send",
    workflowDeletion: "IR Deletion Flag",
    dashboardTitle: "Global MDS Dashboard",
    dashboardSubtitle: "Global queue overview and SAP processing status",
    openPowerBi: "Open Power BI",
    liveData: "Live Data (SAP)",
    useVolvoEmail: "Please submit with a @volvo.com email address",
    submitSuccess: "submitted successfully",
    requestSubmitted: "Request submitted successfully",
    cancelSubmitted: "Cancel submitted successfully",
    submitFailed: "Submission failed. Please check the network or backend service.",
    requestFailed: "Request submission failed. Please try again later.",
    cancelFailed: "Cancel submission failed. Please try again later.",
    csvOnly: "Please upload a .csv file",
    emptyCsv: "The CSV file is empty or has an invalid format",
    duplicateFound: "Found",
    duplicateRecords: "duplicate database records",
    noValidData: "No valid rows to submit",
    bulkDone: "Batch submitted",
    sameBatch: "rows added to the same batch",
    bulkFailed: "Batch submission failed",
    validationFailed: "Duplicate validation failed",
    errors: {
      missingPart: "Part number is missing",
      missingSupplier: "Supplier code is missing",
      duplicateUpload: "Duplicate PARMA + Material in file",
      duplicateDatabase: "Same operation already exists",
    },
    status: {
      New: "New",
      Processing: "Processing",
      Done: "Done",
      Rejected: "Rejected",
    },
  },
} as const;

function Tooltip({ children, content, label }: { children: React.ReactNode; content: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex items-center align-middle">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="ml-1.5 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none"
        aria-label={label}
      >
        {children}
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2.5 w-72 -translate-x-1/2">
          <div className="relative rounded-2xl bg-gray-950 p-4 text-xs leading-relaxed text-white shadow-2xl">
            {content}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-950" />
          </div>
        </div>
      )}
    </div>
  );
}

function RuleCard({ icon, color, title, desc }: { icon: React.ReactNode; color: string; title: string; desc: string }) {
  return (
    <div className={`flex gap-3 rounded-2xl border p-3.5 ${color}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="mb-0.5 text-xs font-semibold">{title}</p>
        <p className="text-xs leading-relaxed opacity-80">{desc}</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone: "blue" | "amber" | "emerald" | "red" | "slate" }) {
  const toneMap = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    red: "border-red-100 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  } as const;

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneMap[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function BulkPreviewTable({
  rows,
  onRemove,
  t,
}: {
  rows: BulkRow[];
  onRemove: (index: number) => void;
  t: (typeof copy)[Language];
}) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
          <TableProperties size={12} />
          {t.preview} - {rows.length}
        </span>
        <span className="text-[11px] text-gray-400">
          {rows.filter(row => !row.errorCode).length} {t.valid} / {rows.filter(row => row.errorCode).length} {t.error}
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-gray-50">
              {[t.tablePart, t.tableSupplier, ""].map((heading, index) => (
                <th key={`${heading}-${index}`} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.supplierCode}-${row.partNumber}-${index}`} className={`border-b border-gray-50 last:border-none ${row.errorCode ? "bg-red-50/50" : ""}`}>
                <td className="px-4 py-2 text-xs font-medium text-gray-800">
                  {row.partNumber || <span className="italic text-red-400">{t.missing}</span>}
                </td>
                <td className="px-4 py-2 text-xs text-gray-600">
                  {row.supplierCode || <span className="italic text-red-400">{t.missing}</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  {row.errorCode ? (
                    <span className="text-[10px] text-red-400">{t.errors[row.errorCode]}</span>
                  ) : (
                    <button type="button" onClick={() => onRemove(index)} className="text-gray-300 transition-colors hover:text-red-400" aria-label="Remove row">
                      <X size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MDSTriggerPage() {
  const [language, setLanguage] = useState<Language>("zh");
  const [activeTab, setActiveTab] = useState<ActionType>("request");
  const [submitMode, setSubmitMode] = useState<SubmitMode>("single");
  const [partNumber, setPartNumber] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [historyRecords, setHistoryRecords] = useState<MDSRecord[]>([]);
  const [email, setEmail] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [isValidatingBulk, setIsValidatingBulk] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = copy[language];
  const pageSize = 8;
  const isVolvoEmail = (value: string) => /^[A-Z0-9._%+-]+@volvo\.com$/i.test(value.trim());

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const savedLanguage = localStorage.getItem("mds_language");
    if (savedLanguage === "zh" || savedLanguage === "en") setLanguage(savedLanguage);

    let sId = localStorage.getItem("mds_session_id");
    if (!sId) {
      sId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      localStorage.setItem("mds_session_id", sId);
    }
    setSessionId(sId);

    const cachedEmail = localStorage.getItem("mds_user_email");
    if (cachedEmail) setEmail(cachedEmail);

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/mds-request?sessionId=${sId}`);
        const data = await res.json();
        if (data.success) setHistoryRecords(data.records);
      } catch (err) {
        console.error("Failed to load MDS history:", err);
      }
    };
    fetchHistory();
  }, []);

  const splitCSVLine = (line: string) => line.split(",").map(cell => cell.trim().replace(/^"|"$/g, ""));
  const pairKey = (row: Pick<BulkRow, "partNumber" | "supplierCode">) => `${row.supplierCode}::${row.partNumber}`;

  const parseCSV = (text: string): BulkRow[] => {
    const lines = text.trim().split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = splitCSVLine(lines[0]).map(header => header.toLowerCase());
    const partIndex = headers.indexOf("partnumber");
    const supplierIndex = headers.indexOf("suppliercode");
    const seen = new Set<string>();

    return lines.slice(1).map(line => {
      const columns = splitCSVLine(line);
      const parsedPart = partIndex >= 0 ? columns[partIndex] ?? "" : "";
      const parsedSupplier = supplierIndex >= 0 ? columns[supplierIndex] ?? "" : "";
      const key = `${parsedSupplier}::${parsedPart}`;
      let errorCode: BulkErrorCode | undefined;

      if (!parsedPart) errorCode = "missingPart";
      else if (!parsedSupplier) errorCode = "missingSupplier";
      else if (seen.has(key)) errorCode = "duplicateUpload";

      if (parsedPart && parsedSupplier) seen.add(key);
      return { partNumber: parsedPart, supplierCode: parsedSupplier, errorCode };
    });
  };

  const validateBulkRows = async (rows: BulkRow[]) => {
    const locallyValidRows = rows.filter(row => !row.errorCode);
    if (locallyValidRows.length === 0) return rows;

    setIsValidatingBulk(true);
    try {
      const res = await fetch("/api/mds-request/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: locallyValidRows.map(row => ({
            partNumber: row.partNumber,
            supplierCode: row.supplierCode,
          })),
          action: activeTab,
          language,
        }),
      });
      const data = (await res.json()) as ValidationResponse;
      if (!res.ok || !data.success) throw new Error(data.error || t.validationFailed);

      const duplicateMap = new Map<string, BulkErrorCode>(
        (data.duplicateRows || []).map(row => [
          `${row.supplierCode}::${row.partNumber}`,
          row.source === "database" ? "duplicateDatabase" : "duplicateUpload",
        ])
      );

      return rows.map(row => {
        if (row.errorCode) return row;
        const duplicateError = duplicateMap.get(pairKey(row));
        return duplicateError ? { ...row, errorCode: duplicateError } : row;
      });
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : t.validationFailed, "error");
      return rows;
    } finally {
      setIsValidatingBulk(false);
    }
  };

  const handleSingleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionId || !email) return;
    if (!isVolvoEmail(email)) {
      showToast(t.useVolvoEmail, "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/mds-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partNumber, supplierCode, action: activeTab, sessionId, email, language }),
      });
      const data = (await res.json()) as SubmitResponse;
      if (!res.ok || !data.success) throw new Error(data.error || (activeTab === "request" ? t.requestFailed : t.cancelFailed));

      localStorage.setItem("mds_user_email", email);
      const newRecord: MDSRecord = data.record || {
        id: Date.now().toString(),
        partNumber,
        supplierCode,
        actionType: activeTab,
        status: "New",
        createdAt: new Date().toLocaleString(language === "zh" ? "zh-CN" : "en-US", { hour12: false }).substring(0, 16).replace(/\//g, "-"),
      };
      setHistoryRecords(prev => [newRecord, ...prev.filter(record => record.id !== newRecord.id)]);
      showToast(data.warning || `${activeTab === "request" ? t.requestSubmitted : t.cancelSubmitted} - ${partNumber}`, data.warning ? "error" : "success");
      setPartNumber("");
      setSupplierCode("");
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : t.submitFailed, "error");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = ["partNumber,supplierCode", "11045236,38532", "11045237,38532", "22004501,41288"].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "MDS_Bulk_Template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      showToast(t.csvOnly, "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      setBulkRows(rows);

      if (rows.length === 0) {
        showToast(t.emptyCsv, "error");
        return;
      }

      validateBulkRows(rows).then(validatedRows => {
        setBulkRows(validatedRows);
        const duplicateCount = validatedRows.filter(row => row.errorCode === "duplicateDatabase").length;
        if (duplicateCount > 0) showToast(`${t.duplicateFound} ${duplicateCount} ${t.duplicateRecords}`, "error");
      });
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleBulkSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionId || !email || bulkRows.length === 0) return;
    if (!isVolvoEmail(email)) {
      showToast(t.useVolvoEmail, "error");
      return;
    }

    const validRows = bulkRows.filter(row => !row.errorCode);
    if (validRows.length === 0) {
      showToast(t.noValidData, "error");
      return;
    }

    setLoading(true);
    try {
      localStorage.setItem("mds_user_email", email);
      const res = await fetch("/api/mds-request/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows.map(row => ({
            partNumber: row.partNumber,
            supplierCode: row.supplierCode,
          })),
          action: activeTab,
          sessionId,
          email,
          language,
        }),
      });
      const data = (await res.json()) as BulkSubmitResponse;
      if (!res.ok || !data.success) {
        const duplicateList = data.duplicatePartNumbers?.length
          ? ` (${data.duplicatePartNumbers.slice(0, 8).join(", ")}${data.duplicatePartNumbers.length > 8 ? "..." : ""})`
          : "";
        throw new Error(`${data.error || t.bulkFailed}${duplicateList}`);
      }

      const returnedRecords: MDSRecord[] = Array.isArray(data.records)
        ? data.records.map(record => ({
          id: record.id,
          partNumber: record.partNumber,
          supplierCode: record.supplierCode,
          actionType: record.actionType,
          status: record.status,
          createdAt: record.createdAt,
        }))
        : validRows.map((row, index) => ({
          id: `${Date.now()}-${index}`,
          partNumber: row.partNumber,
          supplierCode: row.supplierCode,
          actionType: activeTab,
          status: "New" as RequestStatus,
          createdAt: new Date().toLocaleString(language === "zh" ? "zh-CN" : "en-US", { hour12: false }).substring(0, 16).replace(/\//g, "-"),
        }));

      const returnedIds = new Set(returnedRecords.map(record => record.id));
      setHistoryRecords(prev => [...returnedRecords, ...prev.filter(record => !returnedIds.has(record.id))]);
      showToast(data.warning || `${t.bulkDone} - ${data.count || validRows.length} ${t.sameBatch}`, data.warning ? "error" : "success");
      setBulkRows([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : t.bulkFailed, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleActionTabChange = (tab: ActionType) => {
    setActiveTab(tab);
    if (submitMode !== "bulk" || bulkRows.length === 0) return;

    const rowsWithoutDatabaseErrors = bulkRows.map(row =>
      row.errorCode === "duplicateDatabase" ? { ...row, errorCode: undefined } : row
    );

    setBulkRows(rowsWithoutDatabaseErrors);
    validateBulkRows(rowsWithoutDatabaseErrors).then(validatedRows => setBulkRows(validatedRows));
  };

  const toggleLanguage = () => {
    setLanguage(current => {
      const next = current === "zh" ? "en" : "zh";
      localStorage.setItem("mds_language", next);
      return next;
    });
  };

  const filtered = useMemo(
    () => historyRecords.filter(record =>
      record.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.supplierCode.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [historyRecords, searchQuery]
  );

  const validBulkCount = bulkRows.filter(row => !row.errorCode).length;
  const errorBulkCount = bulkRows.filter(row => row.errorCode).length;
  const newCount = historyRecords.filter(record => record.status === "New").length;
  const processingCount = historyRecords.filter(record => record.status === "Processing").length;
  const doneCount = historyRecords.filter(record => record.status === "Done").length;
  const rejectedCount = historyRecords.filter(record => record.status === "Rejected").length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[#F5F6F8] font-sans text-slate-900">
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 flex max-w-[min(92vw,520px)] items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium shadow-xl transition-all ${toast.type === "success" ? "bg-gray-950 text-white" : "bg-red-600 text-white"}`}
          style={{ animation: "fadeSlideIn 0.25s ease" }}
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span className="leading-snug">{toast.msg}</span>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-8">
        <div className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-[0_2px_16px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{t.title}</h1>
              <button
                type="button"
                onClick={toggleLanguage}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                aria-label="Switch language"
              >
                <Languages size={14} />
                {t.languageButton}
              </button>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">{t.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:min-w-[640px]">
            <SummaryCard label={t.total} value={historyRecords.length} tone="slate" />
            <SummaryCard label={t.new} value={newCount} tone="blue" />
            <SummaryCard label={t.processing} value={processingCount} tone="amber" />
            <SummaryCard label={t.done} value={doneCount} tone="emerald" />
            <SummaryCard label={t.rejected} value={rejectedCount} tone="red" />
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
              <div className="mb-5 flex rounded-2xl bg-gray-100 p-1">
                {(["single", "bulk"] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSubmitMode(mode);
                      setBulkRows([]);
                    }}
                    className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition-all ${submitMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {mode === "single" ? <Send size={13} /> : <Layers size={13} />}
                    <span className="truncate">{mode === "single" ? t.singleSubmit : t.bulkUpload}</span>
                  </button>
                ))}
              </div>

              {submitMode === "single" && (
                <>
                  <div className="mb-7 flex rounded-2xl bg-gray-100 p-1">
                    {(["request", "cancel"] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => handleActionTabChange(tab)}
                        className={`min-h-10 flex-1 rounded-xl px-2 text-sm font-medium transition-all ${activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        {tab === "request" ? "MDS Request" : "MDS Cancel"}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSingleSubmit} className="space-y-5">
                    <EmailField email={email} setEmail={setEmail} t={t} />

                    <div>
                      <label className="mb-2 ml-0.5 flex items-center text-[13px] font-medium text-gray-500">
                        {t.partNumber}<span className="ml-0.5 text-red-500">{t.required}</span>
                        <Tooltip label={activeTab === "request" ? t.requestRuleTitle : t.cancelRuleTitle} content={activeTab === "request" ? (
                          <div className="space-y-2">
                            <p className="flex items-center gap-1.5 font-semibold text-blue-300"><Info size={12} /> {t.requestRuleTitle}</p>
                            <p>{t.requestRuleDesc}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="flex items-center gap-1.5 font-semibold text-amber-300"><AlertTriangle size={12} /> {t.cancelRuleTitle}</p>
                            <p>{t.cancelRuleDesc}</p>
                          </div>
                        )}>
                          <Info size={14} />
                        </Tooltip>
                      </label>
                      <input
                        type="text"
                        required
                        value={partNumber}
                        onChange={event => setPartNumber(event.target.value)}
                        className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-black"
                        placeholder="e.g. 11045236"
                      />
                    </div>

                    <div>
                      <label className="mb-2 ml-0.5 block text-[13px] font-medium text-gray-500">
                        {t.supplierCode}<span className="ml-0.5 text-red-500">{t.required}</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={supplierCode}
                        onChange={event => setSupplierCode(event.target.value)}
                        className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-black"
                        placeholder="e.g. 38532"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 ${activeTab === "request" ? "bg-gray-950 text-white hover:bg-gray-800" : "bg-red-600 text-white hover:bg-red-700"}`}
                      >
                        {activeTab === "request" ? <Send size={15} /> : <XCircle size={15} />}
                        <span>{loading ? t.processingAction : activeTab === "request" ? t.submitRequest : t.submitCancel}</span>
                      </button>
                    </div>
                  </form>
                </>
              )}

              {submitMode === "bulk" && (
                <form onSubmit={handleBulkSubmit} className="space-y-5">
                  <div className="flex rounded-2xl bg-gray-100 p-1">
                    {(["request", "cancel"] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => handleActionTabChange(tab)}
                        className={`min-h-10 flex-1 rounded-xl px-2 text-sm font-medium transition-all ${activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        {tab === "request" ? "MDS Request" : "MDS Cancel"}
                      </button>
                    ))}
                  </div>

                  <EmailField email={email} setEmail={setEmail} t={t} />

                  <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                      <FileText size={16} className="text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-blue-900">{t.csvTemplate}</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-blue-600">{t.csvTemplateDesc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      <Download size={12} />
                      <span>{t.downloadTemplate}</span>
                    </button>
                  </div>

                  <div
                    onDragOver={event => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${isDragging ? "border-gray-900 bg-gray-50" : bulkRows.length > 0 ? "border-emerald-300 bg-emerald-50/40" : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                    {bulkRows.length > 0 ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{isValidatingBulk ? t.validatingFile : t.fileReady}</p>
                        <p className="text-xs text-gray-500">
                          <span className="font-medium text-emerald-600">{validBulkCount} {t.validRows}</span>
                          {errorBulkCount > 0 && (
                            <>
                              <span className="mx-1 text-gray-300">/</span>
                              <span className="font-medium text-red-500">{errorBulkCount} {t.errorRows}</span>
                            </>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-400">{t.uploadAgain}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                          <Upload size={18} className="text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-700">{t.uploadPrompt}</p>
                        <p className="text-xs leading-5 text-gray-400">{t.uploadHint}</p>
                      </div>
                    )}
                  </div>

                  <BulkPreviewTable rows={bulkRows} onRemove={index => setBulkRows(prev => prev.filter((_, rowIndex) => rowIndex !== index))} t={t} />

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || isValidatingBulk || validBulkCount === 0}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 px-6 py-3.5 text-sm font-medium text-white transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50"
                    >
                      <Layers size={15} />
                      <span>
                        {loading
                          ? t.bulkSubmitting
                          : isValidatingBulk
                            ? t.duplicateValidating
                            : `${t.bulkSubmit}${validBulkCount > 0 ? ` (${validBulkCount})` : ""}`}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_2px_16px_rgba(15,23,42,0.05)]">
              <p className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-gray-400">{t.triggerRules}</p>
              <RuleCard icon={<Info size={15} className="text-blue-500" />} color="border-blue-100 bg-blue-50 text-blue-900" title={t.ruleRequestTitle} desc={t.ruleRequestDesc} />
              <RuleCard icon={<AlertTriangle size={15} className="text-amber-500" />} color="border-amber-100 bg-amber-50 text-amber-900" title={t.ruleCancelTitle} desc={t.ruleCancelDesc} />
              <RuleCard icon={<Zap size={15} className="text-emerald-500" />} color="border-emerald-100 bg-emerald-50 text-emerald-900" title={t.ruleAutoTitle} desc={t.ruleAutoDesc} />
            </div>
          </div>

          <div className="flex min-h-[560px] flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)] lg:col-span-7 xl:col-span-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <FileText size={18} className="text-gray-400" />
                {t.historyTitle}
                <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{historyRecords.length}</span>
              </h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-full bg-gray-50 py-2 pl-9 pr-4 text-sm outline-none ring-1 ring-gray-200 transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-black sm:w-56"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    {[t.tablePart, t.tableSupplier, t.tableType, t.tableTime, t.tableStatus].map((heading, index) => (
                      <th key={heading} className={`pb-3 text-[12px] font-semibold uppercase tracking-wider text-gray-400 ${index === 4 ? "text-right" : ""}`}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20">
                        <div className="mx-auto flex max-w-sm flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                            <FileText size={20} />
                          </div>
                          <p className="text-sm font-semibold text-slate-700">{t.emptyTitle}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.emptyDesc}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginated.map(record => (
                      <tr key={record.id} className="group border-b border-gray-50 transition-colors last:border-none hover:bg-gray-50/70">
                        <td className="py-4 text-sm font-semibold text-gray-900">{record.partNumber}</td>
                        <td className="py-4 text-sm text-gray-600">{record.supplierCode || "-"}</td>
                        <td className="py-4"><ActionBadge action={record.actionType || "request"} /></td>
                        <td className="py-4 text-xs tabular-nums text-gray-400">{record.createdAt}</td>
                        <td className="py-4 text-right"><StatusBadge status={record.status} label={t.status[record.status]} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4">
                <span className="text-[12px] font-medium text-gray-400">
                  {t.totalRecords} {filtered.length} {t.recordsUnit} / {t.page} {currentPage} / {totalPages} {t.pageUnit}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.previous}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.next}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-gray-50 pt-5">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-gray-400">
                {[
                  { label: t.workflowIr, cls: "border-gray-100 bg-gray-50" },
                  null,
                  { label: "MDS Request", cls: "border-blue-100 bg-blue-50 text-blue-500" },
                  null,
                  { label: t.workflowProcessing, cls: "border-gray-100 bg-gray-50" },
                  null,
                  { label: t.workflowDone, cls: "border-emerald-100 bg-emerald-50 text-emerald-600" },
                ].map((item, index) => item === null
                  ? <ChevronRight key={index} size={12} className="shrink-0 text-gray-300" />
                  : <span key={index} className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 ${item.cls}`}>{item.label}</span>
                )}
                <span className="ml-2 text-gray-300">|</span>
                <span className="flex items-center gap-1 px-2.5 py-1.5 text-gray-400">{t.workflowDeletion}</span>
                <span className="flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-red-500">Cancel</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{t.dashboardTitle}</h2>
              <p className="mt-0.5 text-xs text-slate-400">{t.dashboardSubtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://app.powerbi.com/reportEmbed?reportId=8bd98c42-d590-42d9-baff-b9a24ef143d8&autoAuth=true&ctid=f25493ae-1c98-41d7-8a33-0be75f5fe603"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                {t.openPowerBi}
              </a>
              <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
                {t.liveData}
              </span>
            </div>
          </div>
          <div className="relative bg-slate-50" style={{ height: 560 }}>
            <iframe
              title="Global MDS Power BI"
              className="absolute inset-0 h-full w-full border-none"
              src="https://app.powerbi.com/reportEmbed?reportId=8bd98c42-d590-42d9-baff-b9a24ef143d8&autoAuth=true&ctid=f25493ae-1c98-41d7-8a33-0be75f5fe603"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailField({
  email,
  setEmail,
  t,
}: {
  email: string;
  setEmail: (value: string) => void;
  t: (typeof copy)[Language];
}) {
  return (
    <div>
      <label className="mb-2 ml-0.5 block text-[13px] font-medium text-gray-500">
        {t.email}<span className="ml-0.5 text-red-500">{t.required}</span>
      </label>
      <div className="relative">
        <input
          type="email"
          required
          pattern="^[A-Za-z0-9._%+-]+@volvo\.com$"
          title={t.emailTitle}
          value={email}
          onChange={event => {
            setEmail(event.target.value);
            localStorage.setItem("mds_user_email", event.target.value);
          }}
          className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition-all focus:ring-2 focus:ring-black"
          placeholder="e.g. name@volvo.com"
        />
        {email && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
            <CheckCircle2 size={16} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: RequestStatus; label: string }) {
  const map = {
    New: "bg-blue-50 text-blue-600 ring-blue-100",
    Processing: "bg-amber-50 text-amber-600 ring-amber-100",
    Done: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    Rejected: "bg-red-50 text-red-600 ring-red-100",
  } as const;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${map[status]}`}>
      {label}
    </span>
  );
}

function ActionBadge({ action }: { action: ActionType }) {
  const map = {
    request: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    cancel: "bg-rose-50 text-rose-600 ring-rose-100",
  } as const;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${map[action]}`}>
      {action === "request" ? "Request" : "Cancel"}
    </span>
  );
}
