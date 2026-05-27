"use client";

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, X, MessageSquare, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react';

type AdminRecord = {
  id: string;
  partNumber: string;
  supplierCode: string;
  status: 'New' | 'Processing' | 'Done';
  submitterEmail: string;
  adminComment?: string;
  createdAt: string;
};

export default function AdminDashboard() {
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // 弹窗状态
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AdminRecord | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 初始化拉取数据
  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/admin/mds');
      const data = await res.json();
      if (data.success) setRecords(data.records);
    } catch (err) {
      console.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  // 处理直接状态流转 (Approve / Complete)
  const handleDirectAction = async (record: AdminRecord, action: 'Approve' | 'Complete') => {
    if (!confirm(`确认要将物料 ${record.partNumber} 标记为 ${action} 吗？`)) return;
    
    try {
      const res = await fetch('/api/admin/mds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: record.id,
          partNumber: record.partNumber,
          supplierCode: record.supplierCode,
          submitterEmail: record.submitterEmail,
          action: action,
          comment: '' // Approve 和 Complete 不需要 Comment
        })
      });
      if (res.ok) {
        alert('操作成功！');
        fetchRecords(); // 刷新列表
      }
    } catch (err) {
      alert('操作失败');
    }
  };

  // 打开拒绝弹窗
  const openRejectModal = (record: AdminRecord) => {
    setSelectedRecord(record);
    setComment('');
    setRejectModalOpen(true);
  };

  // 提交拒绝
  const handleRejectSubmit = async () => {
    if (!selectedRecord || !comment.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/mds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: selectedRecord.id,
          partNumber: selectedRecord.partNumber,
          submitterEmail: selectedRecord.submitterEmail,
          supplierCode: selectedRecord.supplierCode,
          action: 'Reject',
          comment: comment
        })
      });
      if (res.ok) {
        setRejectModalOpen(false);
        fetchRecords(); // 刷新后，该记录将变回 'New'，且带有 Comment
      }
    } catch (err) {
      alert('拒绝操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = records.filter(r => 
    r.partNumber.includes(searchQuery) || r.submitterEmail.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 lg:p-10 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={26} />
              MDS Admin 审批中心
            </h1>
            <p className="text-sm text-gray-500 mt-1">全局物料状态管理与控制台</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="搜索物料号或邮箱..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2.5 w-72 bg-white rounded-2xl text-sm ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-3xl shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">加载数据中...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-[13px] text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold">物料信息</th>
                  <th className="py-4 px-6 font-semibold">提交人邮箱</th>
                  <th className="py-4 px-6 font-semibold">当前状态</th>
                  <th className="py-4 px-6 font-semibold text-right">管理操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(record => (
                  <tr key={record.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-semibold text-gray-900">{record.partNumber}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Supplier: {record.supplierCode}</p>
                    </td>
                    <td className="py-4 px-6 text-gray-600 text-sm">{record.submitterEmail}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge status={record.status} />
                        {record.adminComment && record.status === 'New' && (
                          <span className="text-[11px] text-red-500 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertCircle size={10} /> 退回: {record.adminComment}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      {/* 工作流控制按钮组 */}
                      {record.status === 'New' && (
                        <>
                          <button onClick={() => openRejectModal(record)} className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition-colors">
                            退回 (Reject)
                          </button>
                          <button onClick={() => handleDirectAction(record, 'Approve')} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-xl transition-colors shadow-sm">
                            审批通过 (Approve)
                          </button>
                        </>
                      )}
                      
                      {record.status === 'Processing' && (
                        <>
                          <button onClick={() => openRejectModal(record)} className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition-colors">
                            中断退回
                          </button>
                          <button onClick={() => handleDirectAction(record, 'Complete')} className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl transition-colors shadow-sm">
                            标记完成 (Done)
                          </button>
                        </>
                      )}

                      {record.status === 'Done' && (
                        <span className="text-xs text-gray-400 italic pr-2">归档完毕</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reject 弹窗 */}
      {rejectModalOpen && selectedRecord && (
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
                <h3 className="text-lg font-semibold text-gray-900">填写退回批注</h3>
                <p className="text-xs text-gray-500">将退回至初始状态并发邮件通知</p>
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="请输入拒绝原因 (例如：SAP 数据异常，请重新核对...)"
                className="w-full h-32 px-4 py-3 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-200 focus:ring-2 focus:ring-red-500 outline-none resize-none text-sm text-gray-900"
              ></textarea>

              <button
                onClick={handleRejectSubmit}
                disabled={isSubmitting || !comment.trim()}
                className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-medium py-3.5 rounded-2xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '处理中...' : <><Send size={16} /> 确认退回</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminRecord['status'] }) {
  const map = {
    New: { color: 'bg-blue-50 text-blue-600 ring-blue-200', icon: <AlertCircle size={12}/> },
    Processing: { color: 'bg-amber-50 text-amber-600 ring-amber-200', icon: <Clock size={12}/> },
    Done: { color: 'bg-emerald-50 text-emerald-600 ring-emerald-200', icon: <CheckCircle size={12}/> },
  };
  const config = map[status];
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 shadow-sm ${config.color}`}>
      {config.icon} {status}
    </span>
  );
}