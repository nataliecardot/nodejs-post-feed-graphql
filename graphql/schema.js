// This file will define queries, mutations, and types in GraphQL service
const { buildSchema } = require('graphql');

// Exclamation mark makes it required
module.exports = buildSchema(`
  type TestData {
    text: String!
    views: Int!
  }

  type RootQuery {
    hello: TestData!
  }

  schema {
    query: RootQuery
  }
`);
