'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import Link from 'next/link'; // 🌟 确保引入了 Next.js 的 Link 组件
import {
    Search, Wrench, MessageSquare, AlertCircle, Phone,
    Tag, Layers, ServerCrash, ChevronDown, ChevronUp, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import ExcelUploader from '../components/ExcelUploader';

const SYSTEMS = ['All', 'ODC', 'Windchill', 'CDW', 'VIVA', 'Config'];
const ITEMS_PER_PAGE = 10;


// 搜索词高亮组件
const Highlight = ({ text, query }: { text: string | undefined | null, query: string }) => {
    if (!text) return null;
    if (!query.trim()) return <>{text}</>;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded shadow-sm font-semibold">
                        {part}
                    </mark>
                ) : (
                    <Fragment key={i}>{part}</Fragment>
                )
            )}
        </>
    );
};

// 🌟 核心功能：智能提取 T-code 并将其转换为超链接
const SolutionFormatter = ({ text, query }: { text: string | undefined | null, query: string }) => {
    if (!text) return null;

    // 正则：匹配 "T-code: xxx" 或者 "code: xxx" 这种格式 (忽略大小写)
    // 捕获组1: 前缀 (t-code, code)
    // 捕获组2: 分隔符 (冒号、空格、中文破折号等)
    // 捕获组3: 真实的 T-code 字母和数字组合
    const regex = /(t[- ]?code|code|tcode)([^a-zA-Z0-9\n]+)([a-zA-Z0-9/]{2,15})/gi;
    const elements = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];
        const prefix = match[1];
        const separator = match[2];
        const tcode = match[3];
        const index = match.index;

        // 添加匹配内容之前的普通文本
        if (index > lastIndex) {
            elements.push(<Highlight key={`text-${lastIndex}`} text={text.slice(lastIndex, index)} query={query} />);
        }

        // 渲染转换为链接的 T-code
        elements.push(
            <span key={`match-${index}`}>
                <Highlight text={prefix + separator} query={query} />
                <Link
                    href={`/t-codes?q=${tcode}`}
                    target="_blank" // 新窗口打开，不中断当前排查流程
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-1 rounded underline decoration-blue-300 underline-offset-2 font-bold transition-colors"
                    onClick={(e) => e.stopPropagation()} // 🌟 阻止冒泡，防止点击链接时卡片被折叠
                >
                    <Highlight text={tcode} query={query} />
                </Link>
            </span>
        );

        lastIndex = index + fullMatch.length;
    }

    // 添加剩余的文本
    if (lastIndex < text.length) {
        elements.push(<Highlight key={`text-${lastIndex}`} text={text.slice(lastIndex)} query={query} />);
    }

    return <>{elements}</>;
};

export default function SystemCasesTracker() {
    const [cases, setCases] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeSystem, setActiveSystem] = useState('All');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);

    // 🌟 设定缓存的 Key 和有效期 (这里设为 24 小时，你可以自己改)
    const CACHE_KEY = 'volvo_system_cases_cache';
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 10000; // 24小时的毫秒数

    // 🌟 增加 forceRefresh 参数，默认为 false
    const fetchCases = async (forceRefresh = false) => {
        setIsLoading(true);
        try {
            // 1. 如果不是强制刷新，先检查浏览器本地缓存
            if (!forceRefresh) {
                const cachedData = localStorage.getItem(CACHE_KEY);
                if (cachedData) {
                    const { data, timestamp } = JSON.parse(cachedData);
                    // 判断缓存是否在有效期内
                    if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
                        setCases(data);
                        setIsLoading(false);
                        console.log('⚡ 命中本地缓存，秒开加载！');
                        return; // 命中缓存，直接结束，不查数据库
                    }
                }
            }

            // 2. 如果没有缓存、缓存过期、或管理员强制刷新，则真正查询数据库
            console.log('📡 缓存失效或强制刷新，正在请求数据库...');
            const res = await fetch('/api/system-cases');
            const result = await res.json();

            if (result.success) {
                setCases(result.data);
                // 3. 将最新查到的数据存入浏览器本地，并打上时间戳
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: result.data,
                    timestamp: Date.now()
                }));
            }
        } catch (error) {
            console.error('获取数据库数据失败:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCases();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
        setExpandedId(null);
    }, [searchTerm, activeSystem]);

    const filteredCases = useMemo(() => {
        return cases.filter((c) => {
            const matchSystem = activeSystem === 'All' || c.system === activeSystem;
            const searchContent = `${c.title} ${c.error_msg} ${c.solution} ${c.category}`.toLowerCase();
            return matchSystem && searchContent.includes(searchTerm.toLowerCase());
        });
    }, [cases, searchTerm, activeSystem]);

    const totalPages = Math.ceil(filteredCases.length / ITEMS_PER_PAGE);
    const paginatedCases = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredCases.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredCases, currentPage]);

    const toggleExpand = (id: string) => {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="max-w-4xl mx-auto pb-12 px-4 pt-8">

            {/* 管理员数据导入区 */}
            <div className="mb-10 pb-8 border-b border-slate-200/60">
                {/* 传入参数 true，代表上传成功后，强制忽略缓存，重新向数据库拉取最新数据 */}
                {/* <ExcelUploader onUploadSuccess={() => fetchCases(true)} /> */}
            </div>

            {/* 头部与搜索框 */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">系统Case记录</h1>
                <p className="text-gray-500 text-sm mb-6">点击卡片查看详细报错现象及解决方案。</p>

                <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all flex items-center">
                    <div className="pl-4">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="搜索关键字、报错代码或 T-code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-3 pr-4 py-4 bg-transparent border-none focus:ring-0 text-sm font-medium outline-none text-slate-700"
                    />
                </div>
            </div>

            {/* 系统切换标签 */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {SYSTEMS.map(sys => (
                    <button
                        key={sys}
                        onClick={() => setActiveSystem(sys)}
                        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeSystem === sys
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                    >
                        {sys === 'All' ? '全部' : sys}
                    </button>
                ))}
            </div>

            {/* 列表展示区 */}
            <div className="space-y-3 min-h-[400px] relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <p className="text-sm font-medium">正在拉取数据库记录...</p>
                    </div>
                ) : paginatedCases.length > 0 ? (
                    paginatedCases.map((issue) => {
                        const isExpanded = expandedId === issue.id;
                        const supportEmail = "louis.xin@volvo.com";
                        const emailSubject = encodeURIComponent(`[System Support] ${issue.system} - ${issue.case_id}: ${issue.title}`);
                        const emailBody = encodeURIComponent(
                            `Hello Support Team,\n\n我在使用系统排查库时遇到了以下相关问题：\n\n` +
                            `【Case ID】: ${issue.case_id}\n` +
                            `【所属系统】: ${issue.system}\n` +
                            `【问题标题】: ${issue.title}\n` +
                            `--------------------------------------\n`
                        );
                        const mailtoUrl = `mailto:${supportEmail}?subject=${emailSubject}&body=${emailBody}`;

                        return (
                            <div
                                key={issue.id}
                                className={`bg-white border rounded-2xl transition-all duration-200 hover:shadow-md ${isExpanded ? 'border-blue-200 ring-4 ring-blue-50/50' : 'border-slate-100'
                                    }`}
                            >
                                <div
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 rounded-t-2xl transition-colors"
                                    onClick={() => toggleExpand(issue.id)}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${issue.request_type?.includes('issue') ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                                            }`}>
                                            {issue.request_type?.includes('issue') ? <ServerCrash size={20} /> : <Layers size={20} />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{issue.system}</span>
                                                <span className="text-slate-300">/</span>
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    <Highlight text={issue.category} query={searchTerm} />
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-slate-900 truncate">
                                                <Highlight text={issue.title} query={searchTerm} />
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 ml-4 text-slate-400">
                                        {/* 🌟 小红点已被删除 */}
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </div>

                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                                    }`}>
                                    <div className="px-4 pb-5 pt-2 space-y-4 cursor-auto select-text">

                                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-tight">
                                                <AlertCircle size={14} /> 业务现象 / 报错
                                            </div>
                                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                                <Highlight text={issue.error_msg} query={searchTerm} />
                                            </p>
                                        </div>

                                        <div className="bg-blue-50/30 rounded-xl p-3.5 border border-blue-100/50">
                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-blue-600 uppercase tracking-tight">
                                                <Wrench size={14} /> 标准解决方案
                                            </div>
                                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                                {/* 🌟 智能 T-code 连接器替代了普通的 Highlight */}
                                                <SolutionFormatter text={issue.solution} query={searchTerm} />
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-50">
                                            <div className="flex items-center gap-4">
                                                <span className="text-[11px] text-slate-400 font-medium">处理层级: <span className="text-slate-600">{issue.classification}</span></span>
                                                <span className="text-[11px] text-slate-400 font-medium">接口人: <span className="text-blue-600 font-bold">System Key User</span></span>
                                            </div>
                                            <div className="flex gap-2">
                                                <a href={mailtoUrl} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                                                    <MessageSquare size={14} /> 邮件联系
                                                </a>
                                                {issue.classification?.includes('L2') && (
                                                    <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5">
                                                        <Phone size={14} /> 升级 L2 IT
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 mt-4">
                        <Search className="mx-auto text-slate-300 mb-3" size={32} />
                        <p className="text-slate-500 font-medium text-sm">未找到相关排查记录</p>
                    </div>
                )}
            </div>

            {/* 分页控制器 */}
            {!isLoading && totalPages > 1 && (
                <div className="mt-8 bg-white px-6 py-4 flex items-center justify-between border border-slate-200 rounded-2xl shadow-sm">
                    <div className="hidden sm:block">
                        <p className="text-sm text-slate-500 font-medium">
                            显示第 <span className="font-bold text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> 到{' '}
                            <span className="font-bold text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredCases.length)}</span> 条，
                            共 <span className="font-bold text-slate-900">{filteredCases.length}</span> 条结果
                        </p>
                    </div>

                    <div className="flex-1 flex justify-between sm:justify-end items-center gap-3">
                        <button
                            onClick={() => {
                                setCurrentPage(p => Math.max(1, p - 1));
                                setExpandedId(null);
                            }}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" /> 上一页
                        </button>

                        <span className="text-sm font-bold text-slate-700 sm:hidden">
                            {currentPage} / {totalPages}
                        </span>

                        <button
                            onClick={() => {
                                setCurrentPage(p => Math.min(totalPages, p + 1));
                                setExpandedId(null);
                            }}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            下一页 <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}