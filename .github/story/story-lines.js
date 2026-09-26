/* ==========================================================
   ストーリー画像で使う、ライブの「詳細」を行に分けるしくみ（story.html と month.html で共通）
   ・段落（Enter）も、段落の中の改行（Shift+Enter）も、1行ずつに分ける
   ・「出演」の行は、名前を「、」でつないで1行にする
   ========================================================== */
window.storyLines = function (detailHtml) {
  var html = String(detailHtml || '').replace(/<br\s*\/?>/gi, '\u2028');
  var paras = html.split(/<\/p>/i).map(function (p) {
    var tmp = document.createElement('div');
    tmp.innerHTML = p;
    return tmp.textContent.replace(/[\u200b\u00a0]/g, function (c) { return c === '\u00a0' ? ' ' : ''; });
  });

  var lines = [];
  var cast = null;   // 「出演」の名前を集めているところ
  paras.forEach(function (p) {
    var parts = p.split(/[\u2028\n]/).map(function (s) { return LiveFormat.formatDetail(s); }).filter(Boolean);
    parts.forEach(function (s, i) {
      var m = s.match(/^出演\s*[:：]?\s*(.*)$/);
      if (m) {
        cast = m[1] ? [m[1]] : [];
        lines.push(cast);
      } else if (cast && (cast.length === 0 || i > 0)) {
        cast.push(s);   // 「出演」のすぐ後、または同じ段落の続きは、名前として集める
      } else {
        cast = null;
        lines.push(s);
      }
    });
    if (cast && cast.length) cast = null;   // 段落が変わったら、名前集めは終わり
  });

  return lines.map(function (l) {
    if (!Array.isArray(l)) return l;
    // 名前の前後の「、」を取ってから、「、」でつなぎ直す（「、」が二重にならないように）
    var names = l.join('、').split(/[、,]/).map(function (n) { return n.trim(); }).filter(Boolean);
    return '出演: ' + names.join('、');
  });
};
