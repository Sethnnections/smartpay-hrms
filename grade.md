
### 1. Grade Controller (`controllers/gradeController.js`)

```javascript
const Grade = require('../models/Grade');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

exports.createGrade = async (gradeData, createdBy) => {
  try {
    // Validate that nextGrade exists if provided
    if (gradeData.promotion?.nextGrade) {
      const nextGrade = await Grade.findById(gradeData.promotion.nextGrade);
      if (!nextGrade) {
        throw new Error('Next grade for promotion not found');
      }
    }

    const grade = new Grade({
      ...gradeData,
      createdBy
    });

    await grade.save();
    return grade;
  } catch (error) {
    throw error;
  }
};

exports.updateGrade = async (id, updateData, modifiedBy) => {
  try {
    // Prevent circular references in promotion.nextGrade
    if (updateData.promotion?.nextGrade && updateData.promotion.nextGrade === id) {
      throw new Error('Grade cannot promote to itself');
    }

    // Validate salary range if updated
    if (updateData.salaryRange) {
      if (updateData.salaryRange.minimum > updateData.salaryRange.maximum) {
        throw new Error('Minimum salary cannot be greater than maximum salary');
      }
    }

    const grade = await Grade.findByIdAndUpdate(
      id,
      { ...updateData, lastModifiedBy: modifiedBy },
      { new: true, runValidators: true }
    );

    if (!grade) throw new Error('Grade not found');
    return grade;
  } catch (error) {
    throw error;
  }
};

exports.getGradeDetails = async (id) => {
  const grade = await Grade.findById(id)
    .populate('promotion.nextGrade', 'name code level')
    .lean();

  if (!grade) throw new Error('Grade not found');

  // Get statistics
  const statistics = await Grade.findById(id).then(g => g.getStatistics());
  return { ...grade, statistics };
};

exports.listGrades = async (filters = {}) => {
  const { search, activeOnly = true, minLevel, maxLevel, minSalary, maxSalary } = filters;

  const query = {};
  if (activeOnly) query.isActive = true;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }
  if (minLevel || maxLevel) {
    query.level = {};
    if (minLevel) query.level.$gte = Number(minLevel);
    if (maxLevel) query.level.$lte = Number(maxLevel);
  }
  if (minSalary || maxSalary) {
    query.$or = [
      {
        'salaryRange.minimum': { $gte: Number(minSalary), $lte: Number(maxSalary) }
      },
      {
        'salaryRange.maximum': { $gte: Number(minSalary), $lte: Number(maxSalary) }
      },
      {
        'salaryRange.minimum': { $lte: Number(minSalary) },
        'salaryRange.maximum': { $gte: Number(maxSalary) }
      }
    ];
  }

  return await Grade.find(query)
    .sort({ level: 1 })
    .populate('promotion.nextGrade', 'name code level');
};

exports.calculateSalary = async (id, overtimeHours = 0) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');

  return grade.calculateNetSalary(overtimeHours);
};

exports.checkPromotionEligibility = async (gradeId, employeeId) => {
  const grade = await Grade.findById(gradeId);
  if (!grade) throw new Error('Grade not found');

  const employee = await Employee.findById(employeeId);
  if (!employee) throw new Error('Employee not found');

  return grade.checkPromotionEligibility(employee);
};

exports.deactivateGrade = async (id) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');

  // Check if grade has active employees
  const activeEmployees = await Employee.countDocuments({
    'employmentInfo.gradeId': id,
    'employmentInfo.status': 'active'
  });

  if (activeEmployees > 0) {
    throw new Error('Cannot deactivate grade with active employees');
  }

  grade.isActive = false;
  await grade.save();
  return grade;
};

exports.getGradeHierarchy = async () => {
  return await Grade.getHierarchy();
};

exports.addBenefit = async (id, benefitData) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');

  grade.benefits.push(benefitData);
  await grade.save();
  return grade;
};

exports.updateBenefit = async (id, benefitId, updateData) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');

  const benefit = grade.benefits.id(benefitId);
  if (!benefit) throw new Error('Benefit not found');

  benefit.set(updateData);
  await grade.save();
  return grade;
};

exports.removeBenefit = async (id, benefitId) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');

  grade.benefits.pull(benefitId);
  await grade.save();
  return grade;
};
```

### 2. Grade Routes (`routes/gradeRoutes.js`)

```javascript
const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { requireAdmin, requireHROrAdmin } = require('../middleware/auth');

// Create new grade (Admin/HR only)
router.post('/', requireHROrAdmin, async (req, res) => {
  try {
    const grade = await gradeController.createGrade(req.body, req.user.id);
    res.status(201).json(grade);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

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
    res.status(400).json({ error: error.message });
  }
});

// Get grade details
router.get('/:id', async (req, res) => {
  try {
    const grade = await gradeController.getGradeDetails(req.params.id);
    res.json(grade);
  } catch (error) {
    res.status(404).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Calculate salary breakdown
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

// Get grade hierarchy
router.get('/hierarchy', async (req, res) => {
  try {
    const hierarchy = await gradeController.getGradeHierarchy();
    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
```

### 3. Integration with Main App

```javascript
// app.js or server.js
const gradeRoutes = require('./routes/gradeRoutes');

// ... other middleware
app.use('/api/grades', gradeRoutes);
```

### Key Features Implemented:

1. **Salary Scales Management**
   - Base salary configuration
   - Salary range validation
   - Currency support
   - Automatic code generation

2. **Allowances System**
   - Transport, housing, medical, meals, communication
   - Custom other allowances
   - Total allowances calculation

3. **Payroll Settings**
   - PAYE tax percentage
   - Pension contribution
   - Overtime rates and multipliers
   - Salary calculation methods

4. **Tax Brackets**
   - Low/medium/high/executive brackets
   - Exemption amounts
   - Additional tax percentages

5. **Benefits Packages**
   - Health, insurance, retirement, education benefits
   - Benefit activation/deactivation
   - Value calculations

6. **Promotion Paths**
   - Next grade configuration
   - Promotion requirements (tenure, performance)
   - Eligibility checking

### Example API Requests:

1. **Create Grade**
   ```http
   POST /api/grades
   Authorization: Bearer <hr_token>
   Content-Type: application/json

   {
     "name": "Senior Software Engineer",
     "level": 5,
     "baseSalary": 8000,
     "salaryRange": {
       "minimum": 7000,
       "maximum": 9500
     },
     "currency": "USD",
     "payrollSettings": {
       "payeePercent": 15,
       "pensionPercent": 5,
       "overtimeRate": 45,
       "overtimeMultiplier": 1.5
     },
     "allowances": {
       "transport": 200,
       "housing": 1000,
       "medical": 300
     },
     "taxBracket": {
       "bracket": "medium",
       "additionalTaxPercent": 2
     },
     "promotion": {
       "nextGrade": "60a1b2c3d4e5f6a1b2c3d4e5",
       "minimumTenure": 18,
       "performanceThreshold": 4.0
     }
   }
   ```

2. **Calculate Salary Breakdown**
   ```http
   GET /api/grades/60a1b2c3d4e5f6a1b2c3d4e5/calculate-salary?overtime=10
   ```

3. **Add Benefit**
   ```http
   POST /api/grades/60a1b2c3d4e5f6a1b2c3d4e5/benefits
   Authorization: Bearer <hr_token>
   Content-Type: application/json

   {
     "name": "Health Insurance",
     "type": "health",
     "value": 500,
     "description": "Comprehensive health coverage"
   }
   ```

4. **List Grades with Filters**
   ```http
   GET /api/grades?minSalary=5000&maxSalary=10000&minLevel=4
   ```

5. **Check Promotion Eligibility**
   ```http
   GET /api/grades/60a1b2c3d4e5f6a1b2c3d4e5/check-promotion/60a1b2c3d4e5f6a1b2c3d4e6
   Authorization: Bearer <hr_token>
   ```