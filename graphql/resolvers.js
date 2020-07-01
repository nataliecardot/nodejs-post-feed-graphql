const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');

module.exports = {
  async createUser({ userInput: { email, name, password } }, req) {
    //   const email = args.userInput.email;
    const errors = [];
    if (!validator.isEmail(email)) {
      errors.push({ message: 'E-Mail is invalid.' });
    }
    if (
      validator.isEmpty(password) ||
      !validator.isLength(password, { min: 5 })
    ) {
      errors.push({ message: 'Password too short!' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      const error = new Error('User exists already!');
      throw error;
    }
    const hashedPw = await bcrypt.hash(password, 12);
    const user = new User({
      email,
      name,
      password: hashedPw,
    });
    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },
  async login({ email, password }) {
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error('User not found.');
      error.code = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error('Password is incorrect.');
      error.code = 401;
      throw error;
    }
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
  async createPost({ postInput: { title, content, imageUrl } }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({ message: 'Title is invalid.' });
    }
    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({ message: 'Content is invalid.' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }
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
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },
  async posts(args, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find().sort({ createdAt: -1 }).populate('creator');
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
};

// My code. Replaced with provided code since it wasn't working, couldn't figure out the problem

// const bcrypt = require('bcryptjs');
// const validator = require('validator'); // express-validator (used in another project) uses this package behind the scenes
// const jwt = require('jsonwebtoken');

// const User = require('../models/user');
// const Post = require('../models/post');

// // Resolvers: Logic that will be executed for incoming queries

// // Mutation
// module.exports = {
//   // args: input (args wil be an object containing all the arguments passed to function, a userInput field with email, name, password)
//   // Pulling out email and name from userInput, which is pulled out of args. So don't need args.userInput.email, etc.
//   // Refactored to use ES6 concise method syntax
//   createUser: async function ({ userInput: { email, name, password } }, req) {
//     // Without ES6 concise method syntax: createUser: async function ({ userInput: { email, name, password } }, req) {
//     // userInput because field named that way in schema

//     const errors = [];
//     if (!validator.isEmail(email)) {
//       errors.push({ message: 'Invalid email.' });
//     }
//     if (
//       validator.isEmpty(password) ||
//       !validator.isLength(password, { min: 5 })
//     ) {
//       errors.push({ message: 'Password is too short.' });
//     }
//     if (errors.length > 0) {
//       const error = new Error('Invalid input.');
//       error.data = errors;
//       error.code = 422;
//       throw error;
//     }
//     // If not using async/await, need to return User.findOne() with then chained on; if you don't return promise in resolver, GraphQL will not wait for it to resolve. But when using async/await, it's returned behind the scenes
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       const error = new Error('User exists already.');
//       throw error;
//     }
//     const hashedPw = await bcrypt.hash(password, 12); // 12 salting rounds
//     console.log(email);
//     const user = new User({
//       email,
//       name,
//       password: hashedPw,
//     });
//     const createdUser = await user.save();
//     // _doc field: All the user data, without all the metadata added by Mongoose. Overriding id field since must return string, not MongoDB ObjectId
//     return { ...createdUser._doc, _id: createdUser._id.toString() };
//   },
//   // Get both email and password as args (destructuring from args here) since they are defined in login query
//   login: async function ({ email, password }) {
//     // Find user with corresponding email address and confirm password
//     const user = await User.findOne({ email });
//     if (!user) {
//       const error = new Error('User not found.');
//       error.code = 401;
//       throw error;
//     }
//     const isEqual = await bcrypt.compare(password, user.password);
//     if (!isEqual) {
//       const error = new Error('Incorrect password.');
//       error.code = 401;
//       throw error;
//     }
//     // Email exists and password is correct; generate token
//     // Data to encode in token is passed to sign() method. Secret is used to sign and verify token
//     const token = jwt.sign(
//       {
//         userId: user._id.toString(),
//         email: user.email,
//       },
//       'somesupersecretsecret',
//       { expiresIn: '1h' }
//     );
//     return { token, userId: user._id.toString() };
//   },
//   // Will use req to get user data
//   createPost: async function (
//     { postInput: { title, content, imageUrl } },
//     req
//   ) {
//     if (!req.isAuth) {
//       const error = new Error('Not authenticated.');
//       error.code = 401;
//       throw error;
//     }
//     const errors = [];
//     if (
//       validator.isEmpty(postInput.title) ||
//       !validator.isLength(postInput.title, { min: 5 })
//     ) {
//       errors.push({
//         message:
//           'Invalid title. Please ensure a minimum length of 5 characters.',
//       });
//     }
//     if (
//       validator.isEmpty(postInput.content) ||
//       !validator.isLength(postInput.content, { min: 5 })
//     ) {
//       errors.push({
//         message:
//           'Invalid content. Please ensure a minimum length of 5 characters.',
//       });
//     }
//     if (errors.length > 0) {
//       const error = new Error('Invalid input.');
//       error.data = errors;
//       error.code = 422;
//       throw error;
//     }
//     // userId added to request in middleware/auth.js (extracted from decoded token)
//     const user = await User.findById(req.userId);
//     if (!user) {
//       const error = new Error('Invalid user.');
//       error.code = 401;
//       throw error;
//     }
//     console.log(title);
//     const post = new Post({
//       title,
//       content,
//       imageUrl,
//       creator: user,
//     });
//     const createdPost = await post.save();
//     user.posts.push(createdPost);
//     await user.save();
//     // In addition to id, overriding createdAt and updatedAt because these will be stored as date types, which GraphQL doesn't understand
//     return {
//       ...createdPost._doc,
//       _id: createdPost._id.toString(),
//       createdAt: createdPost.createdAt.toISOString(),
//       updatedAt: createdPost.updatedAt.toISOString(),
//     };
//   },
//   posts: async function (args, req) {
//     if (!req.isAuth) {
//       const error = new Error('Not authenticated!');
//       error.code = 401;
//       throw error;
//     }
//     const totalPosts = await Post.find().countDocuments();
//     const posts = await Post.find().sort({ createdAt: -1 }).populate('creator');
//     return {
//       posts: posts.map((p) => {
//         return {
//           ...p._doc,
//           _id: p._id.toString(),
//           createdAt: p.createdAt.toISOString(),
//           updatedAt: p.updatedAt.toISOString(),
//         };
//       }),
//       totalPosts,
//     };
//   },
// };
