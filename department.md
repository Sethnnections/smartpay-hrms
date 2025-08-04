Here's a focused implementation for the Department module, covering models, controllers, and routes with organizational structure, budget, and location details:

### 1. Enhanced Department Model (`models/Department.js`)

```javascript
const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9]{3,10}$/, 'Code must be 3-10 uppercase alphanumeric characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  // Organizational Structure
  parentDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  // Budget Information
  budget: {
    allocated: {
      type: Number,
      default: 0,
      min: [0, 'Budget cannot be negative']
    },
    spent: {
      type: Number,
      default: 0,
      min: [0, 'Spent amount cannot be negative']
    },
    fiscalYear: {
      type: Number,
      min: [2000, 'Invalid fiscal year'],
      max: [2100, 'Invalid fiscal year']
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'KES', 'GHS', 'ZAR']
    }
  },
  // Location Details
  location: {
    type: {
      type: String,
      enum: ['physical', 'virtual', 'hybrid'],
      default: 'physical'
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'United States'
      }
    },
    building: String,
    floor: String,
    room: String,
    geoCoordinates: {
      lat: Number,
      lng: Number
    }
  },
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date,
    default: Date.now
  },
  costCenter: {
    type: String,
    trim: true,
    match: [/^[A-Z0-9]{3,20}$/, 'Cost center must be 3-20 alphanumeric characters']
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
departmentSchema.virtual('subdepartments', {
  ref: 'Department',
  localField: '_id',
  foreignField: 'parentDepartment'
});

departmentSchema.virtual('budgetUtilization').get(function() {
  if (this.budget.allocated <= 0) return 0;
  return parseFloat(((this.budget.spent / this.budget.allocated) * 100).toFixed(2));
});

departmentSchema.virtual('remainingBudget').get(function() {
  return Math.max(0, this.budget.allocated - this.budget.spent);
});

// Indexes
departmentSchema.index({ name: 1, isActive: 1 });
departmentSchema.index({ code: 1 }, { unique: true });
departmentSchema.index({ parentDepartment: 1 });
departmentSchema.index({ 'location.country': 1, 'location.city': 1 });
departmentSchema.index({ tags: 1 });

// Pre-save hooks
departmentSchema.pre('save', function(next) {
  // Auto-generate code if not provided
  if (!this.code && this.name) {
    this.code = this.name.replace(/[^A-Z0-9]/g, '')
      .substring(0, 3)
      .toUpperCase();
  }
  next();
});

// Static Methods
departmentSchema.statics.getHierarchy = async function() {
  const departments = await this.find({ isActive: true })
    .populate('headOfDepartment', 'personalInfo.firstName personalInfo.lastName')
    .lean();

  const buildTree = (parentId = null) => {
    return departments
      .filter(dept => 
        (parentId === null && !dept.parentDepartment) || 
        (dept.parentDepartment && dept.parentDepartment.toString() === parentId)
      )
      .map(dept => ({
        ...dept,
        subdepartments: buildTree(dept._id.toString())
      }));
  };

  return buildTree();
};

departmentSchema.statics.findByBudgetRange = function(min, max) {
  return this.find({
    'budget.allocated': { $gte: min, $lte: max },
    isActive: true
  }).sort({ 'budget.allocated': -1 });
};

// Instance Methods
departmentSchema.methods.addExpense = async function(amount, description = '') {
  if (amount <= 0) throw new Error('Expense amount must be positive');
  
  this.budget.spent += amount;
  if (this.budget.spent > this.budget.allocated) {
    console.warn(`Department ${this.name} has exceeded its budget`);
  }
  
  await this.save();
  return this;
};

module.exports = mongoose.model('Department', departmentSchema);
```

### 2. Department Controller (`controllers/departmentController.js`)

```javascript
const Department = require('../models/Department');
const Employee = require('../models/Employee');

exports.createDepartment = async (departmentData, createdBy) => {
  try {
    // Validate headOfDepartment if provided
    if (departmentData.headOfDepartment) {
      const employee = await Employee.findById(departmentData.headOfDepartment);
      if (!employee) throw new Error('Head of Department employee not found');
    }

    const department = new Department({
      ...departmentData,
      createdBy
    });

    await department.save();
    return department;
  } catch (error) {
    throw error;
  }
};

exports.updateDepartment = async (id, updateData) => {
  try {
    // Prevent circular references in parentDepartment
    if (updateData.parentDepartment && updateData.parentDepartment === id) {
      throw new Error('Department cannot be its own parent');
    }

    const department = await Department.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('headOfDepartment', 'personalInfo.firstName personalInfo.lastName');

    if (!department) throw new Error('Department not found');
    return department;
  } catch (error) {
    throw error;
  }
};

exports.getDepartmentHierarchy = async () => {
  return await Department.getHierarchy();
};

exports.getDepartmentDetails = async (id) => {
  const department = await Department.findById(id)
    .populate('headOfDepartment', 'personalInfo.firstName personalInfo.lastName employeeId')
    .populate('parentDepartment', 'name code')
    .lean();

  if (!department) throw new Error('Department not found');

  // Get budget utilization statistics
  department.budgetStats = {
    utilization: department.budgetUtilization,
    remaining: department.remainingBudget
  };

  // Count employees in department
  const employeeCount = await Employee.countDocuments({
    'employmentInfo.departmentId': id,
    'employmentInfo.status': 'active'
  });

  return { ...department, employeeCount };
};

exports.allocateBudget = async (id, amount, fiscalYear, currency = 'USD') => {
  const department = await Department.findById(id);
  if (!department) throw new Error('Department not found');

  department.budget = {
    allocated: amount,
    spent: 0,
    fiscalYear,
    currency
  };

  await department.save();
  return department;
};

exports.addDepartmentExpense = async (id, amount, description) => {
  const department = await Department.findById(id);
  if (!department) throw new Error('Department not found');

  await department.addExpense(amount, description);
  return department;
};

exports.listDepartments = async (filters = {}) => {
  const { search, activeOnly = true, minBudget, maxBudget } = filters;

  const query = {};
  if (activeOnly) query.isActive = true;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { tags: { $in: [search.toLowerCase()] } }
    ];
  }
  if (minBudget || maxBudget) {
    query['budget.allocated'] = {};
    if (minBudget) query['budget.allocated'].$gte = Number(minBudget);
    if (maxBudget) query['budget.allocated'].$lte = Number(maxBudget);
  }

  return await Department.find(query)
    .populate('headOfDepartment', 'personalInfo.firstName personalInfo.lastName')
    .sort({ name: 1 });
};
```

### 3. Department Routes (`routes/departmentRoutes.js`)

```javascript
const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { requireAdmin, requireHROrAdmin } = require('../middleware/auth');

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
```

### 4. Integration with Main App

```javascript
// app.js or server.js
const departmentRoutes = require('./routes/departmentRoutes');

// ... other middleware
app.use('/api/departments', departmentRoutes);
```

### Key Features Implemented:

1. **Organizational Structure**
   - Parent-child department relationships
   - Department hierarchy visualization
   - Head of department assignment

2. **Budget Management**
   - Annual budget allocation
   - Expense tracking
   - Budget utilization calculations
   - Currency support

3. **Location Management**
   - Physical/virtual/hybrid locations
   - Address details with geo-coordinates
   - Building/floor/room tracking

4. **Advanced Features**
   - Cost center tracking
   - Tagging system for categorization
   - Comprehensive search and filtering
   - Budget threshold alerts

### Example API Requests:

1. **Create Department**
   ```http
   POST /api/departments
   Authorization: Bearer <admin_token>
   Content-Type: application/json

   {
     "name": "Software Development",
     "code": "DEV",
     "description": "Responsible for all software products",
     "budget": {
       "allocated": 500000,
       "fiscalYear": 2023,
       "currency": "USD"
     },
     "location": {
       "type": "physical",
       "address": {
         "street": "123 Tech Blvd",
         "city": "San Francisco",
         "state": "CA",
         "zipCode": "94105"
       },
       "building": "Tech Center",
       "floor": "3"
     },
     "tags": ["engineering", "technology"]
   }
   ```

2. **Get Department Hierarchy**
   ```http
   GET /api/departments/hierarchy
   ```

3. **Add Department Expense**
   ```http
   POST /api/departments/DEV123/expenses
   Authorization: Bearer <hr_token>
   Content-Type: application/json

   {
     "amount": 1500,
     "description": "New development laptops"
   }
   ```

4. **Filter Departments**
   ```http
   GET /api/departments?search=tech&minBudget=100000
   ```
