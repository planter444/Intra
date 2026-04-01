const fs = require('fs');
const auditModel = require('../models/auditModel');
const leaveModel = require('../models/leaveModel');
const userModel = require('../models/userModel');
const { logAction } = require('../services/auditService');
const { deleteStoredDocument, getRemoteDocumentUrl, isRemoteStoragePath, resolveDocumentPath, saveDocument } = require('../services/documentService');

const mapTimelineEvents = (request, auditTrail) => {
  const submittedEvent = auditTrail.find((entry) => entry.action === 'LEAVE_CREATE');
  const supervisorEvent = auditTrail.find((entry) => ['LEAVE_SUPERVISOR_APPROVE', 'LEAVE_SUPERVISOR_REJECT'].includes(entry.action));
  const ceoEvent = [...auditTrail].reverse().find((entry) => ['LEAVE_CEO_APPROVE', 'LEAVE_CEO_REJECT', 'LEAVE_CEO_DECISION_REVISED', 'LEAVE_HR_APPROVE', 'LEAVE_HR_REJECT'].includes(entry.action) && ['ceo', 'admin'].includes(entry.actorRole));

  return {
    submitted: submittedEvent ? { label: 'Submitted', time: submittedEvent.createdAt, actorName: submittedEvent.actorName } : { label: 'Submitted', time: request.createdAt, actorName: request.employeeName },
    supervisor: request.supervisorApproverId ? {
      label: 'Supervisor Review',
      time: supervisorEvent?.createdAt || null,
      actorName: request.supervisorApproverName || supervisorEvent?.actorName || null,
      comment: request.supervisorComment || '',
      decision: supervisorEvent?.action?.includes('APPROVE') ? 'approved' : supervisorEvent?.action?.includes('REJECT') ? 'rejected' : null
    } : null,
    ceo: {
      label: 'CEO Review',
      time: ceoEvent?.createdAt || null,
      actorName: request.ceoApproverName || request.hrApproverName || ceoEvent?.actorName || null,
      comment: request.ceoComment || request.hrComment || '',
      decision: request.status === 'approved' ? 'approved' : request.status === 'rejected' ? 'rejected' : null
    }
  };
};

const sendRemoteDocument = async ({ res, url, mimeType, fileName }) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Unable to fetch remote supporting document.');
  }

  const arrayBuffer = await response.arrayBuffer();
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(Buffer.from(arrayBuffer));
};

const calculateRequestedDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || diff < 0) {
    return null;
  }

  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
};

const filterGenderRestrictedItems = (items, gender) => items.filter((item) => {
  if (item.code === 'maternity') {
    return gender === 'female';
  }

  if (item.code === 'paternity') {
    return gender === 'male';
  }

  return true;
});

const canAccessRequest = (currentUser, request) => {
  if (['admin', 'ceo'].includes(currentUser.role)) {
    return true;
  }

  if (String(request.userId) === String(currentUser.id)) {
    return true;
  }

  return currentUser.role === 'supervisor' && String(request.employeeSupervisorId) === String(currentUser.id);
};

const canRequesterModify = (currentUser, request) => {
  if (String(request.userId) !== String(currentUser.id)) {
    return false;
  }

  if (request.status === 'pending_supervisor') {
    return true;
  }

  return request.status === 'pending_hr'
    && !request.supervisorApproverId
    && !request.hrApproverId
    && !request.ceoApproverId;
};

const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const validateLeaveInputs = async ({ user, leaveTypeCode, startDate, endDate, hasSupportingDocument }) => {
  const leaveType = await leaveModel.findLeaveTypeByCode(leaveTypeCode);
  if (!leaveType) {
    return { status: 404, message: 'Leave type not found.' };
  }

  if (leaveType.requiresDocument && !hasSupportingDocument) {
    return { status: 400, message: `${leaveType.label} requires a supporting document.` };
  }

  if (leaveType.code === 'maternity' && user.gender !== 'female') {
    return { status: 400, message: 'Only female employees can apply for maternity leave.' };
  }

  if (leaveType.code === 'paternity' && user.gender !== 'male') {
    return { status: 400, message: 'Only male employees can apply for paternity leave.' };
  }

  const daysRequested = calculateRequestedDays(startDate, endDate);
  if (!daysRequested) {
    return { status: 400, message: 'Invalid leave dates.' };
  }


  const balances = filterGenderRestrictedItems(await leaveModel.getBalancesForUser(user.id), user.gender);
  const currentBalance = balances.find((entry) => entry.leaveTypeId === leaveType.id);

  if (!currentBalance) {
    return { status: 400, message: 'No active leave balance was found for this leave type.' };
  }

  if (daysRequested > currentBalance.defaultDays) {
    return { status: 400, message: `This request exceeds the allocated ${currentBalance.defaultDays} days for ${leaveType.label}.` };
  }

  if (daysRequested > currentBalance.balanceDays) {
    return { status: 400, message: `You only have ${currentBalance.balanceDays} remaining day(s) for ${leaveType.label}.` };
  }

  return { leaveType, daysRequested };
};

const buildLeaveRouting = async (user) => {
  const requesterIsSupervisor = await userModel.hasDirectReports(user.id);
  const supervisor = user.supervisorId ? await userModel.findById(user.supervisorId) : null;
  const shouldStartWithSupervisor = user.role === 'employee' && !requesterIsSupervisor && supervisor && supervisor.isActive && !supervisor.isDeleted;

  return {
    initialStatus: shouldStartWithSupervisor ? 'pending_supervisor' : 'pending_hr',
    supervisorApproverId: shouldStartWithSupervisor ? supervisor.id : null
  };
};

const mapSupportingDocumentPayload = async (userId, file) => {
  if (!file) {
    return {};
  }

  const { storedName, targetPath } = await saveDocument({
    userId: String(userId),
    folderType: 'other',
    file
  });

  return {
    supportingDocumentName: file.originalname,
    supportingDocumentStoredName: storedName,
    supportingDocumentMimeType: file.mimetype,
    supportingDocumentSize: file.size,
    supportingDocumentPath: targetPath
  };
};

const listLeaveTypes = async (req, res, next) => {
  try {
    const leaveTypes = await leaveModel.listLeaveTypes();
    const filteredLeaveTypes = filterGenderRestrictedItems(leaveTypes, req.user?.gender);
    res.json({ leaveTypes: filteredLeaveTypes });
  } catch (error) {
    next(error);
  }
};

const getBalances = async (req, res, next) => {
  try {
    const userId = req.query.userId && (req.user.role === 'ceo' || req.user.role === 'admin')
      ? req.query.userId
      : req.user.id;
    const targetUser = String(userId) === String(req.user.id) ? req.user : await userModel.findById(userId);
    const balances = await leaveModel.getBalancesForUser(userId);
    res.json({ balances: filterGenderRestrictedItems(balances, targetUser?.gender) });
  } catch (error) {
    next(error);
  }
};

const listRequests = async (req, res, next) => {
  try {
    const requests = await leaveModel.listRequests({
      viewerId: req.user.id,
      userId: req.user.role === 'employee' ? req.user.id : req.user.role === 'ceo' ? req.query.userId : undefined,
      role: req.user.role,
      status: req.query.status
    });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
};

const getRequest = async (req, res, next) => {
  try {
    const request = await leaveModel.findRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!canAccessRequest(req.user, request)) {
      return res.status(403).json({ message: 'You do not have permission to view this leave request.' });
    }

    const auditTrail = await auditModel.listByEntity({ entityType: 'leave_request', entityId: req.params.id });
    res.json({ request: { ...request, timeline: mapTimelineEvents(request, auditTrail) } });
  } catch (error) {
    next(error);
  }
};

const createRequest = async (req, res, next) => {
  try {
    const { leaveTypeCode, startDate, endDate, reason } = req.body;

    if (req.user.role === 'ceo') {
      return res.status(403).json({ message: 'CEO accounts are limited to oversight and approvals only.' });
    }

    if (!leaveTypeCode || !startDate || !endDate) {
      return res.status(400).json({ message: 'Leave type, start date, and end date are required.' });
    }

    const validation = await validateLeaveInputs({ user: req.user, leaveTypeCode, startDate, endDate, hasSupportingDocument: Boolean(req.file) });
    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const { leaveType, daysRequested } = validation;
    const routing = await buildLeaveRouting(req.user);
    const supportingDocument = await mapSupportingDocumentPayload(req.user.id, req.file);

    const request = await leaveModel.createRequest({
      userId: req.user.id,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      daysRequested,
      reason,
      status: routing.initialStatus,
      supervisorApproverId: routing.supervisorApproverId,
      ...supportingDocument
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'LEAVE_CREATE',
      entityType: 'leave_request',
      entityId: String(request.id),
      description: `${req.user.fullName} submitted a leave request.`,
      metadata: { leaveTypeCode, daysRequested, initialStatus: routing.initialStatus },
      ipAddress: req.ip
    });

    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
};

const updateRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { leaveTypeCode, startDate, endDate, reason } = req.body;
    const request = await leaveModel.findRequestById(id);

    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!canRequesterModify(req.user, request)) {
      return res.status(403).json({ message: 'This leave request can no longer be edited.' });
    }

    const validation = await validateLeaveInputs({
      user: req.user,
      leaveTypeCode: leaveTypeCode || request.leaveTypeCode,
      startDate: startDate || request.startDate,
      endDate: endDate || request.endDate,
      hasSupportingDocument: Boolean(req.file || request.supportingDocumentPath)
    });

    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const { leaveType, daysRequested } = validation;
    const routing = await buildLeaveRouting(req.user);
    const supportingDocument = await mapSupportingDocumentPayload(req.user.id, req.file);
    const updatedRequest = await leaveModel.updateRequestDetails({
      id,
      leaveTypeId: leaveType.id,
      startDate: startDate || request.startDate,
      endDate: endDate || request.endDate,
      daysRequested,
      reason: reason ?? request.reason,
      status: routing.initialStatus,
      supervisorApproverId: routing.supervisorApproverId,
      ...supportingDocument
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'LEAVE_UPDATE',
      entityType: 'leave_request',
      entityId: String(id),
      description: `${req.user.fullName} updated leave request ${id}.`,
      metadata: { leaveTypeCode: leaveType.code, daysRequested },
      ipAddress: req.ip
    });

    res.json({ request: updatedRequest });
  } catch (error) {
    next(error);
  }
};

const cancelRequest = async (req, res, next) => {
  try {
    const request = await leaveModel.findRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!canRequesterModify(req.user, request)) {
      return res.status(403).json({ message: 'This leave request can no longer be cancelled.' });
    }

    if (request.supportingDocumentPath) {
      await deleteStoredDocument({
        storagePath: request.supportingDocumentPath,
        storedName: request.supportingDocumentStoredName,
        mimeType: request.supportingDocumentMimeType
      });
    }

    await leaveModel.deleteRequest(req.params.id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'LEAVE_CANCEL',
      entityType: 'leave_request',
      entityId: String(req.params.id),
      description: `${req.user.fullName} cancelled leave request ${req.params.id}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ request: null });
  } catch (error) {
    next(error);
  }
};

const downloadSupportingDocument = async (req, res, next) => {
  try {
    const request = await leaveModel.findRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!request.supportingDocumentPath) {
      return res.status(404).json({ message: 'No supporting document is attached to this leave request.' });
    }

    if (!canAccessRequest(req.user, request)) {
      return res.status(403).json({ message: 'You do not have permission to access this document.' });
    }

    if (isRemoteStoragePath(request.supportingDocumentPath)) {
      await sendRemoteDocument({
        res,
        url: getRemoteDocumentUrl({
          storedName: request.supportingDocumentStoredName,
          mimeType: request.supportingDocumentMimeType,
          fileName: request.supportingDocumentName
        }),
        mimeType: request.supportingDocumentMimeType,
        fileName: request.supportingDocumentName
      });
      return;
    }

    const filePath = resolveDocumentPath(request.supportingDocumentPath);
    res.setHeader('Content-Type', request.supportingDocumentMimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${request.supportingDocumentName}"`);

    const stream = fs.createReadStream(filePath);
    stream.on('error', next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

const decideRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, comment } = req.body;
    const request = await leaveModel.findRequestById(id);

    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approve or reject.' });
    }

    if (request.status === 'pending_supervisor') {
      if (String(request.supervisorApproverId) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Only the assigned supervisor can action this request.' });
      }

      const nextStatus = decision === 'approve' ? 'pending_hr' : 'rejected';
      const updatedRequest = await leaveModel.updateRequestStatus({
        id,
        status: nextStatus,
        supervisorApproverId: req.user.id,
        supervisorComment: comment || null
      });

      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: decision === 'approve' ? 'LEAVE_SUPERVISOR_APPROVE' : 'LEAVE_SUPERVISOR_REJECT',
        entityType: 'leave_request',
        entityId: String(id),
        description: `${req.user.fullName} ${decision}d leave request ${id} as supervisor.`,
        metadata: { comment },
        ipAddress: req.ip
      });

      return res.json({ request: updatedRequest });
    }

    if ((req.user.role === 'admin' || req.user.role === 'ceo') && request.status === 'pending_hr') {
      const nextStatus = decision === 'approve'
        ? (req.user.role === 'admin' && request.requiresCeoApproval ? 'pending_ceo' : 'approved')
        : 'rejected';

      const updatedRequest = await leaveModel.updateRequestStatus({
        id,
        status: nextStatus,
        hrApproverId: req.user.role === 'admin' ? req.user.id : request.hrApproverId,
        hrComment: req.user.role === 'admin' ? comment || null : request.hrComment,
        ceoApproverId: req.user.role === 'ceo' ? req.user.id : request.ceoApproverId,
        ceoComment: req.user.role === 'ceo' ? comment || null : request.ceoComment
      });

      if (nextStatus === 'approved') {
        await leaveModel.applyApprovedDaysToBalance({
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          daysRequested: request.daysRequested
        });
      }

      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: decision === 'approve' ? 'LEAVE_HR_APPROVE' : 'LEAVE_HR_REJECT',
        entityType: 'leave_request',
        entityId: String(id),
        description: `${req.user.fullName} ${decision}d leave request ${id} during the operational review stage.`,
        metadata: { comment },
        ipAddress: req.ip
      });

      return res.json({ request: updatedRequest });
    }

    if (req.user.role === 'ceo' && ['approved', 'rejected'].includes(request.status) && String(request.ceoApproverId) === String(req.user.id)) {
      if (request.status === 'approved' && decision === 'reject') {
        await leaveModel.revertApprovedDaysToBalance({
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          daysRequested: request.daysRequested
        });
      }

      if (request.status === 'rejected' && decision === 'approve') {
        await leaveModel.applyApprovedDaysToBalance({
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          daysRequested: request.daysRequested
        });
      }

      const updatedRequest = await leaveModel.updateRequestStatus({
        id,
        status: decision === 'approve' ? 'approved' : 'rejected',
        ceoApproverId: req.user.id,
        ceoComment: comment || null
      });

      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'LEAVE_CEO_DECISION_REVISED',
        entityType: 'leave_request',
        entityId: String(id),
        description: `${req.user.fullName} revised the CEO decision for leave request ${id}.`,
        metadata: { decision, comment },
        ipAddress: req.ip
      });

      return res.json({ request: updatedRequest });
    }

    if (req.user.role === 'ceo') {
      if (request.status !== 'pending_ceo') {
        return res.status(400).json({ message: 'Only CEO-pending requests can be actioned by the CEO.' });
      }

      const updatedRequest = await leaveModel.updateRequestStatus({
        id,
        status: decision === 'approve' ? 'approved' : 'rejected',
        ceoApproverId: req.user.id,
        ceoComment: comment || null
      });

      if (decision === 'approve') {
        await leaveModel.applyApprovedDaysToBalance({
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          daysRequested: request.daysRequested
        });
      }

      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: decision === 'approve' ? 'LEAVE_CEO_APPROVE' : 'LEAVE_CEO_REJECT',
        entityType: 'leave_request',
        entityId: String(id),
        description: `${req.user.fullName} ${decision}d leave request ${id}.`,
        metadata: { comment },
        ipAddress: req.ip
      });

      return res.json({ request: updatedRequest });
    }

    return res.status(403).json({ message: 'Only assigned supervisors, Admin, and CEO can decide leave requests.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listLeaveTypes,
  getBalances,
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  cancelRequest,
  downloadSupportingDocument,
  decideRequest
};
