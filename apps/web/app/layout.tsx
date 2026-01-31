import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Certificate Registry',
  description: 'Prototype registry for certificates'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
