import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavigationWrapper from '@/components/NavigationWrapper';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';
import { NotificationProvider } from '@/components/NotificationProvider';

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
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('satcom-theme');
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  const theme = savedTheme || systemTheme;
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body 
        className={`${inter.className} bg-white dark:bg-[#0e0e0e] text-neutral-900 dark:text-white antialiased transition-colors duration-200`}
        suppressHydrationWarning
      >
        <SessionProviderWrapper>
          <NotificationProvider>
            <NavigationWrapper>
              {children}
            </NavigationWrapper>
          </NotificationProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
