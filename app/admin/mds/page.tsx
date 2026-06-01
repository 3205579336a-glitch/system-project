"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Search, X, MessageSquare, Send, CheckCircle, Clock, AlertCircle, Layers, ChevronDown } from 'lucide-react';

type AdminStatus = 'New' | 'Processing' | 'Done' | 'Rejected';
type MDSActionType = 'request' | 'cancel';

type AdminRecord = {
  id: string;
  partNumber: string;
  supplierCode: string;
  actionType: MDSActionType;
  status: AdminStatus;
  submitterEmail: string;
  adminComment?: string;
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
  actionType: MDSActionType | 'Mixed';
  status: AdminStatus | 'Mixed';
  submitterEmail: string;
  adminComment?: string;
  createdAt: string;
};

type AdminListResponse = {
  success?: boolean;
  records?: AdminRecord[];
};

type AdminAction = 'Approve' | 'Complete' | 'Reject';

type RejectTarget =
  | { type: 'batch'; batch: AdminBatch }
  | { type: 'record'; record: AdminRecord };

type ActionTarget =
  | { type: 'batch'; batch: AdminBatch; action: Exclude<AdminAction, 'Reject'> }
  | { type: 'record'; record: AdminRecord; action: Exclude<AdminAction, 'Reject'> };

const getBatchStatus = (records: AdminRecord[]): AdminBatch['status'] => {
  const first = records[0]?.status;
  return records.every(record => record.status === first) ? first : 'Mixed';
};

export default function AdminDashboard() {
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [expandedBatchKeys, setExpandedBatchKeys] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/admin/mds', { signal: controller.signal });
      const data = (await res.json()) as AdminListResponse;
      if (data.success && Array.isArray(data.records)) {
        setRecords(data.records);
      } else {
        setLoadError('数据加载失败，请稍后重试。');
      }
    } catch {
      setLoadError('数据加载超时，请检查网络或 Supabase 连接。');
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
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
        const actionType: AdminBatch['actionType'] = actionTypes.length === 1 ? actionTypes[0] : 'Mixed';
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
      (batch.batchId || '').toLowerCase().includes(query)
    );
  });

  const statusCounts = {
    total: records.length,
    new: records.filter(record => record.status === 'New').length,
    processing: records.filter(record => record.status === 'Processing').length,
    done: records.filter(record => record.status === 'Done').length,
    rejected: records.filter(record => record.status === 'Rejected').length,
  };

  const isBatchExpanded = (batchKey: string) => expandedBatchKeys.includes(batchKey);

  const toggleBatchExpanded = (batchKey: string) => {
    setExpandedBatchKeys(prev =>
      prev.includes(batchKey)
        ? prev.filter(key => key !== batchKey)
        : [...prev, batchKey]
    );
  };

  const handleBatchAction = async (batch: AdminBatch, action: Exclude<AdminAction, 'Reject'>) => {
    setActionTarget({ type: 'batch', batch, action });
  };

  const handleRecordAction = async (record: AdminRecord, action: Exclude<AdminAction, 'Reject'>) => {
    setActionTarget({ type: 'record', record, action });
  };

  const submitAction = async () => {
    if (!actionTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/mds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionTarget.type === 'batch'
          ? {
            batchId: actionTarget.batch.batchId || undefined,
            recordId: actionTarget.batch.batchId ? undefined : actionTarget.batch.records[0].id,
            action: actionTarget.action,
            comment: '',
          }
          : {
            recordId: actionTarget.record.id,
            action: actionTarget.action,
            comment: '',
          }),
      });
      if (!res.ok) throw new Error('Admin action failed');
      showToast('操作成功，状态已更新');
      setActionTarget(null);
      fetchRecords();
    } catch {
      showToast('操作失败，请稍后重试', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBatchRejectModal = (batch: AdminBatch) => {
    setRejectTarget({ type: 'batch', batch });
    setComment('');
    setRejectModalOpen(true);
  };

  const openRecordRejectModal = (record: AdminRecord) => {
    setRejectTarget({ type: 'record', record });
    setComment('');
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget || !comment.trim()) return;
    setIsSubmitting(true);

    try {
      const payload = rejectTarget.type === 'batch'
        ? {
          batchId: rejectTarget.batch.batchId || undefined,
          recordId: rejectTarget.batch.batchId ? undefined : rejectTarget.batch.records[0].id,
          action: 'Reject',
          comment,
        }
        : {
          recordId: rejectTarget.record.id,
          action: 'Reject',
          comment,
        };

      const res = await fetch('/api/admin/mds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Reject failed');
      setRejectModalOpen(false);
      showToast('已退回并记录批注');
      fetchRecords();
    } catch {
      showToast('退回操作失败，请稍后重试', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 lg:p-10 font-sans">
      {toast && (
        <div className={`fixed right-6 top-6 z-[60] flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl ${toast.type === 'success' ? 'bg-slate-950 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
      <div className="max-w-[1400px] mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={26} />
              MDS Admin 审批中心
            </h1>
            <p className="text-sm text-gray-500 mt-1">按批次管理 MDS 流转，整批推送至 Global</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="搜索批次、物料、供应商或邮箱..."
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="pl-9 pr-4 py-2.5 w-80 bg-white rounded-2xl text-sm ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <AdminMetric label="Total" value={statusCounts.total} tone="slate" />
          <AdminMetric label="New" value={statusCounts.new} tone="blue" />
          <AdminMetric label="Processing" value={statusCounts.processing} tone="amber" />
          <AdminMetric label="Done" value={statusCounts.done} tone="emerald" />
          <AdminMetric label="Rejected" value={statusCounts.rejected} tone="red" />
        </div>

        <div className="bg-white rounded-3xl shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-200 overflow-hidden min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">加载数据中...</div>
          ) : loadError ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertCircle size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">{loadError}</p>
                <p className="mt-1 text-xs text-slate-400">不会影响已保存的数据，只是当前列表没有成功拉取。</p>
              </div>
              <button
                onClick={fetchRecords}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                重新加载
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-[13px] text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold">批次 / 物料</th>
                  <th className="py-4 px-6 font-semibold">请求类型</th>
                  <th className="py-4 px-6 font-semibold">提交信息</th>
                  <th className="py-4 px-6 font-semibold">当前状态</th>
                  <th className="py-4 px-6 font-semibold text-right">管理操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-sm text-gray-400">暂无匹配批次</td>
                  </tr>
                ) : filtered.map(batch => (
                  <React.Fragment key={batch.key}>
                    <tr className="border-b border-gray-50 last:border-none hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Layers size={16} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {batch.batchId ? `Batch ${batch.batchId.slice(0, 8)}` : batch.partNumbers[0]}
                              <span className="ml-2 text-xs font-medium text-gray-400">{batch.records.length} 条</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Supplier: {batch.supplierCode}</p>
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xl">
                              {batch.partNumbers.slice(0, 6).join(', ')}
                              {batch.partNumbers.length > 6 ? ` ... +${batch.partNumbers.length - 6}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <ActionBadge action={batch.actionType} />
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-gray-600 text-sm">{batch.submitterEmail}</p>
                        <p className="text-xs text-gray-400 mt-1">{batch.createdAt}</p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusBadge status={batch.status} />
                        {batch.adminComment && batch.status === 'Rejected' && (
                            <span className="text-[11px] text-red-500 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1">
                              <AlertCircle size={10} /> 退回: {batch.adminComment}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button onClick={() => toggleBatchExpanded(batch.key)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 px-3.5 py-2 rounded-xl transition-colors">
                          <ChevronDown size={13} className={`transition-transform ${isBatchExpanded(batch.key) ? 'rotate-180' : ''}`} />
                          单个零件
                        </button>

                        {batch.status === 'New' && (
                          <>
                            <button onClick={() => openBatchRejectModal(batch)} className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition-colors">
                              整批退回
                            </button>
                            <button onClick={() => handleBatchAction(batch, 'Approve')} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-xl transition-colors shadow-sm">
                              整批审批通过
                            </button>
                          </>
                        )}

                        {batch.status === 'Processing' && (
                          <>
                            <button onClick={() => openBatchRejectModal(batch)} className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition-colors">
                              整批中断退回
                            </button>
                            <button onClick={() => handleBatchAction(batch, 'Complete')} className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl transition-colors shadow-sm">
                              整批标记完成
                            </button>
                          </>
                        )}

                        {batch.status === 'Done' && (
                          <span className="text-xs text-gray-400 italic pr-2">归档完毕</span>
                        )}

                        {batch.status === 'Rejected' && (
                          <span className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">已退回，可重新提交</span>
                        )}

                        {batch.status === 'Mixed' && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">批次状态不一致</span>
                        )}
                      </td>
                    </tr>
                    {isBatchExpanded(batch.key) && (
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                                  <th className="px-4 py-3 font-semibold">Material</th>
                                  <th className="px-4 py-3 font-semibold">PARMA</th>
                                  <th className="px-4 py-3 font-semibold">类型</th>
                                  <th className="px-4 py-3 font-semibold">状态</th>
                                  <th className="px-4 py-3 font-semibold">批注</th>
                                  <th className="px-4 py-3 font-semibold text-right">单个操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                {batch.records.map(record => (
                                  <tr key={record.id} className="border-b border-gray-50 last:border-none">
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{record.partNumber}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{record.supplierCode}</td>
                                    <td className="px-4 py-3"><ActionBadge action={record.actionType} /></td>
                                    <td className="px-4 py-3"><StatusBadge status={record.status} /></td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{record.adminComment || '—'}</td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                      {record.status === 'New' && (
                                        <>
                                          <button onClick={() => openRecordRejectModal(record)} className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors">
                                            拒绝此零件
                                          </button>
                                          <button onClick={() => handleRecordAction(record, 'Approve')} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-xl transition-colors">
                                            通过此零件
                                          </button>
                                        </>
                                      )}
                                      {record.status === 'Processing' && (
                                        <>
                                          <button onClick={() => openRecordRejectModal(record)} className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors">
                                            退回此零件
                                          </button>
                                          <button onClick={() => handleRecordAction(record, 'Complete')} className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl transition-colors">
                                            完成此零件
                                          </button>
                                        </>
                                      )}
                                      {record.status === 'Done' && <span className="text-xs text-gray-400">已完成</span>}
                                      {record.status === 'Rejected' && <span className="text-xs text-red-500">已退回</span>}
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
          )}
        </div>
      </div>

      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={() => !isSubmitting && setActionTarget(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-slate-200">
            <button
              onClick={() => setActionTarget(null)}
              disabled={isSubmitting}
              className="absolute right-5 top-5 rounded-full bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            >
              <X size={16} />
            </button>
            <div className="flex gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${actionTarget.action === 'Approve' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {actionTarget.action === 'Approve' ? <ShieldCheck size={20} /> : <CheckCircle size={20} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-950">
                  {actionTarget.action === 'Approve' ? '确认审批通过' : '确认标记完成'}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {actionTarget.type === 'batch'
                    ? `将 ${actionTarget.batch.records.length} 条记录更新为 ${actionTarget.action === 'Approve' ? 'Processing' : 'Done'}，并触发后续通知。`
                    : `将 ${actionTarget.record.supplierCode} / ${actionTarget.record.partNumber} 更新为 ${actionTarget.action === 'Approve' ? 'Processing' : 'Done'}。`}
                </p>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionBadge action={actionTarget.type === 'batch' ? actionTarget.batch.actionType : actionTarget.record.actionType} />
                    <StatusBadge status={actionTarget.action === 'Approve' ? 'Processing' : 'Done'} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {actionTarget.type === 'batch'
                      ? actionTarget.batch.partNumbers.slice(0, 8).join(', ')
                      : actionTarget.record.partNumber}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <button
                onClick={() => setActionTarget(null)}
                disabled={isSubmitting}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={submitAction}
                disabled={isSubmitting}
                className={`rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${actionTarget.action === 'Approve' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {isSubmitting ? '处理中...' : '确认执行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModalOpen && rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => !isSubmitting && setRejectModalOpen(false)}></div>

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setRejectModalOpen(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 bg-gray-50 p-2 rounded-full">
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {rejectTarget.type === 'batch' ? '填写整批退回批注' : '填写单个零件退回批注'}
                </h3>
                <p className="text-xs text-gray-500">
                  {rejectTarget.type === 'batch'
                    ? `将 ${rejectTarget.batch.records.length} 条记录退回并发一次通知`
                    : `将 ${rejectTarget.record.supplierCode} / ${rejectTarget.record.partNumber} 退回并发一次通知`}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                value={comment}
                onChange={event => setComment(event.target.value)}
                placeholder="请输入拒绝原因 (例如：SAP 数据异常，请重新核对...)"
                className="w-full h-32 px-4 py-3 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-200 focus:ring-2 focus:ring-red-500 outline-none resize-none text-sm text-gray-900"
              ></textarea>

              <button
                onClick={handleRejectSubmit}
                disabled={isSubmitting || !comment.trim()}
                className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-medium py-3.5 rounded-2xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '处理中...' : <><Send size={16} /> {rejectTarget.type === 'batch' ? '确认整批退回' : '确认退回此零件'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminBatch['status'] }) {
  const map = {
    New: { color: 'bg-blue-50 text-blue-600 ring-blue-200', icon: <AlertCircle size={12} /> },
    Processing: { color: 'bg-amber-50 text-amber-600 ring-amber-200', icon: <Clock size={12} /> },
    Done: { color: 'bg-emerald-50 text-emerald-600 ring-emerald-200', icon: <CheckCircle size={12} /> },
    Rejected: { color: 'bg-red-50 text-red-600 ring-red-200', icon: <AlertCircle size={12} /> },
    Mixed: { color: 'bg-gray-50 text-gray-600 ring-gray-200', icon: <AlertCircle size={12} /> },
  };
  const config = map[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 shadow-sm ${config.color}`}>
      {config.icon} {status}
    </span>
  );
}

function ActionBadge({ action }: { action: MDSActionType | 'Mixed' }) {
  const map = {
    request: 'bg-indigo-50 text-indigo-600 ring-indigo-200',
    cancel: 'bg-rose-50 text-rose-600 ring-rose-200',
    Mixed: 'bg-slate-50 text-slate-600 ring-slate-200',
  } as const;

  const label = action === 'request' ? 'Request' : action === 'cancel' ? 'Cancel' : 'Mixed';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${map[action]}`}>
      {label}
    </span>
  );
}

function AdminMetric({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'blue' | 'amber' | 'emerald' | 'red' }) {
  const toneMap = {
    slate: 'border-slate-200 bg-white text-slate-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    red: 'border-red-100 bg-red-50 text-red-700',
  } as const;

  return (
    <div className={`rounded-3xl border px-5 py-4 shadow-[0_2px_14px_rgba(15,23,42,0.04)] ${toneMap[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
