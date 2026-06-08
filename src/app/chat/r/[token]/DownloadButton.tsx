'use client';

/**
 * Imprime el iframe del reporte → el navegador ofrece "Guardar como PDF".
 * El documento dentro del iframe ya trae su CSS @media print.
 */
export default function DownloadButton() {
  const handle = () => {
    const frame = document.getElementById('reporte-frame') as HTMLIFrameElement | null;
    const win = frame?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return (
    <button
      onClick={handle}
      className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#71BF44] text-white text-xs font-bold hover:bg-[#5a9c33] transition-colors shadow-md shadow-[#71BF44]/25"
    >
      ⬇ Descargar PDF
    </button>
  );
}
