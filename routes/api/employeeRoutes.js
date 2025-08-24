const express = require('express');
const router = express.Router();
const employeeController = require('../../controllers/employeeController');
const { requireAdmin, requireHROrAdmin } = require('../../utils/auth');

// Create employee (HR or Admin only)
router.post(
  '/',
  requireHROrAdmin,
  employeeController.createEmployee
);

// Get all employees with filters (Admin only)
router.get(
  '/',
  requireAdmin,
  employeeController.getAllEmployees
);

// Get employee details
router.get(
  '/:id',
  employeeController.getEmployeeDetails
);

// Update employee (HR or Admin only) - Add this route
router.put(
  '/:id',
  requireHROrAdmin,
  employeeController.updateEmployee
);

// Update employee grade (HR or Admin only)
router.put(
  '/:id/grade',
  requireHROrAdmin,
  employeeController.updateEmployeeGrade
);

// Update employee salary (HR or Admin only)
router.put(
  '/:id/salary',
  requireHROrAdmin,
  employeeController.updateEmployeeSalary
);

// Get employees by grade
router.get(
  '/grade/:gradeId',
  employeeController.getEmployeesByGrade
);

// Get employee grade statistics
router.get(
  '/:id/grade-stats',
  employeeController.getEmployeeGradeStats
);

// Check promotion eligibility
router.get(
  '/:id/promotion-eligibility',
  employeeController.checkPromotionEligibility
);

// Process promotion (HR or Admin only)
router.post(
  '/:id/promote',
  requireHROrAdmin,
  employeeController.processPromotion
);

// Get compensation breakdown
router.get(
  '/:id/compensation',
  employeeController.getCompensationBreakdown
);

// Deactivate employee (HR or Admin only)
router.put(
  '/:id/deactivate',
  requireHROrAdmin,
  employeeController.deactivateEmployee
);

module.exports = router;