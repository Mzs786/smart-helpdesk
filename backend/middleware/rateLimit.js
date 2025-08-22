const BUCKET = new Map();
module.exports = function rateLimit({ windowMs = 60000, max = 120 } = {}) {
  return (req,res,next)=>{
    const now = Date.now();
    const key = req.ip || 'global';
    const hits = (BUCKET.get(key) || []).filter(t => now - t < windowMs);
    hits.push(now);
    BUCKET.set(key, hits);
    if (hits.length > max) return res.status(429).json({ error: 'Too many requests' });
    next();
  };
};
