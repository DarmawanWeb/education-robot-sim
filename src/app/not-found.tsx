import Link from 'next/link';

/** Fallback for requests outside any locale (rare, the proxy redirects most of them). */
export default function GlobalNotFound() {
  return (
    <html lang="id">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem 1.5rem', textAlign: 'center' }}
      >
        <h1>404</h1>
        <p>Halaman tidak ditemukan. Page not found.</p>
        <Link href="/">Taksu Tech</Link>
      </body>
    </html>
  );
}
