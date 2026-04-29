'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X, Info, LifeBuoy } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'ticket';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  ticketNumber?: string;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType, ticketNumber?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType = 'info', ticketNumber?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type, ticketNumber }]);

    // Auto-remove after 6 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-3 pointer-events-none max-w-md w-full">
        {notifications.map((n) => (
          <div 
            key={n.id}
            className={`
              pointer-events-auto
              group relative overflow-hidden
              bg-white dark:bg-[#161616] 
              border border-neutral-200 dark:border-neutral-800
              rounded-[24px] shadow-2xl p-5
              flex items-start gap-4
              transition-all duration-500 ease-out
              animate-in slide-in-from-right-full fade-in
            `}
          >
            {/* Visual Indicator Line */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
              n.type === 'success' ? 'bg-[#71BF44]' : 
              n.type === 'error' ? 'bg-red-500' : 
              n.type === 'ticket' ? 'bg-amber-500' : 'bg-blue-500'
            }`} />

            <div className={`
              p-2.5 rounded-2xl shrink-0
              ${n.type === 'success' ? 'bg-[#71BF44]/10 text-[#71BF44]' : 
                n.type === 'error' ? 'bg-red-500/10 text-red-500' : 
                n.type === 'ticket' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}
            `}>
              {n.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {n.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {n.type === 'ticket' && <LifeBuoy className="w-5 h-5" />}
              {n.type === 'info' && <Info className="w-5 h-5" />}
            </div>

            <div className="flex-1 pt-0.5">
              <p className="text-[13px] font-bold text-neutral-900 dark:text-white leading-snug">
                {n.message}
              </p>
              {n.ticketNumber && (
                <div className="mt-3 flex items-center gap-2">
                   <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Ticket ID:</span>
                   <span className="bg-amber-500/10 text-amber-500 text-[11px] font-black px-2.5 py-1 rounded-lg border border-amber-500/20 shadow-sm">
                      #{n.ticketNumber}
                   </span>
                </div>
              )}
            </div>

            <button 
              onClick={() => removeNotification(n.id)}
              className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
