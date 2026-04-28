'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ThemeToggle from './ThemeToggle';
import { ChevronLeft, ChevronRight, LayoutGrid, BarChart3, Workflow, CreditCard, MessageSquare, Settings, Home, Briefcase } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export default function Sidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];

  const navItems = [
    { name: 'Inicio', href: '/', permission: 'page:home', icon: <Home className="w-5 h-5" /> },
    { name: 'Proyectos', href: '/projects', permission: 'page:projects', icon: <Briefcase className="w-5 h-5" /> },
    { name: 'Workflows', href: '/workflows', permission: 'page:workflows', icon: <Workflow className="w-5 h-5" /> },
    { name: 'Finanzas y Uso', href: '/usage', permission: 'page:usage', icon: <CreditCard className="w-5 h-5" /> },
    { name: 'Satcom Analytics', href: '/analytics', permission: 'page:analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { name: 'Credenciales', href: '/credentials', permission: 'page:credentials', icon: <LayoutGrid className="w-5 h-5" /> },
    { name: 'SARA Chat', href: '/chat', permission: 'page:chat', icon: <MessageSquare className="w-5 h-5" /> },
    { name: 'Configuración', href: '/settings', permission: 'page:settings', icon: <Settings className="w-5 h-5" /> },
  ].filter(item => permissions.length === 0 || permissions.includes(item.permission));

  return (
    <>
      {/* Overlay para móviles */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white dark:bg-[#0e0e0e] border-r border-neutral-200 dark:border-neutral-800 
        transition-all duration-300 ease-in-out transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:block lg:flex-shrink-0
        min-h-screen flex flex-col justify-between
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className={`p-6 ${isCollapsed ? 'px-4' : 'px-6'}`}>
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded bg-[#71BF44] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              {!isCollapsed && (
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white animate-in fade-in slide-in-from-left-2 duration-300">
                  Satcom
                </h1>
              )}
            </div>
            
            {/* Botón de colapso en escritorio */}
            <button 
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-neutral-500 hover:text-[#71BF44] transition-all"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Botón de cerrar en móvil */}
            <button 
              onClick={onClose}
              className="lg:hidden p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link 
                  key={item.href}
                  href={item.href} 
                  title={isCollapsed ? item.name : ''}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all group ${
                    isActive 
                      ? 'bg-[#71BF44]/10 text-[#71BF44]' 
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <div className={`flex-shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-[#71BF44]' : 'text-neutral-400'}`}>
                    {item.icon}
                  </div>
                  {!isCollapsed && (
                    <span className="truncate animate-in fade-in slide-in-from-left-1 duration-200">
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={`p-6 border-t border-neutral-100 dark:border-neutral-800 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && <span className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Apariencia</span>}
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
