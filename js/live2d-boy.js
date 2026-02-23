(function () {
  const container = document.querySelector(".waifu");
  if (!container) return;

  const FIXED_WIDTH = 420;
  const FIXED_HEIGHT = 380;

  const canvas = document.createElement("canvas");
  canvas.id = "live2d-canvas";
  canvas.className = "live2d";
  canvas.style.width = `${FIXED_WIDTH}px`;
  canvas.style.height = `${FIXED_HEIGHT}px`;
  container.innerHTML = "";
  container.style.width = `${FIXED_WIDTH}px`;
  container.style.height = `${FIXED_HEIGHT}px`;
  container.appendChild(canvas);

  const modelUrl = "/assets/live2d-boy/" + encodeURI("三枝助手SD1.model3.json");

  const app = new PIXI.Application({
    view: canvas,
    autoStart: true,
    backgroundAlpha: 0,
    width: FIXED_WIDTH,
    height: FIXED_HEIGHT,
    resolution: 1,
    autoDensity: false
  });

  PIXI.live2d.Live2DModel.from(modelUrl).then((model) => {
    app.stage.addChild(model);

    const w = FIXED_WIDTH;
    const h = FIXED_HEIGHT;
    const scale = Math.min(w / model.width, h / model.height) * 0.95;
    model.scale.set(scale, scale);

    if (model.anchor && typeof model.anchor.set === "function") {
      model.anchor.set(0.5, 1);
    }
    model.x = w * 0.5;
    model.y = h * 0.98;

    const reapplyLayout = () => {
      app.renderer.resize(FIXED_WIDTH, FIXED_HEIGHT);
      model.scale.set(scale, scale);
      model.x = FIXED_WIDTH * 0.5;
      model.y = FIXED_HEIGHT * 0.98;
    };

    window.addEventListener("resize", reapplyLayout);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", reapplyLayout);
      window.visualViewport.addEventListener("scroll", reapplyLayout);
    }

    const expressionNames = [
      "expression1",
      "expression2",
      "expression3",
      "expression4",
      "expression5"
    ];

    let exprIndex = 0;
    const playExpression = () => {
      if (typeof model.expression !== "function") return;
      const name = expressionNames[exprIndex % expressionNames.length];
      exprIndex += 1;
      try {
        model.expression(name);
      } catch (_) {}
    };

    const playRandomMotion = () => {
      if (typeof model.motion !== "function") return;
      const defs = model?.internalModel?.motionManager?.definitions;
      if (defs && Object.keys(defs).length) {
        const groups = Object.keys(defs);
        const group = groups[0];
        const list = defs[group] || [];
        const index = list.length ? Math.floor(Math.random() * list.length) : 0;
        try {
          model.motion(group, index);
        } catch (_) {}
        return;
      }

      try {
        model.motion("");
      } catch (_) {}
    };

    playExpression();
    playRandomMotion();
    setInterval(playExpression, 18000);
    setInterval(playRandomMotion, 22000);
  });
})();
