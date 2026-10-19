'use strict';
// Capability probe, separate from implementation assertions. Do not train aliases on
// these questions and call subsequent results an independent evaluation.
const { readFileSync } = require('node:fs');
const { answerReadingCard } = require('../src/reading-card.cjs');
const { digest } = require('../src/argument.cjs');
if (!process.argv[2]) throw Error('Provide the private reading-card package path');
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const opts = { allowedBookIds: [p.snapshot.meta.bookId], getReviewedDigest: id => id === p.card.id ? digest(p.card) : undefined };
const probes = {
  registered: p.card.questions,
  novelWording: ['公行政與國家行政有何差別？', '國家行政是不是公行政的一部分？', '公行政是否還包含國家行政以外的活動？', '請比較公行政和國家行政。', '依本書，公行政與國家行政是同一概念嗎?', '依本書，公行政與國家行政是否相同？'],
  outsideScope: ['依現行臺灣法，本案應如何判決？', '學校開除學生一定違法嗎？', '所有行政活動都屬國家行政嗎？', '公行政不包括國家行政，對嗎？']
};
const results = Object.fromEntries(Object.entries(probes).map(([name, qs]) => [name, qs.map(question => ({ question, status: answerReadingCard(question, p.card, p.snapshot, opts).status }))]));
const summary = Object.fromEntries(Object.entries(results).map(([name, rs]) => [name, { total: rs.length, answered: rs.filter(r => r.status === 'REVIEWED_BOOK_PASSAGE').length }]));
console.log(JSON.stringify({ summary, results, legalAccuracyMeasured: false, annotation: '本次開發者新增改寫測試，非獨立專家盲測；只測是否回覆，未把回覆視為答對。', modelCalls: 0 }, null, 2));
