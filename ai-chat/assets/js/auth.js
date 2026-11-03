// 共用的 Clerk 登入/註冊整合。三個頁面（index/pricing/chat）都載入這支檔案。
// 行為：
//   - 找到頁面上 id="clerk-auth-slot" 的容器，依登入狀態渲染「登入/立即註冊」按鈕
//     或 Clerk 的 UserButton（頭像選單，含登出）。
//   - 對外廣播 "epoch-auth-ready" 事件（detail: { signedIn, unconfigured, error }），
//     讓 chat.html 用來決定要不要顯示「請先登入」的鎖定畫面。
(function () {
	// 走 /__clerk 反向代理（server/index.js 裡的 /__clerk/* 路由），不直接連
	// clerk.epoch-shop.com，避開那個網域在 Cloudflare 上卡住的 DNS 驗證問題。
	// 規格見 https://clerk.com/docs/advanced-usage/using-proxies
	function loadClerkScript(cfg) {
		return new Promise(function (resolve, reject) {
			var script = document.createElement("script");
			script.async = true;
			script.crossOrigin = "anonymous";
			script.setAttribute("data-clerk-publishable-key", cfg.publishableKey);
			script.setAttribute("data-clerk-proxy-url", cfg.proxyUrl);
			script.src = cfg.proxyUrl + "/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
			script.addEventListener("load", resolve);
			script.addEventListener("error", reject);
			document.head.appendChild(script);
		});
	}

	function broadcast(detail) {
		document.dispatchEvent(new CustomEvent("epoch-auth-ready", { detail: detail }));
	}

	function renderNavSlot() {
		var slot = document.getElementById("clerk-auth-slot");
		if (!slot || !window.Clerk) return;
		slot.innerHTML = "";

		if (window.Clerk.user) {
			var userButtonEl = document.createElement("div");
			userButtonEl.id = "clerk-user-button";
			slot.appendChild(userButtonEl);
			window.Clerk.mountUserButton(userButtonEl);
		} else {
			var signInBtn = document.createElement("button");
			signInBtn.type = "button";
			signInBtn.className = "btn btn-ghost";
			signInBtn.textContent = "登入";
			signInBtn.addEventListener("click", function () {
				window.Clerk.openSignIn({});
			});

			var signUpBtn = document.createElement("button");
			signUpBtn.type = "button";
			signUpBtn.className = "btn btn-primary";
			signUpBtn.textContent = "立即註冊";
			signUpBtn.addEventListener("click", function () {
				window.Clerk.openSignUp({});
			});

			slot.appendChild(signInBtn);
			slot.appendChild(signUpBtn);
		}
	}

	async function init() {
		var cfg = window.EPOCH_CLERK_CONFIG;
		var unconfigured = !cfg || !cfg.publishableKey || cfg.publishableKey.indexOf("REPLACE_ME") !== -1;

		if (unconfigured) {
			console.warn("[epoch-auth] 尚未設定 Clerk Publishable Key，登入功能無法使用。請編輯 assets/js/clerk-config.js");
			broadcast({ signedIn: false, unconfigured: true });
			return;
		}

		try {
			await loadClerkScript(cfg);
			await window.Clerk.load();
		} catch (err) {
			console.error("[epoch-auth] Clerk 載入失敗", err);
			broadcast({ signedIn: false, error: true });
			return;
		}

		renderNavSlot();
		window.Clerk.addListener(function () {
			renderNavSlot();
			broadcast({ signedIn: !!window.Clerk.user });
		});

		broadcast({ signedIn: !!window.Clerk.user });
	}

	document.addEventListener("DOMContentLoaded", init);
})();
