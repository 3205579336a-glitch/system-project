"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, XCircle, Search, FileText, Info, AlertTriangle, CheckCircle2, Zap, ChevronRight, Upload, Download, Layers, X, TableProperties } from 'lucide-react';

type RequestStatus = 'New' | 'Processing' | 'Done' | 'Rejected';
type SubmitMode = 'single' | 'bulk';

type MDSRecord = {
    id: string;
    partNumber: string;
    supplierCode: string;
    status: RequestStatus;
    createdAt: string;
};

type BulkRow = {
    partNumber: string;
    supplierCode: string;
    action: 'request' | 'cancel';
    _error?: string;
};

// ─── Tooltip ────────────────────────────────────────────────────────────────
function Tooltip({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    return (
        <div ref={ref} className="relative inline-flex items-center" style={{ verticalAlign: 'middle' }}>
            <button type="button" onClick={() => setOpen(v => !v)}
                className="ml-1.5 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                aria-label="查看规则说明">
                {children}
            </button>
            {open && (
                <div className="absolute z-50 bottom-full left-1/2 mb-2.5 w-72" style={{ transform: 'translateX(-50%)' }}>
                    <div className="bg-gray-950 text-white text-xs rounded-2xl p-4 shadow-2xl leading-relaxed">
                        {content}
                        <div className="absolute top-full left-1/2 border-4 border-transparent"
                            style={{ transform: 'translateX(-50%)', borderTopColor: '#030712' }} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Rule Card ───────────────────────────────────────────────────────────────
function RuleCard({ icon, color, title, desc }: { icon: React.ReactNode; color: string; title: string; desc: string }) {
    return (
        <div className={`flex gap-3 p-3.5 rounded-2xl ${color} border`}>
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div>
                <p className="text-xs font-semibold mb-0.5">{title}</p>
                <p className="text-xs leading-relaxed opacity-80">{desc}</p>
            </div>
        </div>
    );
}

// ─── Bulk Preview Table ───────────────────────────────────────────────────────
function BulkPreviewTable({ rows, onRemove }: { rows: BulkRow[]; onRemove: (i: number) => void }) {
    if (rows.length === 0) return null;
    return (
        <div className="mt-4 rounded-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
                <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <TableProperties size={12} />
                    预览 · {rows.length} 条
                </span>
                <span className="text-[11px] text-gray-400">
                    {rows.filter(r => !r._error).length} 有效 / {rows.filter(r => !!r._error).length} 错误
                </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-gray-50">
                            {['物料号', '供应商', '操作', ''].map((h, i) => (
                                <th key={i} className="px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className={`border-b border-gray-50 last:border-none ${row._error ? 'bg-red-50/50' : ''}`}>
                                <td className="px-4 py-2 text-xs font-medium text-gray-800">
                                    {row.partNumber || <span className="text-red-400 italic">缺失</span>}
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-600">
                                    {row.supplierCode
                                        ? row.supplierCode
                                        : <span className="text-gray-400">—</span>}
                                </td>
                                <td className="px-4 py-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${row.action === 'cancel' ? 'bg-red-50 text-red-500 ring-red-100' : 'bg-blue-50 text-blue-500 ring-blue-100'}`}>
                                        {row.action === 'cancel' ? 'Cancel' : 'Request'}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-right">
                                    {row._error
                                        ? <span className="text-[10px] text-red-400">{row._error}</span>
                                        : <button onClick={() => onRemove(i)} className="text-gray-300 hover:text-red-400 transition-colors"><X size={12} /></button>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MDSTriggerPage() {
    const [activeTab, setActiveTab] = useState<'request' | 'cancel'>('request');
    const [submitMode, setSubmitMode] = useState<SubmitMode>('single');
    const [partNumber, setPartNumber] = useState('');
    const [supplierCode, setSupplierCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [sessionId, setSessionId] = useState<string>('');
    const [historyRecords, setHistoryRecords] = useState<MDSRecord[]>([]);
    const [email, setEmail] = useState('');

    // Bulk state
    const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const PAGE_SIZE = 8;
    const [currentPage, setCurrentPage] = useState(1);




    function showToast(msg: string, type: 'success' | 'error' = 'success') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3200);
    }

    useEffect(() => {
        let sId = localStorage.getItem('mds_session_id');
        if (!sId) {
            sId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
            localStorage.setItem('mds_session_id', sId);
        }
        setSessionId(sId);
        const cachedEmail = localStorage.getItem('mds_user_email');
        if (cachedEmail) setEmail(cachedEmail);

        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/mds-request?sessionId=${sId}`);
                const data = await res.json();
                if (data.success) setHistoryRecords(data.records);
            } catch (err) {
                console.error('加载历史记录失败:', err);
            }
        };
        fetchHistory();
    }, []);

    // ── Single Submit ──────────────────────────────────────────────────────────
    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sessionId || !email) return;
        setLoading(true);
        try {
            const res = await fetch('/api/mds-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partNumber, supplierCode, action: activeTab, sessionId, email }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error('API Request Failed');

            localStorage.setItem('mds_user_email', email);
            const newRecord: MDSRecord = {
                id: Date.now().toString(),
                partNumber,
                supplierCode: supplierCode,
                status: 'New',
                createdAt: new Date().toLocaleString('zh-CN', { hour12: false }).substring(0, 16).replace(/\//g, '-'),
            };
            setHistoryRecords(prev => [newRecord, ...prev]);
            showToast(`${activeTab === 'request' ? 'MDS Request' : 'Cancel 请求'} 已成功提交 — ${partNumber}`);
            setPartNumber('');
            setSupplierCode('');
        } catch {
            showToast('提交失败，请检查网络或后台服务', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── CSV Template Download ──────────────────────────────────────────────────
    const downloadTemplate = () => {
        const csvContent = [
            'partNumber,supplierCode,action',
            '11045236,38532,request',
            '11045237,,cancel',
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'MDS_Bulk_Template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── CSV Parse ─────────────────────────────────────────────────────────────
    const parseCSV = (text: string): BulkRow[] => {
        const lines = text.trim().split('\n').filter(l => l.trim());
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const pnIdx = headers.indexOf('partnumber');
        const scIdx = headers.indexOf('suppliercode');
        const acIdx = headers.indexOf('action');

        return lines.slice(1).map(line => {
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            const pn = pnIdx >= 0 ? cols[pnIdx] ?? '' : '';
            const sc = scIdx >= 0 ? cols[scIdx] ?? '' : '';
            const ac = acIdx >= 0 ? (cols[acIdx] ?? '').toLowerCase() : 'request';
            const action: 'request' | 'cancel' = ac === 'cancel' ? 'cancel' : 'request';
            let _error: string | undefined;
            if (!pn) _error = '物料号缺失';
            else if (action === 'request' && !sc) _error = '供应商代码缺失';
            return { partNumber: pn, supplierCode: sc, action, _error };
        });
    };

    const handleFile = useCallback((file: File) => {
        if (!file.name.endsWith('.csv')) {
            showToast('请上传 .csv 格式文件', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            const text = e.target?.result as string;
            const rows = parseCSV(text);
            setBulkRows(rows);
            if (rows.length === 0) showToast('CSV 文件为空或格式有误', 'error');
        };
        reader.readAsText(file, 'UTF-8');
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    // ── Bulk Submit ───────────────────────────────────────────────────────────
    const handleBulkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sessionId || !email || bulkRows.length === 0) return;
        const validRows = bulkRows.filter(r => !r._error);
        if (validRows.length === 0) {
            showToast('没有有效数据可提交', 'error');
            return;
        }
        setLoading(true);
        try {
            localStorage.setItem('mds_user_email', email);
            let successCount = 0;
            for (const row of validRows) {
                const res = await fetch('/api/mds-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ partNumber: row.partNumber, supplierCode: row.supplierCode, action: row.action, sessionId, email }),
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    successCount++;
                    const newRecord: MDSRecord = {
                        id: `${Date.now()}-${successCount}`,
                        partNumber: row.partNumber,
                        supplierCode: row.action === 'cancel' ? '—' : row.supplierCode,
                        status: 'New',
                        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }).substring(0, 16).replace(/\//g, '-'),
                    };
                    setHistoryRecords(prev => [newRecord, ...prev]);
                }
            }
            showToast(`批量提交完成 — ${successCount}/${validRows.length} 条成功`);
            setBulkRows([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch {
            showToast('批量提交过程中出现错误', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filtered = historyRecords.filter(
        r => r.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.supplierCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const validBulkCount = bulkRows.filter(r => !r._error).length;
    const errorBulkCount = bulkRows.filter(r => !!r._error).length;

    // 原来的 filtered 下面接着加
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);


    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);


    return (
        <div className="min-h-screen bg-[#F4F4F6] font-sans">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-gray-950 text-white' : 'bg-red-600 text-white'}`}
                    style={{ animation: 'fadeSlideIn 0.25s ease' }}>
                    <CheckCircle2 size={16} />
                    {toast.msg}
                </div>
            )}

            <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

            <div className="max-w-[1600px] mx-auto p-6 lg:p-10 flex flex-col gap-7">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">MDS Trigger</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Material Data Sheet 请求管理</p>
                    </div>
                    <span className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
                        SAP Live
                    </span>
                </div>

                {/* ── Top Grid ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left: Form Panel */}
                    <div className="lg:col-span-4 flex flex-col gap-5">
                        <div className="bg-white rounded-3xl p-7 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-gray-100">

                            {/* ── Submit Mode Toggle ── */}
                            <div className="flex bg-gray-100 p-1 rounded-2xl mb-5">
                                {(['single', 'bulk'] as const).map(mode => (
                                    <button key={mode} type="button" onClick={() => { setSubmitMode(mode); setBulkRows([]); }}
                                        className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 ${submitMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                        {mode === 'single' ? <><Send size={13} />单条提交</> : <><Layers size={13} />批量上传</>}
                                    </button>
                                ))}
                            </div>

                            {/* ── Single Mode ── */}
                            {submitMode === 'single' && (
                                <>
                                    {/* Request / Cancel Tab */}
                                    <div className="flex bg-gray-100 p-1 rounded-2xl mb-7">
                                        {(['request', 'cancel'] as const).map(tab => (
                                            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                                                className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                                {tab === 'request' ? 'MDS Request' : 'MDS Cancel'}
                                            </button>
                                        ))}
                                    </div>

                                    <form onSubmit={handleSingleSubmit} className="space-y-5">
                                        <div>
                                            <label className="block text-[13px] font-medium text-gray-500 mb-2 ml-0.5">
                                                你的邮箱 (Email)<span className="text-red-500 ml-0.5">*</span>
                                            </label>
                                            <div className="relative">
                                                <input type="email" required value={email}
                                                    onChange={e => { setEmail(e.target.value); localStorage.setItem('mds_user_email', e.target.value); }}
                                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 ring-1 ring-gray-200 focus:ring-2 focus:ring-black outline-none text-gray-900 text-sm transition-all"
                                                    placeholder="e.g. xxx@volvo.com" />
                                                {email && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"><CheckCircle2 size={16} /></div>}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="flex items-center text-[13px] font-medium text-gray-500 mb-2 ml-0.5">
                                                物料号 (Part Number)<span className="text-red-500 ml-0.5">*</span>
                                                <Tooltip content={activeTab === 'request' ? (
                                                    <div className="space-y-2">
                                                        <p className="font-semibold text-blue-300 flex items-center gap-1.5"><Info size={12} /> Request 前提条件</p>
                                                        <p>触发 MDS Request 前，该物料必须已在 SAP 中存在 <strong>Info Record (IR)</strong>，否则请求将被系统拒绝。</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <p className="font-semibold text-amber-300 flex items-center gap-1.5"><AlertTriangle size={12} /> Cancel 前提条件</p>
                                                        <p>提交 Cancel 前，该物料对应的 <strong>Info Record (IR)</strong> 必须已在 SAP 中被标记为 <strong>Deletion Flag</strong>，否则取消操作无效。</p>
                                                    </div>
                                                )}>
                                                    <Info size={14} />
                                                </Tooltip>
                                            </label>
                                            <input type="text" required value={partNumber} onChange={e => setPartNumber(e.target.value)}
                                                className="w-full px-4 py-3 rounded-2xl bg-gray-50 ring-1 ring-gray-200 focus:ring-2 focus:ring-black outline-none text-gray-900 text-sm transition-all placeholder:text-gray-400"
                                                placeholder="e.g. 11045236" />
                                        </div>


                                        <div>
                                            <label className="block text-[13px] font-medium text-gray-500 mb-2 ml-0.5">
                                                供应商代码 (Supplier Code)<span className="text-red-500 ml-0.5">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={supplierCode}
                                                onChange={e => setSupplierCode(e.target.value)}
                                                className="w-full px-4 py-3 rounded-2xl bg-gray-50 ring-1 ring-gray-200 focus:ring-2 focus:ring-black outline-none text-gray-900 text-sm transition-all placeholder:text-gray-400"
                                                placeholder="e.g. 38532"
                                            />
                                        </div>

                                        <div className="pt-2">
                                            <button type="submit" disabled={loading}
                                                className={`w-full px-6 py-3.5 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${activeTab === 'request' ? 'bg-gray-950 text-white hover:bg-gray-800' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                                                {activeTab === 'request' ? <Send size={15} /> : <XCircle size={15} />}
                                                {loading ? '处理中…' : activeTab === 'request' ? '提交 Request' : '提交 Cancel'}
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}

                            {/* ── Bulk Mode ── */}
                            {submitMode === 'bulk' && (
                                <form onSubmit={handleBulkSubmit} className="space-y-5">
                                    {/* Email */}
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-500 mb-2 ml-0.5">
                                            你的邮箱 (Email)<span className="text-red-500 ml-0.5">*</span>
                                        </label>
                                        <div className="relative">
                                            <input type="email" required value={email}
                                                onChange={e => { setEmail(e.target.value); localStorage.setItem('mds_user_email', e.target.value); }}
                                                className="w-full px-4 py-3 rounded-2xl bg-gray-50 ring-1 ring-gray-200 focus:ring-2 focus:ring-black outline-none text-gray-900 text-sm transition-all"
                                                placeholder="e.g. xxx@volvo.com" />
                                            {email && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"><CheckCircle2 size={16} /></div>}
                                        </div>
                                    </div>

                                    {/* Download Template */}
                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                                        <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                                            <FileText size={16} className="text-blue-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-blue-900">CSV 模板</p>
                                            <p className="text-[11px] text-blue-600 mt-0.5">包含 partNumber / supplierCode / action 列</p>
                                        </div>
                                        <button type="button" onClick={downloadTemplate}
                                            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-white px-3 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors">
                                            <Download size={12} />
                                            下载模板
                                        </button>
                                    </div>

                                    {/* Drag & Drop Zone */}
                                    <div
                                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-6 text-center ${isDragging ? 'border-gray-900 bg-gray-50' : bulkRows.length > 0 ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                                        {bulkRows.length > 0 ? (
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                                                    <CheckCircle2 size={18} className="text-emerald-500" />
                                                </div>
                                                <p className="text-sm font-semibold text-gray-800">文件已解析</p>
                                                <p className="text-xs text-gray-500">
                                                    <span className="text-emerald-600 font-medium">{validBulkCount} 条有效</span>
                                                    {errorBulkCount > 0 && <><span className="mx-1 text-gray-300">·</span><span className="text-red-500 font-medium">{errorBulkCount} 条错误</span></>}
                                                </p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">点击重新上传</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                                    <Upload size={18} className="text-gray-400" />
                                                </div>
                                                <p className="text-sm font-medium text-gray-700">拖拽 CSV 或点击上传</p>
                                                <p className="text-xs text-gray-400">支持 .csv 格式 · UTF-8 编码</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Preview Table */}
                                    <BulkPreviewTable rows={bulkRows} onRemove={i => setBulkRows(prev => prev.filter((_, idx) => idx !== i))} />

                                    {/* Submit Button */}
                                    <div className="pt-2">
                                        <button type="submit" disabled={loading || validBulkCount === 0}
                                            className="w-full px-6 py-3.5 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 bg-gray-950 text-white hover:bg-gray-800">
                                            <Layers size={15} />
                                            {loading ? '批量提交中…' : `批量提交 ${validBulkCount > 0 ? `(${validBulkCount} 条)` : ''}`}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Business Rules Card */}
                        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-gray-100 space-y-3">
                            <p className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider mb-1">触发规则</p>
                            <RuleCard icon={<Info size={15} className="text-blue-500" />} color="bg-blue-50 border-blue-100 text-blue-900"
                                title="Request — 需要 Info Record" desc="触发前，物料必须在 SAP 中存在有效的 Info Record (IR)，否则系统将拒绝该请求。" />
                            <RuleCard icon={<AlertTriangle size={15} className="text-amber-500" />} color="bg-amber-50 border-amber-100 text-amber-900"
                                title="Cancel — IR 须标记 Deletion Flag" desc="提交取消时，对应的 Info Record 必须已在 SAP 中设置为 Deletion Flag，才可执行取消。" />
                            <RuleCard icon={<Zap size={15} className="text-emerald-500" />} color="bg-emerald-50 border-emerald-100 text-emerald-900"
                                title="自动发送" desc="Info Record 成功建立后，MDS 邮件将自动触发发送至供应商，无需手动操作。" />
                        </div>
                    </div>

                    {/* Right: Records Table */}
                    <div className="lg:col-span-8 bg-white rounded-3xl p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-gray-100 flex flex-col h-fit">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                <FileText size={18} className="text-gray-400" />
                                我的 MDS 请求记录
                                <span className="ml-1 text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{historyRecords.length}</span>
                            </h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="搜索物料号或供应商…"
                                    className="pl-9 pr-4 py-2 bg-gray-50 rounded-full text-sm ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-black transition-all w-52 placeholder:text-gray-400" />
                            </div>
                        </div>

                        <div className="overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        {['物料号', '供应商', '触发时间', '状态'].map((h, i) => (
                                            <th key={h} className={`pb-3 text-[12px] font-semibold text-gray-400 uppercase tracking-wider ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.length === 0 ? ( // 2. 修改这里：使用 paginated 判断和渲染
                                        <tr><td colSpan={4} className="text-center py-14 text-gray-400 text-sm">暂无匹配记录</td></tr>
                                    ) : paginated.map(record => ( // 修改这里：改为 paginated.map
                                        <tr key={record.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50/70 transition-colors group">
                                            <td className="py-4 font-semibold text-gray-900 text-sm">{record.partNumber}</td>
                                            <td className="py-4 text-gray-600 text-sm">{record.supplierCode || '—'}</td>
                                            <td className="py-4 text-gray-400 text-xs tabular-nums">{record.createdAt}</td>
                                            <td className="py-4 text-right"><StatusBadge status={record.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filtered.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                                <span className="text-[12px] text-gray-400 font-medium">
                                    共 {filtered.length} 条记录 · 第 {currentPage} / {totalPages} 页
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-[12px] font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                                    >
                                        上一页
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-[12px] font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                                    >
                                        下一页
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Workflow hint strip */}
                        <div className="mt-6 pt-5 border-t border-gray-50">
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium flex-wrap">
                                {[
                                    { label: 'IR 创建', cls: 'bg-gray-50 border-gray-100' },
                                    null,
                                    { label: 'MDS Request', cls: 'bg-blue-50 text-blue-500 border-blue-100' },
                                    null,
                                    { label: 'Processing', cls: 'bg-gray-50 border-gray-100' },
                                    null,
                                    { label: 'Done — 自动发送', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                ].map((item, i) => item === null
                                    ? <ChevronRight key={i} size={12} className="text-gray-300 shrink-0" />
                                    : <span key={i} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border ${item.cls}`}>{item.label}</span>
                                )}
                                <span className="ml-2 text-gray-300">|</span>
                                <span className="flex items-center gap-1 text-gray-400 px-2.5 py-1.5">IR Deletion Flag →</span>
                                <span className="flex items-center gap-1 bg-red-50 text-red-500 px-2.5 py-1.5 rounded-lg border border-red-100">Cancel</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Bottom: Power BI Dashboard ── */}
                <div className="bg-white rounded-3xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden" style={{ minHeight: 700 }}>
                    <div className="px-7 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-base font-semibold text-gray-900">Global MDS Dashboard</h2>
                        <span className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
                            Live Data (SAP)
                        </span>
                    </div>
                    <div className="relative" style={{ height: 660 }}>
                        <iframe title="Global MDS Power BI" className="absolute inset-0 w-full h-full border-none"
                            src="https://app.powerbi.com/reportEmbed?reportId=8bd98c42-d590-42d9-baff-b9a24ef143d8&autoAuth=true&ctid=f25493ae-1c98-41d7-8a33-0be75f5fe603"
                            allowFullScreen />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: RequestStatus }) {
    const map = {
        New: 'bg-blue-50 text-blue-600 ring-blue-100',
        Processing: 'bg-amber-50 text-amber-600 ring-amber-100',
        Done: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
        Rejected: 'bg-red-50 text-red-600 ring-red-100',
    } as const;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${map[status]}`}>
            {status}
        </span>
    );
}