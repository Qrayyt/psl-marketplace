(() => {
  'use strict';
  // Keep the chat composer above the software keyboard; restore tabs when it closes.
  if (!document.body.classList.contains('psl-chat-page') || !window.visualViewport) return;
  const viewport = window.visualViewport;
  function updateViewport() {
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const editing = document.activeElement?.matches('textarea, input, [contenteditable="true"]');
    const keyboard = mobile && editing && window.innerHeight - viewport.height > 120;
    document.body.classList.toggle('psl-keyboard-open', !!keyboard);
    document.documentElement.style.setProperty('--psl-viewport-height', viewport.height + 'px');
  }
  viewport.addEventListener('resize', updateViewport);
  window.addEventListener('resize', updateViewport);
  document.addEventListener('focusin', updateViewport);
  document.addEventListener('focusout', () => requestAnimationFrame(updateViewport));
  updateViewport();
})();
