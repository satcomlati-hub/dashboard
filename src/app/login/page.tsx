import { signIn } from "@/lib/auth"

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] flex overflow-hidden">

      {/* ── Ambient glow blobs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #71BF44 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-60 right-0 w-[700px] h-[700px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #0078D7 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #71BF44 0%, transparent 60%)" }}
        />
      </div>

      {/* ── Subtle dot grid ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, #e2e2e2 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Left panel — hero copy ── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-16 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#71BF44]" />
            <span className="text-[0.6875rem] font-mono tracking-[0.2em] uppercase text-[#71BF44] opacity-60">
              Satcom LA
            </span>
          </div>
        </div>

        <div>
          <p className="text-[0.75rem] font-mono tracking-[0.15em] uppercase text-[#594139] mb-6">
            Sistema de Operaciones
          </p>
          <h1
            className="font-bold text-[#e2e2e2] leading-[1.05] tracking-[-0.04em] mb-8"
            style={{ fontSize: "clamp(2.5rem, 4vw, 4rem)" }}
          >
            Control.<br />
            <span className="text-[#71BF44]">Monitoreo.</span><br />
            Automatización.
          </h1>
          <p className="text-[#594139] text-sm max-w-xs leading-relaxed">
            Infraestructura de automatización empresarial en tiempo real.
          </p>
        </div>

        <div />

      </div>

      {/* ── Vertical divider ── */}
      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-[#353535] to-transparent relative z-10 my-16" />

      {/* ── Right panel — login form ── */}
      <div className="flex flex-1 items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-sm">

          {/* Mobile-only logo */}
          <div className="lg:hidden mb-10">
            <p className="text-[0.6875rem] font-mono tracking-[0.2em] uppercase text-[#594139] mb-3">Satcom LA</p>
            <h1 className="text-3xl font-bold text-[#e2e2e2] tracking-[-0.04em]">
              Control.<br />
              <span className="text-[#ff6c37]">Monitoreo.</span>
            </h1>
          </div>

          {/* Card */}
          <div
            className="rounded-md p-8"
            style={{
              background: "rgba(31,31,31,0.8)",
              backdropFilter: "blur(12px)",
              boxShadow: "0px 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,108,55,0.06)",
            }}
          >
            <p className="text-[0.6875rem] font-mono tracking-[0.15em] uppercase text-[#594139] mb-6">
              Acceso Corporativo
            </p>

            {/* Zoho button — primary CTA */}
            <form
              action={async () => {
                "use server"
                await signIn("zoho", { redirectTo: "/" })
              }}
            >
              <button
                type="submit"
                className="group w-full flex items-center gap-3 py-3.5 px-5 rounded-md font-semibold text-white text-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #0078D7 0%, #005a9e 100%)",
                  boxShadow: "0 4px 24px rgba(0,120,215,0.3)",
                }}
              >
                {/* Zoho "Z" mark */}
                <span
                  className="w-7 h-7 rounded-sm flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  Z
                </span>
                <span className="flex-1 text-left">Continuar con Zoho</span>
                <svg className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </form>

            {/* Domain hint */}
            <div className="mt-5 flex items-center gap-2 px-3 py-2.5 bg-[#0e0e0e] rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#58d6f6] flex-shrink-0" />
              <p className="text-[0.7rem] text-[#a88a81]">
                Cuentas <span className="text-[#ffb59d] font-mono">@satcomla.com</span> o <span className="text-[#ffb59d] font-mono">@somoshora.com</span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-[0.6875rem] text-[#353535] text-center mt-6 font-mono">
            SATCOM LA · ACCESO MONITOREADO
          </p>
        </div>
      </div>
    </div>
  )
}
