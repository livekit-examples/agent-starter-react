const CACHE_NAME = 'xiaomeng-cache-v1';

// 安装阶段：啥也不干，直接通过
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 激活阶段：立即控制页面
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 拦截网络请求：这是PWA的标准动作，即使我们直接返回网络结果
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
