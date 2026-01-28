// controllers/companySettingsController.js
const CompanySettings = require('../models/CompanySettings');

// Get company settings
exports.getCompanySettings = async (req, res) => {
  try {
    const settings = await CompanySettings.getCompanySettings();
    
    if (!settings) {
      return res.status(404).json({ 
        success: false, 
        message: 'Company settings not found' 
      });
    }
    
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching company settings:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch company settings' 
    });
  }
};

// Update company settings
exports.updateCompanySettings = async (req, res) => {
  try {
    const {
      companyName,
      companyAccount,
      companyAddress,
      bankName,
      phone,
      email,
      currency,
      taxIdentificationNumber,
      logo
    } = req.body;

    const settingsData = {
      companyName,
      companyAccount,
      companyAddress,
      bankName,
      phone,
      email,
      currency,
      taxIdentificationNumber,
      logo
    };

    // Remove undefined values
    Object.keys(settingsData).forEach(key => {
      if (settingsData[key] === undefined) {
        delete settingsData[key];
      }
    });

    const settings = await CompanySettings.updateSettings(settingsData);
    
    res.json({ 
      success: true, 
      message: 'Company settings updated successfully',
      data: settings 
    });
  } catch (error) {
    console.error('Error updating company settings:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        error: 'Validation Error',
        details: errors 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update company settings' 
    });
  }
};

// Get default company settings (for initialization)
exports.getDefaultSettings = async (req, res) => {
  try {
    const defaultSettings = {
      companyName: "Simama Hotel",
      companyAccount: "123456789012",
      companyAddress: "Falls Estate M1 Rd, Lilongwe",
      bankName: "National Bank of Malawi",
      phone: "(+265) 996 217 054",
      email: "info@simamahotel.com",
      currency: "MWK",
      taxIdentificationNumber: "",
      logo: "https://simamahotel.com/wp-content/uploads/2023/02/IMG-20230126-WA0007-768x866.jpg"
    };
    
    res.json({ success: true, data: defaultSettings });
  } catch (error) {
    console.error('Error getting default settings:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get default settings' 
    });
  }
};