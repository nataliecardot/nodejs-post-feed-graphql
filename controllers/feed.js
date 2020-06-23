const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator');

const io = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');

// Note: Starting with Node.js v 14.3.0, released 5/20, you can use await keyword outside of an asynchronous function, without async, a feature called top-level await. await a promise in top level of script, not inside of a function. Previously always needed async function around await. But if you are using it inside of a function, still need async

// Note: Mongoose operations don't actually return a promise, but a promise-like object with which you can use then/catch or async/await. You could use a real promise by chaining .exec() after all Mongoose operation (for example .find().countDocuments().exec()). But promise-like object behaves the same way so not necessary. When hashing password with bcrypt library, however, you do get a real promise
exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  let totalItems;
  // Behind the scenes, async/await is converted to then/catch. Async/await makes async code appear synchronous for better readibility. So can use try/catch instead of then/catch
  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate('creator')
      // Descending
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // Note using destructuring in json method (e.g., post instead of posts: posts)
    res
      .status(200)
      .json({ message: 'Fetched posts successfully.', posts, totalItems });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    // Can't throw error since in async code/catch block of promise chain (if you throw error inside of then block, the subsequent catch block will be reached, and that error will be passed as an error to the catch block). Passing err to next() reaches next error handling Express middleware
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed; entered data is incorrect.');
    error.statusCode = 422;
    // Since not in async code, automatically exits function execution and instead tries to reach next error handling middleware provided in Express application
    throw error;
  }
  if (!req.file) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }
  const imageUrl = req.file.path.replace('\\', '/');
  const { title, content } = req.body;
  const post = new Post({
    title,
    content,
    imageUrl,
    // userId was stored in request object, extracted from decoded token in is-auth middleware
    // Will be a string, not an ObjectId, but Mongoose converts it behind the scenes
    creator: req.userId,
  });
  try {
    await post.save();
    const user = await User.findById(req.userId);
    user.posts.push(post);
    await user.save();
    // socket.io emit method sends message to all connected clients/users, while broadcast sends to all users except the one from which request was sent. First arg is event name (arbitrary), second is data you want to send. action key: what happened ('channel' is posts), and post created is saved in post key
    // user.name can be used because fetching user above, which will be an object which also has a name
    io.getIO().emit('posts', {
      action: 'create',
      post: { ...post._doc, creator: { _id: req.userId, name: user.name } },
    });
    res.status(201).json({
      message: 'Post created successfully!',
      post,
      creator: { _id: user._id, name: user.name },
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ message: 'Post fetched.', post });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  const postId = req.params.postId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed; entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }
  const { title, content } = req.body;
  // Two options when updated: 1) (default) imageUrl is part of incoming request and it's just some text in request body. That would be the case if no new file was added; then front end code has logic to keep existing URL 2) picked file; req.file would be set
  let imageUrl = req.body.image;
  if (req.file) {
    imageUrl = req.file.path.replace('\\', '/');
  }
  if (!imageUrl) {
    const error = new Error('No image file added.');
    error.statusCode = 422;
    throw error;
  }
  try {
    // .populate('creator') - populate 'creator' field with full user data. Takes creator id which was stored in post object, reaches out to users collection, fetches data corresponding to that user id, and adds it in the post
    const post = await Post.findById(postId).populate('creator');
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error('Not authorized!');
      error.statusCode = 403; // Forbidden (see https://dev.to/adarshkkumar/http-status-401-vs-403-2c59)
      throw error;
    }
    if (imageUrl !== post.imageUrl) {
      // clearImage is utility function defined in this file
      clearImage(post.imageUrl);
    }
    post.title = title;
    post.imageUrl = imageUrl;
    post.content = content;
    const result = await post.save();
    io.getIO().emit('posts', { action: 'update', post: result });
    res.status(200).json({ message: 'Post updated!', post: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    // Verify that post author is same as logged-in user
    if (post.creator.toString() !== req.userId) {
      const error = new Error('Not authorized!');
      error.statusCode = 403;
      throw error;
    }
    // Check logged in user
    clearImage(post.imageUrl);
    await Post.findByIdAndRemove(postId);

    // Clear relation between user and post (i.e., post id stored in user collection)
    const user = await User.findById(req.userId);
    user.posts.pull(postId);
    await user.save();
    // emit event to the posts channel now that done deleting. Keep pattern of what happened to post inside data package being emitted
    io.getIO().emit('posts', { action: 'delete', post: postId });
    res.status(200).json({ message: 'Deleted post.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, (err) => console.log(err));
};
