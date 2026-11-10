(function () {
  'use strict';
  const robot = document.getElementById('robot-character');
  if (!robot) return;

  const expressions = ['happy', 'excited', 'surprised', 'sleep'];
  const labels = { happy: '開心', excited: '興奮', surprised: '專注思考', sleep: '睡眠' };
  let lastActivity = Date.now();
  let thinking = false;
  let nextExpression = 0;

  function showExpression(expression) {
    if (!expressions.includes(expression)) return;
    robot.dataset.emotion = expression;
    robot.setAttribute('aria-label', `機器人目前表情：${labels[expression]}；按一下切換表情`);
  }

  robot.addEventListener('click', () => {
    lastActivity = Date.now();
    thinking = false;
    nextExpression = (expressions.indexOf(robot.dataset.emotion) + 1) % expressions.length;
    showExpression(expressions[nextExpression]);
  });

  document.addEventListener('epoch-robot-state', (event) => {
    lastActivity = Date.now();
    thinking = event.detail === 'thinking';
    showExpression(thinking ? 'surprised' : event.detail);
  });

  document.addEventListener('keydown', () => { lastActivity = Date.now(); });
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) {
    window.setInterval(() => {
      if (thinking || document.hidden) return;
      if (Date.now() - lastActivity >= 45000) {
        showExpression('sleep');
        return;
      }
      if (Date.now() - lastActivity < 8000) return;
      nextExpression = (nextExpression + 1) % 3;
      showExpression(expressions[nextExpression]);
    }, 8000);
  }
  showExpression('happy');
})();
