(function(){
  'use strict';

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const inline = text => text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g).map(part => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return '<strong>' + escape(part.slice(2,-2)) + '</strong>';
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return '<em>' + escape(part.slice(1,-1)) + '</em>';
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return '<code>' + escape(part.slice(1,-1)) + '</code>';
    return escape(part);
  }).join('');

  function classify(line){
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) return { type: heading[1].length > 2 ? 'h3' : 'h2', text: heading[2] };
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) return { type: 'ul', text: bullet[1] };
    const step = /^([0-9]{1,4})\.\s+(.+)$/.exec(line);
    if (step) return { type: 'ol', text: step[2], start: Number(step[1]) };
    const note = /^>\s*(.+)$/.exec(line);
    if (note) return { type: 'blockquote', text: note[1] };
    return { type: line ? 'p' : '', text: line };
  }

  function render(text){
    const output = [];
    let group = [];
    function flush(){
      if (!group.length) return;
      const { type, start } = group[0];
      const list = type === 'ul' || type === 'ol';
      const content = list
        ? group.map(line => '<li>' + inline(line.text) + '</li>').join('')
        : group.map(line => inline(line.text)).join('<br>');
      const attrs = type === 'ol' && start > 1 ? ' start="' + start + '"' : '';
      output.push('<' + type + attrs + '>' + content + '</' + type + '>');
      group = [];
    }
    for (const line of String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map(value => classify(value.trim()))) {
      if (!line.type || line.type !== group[0]?.type || /^h[23]$/.test(line.type)) flush();
      if (line.type) group.push(line);
    }
    flush();
    return output.join('');
  }

  window.PSLChatFormat = Object.freeze({ render });
})();
