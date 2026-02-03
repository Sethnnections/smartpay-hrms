// routes/workflowRoutes.js - UPDATED VERSION
const express = require('express');
const router = express.Router();
const WorkflowController = require('../../controllers/workflowController');
const payrollController = require('../../controllers/payrollController');
const { authenticateToken, requireAdmin, requireHROrAdmin } = require('../../utils/auth');

router.use(authenticateToken);

// Get workflow status for a specific month
router.get('/status/:month?', async (req, res) => {
    try {
        const month = req.params.month || req.query.month || moment().format('YYYY-MM');
        const status = await WorkflowController.getWorkflowStatus(month);
        res.json({
            success: true,
            exists: status.exists || false,
            month: month,
            status: status.status || 'no_workflow',
            payrollGenerated: status.payrollGenerated || false,
            canGeneratePayroll: status.canGeneratePayroll || false,
            canMakeAdjustments: status.canMakeAdjustments || false,
            canStartApproval: status.canStartApproval || false,
            canMarkPaid: status.canMarkPaid || false,
            steps: status.steps || [],
            currentStep: status.currentStep || 1,
            message: status.message || 'Workflow status retrieved'
        });
    } catch (error) {
        console.error('Workflow status error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to get workflow status'
        });
    }
});

// Create workflow when generating payroll
router.post('/create/:month', requireHROrAdmin, async (req, res) => {
    try {
        const { month } = req.params;
        
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
            message: error.message || 'Failed to create workflow'
        });
    }
});

// Generate payroll and create workflow in one step
router.post('/generate-payroll/:month', requireHROrAdmin, async (req, res) => {
    try {
        const { month } = req.params;
        
        // Check if can generate
        const canGenerate = await WorkflowController.checkCanGeneratePayroll(month);
        
        if (!canGenerate.canGenerate) {
            return res.status(400).json({
                success: false,
                message: canGenerate.reason || 'Cannot generate payroll'
            });
        }
        
        // Generate payroll
        const payrollResult = await payrollController.processAllEmployees(month, req.user.id);
        
        // Create workflow
        const workflowResult = await WorkflowController.createWorkflow(month, req.user.id);
        
        res.json({
            success: true,
            message: 'Payroll generated and workflow created successfully',
            payroll: payrollResult,
            workflow: workflowResult.workflow,
            generatedAt: new Date()
        });
    } catch (error) {
        console.error('Generate payroll error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate payroll'
        });
    }
});

// Check if adjustments can be made
router.get('/can-adjust/:month', async (req, res) => {
    try {
        const { month } = req.params;
        const result = await WorkflowController.canMakeAdjustments(month);
        res.json({
            success: true,
            canAdjust: result.canAdjust || false,
            reason: result.reason || '',
            workflowId: result.workflowId || null,
            month: month
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Start approval process
router.post('/start-approval/:month', requireHROrAdmin, async (req, res) => {
    try {
        const { month } = req.params;
        console.log('Starting approval for month:', month, 'user:', req.user.id);
        
        const result = await WorkflowController.startApprovalProcess(month, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('Error starting approval:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Approve step
router.post('/approve-step', async (req, res) => {
    try {
        const { notes, role, month } = req.body;
        
        if (!role || !month) {
            return res.status(400).json({
                success: false,
                message: 'Role and month are required'
            });
        }
        
        // Check if user has the right role
        if (req.user.role !== role && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: `You need ${role.toUpperCase()} role to approve this step`
            });
        }
        
        const result = await WorkflowController.approveStep(month, req.user.id, role, notes);
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
router.post('/reject-step', async (req, res) => {
    try {
        const { reason, role, month } = req.body;
        
        if (!role || !reason || !month) {
            return res.status(400).json({
                success: false,
                message: 'Role, reason, and month are required'
            });
        }
        
        // Check if user has the right role
        if (req.user.role !== role && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: `You need ${role.toUpperCase()} role to reject this step`
            });
        }
        
        const result = await WorkflowController.rejectStep(month, req.user.id, role, reason);
        res.json(result);
    } catch (error) {
        console.error('Reject step error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Mark payroll as paid
router.post('/mark-paid/:month', requireAdmin, async (req, res) => {
    try {
        const { month } = req.params;
        const result = await WorkflowController.markPayrollPaid(month, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get user's pending approvals
router.get('/my-pending-approvals', async (req, res) => {
    try {
        const result = await WorkflowController.getMyPendingApprovals(req.user.id, req.user.role);
        res.json({
            success: true,
            hasPending: result.hasPending || false,
            workflow: result.workflow || null,
            myStep: result.myStep || null,
            message: result.message || ''
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});



// Approve step - UPDATED to accept month parameter
router.post('/approve', async (req, res) => {
  try {
    const { notes, role, month } = req.body;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'Month is required (YYYY-MM)'
      });
    }
    
    // Check if user has the right role
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `You need ${role.toUpperCase()} role to approve this step`
      });
    }
    
    // Pass the month parameter
    const result = await WorkflowController.approveStep(month, req.user.id, role || req.user.role, notes);
    res.json(result);
  } catch (error) {
    console.error('Approve step error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Reject step - UPDATED to accept month parameter
router.post('/reject', async (req, res) => {
  try {
    const { reason, role, month } = req.body;
    
    if (!role || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Role and reason are required'
      });
    }
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'Month is required (YYYY-MM)'
      });
    }
    
    // Check if user has the right role
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `You need ${role.toUpperCase()} role to reject this step`
      });
    }
    
    // Pass the month parameter
    const result = await WorkflowController.rejectStep(month, req.user.id, role || req.user.role, reason);
    res.json(result);
  } catch (error) {
    console.error('Reject step error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get my pending approvals - UPDATED to accept month parameter
router.get('/my-approvals/:month?', async (req, res) => {
  try {
    const month = req.params.month || req.query.month || moment().format('YYYY-MM');
    
    const result = await WorkflowController.getMyPendingApprovals(month, req.user.id, req.user.role);
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
router.get('/history', requireAdmin, async (req, res) => {
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



module.exports = router;