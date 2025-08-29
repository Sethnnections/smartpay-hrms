// routes/companySettings.js
const express = require('express');
const router = express.Router();
const companySettingsController = require('../../controllers/companySettingsController');
const { authenticateToken, requireAdmin, requireHROrAdmin } = require('../../utils/auth');

// Apply authentication to all report routes
router.use(authenticateToken);

// GET /api/company-settings - Get company settings
router.get('/', companySettingsController.getCompanySettings);

// PUT /api/company-settings - Update company settings
router.put('/', companySettingsController.updateCompanySettings);

// GET /api/company-settings/default - Get default settings
router.get('/default', companySettingsController.getDefaultSettings);

module.exports = router;