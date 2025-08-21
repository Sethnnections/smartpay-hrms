const mongoose = require('mongoose');
const moment = require('moment');
const mongoosePaginate = require('mongoose-paginate-v2');

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
      min: [0, 'Working days cannot be negative']
    },
    daysWorked: {
      type: Number,
      required: [true, 'Days worked is required'],
      min: [0, 'Days worked cannot be negative']
    }
  },
  // Salary calculations
  salary: {
    base: {
      type: Number,
      required: [true, 'Base salary is required'],
      min: [0, 'Base salary cannot be negative']
    },
    prorated: {
      type: Number,
      required: [true, 'Prorated salary is required'],
      min: [0, 'Prorated salary cannot be negative']
    }
  },
  // Allowances from grade
  allowances: {
    transport: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    housing: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    medical: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    meals: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    communication: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    other: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    total: { type: Number, default: 0, min: [0, 'Cannot be negative'] }
  },
  // Overtime from employee overtime records
  overtime: {
    hours: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    rate: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    amount: { type: Number, default: 0, min: [0, 'Cannot be negative'] }
  },
  // Bonuses
  bonuses: {
    performance: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    annual: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    other: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    total: { type: Number, default: 0, min: [0, 'Cannot be negative'] }
  },
  // Gross pay calculation
  grossPay: {
    type: Number,
    required: [true, 'Gross pay is required'],
    min: [0, 'Gross pay cannot be negative']
  },
  // Statutory deductions
  deductions: {
    // Tax (PAYE)
    tax: {
      rate: { type: Number, required: true, min: [0, 'Tax rate cannot be negative'] },
      amount: { type: Number, required: true, min: [0, 'Tax amount cannot be negative'] }
    },
    // Pension contribution
    pension: {
      rate: { type: Number, required: true, min: [0, 'Pension rate cannot be negative'] },
      amount: { type: Number, required: true, min: [0, 'Pension amount cannot be negative'] }
    },
    // Loans (from employee loan records)
    loans: [{
      loanId: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, required: true, trim: true },
      amount: { type: Number, required: true, min: [0, 'Loan amount cannot be negative'] },
      balance: { type: Number, min: [0, 'Loan balance cannot be negative'] }
    }],
    // Other deductions
    other: [{
      name: { type: String, required: true, trim: true },
      amount: { type: Number, required: true, min: [0, 'Amount cannot be negative'] },
      description: { type: String, trim: true }
    }],
    total: {
      type: Number,
      required: [true, 'Total deductions is required'],
      min: [0, 'Total deductions cannot be negative']
    }
  },
  // Final net pay
  netPay: {
    type: Number,
    required: [true, 'Net pay is required'],
    min: [0, 'Net pay cannot be negative']
  },
  // Payment processing
  payment: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'processing', 'paid', 'failed'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['bank_transfer', 'mobile_money', 'cash', 'cheque'],
      default: 'bank_transfer'
    },
    reference: { type: String, trim: true },
    paidAt: { type: Date },
    batchId: { type: String, trim: true }
  },
  // Approvals
  approvals: {
    hr: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
      notes: { type: String, trim: true }
    },
    finance: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
      notes: { type: String, trim: true }
    }
  },
  // Payslip generation
  payslip: {
    generated: { type: Boolean, default: false },
    path: { type: String },
    generatedAt: { type: Date }
  },
  // Processing info
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Processed by is required']
  },
  currency: {
    type: String,
    default: 'MWK',
    enum: ['MWK', 'USD', 'EUR', 'GBP']
  },
  exchangeRate: { type: Number, default: 1, min: [0, 'Exchange rate cannot be negative'] },
  
  // Adjustments for corrections
  adjustments: [{
    type: { type: String, enum: ['addition', 'deduction'], required: true },
    category: { type: String, enum: ['salary', 'allowance', 'bonus', 'tax', 'other'], required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appliedAt: { type: Date, default: Date.now }
  }],
  
  notes: { type: String, trim: true, maxlength: [500, 'Notes cannot exceed 500 characters'] },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
payrollSchema.index({ employeeId: 1, payrollMonth: 1 }, { unique: true });
payrollSchema.index({ payrollMonth: 1 });
payrollSchema.index({ 'payment.status': 1 });
payrollSchema.index({ 'approvals.hr.status': 1 });
payrollSchema.index({ 'approvals.finance.status': 1 });
payrollSchema.index({ processedBy: 1 });

// Virtuals
payrollSchema.virtual('employee', {
  ref: 'Employee',
  localField: 'employeeId',
  foreignField: '_id',
  justOne: true
});

payrollSchema.virtual('attendanceRate').get(function() {
  if (this.payPeriod.workingDays === 0) return 0;
  return Math.round((this.payPeriod.daysWorked / this.payPeriod.workingDays) * 100);
});

payrollSchema.virtual('deductionRate').get(function() {
  if (this.grossPay === 0) return 0;
  return Math.round((this.deductions.total / this.grossPay) * 100);
});

payrollSchema.virtual('approvalStatus').get(function() {
  const hr = this.approvals.hr.status;
  const finance = this.approvals.finance.status;
  
  if (hr === 'rejected' || finance === 'rejected') return 'rejected';
  if (hr === 'approved' && finance === 'approved') return 'approved';
  return 'pending';
});

// Static method: Calculate progressive tax according to Malawi tax brackets
payrollSchema.statics.calculateProgressiveTax = function(grossPay) {
  let tax = 0;
  let remainingIncome = grossPay;
  let effectiveRate = 0;

  // Tax bracket 1: 0 - 150,000 (0%)
  if (remainingIncome <= 150000) {
    tax = 0;
  } else {
    // Tax bracket 2: 150,001 - 500,000 (25%)
    const bracket2Amount = Math.min(remainingIncome - 150000, 350000);
    if (bracket2Amount > 0) {
      tax += bracket2Amount * 0.25;
      remainingIncome -= bracket2Amount;
    }

    // Tax bracket 3: 500,001 - 2,550,000 (30%)
    if (remainingIncome > 0) {
      const bracket3Amount = Math.min(remainingIncome, 2050000);
      if (bracket3Amount > 0) {
        tax += bracket3Amount * 0.30;
        remainingIncome -= bracket3Amount;
      }
    }

    // Tax bracket 4: Above 2,550,000 (35%)
    if (remainingIncome > 0) {
      tax += remainingIncome * 0.35;
    }
  }

  // Calculate effective tax rate
  if (grossPay > 0) {
    effectiveRate = (tax / grossPay) * 100;
  }

  return { 
    amount: Math.round(tax * 100) / 100, 
    rate: Math.round(effectiveRate * 100) / 100 
  };
};

// Pre-save calculations
payrollSchema.pre('save', function(next) {
  // Calculate prorated salary based on days worked
  this.salary.prorated = (this.salary.base / this.payPeriod.workingDays) * this.payPeriod.daysWorked;
  
  // Calculate allowances total
  this.allowances.total = this.allowances.transport + this.allowances.housing + 
                         this.allowances.medical + this.allowances.meals + 
                         this.allowances.communication + this.allowances.other;
  
  // Calculate overtime amount
  this.overtime.amount = this.overtime.hours * this.overtime.rate * 1.5; // 1.5x multiplier
  
  // Calculate bonus total
  this.bonuses.total = this.bonuses.performance + this.bonuses.annual + this.bonuses.other;
  
  // Calculate gross pay
  this.grossPay = this.salary.prorated + this.allowances.total + this.overtime.amount + this.bonuses.total;
  
  // Calculate progressive tax amount using the new method
  const taxCalculation = this.constructor.calculateProgressiveTax(this.grossPay);
  this.deductions.tax.amount = taxCalculation.amount;
  this.deductions.tax.rate = taxCalculation.rate;
  
  // Calculate pension amount (keep existing logic)
  this.deductions.pension.amount = (this.grossPay * this.deductions.pension.rate) / 100;
  
  // Calculate total deductions
  const loanTotal = this.deductions.loans.reduce((sum, loan) => sum + loan.amount, 0);
  const otherTotal = this.deductions.other.reduce((sum, item) => sum + item.amount, 0);
  
  this.deductions.total = this.deductions.tax.amount + this.deductions.pension.amount + loanTotal + otherTotal;
  
  // Calculate net pay
  this.netPay = Math.max(0, this.grossPay - this.deductions.total);
  
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

// Static method: Process payroll for all active employees
payrollSchema.statics.processAllEmployees = async function(month, processedBy) {
  const Employee = mongoose.model('Employee');
  
  const employees = await Employee.find({
    'employmentInfo.status': 'active',
    isActive: true
  }).populate([
    { path: 'employmentInfo.gradeId', model: 'Grade' },
    { path: 'employmentInfo.departmentId', model: 'Department' }
  ]);

  const payrollRecords = [];
  const [year, monthNum] = month.split('-');
  const startDate = moment(`${year}-${monthNum}-01`);
  const endDate = startDate.clone().endOf('month');
  const workingDays = this.calculateWorkingDays(startDate.toDate(), endDate.toDate());

  for (const employee of employees) {
    // Skip if already processed
    const existing = await this.findOne({ employeeId: employee._id, payrollMonth: month });
    if (existing) continue;
    
    const grade = employee.employmentInfo.gradeId;
    if (!grade) continue;
    
    // Get approved overtime
    const overtime = employee.overtimeRecords.find(
      record => record.month === month && record.status === 'approved'
    ) || { hours: 0, rate: grade.payrollSettings.overtimeRate };
    
    // Calculate prorated salary
    const baseSalary = employee.employmentInfo.currentSalary;
    const proratedSalary = (baseSalary / workingDays) * workingDays; // Full month
    
    // Calculate allowances total
    const allowancesTotal = Object.values(grade.allowances).reduce((sum, val) => sum + (val || 0), 0);
    
    // Calculate overtime amount
    const overtimeAmount = overtime.hours * overtime.rate * grade.payrollSettings.overtimeMultiplier;
    
    // Calculate gross pay
    const grossPay = proratedSalary + allowancesTotal + overtimeAmount;
    
    // Calculate progressive tax using the new method
    const taxCalculation = this.calculateProgressiveTax(grossPay);
    
    // Calculate pension deduction
    const pensionAmount = (grossPay * grade.payrollSettings.pensionPercent) / 100;
    const totalDeductions = taxCalculation.amount + pensionAmount;
    
    // Calculate net pay
    const netPay = Math.max(0, grossPay - totalDeductions);
    
    const payrollData = {
      employeeId: employee._id,
      payrollMonth: month,
      payPeriod: {
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        workingDays,
        daysWorked: workingDays // Default to full attendance
      },
      salary: {
        base: baseSalary,
        prorated: proratedSalary
      },
      allowances: {
        ...grade.allowances,
        total: allowancesTotal
      },
      overtime: {
        hours: overtime.hours,
        rate: overtime.rate,
        amount: overtimeAmount
      },
      bonuses: { 
        performance: 0, 
        annual: 0, 
        other: 0, 
        total: 0 
      },
      deductions: {
        tax: {
          rate: taxCalculation.rate,
          amount: taxCalculation.amount
        },
        pension: {
          rate: grade.payrollSettings.pensionPercent,
          amount: pensionAmount
        },
        loans: [],
        other: [],
        total: totalDeductions
      },
      grossPay,
      netPay,
      processedBy,
      currency: grade.currency || 'USD'
    };
    
    payrollRecords.push(new this(payrollData));
  }
  
  // Save records one by one to ensure pre-save hooks run
  const savedRecords = [];
  for (const record of payrollRecords) {
    try {
      const saved = await record.save();
      savedRecords.push(saved);
    } catch (error) {
      console.error(`Failed to save payroll for employee ${record.employeeId}:`, error);
    }
  }
  
  return savedRecords;
};

// Static method: Calculate working days
payrollSchema.statics.calculateWorkingDays = function(startDate, endDate) {
  let count = 0;
  const current = moment(startDate);
  const end = moment(endDate);
  
  while (current.isSameOrBefore(end)) {
    // Skip weekends
    if (current.day() !== 0 && current.day() !== 6) {
      count++;
    }
    current.add(1, 'day');
  }
  return count;
};

// Instance method: Approve payroll
payrollSchema.methods.approve = function(type, userId, notes = '') {
  if (type === 'hr') {
    this.approvals.hr = { status: 'approved', by: userId, at: new Date(), notes };
  } else if (type === 'finance') {
    this.approvals.finance = { status: 'approved', by: userId, at: new Date(), notes };
  }
  return this.save();
};

// Instance method: Mark as paid
payrollSchema.methods.markAsPaid = function(reference, method = 'bank_transfer') {
  this.payment.status = 'paid';
  this.payment.reference = reference;
  this.payment.method = method;
  this.payment.paidAt = new Date();
  return this.save();
};

// Instance method: Generate payslip
payrollSchema.methods.generatePayslip = async function() {
  // This would integrate with a PDF generation service
  // For now, just mark as generated
  this.payslip.generated = true;
  this.payslip.generatedAt = new Date();
  this.payslip.path = `/payslips/${this.employeeId}/${this.payrollMonth}.pdf`;
  return this.save();
};

// Static method: Generate payslips for all employees in a month
payrollSchema.statics.generateAllPayslips = async function(month) {
  const payrolls = await this.find({
    payrollMonth: month,
    'approvals.hr.status': 'approved',
    'approvals.finance.status': 'approved',
    'payslip.generated': false
  });
  
  const results = [];
  for (const payroll of payrolls) {
    try {
      await payroll.generatePayslip();
      results.push({ employeeId: payroll.employeeId, success: true });
    } catch (error) {
      results.push({ employeeId: payroll.employeeId, success: false, error: error.message });
    }
  }
  
  return results;
};

// Instance method: Get payslip breakdown
payrollSchema.methods.getPayslipBreakdown = function () {
  return {
    employeeId: this.employeeId,
    payrollMonth: this.payrollMonth,
    grossPay: this.grossPay,
    deductions: {
      tax: this.deductions.tax.amount,
      pension: this.deductions.pension.amount,
      loans: this.deductions.loans.reduce((sum, l) => sum + l.amount, 0),
      other: this.deductions.other.reduce((sum, o) => sum + o.amount, 0),
      total: this.deductions.total
    },
    netPay: this.netPay,
    currency: this.currency
  };
};

// Static method: Get payroll summary
payrollSchema.statics.getSummary = async function(month) {
  return await this.aggregate([
    { $match: { payrollMonth: month, isActive: true } },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        totalGrossPay: { $sum: '$grossPay' },
        totalDeductions: { $sum: '$deductions.total' },
        totalNetPay: { $sum: '$netPay' },
        totalTax: { $sum: '$deductions.tax.amount' },
        totalPension: { $sum: '$deductions.pension.amount' },
        paidCount: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, 1, 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$payment.status', 'pending'] }, 1, 0] } }
      }
    }
  ]);
};

payrollSchema.plugin(mongoosePaginate);
const Payroll = mongoose.model('Payroll', payrollSchema);
module.exports = Payroll;