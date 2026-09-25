import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arxion — Agent Collaboration Platform',
  description:
    'A shared coordination layer for human developers and AI coding agents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
