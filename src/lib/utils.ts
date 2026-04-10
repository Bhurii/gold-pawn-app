export function toThaiDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    calendar: 'buddhist'
  } as any)
}

export function toThaiDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const day = d.getDate()
  const month = d.getMonth() + 1
  const year = d.getFullYear() + 543
  return `${day}/${month}/${year}`
}

export function fmt(n: number): string {
  return n.toLocaleString('th-TH')
}
