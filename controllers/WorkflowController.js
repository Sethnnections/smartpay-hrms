const Workflow = require('../models/Workflow');
const Payroll = require('../models/Payroll');
const moment = require('moment');

class WorkflowController {
  // Check if current month workflow exists
  static async checkCurrentMonth() {
    try {
      const currentMonth = moment().format('YYYY-MM');
      const existing = await Workflow.findOne({ currentMonth })
        .populate('payrollId')
        .populate('initiatedBy', 'email')
        .populate('steps.approverId', 'email role');
      
      if (!existing) {
        return {
          exists: false,
          message: `No workflow for ${currentMonth}`,
          canCreate: true,
          currentMonth: currentMonth
        };
      }
      
      return {
        exists: true,
        workflow: existing.getSummary(),
        canApprove: existing.status === 'in_progress',
        canCreate: false
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Create workflow for current month
  static async createWorkflow(payrollId, initiatedBy) {
    try {
      // Check if we already have workflow for current month
      const check = await this.checkCurrentMonth();
      if (check.exists) {
        throw new Error(`Workflow for ${moment().format('MMMM YYYY')} already exists`);
      }
      
      // Create workflow
      const workflow = await Workflow.createForPayroll(payrollId, initiatedBy);
      
      return {
        success: true,
        message: 'Workflow created successfully',
        workflow: workflow.getSummary()
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Approve step
  static async approveStep(userId) {
    try {
      const currentMonth = moment().format('YYYY-MM');
      
      // Get current month workflow
      const workflow = await Workflow.findOne({ 
        currentMonth,
        status: 'in_progress'
      }).populate('steps.approverId');
      
      if (!workflow) {
        throw new Error('No active workflow found for current month');
      }
      
      // Check if user has pending approval
      const canApprove = workflow.steps.some(
        step => step.approverId._id.toString() === userId.toString() && step.status === 'pending'
      );
      
      if (!canApprove) {
        throw new Error('You have no pending approvals');
      }
      
      await workflow.approveStep(userId);
      
      return {
        success: true,
        message: 'Approval recorded',
        workflow: workflow.getSummary()
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Reject step
  static async rejectStep(userId) {
    try {
      const currentMonth = moment().format('YYYY-MM');
      
      const workflow = await Workflow.findOne({ 
        currentMonth,
        status: 'in_progress'
      }).populate('steps.approverId');
      
      if (!workflow) {
        throw new Error('No active workflow found for current month');
      }
      
      await workflow.rejectStep(userId);
      
      return {
        success: true,
        message: 'Rejection recorded',
        workflow: workflow.getSummary()
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Get user's pending approvals
  static async getMyPendingApprovals(userId) {
    try {
      const currentMonth = moment().format('YYYY-MM');
      
      const workflow = await Workflow.findOne({ 
        currentMonth,
        status: 'in_progress'
      })
      .populate('payrollId')
      .populate('steps.approverId', 'email role');
      
      if (!workflow) {
        return {
          hasPending: false,
          message: 'No active workflow'
        };
      }
      
      // Check if this user has pending step
      const pendingStep = workflow.steps.find(
        step => step.approverId._id.toString() === userId.toString() && step.status === 'pending'
      );
      
      if (!pendingStep) {
        return {
          hasPending: false,
          message: 'No pending approvals for you'
        };
      }
      
      return {
        hasPending: true,
        workflow: workflow.getSummary(),
        myStep: {
          stepNumber: pendingStep.stepNumber,
          role: pendingStep.role,
          canApprove: true
        }
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Get workflow history (all completed workflows)
  static async getWorkflowHistory() {
    try {
      const workflows = await Workflow.find({
        status: { $in: ['completed', 'rejected'] }
      })
      .sort({ createdAt: -1 })
      .populate('payrollId')
      .populate('initiatedBy', 'email')
      .populate('steps.approverId', 'email role');
      
      return workflows.map(wf => wf.getSummary());
    } catch (error) {
      throw error;
    }
  }
  
  // Get current workflow status (for display)
  static async getCurrentStatus() {
    try {
      const currentMonth = moment().format('YYYY-MM');
      
      const workflow = await Workflow.findOne({ currentMonth })
        .populate('payrollId')
        .populate('initiatedBy', 'email name')
        .populate('steps.approverId', 'email role name');
      
      if (!workflow) {
        return {
          exists: false,
          currentMonth: currentMonth,
          message: `No workflow for ${moment().format('MMMM YYYY')}`,
          canStartWorkflow: true
        };
      }
      
      const summary = workflow.getSummary();
      
      return {
        exists: true,
        currentMonth: currentMonth,
        status: workflow.status,
        initiatedBy: workflow.initiatedBy.email,
        initiatedAt: workflow.initiatedAt,
        steps: summary.steps.map(step => ({
          role: step.role,
          approver: step.approver.email,
          status: step.status,
          approvedAt: step.approvedAt
        })),
        pendingApprovals: summary.pendingApprovals,
        completedApprovals: summary.completedApprovals,
        canApprove: workflow.status === 'in_progress'
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = WorkflowController;