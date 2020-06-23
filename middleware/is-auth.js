const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401; // Unauthorized
    throw error;
  }
  const token = authHeader.split(' ')[1];
  try {
    // verify method both decodes token and checks if it's valid
    decodedToken = jwt.verify(token, 'somesupersecretsecret');
  } catch (err) {
    err.statusCode = '500';
    // Since in a middleware, Express error handler will take over
    throw err;
  }
  if (!decodedToken) {
    // If it's undefined (didn't fail technically but token couldn't be verified)
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    throw error;
  }
  // Have valid token that could be decoded. Extract some info from token to store in requests (can access that data since decoded token)
  req.userId = decodedToken.userId;
  next();
};
