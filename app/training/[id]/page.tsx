'use client';

import { use } from 'react'; 
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Share2, ThumbsUp, BookmarkPlus, PlayCircle, FileText, CheckCircle2 } from 'lucide-react';
import { MOCK_CONTENT } from '../page';

// 🌟 1. 引入你封装好的视频组件
// 请根据你实际的文件路径调整这里 (例如: '../_components/VideoPlayer' 或 './VideoPlayer')
import VideoPlayer from '../VideoPlayer'; 

export default function TrainingDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  
  const currentItem = MOCK_CONTENT.find(c => c.id === resolvedParams.id);
  
  if (!currentItem) return notFound(); 

  const relatedContent = MOCK_CONTENT.filter(c => c.id !== currentItem.id);

  return (
    <div className="p-8 pb-24 max-w-[1500px] mx-auto font-sans">
      
      {/* 顶部返回导航 */}
      <Link href="/training" className="inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium text-sm mb-6">
        <ArrowLeft className="w-4 h-4" /> 返回培训大厅
      </Link>

      {/* 左右分栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* 左侧主要区域：播放器 + 详情 + SOP */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 🌟 2. 核心播放器/阅读器渲染区 🌟 */}
          <div className="w-full rounded-3xl shadow-lg overflow-hidden border border-gray-100 bg-gray-900">
            {currentItem.url ? (
              // 场景 A：有真实链接
              currentItem.type === 'video' ? (
                // 渲染 SharePoint 视频
                <VideoPlayer url={currentItem.url} title={currentItem.title} />
              ) : (
                // 渲染 Word/PDF 文档预览 (高度设为 700px 方便阅读)
                <iframe 
                  src={currentItem.url} 
                  className="w-full h-[700px] bg-white border-none"
                  title={currentItem.title}
                />
              )
            ) : (
              // 场景 B：没有链接时，退回到你原本的精美占位符 (Fallback)
              <div className={`w-full aspect-video bg-gradient-to-br ${currentItem.thumb} flex flex-col items-center justify-center relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-0"></div>
                <div className="z-10 text-center">
                  {currentItem.type === 'video' ? (
                    <>
                      <div className="bg-white/20 backdrop-blur-md text-white p-6 rounded-full inline-block mb-4">
                        <PlayCircle className="w-16 h-16" />
                      </div>
                      <p className="text-white font-medium">暂无视频链接源</p>
                    </>
                  ) : (
                    <>
                      <div className="bg-white/20 backdrop-blur-md text-white p-6 rounded-2xl mb-4 inline-block">
                        <FileText className="w-16 h-16" />
                      </div>
                      <p className="text-white font-medium">暂无文档链接源</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 标题与操作栏 */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-md">{currentItem.module}</span>
              <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-md">适用于 {currentItem.role}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-4">{currentItem.title}</h1>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="font-medium text-gray-900">{currentItem.views} 次浏览</span>
                <span>•</span>
                <span>发布于 2024年3月15日</span>
              </div>
              
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-4 py-2 rounded-full transition-colors">
                  <ThumbsUp className="w-4 h-4" /> 赞 ({currentItem.rating})
                </button>
                <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-4 py-2 rounded-full transition-colors">
                  <BookmarkPlus className="w-4 h-4" /> 收藏
                </button>
                <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-4 py-2 rounded-full transition-colors">
                  <Share2 className="w-4 h-4" /> 分享
                </button>
              </div>
            </div>
          </div>

          {/* 富文本详情描述 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg text-gray-900 mb-4">课程详情与操作概要</h3>
            <div className="text-gray-600 text-sm leading-relaxed space-y-4">
              <p>本课程涵盖了 {currentItem.module} 模块的核心业务逻辑。我们将手把手带您完成标准业务流程的配置与操作。</p>
              <h4 className="font-semibold text-gray-800 mt-6">💡 本节核心知识点 (Key Takeaways):</h4>
              <ul className="space-y-2">
                <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> 了解系统必填字段的最佳实践</li>
                <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> 常见报错的排查与解决思路</li>
                <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> 如何高效利用关联 T-code 实现穿透</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 右侧：为你推荐 */}
        <div className="lg:col-span-1">
          <h3 className="font-bold text-lg text-gray-900 mb-4">为你推荐 (Up Next)</h3>
          <div className="space-y-4">
            {relatedContent.map(item => (
              <Link href={`/training/${item.id}`} key={item.id} className="group flex gap-3 cursor-pointer">
                <div className={`relative w-40 aspect-video rounded-xl shrink-0 bg-gradient-to-br ${item.thumb} overflow-hidden shadow-sm`}>
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors"></div>
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 rounded">
                    {item.duration || item.readTime}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-gray-900 leading-tight mb-1 group-hover:text-blue-600 line-clamp-2">
                    {item.title}
                  </h4>
                  <p className="text-xs text-gray-500 mb-0.5">{item.module}</p>
                  <p className="text-xs text-gray-400">{item.views} views • {item.type}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}