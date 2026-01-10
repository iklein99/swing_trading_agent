import type { Metadata } from 'next';

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
      <body>{children}</body>
    </html>
  );
}