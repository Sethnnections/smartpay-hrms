const Workflow = require('../models/Workflow');
const moment = require('moment');

class WorkflowController {
  // Check if can generate payroll for a month
  static async checkCanGeneratePayroll(month) {
    try {
      const result = await Workflow.canGeneratePayroll(month);
      return result;
    } catch (error) {
      throw error;
    }
  }
  
  // Create workflow for a month
  static async createWorkflow(month, requestedBy) {
    try {
      // Create workflow
      const workflow = await Workflow.createForMonth(month, requestedBy);
      
      return {
        success: true,
        message: 'Workflow created successfully',
        workflow: workflow.getSummary()
      };
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  }
  
  // Approve step
  static async approveStep(userId) {
    try {
      // Get current month
      const currentMonth = moment().format('YYYY-MM');
      
      // Get active workflow for current month
      const workflow = await Workflow.findOne({ 
        month: currentMonth,
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
        month: currentMonth,
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
  
  // Get workflow status for a month
  static async getWorkflowStatus(month = null) {
    try {
      const queryMonth = month || moment().format('YYYY-MM');
      const workflow = await Workflow.findOne({ month: queryMonth })
        .populate('requestedBy', 'email name')
        .populate('steps.approverId', 'email role name')
        .populate('generatedBy', 'email name');
      
      if (!workflow) {
        return {
          exists: false,
          month: queryMonth,
          message: `No workflow for ${queryMonth}`,
          canCreateWorkflow: true
        };
      }
      
      const summary = workflow.getSummary();
      
      return {
        exists: true,
        month: queryMonth,
        status: workflow.status,
        requestedBy: workflow.requestedBy.email,
        requestedAt: workflow.requestedAt,
        payrollGenerated: workflow.payrollGenerated,
        steps: summary.steps.map(step => ({
          role: step.role,
          approver: step.approver.email,
          status: step.status,
          approvedAt: step.approvedAt
        })),
        pendingApprovals: summary.pendingApprovals,
        completedApprovals: summary.completedApprovals,
        canApprove: workflow.status === 'in_progress',
        canGeneratePayroll: workflow.status === 'approved' && !workflow.payrollGenerated
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Mark payroll as generated
  static async markPayrollGenerated(month, generatedBy) {
    try {
      const workflow = await Workflow.findOne({ month });
      
      if (!workflow) {
        throw new Error('No workflow found for this month');
      }
      
      if (workflow.status !== 'approved') {
        throw new Error('Workflow must be approved before generating payroll');
      }
      
      if (workflow.payrollGenerated) {
        throw new Error('Payroll already generated for this month');
      }
      
      await workflow.markPayrollGenerated(generatedBy);
      
      return {
        success: true,
        message: 'Payroll generation recorded',
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
        month: currentMonth,
        status: 'in_progress'
      })
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
  
  // Get workflow history
  static async getWorkflowHistory() {
    try {
      const workflows = await Workflow.find({})
        .sort({ createdAt: -1 })
        .populate('requestedBy', 'email')
        .populate('generatedBy', 'email')
        .populate('steps.approverId', 'email role');
      
      return workflows.map(wf => wf.getSummary());
    } catch (error) {
      throw error;
    }
  }
}

module.exports = WorkflowController;