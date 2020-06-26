// Define logic that will be executed for incoming queries
module.exports = {
  // args: input (args wil be an object containing all the arguments passed to function, a userInput field with email, name, password)
  // Here, using destructuring to get userInput out of args object
  createUser({ userInput }, req) {
    // .userInput because named the field that way in schema
    // const email = args.userInput.email;
    const email = userInput.email;
  },
};
