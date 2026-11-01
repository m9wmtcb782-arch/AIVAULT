// node tests/collab-festival-dates.test.js — 驗證 2026、2027 節慶判斷（Asia/Taipei，內建 Intl 農曆）
global.window = {}; global.location = { search: '?festival=none' }; global.document = { body: null, addEventListener() {} };
eval(require('fs').readFileSync(require('path').join(__dirname, '..', 'aivault-collab-festival.js'), 'utf8'));
const exp = { '2026-10-31': 'halloween', '2026-02-16': 'lunarnewyear', '2026-02-21': 'lunarnewyear', '2026-02-22': null, '2026-06-19': 'dragonboat', '2026-09-25': 'midautumn', '2026-11-01': null,
  '2027-10-31': 'halloween', '2027-02-05': null, '2027-02-06': 'lunarnewyear', '2027-02-11': 'lunarnewyear', '2027-02-12': null, '2027-06-09': 'dragonboat', '2027-09-15': 'midautumn' };
let bad = 0; for (const [d, e] of Object.entries(exp)) { const g = window.AIVAULT_festivalFor(new Date(d + 'T12:00:00+08:00')); console.log(g === e ? 'ok ' : 'FAIL', d, g); if (g !== e) bad++; }
process.exit(bad ? 1 : 0);
