type CacheEntry<T> = {
  expiresAt: number
  value: T
}

const cacheStore = new Map<string, CacheEntry<unknown>>()
const pendingStore = new Map<string, Promise<unknown>>()

export async function getOrSetMemoryCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now()
  const cached = cacheStore.get(key) as CacheEntry<T> | undefined
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const pending = pendingStore.get(key) as Promise<T> | undefined
  if (pending) {
    return pending
  }

  const nextPromise = loader()
    .then((value) => {
      cacheStore.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      })
      pendingStore.delete(key)
      return value
    })
    .catch((error) => {
      pendingStore.delete(key)
      throw error
    })

  pendingStore.set(key, nextPromise)
  return nextPromise
}

export function deleteMemoryCache(key: string) {
  cacheStore.delete(key)
  pendingStore.delete(key)
}
