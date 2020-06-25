// Define logic that will be executed for incoming queries
module.exports = {
  hello() {
    return {
      // On the server GraphQL filters out just the data requested by client
      text: 'Hello world!',
      views: 1245,
    };
  },
};
