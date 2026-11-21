// 共用的 Clerk 登入/註冊整合。三個頁面（index/pricing/chat）都載入這支檔案。
// 行為：
//   - 找到頁面上 id="clerk-auth-slot" 的容器，依登入狀態渲染「登入/立即註冊」按鈕
//     或 Clerk 的 UserButton（頭像選單，含登出）。
//   - 對外廣播 "epoch-auth-ready" 事件（detail: { signedIn, unconfigured, error }），
//     讓 chat.html 用來決定要不要顯示「請先登入」的鎖定畫面。
(function () {
	var assetBase = new URL(".", document.currentScript.src);
	function loadClerkScript(cfg) {
		return new Promise(function (resolve, reject) {
			var script = document.createElement("script");
			script.async = true;
			script.crossOrigin = "anonymous";
			script.setAttribute("data-clerk-publishable-key", cfg.publishableKey);
			script.src = cfg.frontendApi + "/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
			script.addEventListener("load", resolve);
			script.addEventListener("error", reject);
			document.head.appendChild(script);
		});
	}

	function broadcast(detail) {
		document.dispatchEvent(new CustomEvent("epoch-auth-ready", { detail: detail }));
	}

	function renderUnavailable() {
		var slot = document.getElementById("clerk-auth-slot");
		if (!slot) return;
		slot.textContent = "會員登入暫時無法使用，請稍後再試。";
		slot.setAttribute("role", "status");
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
		var unconfigured = !cfg || !cfg.frontendApi || !cfg.publishableKey || cfg.publishableKey.indexOf("REPLACE_ME") !== -1;

		if (unconfigured) {
			console.warn("[epoch-auth] 尚未設定 Clerk Publishable Key，登入功能無法使用。請編輯 assets/js/clerk-config.js");
			renderUnavailable();
			broadcast({ signedIn: false, unconfigured: true });
			return;
		}

		try {
			var translations = await import("./clerk-zh-tw.mjs").catch(function (err) {
				console.warn("[epoch-auth] 無法載入繁體中文，將使用預設語言", err);
				return {};
			});
			var localization = translations.zhTW && Object.assign({}, translations.zhTW, {
				formFieldInputPlaceholder__firstName: "請輸入名字",
				formFieldInputPlaceholder__lastName: "請輸入姓氏",
				formFieldInputPlaceholder__emailAddress: "請輸入電子郵件地址",
				formFieldInputPlaceholder__password: "請輸入密碼",
				signUp: Object.assign({}, translations.zhTW.signUp, {
					start: Object.assign({}, translations.zhTW.signUp.start, {
						title: "建立會員帳號", subtitle: "歡迎加入！請填寫以下資料以開始使用。",
						actionText: "已經有帳號了？", actionLink: "登入"
					})
				})
			});
			await loadClerkScript(cfg);
			await window.Clerk.load({
				localization: localization,
				appearance: {
					layout: { logoImageUrl: new URL("../images/epoch-auth-logo.svg", assetBase).href },
					variables: {
						colorPrimary: "#aaff45", colorBackground: "#062219",
						colorText: "#f2fff8", colorTextSecondary: "#b9d3c4",
						colorInputBackground: "#0a3125", colorInputText: "#f2fff8",
						colorTextOnPrimaryBackground: "#07150b", borderRadius: "0.85rem"
					},
					elements: {
						card: { border: "1px solid #62d48c", boxShadow: "0 0 38px rgba(53, 246, 119, .22)", background: "linear-gradient(145deg, #0c3526, #031711)" },
						footer: {
							background: "#062219", position: "relative",
							"&::after": {
								content: '""', position: "absolute", bottom: 0, left: 0, right: 0,
								height: "48px", backgroundColor: "#062219",
								backgroundImage: 'url("' + new URL("../images/epoch-auth-logo.svg", assetBase).href + '")',
								backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "120px auto",
								pointerEvents: "none"
							}
						},
						formButtonPrimary: { background: "linear-gradient(105deg, #d5ff6a, #57f35b)", color: "#07150b", fontWeight: "700" },
						formFieldInput: { border: "1px solid #4a9870" },
						footerActionLink: { color: "#b8ff62" },
						headerTitle: { color: "#f2fff8" }, headerSubtitle: { color: "#b9d3c4" }
					}
				}
			});
		} catch (err) {
			console.error("[epoch-auth] Clerk 載入失敗", err);
			renderUnavailable();
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
