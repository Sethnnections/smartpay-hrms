const mongoose = require('mongoose');
const moment = require('moment');

const payrollSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee ID is required']
  },
  payrollMonth: {
    type: String,
    required: [true, 'Payroll month is required'],
    match: [/^\d{4}-\d{2}$/, 'Payroll month must be in YYYY-MM format']
  },
  payrollYear: {
    type: Number,
    required: [true, 'Payroll year is required'],
    min: [2020, 'Invalid payroll year'],
    max: [2050, 'Invalid payroll year']
  },
  payPeriod: {
    startDate: {
      type: Date,
      required: [true, 'Pay period start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'Pay period end date is required']
    },
    workingDays: {
      type: Number,
      required: [true, 'Working days is required'],
      min: [0, 'Working days cannot be negative'],
      max: [31, 'Working days cannot exceed 31']
    },
    daysWorked: {
      type: Number,
      required: [true, 'Days worked is required'],
      min: [0, 'Days worked cannot be negative']
    }
  },
  employeeInfo: {
    employeeNumber: {
      type: String,
      required: [true, 'Employee number is required']
    },
    fullName: {
      type: String,
      required: [true, 'Employee full name is required']
    },
    department: {
      type: String,
      required: [true, 'Department is required']
    },
    position: {
      type: String,
      required: [true, 'Position is required']
    },
    grade: {
      type: String,
      required: [true, 'Grade is required']
    },
    bankInfo: {
      bankName: String,
      accountNumber: String,
      accountName: String,
      routingNumber: String
    }
  },
  salaryDetails: {
    baseSalary: {
      type: Number,
      required: [true, 'Base salary is required'],
      min: [0, 'Base salary cannot be negative']
    },
    proRatedSalary: {
      type: Number,
      required: [true, 'Pro-rated salary is required'],
      min: [0, 'Pro-rated salary cannot be negative']
    },
    allowances: {
      transport: {
        type: Number,
        default: 0,
        min: [0, 'Transport allowance cannot be negative']
      },
      housing: {
        type: Number,
        default: 0,
        min: [0, 'Housing allowance cannot be negative']
      },
      medical: {
        type: Number,
        default: 0,
        min: [0, 'Medical allowance cannot be negative']
      },
      meals: {
        type: Number,
        default: 0,
        min: [0, 'Meals allowance cannot be negative']
      },
      communication: {
        type: Number,
        default: 0,
        min: [0, 'Communication allowance cannot be negative']
      },
      other: {
        type: Number,
        default: 0,
        min: [0, 'Other allowance cannot be negative']
      },
      total: {
        type: Number,
        default: 0,
        min: [0, 'Total allowances cannot be negative']
      }
    },
    overtime: {
      hours: {
        type: Number,
        default: 0,
        min: [0, 'Overtime hours cannot be negative']
      },
      rate: {
        type: Number,
        default: 0,
        min: [0, 'Overtime rate cannot be negative']
      },
      multiplier: {
        type: Number,
        default: 1.5,
        min: [1, 'Overtime multiplier must be at least 1']
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Overtime amount cannot be negative']
      }
    },
    bonus: {
      performance: {
        type: Number,
        default: 0,
        min: [0, 'Performance bonus cannot be negative']
      },
      annual: {
        type: Number,
        default: 0,
        min: [0, 'Annual bonus cannot be negative']
      },
      other: {
        type: Number,
        default: 0,
        min: [0, 'Other bonus cannot be negative']
      },
      total: {
        type: Number,
        default: 0,
        min: [0, 'Total bonus cannot be negative']
      }
    },
    grossPay: {
      type: Number,
      required: [true, 'Gross pay is required'],
      min: [0, 'Gross pay cannot be negative']
    }
  },
  deductions: {
    paye: {
      percent: {
        type: Number,
        required: [true, 'PAYE percentage is required'],
        min: [0, 'PAYE percentage cannot be negative'],
        max: [100, 'PAYE percentage cannot exceed 100%']
      },
      amount: {
        type: Number,
        required: [true, 'PAYE amount is required'],
        min: [0, 'PAYE amount cannot be negative']
      }
    },
    pension: {
      percent: {
        type: Number,
        required: [true, 'Pension percentage is required'],
        min: [0, 'Pension percentage cannot be negative'],
        max: [100, 'Pension percentage cannot exceed 100%']
      },
      amount: {
        type: Number,
        required: [true, 'Pension amount is required'],
        min: [0, 'Pension amount cannot be negative']
      }
    },
    insurance: {
      health: {
        type: Number,
        default: 0,
        min: [0, 'Health insurance cannot be negative']
      },
      life: {
        type: Number,
        default: 0,
        min: [0, 'Life insurance cannot be negative']
      },
      dental: {
        type: Number,
        default: 0,
        min: [0, 'Dental insurance cannot be negative']
      }
    },
    loans: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      amount: {
        type: Number,
        required: true,
        min: [0, 'Loan deduction cannot be negative']
      },
      balance: {
        type: Number,
        min: [0, 'Loan balance cannot be negative']
      },
      reference: {
        type: String,
        trim: true
      }
    }],
    other: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      amount: {
        type: Number,
        required: true,
        min: [0, 'Other deduction cannot be negative']
      },
      description: {
        type: String,
        trim: true
      }
    }],
    totalDeductions: {
      type: Number,
      required: [true, 'Total deductions is required'],
      min: [0, 'Total deductions cannot be negative']
    }
  },
  netPay: {
    type: Number,
    required: [true, 'Net pay is required'],
    min: [0, 'Net pay cannot be negative']
  },
  paymentInfo: {
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'cash', 'check', 'mobile_money'],
      default: 'bank_transfer'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'],
      default: 'pending'
    },
    paymentDate: {
      type: Date
    },
    paymentReference: {
      type: String,
      trim: true
    },
    batchId: {
      type: String,
      trim: true
    }
  },
  approvals: {
    hrApproval: {
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      approvedAt: {
        type: Date
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      notes: {
        type: String,
        trim: true
      }
    },
    financeApproval: {
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      approvedAt: {
        type: Date
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      notes: {
        type: String,
        trim: true
      }
    }
  },
  adjustments: [{
    type: {
      type: String,
      enum: ['addition', 'deduction'],
      required: true
    },
    category: {
      type: String,
      enum: ['salary', 'allowance', 'overtime', 'bonus', 'tax', 'other'],
      required: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      trim: true
    },
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'KES', 'GHS', 'ZAR']
  },
  exchangeRate: {
    type: Number,
    min: [0, 'Exchange rate cannot be negative'],
    default: 1
  },
  payslipGenerated: {
    type: Boolean,
    default: false
  },
  payslipPath: {
    type: String
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Processed by is required']
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
payrollSchema.index({ employeeId: 1 });
payrollSchema.index({ payrollMonth: 1 });
payrollSchema.index({ payrollYear: 1 });
payrollSchema.index({ 'paymentInfo.paymentStatus': 1 });
payrollSchema.index({ 'approvals.hrApproval.status': 1 });
payrollSchema.index({ 'approvals.financeApproval.status': 1 });
payrollSchema.index({ processedAt: 1 });
payrollSchema.index({ isActive: 1 });

// Compound indexes
payrollSchema.index({ employeeId: 1, payrollMonth: 1 }, { unique: true });
payrollSchema.index({ payrollMonth: 1, 'paymentInfo.paymentStatus': 1 });
payrollSchema.index({ payrollYear: 1, payrollMonth: 1 });

// Virtual for employee details
payrollSchema.virtual('employee', {
  ref: 'Employee',
  localField: 'employeeId',
  foreignField: '_id',
  justOne: true
});

// Virtual for take-home percentage
payrollSchema.virtual('takeHomePercentage').get(function() {
  if (this.salaryDetails.grossPay === 0) return 0;
  return Math.round((this.netPay / this.salaryDetails.grossPay) * 100);
});

// Virtual for deduction percentage
payrollSchema.virtual('deductionPercentage').get(function() {
  if (this.salaryDetails.grossPay === 0) return 0;
  return Math.round((this.deductions.totalDeductions / this.salaryDetails.grossPay) * 100);
});

// Virtual for approval status
payrollSchema.virtual('approvalStatus').get(function() {
  const hrStatus = this.approvals.hrApproval.status;
  const financeStatus = this.approvals.financeApproval.status;
  
  if (hrStatus === 'rejected' || financeStatus === 'rejected') {
    return 'rejected';
  }
  
  if (hrStatus === 'approved' && financeStatus === 'approved') {
    return 'approved';
  }
  
  return 'pending';
});

// Virtual for days worked percentage
payrollSchema.virtual('attendancePercentage').get(function() {
  if (this.payPeriod.workingDays === 0) return 0;
  return Math.round((this.payPeriod.daysWorked / this.payPeriod.workingDays) * 100);
});

// Pre-save middleware for calculations
payrollSchema.pre('save', function(next) {
  // Calculate total allowances
  const allowances = this.salaryDetails.allowances;
  allowances.total = allowances.transport + allowances.housing + allowances.medical + 
                    allowances.meals + allowances.communication + allowances.other;
  
  // Calculate overtime amount
  if (this.salaryDetails.overtime.hours > 0) {
    this.salaryDetails.overtime.amount = this.salaryDetails.overtime.hours * 
                                        this.salaryDetails.overtime.rate * 
                                        this.salaryDetails.overtime.multiplier;
  }
  
  // Calculate total bonus
  const bonus = this.salaryDetails.bonus;
  bonus.total = bonus.performance + bonus.annual + bonus.other;
  
  // Calculate gross pay
  this.salaryDetails.grossPay = this.salaryDetails.proRatedSalary + 
                               allowances.total + 
                               this.salaryDetails.overtime.amount + 
                               bonus.total;
  
  // Calculate PAYE amount
  this.deductions.paye.amount = (this.salaryDetails.grossPay * this.deductions.paye.percent) / 100;
  
  // Calculate pension amount
  this.deductions.pension.amount = (this.salaryDetails.grossPay * this.deductions.pension.percent) / 100;
  
  // Calculate total deductions
  let totalDeductions = this.deductions.paye.amount + 
                       this.deductions.pension.amount + 
                       this.deductions.insurance.health + 
                       this.deductions.insurance.life + 
                       this.deductions.insurance.dental;
  
  // Add loan deductions
  totalDeductions += this.deductions.loans.reduce((sum, loan) => sum + loan.amount, 0);
  
  // Add other deductions
  totalDeductions += this.deductions.other.reduce((sum, deduction) => sum + deduction.amount, 0);
  
  this.deductions.totalDeductions = totalDeductions;
  
  // Calculate net pay
  this.netPay = Math.max(0, this.salaryDetails.grossPay - this.deductions.totalDeductions);
  
  // Apply adjustments
  this.adjustments.forEach(adjustment => {
    if (adjustment.type === 'addition') {
      this.netPay += adjustment.amount;
    } else {
      this.netPay = Math.max(0, this.netPay - adjustment.amount);
    }
  });
  
  next();
});

// Static method to process payroll for all employees
payrollSchema.statics.processMonthlyPayroll = async function(month, processedBy) {
  const Employee = mongoose.model('Employee');
  const Grade = mongoose.model('Grade');
  
  const employees = await Employee.find({
    'employmentInfo.status': 'active',
    isActive: true
  }).populate('employmentInfo.gradeId');
  
  const payrollRecords = [];
  const [year, monthNum] = month.split('-');
  const startDate = moment(`${year}-${monthNum}-01`);
  const endDate = startDate.clone().endOf('month');
  const workingDays = this.calculateWorkingDays(startDate.toDate(), endDate.toDate());
  
  for (const employee of employees) {
    // Check if payroll already exists for this employee and month
    const existingPayroll = await this.findOne({
      employeeId: employee._id,
      payrollMonth: month
    });
    
    if (existingPayroll) {
      continue; // Skip if already processed
    }
    
    const grade = employee.employmentInfo.gradeId;
    if (!grade) continue;
    
    // Get approved overtime for the month
    const overtimeRecord = employee.overtimeRecords.find(
      record => record.month === month && record.status === 'approved'
    );
    
    const payrollData = {
      employeeId: employee._id,
      payrollMonth: month,
      payrollYear: parseInt(year),
      payPeriod: {
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        workingDays: workingDays,
        daysWorked: workingDays // Assume full attendance, can be adjusted
      },
      employeeInfo: {
        employeeNumber: employee.employeeId,
        fullName: employee.fullName,
        department: employee.department?.name || 'Unknown',
        position: employee.position?.name || 'Unknown',
        grade: grade.name,
        bankInfo: employee.bankInfo
      },
      salaryDetails: {
        baseSalary: employee.employmentInfo.currentSalary,
        proRatedSalary: employee.employmentInfo.currentSalary, // Can be adjusted for partial months
        allowances: grade.allowances,
        overtime: {
          hours: overtimeRecord?.hours || 0,
          rate: grade.payrollSettings.overtimeRate,
          multiplier: grade.payrollSettings.overtimeMultiplier,
          amount: 0 // Will be calculated in pre-save
        },
        bonus: {
          performance: 0,
          annual: 0,
          other: 0,
          total: 0
        },
        grossPay: 0 // Will be calculated in pre-save
      },
      deductions: {
        paye: {
          percent: grade.payrollSettings.payeePercent,
          amount: 0 // Will be calculated in pre-save
        },
        pension: {
          percent: grade.payrollSettings.pensionPercent,
          amount: 0 // Will be calculated in pre-save
        },
        insurance: {
          health: 0,
          life: 0,
          dental: 0
        },
        loans: [],
        other: [],
        totalDeductions: 0 // Will be calculated in pre-save
      },
      netPay: 0, // Will be calculated in pre-save
      processedBy: processedBy,
      processedAt: new Date()
    };
    
    const payrollRecord = new this(payrollData);
    payrollRecords.push(payrollRecord);
  }
  
  // Save all payroll records
  return await this.insertMany(payrollRecords);
};

// Static method to calculate working days
payrollSchema.statics.calculateWorkingDays = function(startDate, endDate) {
  let count = 0;
  const current = moment(startDate);
  const end = moment(endDate);
  
  while (current.isSameOrBefore(end)) {
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (current.day() !== 0 && current.day() !== 6) {
      count++;
    }
    current.add(1, 'day');
  }
  
  return count;
};

// Instance method to approve payroll
payrollSchema.methods.approve = function(approverType, approverId, notes = '') {
  if (approverType === 'hr') {
    this.approvals.hrApproval.approvedBy = approverId;
    this.approvals.hrApproval.approvedAt = new Date();
    this.approvals.hrApproval.status = 'approved';
    this.approvals.hrApproval.notes = notes;
  } else if (approverType === 'finance') {
    this.approvals.financeApproval.approvedBy = approverId;
    this.approvals.financeApproval.approvedAt = new Date();
    this.approvals.financeApproval.status = 'approved';
    this.approvals.financeApproval.notes = notes;
  }
  
  return this.save();
};

// Instance method to reject payroll
payrollSchema.methods.reject = function(approverType, approverId, notes = '') {
  if (approverType === 'hr') {
    this.approvals.hrApproval.approvedBy = approverId;
    this.approvals.hrApproval.approvedAt = new Date();
    this.approvals.hrApproval.status = 'rejected';
    this.approvals.hrApproval.notes = notes;
  } else if (approverType === 'finance') {
    this.approvals.financeApproval.approvedBy = approverId;
    this.approvals.financeApproval.approvedAt = new Date();
    this.approvals.financeApproval.status = 'rejected';
    this.approvals.financeApproval.notes = notes;
  }
  
  return this.save();
};

// Instance method to add adjustment
payrollSchema.methods.addAdjustment = function(adjustmentData, appliedBy) {
  this.adjustments.push({
    ...adjustmentData,
    appliedBy: appliedBy,
    appliedAt: new Date()
  });
  
  return this.save();
};

// Instance method to mark as paid
payrollSchema.methods.markAsPaid = function(paymentReference, paymentDate = new Date()) {
  this.paymentInfo.paymentStatus = 'paid';
  this.paymentInfo.paymentDate = paymentDate;
  this.paymentInfo.paymentReference = paymentReference;
  
  return this.save();
};

// Static method to generate payroll summary
payrollSchema.statics.generateSummary = async function(month) {
  return await this.aggregate([
    { $match: { payrollMonth: month, isActive: true } },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        totalGrossPay: { $sum: '$salaryDetails.grossPay' },
        totalDeductions: { $sum: '$deductions.totalDeductions' },
        totalNetPay: { $sum: '$netPay' },
        totalOvertimePay: { $sum: '$salaryDetails.overtime.amount' },
        totalAllowances: { $sum: '$salaryDetails.allowances.total' },
        averageNetPay: { $avg: '$netPay' },
        paidCount: {
          $sum: { $cond: [{ $eq: ['$paymentInfo.paymentStatus', 'paid'] }, 1, 0] }
        },
        pendingCount: {
          $sum: { $cond: [{ $eq: ['$paymentInfo.paymentStatus', 'pending'] }, 1, 0] }
        }
      }
    }
  ]);
};

// Static method to get department summary
payrollSchema.statics.getDepartmentSummary = async function(month) {
  return await this.aggregate([
    { $match: { payrollMonth: month, isActive: true } },
    {
      $group: {
        _id: '$employeeInfo.department',
        employeeCount: { $sum: 1 },
        totalGrossPay: { $sum: '$salaryDetails.grossPay' },
        totalNetPay: { $sum: '$netPay' },
        averageNetPay: { $avg: '$netPay' }
      }
    },
    { $sort: { totalNetPay: -1 } }
  ]);
};

const Payroll = mongoose.model('Payroll', payrollSchema);

module.exports = Payroll;