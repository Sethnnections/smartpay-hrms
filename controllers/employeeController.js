const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Department = require('../models/Department');
const Grade = require('../models/Grade');
const User = require('../models/User');
const mongoose = require('mongoose');
const moment = require('moment');

// Create new employee
exports.createEmployee = async (req, res) => {
  try {
    // Validate request body structure
    if (!req.body || !req.body.personalInfo || !req.body.employmentInfo) {
      return res.status(400).json({
        success: false,
        message: 'Request body must include personalInfo and employmentInfo'
      });
    }

    // Destructure required fields with default empty objects to prevent undefined errors
    const { 
      personalInfo = {}, 
      employmentInfo = {}, 
      bankInfo = {} 
    } = req.body;

    // Validate required fields in employmentInfo
    if (!employmentInfo.positionId || !employmentInfo.departmentId || !employmentInfo.gradeId) {
      return res.status(400).json({
        success: false,
        message: 'employmentInfo must include positionId, departmentId, and gradeId'
      });
    }

    // Validate required fields in personalInfo
    const requiredPersonalFields = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'nationality', 'idNumber', 'phoneNumber', 'email'];
    for (const field of requiredPersonalFields) {
      if (!personalInfo[field]) {
        return res.status(400).json({
          success: false,
          message: `personalInfo.${field} is required`
        });
      }
    }

    // Validate required fields in bankInfo
    if (!bankInfo.bankName || !bankInfo.accountNumber || !bankInfo.accountName) {
      return res.status(400).json({
        success: false,
        message: 'bankInfo must include bankName, accountNumber, and accountName'
      });
    }

    // Validate associations exist
    const [position, department, grade, user] = await Promise.all([
      Position.findById(employmentInfo.positionId),
      Department.findById(employmentInfo.departmentId),
      Grade.findById(employmentInfo.gradeId),
      req.body.userId ? User.findById(req.body.userId) : Promise.resolve(null)
    ]);

    if (!position) {
      return res.status(400).json({ 
        success: false, 
        message: 'Position not found' 
      });
    }
    if (!department) {
      return res.status(400).json({ 
        success: false, 
        message: 'Department not found' 
      });
    }
    if (!grade) {
      return res.status(400).json({ 
        success: false, 
        message: 'Grade not found' 
      });
    }
    if (req.body.userId && !user) {
      return res.status(400).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Make manager validation optional
    if (employmentInfo.managerId) {
      const manager = await User.findById(employmentInfo.managerId);
      if (!manager) {
        return res.status(400).json({ 
          success: false, 
          message: 'Manager not found' 
        });
      }
    } else {
      // Remove managerId if it's empty
      delete employmentInfo.managerId;
    }

    // Validate position capacity
    if (position.capacity.filled >= position.capacity.total) {
      return res.status(400).json({ 
        success: false, 
        message: 'Position has no available capacity' 
      });
    }

    // Validate salary against grade range
    const salary = employmentInfo.currentSalary;
    if (salary === undefined || salary === null) {
      return res.status(400).json({ 
        success: false, 
        message: 'currentSalary is required' 
      });
    }
    
    if (salary < grade.salaryRange.minimum || salary > grade.salaryRange.maximum) {
      return res.status(400).json({ 
        success: false, 
        message: `Salary must be between ${grade.salaryRange.minimum} and ${grade.salaryRange.maximum} for this grade` 
      });
    }

    // Create employee
    const employee = new Employee({
      employeeId: req.body.employeeId || await generateEmployeeId(),
      personalInfo,
      employmentInfo,
      bankInfo,
      createdBy: req.user.id,
      ...(req.body.emergencyContact && { emergencyContact: req.body.emergencyContact }),
      ...(req.body.leaveBalance && { leaveBalance: req.body.leaveBalance }),
      ...(req.body.tags && { tags: req.body.tags })
    });

    await employee.save();
    
    // Update position capacity
    await Position.findByIdAndUpdate(
      employmentInfo.positionId,
      { $inc: { 'capacity.filled': 1, 'capacity.vacant': -1 } }
    );

    return res.status(201).json({ 
      success: true, 
      data: employee 
    });

  } catch (error) {
    console.error('Error creating employee:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// Helper function to generate employee ID
async function generateEmployeeId() {
  const lastEmployee = await Employee.findOne().sort({ createdAt: -1 });
  if (!lastEmployee) {
    return 'EMP10001';
  }
  const lastId = parseInt(lastEmployee.employeeId.replace('EMP', ''));
  return `EMP${lastId + 1}`;
}

// Get all employees with filtering, pagination, and sorting
// Update your getAllEmployees function in employeeController.js to include stats

exports.getAllEmployees = async (req, res) => {
  try {
    // Extract query parameters
    const {
      search,
      departmentId,
      positionId,
      gradeId,
      status = 'active',
      minSalary,
      maxSalary,
      minGradeLevel,
      maxGradeLevel,
      page = 1,
      limit = 10,
      sortBy = 'personalInfo.lastName',
      sortOrder = 'asc'
    } = req.query;

    // Build the query
    const query = {
      'employmentInfo.status': status
    };

    // Search filter
    if (search) {
      query.$or = [
        { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { 'personalInfo.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Department filter
    if (departmentId) {
      query['employmentInfo.departmentId'] = departmentId;
    }

    // Position filter
    if (positionId) {
      query['employmentInfo.positionId'] = positionId;
    }

    // Grade filter
    if (gradeId) {
      query['employmentInfo.gradeId'] = gradeId;
    }

    // Salary range filter
    if (minSalary || maxSalary) {
      query['employmentInfo.currentSalary'] = {};
      if (minSalary) query['employmentInfo.currentSalary'].$gte = Number(minSalary);
      if (maxSalary) query['employmentInfo.currentSalary'].$lte = Number(maxSalary);
    }

    // Grade level filter (requires aggregation)
    if (minGradeLevel || maxGradeLevel) {
      const gradeFilter = {};
      if (minGradeLevel) gradeFilter.level = { $gte: Number(minGradeLevel) };
      if (maxGradeLevel) gradeFilter.level = { $lte: Number(maxGradeLevel) };
      
      const matchingGrades = await Grade.find(gradeFilter).select('_id');
      const gradeIds = matchingGrades.map(g => g._id);
      
      query['employmentInfo.gradeId'] = { $in: gradeIds };
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const employees = await Employee.find(query)
      .populate('employmentInfo.positionId', 'name code')
      .populate('employmentInfo.departmentId', 'name code')
      .populate('employmentInfo.gradeId', 'name code level')
      .populate('employmentInfo.managerId', 'personalInfo.firstName personalInfo.lastName employeeId')
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    // Count total documents for pagination info
    const total = await Employee.countDocuments(query);

    // Calculate stats
    const [
      totalEmployees,
      activeEmployees,
      totalDepartments,
      departmentsWithEmployees,
      totalPositions,
      filledPositions,
      averageTenureData,
      newHiresThisYear
    ] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ 'employmentInfo.status': 'active' }),
      Department.countDocuments(),
      Employee.distinct('employmentInfo.departmentId', { 'employmentInfo.status': 'active' }),
      Position.countDocuments(),
      Position.countDocuments({ 'capacity.filled': { $gt: 0 } }),
      Employee.aggregate([
        {
          $match: { 'employmentInfo.status': 'active' }
        },
        {
          $group: {
            _id: null,
            avgTenure: {
              $avg: {
                $divide: [
                  { $subtract: [new Date(), '$employmentInfo.startDate'] },
                  1000 * 60 * 60 * 24 * 365.25 // Convert to years
                ]
              }
            }
          }
        }
      ]),
      Employee.countDocuments({
        'employmentInfo.startDate': {
          $gte: new Date(new Date().getFullYear(), 0, 1) // Start of current year
        }
      })
    ]);

    const stats = {
      totalEmployees,
      activeEmployees,
      totalDepartments,
      departmentsWithEmployees: departmentsWithEmployees.length,
      totalPositions,
      filledPositions,
      averageTenure: averageTenureData[0]?.avgTenure ? Math.round(averageTenureData[0].avgTenure * 10) / 10 : 0,
      newHiresThisYear
    };

    return res.status(200).json({
      success: true,
      data: employees,
      stats,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching employees:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get employee details
exports.getEmployeeDetails = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('position', 'name code')
      .populate('department', 'name code')
      .populate('grade', 'name code level baseSalary salaryRange allowances')
      .populate('manager', 'personalInfo.firstName personalInfo.lastName employeeId')
      .populate('user', 'email role');

    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: employee 
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};
// Update employee details
exports.updateEmployeeGrade = async (req, res) => {
  try {
    const { gradeId } = req.body;
    const { id } = req.params;

    if (!gradeId) {
      return res.status(400).json({
        success: false,
        message: 'gradeId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gradeId format'
      });
    }

    const [employee, grade] = await Promise.all([
      Employee.findById(id),
      Grade.findById(gradeId)
    ]);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    // Validate salary against new grade range
    const currentSalary = employee.employmentInfo.currentSalary;
    if (currentSalary < grade.salaryRange.minimum || currentSalary > grade.salaryRange.maximum) {
      return res.status(400).json({
        success: false,
        message: `Current salary ${currentSalary} is outside the range for grade ${grade.name} (${grade.salaryRange.minimum}-${grade.salaryRange.maximum})`
      });
    }

    employee.employmentInfo.gradeId = gradeId;
    await employee.save();

    const updatedEmployee = await Employee.findById(id)
      .populate('grade', 'name code level salaryRange');

    return res.status(200).json({
      success: true,
      message: 'Employee grade updated successfully',
      data: updatedEmployee
    });

  } catch (error) {
    console.error('Error updating employee grade:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update employee salary
exports.updateEmployeeSalary = async (req, res) => {
  try {
    const { salary } = req.body;
    const { id } = req.params;

    if (salary === undefined || salary === null) {
      return res.status(400).json({
        success: false,
        message: 'salary is required'
      });
    }

    if (typeof salary !== 'number' || salary < 0) {
      return res.status(400).json({
        success: false,
        message: 'salary must be a positive number'
      });
    }

    const employee = await Employee.findById(id)
      .populate('grade', 'salaryRange');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Validate against grade salary range if grade exists
    if (employee.grade) {
      const { minimum, maximum } = employee.grade.salaryRange;
      if (salary < minimum || salary > maximum) {
        return res.status(400).json({
          success: false,
          message: `Salary must be between ${minimum} and ${maximum} for this grade`
        });
      }
    }

    employee.employmentInfo.currentSalary = salary;
    await employee.save();

    return res.status(200).json({
      success: true,
      message: 'Employee salary updated successfully',
      data: {
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        previousSalary: employee.employmentInfo.currentSalary,
        newSalary: salary,
        effectiveDate: new Date()
      }
    });

  } catch (error) {
    console.error('Error updating employee salary:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// List employees with filters
exports.listEmployees = async (req, res) => {
  try {
    const { department, position, grade, status, search, page = 1, limit = 10 } = req.query;
    const query = {};

    if (department) {
      query['employmentInfo.departmentId'] = department;
    }

    if (position) {
      query['employmentInfo.positionId'] = position;
    }

    if (grade) {
      query['employmentInfo.gradeId'] = grade;
    }

    if (status) {
      query['employmentInfo.status'] = status;
    }

    if (search) {
      query.$or = [
        { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
        { 'employeeId': { $regex: search, $options: 'i' } },
        { 'personalInfo.email': { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { 'personalInfo.lastName': 1 },
      populate: [
        { path: 'employmentInfo.departmentId', select: 'name code' },
        { path: 'employmentInfo.positionId', select: 'name code' },
        { path: 'employmentInfo.gradeId', select: 'name code level' }
      ]
    };

    const employees = await Employee.paginate(query, options);

    return res.status(200).json({
      success: true,
      data: employees
    });

  } catch (error) {
    console.error('Error listing employees:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get employees by grade
exports.getEmployeesByGrade = async (req, res) => {
  try {
    const { gradeId } = req.params;
    const { status = 'active' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gradeId format'
      });
    }

    const employees = await Employee.find({
      'employmentInfo.gradeId': gradeId,
      'employmentInfo.status': status
    })
      .populate('position', 'name code')
      .populate('department', 'name code')
      .select('employeeId personalInfo.firstName personalInfo.lastName employmentInfo.currentSalary');

    return res.status(200).json({
      success: true,
      data: employees
    });

  } catch (error) {
    console.error('Error getting employees by grade:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get employee grade statistics
exports.getEmployeeGradeStats = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id)
      .populate('grade', 'name code level salaryRange');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!employee.grade) {
      return res.status(400).json({
        success: false,
        message: 'Employee does not have an assigned grade'
      });
    }

    // Get statistics for employees in the same grade
    const stats = await Employee.aggregate([
      {
        $match: {
          'employmentInfo.gradeId': employee.employmentInfo.gradeId,
          'employmentInfo.status': 'active'
        }
      },
      {
        $group: {
          _id: '$employmentInfo.gradeId',
          count: { $sum: 1 },
          avgSalary: { $avg: '$employmentInfo.currentSalary' },
          minSalary: { $min: '$employmentInfo.currentSalary' },
          maxSalary: { $max: '$employmentInfo.currentSalary' }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        employee: {
          employeeId: employee.employeeId,
          fullName: employee.fullName,
          currentSalary: employee.employmentInfo.currentSalary,
          grade: employee.grade
        },
        gradeStatistics: stats[0] || {}
      }
    });

  } catch (error) {
    console.error('Error getting employee grade stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Check promotion eligibility
exports.checkPromotionEligibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetGradeId } = req.query;

    if (!targetGradeId) {
      return res.status(400).json({
        success: false,
        message: 'targetGradeId query parameter is required'
      });
    }

    const [employee, currentGrade, targetGrade] = await Promise.all([
      Employee.findById(id)
        .populate('grade', 'name code level salaryRange')
        .populate('performanceReviews'),
      Grade.findById(employee.employmentInfo.gradeId),
      Grade.findById(targetGradeId)
    ]);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!currentGrade) {
      return res.status(400).json({
        success: false,
        message: 'Employee does not have a current grade assigned'
      });
    }

    if (!targetGrade) {
      return res.status(404).json({
        success: false,
        message: 'Target grade not found'
      });
    }

    // Check if target grade is higher than current grade
    if (targetGrade.level <= currentGrade.level) {
      return res.status(400).json({
        success: false,
        message: 'Target grade must be higher than current grade for promotion'
      });
    }

    // Check tenure (at least 1 year in current grade)
    const tenureInCurrentGrade = moment().diff(moment(employee.employmentInfo.startDate), 'months');
    const minTenure = 12; // 1 year
    const tenureEligible = tenureInCurrentGrade >= minTenure;

    // Check performance (average rating >= 3.5)
    const performanceEligible = employee.getAveragePerformanceRating() >= 3.5;

    // Check if salary would be within target grade range
    const currentSalary = employee.employmentInfo.currentSalary;
    const salaryEligible = currentSalary >= targetGrade.salaryRange.minimum && 
                          currentSalary <= targetGrade.salaryRange.maximum;

    // Check if there are any active disciplinary actions
    const hasDisciplinaryActions = employee.notes.some(note => 
      note.category === 'disciplinary' && 
      moment(note.createdAt).add(6, 'months').isAfter(moment())
    );

    const eligible = tenureEligible && performanceEligible && salaryEligible && !hasDisciplinaryActions;

    return res.status(200).json({
      success: true,
      data: {
        employee: {
          employeeId: employee.employeeId,
          fullName: employee.fullName,
          currentGrade: currentGrade.name,
          targetGrade: targetGrade.name
        },
        eligibility: {
          eligible,
          tenureEligible,
          tenureInCurrentGrade,
          performanceEligible,
          averageRating: employee.getAveragePerformanceRating(),
          salaryEligible,
          hasDisciplinaryActions,
          requirements: {
            minTenure: minTenure,
            minPerformanceRating: 3.5,
            salaryMustFitRange: true,
            noRecentDisciplinaryActions: true
          }
        }
      }
    });

  } catch (error) {
    console.error('Error checking promotion eligibility:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Process promotion
exports.processPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { gradeId, newSalary, effectiveDate } = req.body;

    if (!gradeId || !newSalary || !effectiveDate) {
      return res.status(400).json({
        success: false,
        message: 'gradeId, newSalary, and effectiveDate are required'
      });
    }

    const [employee, currentGrade, targetGrade] = await Promise.all([
      Employee.findById(id)
        .populate('grade', 'name code level salaryRange')
        .populate('performanceReviews'),
      Grade.findById(employee.employmentInfo.gradeId),
      Grade.findById(gradeId)
    ]);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!targetGrade) {
      return res.status(404).json({
        success: false,
        message: 'Target grade not found'
      });
    }

    // Check if target grade is higher than current grade
    if (targetGrade.level <= currentGrade.level) {
      return res.status(400).json({
        success: false,
        message: 'Target grade must be higher than current grade for promotion'
      });
    }

    // Check if salary is within target grade range
    if (newSalary < targetGrade.salaryRange.minimum || newSalary > targetGrade.salaryRange.maximum) {
      return res.status(400).json({
        success: false,
        message: `New salary must be between ${targetGrade.salaryRange.minimum} and ${targetGrade.salaryRange.maximum} for this grade`
      });
    }

    // Check if promotion is effective in the future
    if (moment(effectiveDate).isBefore(moment())) {
      return res.status(400).json({
        success: false,
        message: 'Promotion effective date must be in the future'
      });
    }

    // Update employee grade and salary
    employee.employmentInfo.gradeId = gradeId;
    employee.employmentInfo.currentSalary = newSalary;
    
    // Add promotion note
    employee.notes.push({
      content: `Promoted from ${currentGrade.name} to ${targetGrade.name} with new salary ${newSalary}, effective ${effectiveDate}`,
      category: 'achievement',
      createdBy: req.user.id
    });

    await employee.save();

    return res.status(200).json({
      success: true,
      message: 'Promotion processed successfully',
      data: {
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        previousGrade: currentGrade.name,
        newGrade: targetGrade.name,
        previousSalary: employee.employmentInfo.currentSalary,
        newSalary,
        effectiveDate
      }
    });

  } catch (error) {
    console.error('Error processing promotion:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get compensation breakdown
exports.getCompensationBreakdown = async (req, res) => {
  try {
    const { id } = req.params;
    const { month = moment().format('YYYY-MM') } = req.query;

    const employee = await Employee.findById(id)
      .populate('grade', 'payrollSettings allowances');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const compensation = await employee.calculateMonthlySalary(month);

    return res.status(200).json({
      success: true,
      data: {
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        month,
        compensation
      }
    });

  } catch (error) {
    console.error('Error getting compensation breakdown:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Deactivate employee
exports.deactivateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for deactivation is required'
      });
    }

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!employee.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Employee is already inactive'
      });
    }

    // Update employee status
    employee.isActive = false;
    employee.employmentInfo.status = 'inactive';
    employee.employmentInfo.endDate = new Date();
    
    // Add deactivation note
    employee.notes.push({
      content: `Employee deactivated. Reason: ${reason}`,
      category: 'general',
      createdBy: req.user.id
    });

    await employee.save();

    // Update position capacity
    if (employee.employmentInfo.positionId) {
      await Position.findByIdAndUpdate(
        employee.employmentInfo.positionId,
        { $inc: { 'capacity.filled': -1, 'capacity.vacant': 1 } }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Employee deactivated successfully',
      data: {
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        deactivationDate: new Date(),
        status: employee.employmentInfo.status
      }
    });

  } catch (error) {
    console.error('Error deactivating employee:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


// Add these methods to your existing employeeController.js

// Update employee details
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { personalInfo, employmentInfo, bankInfo, emergencyContact } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Validate grade and salary if being updated
    if (employmentInfo && employmentInfo.gradeId && employmentInfo.currentSalary) {
      const grade = await Grade.findById(employmentInfo.gradeId);
      if (!grade) {
        return res.status(400).json({
          success: false,
          message: 'Grade not found'
        });
      }

      if (employmentInfo.currentSalary < grade.salaryRange.minimum || 
          employmentInfo.currentSalary > grade.salaryRange.maximum) {
        return res.status(400).json({
          success: false,
          message: `Salary must be between ${grade.salaryRange.minimum} and ${grade.salaryRange.maximum} for this grade`
        });
      }
    }

    // Validate department and position if being updated
    if (employmentInfo && employmentInfo.departmentId) {
      const department = await Department.findById(employmentInfo.departmentId);
      if (!department) {
        return res.status(400).json({
          success: false,
          message: 'Department not found'
        });
      }
    }

    // Update fields
    if (personalInfo) {
      Object.assign(employee.personalInfo, personalInfo);
    }
    
    if (employmentInfo) {
      Object.assign(employee.employmentInfo, employmentInfo);
    }
    
    if (bankInfo) {
      Object.assign(employee.bankInfo, bankInfo);
    }
    
    if (emergencyContact) {
      Object.assign(employee.emergencyContact, emergencyContact);
    }

    await employee.save();

    // Populate the updated employee
    const updatedEmployee = await Employee.findById(id)
      .populate('employmentInfo.positionId', 'name code')
      .populate('employmentInfo.departmentId', 'name code')
      .populate('employmentInfo.gradeId', 'name code level')
      .populate('employmentInfo.managerId', 'personalInfo.firstName personalInfo.lastName');

    return res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: updatedEmployee
    });

  } catch (error) {
    console.error('Error updating employee:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update the existing getAllEmployees method to properly handle the populate fields
exports.getAllEmployees = async (req, res) => {
  try {
    // Extract query parameters
    const {
      search,
      departmentId,
      positionId,
      gradeId,
      status = 'active',
      minSalary,
      maxSalary,
      minGradeLevel,
      maxGradeLevel,
      page = 1,
      limit = 10,
      sortBy = 'personalInfo.lastName',
      sortOrder = 'asc'
    } = req.query;

    // Build the query
    const query = {
      'employmentInfo.status': status
    };

    // Search filter
    if (search) {
      query.$or = [
        { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { 'personalInfo.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Department filter
    if (departmentId) {
      query['employmentInfo.departmentId'] = departmentId;
    }

    // Position filter
    if (positionId) {
      query['employmentInfo.positionId'] = positionId;
    }

    // Grade filter
    if (gradeId) {
      query['employmentInfo.gradeId'] = gradeId;
    }

    // Salary range filter
    if (minSalary || maxSalary) {
      query['employmentInfo.currentSalary'] = {};
      if (minSalary) query['employmentInfo.currentSalary'].$gte = Number(minSalary);
      if (maxSalary) query['employmentInfo.currentSalary'].$lte = Number(maxSalary);
    }

    // Grade level filter (requires aggregation)
    if (minGradeLevel || maxGradeLevel) {
      const gradeFilter = {};
      if (minGradeLevel) gradeFilter.level = { $gte: Number(minGradeLevel) };
      if (maxGradeLevel) gradeFilter.level = { $lte: Number(maxGradeLevel) };
      
      const matchingGrades = await Grade.find(gradeFilter).select('_id');
      const gradeIds = matchingGrades.map(g => g._id);
      
      query['employmentInfo.gradeId'] = { $in: gradeIds };
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const employees = await Employee.find(query)
      .populate({
        path: 'employmentInfo.positionId',
        select: 'name code',
        model: 'Position'
      })
      .populate({
        path: 'employmentInfo.departmentId',
        select: 'name code',
        model: 'Department'
      })
      .populate({
        path: 'employmentInfo.gradeId',
        select: 'name code level',
        model: 'Grade'
      })
      .populate({
        path: 'employmentInfo.managerId',
        select: 'personalInfo.firstName personalInfo.lastName employeeId',
        model: 'Employee'
      })
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean(); // Use lean() for better performance

    // Count total documents for pagination info
    const total = await Employee.countDocuments(query);

    // Calculate stats
    const [
      totalEmployees,
      activeEmployees,
      totalDepartments,
      departmentsWithEmployees,
      totalPositions,
      filledPositions,
      averageTenureData,
      newHiresThisYear
    ] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ 'employmentInfo.status': 'active' }),
      Department.countDocuments(),
      Employee.distinct('employmentInfo.departmentId', { 'employmentInfo.status': 'active' }),
      Position.countDocuments(),
      Position.countDocuments({ 'capacity.filled': { $gt: 0 } }),
      Employee.aggregate([
        {
          $match: { 'employmentInfo.status': 'active' }
        },
        {
          $group: {
            _id: null,
            avgTenure: {
              $avg: {
                $divide: [
                  { $subtract: [new Date(), '$employmentInfo.startDate'] },
                  1000 * 60 * 60 * 24 * 365.25 // Convert to years
                ]
              }
            }
          }
        }
      ]),
      Employee.countDocuments({
        'employmentInfo.startDate': {
          $gte: new Date(new Date().getFullYear(), 0, 1) // Start of current year
        }
      })
    ]);

    const stats = {
      totalEmployees,
      activeEmployees,
      totalDepartments,
      departmentsWithEmployees: departmentsWithEmployees.length,
      totalPositions,
      filledPositions,
      averageTenure: averageTenureData[0]?.avgTenure ? Math.round(averageTenureData[0].avgTenure * 10) / 10 : 0,
      newHiresThisYear
    };

    return res.status(200).json({
      success: true,
      data: employees,
      stats,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching employees:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update getEmployeeDetails to properly populate references
exports.getEmployeeDetails = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate({
        path: 'employmentInfo.positionId',
        select: 'name code',
        model: 'Position'
      })
      .populate({
        path: 'employmentInfo.departmentId',
        select: 'name code',
        model: 'Department'
      })
      .populate({
        path: 'employmentInfo.gradeId',
        select: 'name code level baseSalary salaryRange allowances',
        model: 'Grade'
      })
      .populate({
        path: 'employmentInfo.managerId',
        select: 'personalInfo.firstName personalInfo.lastName employeeId',
        model: 'Employee'
      })
      .populate({
        path: 'userId',
        select: 'email role',
        model: 'User'
      });

    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: employee 
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message
    });
  }
};
module.exports = exports;