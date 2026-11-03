// Clerk 設定 —— publishableKey 到 https://dashboard.clerk.com 的 API Keys 頁面複製。
//
// proxyUrl 走的是 server/index.js 裡的 /__clerk/* 反向代理路由，不是直接連
// clerk.epoch-shop.com 這個自訂子網域 —— 因為那個網域跟 Clerk 的伺服器剛好都架在
// Cloudflare 上，會撞出 Cloudflare 的 Error 1000（DNS points to prohibited IP），
// 用代理繞開這個問題。同時要在 Clerk Dashboard → Domains → Frontend API 那邊設定
// 「Use proxy」，網址填一樣的 proxyUrl 值，兩邊要一致。
window.EPOCH_CLERK_CONFIG = {
	publishableKey: "pk_live_Y2xlcmsuZXBvY2gtc2hvcC5jb20k",
	proxyUrl: "https://epoch-shop.com/__clerk"
};
