/* ==========================================================
   ライブ情報の「書き方をそろえる」しくみ（live.html と index.html の NEXT LIVE で共通）
   microCMS に、どんな書き方で入れても、表示を同じ形にそろえる。
   ========================================================== */
(function () {
  var WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];
  var WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  /* ── 書き方をそろえる ──────────────────────────────────
     microCMS に、どんな書き方で入れても、表示は同じ形にそろえる。
       日付：2026.10.10 (土)
         「2026/10/10」「2026-10-10」「2026年10月10日（土）」「２０２６．１０．１０」
         「二〇二六年十月十日」「令和8年10月10日」「R8.10.10」「26.10.10」も読める。
         西暦がない「10/10」「十月十日」は、今日にいちばん近い年とみなす。
       会場・詳細：全角の英数字・記号は半角に（￥→¥、～→〜）
       詳細：開場・OPEN・オープン → open、開演・START・スタート → start、
             「18時」「十八時」→ 18:00、「18時半」→ 18:30、「open18:00start19:00」→ open 18:00 / start 19:00、
             「2500円」「¥2500」→ ¥2,500、「+1D」「＋1ドリンク」→ + 1drink
     ────────────────────────────────────────────────── */
  var KANJI_DIGIT = { '〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  var KANJI_NUM = /[〇零一二三四五六七八九十百千]+/g;

  // 漢数字を数字に（「十八」→18、「二十一」→21、「二〇二六」→2026）
  function kanjiToNumber(k) {
    if (!/[十百千]/.test(k)) {
      return k.split('').map(function (c) { return KANJI_DIGIT[c]; }).join('');
    }
    var total = 0, cur = 0;
    k.split('').forEach(function (c) {
      if (c in KANJI_DIGIT) cur = KANJI_DIGIT[c];
      else {
        var unit = c === '十' ? 10 : c === '百' ? 100 : 1000;
        total += (cur || 1) * unit; cur = 0;
      }
    });
    return String(total + cur);
  }

  // 全角の英数字・記号を半角に
  function toHalfWidth(str) {
    if (!str) return '';
    return String(str)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')   // 見えない文字（コピーしたときにまざる）を消す
      .replace(/～/g, '〜')   // 全角の波線だけ「〜」に（リンクの中の半角 ~ は、そのまま）
      .replace(/[！-｝]/g, function (s) { return String.fromCharCode(s.charCodeAt(0) - 0xfee0); })
      .replace(/￥/g, '¥').replace(/[−‐]/g, '-');   // 飾りの線「―」は、そのまま
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  // 日付を読み取る
  function parseDate(raw) {
    var s = toHalfWidth(raw)
      .replace(KANJI_NUM, kanjiToNumber)
      .replace(/\([^)]*\)/g, ' ')                  // (土) などの曜日は無視（あとで計算する）
      .replace(/[日月火水木金土]曜日?/g, ' ')
      .replace(/(令和|R)\s*(元|\d{1,2})\s*[年.\/-]/i, function (_, e, n) { return (2018 + (n === '元' ? 1 : +n)) + '.'; })
      .replace(/[年月\/\-、・\s]+/g, '.').replace(/日/g, '')
      .replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
    var y, mo, d, m = s.match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})/);
    if (m) {
      y = +m[1]; mo = +m[2]; d = +m[3];
      if (y < 100) y += 2000;
    } else if ((m = s.match(/^(\d{1,2})\.(\d{1,2})$/))) {
      // 西暦がないときは、今日にいちばん近い年
      mo = +m[1]; d = +m[2];
      var today = new Date(), best = null;
      [-1, 0, 1].forEach(function (k) {
        var yy = today.getFullYear() + k, diff = Math.abs(new Date(yy, mo - 1, d) - today);
        if (best === null || diff < best.diff) best = { y: yy, diff: diff };
      });
      y = best.y;
    }
    var day = y ? new Date(y, mo - 1, d) : null;
    if (!day || day.getMonth() !== mo - 1 || day.getDate() !== d) return { text: toHalfWidth(raw), end: null };
    var ymd = y + '.' + pad2(mo) + '.' + pad2(d);
    return {
      year: y, month: mo, day: d, ymd: ymd,
      text: ymd + ' (' + WEEK_JA[day.getDay()] + ')',
      week: WEEK_EN[day.getDay()],
      end: new Date(y, mo - 1, d, 23, 59, 59)
    };
  }

  // 前売りの案内（nakayamadaishi.com と同じ決まり）
  function statusOf(d) {
    if (!d.end) return '';
    var now = new Date();
    var start = new Date(d.year, d.month - 1, d.day, 0, 0, 0);
    var cutoff = new Date(d.year, d.month - 1, d.day, 15, 0, 0);
    if (now < start) return '前売り予約受付中';
    if (now < cutoff) return '当日15時までなら前売り予約受付中';
    if (now <= d.end) return '飛び込みOK';
    return '';
  }

  function withComma(n) { return String(n).replace(/,/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  // 会場：全角の英数字・記号を半角に
  function formatPlace(raw) {
    return toHalfWidth(raw).replace(/[ \t\u3000]+/g, ' ').trim();   // 全角の空白も半角に
  }

  // 詳細：時間・料金・open/start の書き方をそろえる
  function formatDetail(raw) {
    return toHalfWidth(raw)
      .replace(/([〇零一二三四五六七八九十百千]+)(?=[時分円])/g, kanjiToNumber)
      // 時間
      .replace(/(\d{1,2})時半/g, '$1:30')
      .replace(/(\d{1,2})時(\d{1,2})分?/g, function (_, h, mi) { return h + ':' + pad2(mi); })
      .replace(/(\d{1,2})時/g, '$1:00')
      .replace(/(\d{1,2}):(\d{2})/g, function (_, h, mi) { return (+h) + ':' + mi; })
      // open / start
      .replace(/開場|オープン(?=\s*:?\s*\d)/g, 'open')
      .replace(/開演|スタート(?=\s*:?\s*\d)/g, 'start')
      .replace(/(^|[^a-zA-Z])(open|start)(?![a-zA-Z])/gi, function (_, p, w) { return p + w.toLowerCase(); })
      .replace(/(open|start)\s*:?\s*(?=\d)/g, '$1 ')
      .replace(/(open \d{1,2}:\d{2})\s*[\/・,、|]?\s*(start)/g, '$1 / $2')
      .replace(/open\s*[\/・]\s*start\s*:?\s*(\d{1,2}:\d{2})\s*[\/・]\s*(\d{1,2}:\d{2})/g, 'open $1 / start $2')
      // 料金
      .replace(/¥\s*(\d[\d,]*)/g, function (_, n) { return '¥' + withComma(n); })
      .replace(/(\d[\d,]*)\s*円/g, function (_, n) { return '¥' + withComma(n); })
      .replace(/\s*\+\s*(\d)\s*(ドリンク|drink|D)(?![a-zA-Z])/gi, ' + $1drink')
      .replace(/(\d)\s*ドリンク/g, '$1drink')
      .replace(/\(\s+/g, '(')
      // 余分な空白
      .split('\n').map(function (l) { return l.replace(/[ \t]+/g, ' ').trim(); }).join('\n').trim();
  }

  window.LiveFormat = { parseDate: parseDate, formatDetail: formatDetail, formatPlace: formatPlace, statusOf: statusOf };
})();
