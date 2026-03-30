import { auth, signOut } from "@/lib/auth"
import TopCards from '@/components/TopCards';
import ActiveTools from '@/components/ActiveTools';

function ZohoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block">
      <circle cx="30" cy="30" r="25" fill="#0078D7" fillOpacity="0.2"/>
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="28" fontWeight="bold" fill="#58d6f6" fontFamily="Arial">Z</text>
    </svg>
  )
}

export default async function Home() {
  const session = await auth()
  const user = session?.user

  const firstName = user?.name?.split(' ')[0] ?? 'Usuario'
  const now = new Date()
  const dateLabel = now.toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <>
      {/* Welcome header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-8 gap-4">
        <div>
          <p className="text-[0.6875rem] font-mono tracking-[0.12em] uppercase text-[#a88a81] mb-1">
            Centro de Control · Satcom LA
          </p>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e2e2e2] tracking-tight">
            Bienvenido, {firstName}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-[#a88a81] mt-1 capitalize">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-4">
          {/* System status */}
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#71BF44] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#71BF44]"></span>
            </span>
            <span className="text-sm font-medium text-neutral-600 dark:text-[#ababab]">Sistema Operativo</span>
          </div>

          {/* Zoho user badge */}
          {user && (
            <div className="flex items-center gap-2 bg-[#1f1f1f] rounded-md px-3 py-1.5">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={user.name ?? ''} className="w-5 h-5 rounded-sm object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-sm bg-[#353535] flex items-center justify-center text-[0.6rem] font-bold text-[#ffb59d]">
                  {firstName[0]}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <ZohoIcon />
                <span className="text-[0.75rem] text-[#e2e2e2] font-medium">{user.name}</span>
              </div>

              <form action={async () => {
                "use server"
                await signOut({ redirectTo: "/login" })
              }}>
                <button type="submit" className="text-[0.6875rem] text-[#594139] hover:text-[#a88a81] transition-colors ml-1">
                  Salir
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Zoho connection status strip */}
      <div className="flex items-center gap-2 mb-6 px-3 py-2 bg-[#1f1f1f] rounded-md w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-[#58d6f6]" />
        <ZohoIcon />
        <span className="text-[0.75rem] text-[#58d6f6] font-medium">Zoho SSO</span>
        <span className="text-[0.75rem] text-[#a88a81]">·</span>
        <span className="text-[0.75rem] text-[#a88a81]">{user?.email}</span>
        <span className="text-[0.6875rem] bg-[#003743] text-[#58d6f6] px-1.5 py-0.5 rounded-sm ml-1">Activo</span>
      </div>

      <TopCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActiveTools />
        </div>
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4 overflow-hidden" style={{ width: '48px', height: '48px' }}>
            <svg width="24" height="24" className="w-6 h-6 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Uso en el Tiempo</h3>
          <p className="text-xs text-neutral-500 dark:text-[#ababab] max-w-[200px]">El gráfico de ejecuciones se conectará próximamente con la API de métricas históricas.</p>
        </div>
      </div>
    </>
  );
}
