'use client';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all relative
            ${activeTab === tab.id 
              ? 'text-[#71BF44]' 
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'}
          `}
        >
          {tab.icon}
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#71BF44] shadow-[0_0_8px_rgba(113,191,68,0.5)]" />
          )}
        </button>
      ))}
    </div>
  );
}
