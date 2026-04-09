'use client'
import Link from 'next/link'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#070d1a', flexDirection: 'column', gap: 20
    }}>
      <div style={{ fontSize: 48, color: '#f87171' }}>✗</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#e8f0f8' }}>Something went wrong</div>
      <div style={{ fontSize: 13, color: '#7a9ab8', maxWidth: 480, textAlign: 'center' }}>
        {error.message || 'An unexpected error occurred in the cost engine.'}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={reset}
          style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Try again
        </button>
        <Link href="/"
          style={{ background: 'transparent', color: '#7a9ab8', border: '1px solid #1a2d44', borderRadius: 6, padding: '8px 18px', fontSize: 13, textDecoration: 'none' }}
        >
          Go to Dashboard
        </Link>
      </div>
      {error.digest && (
        <div style={{ fontSize: 10, color: '#3d5a74', fontFamily: 'monospace' }}>Error ID: {error.digest}</div>
      )}
    </div>
  )
}
