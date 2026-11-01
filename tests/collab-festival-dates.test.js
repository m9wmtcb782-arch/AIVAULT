global.window={};global.location={search:'?festival=none'};global.URLSearchParams=URLSearchParams;
eval(require('fs').readFileSync(require('path').join(__dirname,'..','aivault-collab-festival.js'),'utf8'));
const f=window.AIVAULT_festivalFor;
for(const d of ['2026-10-31','2026-02-16','2026-02-17','2026-02-21','2026-02-22','2026-06-19','2026-09-25','2026-11-01','2027-10-31','2027-02-05','2027-02-06','2027-02-10','2027-02-11','2027-06-09','2027-09-15'])console.log(d,f(new Date(d+'T12:00:00+08:00')));
