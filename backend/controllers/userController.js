const userModel = require('../models/userModel');
const leaveModel = require('../models/leaveModel');
const { comparePassword, hashPassword } = require('../services/authService');
const { logAction } = require('../services/auditService');

const allowedRoles = ['employee', 'supervisor', 'admin', 'ceo', 'hr'];
const allowedGenders = ['male', 'female', 'other'];

const canManageUser = (currentUser, targetUserId) => {
  if (currentUser.role === 'admin' || currentUser.role === 'hr' || currentUser.role === 'ceo') {
    return true;
  }

  return String(currentUser.id) === String(targetUserId);
};

const canViewUser = async (currentUser, targetUserId) => {
  if (canManageUser(currentUser, targetUserId)) {
    return true;
  }

  if (currentUser.role !== 'supervisor') {
    return false;
  }

  const targetUser = await userModel.findById(targetUserId);
  return Boolean(targetUser && String(targetUser.supervisorId) === String(currentUser.id));
};

const listUsers = async (req, res, next) => {
  try {
    const users = await userModel.listAll({
      includeDeleted: req.user.role === 'admin' && req.query.includeDeleted === 'true',
      role: req.query.role,
      departmentId: req.query.departmentId,
      supervisorId: req.user.role === 'supervisor' ? req.user.id : req.query.supervisorId,
      search: req.query.search
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!(await canViewUser(req.user, id))) {
      return res.status(403).json({ message: 'You do not have permission to view this profile.' });
    }

    const user = await userModel.findById(id);
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const leaveBalances = await leaveModel.getBalancesForUser(id);
    res.json({ user, leaveBalances });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { employeeNo, firstName, lastName, email, phone, role, gender, departmentId, supervisorId, positionTitle, password } = req.body;

    if (!firstName || !lastName || !email || !role || !password) {
      return res.status(400).json({ message: 'Names, email, role, and password are required.' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Selected role is invalid.' });
    }

    if (gender && !allowedGenders.includes(gender)) {
      return res.status(400).json({ message: 'Selected gender is invalid.' });
    }

    if (phone && !/^\d+$/.test(String(phone))) {
      return res.status(400).json({ message: 'Phone number must contain digits only.' });
    }

    if (supervisorId) {
      const supervisor = await userModel.findById(supervisorId);
      if (!supervisor || supervisor.isDeleted) {
        return res.status(400).json({ message: 'Selected supervisor was not found.' });
      }
    }

    const passwordHash = await hashPassword(password);
    const user = await userModel.create({
      employeeNo: employeeNo || null,
      firstName,
      lastName,
      email,
      phone,
      role,
      gender: gender || null,
      departmentId: departmentId || null,
      supervisorId: supervisorId || null,
      positionTitle,
      passwordHash
    });

    await leaveModel.ensureLeaveBalancesForAllUsers();

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_CREATE',
      entityType: 'user',
      entityId: String(user.id),
      description: `${req.user.fullName} created user ${user.fullName}.`,
      metadata: { createdRole: user.role, email: user.email },
      ipAddress: req.ip
    });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!canManageUser(req.user, id)) {
      return res.status(403).json({ message: 'You do not have permission to update this profile.' });
    }

    const target = await userModel.findById(id);
    if (!target || target.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isManager = req.user.role === 'admin' || req.user.role === 'ceo';
    const payload = isManager
      ? {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        positionTitle: req.body.positionTitle,
        gender: req.body.gender
      }
      : {
        phone: req.body.phone
      };

    if (isManager) {
      if (req.body.supervisorId && String(req.body.supervisorId) === String(id)) {
        return res.status(400).json({ message: 'A user cannot be assigned as their own supervisor.' });
      }

      if (req.body.phone && !/^\d+$/.test(String(req.body.phone))) {
        return res.status(400).json({ message: 'Phone number must contain digits only.' });
      }

      if (req.body.supervisorId) {
        const supervisor = await userModel.findById(req.body.supervisorId);
        if (!supervisor || supervisor.isDeleted) {
          return res.status(400).json({ message: 'Selected supervisor was not found.' });
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
        if (!allowedRoles.includes(req.body.role)) {
          return res.status(400).json({ message: 'Selected role is invalid.' });
        }
        payload.role = req.body.role;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'gender') && req.body.gender && !allowedGenders.includes(req.body.gender)) {
        return res.status(400).json({ message: 'Selected gender is invalid.' });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'employeeNo')) {
        payload.employeeNo = req.body.employeeNo || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'departmentId')) {
        payload.departmentId = req.body.departmentId || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'supervisorId')) {
        payload.supervisorId = req.body.supervisorId || null;
      }

      payload.isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : undefined;
    } else if (req.body.phone && !/^\d+$/.test(String(req.body.phone))) {
      return res.status(400).json({ message: 'Phone number must contain digits only.' });
    }

    const user = await userModel.update(id, payload);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_UPDATE',
      entityType: 'user',
      entityId: String(user.id),
      description: `${req.user.fullName} updated user ${user.fullName}.`,
      metadata: { updatedFields: Object.keys(payload).filter((key) => payload[key] !== undefined) },
      ipAddress: req.ip
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'A new password is required.' });
    }

    const target = await userModel.findById(id);
    if (!target || target.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const passwordHash = await hashPassword(password);
    await userModel.update(id, { passwordHash });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: String(id),
      description: `${req.user.fullName} reset credentials for ${target.fullName}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: 'You can only change your own password from this page.' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    const authUser = await userModel.findByEmail(req.user.email);
    if (!authUser || authUser.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const passwordMatches = await comparePassword(currentPassword, authUser.passwordHash);
    if (!passwordMatches) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    const passwordHash = await hashPassword(newPassword);
    await userModel.update(id, { passwordHash });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'PASSWORD_CHANGE',
      entityType: 'user',
      entityId: String(id),
      description: `${req.user.fullName} changed their password.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
};

const softDeleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ message: 'You cannot soft delete your own account.' });
    }

    if (!['admin', 'hr', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to delete users.' });
    }

    const target = await userModel.findById(id);
    if (!target || target.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = await userModel.softDelete(id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_SOFT_DELETE',
      entityType: 'user',
      entityId: String(id),
      description: `${req.user.fullName} soft deleted ${target.fullName}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  getProfile,
  createUser,
  updateUser,
  changePassword,
  resetPassword,
  softDeleteUser
};
