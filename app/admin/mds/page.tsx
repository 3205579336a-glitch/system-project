"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Clock,
  Languages,
  Layers,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

type Language = "zh" | "en";
type AdminStatus = "New" | "Processing" | "Done" | "Rejected";
type MDSActionType = "request" | "cancel";
type BatchValue<T> = T | "Mixed";
type AdminAction = "Approve" | "Complete" | "Reject";

type AdminRecord = {
  id: string;
  partNumber: string;
  supplierCode: string;
  actionType: MDSActionType;
  status: AdminStatus;
  submitterEmail: string;
  adminComment?: string | null;
  createdAt: string;
  batchId?: string | null;
  batchSize?: number;
  batchIndex?: number;
};

type AdminBatch = {
  key: string;
  batchId?: string | null;
  records: AdminRecord[];
  partNumbers: string[];
  supplierCode: string;
  actionType: BatchValue<MDSActionType>;
  status: BatchValue<AdminStatus>;
  submitterEmail: string;
  adminComment?: string | null;
  createdAt: string;
};

type AdminListResponse = {
  success?: boolean;
  error?: string;
  records?: AdminRecord[];
};

type RejectTarget =
  | { type: "batch"; batch: AdminBatch }
  | { type: "record"; record: AdminRecord };

type ActionTarget =
  | { type: "batch"; batch: AdminBatch; action: Exclude<AdminAction, "Reject"> }
  | { type: "record"; record: AdminRecord; action: Exclude<AdminAction, "Reject"> };

const copy = {
  zh: {
    languageButton: "English",
    title: "MDS Admin 审批中心",
    subtitle: "按批次管理 MDS 请求、退回与 Global 流转",
    searchPlaceholder: "搜索批次、物料、供应商或邮箱...",
    total: "Total",
    new: "New",
    processing: "Processing",
    done: "Done",
    rejected: "Rejected",
    loading: "正在加载数据...",
    loadFailed: "数据加载失败，请稍后重试。",
    loadTimeout: "数据加载超时，请检查网络或 Supabase 连接。",
    loadHint: "不会影响已保存的数据，只是当前列表没有成功拉取。",
    reload: "重新加载",
    batchMaterial: "批次 / 物料",
    requestType: "请求类型",
    submitInfo: "提交信息",
    currentStatus: "当前状态",
    actions: "管理操作",
    noMatches: "暂无匹配批次",
    items: "条",
    singleParts: "单个零件",
    supplier: "Supplier",
    batchReject: "整批退回",
    batchApprove: "整批审批通过",
    batchInterrupt: "整批中断退回",
    batchComplete: "整批标记完成",
    archived: "归档完成",
    rejectedCanResubmit: "已退回，可重新提交",
    mixedStatus: "批次状态不一致",
    material: "Material",
    parma: "PARMA",
    type: "类型",
    status: "状态",
    comment: "批注",
    recordActions: "单个操作",
    noComment: "-",
    rejectRecord: "拒绝此零件",
    approveRecord: "通过此零件",
    returnRecord: "退回此零件",
    completeRecord: "完成此零件",
    recordDone: "已完成",
    recordRejected: "已退回",
    rejectPrefix: "退回:",
    confirmApproveTitle: "确认审批通过",
    confirmCompleteTitle: "确认标记完成",
    confirmBatchDesc: "将 {count} 条记录更新为 {status}，并触发后续通知。",
    confirmRecordDesc: "将 {supplier} / {part} 更新为 {status}。",
    cancel: "取消",
    confirm: "确认执行",
    processingAction: "处理中...",
    actionSuccess: "操作成功，状态已更新。",
    actionFailed: "操作失败，请稍后重试。",
    rejectBatchTitle: "填写整批退回批注",
    rejectRecordTitle: "填写单个零件退回批注",
    rejectBatchDesc: "将 {count} 条记录退回并发送一次通知",
    rejectRecordDesc: "将 {supplier} / {part} 退回并发送一次通知",
    rejectPlaceholder: "请输入拒绝原因，例如：SAP 数据异常，请重新核对...",
    rejectConfirmBatch: "确认整批退回",
    rejectConfirmRecord: "确认退回此零件",
    rejectSuccess: "已退回并记录批注。",
    rejectFailed: "退回操作失败，请稍后重试。",
    statusLabel: {
      New: "New",
      Processing: "Processing",
      Done: "Done",
      Rejected: "Rejected",
      Mixed: "Mixed",
    },
  },
  en: {
    languageButton: "中文",
    title: "MDS Admin Approval Center",
    subtitle: "Manage MDS requests, rejections, and Global handoff by batch",
    searchPlaceholder: "Search batch, material, supplier, or email...",
    total: "Total",
    new: "New",
    processing: "Processing",
    done: "Done",
    rejected: "Rejected",
    loading: "Loading records...",
    loadFailed: "Failed to load data. Please try again later.",
    loadTimeout: "Loading timed out. Please check the network or Supabase connection.",
    loadHint: "Saved data is not affected. Only the current list failed to refresh.",
    reload: "Reload",
    batchMaterial: "Batch / Material",
    requestType: "Request Type",
    submitInfo: "Submission",
    currentStatus: "Status",
    actions: "Actions",
    noMatches: "No matching batches",
    items: "items",
    singleParts: "Parts",
    supplier: "Supplier",
    batchReject: "Reject Batch",
    batchApprove: "Approve Batch",
    batchInterrupt: "Return Batch",
    batchComplete: "Complete Batch",
    archived: "Archived",
    rejectedCanResubmit: "Rejected, can be resubmitted",
    mixedStatus: "Mixed batch status",
    material: "Material",
    parma: "PARMA",
    type: "Type",
    status: "Status",
    comment: "Comment",
    recordActions: "Record Actions",
    noComment: "-",
    rejectRecord: "Reject Part",
    approveRecord: "Approve Part",
    returnRecord: "Return Part",
    completeRecord: "Complete Part",
    recordDone: "Done",
    recordRejected: "Rejected",
    rejectPrefix: "Rejected:",
    confirmApproveTitle: "Confirm Approval",
    confirmCompleteTitle: "Confirm Completion",
    confirmBatchDesc: "Update {count} records to {status} and trigger the follow-up notification.",
    confirmRecordDesc: "Update {supplier} / {part} to {status}.",
    cancel: "Cancel",
    confirm: "Confirm",
    processingAction: "Processing...",
    actionSuccess: "Action completed. Status updated.",
    actionFailed: "Action failed. Please try again later.",
    rejectBatchTitle: "Add Batch Rejection Comment",
    rejectRecordTitle: "Add Part Rejection Comment",
    rejectBatchDesc: "Reject {count} records and send one notification",
    rejectRecordDesc: "Reject {supplier} / {part} and send one notification",
    rejectPlaceholder: "Enter the rejection reason, e.g. SAP data issue. Please verify again...",
    rejectConfirmBatch: "Confirm Batch Rejection",
    rejectConfirmRecord: "Confirm Part Rejection",
    rejectSuccess: "Rejected and comment saved.",
    rejectFailed: "Rejection failed. Please try again later.",
    statusLabel: {
      New: "New",
      Processing: "Processing",
      Done: "Done",
      Rejected: "Rejected",
      Mixed: "Mixed",
    },
  },
} as const;

const getBatchStatus = (records: AdminRecord[]): AdminBatch["status"] => {
  const first = records[0]?.status;
  return records.every(record => record.status === first) ? first : "Mixed";
};

const formatText = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), template);

export default function AdminDashboard() {
  const [language, setLanguage] = useState<Language>("zh");
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [expandedBatchKeys, setExpandedBatchKeys] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const t = copy[language];

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchRecords = async (options?: { silent?: boolean }) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    if (!options?.silent) {
      setLoading(true);
      setLoadError("");
    }

    try {
      const res = await fetch("/api/admin/mds", { signal: controller.signal });
      const data = (await res.json()) as AdminListResponse;
      if (data.success && Array.isArray(data.records)) {
        setRecords(data.records);
      } else {
        setLoadError(data.error || t.loadFailed);
      }
    } catch {
      if (!options?.silent) setLoadError(t.loadTimeout);
    } finally {
      window.clearTimeout(timeoutId);
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    const savedLanguage = localStorage.getItem("mds_admin_language");
    if (savedLanguage === "zh" || savedLanguage === "en") setLanguage(savedLanguage);
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLanguage = () => {
    setLanguage(current => {
      const next = current === "zh" ? "en" : "zh";
      localStorage.setItem("mds_admin_language", next);
      return next;
    });
  };

  const batches = useMemo<AdminBatch[]>(() => {
    const groups = new Map<string, AdminRecord[]>();

    records.forEach(record => {
      const key = record.batchId || record.id;
      groups.set(key, [...(groups.get(key) || []), record]);
    });

    return Array.from(groups.entries())
      .map(([key, groupRecords]) => {
        const sorted = [...groupRecords].sort((a, b) => (a.batchIndex || 1) - (b.batchIndex || 1));
        const supplierCodes = Array.from(new Set(sorted.map(record => record.supplierCode)));
        const actionTypes = Array.from(new Set(sorted.map(record => record.actionType)));
        const actionType: AdminBatch["actionType"] = actionTypes.length === 1 ? actionTypes[0] : "Mixed";
        return {
          key,
          batchId: sorted[0].batchId,
          records: sorted,
          partNumbers: sorted.map(record => record.partNumber),
          supplierCode: supplierCodes.length === 1 ? supplierCodes[0] : `Mixed (${supplierCodes.length} PARMAs)`,
          actionType,
          status: getBatchStatus(sorted),
          submitterEmail: sorted[0].submitterEmail,
          adminComment: sorted.find(record => record.adminComment)?.adminComment,
          createdAt: sorted[0].createdAt,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [records]);

  const filtered = batches.filter(batch => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      batch.partNumbers.some(partNumber => partNumber.toLowerCase().includes(query)) ||
      batch.supplierCode.toLowerCase().includes(query) ||
      batch.actionType.toLowerCase().includes(query) ||
      batch.submitterEmail.toLowerCase().includes(query) ||
      (batch.batchId || "").toLowerCase().includes(query)
    );
  });

  const statusCounts = {
    total: records.length,
    new: records.filter(record => record.status === "New").length,
    processing: records.filter(record => record.status === "Processing").length,
    done: records.filter(record => record.status === "Done").length,
    rejected: records.filter(record => record.status === "Rejected").length,
  };

  const isBatchExpanded = (batchKey: string) => expandedBatchKeys.includes(batchKey);

  const toggleBatchExpanded = (batchKey: string) => {
    setExpandedBatchKeys(prev => prev.includes(batchKey)
      ? prev.filter(key => key !== batchKey)
      : [...prev, batchKey]);
  };

  const handleBatchAction = (batch: AdminBatch, action: Exclude<AdminAction, "Reject">) => {
    setActionTarget({ type: "batch", batch, action });
  };

  const handleRecordAction = (record: AdminRecord, action: Exclude<AdminAction, "Reject">) => {
    setActionTarget({ type: "record", record, action });
  };

  const submitAction = async () => {
    if (!actionTarget) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/mds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionTarget.type === "batch"
          ? {
            batchId: actionTarget.batch.batchId || undefined,
            recordId: actionTarget.batch.batchId ? undefined : actionTarget.batch.records[0].id,
            action: actionTarget.action,
            comment: "",
          }
          : {
            recordId: actionTarget.record.id,
            action: actionTarget.action,
            comment: "",
          }),
      });
      if (!res.ok) throw new Error("Admin action failed");
      showToast(t.actionSuccess);
      setActionTarget(null);
      fetchRecords();
    } catch {
      showToast(t.actionFailed, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBatchRejectModal = (batch: AdminBatch) => {
    setRejectTarget({ type: "batch", batch });
    setComment("");
    setRejectModalOpen(true);
  };

  const openRecordRejectModal = (record: AdminRecord) => {
    setRejectTarget({ type: "record", record });
    setComment("");
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget || !comment.trim()) return;
    setIsSubmitting(true);

    try {
      const payload = rejectTarget.type === "batch"
        ? {
          batchId: rejectTarget.batch.batchId || undefined,
          recordId: rejectTarget.batch.batchId ? undefined : rejectTarget.batch.records[0].id,
          action: "Reject",
          comment,
        }
        : {
          recordId: rejectTarget.record.id,
          action: "Reject",
          comment,
        };

      const res = await fetch("/api/admin/mds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Reject failed");
      setRejectModalOpen(false);
      showToast(t.rejectSuccess);
      fetchRecords();
    } catch {
      showToast(t.rejectFailed, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 font-sans lg:p-10">
      {toast && (
        <div className={`fixed right-6 top-6 z-[60] flex max-w-[min(92vw,520px)] items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl ${toast.type === "success" ? "bg-slate-950 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          <span className="leading-snug">{toast.msg}</span>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
                <ShieldCheck className="text-blue-600" size={26} />
                {t.title}
              </h1>
              <button
                type="button"
                onClick={toggleLanguage}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                aria-label="Switch language"
              >
                <Languages size={14} />
                {t.languageButton}
              </button>
            </div>
            <p className="mt-1 text-sm leading-6 text-gray-500">{t.subtitle}</p>
          </div>
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="w-full rounded-2xl bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm outline-none ring-1 ring-gray-200 transition-all focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <AdminMetric label={t.total} value={statusCounts.total} tone="slate" />
          <AdminMetric label={t.new} value={statusCounts.new} tone="blue" />
          <AdminMetric label={t.processing} value={statusCounts.processing} tone="amber" />
          <AdminMetric label={t.done} value={statusCounts.done} tone="emerald" />
          <AdminMetric label={t.rejected} value={statusCounts.rejected} tone="red" />
        </div>

        <div className="min-h-[500px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-gray-400">{t.loading}</div>
          ) : loadError ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertCircle size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">{loadError}</p>
                <p className="mt-1 text-xs text-slate-400">{t.loadHint}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchRecords()}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                {t.reload}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-[13px] uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-4 font-semibold">{t.batchMaterial}</th>
                    <th className="px-6 py-4 font-semibold">{t.requestType}</th>
                    <th className="px-6 py-4 font-semibold">{t.submitInfo}</th>
                    <th className="px-6 py-4 font-semibold">{t.currentStatus}</th>
                    <th className="px-6 py-4 text-right font-semibold">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-sm text-gray-400">{t.noMatches}</td>
                    </tr>
                  ) : filtered.map(batch => (
                    <React.Fragment key={batch.key}>
                      <tr className="border-b border-gray-50 transition-colors last:border-none hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                              <Layers size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {batch.batchId ? `Batch ${batch.batchId.slice(0, 8)}` : batch.partNumbers[0]}
                                <span className="ml-2 text-xs font-medium text-gray-400">{batch.records.length} {t.items}</span>
                              </p>
                              <p className="mt-1 text-xs text-gray-500">{t.supplier}: {batch.supplierCode}</p>
                              <p className="mt-1 max-w-xl text-xs leading-relaxed text-gray-400">
                                {batch.partNumbers.slice(0, 6).join(", ")}
                                {batch.partNumbers.length > 6 ? ` ... +${batch.partNumbers.length - 6}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <ActionBadge action={batch.actionType} />
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">{batch.submitterEmail}</p>
                          <p className="mt-1 text-xs text-gray-400">{batch.createdAt}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <StatusBadge status={batch.status} label={t.statusLabel[batch.status]} />
                            {batch.adminComment && batch.status === "Rejected" && (
                              <span className="flex max-w-[260px] items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[11px] text-red-500">
                                <AlertCircle size={10} /> <span className="truncate">{t.rejectPrefix} {batch.adminComment}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="space-x-2 px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => toggleBatchExpanded(batch.key)}
                            className="inline-flex items-center gap-1 rounded-xl bg-gray-50 px-3.5 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                          >
                            <ChevronDown size={13} className={`transition-transform ${isBatchExpanded(batch.key) ? "rotate-180" : ""}`} />
                            {t.singleParts}
                          </button>

                          {batch.status === "New" && (
                            <>
                              <button type="button" onClick={() => openBatchRejectModal(batch)} className="rounded-xl bg-red-50 px-3.5 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100">
                                {t.batchReject}
                              </button>
                              <button type="button" onClick={() => handleBatchAction(batch, "Approve")} className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
                                {t.batchApprove}
                              </button>
                            </>
                          )}

                          {batch.status === "Processing" && (
                            <>
                              <button type="button" onClick={() => openBatchRejectModal(batch)} className="rounded-xl bg-red-50 px-3.5 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100">
                                {t.batchInterrupt}
                              </button>
                              <button type="button" onClick={() => handleBatchAction(batch, "Complete")} className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
                                {t.batchComplete}
                              </button>
                            </>
                          )}

                          {batch.status === "Done" && <span className="pr-2 text-xs italic text-gray-400">{t.archived}</span>}
                          {batch.status === "Rejected" && <span className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-500">{t.rejectedCanResubmit}</span>}
                          {batch.status === "Mixed" && <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-600">{t.mixedStatus}</span>}
                        </td>
                      </tr>

                      {isBatchExpanded(batch.key) && (
                        <tr className="border-b border-gray-100 bg-gray-50/60">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                              <table className="w-full min-w-[820px] text-left">
                                <thead>
                                  <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400">
                                    <th className="px-4 py-3 font-semibold">{t.material}</th>
                                    <th className="px-4 py-3 font-semibold">{t.parma}</th>
                                    <th className="px-4 py-3 font-semibold">{t.type}</th>
                                    <th className="px-4 py-3 font-semibold">{t.status}</th>
                                    <th className="px-4 py-3 font-semibold">{t.comment}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t.recordActions}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batch.records.map(record => (
                                    <tr key={record.id} className="border-b border-gray-50 last:border-none">
                                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{record.partNumber}</td>
                                      <td className="px-4 py-3 text-sm text-gray-600">{record.supplierCode}</td>
                                      <td className="px-4 py-3"><ActionBadge action={record.actionType} /></td>
                                      <td className="px-4 py-3"><StatusBadge status={record.status} label={t.statusLabel[record.status]} /></td>
                                      <td className="px-4 py-3 text-xs text-gray-500">{record.adminComment || t.noComment}</td>
                                      <td className="space-x-2 px-4 py-3 text-right">
                                        {record.status === "New" && (
                                          <>
                                            <button type="button" onClick={() => openRecordRejectModal(record)} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100">
                                              {t.rejectRecord}
                                            </button>
                                            <button type="button" onClick={() => handleRecordAction(record, "Approve")} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700">
                                              {t.approveRecord}
                                            </button>
                                          </>
                                        )}
                                        {record.status === "Processing" && (
                                          <>
                                            <button type="button" onClick={() => openRecordRejectModal(record)} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100">
                                              {t.returnRecord}
                                            </button>
                                            <button type="button" onClick={() => handleRecordAction(record, "Complete")} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700">
                                              {t.completeRecord}
                                            </button>
                                          </>
                                        )}
                                        {record.status === "Done" && <span className="text-xs text-gray-400">{t.recordDone}</span>}
                                        {record.status === "Rejected" && <span className="text-xs text-red-500">{t.recordRejected}</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={() => !isSubmitting && setActionTarget(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-slate-200">
            <button
              type="button"
              onClick={() => setActionTarget(null)}
              disabled={isSubmitting}
              className="absolute right-5 top-5 rounded-full bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            >
              <X size={16} />
            </button>
            <div className="flex gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${actionTarget.action === "Approve" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                {actionTarget.action === "Approve" ? <ShieldCheck size={20} /> : <CheckCircle size={20} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-950">
                  {actionTarget.action === "Approve" ? t.confirmApproveTitle : t.confirmCompleteTitle}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {actionTarget.type === "batch"
                    ? formatText(t.confirmBatchDesc, {
                      count: actionTarget.batch.records.length,
                      status: actionTarget.action === "Approve" ? "Processing" : "Done",
                    })
                    : formatText(t.confirmRecordDesc, {
                      supplier: actionTarget.record.supplierCode,
                      part: actionTarget.record.partNumber,
                      status: actionTarget.action === "Approve" ? "Processing" : "Done",
                    })}
                </p>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionBadge action={actionTarget.type === "batch" ? actionTarget.batch.actionType : actionTarget.record.actionType} />
                    <StatusBadge status={actionTarget.action === "Approve" ? "Processing" : "Done"} label={actionTarget.action === "Approve" ? t.statusLabel.Processing : t.statusLabel.Done} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {actionTarget.type === "batch"
                      ? actionTarget.batch.partNumbers.slice(0, 8).join(", ")
                      : actionTarget.record.partNumber}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                disabled={isSubmitting}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={isSubmitting}
                className={`rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${actionTarget.action === "Approve" ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {isSubmitting ? t.processingAction : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModalOpen && rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => !isSubmitting && setRejectModalOpen(false)} />

          <div className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <button type="button" onClick={() => setRejectModalOpen(false)} className="absolute right-5 top-5 rounded-full bg-gray-50 p-2 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {rejectTarget.type === "batch" ? t.rejectBatchTitle : t.rejectRecordTitle}
                </h3>
                <p className="text-xs text-gray-500">
                  {rejectTarget.type === "batch"
                    ? formatText(t.rejectBatchDesc, { count: rejectTarget.batch.records.length })
                    : formatText(t.rejectRecordDesc, {
                      supplier: rejectTarget.record.supplierCode,
                      part: rejectTarget.record.partNumber,
                    })}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                value={comment}
                onChange={event => setComment(event.target.value)}
                placeholder={t.rejectPlaceholder}
                className="h-32 w-full resize-none rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-red-500"
              />

              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={isSubmitting || !comment.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? t.processingAction : <><Send size={16} /> {rejectTarget.type === "batch" ? t.rejectConfirmBatch : t.rejectConfirmRecord}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, label }: { status: BatchValue<AdminStatus>; label: string }) {
  const map = {
    New: { color: "bg-blue-50 text-blue-600 ring-blue-200", icon: <AlertCircle size={12} /> },
    Processing: { color: "bg-amber-50 text-amber-600 ring-amber-200", icon: <Clock size={12} /> },
    Done: { color: "bg-emerald-50 text-emerald-600 ring-emerald-200", icon: <CheckCircle size={12} /> },
    Rejected: { color: "bg-red-50 text-red-600 ring-red-200", icon: <AlertCircle size={12} /> },
    Mixed: { color: "bg-gray-50 text-gray-600 ring-gray-200", icon: <AlertCircle size={12} /> },
  } as const;
  const config = map[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ring-1 ${config.color}`}>
      {config.icon} {label}
    </span>
  );
}

function ActionBadge({ action }: { action: BatchValue<MDSActionType> }) {
  const map = {
    request: "bg-indigo-50 text-indigo-600 ring-indigo-200",
    cancel: "bg-rose-50 text-rose-600 ring-rose-200",
    Mixed: "bg-slate-50 text-slate-600 ring-slate-200",
  } as const;

  const label = action === "request" ? "Request" : action === "cancel" ? "Cancel" : "Mixed";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${map[action]}`}>
      {label}
    </span>
  );
}

function AdminMetric({ label, value, tone }: { label: string; value: number; tone: "slate" | "blue" | "amber" | "emerald" | "red" }) {
  const toneMap = {
    slate: "border-slate-200 bg-white text-slate-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    red: "border-red-100 bg-red-50 text-red-700",
  } as const;

  return (
    <div className={`rounded-3xl border px-5 py-4 shadow-[0_2px_14px_rgba(15,23,42,0.04)] ${toneMap[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
