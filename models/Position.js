const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Position name is required'],
    trim: true,
    maxlength: [100, 'Position name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Position code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [15, 'Position code cannot exceed 15 characters'],
    match: [/^[A-Z0-9-]+$/, 'Position code must contain only uppercase letters, numbers, and hyphens']
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
  reportingTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Position',
    default: null
  },
  jobType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'temporary', 'intern'],
    required: [true, 'Job type is required'],
    default: 'full-time'
  },
  workSchedule: {
    type: {
      type: String,
      enum: ['standard', 'flexible', 'shift', 'remote', 'hybrid'],
      default: 'standard'
    },
    hoursPerWeek: {
      type: Number,
      default: 40,
      min: [1, 'Hours per week must be at least 1'],
      max: [80, 'Hours per week cannot exceed 80']
    },
    workDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    startTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format']
    },
    endTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format']
    }
  },
  description: {
    type: String,
    required: [true, 'Position description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  responsibilities: [{
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Responsibility cannot exceed 500 characters']
  }],
  requirements: {
    education: {
      minimum: {
        type: String,
        enum: ['high_school', 'diploma', 'bachelor', 'master', 'phd'],
        required: [true, 'Minimum education is required']
      },
      preferred: {
        type: String,
        enum: ['high_school', 'diploma', 'bachelor', 'master', 'phd']
      },
      field: {
        type: String,
        trim: true
      }
    },
    experience: {
      minimum: {
        type: Number,
        required: [true, 'Minimum experience is required'],
        min: [0, 'Minimum experience cannot be negative']
      },
      preferred: {
        type: Number,
        min: [0, 'Preferred experience cannot be negative']
      },
      type: {
        type: String,
        enum: ['any', 'relevant', 'management', 'technical', 'leadership'],
        default: 'relevant'
      }
    },
    skills: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      level: {
        type: String,
        enum: ['basic', 'intermediate', 'advanced', 'expert'],
        required: true
      },
      required: {
        type: Boolean,
        default: true
      },
      category: {
        type: String,
        enum: ['technical', 'soft', 'language', 'certification'],
        default: 'technical'
      }
    }],
    certifications: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      issuer: {
        type: String,
        trim: true
      },
      required: {
        type: Boolean,
        default: false
      },
      expiryRequired: {
        type: Boolean,
        default: false
      }
    }],
    languages: [{
      language: {
        type: String,
        required: true,
        trim: true
      },
      proficiency: {
        type: String,
        enum: ['basic', 'conversational', 'business', 'fluent', 'native'],
        required: true
      },
      required: {
        type: Boolean,
        default: false
      }
    }]
  },
  compensation: {
    salaryOverride: {
      type: Number,
      min: [0, 'Salary override cannot be negative']
    },
    allowanceOverrides: {
      transport: Number,
      housing: Number,
      medical: Number,
      other: Number
    },
    bonusEligible: {
      type: Boolean,
      default: true
    },
    overtimeEligible: {
      type: Boolean,
      default: true
    }
  },
  capacity: {
    total: {
      type: Number,
      required: [true, 'Total capacity is required'],
      min: [1, 'Total capacity must be at least 1'],
      default: 1
    },
    filled: {
      type: Number,
      default: 0,
      min: [0, 'Filled capacity cannot be negative']
    },
    vacant: {
      type: Number,
      default: 1,
      min: [0, 'Vacant capacity cannot be negative']
    }
  },
  location: {
    type: {
      type: String,
      enum: ['office', 'remote', 'hybrid', 'field', 'multiple'],
      default: 'office'
    },
    office: {
      building: String,
      floor: String,
      room: String
    },
    allowRemote: {
      type: Boolean,
      default: false
    },
    remotePercentage: {
      type: Number,
      min: [0, 'Remote percentage cannot be negative'],
      max: [100, 'Remote percentage cannot exceed 100%'],
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'frozen', 'under_review', 'discontinued'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
positionSchema.index({ name: 1 });
positionSchema.index({ code: 1 });
positionSchema.index({ departmentId: 1 });
positionSchema.index({ gradeId: 1 });
positionSchema.index({ reportingTo: 1 });
positionSchema.index({ status: 1, isActive: 1 });
positionSchema.index({ jobType: 1 });
positionSchema.index({ priority: 1 });
positionSchema.index({ tags: 1 });

// Compound indexes
positionSchema.index({ departmentId: 1, gradeId: 1 });
positionSchema.index({ status: 1, priority: 1 });

// Virtual for department information
positionSchema.virtual('department', {
  ref: 'Department',
  localField: 'departmentId',
  foreignField: '_id',
  justOne: true
});

// Virtual for grade information
positionSchema.virtual('grade', {
  ref: 'Grade',
  localField: 'gradeId',
  foreignField: '_id',
  justOne: true
});

// Virtual for reporting manager position
positionSchema.virtual('manager', {
  ref: 'Position',
  localField: 'reportingTo',
  foreignField: '_id',
  justOne: true
});

// Virtual for subordinate positions
positionSchema.virtual('subordinates', {
  ref: 'Position',
  localField: '_id',
  foreignField: 'reportingTo'
});

// Virtual for employees in this position
positionSchema.virtual('employees', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'employmentInfo.positionId'
});

// Virtual for vacancy percentage
positionSchema.virtual('vacancyRate').get(function() {
  if (this.capacity.total === 0) return 0;
  return Math.round((this.capacity.vacant / this.capacity.total) * 100);
});

// Virtual for occupancy percentage
positionSchema.virtual('occupancyRate').get(function() {
  if (this.capacity.total === 0) return 0;
  return Math.round((this.capacity.filled / this.capacity.total) * 100);
});

// Virtual for full position code
positionSchema.virtual('fullCode').get(function() {
  return `${this.code}-${this.departmentId?.toString().slice(-4) || 'XXXX'}`;
});

// Pre-save middleware
positionSchema.pre('save', async function(next) {
  try {
    // Update vacant capacity
    this.capacity.vacant = Math.max(0, this.capacity.total - this.capacity.filled);
    
    // Generate code if not provided
    if (!this.code && this.name && this.departmentId) {
      const Department = mongoose.model('Department');
      const department = await Department.findById(this.departmentId);
      
      if (department) {
        const nameCode = this.name.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
        const deptCode = department.code.substring(0, 3);
        const timestamp = Date.now().toString().slice(-3);
        this.code = `${nameCode}-${deptCode}-${timestamp}`;
      }
    }
    
    // Validate capacity
    if (this.capacity.filled > this.capacity.total) {
      return next(new Error('Filled capacity cannot exceed total capacity'));
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-remove middleware
positionSchema.pre('remove', async function(next) {
  try {
    // Check if position has active employees
    const Employee = mongoose.model('Employee');
    const employeeCount = await Employee.countDocuments({
      'employmentInfo.positionId': this._id,
      'employmentInfo.status': 'active'
    });
    
    if (employeeCount > 0) {
      const error = new Error('Cannot delete position with active employees');
      error.code = 'POSITION_HAS_EMPLOYEES';
      return next(error);
    }
    
    // Update subordinate positions to remove reporting relationship
    await this.constructor.updateMany(
      { reportingTo: this._id },
      { $unset: { reportingTo: 1 } }
    );
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to get organizational hierarchy
positionSchema.methods.getHierarchy = async function() {
  const hierarchy = [];
  let current = this;
  
  while (current) {
    hierarchy.unshift({
      _id: current._id,
      name: current.name,
      code: current.code,
      level: hierarchy.length
    });
    
    if (current.reportingTo) {
      current = await this.constructor.findById(current.reportingTo);
    } else {
      break;
    }
  }
  
  return hierarchy;
};

// Instance method to calculate effective salary
positionSchema.methods.getEffectiveSalary = async function() {
  await this.populate('grade');
  
  if (!this.grade) {
    throw new Error('Grade information not found');
  }
  
  const baseSalary = this.compensation.salaryOverride || this.grade.baseSalary;
  const allowances = {
    transport: this.compensation.allowanceOverrides?.transport ?? this.grade.allowances.transport,
    housing: this.compensation.allowanceOverrides?.housing ?? this.grade.allowances.housing,
    medical: this.compensation.allowanceOverrides?.medical ?? this.grade.allowances.medical,
    other: this.compensation.allowanceOverrides?.other ?? this.grade.allowances.other
  };
  
  const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (val || 0), 0);
  
  return {
    baseSalary,
    allowances,
    totalAllowances,
    grossSalary: baseSalary + totalAllowances
  };
};

// Instance method to check if position can be filled
positionSchema.methods.canBeFilled = function() {
  return this.isActive && 
         this.status === 'active' && 
         this.capacity.vacant > 0;
};

// Static method to find vacant positions
positionSchema.statics.findVacant = function() {
  return this.find({
    isActive: true,
    status: 'active',
    'capacity.vacant': { $gt: 0 }
  }).populate('department grade');
};

// Static method to find positions by department
positionSchema.statics.findByDepartment = function(departmentId) {
  return this.find({
    departmentId,
    isActive: true
  }).populate('grade').sort({ name: 1 });
};

// Static method to find positions by grade
positionSchema.statics.findByGrade = function(gradeId) {
  return this.find({
    gradeId,
    isActive: true
  }).populate('department').sort({ name: 1 });
};

// Instance method to update capacity
positionSchema.methods.updateCapacity = async function(change) {
  this.capacity.filled = Math.max(0, this.capacity.filled + change);
  this.capacity.vacant = Math.max(0, this.capacity.total - this.capacity.filled);
  return await this.save();
};

// Instance method to get statistics
positionSchema.methods.getStatistics = async function() {
  const Employee = mongoose.model('Employee');
  
  const [activeEmployees, totalEmployees, avgTenure] = await Promise.all([
    Employee.countDocuments({
      'employmentInfo.positionId': this._id,
      'employmentInfo.status': 'active'
    }),
    Employee.countDocuments({
      'employmentInfo.positionId': this._id
    }),
    Employee.aggregate([
      {
        $match: {
          'employmentInfo.positionId': this._id,
          'employmentInfo.status': 'active'
        }
      },
      {
        $group: {
          _id: null,
          avgTenure: {
            $avg: {
              $divide: [
                { $subtract: [new Date(), '$employmentInfo.startDate'] },
                1000 * 60 * 60 * 24 * 30 // Convert to months
              ]
            }
          }
        }
      }
    ])
  ]);
  
  return {
    capacity: this.capacity,
    occupancyRate: this.occupancyRate,
    vacancyRate: this.vacancyRate,
    activeEmployees,
    totalEmployees,
    averageTenure: avgTenure[0]?.avgTenure || 0
  };
};

const Position = mongoose.model('Position', positionSchema);

module.exports = Position;