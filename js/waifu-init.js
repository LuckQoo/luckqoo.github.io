(function () {
  if (typeof window.live2d_settings === "undefined" || typeof window.initModel === "undefined") return;
  const base = window.WAIFU_ASSET_BASE || "assets";
  window.live2d_settings.modelId = 1;
  window.live2d_settings.modelTexturesId = 87;
  window.live2d_settings.modelStorage = false;
  window.live2d_settings.canCloseLive2d = false;
  window.live2d_settings.canTurnToHomePage = false;
  window.live2d_settings.waifuSize = "420x380";
  window.live2d_settings.waifuTipsSize = "300x90";
  window.live2d_settings.waifuFontSize = "14px";
  window.live2d_settings.waifuToolFont = "22px";
  window.live2d_settings.waifuToolLine = "28px";
  window.live2d_settings.waifuToolTop = "-26px";
  window.live2d_settings.waifuDraggable = "axis-x";
  window.initModel(`${base}/waifu-tips.json?v=1.4.2`);
})();
