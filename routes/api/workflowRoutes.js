const express = require('express');
const router = express.Router();
const WorkflowController = require('../controllers/WorkflowController');

// Check current month workflow status
router.get('/status', async (req, res) => {
  try {
    const status = await WorkflowController.getCurrentStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Create workflow (called after payroll generation)
router.post('/create/:payrollId', async (req, res) => {
  try {
    const result = await WorkflowController.createWorkflow(
      req.params.payrollId,
      req.user.id
    );
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Approve current step
router.post('/approve', async (req, res) => {
  try {
    const result = await WorkflowController.approveStep(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Reject current step
router.post('/reject', async (req, res) => {
  try {
    const result = await WorkflowController.rejectStep(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get my pending approvals
router.get('/my-approvals', async (req, res) => {
  try {
    const result = await WorkflowController.getMyPendingApprovals(req.user.id);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
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
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Check if can generate payroll (for frontend button)
router.get('/can-generate', async (req, res) => {
  try {
    const status = await WorkflowController.checkCurrentMonth();
    
    res.json({
      success: true,
      canGenerate: !status.exists, // Can generate if no workflow exists
      reason: status.exists ? `Workflow for ${status.workflow?.currentMonth} already exists` : 'Can generate payroll'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;