const STUB = process.env.STUB_MODE === 'true';

const heuristics = [
  { cat: 'billing',  words: ['refund','invoice','charge','payment','card','billing'] },
  { cat: 'tech',     words: ['error','bug','stack','500','crash','login','auth','timeout'] },
  { cat: 'shipping', words: ['delivery','shipment','tracking','package','courier','delayed'] },
];

function classify(text) {
  const t = (text || '').toLowerCase();
  let best = { cat: 'other', score: 0 };
  for (const h of heuristics) {
    const hits = h.words.reduce((a,w)=> a + (t.includes(w) ? 1 : 0), 0);
    if (hits > best.score) best = { cat: h.cat, score: hits };
  }
  const confidence = Math.min(1, best.score / 3 || 0.4);
  return { predictedCategory: best.cat, confidence: Number(confidence.toFixed(2)) };
}

function draft(_text, articles=[]) {
  const lines = [
    `Thanks for reaching out. Here's what might help:`,
    ...articles.map((a,i)=> `${i+1}. ${a.title}`),
    `\nIf this doesn’t resolve it, reply and a human agent will assist.`,
  ];
  const citations = articles.map(a => a._id);
  return { draftReply: lines.join('\n'), citations };
}

module.exports = {
  classify: async (text) => STUB ? classify(text) : classify(text),
  draft:    async (text, articles) => STUB ? draft(text, articles) : draft(text, articles),
  isStub:   STUB
};
