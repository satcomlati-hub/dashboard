import MonitoreoWidget from '@/components/MonitoreoWidget';

export default function AnalyticsPage() {
  return (
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Satcom Analytics</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Dashboards directos desde las bases de datos de Satcom.</p>
      </header>

      <div className="flex flex-col gap-8">
        <MonitoreoWidget />
      </div>
    </>
  );
}
