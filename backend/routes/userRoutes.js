const express = require('express');
const { listUsers, getProfile, createUser, updateUser, changePassword, resetPassword, softDeleteUser } = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('supervisor', 'admin', 'hr', 'ceo'), listUsers);
router.post('/', authorize('admin', 'hr', 'ceo'), createUser);
router.get('/:id', authorize('admin', 'hr', 'employee', 'supervisor', 'ceo'), getProfile);
router.put('/:id', authorize('admin', 'hr', 'employee', 'supervisor', 'ceo'), updateUser);
router.patch('/:id/change-password', authorize('admin', 'hr', 'employee', 'supervisor', 'ceo'), changePassword);
router.patch('/:id/reset-password', authorize('admin', 'hr', 'ceo'), resetPassword);
router.delete('/:id', authorize('admin', 'hr', 'ceo'), softDeleteUser);

module.exports = router;
