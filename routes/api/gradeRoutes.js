const express = require('express');
const router = express.Router();
const gradeController = require('../../controllers/gradeController');
const { requireAdmin, requireHROrAdmin } = require('../../utils/auth');

// Create new grade (Admin/HR only)
router.post('/', requireHROrAdmin, async (req, res) => {
  try {
    const grade = await gradeController.createGrade(req.body, req.user.id);
    res.status(201).json(grade);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Initialize grade hierarchy (Admin only - first time setup)
router.post('/initialize', requireAdmin, async (req, res) => {
  try {
    // Add validation
    if (!Array.isArray(req.body.grades)) {
      return res.status(400).json({ 
        error: "Payload must contain 'grades' array" 
      });
    }

    const grades = await gradeController.initializeGradeHierarchy(
      req.body.grades, 
      req.user.id
    );
    res.status(201).json(grades);
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      error: error.message 
    });
  }
});

// Move the hierarchy route before the :id routes
router.get('/hierarchy', async (req, res) => {
  try {
    const hierarchy = await gradeController.getGradeHierarchy();
    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Then keep all the other routes including the :id routes

// Update grade (Admin/HR only)
router.put('/:id', requireHROrAdmin, async (req, res) => {
  try {
    const grade = await gradeController.updateGrade(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json(grade);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Get grade details
router.get('/:id', async (req, res) => {
  try {
    const grade = await gradeController.getGradeDetails(req.params.id);
    res.json(grade);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// List grades with filters
router.get('/', async (req, res) => {
  try {
    const grades = await gradeController.listGrades({
      search: req.query.search,
      activeOnly: req.query.activeOnly !== 'false',
      minLevel: req.query.minLevel,
      maxLevel: req.query.maxLevel,
      minSalary: req.query.minSalary,
      maxSalary: req.query.maxSalary
    });
    res.json(grades);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/:id/calculate-salary', async (req, res) => {
  try {
    const overtimeHours = parseFloat(req.query.overtime) || 0;
    const salaryDetails = await gradeController.calculateSalary(
      req.params.id,
      overtimeHours
    );
    res.json(salaryDetails);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check promotion eligibility
router.get('/:gradeId/check-promotion/:employeeId', requireHROrAdmin, async (req, res) => {
  try {
    const result = await gradeController.checkPromotionEligibility(
      req.params.gradeId,
      req.params.employeeId
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Deactivate grade (Admin only)
router.patch('/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const grade = await gradeController.deactivateGrade(req.params.id);
    res.json(grade);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// Benefit management routes
router.post('/:id/benefits', requireHROrAdmin, async (req, res) => {
  try {
    const grade = await gradeController.addBenefit(req.params.id, req.body);
    res.status(201).json(grade);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/benefits/:benefitId', requireHROrAdmin, async (req, res) => {
  try {
    const grade = await gradeController.updateBenefit(
      req.params.id,
      req.params.benefitId,
      req.body
    );
    res.json(grade);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id/benefits/:benefitId', requireHROrAdmin, async (req, res) => {
  try {
    const grade = await gradeController.removeBenefit(
      req.params.id,
      req.params.benefitId
    );
    res.json(grade);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;