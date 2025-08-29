// controllers/taxBracketController.js
const TaxBracket = require('../models/TaxBracket');

// Get all tax brackets
exports.getTaxBrackets = async (req, res) => {
  try {
    const { country, currency } = req.query;
    let query = { isActive: true };
    
    if (country) query.country = country;
    if (currency) query.currency = currency;
    
    const taxBrackets = await TaxBracket.find(query).sort({ minAmount: 1 });
    res.json({ success: true, data: taxBrackets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// get by id
exports.getTaxBracketById = async (req, res) => {
  try {
    const taxBracket = await TaxBracket.findById(req.params.id);
    if (!taxBracket) {
      return res.status(404).json({ success: false, error: 'Tax bracket not found' });
    }
    res.json({ success: true, data: taxBracket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
// Create a new tax bracket
exports.createTaxBracket = async (req, res) => {
  try {
    const taxBracket = new TaxBracket(req.body);
    await taxBracket.save();
    res.status(201).json({ success: true, data: taxBracket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update a tax bracket
exports.updateTaxBracket = async (req, res) => {
  try {
    const taxBracket = await TaxBracket.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!taxBracket) {
      return res.status(404).json({ success: false, error: 'Tax bracket not found' });
    }
    
    res.json({ success: true, data: taxBracket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete a tax bracket (soft delete)
exports.deleteTaxBracket = async (req, res) => {
  try {
    const taxBracket = await TaxBracket.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!taxBracket) {
      return res.status(404).json({ success: false, error: 'Tax bracket not found' });
    }
    
    res.json({ success: true, message: 'Tax bracket deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Test tax calculation
exports.testTaxCalculation = async (req, res) => {
  try {
    const { grossPay, country, currency } = req.body;
    
    if (!grossPay) {
      return res.status(400).json({ success: false, error: 'Gross pay is required' });
    }
    
    const taxCalculation = await TaxBracket.calculateTax(grossPay, country, currency);
    res.json({ success: true, data: taxCalculation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};