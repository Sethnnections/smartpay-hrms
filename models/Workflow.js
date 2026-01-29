const mongoose = require('mongoose');

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
  // 3-step approval
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
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  currentStep: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
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

const Workflow = mongoose.model('Workflow', workflowSchema);
module.exports = Workflow;