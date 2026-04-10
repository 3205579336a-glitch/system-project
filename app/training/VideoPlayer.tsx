import { Video } from 'lucide-react';

interface SharePointVideoProps {
  url: string;
  title?: string;
}

export default function SharePointVideo({ url, title = "SharePoint Video" }: SharePointVideoProps) {
  return (
    // 🌟 核心：aspect-video 保证 16:9 比例，w-full 占满父容器，rounded-2xl 加圆角更现代
    <div className="relative w-full aspect-video bg-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-200 flex items-center justify-center group">
      
      {/* 这是一个加载占位符，如果 iframe 加载慢，用户不会看到一片空白 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 -z-10">
        <Video className="w-8 h-8 mb-2 animate-pulse" />
        <span className="text-sm">正在加载视频资源...</span>
      </div>

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