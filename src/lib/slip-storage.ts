import { supabase } from './supabase'

const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export function assertImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Please upload a JPEG, PNG, WebP, HEIC, or HEIF image')
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Image must be 8 MB or smaller')
  }
}

export function makeSlipPath(folder: string, file: File) {
  assertImageFile(file)
  const ext = file.name.split('.').pop()?.toLowerCase() || file.type.split('/')[1] || 'jpg'
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${folder}/${id}.${ext}`
}

export async function uploadSlip(file: File, folder: string): Promise<string> {
  const path = makeSlipPath(folder, file)
  const { error } = await supabase.storage.from('slips').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from('slips').getPublicUrl(path)
  return data.publicUrl
}
