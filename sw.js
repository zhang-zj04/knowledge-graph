const CACHE_NAME = 'knowledge-graph-v3';
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

// 请求拦截：缓存优先 + 网络回退策略
self.addEventListener('fetch', (e) => {
  // 跳过 chrome-extension 和非 GET 请求
  if (e.request.method !== 'GET' || e.request.url.startsWith('chrome-extension://')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // 缓存命中直接返回
        return cached;
      }
      // 走网络请求
      return fetch(e.request).then(response => {
        // 仅缓存成功的 GET 响应
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // 网络完全不可用时：导航请求返回主页，其他返回离线提示
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('离线状态下此资源不可用', {
          status: 503,
          statusText: 'Offline'
        });
      });
    })
  );
});
