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
    min: [0, 'Base salary cannot be negative'],
    editable: true // Add this
  },
  prorated: {
    type: Number,
    required: [true, 'Prorated salary is required'],
    min: [0, 'Prorated salary cannot be negative'],
    editable: true // Add this
  }
},
  allowances: {
  transport: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'],
    editable: true // Add this
  },
  housing: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'],
    editable: true 
  },
  medical: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'],
    editable: true 
  },
  meals: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'],
    editable: true 
  },
  communication: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'],
    editable: true 
  },
  other: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'],
    editable: true 
  },
  total: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'] 
  }
},
  // Overtime from employee overtime records
  overtime: {
    hours: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    rate: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    amount: { type: Number, default: 0, min: [0, 'Cannot be negative'] }
  },
  // Bonuses
  bonuses: {
  performance: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'],
    editable: true 
  },
  annual: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'],
    editable: true 
  },
  other: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'],
    editable: true 
  },
  total: { 
    type: Number, 
    default: 0, 
    min: [0, 'Cannot be negative'] 
  }
},
  // Gross pay calculation
  grossPay: {
    type: Number,
    required: [true, 'Gross pay is required'],
    min: [0, 'Gross pay cannot be negative']
  },
  // Statutory deductions
    deductions: {
    tax: {
      rate: { 
        type: Number, 
        required: true, 
        min: [0, 'Tax rate cannot be negative'],
        editable: true 
      },
      amount: { 
        type: Number, 
        required: true, 
        min: [0, 'Tax amount cannot be negative'] 
      }
    },
    pension: {
      rate: { 
        type: Number, 
        required: true, 
        min: [0, 'Pension rate cannot be negative'],
        editable: true 
      },
      amount: { 
        type: Number, 
        required: true, 
        min: [0, 'Pension amount cannot be negative'] 
      }
    },
    loans: [{
      amount: { type: Number, required: true, min: [0, 'Loan amount cannot be negative'] },
      description: { type: String, trim: true }
    }],
    other: [{
      name: { type: String, required: false, trim: true },
      amount: { type: Number, required: true, min: [0, 'Other deduction amount cannot be negative'] },
      description: { type: String, trim: true }
    }],
    total: { type: Number, default: 0, min: [0, 'Total deductions cannot be negative'] }
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
  
adjustments: [{
  type: { 
    type: String, 
    enum: ['addition', 'deduction', 'adjustment'],
    required: true 
  },
  category: { 
    type: String, 
    enum: ['salary', 'allowance', 'bonus', 'tax', 'other', 'edit'],
    required: true 
  },
  duration: {
    type: String,
    enum: ['temporary', 'permanent'],
    default: 'temporary'
  },
  durationDetails: {
    startDate: Date,
    endDate: Date,
    numberOfMonths: Number
  },
  amount: { type: Number, required: true },
  reason: { type: String, required: true, trim: true },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appliedAt: { type: Date, default: Date.now },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }]
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
// In your Payroll.js model, replace the calculateProgressiveTax method:

// Remove the static calculateProgressiveTax method and replace with:
payrollSchema.statics.calculateProgressiveTax = async function(grossPay, country = 'MW', currency = 'MWK') {
  const TaxBracket = mongoose.model('TaxBracket');
  
  try {
    // Get current tax brackets from database
    const taxBrackets = await TaxBracket.getCurrentBrackets(country, currency);
    
    if (taxBrackets.length === 0) {
      // Use fallback if no active tax brackets found
      return this.calculateProgressiveTaxFallback(grossPay);
    }
    
    let tax = 0;
    let remainingIncome = grossPay;
    
    // Sort brackets by minAmount to ensure proper calculation
    const sortedBrackets = taxBrackets.sort((a, b) => a.minAmount - b.minAmount);
    
    for (let i = 0; i < sortedBrackets.length; i++) {
      const bracket = sortedBrackets[i];
      
      // Check if there's remaining income to tax in this bracket
      if (remainingIncome <= 0) break;
      
      // Calculate the taxable amount in this bracket
      const bracketMin = bracket.minAmount;
      const bracketMax = bracket.maxAmount === null ? Infinity : bracket.maxAmount;
      
      // Determine how much income falls into this bracket
      const taxableInBracket = Math.min(
        remainingIncome,
        bracketMax - (i === 0 ? 0 : sortedBrackets[i-1].maxAmount || Infinity)
      );
      
      // Only tax income that exceeds the minimum threshold for this bracket
      if (remainingIncome > bracketMin) {
        const amountToTax = Math.min(
          taxableInBracket,
          remainingIncome - bracketMin
        );
        
        if (amountToTax > 0) {
          tax += amountToTax * (bracket.taxRate / 100);
          remainingIncome -= amountToTax;
        }
      }
    }
    
    // Calculate effective tax rate
    const effectiveRate = grossPay > 0 ? (tax / grossPay) * 100 : 0;
    
    return { 
      amount: Math.round(tax * 100) / 100, 
      rate: Math.round(effectiveRate * 100) / 100,
      bracketsUsed: sortedBrackets.map(b => ({
        name: b.bracketName,
        min: b.minAmount,
        max: b.maxAmount,
        rate: b.taxRate,
        amount: 0 // This would need additional calculation to show per bracket
      }))
    };
    
  } catch (error) {
    console.error('Error calculating progressive tax:', error);
    
    // Fallback to default Malawi tax brackets if database query fails
    return this.calculateProgressiveTaxFallback(grossPay);
  }
};
// Add fallback method with default Malawi tax brackets
// Ensure the fallback method is robust
payrollSchema.statics.calculateProgressiveTaxFallback = function(grossPay) {
  // Handle invalid input
  if (typeof grossPay !== 'number' || isNaN(grossPay) || grossPay < 0) {
    return { amount: 0, rate: 0 };
  }

  let tax = 0;
  let remainingIncome = grossPay;
  let effectiveRate = 0;

  // Default Malawi tax brackets (fallback)
  const defaultBrackets = [
    { min: 0, max: 150000, rate: 0 },
    { min: 150001, max: 500000, rate: 25 },
    { min: 500001, max: 2550000, rate: 30 },
    { min: 2550001, max: null, rate: 35 }
  ];

  for (const bracket of defaultBrackets) {
    if (remainingIncome <= 0) break;
    
    if (remainingIncome > bracket.min) {
      const bracketRange = bracket.max === null ? Infinity : bracket.max - bracket.min;
      const taxableInBracket = Math.min(remainingIncome - bracket.min, bracketRange);
      
      if (taxableInBracket > 0) {
        tax += taxableInBracket * (bracket.rate / 100);
        remainingIncome -= taxableInBracket;
      }
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
payrollSchema.pre('save', async function(next) {
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
    try {
    const taxCalculation = await this.constructor.calculateProgressiveTax(
      this.grossPay, 
      'MW', // Default country
      this.currency
    );
    this.deductions.tax.amount = taxCalculation.amount;
    this.deductions.tax.rate = taxCalculation.rate;
  } catch (error) {
    console.error('Error calculating tax:', error);
    // Fallback to default calculation - no need to log error here since calculateProgressiveTax already handles it
    const taxCalculation = this.constructor.calculateProgressiveTaxFallback(this.grossPay);
    this.deductions.tax.amount = taxCalculation.amount;
    this.deductions.tax.rate = taxCalculation.rate;
  }
  
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
    if (adjustment.duration === 'temporary' || 
        (adjustment.duration === 'permanent' && 
         new Date(adjustment.durationDetails.startDate) <= new Date() &&
         new Date(adjustment.durationDetails.endDate) >= new Date())) {
      if (adjustment.type === 'addition') {
        this.netPay += adjustment.amount;
      } else {
        this.netPay = Math.max(0, this.netPay - adjustment.amount);
      }
    }
  });
  
  next();
});

// Static method: Process payroll for all active employees
// Update the processAllEmployees method to properly handle async tax calculation
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
    
    try {
      // Calculate progressive tax using the new async method
      const taxCalculation = await this.calculateProgressiveTax(
        grossPay, 
        'MW', 
        grade.currency || 'USD'
      );
      
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
    } catch (error) {
      console.error(`Failed to calculate tax for employee ${employee._id}:`, error);
      // Skip this employee if tax calculation fails
      continue;
    }
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

payrollSchema.statics.createFromPreviousMonth = async function(month, processedBy) {
  try {
    const [year, monthNum] = month.split('-');
    const prevMonth = moment(`${year}-${monthNum}-01`).subtract(1, 'month').format('YYYY-MM');
    
    // Get previous month's payrolls
    const prevPayrolls = await this.find({ 
      payrollMonth: prevMonth,
      isActive: true 
    }).populate('employeeId');
    
    if (prevPayrolls.length === 0) {
      throw new Error(`No payroll records found for previous month (${prevMonth})`);
    }
    
    const payrollRecords = [];
    const startDate = moment(`${year}-${monthNum}-01`);
    const endDate = startDate.clone().endOf('month');
    const workingDays = this.calculateWorkingDays(startDate.toDate(), endDate.toDate());
    
    for (const prevPayroll of prevPayrolls) {
      // Skip if already processed for this month
      const existing = await this.findOne({ 
        employeeId: prevPayroll.employeeId._id, 
        payrollMonth: month 
      });
      if (existing) continue;
      
      // Create new payroll based on previous month
      const payrollData = {
        employeeId: prevPayroll.employeeId._id,
        payrollMonth: month,
        payPeriod: {
          startDate: startDate.toDate(),
          endDate: endDate.toDate(),
          workingDays: workingDays,
          daysWorked: workingDays // Default to full attendance
        },
        salary: {
          base: prevPayroll.salary.base,
          prorated: prevPayroll.salary.base // Will be recalculated in pre-save
        },
        allowances: { ...prevPayroll.allowances },
        overtime: {
          hours: 0, // Reset overtime
          rate: prevPayroll.overtime.rate,
          amount: 0
        },
        bonuses: {
          performance: 0, // Reset bonuses
          annual: 0,
          other: 0,
          total: 0
        },
        deductions: {
          tax: {
            rate: prevPayroll.deductions.tax.rate,
            amount: 0 // Will be recalculated
          },
          pension: {
            rate: prevPayroll.deductions.pension.rate,
            amount: 0 // Will be recalculated
          },
          loans: [...prevPayroll.deductions.loans], // Carry over loans
          other: [], // Reset other deductions
          total: 0 // Will be recalculated
        },
        processedBy: processedBy,
        currency: prevPayroll.currency,
        // Reset payment and approvals
        payment: {
          status: 'pending',
          method: 'bank_transfer',
          reference: '',
          paidAt: null
        },
        approvals: {
          hr: { status: 'pending', by: null, at: null, notes: '' },
          finance: { status: 'pending', by: null, at: null, notes: '' }
        },
        payslip: {
          generated: false,
          path: '',
          generatedAt: null
        },
        adjustments: [],
        notes: `Created from ${prevMonth} payroll data`
      };
      
      payrollRecords.push(new this(payrollData));
    }
    
    // Save records
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
  } catch (error) {
    console.error('Error creating payroll from previous month:', error);
    throw error;
  }
};

payrollSchema.plugin(mongoosePaginate);
const Payroll = mongoose.model('Payroll', payrollSchema);
module.exports = Payroll;