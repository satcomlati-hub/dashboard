'use client';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import SaraChatWidget from './SaraChatWidget';

interface NavigationWrapperProps {
  children: React.ReactNode;
}

export default function NavigationWrapper({ children }: NavigationWrapperProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  // Auth pages render standalone without navigation
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return <>{children}</>;
  }

  // Chat page: layout with sidebar but sin padding para ocupar altura completa
  const isChat = pathname === '/chat';

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f9f9f9] dark:bg-[#0e0e0e]">
      <MobileHeader onOpenSidebar={() => setIsSidebarOpen(true)} />

      <Sidebar
        isOpen={isSidebarOpen}
        isCollapsed={isCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      <main className={`flex-1 overflow-hidden transition-all duration-300 ${isChat ? '' : 'p-4 lg:p-8 overflow-y-auto'} ${isCollapsed ? 'lg:ml-0' : ''}`}>
        {children}
      </main>

      {/* Widget flotante SARA — visible en todas las páginas excepto /chat */}
      {!isChat && <SaraChatWidget />}
    </div>
  );
}
