import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#070d1a', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ fontSize: 64, fontWeight: 800, color: '#1a2d44', fontVariantNumeric: 'tabular-nums' }}>404</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#e8f0f8' }}>Page not found</div>
      <Link href="/" style={{
        background: '#f59e0b', color: '#000', borderRadius: 6,
        padding: '8px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginTop: 8
      }}>
        Back to Dashboard
      </Link>
    </div>
  )
}
