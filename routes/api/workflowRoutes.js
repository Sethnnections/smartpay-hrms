const express = require('express');
const router = express.Router();
const WorkflowController = require('../../controllers/WorkflowController');
const { authenticateToken } = require('../../utils/auth');

router.use(authenticateToken);

// Get workflow status
router.get('/status', async (req, res) => {
  try {
    const { month } = req.query;
    const status = await WorkflowController.getWorkflowStatus(month);
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Workflow status error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Create workflow
router.post('/create', async (req, res) => {
  try {
    const { month } = req.body;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'Month is required (YYYY-MM)'
      });
    }
    
    const result = await WorkflowController.createWorkflow(month, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Approve step
router.post('/approve', async (req, res) => {
  try {
    const { notes, role } = req.body;
    const result = await WorkflowController.approveStep(req.user.id, role || req.user.role, notes);
    res.json(result);
  } catch (error) {
    console.error('Approve step error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Reject step
router.post('/reject', async (req, res) => {
  try {
    const { reason, role } = req.body;
    const result = await WorkflowController.rejectStep(req.user.id, role || req.user.role, reason);
    res.json(result);
  } catch (error) {
    console.error('Reject step error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Check if payroll can be generated
router.get('/can-generate/:month', async (req, res) => {
  try {
    const result = await WorkflowController.checkCanGeneratePayroll(req.params.month);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Can generate error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get my pending approvals
router.get('/my-approvals', async (req, res) => {
  try {
    const result = await WorkflowController.getMyPendingApprovals(req.user.id, req.user.role);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('My approvals error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get workflow history
router.get('/history', async (req, res) => {
  try {
    const history = await WorkflowController.getWorkflowHistory();
    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error('Workflow history error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;