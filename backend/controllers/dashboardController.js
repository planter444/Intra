const userModel = require('../models/userModel');
const leaveModel = require('../models/leaveModel');
const documentModel = require('../models/documentModel');

const getDashboardSummary = async (req, res, next) => {
  try {
    const roleCounts = await userModel.countByRole();
    const leaveSummary = await leaveModel.getSummaryStats();
    const leaveBalances = await leaveModel.getBalancesForUser(req.user.id);
    const myDocuments = await documentModel.listForUser(req.user.id);
    const canViewOrgMetrics = !['employee', 'supervisor'].includes(req.user.role);

    res.json({
      summary: {
        currentUserRole: req.user.role,
        headcount: canViewOrgMetrics ? Object.values(roleCounts).reduce((total, value) => total + value, 0) : null,
        roleCounts: canViewOrgMetrics ? roleCounts : null,
        pendingLeaves: canViewOrgMetrics ? leaveSummary.pendingLeaves : null,
        approvedLeaves: canViewOrgMetrics ? leaveSummary.approvedLeaves : null,
        myLeaveBalanceTypes: leaveBalances.length,
        myDocuments: myDocuments.length
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary
};
