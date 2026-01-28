// routes/taxBrackets.js
const express = require('express');
const router = express.Router();
const taxBracketController = require('../../controllers/taxBracketController');
const { authenticateToken, requireAdmin, requireHROrAdmin } = require('../../utils/auth');

// Apply authentication to all report routes
router.use(authenticateToken);

router.get('/', taxBracketController.getTaxBrackets);
router.get('/:id', taxBracketController.getTaxBracketById);
router.post('/', taxBracketController.createTaxBracket);
router.put('/:id', taxBracketController.updateTaxBracket);
router.delete('/:id', taxBracketController.deleteTaxBracket);
router.post('/test-calculation', taxBracketController.testTaxCalculation);
router.post('/test-calculation-detailed', taxBracketController.testTaxCalculationDetailed);

module.exports = router;