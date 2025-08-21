const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const Department = require('../models/Department');
const Position = require('../models/Position');
const Grade = require('../models/Grade');
const moment = require('moment');

const reportController = {
  // ========== PAGINATED REPORTS ==========

  // Add this to reportController.js

// 4. Summary Dashboard Report
getSummaryReport: async (req, res) => {
  try {
    const [
      totalEmployees,
      activeEmployees,
      totalDepartments,
      totalPayrolls,
      recentHires,
      upcomingExpiries
    ] = await Promise.all([
      Employee.countDocuments({ isActive: true }),
      Employee.countDocuments({ 
        'employmentInfo.status': 'active', 
        isActive: true 
      }),
      Department.countDocuments({ isActive: true }),
      Payroll.countDocuments({ isActive: true }),
      Employee.find({ 
        'employmentInfo.status': 'active',
        isActive: true 
      })
        .sort({ 'employmentInfo.startDate': -1 })
        .limit(5)
        .select('employeeId personalInfo.firstName personalInfo.lastName employmentInfo.startDate')
        .populate('employmentInfo.departmentId', 'name'),
      Employee.aggregate([
        { $unwind: '$documents' },
        {
          $match: {
            'documents.expiryDate': { 
              $gte: new Date(),
              $lte: moment().add(30, 'days').toDate() 
            },
            isActive: true
          }
        },
        { $limit: 5 },
        {
          $project: {
            employeeId: 1,
            'personalInfo.firstName': 1,
            'personalInfo.lastName': 1,
            document: '$documents'
          }
        }
      ])
    ]);

    // Get current month payroll summary
    const currentMonth = moment().format('YYYY-MM');
    const payrollSummary = await Payroll.aggregate([
      {
        $match: { 
          payrollMonth: currentMonth,
          isActive: true 
        }
      },
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$grossPay' },
          totalNet: { $sum: '$netPay' },
          totalDeductions: { $sum: '$deductions.total' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      message: 'Summary report retrieved successfully',
      data: {
        counts: {
          totalEmployees,
          activeEmployees,
          totalDepartments,
          totalPayrolls: payrollSummary[0]?.count || 0
        },
        payroll: payrollSummary[0] || {
          totalGross: 0,
          totalNet: 0,
          totalDeductions: 0,
          count: 0
        },
        recentHires,
        upcomingExpiries
      }
    });
  } catch (error) {
    console.error('Summary report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving summary report',
      error: error.message
    });
  }
},
  // 1. Employee Directory Report
  getEmployeeDirectory: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        department,
        grade,
        status = 'active',
        search,
        sortBy = 'personalInfo.lastName',
        sortOrder = 'asc'
      } = req.query;

      const filter = {
        'employmentInfo.status': status,
        isActive: true
      };

      if (department) filter['employmentInfo.departmentId'] = department;
      if (grade) filter['employmentInfo.gradeId'] = grade;
      if (search) {
        filter.$or = [
          { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
          { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { 'personalInfo.email': { $regex: search, $options: 'i' } }
        ];
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        populate: [
          {
            path: 'employmentInfo.departmentId',
            select: 'name code'
          },
          {
            path: 'employmentInfo.gradeId',
            select: 'name code level'
          },
          {
            path: 'employmentInfo.positionId',
            select: 'name code'
          }
        ],
        select: `
          employeeId personalInfo.firstName personalInfo.lastName 
          personalInfo.email personalInfo.phoneNumber 
          employmentInfo.startDate employmentInfo.currentSalary 
          employmentInfo.status employmentInfo.employmentType
        `
      };

      const result = await Employee.paginate(filter, options);

      res.json({
        success: true,
        message: 'Employee directory retrieved successfully',
        data: {
          employees: result.docs,
          totalEmployees: result.totalDocs,
          currentPage: result.page,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        }
      });
    } catch (error) {
      console.error('Employee directory error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving employee directory',
        error: error.message
      });
    }
  },

  // 2. Payroll History Report
  getPayrollHistory: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        month,
        employee,
        department,
        minAmount,
        maxAmount,
        paymentStatus,
        sortBy = 'payrollMonth',
        sortOrder = 'desc'
      } = req.query;

      const filter = { isActive: true };

      if (month) filter.payrollMonth = month;
      if (employee) filter.employeeId = employee;
      if (paymentStatus) filter['payment.status'] = paymentStatus;
      if (minAmount) filter.netPay = { $gte: parseFloat(minAmount) };
      if (maxAmount) {
        filter.netPay = filter.netPay 
          ? { ...filter.netPay, $lte: parseFloat(maxAmount) }
          : { $lte: parseFloat(maxAmount) };
      }

      let employeeFilter = {};
      if (department) {
        const employees = await Employee.find({
          'employmentInfo.departmentId': department
        }).select('_id');
        const employeeIds = employees.map(emp => emp._id);
        filter.employeeId = { $in: employeeIds };
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        populate: [
          {
            path: 'employeeId',
            select: 'employeeId personalInfo.firstName personalInfo.lastName',
            populate: {
              path: 'employmentInfo.departmentId',
              select: 'name code'
            }
          }
        ]
      };

      const result = await Payroll.paginate(filter, options);

      res.json({
        success: true,
        message: 'Payroll history retrieved successfully',
        data: {
          payrolls: result.docs,
          totalRecords: result.totalDocs,
          currentPage: result.page,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        }
      });
    } catch (error) {
      console.error('Payroll history error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving payroll history',
        error: error.message
      });
    }
  },

  // 3. Document Expiry Report
  getDocumentExpiry: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        days = 30,
        documentType,
        department,
        sortBy = 'documents.expiryDate',
        sortOrder = 'asc'
      } = req.query;

      const futureDate = moment().add(parseInt(days), 'days').toDate();
      
      const pipeline = [
        { $unwind: '$documents' },
        {
          $match: {
            'documents.expiryDate': { $lte: futureDate, $gte: new Date() },
            isActive: true,
            ...(documentType && { 'documents.type': documentType })
          }
        }
      ];

      if (department) {
        pipeline.push({
          $lookup: {
            from: 'employees',
            let: { empId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$empId'] },
                      { $eq: ['$employmentInfo.departmentId', mongoose.Types.ObjectId(department)] }
                    ]
                  }
                }
              }
            ],
            as: 'empCheck'
          }
        });
        pipeline.push({
          $match: { empCheck: { $ne: [] } }
        });
      }

      pipeline.push(
        {
          $lookup: {
            from: 'departments',
            localField: 'employmentInfo.departmentId',
            foreignField: '_id',
            as: 'department'
          }
        },
        {
          $project: {
            employeeId: 1,
            'personalInfo.firstName': 1,
            'personalInfo.lastName': 1,
            'personalInfo.email': 1,
            document: '$documents',
            department: { $arrayElemAt: ['$department', 0] },
            daysToExpiry: {
              $divide: [
                { $subtract: ['$documents.expiryDate', new Date()] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } }
      );

      const totalDocs = await Employee.aggregate([...pipeline, { $count: 'total' }]);
      const total = totalDocs[0]?.total || 0;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const documents = await Employee.aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: parseInt(limit) }
      ]);

      const totalPages = Math.ceil(total / parseInt(limit));

      res.json({
        success: true,
        message: 'Document expiry report retrieved successfully',
        data: {
          documents,
          totalDocuments: total,
          currentPage: parseInt(page),
          totalPages,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      });
    } catch (error) {
      console.error('Document expiry error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving document expiry report',
        error: error.message
      });
    }
  },

  // ========== ANALYTICS ==========

  // 1. Department Analytics
  getDepartmentAnalytics: async (req, res) => {
    try {
      const { timeframe = '12' } = req.query; // months
      const monthsBack = parseInt(timeframe);
      const startDate = moment().subtract(monthsBack, 'months').startOf('month').toDate();

      // Department employee count and budget utilization
      const departmentStats = await Department.aggregate([
        {
          $match: { isActive: true }
        },
        {
          $lookup: {
            from: 'employees',
            let: { deptId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$employmentInfo.departmentId', '$$deptId'] },
                      { $eq: ['$employmentInfo.status', 'active'] }
                    ]
                  }
                }
              }
            ],
            as: 'employees'
          }
        },
        {
          $project: {
            name: 1,
            code: 1,
            budget: 1,
            employeeCount: { $size: '$employees' },
            budgetUtilization: {
              $cond: {
                if: { $gt: ['$budget.allocated', 0] },
                then: {
                  $multiply: [
                    { $divide: ['$budget.spent', '$budget.allocated'] },
                    100
                  ]
                },
                else: 0
              }
            },
            remainingBudget: {
              $subtract: ['$budget.allocated', '$budget.spent']
            }
          }
        },
        { $sort: { employeeCount: -1 } }
      ]);

      // Growth trends
      const growthTrends = await Employee.aggregate([
        {
          $match: {
            'employmentInfo.startDate': { $gte: startDate },
            isActive: true
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$employmentInfo.startDate' },
              month: { $month: '$employmentInfo.startDate' },
              department: '$employmentInfo.departmentId'
            },
            hires: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'departments',
            localField: '_id.department',
            foreignField: '_id',
            as: 'department'
          }
        },
        {
          $project: {
            year: '$_id.year',
            month: '$_id.month',
            departmentName: { $arrayElemAt: ['$department.name', 0] },
            hires: 1
          }
        },
        { $sort: { year: 1, month: 1 } }
      ]);

      res.json({
        success: true,
        message: 'Department analytics retrieved successfully',
        data: {
          departmentStats,
          growthTrends,
          summary: {
            totalDepartments: departmentStats.length,
            avgEmployeesPerDept: departmentStats.reduce((sum, dept) => sum + dept.employeeCount, 0) / departmentStats.length,
            totalBudgetAllocated: departmentStats.reduce((sum, dept) => sum + (dept.budget?.allocated || 0), 0),
            totalBudgetSpent: departmentStats.reduce((sum, dept) => sum + (dept.budget?.spent || 0), 0)
          }
        }
      });
    } catch (error) {
      console.error('Department analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving department analytics',
        error: error.message
      });
    }
  },

  // 2. Salary Analytics
  getSalaryAnalytics: async (req, res) => {
    try {
      const { department, grade } = req.query;

      const matchCondition = {
        'employmentInfo.status': 'active',
        isActive: true
      };

      if (department) matchCondition['employmentInfo.departmentId'] = mongoose.Types.ObjectId(department);
      if (grade) matchCondition['employmentInfo.gradeId'] = mongoose.Types.ObjectId(grade);

      // Salary distribution by grade
      const salaryByGrade = await Employee.aggregate([
        { $match: matchCondition },
        {
          $lookup: {
            from: 'grades',
            localField: 'employmentInfo.gradeId',
            foreignField: '_id',
            as: 'grade'
          }
        },
        {
          $group: {
            _id: {
              gradeId: '$employmentInfo.gradeId',
              gradeName: { $arrayElemAt: ['$grade.name', 0] },
              gradeLevel: { $arrayElemAt: ['$grade.level', 0] }
            },
            avgSalary: { $avg: '$employmentInfo.currentSalary' },
            minSalary: { $min: '$employmentInfo.currentSalary' },
            maxSalary: { $max: '$employmentInfo.currentSalary' },
            employeeCount: { $sum: 1 }
          }
        },
        { $sort: { '_id.gradeLevel': 1 } }
      ]);

      // Salary distribution by department
      const salaryByDepartment = await Employee.aggregate([
        { $match: matchCondition },
        {
          $lookup: {
            from: 'departments',
            localField: 'employmentInfo.departmentId',
            foreignField: '_id',
            as: 'department'
          }
        },
        {
          $group: {
            _id: {
              departmentId: '$employmentInfo.departmentId',
              departmentName: { $arrayElemAt: ['$department.name', 0] }
            },
            avgSalary: { $avg: '$employmentInfo.currentSalary' },
            totalSalary: { $sum: '$employmentInfo.currentSalary' },
            employeeCount: { $sum: 1 }
          }
        },
        { $sort: { avgSalary: -1 } }
      ]);

      // Salary ranges
      const salaryRanges = await Employee.aggregate([
        { $match: matchCondition },
        {
          $bucket: {
            groupBy: '$employmentInfo.currentSalary',
            boundaries: [0, 100000, 300000, 500000, 1000000, 2000000, Infinity],
            default: 'Other',
            output: {
              count: { $sum: 1 },
              avgSalary: { $avg: '$employmentInfo.currentSalary' }
            }
          }
        }
      ]);

      const overallStats = await Employee.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: null,
            totalEmployees: { $sum: 1 },
            avgSalary: { $avg: '$employmentInfo.currentSalary' },
            minSalary: { $min: '$employmentInfo.currentSalary' },
            maxSalary: { $max: '$employmentInfo.currentSalary' },
            totalPayroll: { $sum: '$employmentInfo.currentSalary' }
          }
        }
      ]);

      res.json({
        success: true,
        message: 'Salary analytics retrieved successfully',
        data: {
          salaryByGrade,
          salaryByDepartment,
          salaryRanges,
          overallStats: overallStats[0] || {}
        }
      });
    } catch (error) {
      console.error('Salary analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving salary analytics',
        error: error.message
      });
    }
  },

  // 3. Workforce Analytics
  getWorkforceAnalytics: async (req, res) => {
    try {
      const { period = '12' } = req.query;
      const monthsBack = parseInt(period);
      const startDate = moment().subtract(monthsBack, 'months').startOf('month').toDate();

      // Employee status distribution
      const statusDistribution = await Employee.aggregate([
        {
          $group: {
            _id: '$employmentInfo.status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Age distribution
      const ageDistribution = await Employee.aggregate([
        {
          $match: { 'employmentInfo.status': 'active' }
        },
        {
          $addFields: {
            age: {
              $divide: [
                { $subtract: [new Date(), '$personalInfo.dateOfBirth'] },
                365.25 * 24 * 60 * 60 * 1000
              ]
            }
          }
        },
        {
          $bucket: {
            groupBy: '$age',
            boundaries: [0, 25, 35, 45, 55, 65, 100],
            default: 'Other',
            output: {
              count: { $sum: 1 },
              avgAge: { $avg: '$age' }
            }
          }
        }
      ]);

      // Hiring trends
      const hiringTrends = await Employee.aggregate([
        {
          $match: {
            'employmentInfo.startDate': { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$employmentInfo.startDate' },
              month: { $month: '$employmentInfo.startDate' }
            },
            hires: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Tenure analysis
      const tenureAnalysis = await Employee.aggregate([
        {
          $match: { 'employmentInfo.status': 'active' }
        },
        {
          $addFields: {
            tenureMonths: {
              $divide: [
                { $subtract: [new Date(), '$employmentInfo.startDate'] },
                30.44 * 24 * 60 * 60 * 1000 // Average days in a month
              ]
            }
          }
        },
        {
          $bucket: {
            groupBy: '$tenureMonths',
            boundaries: [0, 6, 12, 24, 60, 120, Infinity],
            default: 'Other',
            output: {
              count: { $sum: 1 },
              avgTenure: { $avg: '$tenureMonths' }
            }
          }
        }
      ]);

      // Gender distribution
      const genderDistribution = await Employee.aggregate([
        {
          $match: { 'employmentInfo.status': 'active' }
        },
        {
          $group: {
            _id: '$personalInfo.gender',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        message: 'Workforce analytics retrieved successfully',
        data: {
          statusDistribution,
          ageDistribution,
          hiringTrends,
          tenureAnalysis,
          genderDistribution,
          summary: {
            totalEmployees: statusDistribution.reduce((sum, item) => sum + item.count, 0),
            activeEmployees: statusDistribution.find(item => item._id === 'active')?.count || 0,
            avgHiresPerMonth: hiringTrends.reduce((sum, item) => sum + item.hires, 0) / hiringTrends.length
          }
        }
      });
    } catch (error) {
      console.error('Workforce analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving workforce analytics',
        error: error.message
      });
    }
  }
};

module.exports = reportController;