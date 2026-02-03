const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../utils/auth');
const WorkflowController = require('../controllers/WorkflowController');
const payrollController = require('../controllers/payrollController');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');

// ================ PUBLIC ROUTES ================
router.get('/', (req, res) => {
    res.render('login', {
        title: 'Login',
        layout: false
    });
});

router.get('/error', (req, res) => {
    res.render('error', {
        title: 'Error',
        message: 'An unexpected error occurred. Please try again later.',
        layout: false
    });
});

// ================ ADMIN VIEW ROUTES ================
const adminPages = [
    { path: '/admin', view: 'dashboard', title: 'Dashboard', page: 'dashboard' },
    { path: '/admin/employees', view: 'employees', title: 'Employees', page: 'employees' },
    { path: '/admin/departments', view: 'departments', title: 'Departments', page: 'departments' },
    { path: '/admin/grades', view: 'grades', title: 'Grades', page: 'grades' },
    { path: '/admin/positions', view: 'positions', title: 'Positions', page: 'positions' },
    { path: '/admin/payroll', view: 'payroll', title: 'Process Payroll', page: 'payroll' },
    { path: '/admin/payrolls', view: 'payrolls', title: 'Payrolls', page: 'payrolls' },
    { path: '/admin/payslips', view: 'payslips', title: 'Payslips', page: 'payslips' },
    { path: '/admin/reports', view: 'reports', title: 'Analytics', page: 'reports' },
    { path: '/admin/exports', view: 'exports', title: 'Export Data', page: 'exports' },
    { path: '/admin/settings', view: 'settings', title: 'Settings', page: 'settings' },
    { path: '/admin/company-settings', view: 'company-settings', title: 'Company Settings', page: 'company-settings' },
    { path: '/admin/users', view: 'users', title: 'User Management', page: 'users' },
    { path: '/admin/workflow', view: 'workflow', title: 'Payroll Workflow', page: 'payroll' } // FIXED: view should be 'workflow' not 'Process Payroll'
];

adminPages.forEach(page => {
    router.get(page.path, (req, res) => {
        res.render(`admin/${page.view}`, {
            title: page.title,
            currentPage: page.page,
            layout: false,
            user: {
                name: 'Administrator',
                email: 'admin@teampay.com',
                avatar: 'AD'
            }
        });
    });
});

// ================ API ROUTES (AUTHENTICATED) ================

// ----- Workflow API Routes -----
router.get('/api/workflow/status', authenticateToken, async (req, res) => {
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

router.post('/api/workflow/approve', authenticateToken, async (req, res) => {
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

router.post('/api/workflow/reject', authenticateToken, async (req, res) => {
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

router.post('/api/workflow/create', authenticateToken, async (req, res) => {
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

router.get('/api/workflow/my-approvals', authenticateToken, async (req, res) => {
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

// ----- Payroll Workflow API Routes -----
router.post('/api/payroll/workflow/generate-payroll/:month', authenticateToken, async (req, res) => {
    try {
        const { month } = req.params;
        
        const canGenerate = await WorkflowController.checkCanGeneratePayroll(month);
        if (!canGenerate.canGenerate) {
            return res.status(400).json({ 
                success: false, 
                message: canGenerate.reason 
            });
        }
        
        const payrollResult = await payrollController.processAllEmployees(month, req.user.id);
        const workflow = await WorkflowController.createWorkflow(month, req.user.id);
        
        res.json({
            success: true,
            message: 'Payroll generated successfully',
            payroll: payrollResult,
            workflow: workflow
        });
    } catch (error) {
        console.error('Error generating payroll:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.post('/api/payroll/workflow/start-approval/:month', authenticateToken, async (req, res) => {
    try {
        const { month } = req.params;
        const result = await WorkflowController.startApprovalProcess(month, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.post('/api/payroll/workflow/mark-paid/:month', authenticateToken, async (req, res) => {
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

// ----- Adjustments API Routes -----
router.get('/api/payroll/adjustments/:month', authenticateToken, async (req, res) => {
    try {
        const { month } = req.params;
        
        const payrolls = await Payroll.find({ 
            payrollMonth: month,
            'adjustments.0': { $exists: true }
        })
        .populate('employeeId', 'employeeId personalInfo firstName lastName')
        .populate('adjustments.appliedBy', 'name email')
        .lean();
        
        const adjustments = payrolls.flatMap(p => 
            p.adjustments.map(adj => ({
                ...adj,
                employeeId: p.employeeId._id,
                employeeName: p.employeeId.personalInfo ? 
                    `${p.employeeId.personalInfo.firstName} ${p.employeeId.personalInfo.lastName}` : 
                    p.employeeId.employeeId
            }))
        );
        
        res.json({ 
            success: true, 
            adjustments 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.post('/api/payroll/advance', authenticateToken, async (req, res) => {
    try {
        const { employeeId, amount, recoveryMonths, reason, month } = req.body;
        
        const payroll = await Payroll.findOne({
            employeeId,
            payrollMonth: month
        });
        
        if (!payroll) {
            return res.status(404).json({ 
                success: false,
                error: 'Payroll not found' 
            });
        }
        
        const result = await payrollController.createSalaryAdvance(
            payroll._id,
            {
                amount: parseFloat(amount),
                numberOfMonths: parseInt(recoveryMonths),
                reason: reason || 'Salary Advance'
            },
            req.user.id
        );
        
        res.json({
            success: true,
            message: 'Salary advance added successfully',
            payroll: result
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ----- Employee API Routes -----
router.get('/api/employees/search', authenticateToken, async (req, res) => {
    try {
        const { q, month, page = 1, limit = 10 } = req.query;
        
        let query = { isActive: true };
        
        if (q) {
            query.$or = [
                { employeeId: { $regex: q, $options: 'i' } },
                { 'personalInfo.firstName': { $regex: q, $options: 'i' } },
                { 'personalInfo.lastName': { $regex: q, $options: 'i' } }
            ];
        }
        
        if (month) {
            const payrolls = await Payroll.find({ payrollMonth: month })
                .distinct('employeeId');
            query._id = { $in: payrolls };
        }
        
        const skip = (page - 1) * limit;
        
        const [employees, total] = await Promise.all([
            Employee.find(query)
                .populate('employmentInfo.departmentId', 'name')
                .populate('employmentInfo.positionId', 'name')
                .select('employeeId personalInfo employmentInfo.currentSalary')
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Employee.countDocuments(query)
        ]);
        
        res.json({
            employees: employees.map(emp => ({
                _id: emp._id,
                employeeId: emp.employeeId,
                personalInfo: emp.personalInfo,
                employmentInfo: emp.employmentInfo,
                department: emp.employmentInfo?.departmentId?.name || 'N/A',
                position: emp.employmentInfo?.positionId?.name || 'N/A',
                currentSalary: emp.employmentInfo?.currentSalary || 0
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page < Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Employee search error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ----- Stats API -----
router.get('/admin/api/stats', authenticateToken, (req, res) => {
    res.json({
        success: true,
        employees: 247,
        departments: 15,
        positions: 42,
        payroll: 'MK2.4M'
    });
});

// ================ DEPRECATED/BACKWARD COMPATIBILITY ROUTES ================
// These routes are kept for backward compatibility but should be migrated to new API routes

router.post('/workflow/generate-payroll', authenticateToken, async (req, res) => {
    try {
        const { month } = req.body;
        const payrollResult = await payrollController.processAllEmployees(month, req.user.id);
        const workflow = await WorkflowController.createWorkflow(month, req.user.id);
        
        res.json({
            success: true,
            message: 'Payroll generated successfully',
            payrollCount: payrollResult.processedCount,
            workflow: workflow
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

router.post('/workflow/start-approval/:month', authenticateToken, async (req, res) => {
    try {
        const { month } = req.params;
        const result = await WorkflowController.startApprovalProcess(month, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

router.post('/workflow/mark-paid/:month', authenticateToken, async (req, res) => {
    try {
        const { month } = req.params;
        const result = await WorkflowController.markPayrollPaid(month, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

router.get('/payroll/adjustments/:month', authenticateToken, async (req, res) => {
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
        
        res.json({ 
            success: true,
            adjustments 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});


router.get('/api/employees/select-search', authenticateToken, async (req, res) => {
    try {
        const { q, page = 1, limit = 10 } = req.query;
        
        let query = { isActive: true };
        
        if (q) {
            query.$or = [
                { employeeId: { $regex: q, $options: 'i' } },
                { 'personalInfo.firstName': { $regex: q, $options: 'i' } },
                { 'personalInfo.lastName': { $regex: q, $options: 'i' } },
                { 'personalInfo.middleName': { $regex: q, $options: 'i' } }
            ];
        }
        
        const skip = (page - 1) * limit;
        
        const [employees, total] = await Promise.all([
            Employee.find(query)
                .populate('employmentInfo.departmentId', 'name')
                .populate('employmentInfo.positionId', 'name')
                .select('employeeId personalInfo employmentInfo.currentSalary')
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Employee.countDocuments(query)
        ]);
        
        // Format for Select2
        const results = employees.map(emp => ({
            id: emp._id,
            text: `${emp.employeeId} - ${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim(),
            employee: {
                _id: emp._id,
                employeeId: emp.employeeId,
                personalInfo: emp.personalInfo,
                employmentInfo: emp.employmentInfo
            }
        }));
        
        res.json({
            results,
            pagination: {
                more: (page * limit) < total
            }
        });
    } catch (error) {
        console.error('Employee select search error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ================ AUTHENTICATION ROUTES ================
router.post('/admin/logout', authenticateToken, (req, res) => {
    // Clear session/token logic here
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;