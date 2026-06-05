import './globals.css';

export const metadata = {
  title: 'LAPD Crime Dashboard — 2020-2024',
  description: 'Interactive analysis of 1,004,894 LAPD crime records from 2020 to 2024. Temporal patterns, geographic distribution, victim demographics, and socioeconomic correlations.',
  openGraph: {
    title: 'LAPD Crime Dashboard — 2020-2024',
    description: 'Interactive analysis of 1M+ LAPD crime records',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
