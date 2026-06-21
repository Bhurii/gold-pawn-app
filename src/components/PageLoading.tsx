'use client'

export default function PageLoading({ label = 'กำลังโหลด...' }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          minWidth: 180,
          textAlign: 'center',
          padding: '18px 20px',
          borderRadius: 18,
          border: '1px solid rgba(242,201,76,0.22)',
          background: 'rgba(30,23,14,0.94)',
          color: 'var(--gold)',
          fontSize: 16,
          fontWeight: 700,
          boxShadow: '0 10px 30px rgba(0,0,0,0.24)',
        }}
      >
        {label}
      </div>
    </div>
  )
}
