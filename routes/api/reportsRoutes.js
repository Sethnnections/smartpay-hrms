const express = require('express');
const router = express.Router();
const reportController = require('../../controllers/reportController');
const { authenticateToken, requireAdmin, requireHROrAdmin } = require('../../utils/auth');

// Apply authentication to all report routes
router.use(authenticateToken);

// ========== PAGINATED REPORTS ==========

/**
 * @route   GET /api/reports/employees
 * @desc    Get paginated employee directory report
 * @access  Private (HR, Admin)
 * @query   page, limit, department, grade, status, search, sortBy, sortOrder
 */
router.get(
  '/employees',
  requireHROrAdmin,
  reportController.getEmployeeDirectory
);

/**
 * @route   GET /api/reports/payroll
 * @desc    Get paginated payroll history report
 * @access  Private (HR, Admin)
 * @query   page, limit, month, employee, department, minAmount, maxAmount, paymentStatus, sortBy, sortOrder
 */
router.get(
  '/payroll',
  requireHROrAdmin,
  reportController.getPayrollHistory
);

/**
 * @route   GET /api/reports/documents/expiry
 * @desc    Get paginated document expiry report
 * @access  Private (HR, Admin)
 * @query   page, limit, days, documentType, department, sortBy, sortOrder
 */
router.get(
  '/documents/expiry',
  requireHROrAdmin,
  reportController.getDocumentExpiry
);

// ========== ANALYTICS ==========

/**
 * @route   GET /api/reports/analytics/departments
 * @desc    Get department analytics
 * @access  Private (HR, Admin)
 * @query   timeframe (months)
 */
router.get(
  '/analytics/departments',
  requireHROrAdmin,
  reportController.getDepartmentAnalytics
);

/**
 * @route   GET /api/reports/analytics/salary
 * @desc    Get salary analytics
 * @access  Private (HR, Admin)
 * @query   department, grade
 */
router.get(
  '/analytics/salary',
  requireHROrAdmin,
  reportController.getSalaryAnalytics
);

/**
 * @route   GET /api/reports/analytics/workforce
 * @desc    Get workforce analytics
 * @access  Private (HR, Admin)
 * @query   period (months)
 */
router.get(
  '/analytics/workforce',
  requireHROrAdmin,
  reportController.getWorkforceAnalytics
);

// ========== ADDITIONAL UTILITY ROUTES ==========

/**
 * @route   GET /api/reports/summary
 * @desc    Get overall HR system summary
 * @access  Private (HR, Admin)
 */
router.get('/summary', requireHROrAdmin, async (req, res) => {
  try {
    const Employee = require('../../models/Employee');
    const Department = require('../../models/Department');
    const Position = require('../../models/Position');
    const Payroll = require('../../models/Payroll');
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const [
      totalEmployees,
      activeEmployees,
      totalDepartments,
      totalPositions,
      vacantPositions,
      currentMonthPayroll
    ] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ 'employmentInfo.status': 'active' }),
      Department.countDocuments({ isActive: true }),
      Position.countDocuments({ isActive: true }),
      Position.countDocuments({ isActive: true, 'capacity.vacant': { $gt: 0 } }),
      Payroll.findOne({ payrollMonth: currentMonth })
        .then(result => result ? Payroll.countDocuments({ payrollMonth: currentMonth }) : 0)
    ]);

    res.json({
      success: true,
      message: 'System summary retrieved successfully',
      data: {
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          inactive: totalEmployees - activeEmployees
        },
        departments: {
          total: totalDepartments
        },
        positions: {
          total: totalPositions,
          vacant: vacantPositions,
          filled: totalPositions - vacantPositions
        },
        payroll: {
          currentMonthProcessed: currentMonthPayroll > 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving system summary',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/reports/export/csv
 * @desc    Export report data as CSV
 * @access  Private (HR, Admin)
 * @query   reportType, ...filters
 */
router.get('/export/csv', requireHROrAdmin, async (req, res) => {
  try {
    const { reportType } = req.query;
    
    if (!reportType) {
      return res.status(400).json({
        success: false,
        message: 'Report type is required'
      });
    }

    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${Date.now()}.csv"`);

    let csvData = '';
    
    switch (reportType) {
      case 'employees':
        const employees = await Employee.find({ isActive: true })
          .populate('employmentInfo.departmentId employmentInfo.gradeId')
          .select('employeeId personalInfo employmentInfo.currentSalary employmentInfo.startDate');
        
        csvData = 'Employee ID,First Name,Last Name,Email,Department,Salary,Start Date\n';
        employees.forEach(emp => {
          csvData += `${emp.employeeId},${emp.personalInfo.firstName},${emp.personalInfo.lastName},${emp.personalInfo.email},${emp.employmentInfo.departmentId?.name || 'N/A'},${emp.employmentInfo.currentSalary},${emp.employmentInfo.startDate.toISOString().split('T')[0]}\n`;
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    res.send(csvData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting data',
      error: error.message
    });
  }
});

module.exports = router;