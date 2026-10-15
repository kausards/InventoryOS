import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../components/theme-provider';

export const metadata: Metadata = {
  title: 'Shopeers — AI-Powered B2B Inventory & eCommerce OS',
  description: 'Enterprise multi-tenant business and inventory analytics platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
