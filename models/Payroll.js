const mongoose = require("mongoose");
const moment = require("moment");
const mongoosePaginate = require("mongoose-paginate-v2");

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"],
    },
    payrollMonth: {
      type: String,
      required: [true, "Payroll month is required"],
      match: [/^\d{4}-\d{2}$/, "Payroll month must be in YYYY-MM format"],
    },
    payPeriod: {
      startDate: {
        type: Date,
        required: [true, "Pay period start date is required"],
      },
      endDate: {
        type: Date,
        required: [true, "Pay period end date is required"],
      },
      workingDays: {
        type: Number,
        required: [true, "Working days is required"],
        min: [0, "Working days cannot be negative"],
      },
      daysWorked: {
        type: Number,
        required: [true, "Days worked is required"],
        min: [0, "Days worked cannot be negative"],
      },
    },
    // Salary calculations
    salary: {
      base: {
        type: Number,
        required: [true, "Base salary is required"],
        min: [0, "Base salary cannot be negative"],
        editable: true, // Add this
      },
      prorated: {
        type: Number,
        required: [true, "Prorated salary is required"],
        min: [0, "Prorated salary cannot be negative"],
        editable: true, // Add this
      },
    },
    allowances: {
      transport: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
        editable: true, // Add this
      },
      housing: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
        editable: true,
      },
      medical: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
        editable: true,
      },
      meals: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
        editable: true,
      },
      communication: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
        editable: true,
      },
      other: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
        editable: true,
      },
      total: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
      },
    },
    // Overtime from employee overtime records
    overtime: {
      hours: { type: Number, default: 0, min: [0, "Cannot be negative"] },
      rate: { type: Number, default: 0, min: [0, "Cannot be negative"] },
      amount: { type: Number, default: 0, min: [0, "Cannot be negative"] },
    },
    // Bonuses
    bonuses: {
      performance: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
        editable: true,
      },
      annual: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
        editable: true,
      },
      other: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
        editable: true,
      },
      total: {
        type: Number,
        default: 0,
        min: [0, "Cannot be negative"],
      },
    },
    // Gross pay calculation
    grossPay: {
      type: Number,
      required: [true, "Gross pay is required"],
      min: [0, "Gross pay cannot be negative"],
    },
    // Statutory deductions
    deductions: {
      tax: {
        rate: {
          type: Number,
          required: true,
          min: [0, "Tax rate cannot be negative"],
          editable: true,
        },
        amount: {
          type: Number,
          required: true,
          min: [0, "Tax amount cannot be negative"],
        },
      },
      pension: {
        rate: {
          type: Number,
          required: true,
          min: [0, "Pension rate cannot be negative"],
          editable: true,
        },
        amount: {
          type: Number,
          required: true,
          min: [0, "Pension amount cannot be negative"],
        },
      },
      loans: [
        {
          amount: {
            type: Number,
            required: true,
            min: [0, "Loan amount cannot be negative"],
          },
          description: { type: String, trim: true },
        },
      ],
      other: [
        {
          name: { type: String, required: false, trim: true },
          amount: {
            type: Number,
            required: true,
            min: [0, "Other deduction amount cannot be negative"],
          },
          description: { type: String, trim: true },
        },
      ],
      total: {
        type: Number,
        default: 0,
        min: [0, "Total deductions cannot be negative"],
      },
    },
    // Final net pay
    netPay: {
      type: Number,
      required: [true, "Net pay is required"],
      min: [0, "Net pay cannot be negative"],
    },
    // Payment processing
    payment: {
      status: {
        type: String,
        enum: ["pending", "approved", "processing", "paid", "failed"],
        default: "pending",
      },
      method: {
        type: String,
        enum: ["bank_transfer", "mobile_money", "cash", "cheque"],
        default: "bank_transfer",
      },
      reference: { type: String, trim: true },
      paidAt: { type: Date },
      batchId: { type: String, trim: true },
    },
    // Approvals
    approvals: {
      hr: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date },
        notes: { type: String, trim: true },
      },
      finance: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date },
        notes: { type: String, trim: true },
      },
    },
    // Payslip generation
    payslip: {
      generated: { type: Boolean, default: false },
      path: { type: String },
      generatedAt: { type: Date },
    },
    // Processing info
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Processed by is required"],
    },
    currency: {
      type: String,
      default: "MWK",
      enum: ["MWK", "USD", "EUR", "GBP"],
    },
    exchangeRate: {
      type: Number,
      default: 1,
      min: [0, "Exchange rate cannot be negative"],
    },
    adjustments: [
      {
        type: {
          type: String,
          enum: ["addition", "deduction", "adjustment", "advance"],
          required: true,
        },
        category: {
          type: String,
          enum: [
            "salary",
            "allowance",
            "bonus",
            "tax",
            "other",
            "edit",
            "advance",
          ],
          required: true,
        },
        duration: {
          type: String,
          enum: ["temporary", "permanent", "recovery"],
          default: "temporary",
        },
        durationDetails: {
          startDate: Date,
          endDate: Date,
          numberOfMonths: Number,
          amountPerMonth: Number,
        },
        // Add recovery period fields
        recoveryPeriod: {
          numberOfMonths: Number,
          amountPerMonth: Number,
          totalAmount: Number,
          startMonth: String, // YYYY-MM
          endMonth: String, // YYYY-MM
        },
        remainingMonths: {
          type: Number,
          default: 0,
        },
        amount: { type: Number, required: true },
        totalAmount: { type: Number }, // For recovery adjustments
        reason: { type: String, required: true, trim: true },
        appliedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        appliedAt: { type: Date, default: Date.now },
        changes: [
          {
            field: String,
            oldValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed,
          },
        ],
      },
    ],

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
payrollSchema.index({ employeeId: 1, payrollMonth: 1 }, { unique: true });
payrollSchema.index({ payrollMonth: 1 });
payrollSchema.index({ "payment.status": 1 });
payrollSchema.index({ "approvals.hr.status": 1 });
payrollSchema.index({ "approvals.finance.status": 1 });
payrollSchema.index({ processedBy: 1 });

// Virtuals
payrollSchema.virtual("employee", {
  ref: "Employee",
  localField: "employeeId",
  foreignField: "_id",
  justOne: true,
});

payrollSchema.virtual("attendanceRate").get(function () {
  if (this.payPeriod.workingDays === 0) return 0;
  return Math.round(
    (this.payPeriod.daysWorked / this.payPeriod.workingDays) * 100,
  );
});

payrollSchema.virtual("deductionRate").get(function () {
  if (this.grossPay === 0) return 0;
  return Math.round((this.deductions.total / this.grossPay) * 100);
});

payrollSchema.virtual("approvalStatus").get(function () {
  const hr = this.approvals.hr.status;
  const finance = this.approvals.finance.status;

  if (hr === "rejected" || finance === "rejected") return "rejected";
  if (hr === "approved" && finance === "approved") return "approved";
  return "pending";
});

payrollSchema.statics.calculateProgressiveTax = async function (
  grossPay,
  country = "MW",
  currency = "MWK",
) {
  // For MWK currency, always use the fixed Malawi formula
  if (currency === "MWK") {
    return this.calculateMalawiTax2024(grossPay);
  }

  try {
    // Get current tax brackets from database
    const taxBrackets = await TaxBracket.getCurrentBrackets(country, currency);

    if (!taxBrackets || taxBrackets.length === 0) {
      console.warn("No active tax brackets found in database, using fallback");
      return this.calculateProgressiveTaxFallback(grossPay);
    }

    console.log(
      `Found ${taxBrackets.length} tax brackets for ${country}/${currency}`,
    );

    let tax = 0;
    let remainingIncome = grossPay;
    const bracketsUsed = [];

    // Sort brackets by minAmount
    const sortedBrackets = taxBrackets.sort(
      (a, b) => a.minAmount - b.minAmount,
    );

    // Calculate tax progressively
    for (let i = 0; i < sortedBrackets.length; i++) {
      const bracket = sortedBrackets[i];

      if (remainingIncome <= 0 || remainingIncome <= bracket.minAmount) {
        break;
      }

      // Calculate taxable amount in this bracket
      const bracketMax =
        bracket.maxAmount === null ? Infinity : bracket.maxAmount;
      const bracketMin = bracket.minAmount;
      const previousMax = i === 0 ? 0 : sortedBrackets[i - 1].maxAmount || 0;

      // Determine how much income falls into this bracket
      let taxableInBracket;
      if (i === 0) {
        // First bracket
        taxableInBracket = Math.min(remainingIncome, bracketMax) - bracketMin;
      } else {
        taxableInBracket =
          Math.min(remainingIncome, bracketMax) -
          Math.max(bracketMin, previousMax);
      }

      // Only tax positive amounts
      taxableInBracket = Math.max(0, taxableInBracket);

      if (taxableInBracket > 0) {
        const taxInBracket = taxableInBracket * (bracket.taxRate / 100);
        tax += taxInBasket;
        remainingIncome -= taxableInBracket;

        bracketsUsed.push({
          name: bracket.bracketName,
          min: bracket.minAmount,
          max: bracket.maxAmount,
          rate: bracket.taxRate,
          amount: taxInBracket,
        });
      }
    }

    // Calculate effective tax rate
    const effectiveRate = grossPay > 0 ? (tax / grossPay) * 100 : 0;

    console.log(`Calculated tax: ${tax}, Effective rate: ${effectiveRate}%`);

    return {
      amount: Math.round(tax * 100) / 100,
      rate: Math.round(effectiveRate * 100) / 100,
      bracketsUsed,
    };
  } catch (error) {
    console.error("Error calculating progressive tax:", error);

    // Fallback to default Malawi tax brackets
    return this.calculateProgressiveTaxFallback(grossPay);
  }
};

payrollSchema.statics.calculateProgressiveTaxFallback = function (grossPay) {
  // Use the same correct formula as calculateMalawiTax2024
  let tax = 0;

  if (grossPay <= 170000) {
    tax = 0;
  } else if (grossPay <= 1570000) {
    tax = (grossPay - 170000) * 0.3;
  } else if (grossPay <= 10000000) {
    const firstBracketTax = (1570000 - 170000) * 0.3; // 420,000
    tax = firstBracketTax + (grossPay - 1570000) * 0.35;
  } else {
    const firstBracketTax = (1570000 - 170000) * 0.3; // 420,000
    const secondBracketTax = (10000000 - 1570000) * 0.35; // 2,950,500
    tax = firstBracketTax + secondBracketTax + (grossPay - 10000000) * 0.4;
  }

  const effectiveRate = grossPay > 0 ? (tax / grossPay) * 100 : 0;

  return {
    amount: Math.round(tax * 100) / 100,
    rate: Math.round(effectiveRate * 100) / 100,
  };
};

// Add this as a new static method
payrollSchema.statics.calculateMalawiTax2024 = function (grossPay) {
  let tax = 0;

  if (grossPay <= 170000) {
    tax = 0;
  } else if (grossPay <= 1570000) {
    // 30% on amount above 170,000
    tax = (grossPay - 170000) * 0.3;
  } else if (grossPay <= 10000000) {
    // Fixed 420,000 for first bracket (1,570,000 - 170,000) * 0.3 = 1,400,000 * 0.3 = 420,000
    // Plus 35% on amount above 1,570,000
    const firstBracketTax = (1570000 - 170000) * 0.3; // This should be 420,000
    tax = firstBracketTax + (grossPay - 1570000) * 0.35;
  } else {
    // Fixed 420,000 for first bracket
    // Fixed 2,950,500 for second bracket (10,000,000 - 1,570,000) * 0.35 = 8,430,000 * 0.35 = 2,950,500
    // Plus 40% on amount above 10,000,000
    const firstBracketTax = (1570000 - 170000) * 0.3; // 420,000
    const secondBracketTax = (10000000 - 1570000) * 0.35; // 2,950,500
    tax = firstBracketTax + secondBracketTax + (grossPay - 10000000) * 0.4;
  }

  const effectiveRate = grossPay > 0 ? (tax / grossPay) * 100 : 0;

  return {
    amount: Math.round(tax * 100) / 100,
    rate: Math.round(effectiveRate * 100) / 100,
  };
};
// Pre-save calculations
payrollSchema.pre("save", async function (next) {
  // Calculate prorated salary based on days worked
  this.salary.prorated =
    (this.salary.base / this.payPeriod.workingDays) * this.payPeriod.daysWorked;

  // Calculate allowances total
  this.allowances.total =
    this.allowances.transport +
    this.allowances.housing +
    this.allowances.medical +
    this.allowances.meals +
    this.allowances.communication +
    this.allowances.other;

  // Calculate overtime amount
  this.overtime.amount = this.overtime.hours * this.overtime.rate * 1.5; // 1.5x multiplier

  // Calculate bonus total
  this.bonuses.total =
    this.bonuses.performance + this.bonuses.annual + this.bonuses.other;

  // Calculate gross pay
  this.grossPay =
    this.salary.prorated +
    this.allowances.total +
    this.overtime.amount +
    this.bonuses.total;

  try {
    const taxCalculation = await this.constructor.calculateProgressiveTax(
      this.grossPay,
      "MW", // Default country
      this.currency,
    );

    // If tax calculation fails or seems incorrect, use the direct formula
    if (taxCalculation.amount <= 0 && this.grossPay > 170000) {
      // Fallback to direct formula calculation
      const manualTaxCalculation = this.constructor.calculateMalawiTax2024(
        this.grossPay,
      );
      this.deductions.tax.amount = manualTaxCalculation.amount;
      this.deductions.tax.rate = manualTaxCalculation.rate;
    } else {
      this.deductions.tax.amount = taxCalculation.amount;
      this.deductions.tax.rate = taxCalculation.rate;
    }
  } catch (error) {
    console.error("Error calculating tax:", error);
    // Use direct formula as fallback
    const taxCalculation = this.constructor.calculateMalawiTax2024(
      this.grossPay,
    );
    this.deductions.tax.amount = taxCalculation.amount;
    this.deductions.tax.rate = taxCalculation.rate;
  }

  // Calculate pension amount (keep existing logic)
  this.deductions.pension.amount =
    (this.grossPay * this.deductions.pension.rate) / 100;

  // Calculate total deductions
  const loanTotal = this.deductions.loans.reduce(
    (sum, loan) => sum + loan.amount,
    0,
  );
  const otherTotal = this.deductions.other.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  this.deductions.total =
    this.deductions.tax.amount +
    this.deductions.pension.amount +
    loanTotal +
    otherTotal;

  // Calculate net pay
  this.netPay = Math.max(0, this.grossPay - this.deductions.total);

  // Apply adjustments
  this.adjustments.forEach((adjustment) => {
    if (
      adjustment.duration === "temporary" ||
      (adjustment.duration === "permanent" &&
        new Date(adjustment.durationDetails.startDate) <= new Date() &&
        new Date(adjustment.durationDetails.endDate) >= new Date())
    ) {
      if (adjustment.type === "addition") {
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
payrollSchema.statics.processAllEmployees = async function (
  month,
  processedBy,
) {
  const Employee = mongoose.model("Employee");

  const employees = await Employee.find({
    "employmentInfo.status": "active",
    isActive: true,
  }).populate([
    { path: "employmentInfo.gradeId", model: "Grade" },
    { path: "employmentInfo.departmentId", model: "Department" },
  ]);

  const payrollRecords = [];
  const [year, monthNum] = month.split("-");
  const startDate = moment(`${year}-${monthNum}-01`);
  const endDate = startDate.clone().endOf("month");
  const workingDays = this.calculateWorkingDays(
    startDate.toDate(),
    endDate.toDate(),
  );

  for (const employee of employees) {
    // Skip if already processed
    const existing = await this.findOne({
      employeeId: employee._id,
      payrollMonth: month,
    });
    if (existing) continue;

    const grade = employee.employmentInfo.gradeId;
    if (!grade) continue;

    // Get approved overtime
    const overtime = employee.overtimeRecords.find(
      (record) => record.month === month && record.status === "approved",
    ) || { hours: 0, rate: grade.payrollSettings.overtimeRate };

    // Calculate prorated salary
    const baseSalary = employee.employmentInfo.currentSalary;
    const proratedSalary = (baseSalary / workingDays) * workingDays; // Full month

    // Calculate allowances total
    const allowancesTotal = Object.values(grade.allowances).reduce(
      (sum, val) => sum + (val || 0),
      0,
    );

    // Calculate overtime amount
    const overtimeAmount =
      overtime.hours * overtime.rate * grade.payrollSettings.overtimeMultiplier;

    // Calculate gross pay
    const grossPay = proratedSalary + allowancesTotal + overtimeAmount;

    try {
      // Calculate progressive tax using the new async method
      const taxCalculation = await this.calculateProgressiveTax(
        grossPay,
        "MW",
        grade.currency || "USD",
      );

      // Calculate pension deduction
      const pensionAmount =
        (grossPay * grade.payrollSettings.pensionPercent) / 100;
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
          daysWorked: workingDays, // Default to full attendance
        },
        salary: {
          base: baseSalary,
          prorated: proratedSalary,
        },
        allowances: {
          ...grade.allowances,
          total: allowancesTotal,
        },
        overtime: {
          hours: overtime.hours,
          rate: overtime.rate,
          amount: overtimeAmount,
        },
        bonuses: {
          performance: 0,
          annual: 0,
          other: 0,
          total: 0,
        },
        deductions: {
          tax: {
            rate: taxCalculation.rate,
            amount: taxCalculation.amount,
          },
          pension: {
            rate: grade.payrollSettings.pensionPercent,
            amount: pensionAmount,
          },
          loans: [],
          other: [],
          total: totalDeductions,
        },
        grossPay,
        netPay,
        processedBy,
        currency: grade.currency || "USD",
      };

      payrollRecords.push(new this(payrollData));
    } catch (error) {
      console.error(
        `Failed to calculate tax for employee ${employee._id}:`,
        error,
      );
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
      console.error(
        `Failed to save payroll for employee ${record.employeeId}:`,
        error,
      );
    }
  }

  return savedRecords;
};
// Static method: Calculate working days
payrollSchema.statics.calculateWorkingDays = function (startDate, endDate) {
  let count = 0;
  const current = moment(startDate);
  const end = moment(endDate);

  while (current.isSameOrBefore(end)) {
    // Skip weekends
    if (current.day() !== 0 && current.day() !== 6) {
      count++;
    }
    current.add(1, "day");
  }
  return count;
};

// Instance method: Approve payroll
payrollSchema.methods.approve = function (type, userId, notes = "") {
  if (type === "hr") {
    this.approvals.hr = {
      status: "approved",
      by: userId,
      at: new Date(),
      notes,
    };
  } else if (type === "finance") {
    this.approvals.finance = {
      status: "approved",
      by: userId,
      at: new Date(),
      notes,
    };
  }
  return this.save();
};

// Instance method: Mark as paid
payrollSchema.methods.markAsPaid = function (
  reference,
  method = "bank_transfer",
) {
  this.payment.status = "paid";
  this.payment.reference = reference;
  this.payment.method = method;
  this.payment.paidAt = new Date();
  return this.save();
};

// Instance method: Generate payslip
payrollSchema.methods.generatePayslip = async function () {
  // This would integrate with a PDF generation service
  // For now, just mark as generated
  this.payslip.generated = true;
  this.payslip.generatedAt = new Date();
  this.payslip.path = `/payslips/${this.employeeId}/${this.payrollMonth}.pdf`;
  return this.save();
};

// Static method: Generate payslips for all employees in a month
payrollSchema.statics.generateAllPayslips = async function (month) {
  const payrolls = await this.find({
    payrollMonth: month,
    "approvals.hr.status": "approved",
    "approvals.finance.status": "approved",
    "payslip.generated": false,
  });

  const results = [];
  for (const payroll of payrolls) {
    try {
      await payroll.generatePayslip();
      results.push({ employeeId: payroll.employeeId, success: true });
    } catch (error) {
      results.push({
        employeeId: payroll.employeeId,
        success: false,
        error: error.message,
      });
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
      total: this.deductions.total,
    },
    netPay: this.netPay,
    currency: this.currency,
  };
};

// Static method: Get payroll summary
payrollSchema.statics.getSummary = async function (month) {
  return await this.aggregate([
    { $match: { payrollMonth: month, isActive: true } },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        totalGrossPay: { $sum: "$grossPay" },
        totalDeductions: { $sum: "$deductions.total" },
        totalNetPay: { $sum: "$netPay" },
        totalTax: { $sum: "$deductions.tax.amount" },
        totalPension: { $sum: "$deductions.pension.amount" },
        paidCount: {
          $sum: { $cond: [{ $eq: ["$payment.status", "paid"] }, 1, 0] },
        },
        pendingCount: {
          $sum: { $cond: [{ $eq: ["$payment.status", "pending"] }, 1, 0] },
        },
      },
    },
  ]);
};

payrollSchema.statics.createFromPreviousMonth = async function (
  month,
  processedBy,
) {
  try {
    const [year, monthNum] = month.split("-");
    const prevMonth = moment(`${year}-${monthNum}-01`)
      .subtract(1, "month")
      .format("YYYY-MM");

    // Get previous month's payrolls
    const prevPayrolls = await this.find({
      payrollMonth: prevMonth,
      isActive: true,
    }).populate("employeeId");

    if (prevPayrolls.length === 0) {
      throw new Error(
        `No payroll records found for previous month (${prevMonth})`,
      );
    }

    const payrollRecords = [];
    const startDate = moment(`${year}-${monthNum}-01`);
    const endDate = startDate.clone().endOf("month");
    const workingDays = this.calculateWorkingDays(
      startDate.toDate(),
      endDate.toDate(),
    );

    for (const prevPayroll of prevPayrolls) {
      // Skip if already processed for this month
      const existing = await this.findOne({
        employeeId: prevPayroll.employeeId._id,
        payrollMonth: month,
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
          daysWorked: workingDays, // Default to full attendance
        },
        salary: {
          base: prevPayroll.salary.base,
          prorated: prevPayroll.salary.base, // Will be recalculated in pre-save
        },
        allowances: { ...prevPayroll.allowances },
        overtime: {
          hours: 0, // Reset overtime
          rate: prevPayroll.overtime.rate,
          amount: 0,
        },
        bonuses: {
          performance: 0, // Reset bonuses
          annual: 0,
          other: 0,
          total: 0,
        },
        deductions: {
          tax: {
            rate: prevPayroll.deductions.tax.rate,
            amount: 0, // Will be recalculated
          },
          pension: {
            rate: prevPayroll.deductions.pension.rate,
            amount: 0, // Will be recalculated
          },
          loans: [...prevPayroll.deductions.loans], // Carry over loans
          other: [], // Reset other deductions
          total: 0, // Will be recalculated
        },
        processedBy: processedBy,
        currency: prevPayroll.currency,
        // Reset payment and approvals
        payment: {
          status: "pending",
          method: "bank_transfer",
          reference: "",
          paidAt: null,
        },
        approvals: {
          hr: { status: "pending", by: null, at: null, notes: "" },
          finance: { status: "pending", by: null, at: null, notes: "" },
        },
        payslip: {
          generated: false,
          path: "",
          generatedAt: null,
        },
        adjustments: [],
        notes: `Created from ${prevMonth} payroll data`,
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
        console.error(
          `Failed to save payroll for employee ${record.employeeId}:`,
          error,
        );
      }
    }

    return savedRecords;
  } catch (error) {
    console.error("Error creating payroll from previous month:", error);
    throw error;
  }
};

payrollSchema.plugin(mongoosePaginate);
const Payroll = mongoose.model("Payroll", payrollSchema);
module.exports = Payroll;
