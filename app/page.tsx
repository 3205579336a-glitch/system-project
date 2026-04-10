'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { Search, ExternalLink, Play, Clock, ArrowRight, Star, Activity, BookOpen } from 'lucide-react';

export default function WorkspaceHome() {
  // 🌟 优化 3：动态问候语、Emoji与卡片主题色
  const [timeConfig, setTimeConfig] = useState({
    greeting: '你好',
    emoji: '👋',
    theme: 'from-[#003057] to-[#005A9E]', // 默认沃尔沃蓝
    halo: 'bg-blue-400'
  });

  // 🌟 优化 2：我的收藏状态（故意设为空数组，带你体验高级空状态处理）
  // 想要看有数据时的样子，可以在这里填入数据，例如：[{ code: 'ME21N', desc: '创建采购订单', bg: 'bg-blue-50', text: 'text-blue-600' }]
  const [favoriteTCodes, setFavoriteTCodes] = useState<any[]>([]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setTimeConfig({
        greeting: '早上好', emoji: '🌅', 
        theme: 'from-orange-500 to-amber-600', // 晨曦橙
        halo: 'bg-yellow-300'
      });
    } else if (hour < 18) {
      setTimeConfig({
        greeting: '下午好', emoji: '☀️', 
        theme: 'from-[#003057] to-[#005A9E]', // 沃尔沃深蓝
        halo: 'bg-blue-400'
      });
    } else {
      setTimeConfig({
        greeting: '晚上好', emoji: '🌙', 
        theme: 'from-indigo-900 to-slate-800', // 静谧紫
        halo: 'bg-purple-500'
      });
    }
  }, []);

  // Framer Motion 动效配置
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    show: { 
      opacity: 1, y: 0, 
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  return (
    <div className="p-8 pb-24 max-w-[1400px] mx-auto font-sans overflow-x-hidden">
      
      {/* 顶部标题区 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            {timeConfig.greeting}，Demo User
            {/* 🌟 Emoji 微动效：轻微晃动 */}
            <motion.span 
              animate={{ rotate: [0, 15, -10, 15, 0] }} 
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 5 }}
              className="inline-block"
            >
              {timeConfig.emoji}
            </motion.span>
          </h1>
          <p className="text-gray-500 text-sm">今天是 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}，准备好开始今天的工作了吗？</p>
        </div>
      </div>

      {/* 核心 Bento Grid (便当盒网格布局) */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6 auto-rows-[160px]"
      >

        {/* 1. 超级搜索与欢迎卡片 (占 8 列，高度 2 行) */}
        {/* 🌟 这里的背景色会根据时间动态变化 */}
        <motion.div variants={cardVariants} className={`md:col-span-6 lg:col-span-8 row-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br ${timeConfig.theme} shadow-lg group transition-colors duration-1000 ease-in-out`}>
          {/* 装饰性背景光晕也会随时间变色 */}
          <div className={`absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 ${timeConfig.halo} rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse transition-colors duration-1000`}></div>
          
          <div className="relative h-full p-8 md:p-10 flex flex-col justify-between z-10">
            <div>
              <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-full mb-4 shadow-sm">
                Volvo System Workspace
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                连接数据，<br/>赋能每一个业务决策。
              </h2>
            </div>

            <div className="relative max-w-xl group/search">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within/search:text-blue-500 transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder="搜索 T-code、同事名称或系统 SOP..." 
                className="w-full pl-12 pr-4 py-4 bg-white/95 backdrop-blur-sm border-none text-gray-900 text-base outline-none rounded-2xl shadow-xl focus:ring-4 focus:ring-white/30 transition-all placeholder-gray-400 font-medium"
              />
              <div className="absolute inset-y-0 right-2 flex items-center">
                <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">Cmd K</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 2. 我的最爱 T-code (占 4 列，高度 2 行) */}
        <motion.div variants={cardVariants} className="md:col-span-6 lg:col-span-4 row-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col hover:border-blue-200 transition-colors h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> 常用事务代码
            </h3>
            <Link href="/t-codes" className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center group">
              全部 <ArrowRight className="w-3 h-3 ml-0.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 -mr-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            {/* 🌟 优化 2：优雅的空状态处理 */}
            {favoriteTCodes.length > 0 ? (
              <div className="space-y-2.5">
                {favoriteTCodes.map(t => (
                  <div key={t.code} className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${t.bg} flex items-center justify-center ${t.text} font-bold font-mono text-sm`}>
                        {t.code.substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm font-mono group-hover:text-blue-600 transition-colors">{t.code}</p>
                        <p className="text-xs text-gray-500">{t.desc}</p>
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:bg-[#005A9E] group-hover:text-white group-hover:border-transparent transition-all shadow-sm shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              // 🌟 高级空状态设计 (Dashed container + Action button)
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 group hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                  <Star className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <p className="text-sm font-bold text-gray-700 mb-1">暂无常用代码</p>
                <p className="text-[11px] text-gray-500 mb-4 px-2">你还没有收藏任何 T-code，去检索台逛逛，点击星号将它们固定在这里。</p>
                <Link href="/t-codes" className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:shadow-sm transition-all flex items-center gap-1.5">
                  前往检索 <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* 3. 继续学习 (占 6 列，高度 1 行) */}
        <motion.div variants={cardVariants} className="md:col-span-3 lg:col-span-6 row-span-1 bg-white rounded-3xl p-1 shadow-sm border border-gray-100 relative overflow-hidden group">
          <Link href="/training/v1" className="absolute inset-0 z-10"></Link>
          <div className="flex h-full">
            <div className="w-40 h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <Play className="w-8 h-8 text-white opacity-80 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="p-5 flex flex-col justify-between flex-1">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 继续观看
                </p>
                <h3 className="font-bold text-gray-900 text-base line-clamp-1 group-hover:text-blue-600 transition-colors">SAP APQP 完整操作流程与避坑指南</h3>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5 font-medium">
                  <span>进度 65%</span>
                  <span>剩余 04:20</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full w-[65%]"></div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 4. 环境与系统健康度 (占 3 列，高度 1 行) */}
        <motion.div variants={cardVariants} className="md:col-span-3 lg:col-span-3 row-span-1 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-200 transition-colors">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <Link href="/gateway" className="text-gray-400 hover:text-blue-600 transition-colors"><ArrowRight className="w-5 h-5" /></Link>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg mb-0.5">系统运行正常</h3>
            <p className="text-xs text-gray-500">SAP S/4HANA 延迟 &lt; 40ms</p>
          </div>
        </motion.div>

        {/* 5. 待办事项或快捷操作 (占 3 列，高度 1 行) */}
        <motion.div variants={cardVariants} className="md:col-span-3 lg:col-span-3 row-span-1 bg-blue-50/50 rounded-3xl p-6 shadow-sm border border-blue-100 flex flex-col justify-between border-dashed hover:bg-blue-50 transition-colors cursor-pointer">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          </div>
          <div>
            <h3 className="font-bold text-blue-900 text-base mb-0.5">系统更新文档</h3>
            <p className="text-xs text-blue-600/80">V2.4 版本已发布</p>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}