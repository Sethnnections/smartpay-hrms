const mongoose = require('mongoose');
const moment = require('moment');

const workflowSchema = new mongoose.Schema({
  payrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true,
    unique: true
  },
  currentMonth: {
    type: String,
    required: true,
    default: () => moment().format('YYYY-MM')
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  // Static 3-step approval
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
  completedAt: Date
}, {
  timestamps: true
});

// Check if current month workflow exists
workflowSchema.statics.checkCurrentMonthWorkflow = async function() {
  const currentMonth = moment().format('YYYY-MM');
  return await this.findOne({ currentMonth });
};

// Create workflow for payroll
workflowSchema.statics.createForPayroll = async function(payrollId, initiatedBy) {
  const Workflow = this;
  const User = mongoose.model('User');
  
  // Check if current month already has workflow
  const existing = await Workflow.checkCurrentMonthWorkflow();
  if (existing) {
    throw new Error(`Workflow for ${moment().format('MMMM YYYY')} already exists`);
  }
  
  // Get the 3 static users
  const hrUser = await User.findOne({ email: 'hr@company.com' });
  const employeeUser = await User.findOne({ email: 'employee@company.com' });
  const adminUser = await User.findOne({ email: 'admin@company.com' });
  
  if (!hrUser || !employeeUser || !adminUser) {
    throw new Error('Static users not found. Please create: hr@company.com, employee@company.com, admin@company.com');
  }
  
  // Create static workflow steps
  const workflow = new Workflow({
    payrollId: payrollId,
    initiatedBy: initiatedBy,
    steps: [
      {
        stepNumber: 1,
        role: 'hr',
        approverId: hrUser._id,
        status: 'pending'
      },
      {
        stepNumber: 2,
        role: 'employee',
        approverId: employeeUser._id,
        status: 'pending'
      },
      {
        stepNumber: 3,
        role: 'admin',
        approverId: adminUser._id,
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
    // All steps approved
    this.status = 'completed';
    this.completedAt = new Date();
    
    // Update payroll payment status
    const Payroll = mongoose.model('Payroll');
    await Payroll.findByIdAndUpdate(this.payrollId, {
      'payment.status': 'approved'
    });
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

// Get workflow summary
workflowSchema.methods.getSummary = function() {
  return {
    workflowId: this._id,
    currentMonth: this.currentMonth,
    status: this.status,
    initiatedBy: this.initiatedBy,
    initiatedAt: this.initiatedAt,
    currentStep: this.currentStep,
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

const Workflow = mongoose.model('Workflow', workflowSchema);
module.exports = Workflow;