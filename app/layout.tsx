import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ophedule — Birlikte daha güzel planlara',
  description: 'Arkadaşlarınla ortak takvim oluştur, uygunlukları gör ve gezileri birlikte planla.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
