const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const graphqlHttp = require('express-graphql');
const { uuid } = require('uuidv4');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const { clearImage } = require('./util/file');

// Tells server to load anything in .env file into an environment variable
require('dotenv').config();

const MONGODB_URI =
  // process object is globally available in Node app; part of Node core runtime. env property contains all environment variables known by process object. Using dotenv to store environment variables. It loads environment variables from .env file into process.env (see https://www.youtube.com/watch?v=17UVejOw3zA)
  `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-4yuid.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}?retryWrites=true`;

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // First arg is for error message to throw to inform multer something is wrong with incoming file and it should not store it; with null, telling multer okay to store it
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, uuid());
  },
});

const fileFilter = (req, file, cb) => {
  file.mimetype === 'image/png' ||
  file.mimetype === 'image/jpg' ||
  file.mimetype === 'image/jpeg'
    ? // Second arg is whether file should be stored
      cb(null, true)
    : cb(null, false);
};

// Middleware needed to parse incoming JSON data so can extract it on the request body (body parser adds body field on incoming request)
// app.use(bodyParser.urlencoded()); // For x-www-form-urlencoded, default format for data sent via form post request
app.use(bodyParser.json()); // application/json
// .single('image')) informs multer will extract single file stored in field named image in incoming requests
app.use(multer({ storage: fileStorage, fileFilter }).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Set CORS headers to bypass CORS error, a default security mechanism set by browsers that occurs when the server-side web API (the back end, which has the API endpoints, the path and method, and defines the logic that should execute on the server when a request reaches them) and client (front end) are on different servers/domains and try to exchange data
app.use((req, res, next) => {
  // Allow data/content to be accessed by specific origins/clients (all in this case)
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Allow these origins to use specific HTTP methods
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  );
  // Headers clients can use on requests
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Prevents error. Browser automatically sends an OPTIONS request (determines whether follow-up request is needed) before POST, PATCH, PUT, DELETE, etc., but GraphQL automatically declines anything other than a POST or GET request
  if (req.method === 'OPTIONS') {
    // Returning so OPTIONS requests never make it to GraphQL endpoint but still get a valid response
    // sendStatus [Express convenience method] is equivalent to res.status(200).send('OK') [in addition to sending simple string response, send() automatically closes connection]
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

// Could also use POST, but replacing image so PUT more appropriate
app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    throw new Error('Not authenticated.');
  }
  // When file is uploaded, multer extracts file and populates file object with info about the extracted file
  if (!req.file) {
    return res.status(200).json({ message: 'No file provided' });
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }
  return (
    res
      .status(201)
      // req.file.path is where multer stores image. Can then be used in front end
      .json({ message: 'File stored.', filePath: req.file.path })
  );
});

app.use(
  '/graphql',
  graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    // Gives you a special tool -- if you go to localhost:8080/graphql, sends a GET request, and you get a special screen to play around with your GraphQL API. This is why not listening to POST requests only
    graphiql: true,
    // Receives error detected by GraphQL and allows you to return your own format
    customFormatErrorFn(err) {
      // Original error: thrown in code by you or third-party package (not a technical error)
      if (!err.originalError) {
        return err;
      }
      // Extract useful info from original error that can use in other places
      // data property of error object holds errors array; set in resolver (more specific error message(s))
      const data = err.originalError.data;
      // General error message
      const message = err.message || 'An error occurred.';
      const code = err.originalError.code || 500;
      return { message, status: code, data };
    },
  })
);

// Executed whenever an error is thrown (in sync code) or forwarded (in async code) with next()
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  // message property exists by default and holds message passed to constructor of error object
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message, data });
});

mongoose
  .connect(MONGODB_URI, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
  .then((result) => {
    // Hosting provider automatically injects port environment variable
    app.listen(process.env.PORT || 8080);
  })
  .catch((err) => console.log(err));
