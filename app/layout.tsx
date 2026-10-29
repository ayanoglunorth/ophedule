import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ophedule | Arkadaşlarla plan yap',
  description: 'Arkadaşlarınla uygun günleri işaretle, gezi fikirlerini karşılaştır.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
