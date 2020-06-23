const express = require('express');
const { body } = require('express-validator');

const feedController = require('../controllers/feed');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

// GET /feed/posts
router.get('/posts', isAuth, feedController.getPosts);

// POST /feed/post
router.post(
  '/post',
  isAuth,
  [
    body('title').trim().isLength({ min: 5 }),
    body('content').trim().isLength({ min: 5 }),
  ],
  feedController.createPost
);

router.get('/post/:postId', isAuth, feedController.getPost);

// Editing a post is like replacing old post with a new one; only keeping old ID; PUT method used for replacing a resource
// Can use PUT for async requests triggered by JS, but not through normal forms
router.put(
  '/post/:postId',
  isAuth,
  [
    body('title').trim().isLength({ min: 5 }),
    body('content').trim().isLength({ min: 5 }),
  ],
  feedController.updatePost
);

// For DELETE routes, can't send body, but as with all routes, can encode data in the URL
router.delete('/post/:postId', isAuth, feedController.deletePost);
module.exports = router;
