import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Satcom n8n Dashboard',
  description: 'Management dashboard for n8n instances',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-white dark:bg-[#0e0e0e] text-neutral-900 dark:text-white antialiased transition-colors duration-200`}>
        <div className="flex min-h-screen bg-[#f9f9f9] dark:bg-[#0e0e0e]">
          <Sidebar />
          <main className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
