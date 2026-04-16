import { Video } from 'lucide-react';
import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
interface SharePointVideoProps {
  url: string;
  title?: string;
}

export default function SharePointVideo({ url, title = "SharePoint Video" }: SharePointVideoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    // 🌟 核心：aspect-video 保证 16:9 比例，w-full 占满父容器，rounded-2xl 加圆角更现代
    <div className="relative w-full aspect-video bg-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-200 flex items-center justify-center group">
      
      {/* 这是一个加载占位符，如果 iframe 加载慢，用户不会看到一片空白 */}
     {/* 骨架屏：在 iframe 加载完成前显示 */}
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 animate-pulse z-0">
          <PlayCircle className="w-12 h-12 mb-3 text-slate-600" />
          <span className="text-sm font-medium text-slate-500 tracking-wide">Loading secure stream...</span>
        </div>
      )}

      <iframe
        src={url}
        title={title}
        className="absolute top-0 left-0 w-full h-full border-none bg-transparent"
        allowFullScreen
        loading="lazy" // 延迟加载，提升页面整体性能
        // 允许自动播放和全屏
        allow="autoplay; fullscreen; picture-in-picture" 
      />
    </div>
  );
}