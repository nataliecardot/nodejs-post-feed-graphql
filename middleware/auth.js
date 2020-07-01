const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // token attached to outgoing request in front end (in finishEditHandler, in pages/Feed/Feed.js)
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    req.isAuth = false;
    return next();
  }
  const token = authHeader.split(' ')[1];
  let decodedToken;
  try {
    // verify method both decodes token and checks if it's valid
    decodedToken = jwt.verify(token, 'somesupersecretsecret');
  } catch (err) {
    req.isAuth = false;
    return next();
  }
  // If it's undefined (didn't fail technically but token couldn't be verified)
  if (!decodedToken) {
    req.isAuth = false;
    return next();
  }
  // Have valid token that could be decoded. Extract some info from token to store in requests (can access that data since decoded token)
  req.userId = decodedToken.userId;
  req.isAuth = true;
  next();
};
