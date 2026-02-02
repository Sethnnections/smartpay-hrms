const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('login', {
        title: 'Login',
        layout: false // Use no layout for login page
    });
});

// Admin Dashboard Routes
router.get('/admin', (req, res) => {
    res.render('admin/dashboard', {
        title: 'Dashboard',
        currentPage: 'dashboard',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/employees', (req, res) => {
    res.render('admin/employees', {
        title: 'Employees',
        currentPage: 'employees',
        layout: false, 
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/departments', (req, res) => {
    res.render('admin/departments', {
        title: 'Departments',
        currentPage: 'departments',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/grades', (req, res) => {
    res.render('admin/grades', {
        title: 'Grades',
        currentPage: 'grades',
        layout: false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});
router.get('/admin/positions', (req, res) => {
    res.render('admin/positions', {
        title: 'Positions',
        currentPage: 'positions',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/payroll', (req, res) => {
    res.render('admin/payroll', {
        title: 'Process Payroll',
        currentPage: 'payroll',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/payrolls', (req, res) => {
    res.render('admin/payrolls', {
        title: 'Payrolls',
        currentPage: 'payrolls',
        layout:false,
          user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/payslips', (req, res) => {
    res.render('admin/payslips', {
        title: 'Payslips',
        currentPage: 'payslips',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/reports', (req, res) => {
    res.render('admin/reports', {
        title: 'Analytics',
        currentPage: 'reports',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/exports', (req, res) => {
    res.render('admin/exports', {
        title: 'Export Data',
        currentPage: 'exports',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/settings', (req, res) => {
    res.render('admin/settings', {
        title: 'Settings',
        currentPage: 'settings',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/company-settings', (req, res) => {
    res.render('admin/company-settings', {
        title: 'Company Settings',
        currentPage: 'company-settings',
        layout:false,
         user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/users', (req, res) => {
    res.render('admin/users', {
        title: 'User Management',
        currentPage: 'users',
        user: {
            name: 'Administrator 2',
            email: 'admin@teampay.com',
            avatar: 'AD'
        },
        layout: false // Use no layout for error page

    });
});

// New workflow routes
router.post('/workflow/generate-payroll', 
  async (req, res) => {
    try {
      const { month } = req.body;
      
      // Generate payroll
      const payrollResult = await payrollController.processAllEmployees(month, req.user._id);
      
      // Create workflow
      const workflow = await WorkflowController.createWorkflow(month, req.user._id);
      
      res.json({
        success: true,
        message: 'Payroll generated successfully',
        payrollCount: payrollResult.processedCount,
        workflow: workflow
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Start approval process
router.post('/workflow/start-approval/:month', 
  async (req, res) => {
    try {
      const { month } = req.params;
      const result = await WorkflowController.startApprovalProcess(month, req.user._id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Mark payroll as paid
router.post('/workflow/mark-paid/:month', 
  async (req, res) => {
    try {
      const { month } = req.params;
      const result = await WorkflowController.markPayrollPaid(month, req.user._id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get adjustments for a month
router.get('/payroll/adjustments/:month', 
  async (req, res) => {
    try {
      const { month } = req.params;
      
      const payrolls = await Payroll.find({ 
        payrollMonth: month,
        'adjustments.0': { $exists: true }
      })
      .populate('adjustments.appliedBy', 'name email')
      .lean();
      
      const adjustments = payrolls.flatMap(p => 
        p.adjustments.map(adj => ({
          ...adj,
          employeeId: p.employeeId
        }))
      );
      
      res.json({ adjustments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Add salary advance
router.post('/payroll/advance', 
  async (req, res) => {
    try {
      const { employeeId, amount, recoveryMonths, reason, month } = req.body;
      
      // Find payroll for this employee and month
      const payroll = await Payroll.findOne({
        employeeId,
        payrollMonth: month
      });
      
      if (!payroll) {
        return res.status(404).json({ error: 'Payroll not found' });
      }
      
      const result = await payrollController.createSalaryAdvance(
        payroll._id,
        {
          amount: parseFloat(amount),
          numberOfMonths: parseInt(recoveryMonths),
          reason: reason || 'Salary Advance'
        },
        req.user._id
      );
      
      res.json({
        success: true,
        message: 'Salary advance added successfully',
        payroll: result
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get('/admin/workflow', (req, res) => {
  res.render('admin/workflow', {
    title: 'Payroll Workflow',
    currentPage: 'Process Payroll',
    layout: false,
    user: {
      name: 'Administrator',
      email: 'admin@teampay.com',
      avatar: 'AD'
    }
  });
});

// API Routes for AJAX calls
router.get('/admin/api/stats', (req, res) => {
    res.json({
        employees: 247,
        departments: 15,
        positions: 42,
        payroll: 'MK2.4M'
    });
});

//render error page
router.get('/error', (req, res) => {
    res.render('error', {
        title: 'Error',
        message: 'An unexpected error occurred. Please try again later.',
        layout: false // Use no layout for error page
    });
});

router.post('/admin/logout', (req, res) => {
    // Handle logout logic here
    res.redirect('/');
});

module.exports = router;