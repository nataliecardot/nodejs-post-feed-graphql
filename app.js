const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { uuid } = require('uuidv4');

// Tells server to load anything in .env file into an environment variable.
require('dotenv').config();

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

const MONGODB_URI =
  // process object is globally available in Node app; part of Node core runtime. The env property contains all environment variables known by process object. Using dotenv to store environment variables. It loads environment variables from .env file into process.env (see https://www.youtube.com/watch?v=17UVejOw3zA)
  `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-4yuid.mongodb.net/${process.env.MONGO_DATABASE_NAME}`;

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
  next();
});

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

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
    const server = app.listen(8080);
    // Exposes a function that requires the created server as an argument. the listen() method above returns a new Node.js server, so storing it in a constant to pass as that argument. Adding parentheses to execute the function that is returned, with server passed to it. This gives us a socket.io object that sets up all the WebSockets stuff behind the scenes
    const io = require('./socket').init(server);
    // Set up event listener to wait for a new connection (whenever a new client connects to server). Execute function that takes client ("socket") that connected as an argument, or to be precise, the connection itself. So a socket is the connection between server and client that connected, and this function will be executed for every new connection
    io.on('connection', (socket) => {
      console.log('Client connected.');
    });
  })
  .catch((err) => console.log(err));
