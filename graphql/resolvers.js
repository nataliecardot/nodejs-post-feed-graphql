const bcrypt = require('bcryptjs');

const User = require('../models/user');

// Define logic that will be executed for incoming queries
module.exports = {
  // args: input (args wil be an object containing all the arguments passed to function, a userInput field with email, name, password)
  // Here, using destructuring to get userInput out of args object
  // async createUser({ userInput }, req) { // Refactored to use ES6 concise method syntax
  createUser: async function ({ userInput }, req) {
    // .userInput because named the field that way in schema
    // const email = args.userInput.email;
    // const email = userInput.email; // With destructuring
    // If not using async/await, need to return User.findOne() with then chained on; if you don't return promise in resolver, GraphQL will not wait for it to resolve. But when using async/await, it's returned behind the scenes
    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error('User exists already.');
      throw error;
    }
    const hashedPw = await bcrypt.hash(userInput.password, 12); // 12 salting rounds
  },
};
