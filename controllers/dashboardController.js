const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Payroll = require('../models/Payroll');
const moment = require('moment');
const logger = require('../utils/logger');

class DashboardController {
  // Overall dashboard summary
  static async getDashboardSummary(req, res) {
    try {
      const { period = '12', type = 'month' } = req.query;
      const periodNum = parseInt(period);
      
      // Calculate date range
      const endDate = moment();
      const startDate = moment().subtract(periodNum, type);
      
      // Employee summary
      const employeeStats = await Employee.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
           // Replace all status checks with isActive
active: [
  { $match: { isActive: true } },
  { $count: "count" }
],

            byStatus: [
              { $group: { _id: '$employmentInfo.status', count: { $sum: 1 } } }
            ],
            byType: [
              { $group: { _id: '$employmentInfo.employmentType', count: { $sum: 1 } } }
            ],
            newHires: [
              {
                $match: {
                  'employmentInfo.startDate': {
                    $gte: startDate.toDate(),
                    $lte: endDate.toDate()
                  }
                }
              },
              { $count: "count" }
            ],
           terminations: [
            {
              $match: {
                isActive: false, // Changed from status check
                'employmentInfo.endDate': {
                  $gte: startDate.toDate(),
                  $lte: endDate.toDate()
                }
              }
            },
            { $count: "count" }
],
          }
        }
      ]);
      
      // Department summary
      const departmentStats = await Department.aggregate([
        {
          $facet: {
            total: [{ $match: { isActive: true } }, { $count: "count" }],
            budgetUtilization: [
              { $match: { isActive: true } },
              {
                $group: {
                  _id: null,
                  totalAllocated: { $sum: '$budget.allocated' },
                  totalSpent: { $sum: '$budget.spent' },
                  avgUtilization: {
                    $avg: {
                      $cond: [
                        { $gt: ['$budget.allocated', 0] },
                        { $multiply: [{ $divide: ['$budget.spent', '$budget.allocated'] }, 100] },
                        0
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      ]);
      
      // Payroll summary for current month
      const currentMonth = moment().format('YYYY-MM');
      const payrollStats = await Payroll.getSummary(currentMonth);
      
      // Recent payroll trends
      const payrollTrends = await DashboardController.getPayrollTrends(periodNum, type);
      
      res.json({
        success: true,
        data: {
          period: { value: periodNum, type, startDate, endDate },
          employees: {
            total: employeeStats[0].total[0]?.count || 0,
            active: employeeStats[0].active[0]?.count || 0,
            newHires: employeeStats[0].newHires[0]?.count || 0,
            terminations: employeeStats[0].terminations[0]?.count || 0,
            byStatus: employeeStats[0].byStatus,
            byType: employeeStats[0].byType
          },
          departments: {
            total: departmentStats[0].total[0]?.count || 0,
            budgetSummary: departmentStats[0].budgetUtilization[0] || {
              totalAllocated: 0,
              totalSpent: 0,
              avgUtilization: 0
            }
          },
          payroll: {
            current: payrollStats[0] || {},
            trends: payrollTrends
          }
        }
      });
    } catch (error) {
      logger.error('Dashboard summary error:', error);
      res.status(500).json({ success: false, message: 'Failed to get dashboard summary', error: error.message });
    }
  }
  
  // Employee analytics with trends
  static async getEmployeeAnalytics(req, res) {
    try {
      const { period = '12', type = 'month', department, status } = req.query;
      const periodNum = parseInt(period);
      
      const endDate = moment();
      const startDate = moment().subtract(periodNum, type);
      
      // Build match criteria

      const matchCriteria = { isActive: true };
      if (department) matchCriteria['employmentInfo.departmentId'] = department;
      
      // Employee trends over time
      const trends = await Employee.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: {
              year: { $year: '$employmentInfo.startDate' },
              month: { $month: '$employmentInfo.startDate' },
              status: '$employmentInfo.status'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
      
      // Age distribution
      const ageDistribution = await Employee.aggregate([
        { $match: matchCriteria },
        {
          $project: {
            age: {
              $floor: {
                $divide: [
                  { $subtract: [new Date(), '$personalInfo.dateOfBirth'] },
                  365.25 * 24 * 60 * 60 * 1000
                ]
              }
            }
          }
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$age', 25] }, then: '18-24' },
                  { case: { $lt: ['$age', 35] }, then: '25-34' },
                  { case: { $lt: ['$age', 45] }, then: '35-44' },
                  { case: { $lt: ['$age', 55] }, then: '45-54' },
                  { case: { $gte: ['$age', 55] }, then: '55+' }
                ],
                default: 'Unknown'
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Tenure distribution
      const tenureDistribution = await Employee.aggregate([
        { $match: matchCriteria },
        {
          $project: {
            tenureMonths: {
              $floor: {
                $divide: [
                  { $subtract: [new Date(), '$employmentInfo.startDate'] },
                  30.44 * 24 * 60 * 60 * 1000
                ]
              }
            }
          }
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$tenureMonths', 6] }, then: '0-6 months' },
                  { case: { $lt: ['$tenureMonths', 12] }, then: '6-12 months' },
                  { case: { $lt: ['$tenureMonths', 24] }, then: '1-2 years' },
                  { case: { $lt: ['$tenureMonths', 60] }, then: '2-5 years' },
                  { case: { $gte: ['$tenureMonths', 60] }, then: '5+ years' }
                ],
                default: 'Unknown'
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Department breakdown
      const departmentBreakdown = await Employee.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'departments',
            localField: 'employmentInfo.departmentId',
            foreignField: '_id',
            as: 'department'
          }
        },
        { $unwind: '$department' },
        {
          $group: {
            _id: '$department.name',
            count: { $sum: 1 },
            avgSalary: { $avg: '$employmentInfo.currentSalary' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      // Gender distribution
      const genderDistribution = await Employee.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$personalInfo.gender',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Turnover rate calculation
      const totalEmployees = await Employee.countDocuments(matchCriteria);
      const terminationsInPeriod = await Employee.countDocuments({
            isActive: false, // Changed from status check
            'employmentInfo.endDate': {
              $gte: startDate.toDate(),
              $lte: endDate.toDate()
            }
          });
      
      const turnoverRate = totalEmployees > 0 ? ((terminationsInPeriod / totalEmployees) * 100).toFixed(2) : 0;
      
      res.json({
        success: true,
        data: {
          period: { value: periodNum, type, startDate, endDate },
          summary: {
            totalEmployees,
            turnoverRate: parseFloat(turnoverRate)
          },
          trends,
          distributions: {
            age: ageDistribution,
            tenure: tenureDistribution,
            gender: genderDistribution,
            department: departmentBreakdown
          }
        }
      });
    } catch (error) {
      logger.error('Employee analytics error:', error);
      res.status(500).json({ success: false, message: 'Failed to get employee analytics', error: error.message });
    }
  }
  
  // Department analytics
  static async getDepartmentAnalytics(req, res) {
    try {
      const { period = '12', type = 'month' } = req.query;
      const periodNum = parseInt(period);
      
      const endDate = moment();
      const startDate = moment().subtract(periodNum, type);
      
      // Department performance metrics
      const departmentMetrics = await Department.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'employees',
            localField: '_id',
            foreignField: 'employmentInfo.departmentId',
            as: 'employees',
            pipeline: [
                { $match: { isActive: true } } // Changed from status check
              ]
            }
        },
        {
          $project: {
            name: 1,
            code: 1,
            budget: 1,
            employeeCount: { $size: '$employees' },
            budgetUtilization: {
              $cond: [
                { $gt: ['$budget.allocated', 0] },
                { $multiply: [{ $divide: ['$budget.spent', '$budget.allocated'] }, 100] },
                0
              ]
            },
            remainingBudget: { $subtract: ['$budget.allocated', '$budget.spent'] },
            avgSalary: { $avg: '$employees.employmentInfo.currentSalary' }
          }
        },
        { $sort: { employeeCount: -1 } }
      ]);
      
      // Budget trends by department
      const budgetTrends = await Department.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$budget.fiscalYear',
            totalAllocated: { $sum: '$budget.allocated' },
            totalSpent: { $sum: '$budget.spent' },
            departments: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]);
      
      // Employee distribution by department
      const employeeDistribution = await Employee.aggregate([
       {
          $match: {
            isActive: true, // Changed from status check
          }
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'employmentInfo.departmentId',
            foreignField: '_id',
            as: 'department'
          }
        },
        { $unwind: '$department' },
        {
          $group: {
            _id: '$department.name',
            totalEmployees: { $sum: 1 },
            avgSalary: { $avg: '$employmentInfo.currentSalary' },
            salaryRange: {
              min: { $min: '$employmentInfo.currentSalary' },
              max: { $max: '$employmentInfo.currentSalary' }
            }
          }
        }
      ]);
      
      res.json({
        success: true,
        data: {
          period: { value: periodNum, type, startDate, endDate },
          departmentMetrics,
          budgetTrends,
          employeeDistribution
        }
      });
    } catch (error) {
      logger.error('Department analytics error:', error);
      res.status(500).json({ success: false, message: 'Failed to get department analytics', error: error.message });
    }
  }
  
  // Payroll analytics and trends
  static async getPayrollAnalytics(req, res) {
    try {
      const { period = '12', type = 'month', department } = req.query;
      const periodNum = parseInt(period);
      
      // Generate month range
      const months = [];
      for (let i = periodNum - 1; i >= 0; i--) {
        months.push(moment().subtract(i, 'months').format('YYYY-MM'));
      }
      
      // Build match criteria
      const matchCriteria = { isActive: true, payrollMonth: { $in: months } };
      if (department) {
         const deptEmployees = await Employee.find({
          'employmentInfo.departmentId': department,
          isActive: true // Changed from status check
        }).select('_id');
        matchCriteria.employeeId = { $in: deptEmployees.map(emp => emp._id) };
      }
      
      // Monthly payroll trends
      const monthlyTrends = await Payroll.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$payrollMonth',
            totalEmployees: { $sum: 1 },
            totalGrossPay: { $sum: '$grossPay' },
            totalNetPay: { $sum: '$netPay' },
            totalDeductions: { $sum: '$deductions.total' },
            totalTax: { $sum: '$deductions.tax.amount' },
            totalPension: { $sum: '$deductions.pension.amount' },
            avgGrossPay: { $avg: '$grossPay' },
            avgNetPay: { $avg: '$netPay' }
          }
        },
        { $sort: { '_id': 1 } }
      ]);
      
      // Salary distribution
      const salaryDistribution = await Payroll.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$salary.base', 100000] }, then: '< 100K' },
                  { case: { $lt: ['$salary.base', 300000] }, then: '100K - 300K' },
                  { case: { $lt: ['$salary.base', 500000] }, then: '300K - 500K' },
                  { case: { $lt: ['$salary.base', 1000000] }, then: '500K - 1M' },
                  { case: { $gte: ['$salary.base', 1000000] }, then: '1M+' }
                ],
                default: 'Unknown'
              }
            },
            count: { $sum: 1 },
            avgGrossPay: { $avg: '$grossPay' }
          }
        }
      ]);
      
      // Department payroll comparison
      const departmentPayroll = await Payroll.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'employees',
            localField: 'employeeId',
            foreignField: '_id',
            as: 'employee'
          }
        },
        { $unwind: '$employee' },
        {
          $lookup: {
            from: 'departments',
            localField: 'employee.employmentInfo.departmentId',
            foreignField: '_id',
            as: 'department'
          }
        },
        { $unwind: '$department' },
        {
          $group: {
            _id: '$department.name',
            totalEmployees: { $sum: 1 },
            totalPayroll: { $sum: '$netPay' },
            avgSalary: { $avg: '$salary.base' },
            totalTax: { $sum: '$deductions.tax.amount' },
            totalBenefits: { $sum: '$allowances.total' }
          }
        },
        { $sort: { totalPayroll: -1 } }
      ]);
      
      // Tax analysis
      const taxAnalysis = await Payroll.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$payrollMonth',
            totalTaxCollected: { $sum: '$deductions.tax.amount' },
            avgTaxRate: { $avg: '$deductions.tax.rate' },
            employeesCount: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]);
      
      // Overtime trends
      const overtimeTrends = await Payroll.aggregate([
        { 
          $match: { 
            ...matchCriteria, 
            'overtime.hours': { $gt: 0 } 
          } 
        },
        {
          $group: {
            _id: '$payrollMonth',
            totalOvertimeHours: { $sum: '$overtime.hours' },
            totalOvertimePay: { $sum: '$overtime.amount' },
            employeesWithOvertime: { $sum: 1 },
            avgOvertimeHours: { $avg: '$overtime.hours' }
          }
        },
        { $sort: { '_id': 1 } }
      ]);
      
      res.json({
        success: true,
        data: {
          period: { value: periodNum, type, months },
          monthlyTrends,
          salaryDistribution,
          departmentPayroll,
          taxAnalysis,
          overtimeTrends
        }
      });
    } catch (error) {
      logger.error('Payroll analytics error:', error);
      res.status(500).json({ success: false, message: 'Failed to get payroll analytics', error: error.message });
    }
  }
  
  // Performance analytics
  static async getPerformanceAnalytics(req, res) {
    try {
      const { period = '12', type = 'month', department } = req.query;
      const periodNum = parseInt(period);
      
      const endDate = moment();
      const startDate = moment().subtract(periodNum, type);
      
      // Build match criteria
        const matchCriteria = {
        isActive: true, // Changed from status check
        'performanceReviews.reviewDate': {
          $gte: startDate.toDate(),
          $lte: endDate.toDate()
        }
      };
            
      if (department) {
        matchCriteria['employmentInfo.departmentId'] = department;
      }
      
      // Performance ratings distribution
      const ratingsDistribution = await Employee.aggregate([
        { $match: matchCriteria },
        { $unwind: '$performanceReviews' },
        {
          $match: {
            'performanceReviews.reviewDate': {
              $gte: startDate.toDate(),
              $lte: endDate.toDate()
            }
          }
        },
        {
          $group: {
            _id: '$performanceReviews.overallRating',
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]);
      
      // Average ratings by department
      const departmentRatings = await Employee.aggregate([
        { $match: matchCriteria },
        { $unwind: '$performanceReviews' },
        {
          $match: {
            'performanceReviews.reviewDate': {
              $gte: startDate.toDate(),
              $lte: endDate.toDate()
            }
          }
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'employmentInfo.departmentId',
            foreignField: '_id',
            as: 'department'
          }
        },
        { $unwind: '$department' },
        {
          $group: {
            _id: '$department.name',
            avgRating: { $avg: '$performanceReviews.overallRating' },
            reviewCount: { $sum: 1 }
          }
        },
        { $sort: { avgRating: -1 } }
      ]);
      
      // Top performers
      const topPerformers = await Employee.aggregate([
        { $match: matchCriteria },
        { $unwind: '$performanceReviews' },
        {
          $match: {
            'performanceReviews.reviewDate': {
              $gte: startDate.toDate(),
              $lte: endDate.toDate()
            }
          }
        },
        {
          $group: {
            _id: '$_id',
            employeeId: { $first: '$employeeId' },
            fullName: { 
              $first: { 
                $concat: ['$personalInfo.firstName', ' ', '$personalInfo.lastName'] 
              } 
            },
            avgRating: { $avg: '$performanceReviews.overallRating' },
            reviewCount: { $sum: 1 }
          }
        },
        { $sort: { avgRating: -1 } },
        { $limit: 10 }
      ]);
      
      res.json({
        success: true,
        data: {
          period: { value: periodNum, type, startDate, endDate },
          ratingsDistribution,
          departmentRatings,
          topPerformers
        }
      });
    } catch (error) {
      logger.error('Performance analytics error:', error);
      res.status(500).json({ success: false, message: 'Failed to get performance analytics', error: error.message });
    }
  }
  
  // Helper method for payroll trends
  static async getPayrollTrends(periodNum, type) {
    const months = [];
    for (let i = periodNum - 1; i >= 0; i--) {
      months.push(moment().subtract(i, 'months').format('YYYY-MM'));
    }
    
    return await Payroll.aggregate([
      { $match: { payrollMonth: { $in: months }, isActive: true } },
      {
        $group: {
          _id: '$payrollMonth',
          totalGrossPay: { $sum: '$grossPay' },
          totalNetPay: { $sum: '$netPay' },
          employeeCount: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
  }
  
  // Custom analytics query endpoint
  static async getCustomAnalytics(req, res) {
    try {
      const { 
        metric, 
        period = '12', 
        type = 'month', 
        groupBy, 
        department, 
        status,
        startDate,
        endDate 
      } = req.query;
      
      // Build date range
      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          start: moment(startDate).toDate(),
          end: moment(endDate).toDate()
        };
      } else {
        const periodNum = parseInt(period);
        dateRange = {
          start: moment().subtract(periodNum, type).toDate(),
          end: moment().toDate()
        };
      }
      
      let result = {};
      
      switch (metric) {
        case 'headcount':
          result = await this.getHeadcountAnalytics(dateRange, groupBy, department, status);
          break;
        case 'salary':
          result = await this.getSalaryAnalytics(dateRange, groupBy, department);
          break;
        case 'turnover':
          result = await this.getTurnoverAnalytics(dateRange, groupBy, department);
          break;
        case 'budget':
          result = await this.getBudgetAnalytics(dateRange, groupBy);
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid metric. Available: headcount, salary, turnover, budget' 
          });
      }
      
      res.json({
        success: true,
        data: {
          metric,
          period: dateRange,
          groupBy,
          filters: { department, status },
          result
        }
      });
    } catch (error) {
      logger.error('Custom analytics error:', error);
      res.status(500).json({ success: false, message: 'Failed to get custom analytics', error: error.message });
    }
  }
  
  // Helper methods for custom analytics
  static async getHeadcountAnalytics(dateRange, groupBy, department, status) {
    const matchCriteria = { isActive: true };
    if (department) matchCriteria['employmentInfo.departmentId'] = department;
    if (status) matchCriteria['employmentInfo.status'] = status;
    
    const groupField = groupBy === 'department' ? '$employmentInfo.departmentId' : 
                      groupBy === 'status' ? '$employmentInfo.status' :
                      groupBy === 'type' ? '$employmentInfo.employmentType' : null;
    
    return await Employee.aggregate([
      { $match: matchCriteria },
      groupField ? {
        $group: {
          _id: groupField,
          count: { $sum: 1 },
          avgSalary: { $avg: '$employmentInfo.currentSalary' }
        }
      } : { $count: 'total' }
    ].filter(Boolean));
  }
  
  static async getSalaryAnalytics(dateRange, groupBy, department) {
    const matchCriteria = { 
      isActive: true,
      'employmentInfo.status': 'active'
    };
    if (department) matchCriteria['employmentInfo.departmentId'] = department;
    
    return await Employee.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: groupBy === 'department' ? '$employmentInfo.departmentId' : null,
          avgSalary: { $avg: '$employmentInfo.currentSalary' },
          minSalary: { $min: '$employmentInfo.currentSalary' },
          maxSalary: { $max: '$employmentInfo.currentSalary' },
          totalSalary: { $sum: '$employmentInfo.currentSalary' },
          count: { $sum: 1 }
        }
      }
    ]);
  }
  
  static async getTurnoverAnalytics(dateRange, groupBy, department) {
   const matchCriteria = {
  'employmentInfo.endDate': {
    $gte: dateRange.start,
    $lte: dateRange.end
  },
  isActive: false // Changed from status check
};
    if (department) matchCriteria['employmentInfo.departmentId'] = department;
    
    return await Employee.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: groupBy === 'department' ? '$employmentInfo.departmentId' : 
               groupBy === 'status' ? '$employmentInfo.status' : null,
          turnoverCount: { $sum: 1 },
          avgTenure: { 
            $avg: { 
              $divide: [
                { $subtract: ['$employmentInfo.endDate', '$employmentInfo.startDate'] },
                30.44 * 24 * 60 * 60 * 1000
              ]
            } 
          }
        }
      }
    ]);
  }
  
  static async getBudgetAnalytics(dateRange, groupBy) {
    return await Department.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: groupBy === 'fiscalYear' ? '$budget.fiscalYear' : null,
          totalAllocated: { $sum: '$budget.allocated' },
          totalSpent: { $sum: '$budget.spent' },
          avgUtilization: {
            $avg: {
              $cond: [
                { $gt: ['$budget.allocated', 0] },
                { $multiply: [{ $divide: ['$budget.spent', '$budget.allocated'] }, 100] },
                0
              ]
            }
          },
          departmentCount: { $sum: 1 }
        }
      }
    ]);
  }
}

module.exports = DashboardController;