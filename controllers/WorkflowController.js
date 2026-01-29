const Workflow = require('../models/Workflow');
const Payroll = require('../models/Payroll');
const moment = require('moment');

class WorkflowController {
  // Check if can generate payroll for a month
  static async checkCanGeneratePayroll(month) {
    try {
      const workflow = await Workflow.findOne({ month });
      
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
    } catch (error) {
      throw error;
    }
  }
  
  // Create workflow for a month
  static async createWorkflow(month, requestedBy) {
    try {
      // Check if workflow already exists
      const existing = await Workflow.findOne({ month });
      if (existing) {
        throw new Error(`Workflow for ${month} already exists`);
      }
      
      // Create workflow
      const workflow = await Workflow.create({
        month: month,
        requestedBy: requestedBy,
        steps: [
          { stepNumber: 1, role: 'hr', status: 'pending' },
          { stepNumber: 2, role: 'employee', status: 'pending' },
          { stepNumber: 3, role: 'admin', status: 'pending' }
        ],
        currentStep: 1,
        status: 'in_progress'
      });
      
      return {
        success: true,
        message: 'Workflow created successfully',
        workflow: workflow
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Approve step
  static async approveStep(userId, userRole) {
    try {
      const currentMonth = moment().format('YYYY-MM');
      
      // Get active workflow for current month
      const workflow = await Workflow.findOne({ 
        month: currentMonth,
        status: 'in_progress'
      });
      
      if (!workflow) {
        throw new Error('No active workflow found for current month');
      }
      
      // Find the current step for this user's role
      const currentStep = workflow.steps.find(
        step => step.role === userRole && step.status === 'pending'
      );
      
      if (!currentStep) {
        throw new Error('You have no pending approvals');
      }
      
      // Update step
      currentStep.status = 'approved';
      currentStep.approvedAt = new Date();
      currentStep.approvedBy = userId;
      
      // Check if all steps are approved
      const pendingSteps = workflow.steps.filter(step => step.status === 'pending');
      
      if (pendingSteps.length === 0) {
        // All steps approved
        workflow.status = 'approved';
        workflow.completedAt = new Date();
      } else {
        // Move to next pending step
        const nextStep = workflow.steps.find(step => step.status === 'pending');
        workflow.currentStep = nextStep.stepNumber;
      }
      
      await workflow.save();
      
      return {
        success: true,
        message: 'Approval recorded',
        workflow: workflow
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Reject step
  static async rejectStep(userId, userRole) {
    try {
      const currentMonth = moment().format('YYYY-MM');
      
      const workflow = await Workflow.findOne({ 
        month: currentMonth,
        status: 'in_progress'
      });
      
      if (!workflow) {
        throw new Error('No active workflow found for current month');
      }
      
      // Find the current step for this user's role
      const currentStep = workflow.steps.find(
        step => step.role === userRole && step.status === 'pending'
      );
      
      if (!currentStep) {
        throw new Error('You have no pending approvals');
      }
      
      // Update step
      currentStep.status = 'rejected';
      currentStep.approvedAt = new Date();
      currentStep.approvedBy = userId;
      workflow.status = 'rejected';
      
      await workflow.save();
      
      return {
        success: true,
        message: 'Rejection recorded',
        workflow: workflow
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Get workflow status for a month
  static async getWorkflowStatus(month = null) {
    try {
      const queryMonth = month || moment().format('YYYY-MM');
      const workflow = await Workflow.findOne({ month: queryMonth });
      
      if (!workflow) {
        return {
          exists: false,
          month: queryMonth,
          message: `No workflow for ${queryMonth}`,
          canCreateWorkflow: true
        };
      }
      
      return {
        exists: true,
        month: queryMonth,
        status: workflow.status,
        requestedBy: workflow.requestedBy,
        requestedAt: workflow.requestedAt,
        payrollGenerated: workflow.payrollGenerated,
        steps: workflow.steps,
        currentStep: workflow.currentStep,
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
      
      // Generate payroll for all active employees
      const payrollRecords = await Payroll.processAllEmployees(month, generatedBy);
      
      // Mark workflow as completed
      workflow.payrollGenerated = true;
      workflow.generatedAt = new Date();
      workflow.generatedBy = generatedBy;
      workflow.status = 'completed';
      
      await workflow.save();
      
      return {
        success: true,
        message: `Payroll generated for ${payrollRecords.length} employees`,
        workflow: workflow,
        payrollCount: payrollRecords.length
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Get user's pending approvals
  static async getMyPendingApprovals(userId, userRole) {
    try {
      const currentMonth = moment().format('YYYY-MM');
      
      const workflow = await Workflow.findOne({ 
        month: currentMonth,
        status: 'in_progress'
      });
      
      if (!workflow) {
        return {
          hasPending: false,
          message: 'No active workflow'
        };
      }
      
      // Check if this user has pending step for their role
      const pendingStep = workflow.steps.find(
        step => step.role === userRole && step.status === 'pending'
      );
      
      if (!pendingStep) {
        return {
          hasPending: false,
          message: 'No pending approvals for you'
        };
      }
      
      return {
        hasPending: true,
        workflow: workflow,
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
        .limit(10);
      
      return workflows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = WorkflowController;