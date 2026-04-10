import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from './components/Sidebar'; // 引入我们刚写的侧边栏

// 引入现代化字体
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Volvo System Workspace',
  description: 'Enterprise Portal for SAP and Operations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F4F7F9] text-gray-900 antialiased`}>
        {/* 系统骨架：左侧 Sidebar + 右侧主内容区 */}
        <div className="flex h-screen overflow-hidden">
          
          {/* 固定的侧边栏 (宽度 256px = w-64) */}
          <Sidebar />

          {/* 右侧主工作区：动态加载各个页面的内容 */}
          <main className="flex-1 ml-64 h-screen overflow-y-auto">
            {/* 你所有的页面（包括 T-code）都会自动被塞进这里的 {children} 中 */}
            {children}
          </main>
          
        </div>
      </body>
    </html>
  );
}