const Article = require('../models/Article');

module.exports.searchTop = async (query, limit = 3) => {
  if (!query || !query.trim()) return [];
  const q = query.trim();
  const regs = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const results = await Article.find({
    status: 'published',
    $or: [{ title: regs }, { body: regs }, { tags: regs }]
  }).lean();

  const scored = results.map(a => {
    const titleHit = regs.test(a.title) ? 2 : 0;
    const tagHit = (a.tags || []).some(t => regs.test(t)) ? 1 : 0;
    const bodyHit = regs.test(a.body || '') ? 0.5 : 0;
    return { article: a, score: titleHit + tagHit + bodyHit };
  }).sort((a,b)=> b.score - a.score);

  return scored.slice(0, limit).map(s => s.article);
};
