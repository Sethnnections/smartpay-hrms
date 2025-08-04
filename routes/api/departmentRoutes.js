const express = require('express');
const router = express.Router();
const departmentController = require('../../controllers/departmentController');
const { requireAdmin, requireHROrAdmin } = require('../../utils/auth');

// Create new department (Admin/HR only)
router.post('/', requireHROrAdmin, async (req, res) => {
    
  try {
    const department = await departmentController.createDepartment(
      req.body, 
      req.user.id
    );
    res.status(201).json(department);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get department hierarchy
router.get('/hierarchy', async (req, res) => {
  try {
    const hierarchy = await departmentController.getDepartmentHierarchy();
    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get department details
router.get('/:id', async (req, res) => {
  try {
    const department = await departmentController.getDepartmentDetails(req.params.id);
    res.json(department);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Update department (Admin/HR only)
router.put('/:id', requireHROrAdmin, async (req, res) => {
  try {
    const department = await departmentController.updateDepartment(
      req.params.id, 
      req.body
    );
    res.json(department);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Allocate budget (Admin only)
router.post('/:id/budget', requireAdmin, async (req, res) => {
  try {
    const { amount, fiscalYear, currency } = req.body;
    const department = await departmentController.allocateBudget(
      req.params.id,
      amount,
      fiscalYear,
      currency
    );
    res.json(department);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add expense to department (Admin/HR only)
router.post('/:id/expenses', requireHROrAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const department = await departmentController.addDepartmentExpense(
      req.params.id,
      amount,
      description
    );
    res.json(department);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// List departments with filters
router.get('/', async (req, res) => {
  try {
    const departments = await departmentController.listDepartments({
      search: req.query.search,
      activeOnly: req.query.activeOnly !== 'false',
      minBudget: req.query.minBudget,
      maxBudget: req.query.maxBudget
    });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;