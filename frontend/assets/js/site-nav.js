(() => {
  'use strict';
  if (!document.body.classList.contains('psl-chat-page')) return;
  const viewport = window.visualViewport;
  const root = document.documentElement;
  let frame = 0, baseline = window.innerHeight, width = window.innerWidth;
  let previousHeight = -1, previousTop = -1, previousKeyboard = false;
  function update() {
    frame = 0;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    // A pinch gesture changes visualViewport too; do not treat it as a keyboard.
    if (viewport && Math.abs(viewport.scale - 1) > .03) return;
    if (Math.abs(window.innerWidth - width) > 40) { baseline = window.innerHeight; width = window.innerWidth; }
    const height = Math.round(viewport?.height || window.innerHeight);
    const top = mobile ? Math.max(0, Math.round(viewport?.offsetTop || 0)) : 0;
    const editing = !!document.activeElement?.matches('textarea, input:not([type="checkbox"]), [contenteditable="true"]');
    if (!editing && !previousKeyboard) baseline = Math.max(window.innerHeight, height);
    else baseline = Math.max(baseline, window.innerHeight, height);
    const gap = Math.max(window.innerHeight, baseline) - height;
    const keyboard = mobile && (editing ? gap > 140 : previousKeyboard && gap > 100);
    if (height === previousHeight && top === previousTop && keyboard === previousKeyboard) return;
    root.style.setProperty('--psl-viewport-height', height + 'px');
    root.style.setProperty('--psl-viewport-top', top + 'px');
    document.body.classList.toggle('psl-keyboard-open', keyboard);
    previousHeight = height; previousTop = top; previousKeyboard = keyboard;
    window.dispatchEvent(new CustomEvent('psl:viewport', {detail: {height, top, keyboard}}));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  viewport?.addEventListener('resize', schedule, {passive:true});
  viewport?.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule, {passive:true});
  window.addEventListener('orientationchange', () => { baseline = 0; width = 0; schedule(); });
  window.addEventListener('pageshow', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  schedule();
})();
