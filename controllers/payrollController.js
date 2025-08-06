const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Grade = require('../models/Grade');
const moment = require('moment');

const payrollController = {
  // Process payroll for all active employees
  processAllEmployees: async (month, processedBy) => {
    try {
      if (!month || !moment(month, 'YYYY-MM', true).isValid()) {
        throw new Error('Invalid month format. Use YYYY-MM');
      }

      const payrollRecords = await Payroll.processAllEmployees(month, processedBy);
      
      return {
        success: true,
        message: `Processed payroll for ${payrollRecords.length} employees`,
        month: month,
        processedCount: payrollRecords.length,
        payrollIds: payrollRecords.map(p => p._id)
      };
    } catch (error) {
      throw error;
    }
  },

  

  // Get payroll list with filters
listPayrolls: async (filters = {}) => {
  try {
    const user = filters.user;
    
    if (!user) {
      throw new Error('Authentication required');
    }

    // Validate and set default pagination parameters
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const skip = (page - 1) * limit;

    // Set default query
    let query = { isActive: true };

    // Admin users can see all payrolls without restrictions
    if (user.role !== 'admin') {
      // HR users can see all payrolls but with possible filters
      if (user.role !== 'hr') {
        // Regular employees can only see their own payroll
        if (!user.employeeId) {
          throw new Error('Employee record not found for user');
        }
        query.employeeId = user.employeeId;
      }
    }

    // Apply filters from query parameters
    if (filters.month) query.payrollMonth = filters.month;
    if (filters.employeeId) query.employeeId = filters.employeeId;
    if (filters.paymentStatus) query['payment.status'] = filters.paymentStatus;

    const [payrolls, total] = await Promise.all([
      Payroll.find(query)
        .populate({
          path: 'employeeId',
          select: 'employeeId personalInfo.firstName personalInfo.lastName employmentInfo.departmentId',
          populate: {
            path: 'employmentInfo.departmentId',
            select: 'name code'
          }
        })
        .populate('processedBy', 'email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payroll.countDocuments(query)
    ]);

    return {
      payrolls,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  } catch (error) {
    console.error('Payroll listing error:', error);
    throw error;
  }
},
  // Get single payroll details
  getPayrollDetails: async (payrollId) => {
    try {
      const payroll = await Payroll.findById(payrollId)
        .populate({
          path: 'employeeId',
          populate: [
            { path: 'employmentInfo.departmentId', select: 'name code' },
            { path: 'employmentInfo.positionId', select: 'name code' },
            { path: 'employmentInfo.gradeId', select: 'name code level' }
          ]
        })
        .populate('processedBy', 'email')
        .populate('approvals.hr.by', 'email')
        .populate('approvals.finance.by', 'email');

      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      return payroll;
    } catch (error) {
      throw error;
    }
  },

  // Update payroll record
  updatePayroll: async (payrollId, updateData, userId) => {
    try {
      const payroll = await Payroll.findById(payrollId);
      
      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      // Prevent updates to paid payrolls
      if (payroll.payment.status === 'paid') {
        const error = new Error('Cannot update paid payroll records');
        error.statusCode = 400;
        throw error;
      }

      // Update allowed fields
      const allowedUpdates = [
        'payPeriod.daysWorked',
        'bonuses.performance',
        'bonuses.annual',
        'bonuses.other',
        'deductions.other',
        'notes'
      ];

      Object.keys(updateData).forEach(key => {
        if (allowedUpdates.includes(key)) {
          if (key.includes('.')) {
            const [parent, child] = key.split('.');
            if (payroll[parent]) {
              payroll[parent][child] = updateData[key];
            }
          } else {
            payroll[key] = updateData[key];
          }
        }
      });

      const updatedPayroll = await payroll.save();
      return updatedPayroll;
    } catch (error) {
      throw error;
    }
  },

  // Approve payroll (HR or Finance)
  approvePayroll: async (payrollId, approvalType, userId, notes = '') => {
    try {
      const payroll = await Payroll.findById(payrollId);
      
      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      if (!['hr', 'finance'].includes(approvalType)) {
        const error = new Error('Invalid approval type. Must be "hr" or "finance"');
        error.statusCode = 400;
        throw error;
      }

      await payroll.approve(approvalType, userId, notes);
      
      return payroll;
    } catch (error) {
      throw error;
    }
  },

  // Reject payroll
  rejectPayroll: async (payrollId, approvalType, userId, notes) => {
    try {
      const payroll = await Payroll.findById(payrollId);
      
      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      if (!notes || notes.trim().length === 0) {
        const error = new Error('Rejection reason is required');
        error.statusCode = 400;
        throw error;
      }

      if (approvalType === 'hr') {
        payroll.approvals.hr = { 
          status: 'rejected', 
          by: userId, 
          at: new Date(), 
          notes 
        };
      } else if (approvalType === 'finance') {
        payroll.approvals.finance = { 
          status: 'rejected', 
          by: userId, 
          at: new Date(), 
          notes 
        };
      }

      await payroll.save();
      return payroll;
    } catch (error) {
      throw error;
    }
  },

  // Add adjustment to payroll
  addAdjustment: async (payrollId, adjustmentData, userId) => {
    try {
      const payroll = await Payroll.findById(payrollId);
      
      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      if (payroll.payment.status === 'paid') {
        const error = new Error('Cannot adjust paid payroll records');
        error.statusCode = 400;
        throw error;
      }

      const adjustment = {
        ...adjustmentData,
        appliedBy: userId,
        appliedAt: new Date()
      };

      await payroll.addAdjustment(adjustment, userId);
      return payroll;
    } catch (error) {
      throw error;
    }
  },

  // Mark payroll as paid
  markAsPaid: async (payrollId, paymentData) => {
    try {
      const { reference, method = 'bank_transfer', batchId } = paymentData;
      
      const payroll = await Payroll.findById(payrollId);
      
      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      if (payroll.approvalStatus !== 'approved') {
        const error = new Error('Payroll must be approved before payment');
        error.statusCode = 400;
        throw error;
      }

      payroll.payment.batchId = batchId;
      await payroll.markAsPaid(reference, method);
      
      return payroll;
    } catch (error) {
      throw error;
    }
  },

  // Process batch payment
  processBatchPayment: async (month, batchData, userId) => {
    try {
      const { method = 'bank_transfer', batchId } = batchData;
      
      const payrolls = await Payroll.find({
        payrollMonth: month,
        'approvals.hr.status': 'approved',
        'approvals.finance.status': 'approved',
        'payment.status': { $in: ['pending', 'approved'] }
      });

      if (payrolls.length === 0) {
        const error = new Error('No approved payrolls found for batch payment');
        error.statusCode = 404;
        throw error;
      }

      const results = [];
      let totalAmount = 0;

      for (const payroll of payrolls) {
        try {
          const reference = `BATCH-${batchId}-${payroll.employeeId}`;
          payroll.payment.batchId = batchId;
          await payroll.markAsPaid(reference, method);
          
          results.push({
            payrollId: payroll._id,
            employeeId: payroll.employeeId,
            amount: payroll.netPay,
            reference,
            success: true
          });
          
          totalAmount += payroll.netPay;
        } catch (error) {
          results.push({
            payrollId: payroll._id,
            employeeId: payroll.employeeId,
            success: false,
            error: error.message
          });
        }
      }

      return {
        batchId,
        totalRecords: payrolls.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        totalAmount,
        results
      };
    } catch (error) {
      throw error;
    }
  },

  // Generate payslip
  generatePayslip: async (payrollId) => {
    try {
      const payroll = await Payroll.findById(payrollId)
        .populate('employeeId');
      
      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      await payroll.generatePayslip();
      return payroll;
    } catch (error) {
      throw error;
    }
  },

  // Generate all payslips for a month
  generateAllPayslips: async (month) => {
    try {
      const results = await Payroll.generateAllPayslips(month);
      
      return {
        month,
        totalRecords: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      throw error;
    }
  },

  // Get payroll summary
  getPayrollSummary: async (month) => {
    try {
      const summary = await Payroll.getSummary(month);
      
      if (!summary || summary.length === 0) {
        return {
          month,
          totalEmployees: 0,
          totalGrossPay: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          totalTax: 0,
          totalPension: 0,
          paidCount: 0,
          pendingCount: 0
        };
      }

      return {
        month,
        ...summary[0]
      };
    } catch (error) {
      throw error;
    }
  },

  // Get department-wise payroll summary
  getDepartmentSummary: async (month) => {
    try {
      const summary = await Payroll.aggregate([
        { $match: { payrollMonth: month, isActive: true } },
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
            _id: {
              departmentId: '$department._id',
              departmentName: '$department.name'
            },
            employeeCount: { $sum: 1 },
            totalGrossPay: { $sum: '$grossPay' },
            totalNetPay: { $sum: '$netPay' },
            totalDeductions: { $sum: '$deductions.total' },
            averageNetPay: { $avg: '$netPay' }
          }
        },
        { $sort: { totalNetPay: -1 } }
      ]);

      return summary.map(dept => ({
        department: dept._id.departmentName,
        departmentId: dept._id.departmentId,
        employeeCount: dept.employeeCount,
        totalGrossPay: dept.totalGrossPay,
        totalNetPay: dept.totalNetPay,
        totalDeductions: dept.totalDeductions,
        averageNetPay: Math.round(dept.averageNetPay)
      }));
    } catch (error) {
      throw error;
    }
  },

  // Delete/deactivate payroll
  deactivatePayroll: async (payrollId) => {
    try {
      const payroll = await Payroll.findById(payrollId);
      
      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      if (payroll.payment.status === 'paid') {
        const error = new Error('Cannot deactivate paid payroll records');
        error.statusCode = 400;
        throw error;
      }

      payroll.isActive = false;
      await payroll.save();
      
      return payroll;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = payrollController;