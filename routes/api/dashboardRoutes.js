const express = require('express');
const router = express.Router();
const DashboardController = require('../../controllers/dashboardController');
const { authenticateToken, requireHROrAdmin } = require('../../utils/auth');

// Apply authentication to all dashboard routes
router.use(authenticateToken);

/**
 * @route GET /api/dashboard/summary
 * @desc Get overall dashboard summary with key metrics
 * @query {string} period - Number of periods to look back (default: 12)
 * @query {string} type - Period type: 'day', 'week', 'month', 'year' (default: 'month')
 */
router.get('/summary', requireHROrAdmin, DashboardController.getDashboardSummary);

/**
 * @route GET /api/dashboard/employees
 * @desc Get employee analytics and trends
 */
router.get('/employees', requireHROrAdmin, DashboardController.getEmployeeAnalytics);

/**
 * @route GET /api/dashboard/departments
 * @desc Get department analytics and metrics
 */
router.get('/departments', requireHROrAdmin, DashboardController.getDepartmentAnalytics);

/**
 * @route GET /api/dashboard/payroll
 * @desc Get payroll analytics and trends
 */
router.get('/payroll', requireHROrAdmin, DashboardController.getPayrollAnalytics);

/**
 * @route GET /api/dashboard/performance
 * @desc Get performance analytics and top performers
 */
router.get('/performance', requireHROrAdmin, DashboardController.getPerformanceAnalytics);

/**
 * @route GET /api/dashboard/custom
 * @desc Run a custom analytics query
 */
router.get('/custom', requireHROrAdmin, DashboardController.getCustomAnalytics);

module.exports = router;
