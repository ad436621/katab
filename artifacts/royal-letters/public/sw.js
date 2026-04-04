const CACHE_NAME = "royal-letters-v2";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/offline.html",
  "/sounds/notify.mp3",
  "/icon-192.png",
  "/icon-512.png",
  "/icons/badge-72.png",
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

// ─── FETCH ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API — network-first, JSON error fallback when offline
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: "offline", message: "أنت غير متصل" }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Static assets (JS/CSS/images/fonts) — cache-first
  if (
    event.request.destination === "script" ||
    event.request.destination === "style" ||
    event.request.destination === "image" ||
    event.request.destination === "font"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone)).catch(() => {});
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML navigation — network-first, then cached index, then offline page
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request) || await caches.match("/index.html");
          return cached || (await caches.match("/offline.html")) || new Response("غير متصل", { status: 503 });
        })
    );
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ─── PUSH ────────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {
    type: "general",
    title: "الرسائل الملكية",
    body: "إشعار جديد",
    icon: "/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: "general",
    url: "/dashboard",
    letterId: null,
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  const actions = (() => {
    if (data.type === "new_reply") return [
      { action: "open", title: "📖 فتح الرسالة" },
      { action: "dismiss", title: "✕ إغلاق" },
    ];
    if (data.type === "letter_read") return [
      { action: "open", title: "👁 عرض الرسالة" },
    ];
    if (data.type === "message_unlocked") return [
      { action: "open", title: "🔓 فتح الآن" },
      { action: "dismiss", title: "لاحقاً" },
    ];
    return [{ action: "open", title: "فتح" }];
  })();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icons/badge-72.png",
      dir: "rtl",
      lang: "ar",
      tag: data.tag || data.letterId || data.type,
      renotify: true,
      requireInteraction: data.type === "new_reply",
      silent: false,
      vibrate: [200, 100, 200],
      data: { url: data.url, letterId: data.letterId, type: data.type },
      actions,
    })
  );
});

// ─── NOTIFICATION CLICK ──────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ─── NOTIFICATION CLOSE ──────────────────────────────────────────────────────
self.addEventListener("notificationclose", (event) => {
  const tag = event.notification.tag;
  if (!tag) return;
  fetch("/api/notifications/dismissed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  }).catch(() => {});
});

// ─── PUSH SUBSCRIPTION CHANGE ────────────────────────────────────────────────
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then((newSub) => {
      const s = newSub.toJSON();
      return fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: s.endpoint,
          p256dh: s.keys?.p256dh,
          auth: s.keys?.auth,
          isAdmin: true,
        }),
      });
    }).catch(() => {})
  );
});

// ─── MESSAGES FROM MAIN THREAD ───────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (!event.data) return;
  const { type, count } = event.data;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (type === "BADGE_COUNT" && typeof count === "number") {
    if ("setAppBadge" in navigator) {
      navigator.setAppBadge(count).catch(() => {});
    }
  } else if (type === "CLEAR_BADGE") {
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }
});
