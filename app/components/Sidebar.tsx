'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Command, BookOpen, Globe, LifeBuoy, Home, Settings, User, Bell } from 'lucide-react';

const NAV_ITEMS = [
  { name: '首页大盘', href: '/', icon: Home },
  { name: 'T-code 速查', href: '/t-codes', icon: Command },
  // { name: '快捷访问', href: '/gateway', icon: Globe },
  { name: '培训与指南', href: '/training', icon: BookOpen },
  // { name: '用户支持', href: '/support', icon: LifeBuoy },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0">
      {/* 品牌 Logo 区 */}
      <div className="h-20 flex items-center px-6 border-b border-gray-100">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-sm">
          <span className="text-white font-bold text-xl leading-none">V</span>
        </div>
        <div>
          <h1 className="font-bold text-gray-900 tracking-tight">Volvo System</h1>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Workspace</p>
        </div>
      </div>

      {/* 核心导航菜单 */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">主菜单</div>
      {NAV_ITEMS.map((item) => {
          // 🌟 修复路由高亮：如果是首页就严格匹配，如果是其他菜单就用前缀匹配
          const isActive = item.href === '/' 
            ? pathname === '/' 
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* 底部用户信息区 */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4 px-2">
          <button className="text-gray-400 hover:text-gray-600 transition-colors"><Bell className="w-4 h-4" /></button>
          <button className="text-gray-400 hover:text-gray-600 transition-colors"><Settings className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-100 to-blue-200 border border-blue-300 flex items-center justify-center overflow-hidden">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">Demo User</p>
            <p className="text-xs text-gray-500 truncate">Buyer / PPD</p>
          </div>
        </div>
      </div>
    </aside>
  );
}