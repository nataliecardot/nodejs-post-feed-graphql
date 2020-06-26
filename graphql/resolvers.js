const bcrypt = require('bcryptjs');

const User = require('../models/user');

// Define logic that will be executed for incoming queries
module.exports = {
  // async createUser({ userInput }, req) { // Refactored to use ES6 concise method syntax?
  // args: input (args wil be an object containing all the arguments passed to function, a userInput field with email, name, password)
  // Pulling out email and name from userInput, which is pulled out of args. So don't need args.userInput.email, etc.
  createUser: async function ({ userInput: { email, name, password } }, req) {
    // .userInput because named the field that way in schema
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
  },
};
