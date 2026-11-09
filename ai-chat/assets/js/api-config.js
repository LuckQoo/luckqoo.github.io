// 後端 API 網址設定。
// 正式上線後，如果後端跟這些靜態頁面同一個網域（例如都在 epoch-shop.com，
// 後端用反向代理掛在 /api 底下），留空字串即可，會用相對路徑呼叫。
// 如果後端在不同網域/不同 port（例如本機開發時後端另外跑在 8788），
// 填完整網址，例如 "http://127.0.0.1:8788"。
window.EPOCH_API_BASE_URL = "https://epoch-ai-chat-backend.lioyue444.workers.dev";
