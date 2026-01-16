import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Swing Trading Agent',
  description: 'Autonomous swing trading system with LLM-powered signal generation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}