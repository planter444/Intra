const userModel = require('../models/userModel');
const { comparePassword, signToken } = require('../services/authService');
const { logAction } = require('../services/auditService');
const { getSystemSettings } = require('../services/settingsService');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await userModel.findByEmail(email);

    if (!user || user.isDeleted) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const passwordMatches = await comparePassword(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const updatedUser = await userModel.update(user.id, { lastLoginAt: new Date() });
    const token = signToken(updatedUser);
    const settings = await getSystemSettings();

    await logAction({
      actorUserId: updatedUser.id,
      actorRole: updatedUser.role,
      action: 'LOGIN',
      entityType: 'auth',
      entityId: String(updatedUser.id),
      description: `${updatedUser.fullName} logged into the HRMS.`,
      metadata: { email: updatedUser.email },
      ipAddress: req.ip
    });

    return res.json({
      token,
      user: updatedUser,
      settings
    });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const settings = await getSystemSettings();
    res.json({ user: req.user, settings });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  me
};
