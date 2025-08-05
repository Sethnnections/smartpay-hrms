const express = require('express');
const router = express.Router();
const positionController = require('../../controllers/positionController');
const { requireAdmin, requireHROrAdmin } = require('../../utils/auth');

// Create new position (Admin/HR only)
router.post('/', requireHROrAdmin, async (req, res) => {
  try {
    const position = await positionController.createPosition(req.body, req.user.id);
    res.status(201).json(position);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Get position details
router.get('/:id', async (req, res) => {
  try {
    const position = await positionController.getPositionDetails(req.params.id);
    res.json(position);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Update position (Admin/HR only)
router.put('/:id', requireHROrAdmin, async (req, res) => {
  try {
    const position = await positionController.updatePosition(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json(position);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// List positions with filters
router.get('/', async (req, res) => {
  try {
    const positions = await positionController.listPositions({
      search: req.query.search,
      departmentId: req.query.departmentId,
      gradeId: req.query.gradeId,
      isActive: req.query.isActive !== 'false',
      hasVacancies: req.query.hasVacancies === 'true'
    });
    res.json(positions);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Get position hierarchy
router.get('/:id/hierarchy', async (req, res) => {
  try {
    const hierarchy = await positionController.getPositionHierarchy(req.params.id);
    res.json(hierarchy);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Update position capacity (Admin/HR only)
router.patch('/:id/capacity', requireHROrAdmin, async (req, res) => {
  try {
    const change = parseInt(req.body.change) || 0;
    const position = await positionController.updatePositionCapacity(
      req.params.id,
      change
    );
    res.json(position);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Get position statistics
router.get('/:id/statistics', async (req, res) => {
  try {
    const stats = await positionController.getPositionStatistics(req.params.id);
    res.json(stats);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Deactivate position (Admin only)
router.patch('/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const position = await positionController.deactivatePosition(req.params.id);
    res.json(position);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

module.exports = router;