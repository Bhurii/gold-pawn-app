const APP_TITLE = 'ห่านทองคำ'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {
      title: APP_TITLE,
      body: 'มีอัปเดตใหม่ในแอป',
      url: '/',
      tag: 'haanthong-default',
    }

    try {
      const subscription = await self.registration.pushManager.getSubscription()
      const endpoint = subscription?.endpoint ? `?endpoint=${encodeURIComponent(subscription.endpoint)}` : ''
      const response = await fetch(`/api/push/latest${endpoint}`, { cache: 'no-store' })
      if (response.ok) {
        payload = await response.json()
      }
    } catch {}

    await self.registration.showNotification(payload.title || APP_TITLE, {
      body: payload.body || 'มีอัปเดตใหม่ในแอป',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'haanthong-default',
      data: {
        url: payload.url || '/',
      },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windowClients) {
      if ('focus' in client) {
        client.navigate(targetUrl)
        return client.focus()
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl)
    }
  })())
})
