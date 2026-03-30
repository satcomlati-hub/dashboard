'use client';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';

interface NavigationWrapperProps {
  children: React.ReactNode;
}

export default function NavigationWrapper({ children }: NavigationWrapperProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Auth pages render standalone without navigation
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f9f9f9] dark:bg-[#0e0e0e]">
      <MobileHeader onOpenSidebar={() => setIsSidebarOpen(true)} />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
