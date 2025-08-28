const express = require('express');
const router = express.Router();
const payrollController = require('../../controllers/payrollController');
const { authenticateToken, requireAdmin, requireHROrAdmin } = require('../../utils/auth');
const Payroll = require('../../models/Payroll');

// Middleware to handle flexible authentication
const flexibleAuth = (req, res, next) => {
  let token = null;
  
  // Try to get token from Authorization header first
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // If no header token, try query parameter
  else if (req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

router.use(authenticateToken);

// Generate bank instruction PDF (Finance/Admin only)
router.post('/bank-instruction', authenticateToken, async (req, res) => {
  try {
    // security: only finance or admin can generate the bank instruction
    if (!req.user || !['admin', 'finance'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Finance/Admin role required.' });
    }

    // Accept either { month } OR { startDate, endDate } in body
    const { month, startDate, endDate } = req.body;

    // call controller streaming function
    await payrollController.generateBankInstructionPDF(res, { month, startDate, endDate }, req.user);
    // function will stream and end the response
  } catch (error) {
    console.error('bank-instruction route error', error);
    if (!res.headersSent) {
      res.status(error.statusCode || 500).json({ error: error.message });
    } else {
      try { res.end(); } catch (e) { /* ignore */ }
    }
  }
});

// Process payroll for all active employees (Admin/HR only)
router.post('/process', requireHROrAdmin, async (req, res) => {
  try {
    const { month } = req.body;
    
    if (!month) {
      return res.status(400).json({ 
        error: 'Month is required in format YYYY-MM' 
      });
    }

    const result = await payrollController.processAllEmployees(month, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Get payroll summary for a specific month
router.get('/summary/:month', requireHROrAdmin, async (req, res) => {
  try {
    const summary = await payrollController.getPayrollSummary(req.params.month);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get department-wise summary for a specific month
router.get('/summary/:month/departments', requireHROrAdmin, async (req, res) => {
  try {
    const summary = await payrollController.getDepartmentSummary(req.params.month);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch payment processing (Finance/Admin only)
router.post('/batch-payment', requireAdmin, async (req, res) => {
  try {
    const { month, batchId, method } = req.body;
    
    if (!month || !batchId) {
      return res.status(400).json({ 
        error: 'Month and batchId are required' 
      });
    }

    const result = await payrollController.processBatchPayment(
      month, 
      { batchId, method }, 
      req.user.id
    );
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// NEW ROUTE: View payslip (inline PDF)
router.get('/:id/payslip-view', flexibleAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const payroll = await payrollController.getPayrollDetails(id);
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll not found' });
    }

    // Check permissions
    if (req.user.role === 'employee') {
      if (payroll.employeeId.userId && payroll.employeeId.userId.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Stream the PDF inline
    res.setHeader('Content-disposition', `inline; filename=payslip_${id}.pdf`);
    res.setHeader('Content-type', 'application/pdf');
    
    await payrollController.generatePayslipPDF(payroll, { 
      res, 
      disposition: 'inline' 
    });
  } catch (error) {
    console.error('Payslip view route error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Download/View payslip - Updated route
router.get('/:id/payslip', flexibleAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { download } = req.query;
    
    const payroll = await payrollController.getPayrollDetails(id);
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll not found' });
    }

    // Check permissions - employees can only access their own payslips
    if (req.user.role === 'employee') {
      if (payroll.employeeId.userId && payroll.employeeId.userId.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (download) {
      // Set download headers
      res.setHeader('Content-disposition', `attachment; filename=payslip_${id}.pdf`);
      res.setHeader('Content-type', 'application/pdf');
      
      // Stream the PDF
      await payrollController.generatePayslipPDF(payroll, { 
        res, 
        disposition: 'attachment' 
      });
    } else {
      // Return payslip metadata
      res.json({
        success: true,
        payslip: payroll.payslip,
        employee: {
          name: payroll.employeeId.fullName,
          id: payroll.employeeId.employeeId
        },
        month: payroll.payrollMonth,
        netPay: payroll.netPay,
        currency: payroll.currency
      });
    }
  } catch (error) {
    console.error('Payslip route error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Generate individual payslip (HR/Admin only, or employee for own payslip)
router.post('/:id/payslip',flexibleAuth, async (req, res) => {
  try {
    const payroll = await payrollController.getPayrollDetails(req.params.id);
    
    // Check access permissions
    if (req.user.role === 'employee') {
      await payroll.populate('employeeId', 'userId');
      if (payroll.employeeId.userId.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (!['admin', 'hr'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await payrollController.generatePayslip(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Generate all payslips for a month
router.post('/payslips/generate-all', flexibleAuth, async (req, res) => {
  try {
    const { month } = req.body;
    
    if (!month) {
      return res.status(400).json({ error: 'Month is required' });
    }

    const result = await payrollController.generateAllPayslips(month);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Update payroll record (HR/Admin only)
router.put('/:id', requireHROrAdmin, async (req, res) => {
  try {
    const payroll = await payrollController.updatePayroll(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Get payroll details
router.get('/:id', async (req, res) => {
  try {
    // Check if user can access this payroll
    const payroll = await payrollController.getPayrollDetails(req.params.id);
    
    // Employees can only view their own payroll
    if (req.user.role === 'employee') {
      await payroll.populate('employeeId', 'userId');
      if (payroll.employeeId.userId.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/', requireHROrAdmin, async (req, res) => {
  try {
    const filters = {
      ...req.query,
      user: req.user
    };
    const result = await payrollController.listPayrolls(filters);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Approve payroll (HR for hr approval, Finance for finance approval)
router.patch('/:id/approve', async (req, res) => {
  try {
    const { type, notes } = req.body;
    
    // Validate approval type based on user role
    if (type === 'hr' && !['admin', 'hr'].includes(req.user.role)) {
      return res.status(403).json({ error: 'HR approval requires HR or Admin role' });
    }
    
    if (type === 'finance' && !['admin', 'finance'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Finance approval requires Finance or Admin role' });
    }

    const payroll = await payrollController.approvePayroll(
      req.params.id,
      type,
      req.user.id,
      notes
    );
    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Reject payroll
router.patch('/:id/reject', async (req, res) => {
  try {
    const { type, notes } = req.body;
    
    if (!notes) {
      return res.status(400).json({ error: 'Rejection notes are required' });
    }
    
    // Validate rejection type based on user role
    if (type === 'hr' && !['admin', 'hr'].includes(req.user.role)) {
      return res.status(403).json({ error: 'HR rejection requires HR or Admin role' });
    }
    
    if (type === 'finance' && !['admin', 'finance'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Finance rejection requires Finance or Admin role' });
    }

    const payroll = await payrollController.rejectPayroll(
      req.params.id,
      type,
      req.user.id,
      notes
    );
    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Add adjustment to payroll (HR/Admin only)
router.post('/:id/adjustments', requireHROrAdmin, async (req, res) => {
  try {
    const payroll = await payrollController.addAdjustment(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Mark payroll as paid (Finance/Admin only)
router.patch('/:id/mark-paid', requireAdmin, async (req, res) => {
  try {
    const payroll = await payrollController.markAsPaid(req.params.id, req.body);
    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Deactivate payroll (Admin only)
router.patch('/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const payroll = await payrollController.deactivatePayroll(req.params.id);
    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/payslip/:employeeId/:month', payrollController.getPayslip);

// Get all payslips for a month
router.get('/payslips/:month', payrollController.getAllPayslips);// Add these routes to payrollRoutes.js

// Create payroll from previous month
router.post('/create-from-previous', requireHROrAdmin, async (req, res) => {
  try {
    const { month } = req.body;
    
    if (!month) {
      return res.status(400).json({ 
        error: 'Month is required in format YYYY-MM' 
      });
    }

    const result = await payrollController.createFromPreviousMonth(month, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Get payroll by period with filtering
router.get('/period/:period', requireHROrAdmin, async (req, res) => {
  try {
    const { period } = req.params;
    const { page = 1, limit = 20, department, status } = req.query;
    
    const result = await payrollController.getPayrollByPeriod({
      period,
      page: parseInt(page),
      limit: parseInt(limit),
      department,
      status
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update payroll details
router.put('/:id/details', requireHROrAdmin, async (req, res) => {
  try {
    const payroll = await payrollController.updatePayrollDetails(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Generate consolidated payroll PDF
router.post('/consolidated-payroll', flexibleAuth, async (req, res) => {
  try {
    // Security: only finance or admin can generate the report
    if (!req.user || !['admin', 'finance', 'hr'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Admin/HR/Finance role required.' });
    }

    // Accept either { month } OR { startDate, endDate } in body
    const { month, startDate, endDate } = req.body;

    // Call controller function
    await payrollController.generateConsolidatedPayrollPDF(res, { month, startDate, endDate }, req.user);
  } catch (error) {
    console.error('consolidated-payroll route error', error);
    if (!res.headersSent) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
});

// Generate specific reports (PAYE, Pension, Overtime, Loans, Housing, etc.)
router.post('/report/:type', flexibleAuth, async (req, res) => {
  try {
    // Security: only finance or admin can generate reports
    if (!req.user || !['admin', 'finance', 'hr'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Admin/HR/Finance role required.' });
    }

    const { type } = req.params;
    const { month, startDate, endDate } = req.body;
    
    // Validate report type
    const validReportTypes = ['paye', 'pension', 'overtime', 'loan', 'advance', 'housing'];
    if (!validReportTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    // Call controller function
    await payrollController.generateReport(res, type, { month, startDate, endDate }, req.user);
  } catch (error) {
    console.error('report route error', error);
    if (!res.headersSent) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
});

// Finalize single payroll
router.patch('/:id/finalize', requireHROrAdmin, async (req, res) => {
  try {
    const payroll = await payrollController.finalizePayroll(
      req.params.id,
      req.user.id
    );
    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Finalize all payrolls for a month
router.patch('/finalize-all/:month', requireHROrAdmin, async (req, res) => {
  try {
    const { month } = req.params;
    
    const result = await payrollController.finalizeAllPayrolls(
      month,
      req.user.id
    );
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Get payroll with full details for editing
router.get('/:id/editable', requireHROrAdmin, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate({
        path: 'employeeId',
        populate: [
          { path: 'employmentInfo.departmentId', select: 'name code' },
          { path: 'employmentInfo.positionId', select: 'name' },
          { path: 'employmentInfo.gradeId', select: 'name code level' }
        ]
      })
      .populate('processedBy', 'name email');

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    // Check if payroll can be edited (not paid)
    if (payroll.payment.status === 'paid') {
      return res.status(400).json({ error: 'Cannot edit paid payroll' });
    }

    res.json(payroll);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Get available payroll periods
router.get('/periods/available', requireHROrAdmin, async (req, res) => {
  try {
    const periods = await Payroll.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$payrollMonth',
          count: { $sum: 1 },
          startDate: { $min: '$payPeriod.startDate' },
          endDate: { $max: '$payPeriod.endDate' }
        }
      },
      { $sort: { _id: -1 } }
    ]);
    
    res.json(periods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;