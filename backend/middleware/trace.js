const { v4: uuid } = require('uuid');
module.exports = function trace(req,res,next){
  req.requestId = req.headers['x-request-id'] || uuid();
  res.setHeader('x-request-id', req.requestId);
  next();
};
