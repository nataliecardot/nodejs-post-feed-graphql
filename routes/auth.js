const express = require('express');
const { body } = require('express-validator');

const User = require('../models/user');
const authController = require('../controllers/auth');

const router = express.Router();

// User/auth related routes

// POST or PUT acceptable
router.put(
  '/signup',
  [
    // Look for specific field but in request body only (unlike check, which looks in all features of incoming request [header, cookie, param, etc.])
    body('email')
      .isEmail()
      // Message is stored in Error object that can be retrieved
      .withMessage('Please enter a valid email address.')
      // Check if email address already exists
      // Method found in validator.js docs. validator.js implicitly installed with express-validator
      // Method takes as args a function that retrieves the value that was input, and an object from which we can extract the request. Returns true if validation succeeds, or return a promise if the function returns some async task
      // See https://express-validator.github.io/docs/custom-validators-sanitizers.html
      .custom((value) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            // This will cause validation to fail (all other scenarios will cause it to succeed )
            return Promise.reject('Email already in use.');
          }
        });
      })
      // validator.js built-in sanitizer
      .normalizeEmail(),
    // Adding validation error message as second argument as alternative to using withMessage() after each validator since using message for both checks
    body('password', 'Password must be valid.')
      .trim()
      .isLength({ min: 8 })
      .isAlphanumeric(),
    body('name').trim().not().isEmpty(),
  ],
  authController.signup
);

router.post('/login', authController.login);

module.exports = router;
