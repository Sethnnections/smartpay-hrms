const mongoose = require('mongoose');
const moment = require('moment');

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9-]+$/, 'Employee ID must contain only uppercase letters, numbers, and hyphens']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    sparse: true 
  },
  personalInfo: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    middleName: {
      type: String,
      trim: true,
      maxlength: [50, 'Middle name cannot exceed 50 characters']
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
      validate: {
        validator: function(value) {
          return moment().diff(moment(value), 'years') >= 16;
        },
        message: 'Employee must be at least 16 years old'
      }
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      required: [true, 'Gender is required']
    },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed', 'separated'],
      default: 'single'
    },
    nationality: {
      type: String,
      required: [true, 'Nationality is required'],
      trim: true
    },
    idNumber: {
      type: String,
      required: [true, 'ID number is required'],
      unique: true,
      trim: true
    },
    passportNumber: {
      type: String,
      trim: true,
      sparse: true
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
    },
    alternatePhone: {
      type: String,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    personalEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    address: {
      street: {
        type: String,
        required: [true, 'Street address is required'],
        trim: true
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
      },
      state: {
        type: String,
        required: [true, 'State is required'],
        trim: true
      },
      zipCode: {
        type: String,
        required: [true, 'Zip code is required'],
        trim: true
      },
      country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
        default: 'United States'
      }
    },
    profilePicture: {
      type: String
    }
  },
  employmentInfo: {
    positionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      required: [true, 'Position is required']
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required']
    },
    gradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grade',
      required: [true, 'Grade is required']
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now
    },
    endDate: {
      type: Date
    },
    probationEndDate: {
      type: Date
    },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'temporary', 'intern'],
      required: [true, 'Employment type is required'],
      default: 'full-time'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'terminated', 'resigned', 'retired'],
      default: 'active'
    },
    workLocation: {
      type: String,
      enum: ['office', 'remote', 'hybrid', 'field'],
      default: 'office'
    },
    currentSalary: {
      type: Number,
      required: [true, 'Current salary is required'],
      min: [0, 'Salary cannot be negative']
    },
    contractEndDate: {
      type: Date
    },
    isOnProbation: {
      type: Boolean,
      default: true
    }
  },
  bankInfo: {
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true
    },
    accountName: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true
    },
    routingNumber: {
      type: String,
      trim: true
    },
    bankCode: {
      type: String,
      trim: true
    },
    branchCode: {
      type: String,
      trim: true
    },
    iban: {
      type: String,
      trim: true,
      uppercase: true
    }
  },
  documents: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['id', 'passport', 'resume', 'contract', 'certificate', 'medical', 'other'],
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    expiryDate: {
      type: Date
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: {
      type: Date
    }
  }],
  overtimeRecords: [{
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format']
    },
    hours: {
      type: Number,
      required: true,
      min: [0, 'Overtime hours cannot be negative'],
      max: [200, 'Overtime hours cannot exceed 200 per month']
    },
    rate: {
      type: Number,
      required: true,
      min: [0, 'Overtime rate cannot be negative']
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Overtime amount cannot be negative']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    submittedDate: {
      type: Date,
      default: Date.now
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'paid'],
      default: 'pending'
    },
    rejectionReason: {
      type: String,
      trim: true
    }
  }],
  emergencyContact: {
    name: {
      type: String,
      required: [true, 'Emergency contact name is required'],
      trim: true
    },
    relationship: {
      type: String,
      required: [true, 'Relationship is required'],
      trim: true
    },
    phoneNumber: {
      type: String,
      required: [true, 'Emergency contact phone is required'],
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
    },
    alternatePhone: {
      type: String,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  benefits: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['health', 'dental', 'vision', 'life', 'disability', 'retirement', 'other'],
      required: true
    },
    provider: {
      type: String,
      trim: true
    },
    policyNumber: {
      type: String,
      trim: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date
    },
    employeeContribution: {
      type: Number,
      default: 0,
      min: [0, 'Employee contribution cannot be negative']
    },
    employerContribution: {
      type: Number,
      default: 0,
      min: [0, 'Employer contribution cannot be negative']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  performanceReviews: [{
    reviewPeriod: {
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      }
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    overallRating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      required: true
    },
    goals: [{
      description: String,
      achieved: Boolean,
      rating: {
        type: Number,
        min: 1,
        max: 5
      }
    }],
    strengths: [String],
    areasForImprovement: [String],
    comments: {
      type: String,
      trim: true
    },
    reviewDate: {
      type: Date,
      default: Date.now
    },
    nextReviewDate: {
      type: Date
    }
  }],
  leaveBalance: {
    annual: {
      allocated: {
        type: Number,
        default: 0,
        min: [0, 'Annual leave allocation cannot be negative']
      },
      used: {
        type: Number,
        default: 0,
        min: [0, 'Used annual leave cannot be negative']
      },
      pending: {
        type: Number,
        default: 0,
        min: [0, 'Pending annual leave cannot be negative']
      }
    },
    sick: {
      allocated: {
        type: Number,
        default: 0,
        min: [0, 'Sick leave allocation cannot be negative']
      },
      used: {
        type: Number,
        default: 0,
        min: [0, 'Used sick leave cannot be negative']
      }
    },
    personal: {
      allocated: {
        type: Number,
        default: 0,
        min: [0, 'Personal leave allocation cannot be negative']
      },
      used: {
        type: Number,
        default: 0,
        min: [0, 'Used personal leave cannot be negative']
      }
    }
  },
  notes: [{
    content: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['general', 'performance', 'disciplinary', 'achievement', 'personal'],
      default: 'general'
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
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
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ userId: 1 });
employeeSchema.index({ 'personalInfo.email': 1 });
employeeSchema.index({ 'personalInfo.idNumber': 1 });
employeeSchema.index({ 'employmentInfo.positionId': 1 });
employeeSchema.index({ 'employmentInfo.departmentId': 1 });
employeeSchema.index({ 'employmentInfo.gradeId': 1 });
employeeSchema.index({ 'employmentInfo.managerId': 1 });
employeeSchema.index({ 'employmentInfo.status': 1 });
employeeSchema.index({ 'employmentInfo.startDate': 1 });
employeeSchema.index({ isActive: 1 });
employeeSchema.index({ tags: 1 });

// Compound indexes
employeeSchema.index({ 'employmentInfo.departmentId': 1, 'employmentInfo.status': 1 });
employeeSchema.index({ 'employmentInfo.gradeId': 1, 'employmentInfo.status': 1 });

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  const parts = [this.personalInfo.firstName];
  if (this.personalInfo.middleName) {
    parts.push(this.personalInfo.middleName);
  }
  parts.push(this.personalInfo.lastName);
  return parts.join(' ');
});

// Virtual for age
employeeSchema.virtual('age').get(function() {
  return moment().diff(moment(this.personalInfo.dateOfBirth), 'years');
});

// Virtual for tenure
employeeSchema.virtual('tenure').get(function() {
  const startDate = moment(this.employmentInfo.startDate);
  const endDate = this.employmentInfo.endDate ? moment(this.employmentInfo.endDate) : moment();
  return endDate.diff(startDate, 'months');
});

// Virtual for position details
employeeSchema.virtual('position', {
  ref: 'Position',
  localField: 'employmentInfo.positionId',
  foreignField: '_id',
  justOne: true
});

// Virtual for department details
employeeSchema.virtual('department', {
  ref: 'Department',
  localField: 'employmentInfo.departmentId',
  foreignField: '_id',
  justOne: true
});

// Virtual for grade details
employeeSchema.virtual('grade', {
  ref: 'Grade',
  localField: 'employmentInfo.gradeId',
  foreignField: '_id',
  justOne: true
});

// Virtual for manager details
employeeSchema.virtual('manager', {
  ref: 'Employee',
  localField: 'employmentInfo.managerId',
  foreignField: '_id',
  justOne: true
});

// Virtual for subordinates
employeeSchema.virtual('subordinates', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'employmentInfo.managerId'
});

// Virtual for user account
employeeSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for remaining annual leave
employeeSchema.virtual('remainingAnnualLeave').get(function() {
  return this.leaveBalance.annual.allocated - this.leaveBalance.annual.used - this.leaveBalance.annual.pending;
});

// Virtual for probation status
employeeSchema.virtual('probationStatus').get(function() {
  if (!this.employmentInfo.isOnProbation) return 'completed';
  if (!this.employmentInfo.probationEndDate) return 'ongoing';
  return moment().isAfter(this.employmentInfo.probationEndDate) ? 'completed' : 'ongoing';
});

// Pre-save middleware
employeeSchema.pre('save', async function(next) {
  try {
    // Generate employee ID if not provided
    if (!this.employeeId) {
      const lastEmployee = await this.constructor.findOne({}, {}, { sort: { createdAt: -1 } });
      let nextNumber = 1;
      
      if (lastEmployee && lastEmployee.employeeId) {
        const match = lastEmployee.employeeId.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      this.employeeId = `EMP${nextNumber.toString().padStart(5, '0')}`;
    }
    
    // Set probation end date if on probation and not set
    if (this.employmentInfo.isOnProbation && !this.employmentInfo.probationEndDate) {
      this.employmentInfo.probationEndDate = moment(this.employmentInfo.startDate).add(3, 'months').toDate();
    }
    
    // Update position capacity when employee status changes
    if (this.isModified('employmentInfo.status') || this.isModified('employmentInfo.positionId')) {
      const Position = mongoose.model('Position');
      
      // If employee is becoming active
      if (this.employmentInfo.status === 'active' && this.employmentInfo.positionId) {
        await Position.findByIdAndUpdate(
          this.employmentInfo.positionId,
          { $inc: { 'capacity.filled': 1, 'capacity.vacant': -1 } }
        );
      }
      
      // If employee is becoming inactive
      if (['inactive', 'terminated', 'resigned'].includes(this.employmentInfo.status) && this.employmentInfo.positionId) {
        await Position.findByIdAndUpdate(
          this.employmentInfo.positionId,
          { $inc: { 'capacity.filled': -1, 'capacity.vacant': 1 } }
        );
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to get tenure in months
employeeSchema.methods.getTenureInMonths = function() {
  return this.tenure;
};

// Instance method to get tenure in years
employeeSchema.methods.getTenureInYears = function() {
  return Math.floor(this.tenure / 12);
};

// Instance method to submit overtime
employeeSchema.methods.submitOvertime = function(month, hours, description = '') {
  return new Promise(async (resolve, reject) => {
    try {
      await this.populate('grade');
      
      if (!this.grade) {
        return reject(new Error('Employee grade not found'));
      }
      
      const rate = this.grade.payrollSettings.overtimeRate;
      const amount = hours * rate * this.grade.payrollSettings.overtimeMultiplier;
      
      // Check if overtime already exists for this month
      const existingIndex = this.overtimeRecords.findIndex(record => record.month === month);
      
      if (existingIndex >= 0) {
        this.overtimeRecords[existingIndex].hours = hours;
        this.overtimeRecords[existingIndex].amount = amount;
        this.overtimeRecords[existingIndex].description = description;
        this.overtimeRecords[existingIndex].status = 'pending';
        this.overtimeRecords[existingIndex].submittedDate = new Date();
      } else {
        this.overtimeRecords.push({
          month,
          hours,
          rate,
          amount,
          description,
          status: 'pending'
        });
      }
      
      await this.save();
      resolve(this.overtimeRecords[existingIndex >= 0 ? existingIndex : this.overtimeRecords.length - 1]);
    } catch (error) {
      reject(error);
    }
  });
};

// Instance method to calculate monthly salary
employeeSchema.methods.calculateMonthlySalary = async function(month, includeOvertime = true) {
  await this.populate('grade');
  
  if (!this.grade) {
    throw new Error('Employee grade not found');
  }
  
  const baseSalary = this.employmentInfo.currentSalary;
  const allowances = this.grade.allowances;
  const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (val || 0), 0);
  
  let overtimePay = 0;
  if (includeOvertime) {
    const overtimeRecord = this.overtimeRecords.find(record => 
      record.month === month && record.status === 'approved'
    );
    if (overtimeRecord) {
      overtimePay = overtimeRecord.amount;
    }
  }
  
  const grossSalary = baseSalary + totalAllowances + overtimePay;
  
  // Calculate deductions
  const payeDeduction = (grossSalary * this.grade.payrollSettings.payeePercent) / 100;
  const pensionDeduction = (grossSalary * this.grade.payrollSettings.pensionPercent) / 100;
  const totalDeductions = payeDeduction + pensionDeduction;
  
  const netSalary = grossSalary - totalDeductions;
  
  return {
    baseSalary,
    allowances: {
      ...allowances,
      total: totalAllowances
    },
    overtimePay,
    grossSalary,
    deductions: {
      paye: payeDeduction,
      pension: pensionDeduction,
      total: totalDeductions
    },
    netSalary
  };
};

// Instance method to add performance review
employeeSchema.methods.addPerformanceReview = function(reviewData, reviewerId) {
  const review = {
    ...reviewData,
    reviewer: reviewerId,
    reviewDate: new Date(),
    nextReviewDate: moment().add(1, 'year').toDate()
  };
  
  this.performanceReviews.push(review);
  return this.save();
};

// Instance method to get latest performance review
employeeSchema.methods.getLatestPerformanceReview = function() {
  return this.performanceReviews
    .sort((a, b) => new Date(b.reviewDate) - new Date(a.reviewDate))[0];
};

// Instance method to get average performance rating
employeeSchema.methods.getAveragePerformanceRating = function() {
  if (this.performanceReviews.length === 0) return 0;
  
  const total = this.performanceReviews.reduce((sum, review) => sum + review.overallRating, 0);
  return (total / this.performanceReviews.length).toFixed(2);
};

// Static method to find employees by department
employeeSchema.statics.findByDepartment = function(departmentId, status = 'active') {
  return this.find({
    'employmentInfo.departmentId': departmentId,
    'employmentInfo.status': status
  }).populate('position grade');
};

// Static method to find expiring documents
employeeSchema.statics.findExpiringDocuments = function(days = 30) {
  const futureDate = moment().add(days, 'days').toDate();
  
  return this.aggregate([
    { $unwind: '$documents' },
    {
      $match: {
        'documents.expiryDate': { $lte: futureDate, $gte: new Date() },
        isActive: true
      }
    },
    {
      $project: {
        employeeId: 1,
        fullName: { $concat: ['$personalInfo.firstName', ' ', '$personalInfo.lastName'] },
        document: '$documents',
        daysToExpiry: {
          $divide: [
            { $subtract: ['$documents.expiryDate', new Date()] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    }
  ]);
};

// Instance method to terminate employment
employeeSchema.methods.terminate = function(endDate, reason) {
  this.employmentInfo.status = 'terminated';
  this.employmentInfo.endDate = endDate;
  this.isActive = false;
  
  // Add termination note
  this.notes.push({
    content: `Employment terminated. Reason: ${reason}`,
    category: 'general',
    createdBy: this.userId
  });
  
  return this.save();
};

employeeSchema.index({ 'employmentInfo.departmentId': 1 });
employeeSchema.index({ 'employmentInfo.gradeId': 1 });
employeeSchema.index({ 'employmentInfo.status': 1 });
employeeSchema.index({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 });
employeeSchema.index({ employeeId: 1 });

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;