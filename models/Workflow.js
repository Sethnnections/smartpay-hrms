const mongoose = require('mongoose');
const moment = require('moment');

const workflowSchema = new mongoose.Schema({
  month: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'],
    unique: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  // Static 3-step approval BEFORE payroll generation
  steps: [{
    stepNumber: {
      type: Number,
      required: true
    },
    role: {
      type: String,
      enum: ['hr', 'employee', 'admin'],
      required: true
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedAt: Date,
    notes: String
  }],
  currentStep: {
    type: Number,
    default: 1,
    min: 1,
    max: 3
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  completedAt: Date,
  payrollGenerated: {
    type: Boolean,
    default: false
  },
  generatedAt: Date,
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Check if workflow exists for a month
workflowSchema.statics.getByMonth = async function(month) {
  return await this.findOne({ month });
};

// Create workflow for month
workflowSchema.statics.createForMonth = async function(month, requestedBy) {
  const Workflow = this;
  const User = mongoose.model('User');
  
  // Check if workflow already exists for this month
  const existing = await Workflow.getByMonth(month);
  if (existing) {
    throw new Error(`Workflow for ${month} already exists`);
  }
  
  // Find users by role
  const hrApprover = await User.findOne({ role: 'hr', isActive: true });
  const employeeApprover = await User.findOne({ role: 'employee', isActive: true });
  const adminApprover = await User.findOne({ role: 'admin', isActive: true });
  
  // Use the current user as fallback for any missing approvers
  const currentUser = await User.findById(requestedBy);
  
  const workflow = new Workflow({
    month: month,
    requestedBy: requestedBy,
    steps: [
      {
        stepNumber: 1,
        role: 'hr',
        approverId: hrApprover ? hrApprover._id : currentUser._id,
        status: 'pending'
      },
      {
        stepNumber: 2,
        role: 'employee',
        approverId: employeeApprover ? employeeApprover._id : currentUser._id,
        status: 'pending'
      },
      {
        stepNumber: 3,
        role: 'admin',
        approverId: adminApprover ? adminApprover._id : currentUser._id,
        status: 'pending'
      }
    ],
    currentStep: 1,
    status: 'in_progress'
  });
  
  return workflow.save();
};

// Approve current step
workflowSchema.methods.approveStep = async function(userId, notes = '') {
  const currentStep = this.steps.find(
    step => step.approverId.toString() === userId.toString() && step.status === 'pending'
  );
  
  if (!currentStep) {
    throw new Error('No pending approval for this user');
  }
  
  // Update step
  currentStep.status = 'approved';
  currentStep.approvedAt = new Date();
  currentStep.notes = notes;
  
  // Move to next step
  const nextStep = this.steps.find(step => step.status === 'pending');
  
  if (nextStep) {
    this.currentStep = nextStep.stepNumber;
  } else {
    // All steps approved - workflow is ready for payroll generation
    this.status = 'approved';
    this.completedAt = new Date();
  }
  
  return this.save();
};

// Reject step
workflowSchema.methods.rejectStep = async function(userId, notes = '') {
  const currentStep = this.steps.find(
    step => step.approverId.toString() === userId.toString() && step.status === 'pending'
  );
  
  if (!currentStep) {
    throw new Error('No pending approval for this user');
  }
  
  currentStep.status = 'rejected';
  currentStep.approvedAt = new Date();
  currentStep.notes = notes;
  this.status = 'rejected';
  
  return this.save();
};

// Mark payroll as generated
workflowSchema.methods.markPayrollGenerated = async function(generatedBy) {
  this.payrollGenerated = true;
  this.generatedAt = new Date();
  this.generatedBy = generatedBy;
  this.status = 'completed';
  
  return this.save();
};

// Get workflow summary
workflowSchema.methods.getSummary = function() {
  return {
    workflowId: this._id,
    month: this.month,
    status: this.status,
    requestedBy: this.requestedBy,
    requestedAt: this.requestedAt,
    currentStep: this.currentStep,
    payrollGenerated: this.payrollGenerated,
    generatedAt: this.generatedAt,
    steps: this.steps.map(step => ({
      stepNumber: step.stepNumber,
      role: step.role,
      approver: step.approverId,
      status: step.status,
      approvedAt: step.approvedAt,
      notes: step.notes
    })),
    pendingApprovals: this.steps.filter(step => step.status === 'pending').map(step => step.role),
    completedApprovals: this.steps.filter(step => step.status === 'approved').map(step => step.role)
  };
};

// Check if payroll can be generated for this month
workflowSchema.statics.canGeneratePayroll = async function(month) {
  const workflow = await this.findOne({ month });
  
  if (!workflow) {
    return {
      canGenerate: false,
      reason: 'No workflow exists for this month'
    };
  }
  
  if (workflow.status === 'approved' && !workflow.payrollGenerated) {
    return {
      canGenerate: true,
      workflowId: workflow._id,
      month: workflow.month
    };
  }
  
  if (workflow.payrollGenerated) {
    return {
      canGenerate: false,
      reason: 'Payroll already generated for this month'
    };
  }
  
  return {
    canGenerate: false,
    reason: `Workflow status: ${workflow.status}`
  };
};

const Workflow = mongoose.model('Workflow', workflowSchema);
module.exports = Workflow;