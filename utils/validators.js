const validator = require('validator');
const { check, validationResult } = require('express-validator');

const validateRegistration = [
  check('email')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  check('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain a number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain a letter'),
  check('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
];

const validateLogin = [
  check('email')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  check('password')
    .not().isEmpty().withMessage('Password is required')
];

const validateEmployee = [
  check('firstName').not().isEmpty().withMessage('First name is required'),
  check('lastName').not().isEmpty().withMessage('Last name is required'),
  check('email').isEmail().withMessage('Please enter a valid email'),
  check('dateOfBirth').isDate().withMessage('Invalid date format'),
  check('positionId').not().isEmpty().withMessage('Position is required'),
  check('department').not().isEmpty().withMessage('Department is required')
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateEmployee,
  validationResult
};