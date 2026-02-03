const Workflow = require('../models/Workflow');
const Payroll = require('../models/Payroll');
const moment = require('moment');

class WorkflowController {
  // HR can generate payroll without approval first
  static async checkCanGeneratePayroll(month) {
    try {
      const workflow = await Workflow.findOne({ month });
      
      if (!workflow) {
        return {
          canGenerate: true,
          reason: 'No workflow exists - HR can generate payroll'
        };
      }
      
      // HR can generate if workflow exists but payroll not generated yet
      if (!workflow.payrollGenerated) {
        return {
          canGenerate: true,
          workflowId: workflow._id,
          month: workflow.month,
          status: workflow.status
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
  
  // Create workflow when HR generates payroll
// WorkflowController.js - Update the createWorkflow method
static async createWorkflow(month, requestedBy) {
  try {
    console.log('Creating workflow for:', month, 'requestedBy:', requestedBy);
    
    // Check if workflow already exists
    const existing = await Workflow.findOne({ month });
    if (existing) {
      // Update existing workflow
      existing.payrollGenerated = true;
      existing.generatedAt = new Date();
      existing.generatedBy = requestedBy;
      existing.status = 'in_progress';
      await existing.save();
      
      return {
        success: true,
        message: 'Workflow updated successfully',
        workflow: existing
      };
    }
    
    // Create new workflow with 3-step approval: HR -> Employee (Finance) -> Admin
    const workflow = await Workflow.create({
      month: month,
      requestedBy: requestedBy,
      requestedAt: new Date(),
      steps: [
        { stepNumber: 1, role: 'hr', status: 'pending' },
        { stepNumber: 2, role: 'employee', status: 'pending' }, // Finance approval done by employee role
        { stepNumber: 3, role: 'admin', status: 'pending' }
      ],
      currentStep: 1,
      status: 'in_progress',
      payrollGenerated: true,
      generatedAt: new Date(),
      generatedBy: requestedBy,
      adjustmentsAllowed: true
    });
    
    console.log('Workflow created successfully:', workflow._id);
    
    return {
      success: true,
      message: 'Workflow created successfully',
      workflow: workflow
    };
  } catch (error) {
    console.error('Error creating workflow:', error);
    throw error;
  }
}
  
  // Check if adjustments can be made (before approval)
  static async canMakeAdjustments(month) {
    try {
      const workflow = await Workflow.findOne({ month });
      
      if (!workflow) {
        return {
          canAdjust: false,
          reason: 'No workflow exists'
        };
      }
      
      // Allow adjustments if payroll is generated but not approved
      if (workflow.payrollGenerated && workflow.status === 'in_progress' && workflow.currentStep === 1) {
        return {
          canAdjust: true,
          workflowId: workflow._id,
          month: workflow.month,
          currentStep: workflow.currentStep
        };
      }
      
      return {
        canAdjust: false,
        reason: workflow.status === 'approved' ? 'Payroll already approved' : 'Adjustments period ended'
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Start approval process (HR initiates approvals after adjustments)
// Update the startApprovalProcess method in WorkflowController.js
static async startApprovalProcess(month, userId) {
    try {
        console.log('Starting approval process for month:', month, 'user:', userId);
        
        const workflow = await Workflow.findOne({ month });
        
        if (!workflow) {
            throw new Error(`No workflow found for month ${month}`);
        }
        
        if (!workflow.payrollGenerated) {
            throw new Error('Payroll must be generated before starting approval');
        }
        
        if (workflow.status !== 'in_progress') {
            throw new Error(`Workflow status is ${workflow.status}, cannot start approval`);
        }
        
        // Mark HR step as approved
        const hrStep = workflow.steps.find(step => step.role === 'hr');
        if (hrStep) {
            hrStep.status = 'approved';
            hrStep.approvedAt = new Date();
            hrStep.approvedBy = userId;
            hrStep.notes = 'HR started approval process';
        }
        
        // Move to next step
        workflow.currentStep = 2;
        workflow.status = 'in_progress';
        
        await workflow.save();
        
        console.log('Approval process started for:', month);
        
        return {
            success: true,
            message: 'Approval process started. Waiting for finance approval.',
            workflow: workflow
        };
    } catch (error) {
        console.error('Error in startApprovalProcess:', error);
        throw error;
    }
}

// Approve step (for any role)
static async approveStep(month, userId, userRole, notes = '') {
  try {
    // Get workflow for the specified month
    const workflow = await Workflow.findOne({ 
      month: month,
      status: 'in_progress'
    });
    
    if (!workflow) {
      throw new Error(`No active workflow found for month ${month}`);
    }
    
    // Find the current step for this user's role
    const currentStep = workflow.steps.find(
      step => step.role === userRole && step.status === 'pending'
    );
    
    if (!currentStep) {
      throw new Error('You have no pending approvals for this workflow');
    }
    
    // Update step
    currentStep.status = 'approved';
    currentStep.approvedAt = new Date();
    currentStep.approvedBy = userId;
    currentStep.notes = notes;
    
    // Move to next step
    workflow.currentStep = currentStep.stepNumber + 1;
    
    // Check if all steps are approved
    const pendingSteps = workflow.steps.filter(step => step.status === 'pending');
    
    if (pendingSteps.length === 0) {
      // All steps approved
      workflow.status = 'approved';
      workflow.completedAt = new Date();
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
static async rejectStep(month, userId, userRole, reason) {
  try {
    const workflow = await Workflow.findOne({ 
      month: month,
      status: 'in_progress'
    });
    
    if (!workflow) {
      throw new Error(`No active workflow found for month ${month}`);
    }
    
    // Find the current step for this user's role
    const currentStep = workflow.steps.find(
      step => step.role === userRole && step.status === 'pending'
    );
    
    if (!currentStep) {
      throw new Error('You have no pending approvals for this workflow');
    }
    
    // Update step
    currentStep.status = 'rejected';
    currentStep.approvedAt = new Date();
    currentStep.approvedBy = userId;
    currentStep.notes = reason;
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


  
  // Mark payroll as paid (after approvals)
  static async markPayrollPaid(month, paidBy) {
    try {
      const workflow = await Workflow.findOne({ month });
      
      if (!workflow) {
        throw new Error('No workflow found for this month');
      }
      
      if (workflow.status !== 'approved') {
        throw new Error('Workflow must be approved before marking as paid');
      }
      
      // Update all payrolls for this month to paid status
      const payrolls = await Payroll.find({ payrollMonth: month });
      
      for (const payroll of payrolls) {
        if (payroll.payment.status !== 'paid') {
          payroll.payment.status = 'paid';
          payroll.payment.paidAt = new Date();
          payroll.payment.reference = `PAY-${month}-${payroll.employeeId}`;
          await payroll.save();
        }
      }
      
      // Update workflow status
      workflow.status = 'completed';
      workflow.completedAt = new Date();
      await workflow.save();
      
      return {
        success: true,
        message: `Marked ${payrolls.length} payrolls as paid`,
        count: payrolls.length
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Get workflow status
  static async getWorkflowStatus(month = null) {
    try {
      const queryMonth = month || moment().format('YYYY-MM');
      const workflow = await Workflow.findOne({ month: queryMonth });
      
      if (!workflow) {
        return {
          exists: false,
          month: queryMonth,
          message: `No workflow for ${queryMonth}`,
          canGeneratePayroll: true,
          canMakeAdjustments: false,
          canStartApproval: false,
          canMarkPaid: false
        };
      }
      
      // Check if adjustments can be made
      const canAdjust = workflow.payrollGenerated && 
                       workflow.status === 'in_progress' && 
                       workflow.currentStep === 1;
      
      return {
        exists: true,
        month: queryMonth,
        status: workflow.status,
        requestedBy: workflow.requestedBy,
        requestedAt: workflow.requestedAt,
        payrollGenerated: workflow.payrollGenerated,
        steps: workflow.steps,
        currentStep: workflow.currentStep,
        canGeneratePayroll: !workflow.payrollGenerated,
        canMakeAdjustments: canAdjust,
        canStartApproval: workflow.payrollGenerated && workflow.status === 'in_progress' && workflow.currentStep === 1,
        canMarkPaid: workflow.status === 'approved'
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Get user's pending approval

// Also update getMyPendingApprovals to accept month parameter
static async getMyPendingApprovals(month, userId, userRole) {
  try {
    const workflow = await Workflow.findOne({ 
      month: month,
      status: 'in_progress'
    });
    
    if (!workflow) {
      return {
        hasPending: false,
        message: `No active workflow found for ${month}`
      };
    }
    
    // Check if this user has pending step for their role
    const pendingStep = workflow.steps.find(
      step => step.role === userRole && step.status === 'pending'
    );
    
    if (!pendingStep) {
      return {
        hasPending: false,
        message: 'No pending approvals for you in this workflow'
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
      const workflows = await Workflow.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('requestedBy', 'name email')
        .populate('generatedBy', 'name email')
        .populate('steps.approvedBy', 'name email');
      
      return workflows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = WorkflowController;