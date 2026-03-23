const defaultSettings = require('../config/defaultSettings');
const settingsModel = require('../models/settingsModel');
const userModel = require('../models/userModel');
const leaveModel = require('../models/leaveModel');

const mergeSettings = (currentPayload = {}, updates = {}) => ({
  ...currentPayload,
  ...updates,
  branding: {
    ...(currentPayload.branding || defaultSettings.branding),
    ...(updates.branding || {})
  },
  labels: {
    ...(currentPayload.labels || defaultSettings.labels),
    ...(updates.labels || {})
  },
  interface: {
    ...(currentPayload.interface || defaultSettings.interface),
    ...(updates.interface || {})
  },
  navigation: {
    ...(currentPayload.navigation || defaultSettings.navigation),
    ...(updates.navigation || {})
  }
});

const normalizeDepartments = (departments = []) => departments.filter((department) => department?.name !== 'Human Resources');

const normalizeLegacyPayload = (payload = {}) => {
  const nextPayload = JSON.parse(JSON.stringify(payload || {}));

  if (nextPayload.labels?.employeeDirectoryTitle === 'Employee Directory' || nextPayload.labels?.employeeDirectoryTitle === 'Users') {
    nextPayload.labels.employeeDirectoryTitle = defaultSettings.labels.employeeDirectoryTitle;
  }

  if (nextPayload.labels?.employeeDirectorySubtitle === 'Manage system users and staff.') {
    nextPayload.labels.employeeDirectorySubtitle = defaultSettings.labels.employeeDirectorySubtitle;
  }

  if (nextPayload.labels?.navigationLeaves === 'Leaves') {
    nextPayload.labels.navigationLeaves = defaultSettings.labels.navigationLeaves;
  }

  if (nextPayload.labels?.profileSubtitle === 'Employees can update contact details such as phone number. Identity and role information is managed by HR, Admin, or CEO.') {
    nextPayload.labels.profileSubtitle = defaultSettings.labels.profileSubtitle;
  }

  if (nextPayload.interface?.dashboardHeroTitle === 'Human Resource Management System') {
    nextPayload.interface.dashboardHeroTitle = defaultSettings.interface.dashboardHeroTitle;
  }

  if (nextPayload.interface?.dashboardHeroSubtitle === 'Secure intranet experience for employees, HR, executives, and administrators.') {
    nextPayload.interface.dashboardHeroSubtitle = defaultSettings.interface.dashboardHeroSubtitle;
  }

  if (Array.isArray(nextPayload.roles) && !Array.isArray(nextPayload.roleTitles)) {
    nextPayload.roleTitles = nextPayload.roles
      .filter((role) => !['ceo', 'admin', 'supervisor', 'hr'].includes(String(role?.key || '').toLowerCase()))
      .map((role) => ({ value: String(role?.label || '').trim() }))
      .filter((role) => role.value);
  }

  delete nextPayload.roles;

  return nextPayload;
};

const getSystemSettings = async () => {
  const settings = await settingsModel.getGlobal();
  const departments = normalizeDepartments(await settingsModel.listDepartments());
  const leaveTypes = await leaveModel.listLeaveTypes();
  const mergedPayload = mergeSettings(defaultSettings, normalizeLegacyPayload(settings?.payload || {}));

  return {
    ...mergedPayload,
    departments: departments.length ? departments : defaultSettings.departments,
    roleTitles: Array.isArray(mergedPayload.roleTitles) && mergedPayload.roleTitles.length ? mergedPayload.roleTitles : defaultSettings.roleTitles,
    folders: Array.isArray(mergedPayload.folders) && mergedPayload.folders.length ? mergedPayload.folders : defaultSettings.folders,
    leaveTypes: leaveTypes.length ? leaveTypes : defaultSettings.leaveTypes
  };
};

const bootstrapSystem = async ({ ceoSeedEmail, ceoSeedPassword, hashPassword }) => {
  const existingSettings = await settingsModel.getGlobal();

  if (!existingSettings) {
    await settingsModel.upsertGlobal(defaultSettings, null);
  }

  const settingsSource = existingSettings?.payload || defaultSettings;
  const existingDepartments = await settingsModel.listDepartments();
  const existingLeaveTypes = await leaveModel.listLeaveTypes();

  if (!existingDepartments.length) {
    await settingsModel.syncDepartments(settingsSource.departments || defaultSettings.departments);
  }

  if (!existingLeaveTypes.length) {
    await leaveModel.syncLeaveTypes(settingsSource.leaveTypes || defaultSettings.leaveTypes);
  }

  const roleCounts = await userModel.countByRole();
  const totalUsers = Object.values(roleCounts).reduce((sum, count) => sum + Number(count || 0), 0);

  if (!totalUsers) {
    const passwordHash = await hashPassword(ceoSeedPassword);
    await userModel.create({
      employeeNo: 'CEO-001',
      firstName: 'Chief',
      lastName: 'Executive',
      email: ceoSeedEmail,
      phone: '0000000000',
      role: 'ceo',
      roleTitle: 'CEO',
      departmentId: null,
      positionTitle: 'Chief Executive Officer',
      passwordHash
    });
  }

  await leaveModel.ensureLeaveBalancesForAllUsers();
};

const normalizeUpdatesByRole = (currentUser, updates = {}) => {
  if (currentUser.role !== 'ceo') {
    return updates;
  }

  const allowedLabelKeys = ['leaveModuleTitle', 'employeeDirectoryTitle', 'employeeDirectorySubtitle', 'documentsModuleTitle', 'documentsSubtitle'];
  const labels = allowedLabelKeys.reduce((acc, key) => {
    if (updates.labels && Object.prototype.hasOwnProperty.call(updates.labels, key)) {
      acc[key] = updates.labels[key];
    }

    return acc;
  }, {});

  return {
    departments: Array.isArray(updates.departments) ? updates.departments : undefined,
    roleTitles: Array.isArray(updates.roleTitles) ? updates.roleTitles : undefined,
    folders: Array.isArray(updates.folders) ? updates.folders : undefined,
    leaveTypes: Array.isArray(updates.leaveTypes) ? updates.leaveTypes : undefined,
    labels: Object.keys(labels).length ? labels : undefined
  };
};

const updateSystemSettings = async ({ currentUser, updates }) => {
  const current = await settingsModel.getGlobal();
  const normalizedUpdates = normalizeUpdatesByRole(currentUser, updates);
  const mergedPayload = mergeSettings(current?.payload || defaultSettings, normalizedUpdates);

  await settingsModel.upsertGlobal(mergedPayload, currentUser.id);

  if (Array.isArray(normalizedUpdates.departments)) {
    await settingsModel.syncDepartments(normalizedUpdates.departments);
  }

  if (Array.isArray(normalizedUpdates.leaveTypes)) {
    await leaveModel.syncLeaveTypes(normalizedUpdates.leaveTypes);
    await leaveModel.ensureLeaveBalancesForAllUsers();
  }

  return getSystemSettings();
};

const restoreSystemSettings = async ({ currentUser }) => {
  await settingsModel.upsertGlobal(defaultSettings, currentUser.id);
  await settingsModel.syncDepartments(defaultSettings.departments);
  await leaveModel.syncLeaveTypes(defaultSettings.leaveTypes);
  await leaveModel.ensureLeaveBalancesForAllUsers();
  return getSystemSettings();
};

module.exports = {
  bootstrapSystem,
  getSystemSettings,
  updateSystemSettings,
  restoreSystemSettings
};
