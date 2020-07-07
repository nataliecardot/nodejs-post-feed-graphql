const bcrypt = require('bcryptjs');
const validator = require('validator'); // express-validator (used in another project) uses this package behind the scenes
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');
const { clearImage } = require('../util/file');

// Resolvers: Logic that will be executed for incoming queries

// Mutation
module.exports = {
  // args: input (args wil be an object containing all arguments passed to function, userInput field with email, name, password)
  // Pulling out email and name from userInput, which is pulled out of args. So don't need args.userInput.email, etc.
  // Refactored to use ES6 concise method syntax
  async createUser({ userInput: { email, name, password } }, req) {
    // Without ES6 concise method syntax: createUser: async function ({ userInput: { email, name, password } }, req) {
    // userInput because field named that way in schema

    const errors = [];
    if (!validator.isEmail(email)) {
      errors.push({ message: 'Invalid email.' });
    }
    if (
      validator.isEmpty(password) ||
      !validator.isLength(password, { min: 5 })
    ) {
      errors.push({ message: 'Password is too short.' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    // If not using async/await, need to return User.findOne() with then chained on; if you don't return promise in resolver, GraphQL will not wait for it to resolve. But when using async/await, it's returned behind the scenes
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('User exists already.');
      throw error;
    }
    const hashedPw = await bcrypt.hash(password, 12); // 12 salting rounds
    const user = new User({
      email,
      name,
      password: hashedPw,
    });
    const createdUser = await user.save();
    // _doc field: All user data, without metadata added by Mongoose. Overriding id field since must return string, not MongoDB ObjectId
    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },
  // Get both email and password as args (destructuring from args here) since they are defined in login query
  async login({ email, password }) {
    // Find user with corresponding email address and confirm password
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error('User not found.');
      error.code = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error('Incorrect password.');
      error.code = 401;
      throw error;
    }
    // Email exists and password is correct; generate token
    // Data to encode in token is passed to sign() method. Secret is used to sign and verify token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      'somesupersecretsecret',
      { expiresIn: '1h' }
    );
    return { token, userId: user._id.toString() };
  },
  // Will use req to get user data
  async createPost({ postInput: { title, content, imageUrl } }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({
        message:
          'Invalid title. Please ensure a minimum length of 5 characters.',
      });
    }
    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({
        message:
          'Invalid content. Please ensure a minimum length of 5 characters.',
      });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    // userId added to request in middleware/auth.js (extracted from decoded token)
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('Invalid user.');
      error.code = 401;
      throw error;
    }
    const post = new Post({
      title,
      content,
      imageUrl,
      creator: user,
    });
    const createdPost = await post.save();
    user.posts.push(createdPost);
    await user.save();
    // In addition to id, overriding createdAt and updatedAt because these will be stored as date types, which GraphQL doesn't understand
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },
  async posts({ page }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    !page && 1;
    const perPage = 2;
    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate('creator');
    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts,
    };
  },
  async post({ id }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id).populate('creator');
    if (!post) {
      const error = new Error('No post found.');
      error.code = 404;
      throw error;
    }
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },
  async updatePost({ id, postInput: { title, content, imageUrl } }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id).populate('creator');
    if (!post) {
      const error = new Error('No post found.');
      error.code = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized.');
      error.code = 403;
      throw error;
    }
    const errors = [];
    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({
        message:
          'Invalid title. Please ensure a minimum length of 5 characters.',
      });
    }
    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({
        message:
          'Invalid content. Please ensure a minimum length of 5 characters.',
      });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    post.title = title;
    post.content = content;
    if (imageUrl !== 'undefined') {
      post.imageUrl = imageUrl;
    }
    const updatedPost = await post.save();
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },
  async deletePost({ id }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id);
    if (!post) {
      const error = new Error('No post found.');
      error.code = 404;
      throw error;
    }
    // creator is just user's _id because it's stored that way in the post, and not populating creator field here (as done above)
    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized.');
      error.code = 403;
      throw error;
    }
    clearImage(post.imageUrl);
    await Post.findByIdAndRemove(id);
    // Also remove post from associated user document
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();
    return true;
  },
  // Query used to fetch user status
  async user(args, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('No user found.');
      error.code = 404;
      throw error;
    }
    return { ...user._doc, _id: user._id.toString() };
  },
};
