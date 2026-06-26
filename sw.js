const CACHE_NAME = 'knowledge-graph-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css',
  'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js'
];

// 安装事件：预缓存核心资源
self.addEventListener('install', (e) => {
  console.log('[SW] 安装中...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] 预缓存核心资源');
        return cache.addAll(ASSETS).catch(err => {
          console.warn('[SW] 部分资源缓存失败（CDN可能暂时不可用）:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (e) => {
  console.log('[SW] 激活');
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] 删除旧缓存:', key);
            return caches.delete(key);
          })
      );
    })
    .then(() => self.clients.claim())
  );
});

// 请求拦截：根据资源类型采用不同缓存策略
self.addEventListener('fetch', (e) => {
  // 跳过 chrome-extension 和非 GET 请求
  if (e.request.method !== 'GET' || e.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(e.request.url);
  const isHTML = e.request.mode === 'navigate' || url.pathname.endsWith('.html');

  // 策略1：HTML 文件使用"网络优先"策略（确保总是获取最新版本）
  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // 缓存最新版本
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败时返回缓存版本
          console.log('[SW] 网络不可用，返回缓存的 HTML');
          return caches.match(e.request).then(cached => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // 策略2：其他资源（JS、CSS、图片等）使用"缓存优先"策略（提高加载速度）
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // 缓存命中直接返回，同时在后台更新缓存
        fetchAndCache(e.request);
        return cached;
      }
      // 无缓存则走网络请求
      return fetchAndCache(e.request);
    }).catch(() => {
      return fetchAndCache(e.request);
    })
  );
});

// 后台获取并更新缓存的辅助函数
function fetchAndCache(request) {
  return fetch(request).then(response => {
    if (response.status === 200) {
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, responseClone);
      });
    }
    return response;
  }).catch(err => {
    console.log('[SW] 网络请求失败:', err);
    return new Response('离线状态下此资源不可用', {
      status: 503,
      statusText: 'Offline'
    });
  });
}
