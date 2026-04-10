export function toThaiDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  const thaiYear = year < 2500 ? year + 543 : year
  return `${day}/${month}/${thaiYear}`
}

export function toThaiDateLong(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const day = d.getDate()
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const thaiYear = year < 2500 ? year + 543 : year
  return `${day} ${month} ${thaiYear}`
}

export function fmt(n: number): string {
  return n.toLocaleString('th-TH')
}
