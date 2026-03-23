const express = require('express');
const {
  listLeaveTypes,
  getBalances,
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  cancelRequest,
  downloadSupportingDocument,
  decideRequest
} = require('../controllers/leaveController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/types', listLeaveTypes);
router.get('/balances', getBalances);
router.get('/requests', listRequests);
router.get('/requests/:id', getRequest);
router.get('/requests/:id/supporting-document', downloadSupportingDocument);
router.post('/requests', authorize('employee', 'supervisor', 'admin'), upload.single('supportingDocument'), createRequest);
router.put('/requests/:id', authorize('employee', 'supervisor', 'admin'), upload.single('supportingDocument'), updateRequest);
router.patch('/requests/:id/cancel', authorize('employee', 'supervisor', 'admin'), cancelRequest);
router.patch('/requests/:id/decision', authorize('employee', 'supervisor', 'admin', 'ceo'), decideRequest);

module.exports = router;
