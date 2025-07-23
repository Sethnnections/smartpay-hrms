const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

const generatePasswordHash = async (password) => {
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.PASSWORD_SALT_ROUNDS) || 12);
    return await bcrypt.hash(password, salt);
  } catch (err) {
    logger.error('Error generating password hash:', err);
    throw err;
  }
};

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'your_jwt_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

const formatDate = (date) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(date).toLocaleDateString('en-US', options);
};

const calculateAge = (birthDate) => {
  const diff = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

module.exports = {
  generatePasswordHash,
  generateToken,
  formatDate,
  calculateAge
};