const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const hashPassword = async (plainPassword) => bcrypt.hash(plainPassword, 10);

const comparePassword = async (plainPassword, passwordHash) => bcrypt.compare(plainPassword, passwordHash);

const signToken = (user) => jwt.sign(
  {
    sub: user.id,
    role: user.role,
    email: user.email
  },
  env.jwtSecret,
  { expiresIn: env.jwtExpiresIn }
);

module.exports = {
  hashPassword,
  comparePassword,
  signToken
};
