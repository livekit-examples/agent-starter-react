import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LiveKit Learning',
  description: 'Learn LiveKit fundamentals by building',
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
