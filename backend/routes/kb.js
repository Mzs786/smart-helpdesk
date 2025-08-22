const express = require('express');
const Article = require('../models/Article');
const router = express.Router();

router.get('/', async (req,res)=>{
  const q = (req.query.query || '').trim();
  if (!q) {
    const items = await Article.find({ status: 'published' }).limit(20).sort({ updatedAt: -1 });
    return res.json({ success:true, items });
  }
  const regs = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const items = await Article.find({
    status: 'published',
    $or: [{title: regs},{body: regs},{tags: regs}]
  }).limit(20);
  res.json({ success:true, items });
});

module.exports = router;
