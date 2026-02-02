const mongoose = require("mongoose");

// Update Workflow.js to remove the unique index on payrollId or fix the schema
const workflowSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"],
      unique: true, // This should be the only unique field
    },
    requestedBy: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    // 3-step approval: HR -> Employee (Finance) -> Admin
    steps: [
      {
        stepNumber: {
          type: Number,
          required: true,
        },
        role: {
          type: String,
          enum: ["hr", "employee", "admin"],
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approvedAt: Date,
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notes: String,
      },
    ],
    currentStep: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "approved", "rejected", "completed"],
      default: "pending",
    },
    payrollGenerated: {
      type: Boolean,
      default: false,
    },
    generatedAt: Date,
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    adjustmentsAllowed: {
      type: Boolean,
      default: true,
    },
    // Add payrollId field if needed
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      required: false,
      // Remove unique constraint or make it sparse
      sparse: true
    },
  },
  {
    timestamps: true,
  },
);

workflowSchema.index({ month: 1 }, { unique: true });
workflowSchema.index({ status: 1 });
workflowSchema.index({ currentStep: 1 });

const Workflow = mongoose.model("Workflow", workflowSchema);
module.exports = Workflow;

