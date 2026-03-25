'use client';
import React from 'react';

interface MobileHeaderProps {
  onOpenSidebar: () => void;
}

export default function MobileHeader({ onOpenSidebar }: MobileHeaderProps) {
  return (
    <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-white dark:bg-[#0e0e0e] border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-[#71BF44] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">S</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Satcom</h1>
      </div>
      
      <button 
        onClick={onOpenSidebar}
        className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        aria-label="Abrir menú"
      >
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  );
}
