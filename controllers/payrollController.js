const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Grade = require('../models/Grade');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

// Configuration
const COMPANY_NAME = process.env.COMPANY_NAME || 'Norah Tech Supplies Ltd.';
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || 'Umoyo Building, Blantyre, Malawi';
const COMPANY_LOGO = process.env.COMPANY_LOGO_PATH || path.join(process.cwd(), 'public', 'logo.png');
const BANK_NAME = process.env.BANK_NAME || 'National Bank of Malawi';
const COMPANY_ACCOUNT = process.env.COMPANY_ACCOUNT || '123456789';
const PAYSLIP_DIR = process.env.PAYSLIP_DIR || path.join('/tmp', 'payslips');

// Ensure directory exists
try {
  if (!fs.existsSync(PAYSLIP_DIR)) {
    fs.mkdirSync(PAYSLIP_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create payslip directory:', err);
}

// Updated Color scheme - lighter, more professional
const COLORS = {
  primary: '#0b1f3a',      // Blue
  secondary: '#64748b',    // Slate
  accent: '#f59e0b',       // Amber
  text: '#374151',         // Gray-700
  textLight: '#6b7280',    // Gray-500
  success: '#10b981',      // Emerald
  warning: '#f59e0b',      // Amber
  error: '#ef4444',        // Red
  background: '#ffffff',   // White
  lightBg: '#f8fafc',      // Slate-50
  border: '#e5e7eb'        // Gray-200
};

const payrollController = {
      // Update payroll record
      updatePayroll: async (payrollId, updateData, userId) => {
        try {
          const payroll = await Payroll.findById(payrollId);
    
          if (!payroll) {
            const error = new Error('Payroll record not found');
            error.statusCode = 404;
            throw error;
          }
    
          // Prevent updates to paid payrolls
          if (payroll.payment.status === 'paid') {
            const error = new Error('Cannot update paid payroll records');
            error.statusCode = 400;
            throw error;
          }
    
          // Update allowed fields
          const allowedUpdates = [
            'payPeriod.daysWorked',
            'bonuses.performance',
            'bonuses.annual',
            'bonuses.other',
            'deductions.other',
            'notes'
          ];
    
          Object.keys(updateData).forEach(key => {
            if (allowedUpdates.includes(key)) {
              if (key.includes('.')) {
                const [parent, child] = key.split('.');
                if (payroll[parent]) {
                  payroll[parent][child] = updateData[key];
                }
              } else {
                payroll[key] = updateData[key];
              }
            }
          });
    
          const updatedPayroll = await payroll.save();
          return updatedPayroll;
        } catch (error) {
          throw error;
        }
      },
    
      // Approve payroll (HR or Finance)
      approvePayroll: async (payrollId, approvalType, userId, notes = '') => {
        try {
          const payroll = await Payroll.findById(payrollId);
    
          if (!payroll) {
            const error = new Error('Payroll record not found');
            error.statusCode = 404;
            throw error;
          }
    
          if (!['hr', 'finance'].includes(approvalType)) {
            const error = new Error('Invalid approval type. Must be "hr" or "finance"');
            error.statusCode = 400;
            throw error;
          }
    
          await payroll.approve(approvalType, userId, notes);
    
          return payroll;
        } catch (error) {
          throw error;
        }
      },
    
      // Reject payroll
      rejectPayroll: async (payrollId, approvalType, userId, notes) => {
        try {
          const payroll = await Payroll.findById(payrollId);
    
          if (!payroll) {
            const error = new Error('Payroll record not found');
            error.statusCode = 404;
            throw error;
          }
    
          if (!notes || notes.trim().length === 0) {
            const error = new Error('Rejection reason is required');
            error.statusCode = 400;
            throw error;
          }
    
          if (approvalType === 'hr') {
            payroll.approvals.hr = {
              status: 'rejected',
              by: userId,
              at: new Date(),
              notes
            };
          } else if (approvalType === 'finance') {
            payroll.approvals.finance = {
              status: 'rejected',
              by: userId,
              at: new Date(),
              notes
            };
          }
    
          await payroll.save();
          return payroll;
        } catch (error) {
          throw error;
        }
      },
    
      // Add adjustment to payroll
      addAdjustment: async (payrollId, adjustmentData, userId) => {
        try {
          const payroll = await Payroll.findById(payrollId);
    
          if (!payroll) {
            const error = new Error('Payroll record not found');
            error.statusCode = 404;
            throw error;
          }
    
          if (payroll.payment.status === 'paid') {
            const error = new Error('Cannot adjust paid payroll records');
            error.statusCode = 400;
            throw error;
          }
    
          const adjustment = {
            ...adjustmentData,
            appliedBy: userId,
            appliedAt: new Date()
          };
    
          await payroll.addAdjustment(adjustment, userId);
          return payroll;
        } catch (error) {
          throw error;
        }
      },
    
      // Mark payroll as paid
      markAsPaid: async (payrollId, paymentData) => {
        try {
          const { reference, method = 'bank_transfer', batchId } = paymentData;
    
          const payroll = await Payroll.findById(payrollId);
    
          if (!payroll) {
            const error = new Error('Payroll record not found');
            error.statusCode = 404;
            throw error;
          }
    
          if (payroll.approvalStatus !== 'approved') {
            const error = new Error('Payroll must be approved before payment');
            error.statusCode = 400;
            throw error;
          }
    
          payroll.payment.batchId = batchId;
          await payroll.markAsPaid(reference, method);
    
          return payroll;
        } catch (error) {
          throw error;
        }
      },
    
      // Process batch payment
      processBatchPayment: async (month, batchData, userId) => {
        try {
          const { method = 'bank_transfer', batchId } = batchData;
    
          const payrolls = await Payroll.find({
            payrollMonth: month,
            'approvals.hr.status': 'approved',
            'approvals.finance.status': 'approved',
            'payment.status': { $in: ['pending', 'approved'] }
          });
    
          if (payrolls.length === 0) {
            const error = new Error('No approved payrolls found for batch payment');
            error.statusCode = 404;
            throw error;
          }
    
          const results = [];
          let totalAmount = 0;
    
          for (const payroll of payrolls) {
            try {
              const reference = `BATCH-${batchId}-${payroll.employeeId}`;
              payroll.payment.batchId = batchId;
              await payroll.markAsPaid(reference, method);
    
              results.push({
                payrollId: payroll._id,
                employeeId: payroll.employeeId,
                amount: payroll.netPay,
                reference,
                success: true
              });
    
              totalAmount += payroll.netPay;
            } catch (error) {
              results.push({
                payrollId: payroll._id,
                employeeId: payroll.employeeId,
                success: false,
                error: error.message
              });
            }
          }
    
          return {
            batchId,
            totalRecords: payrolls.length,
            successCount: results.filter(r => r.success).length,
            failureCount: results.filter(r => !r.success).length,
            totalAmount,
            results
          };
        } catch (error) {
          throw error;
        }
    },
    
    processAllEmployees: async (month, processedBy) => {
    try {
      if (!month || !moment(month, 'YYYY-MM', true).isValid()) {
        throw new Error('Invalid month format. Use YYYY-MM');
      }

      const payrollRecords = await Payroll.processAllEmployees(month, processedBy);

      return {
        success: true,
        message: `Processed payroll for ${payrollRecords.length} employees`,
        month: month,
        processedCount: payrollRecords.length,
        payrollIds: payrollRecords.map(p => p._id)
      };
    } catch (error) {
      throw error;
    }
  },

  listPayrolls: async (filters = {}) => {
    try {
      const user = filters.user;

      if (!user) {
        throw new Error('Authentication required');
      }

      const page = Math.max(1, parseInt(filters.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
      const skip = (page - 1) * limit;

      let query = { isActive: true };

      if (user.role !== 'admin') {
        if (user.role !== 'hr') {
          if (!user.employeeId) {
            throw new Error('Employee record not found for user');
          }
          query.employeeId = user.employeeId;
        }
      }

      if (filters.month) query.payrollMonth = filters.month;
      if (filters.employeeId) query.employeeId = filters.employeeId;
      if (filters.paymentStatus) query['payment.status'] = filters.paymentStatus;

      const [payrolls, total] = await Promise.all([
        Payroll.find(query)
          .populate({
            path: 'employeeId',
            select: 'employeeId personalInfo.firstName personalInfo.lastName employmentInfo.departmentId',
            populate: {
              path: 'employmentInfo.departmentId',
              select: 'name code'
            }
          })
          .populate('processedBy', 'email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Payroll.countDocuments(query)
      ]);

      return {
        payrolls,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Payroll listing error:', error);
      throw error;
    }
  },

  getPayrollDetails: async (payrollId) => {
    try {
      const payroll = await Payroll.findById(payrollId)
        .populate({
          path: 'employeeId',
          populate: [
            { path: 'employmentInfo.departmentId', select: 'name code' },
            { path: 'employmentInfo.positionId', select: 'name code' },
            { path: 'employmentInfo.gradeId', select: 'name code level' }
          ]
        });

      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      return payroll;
    } catch (error) {
      throw error;
    }
  },

  // Common header function for all reports
  addReportHeader: (doc, title, period, totalEmployees, requestedBy) => {
    // Header background
    doc.rect(0, 0, doc.page.width, 100)
      .fillAndStroke(COLORS.primary, COLORS.primary);

    // Logo
    if (fs.existsSync(COMPANY_LOGO)) {
      try {
        doc.image(COMPANY_LOGO, 50, 20, { width: 50 });
      } catch (err) {
        console.error('Logo loading error:', err);
      }
    }

    // Company info
    doc.fontSize(18)
      .fillColor(COLORS.background)
      .font('Helvetica-Bold')
      .text(COMPANY_NAME, 120, 25)
      .fontSize(10)
      .font('Helvetica')
      .text(COMPANY_ADDRESS, 120, 45)
      .fontSize(14)
      .fillColor(COLORS.accent)
      .font('Helvetica-Bold')
      .text(title, 120, 65);

    // Report info (right-aligned)
    doc.fontSize(9)
      .fillColor(COLORS.background)
      .font('Helvetica')
      .text(`Period: ${period}`, 400, 25, { align: 'right', width: 150 })
      .text(`Employees: ${totalEmployees}`, 400, 40, { align: 'right', width: 150 })
      .text(`Generated: ${moment().format('DD MMM YYYY, HH:mm')}`, 400, 55, { align: 'right', width: 150 })
      .text(`By: ${requestedBy?.name || requestedBy?.email || 'System'}`, 400, 70, { align: 'right', width: 150 });

    return 120;
  },

  // Common footer function
  addReportFooter: (doc, requestedBy) => {
    const footerY = doc.page.height - 50;
    
    doc.rect(0, footerY, doc.page.width, 50)
      .fillAndStroke(COLORS.primary, COLORS.primary);
    
    doc.fontSize(8)
      .fillColor(COLORS.background)
      .font('Helvetica')
      .text('CONFIDENTIAL - For Internal Use Only', 50, footerY + 10)
      .text(`${COMPANY_NAME} | Generated: ${moment().format('DD MMM YYYY, HH:mm')}`, 50, footerY + 25)
      .text(`Page ${doc._pageBuffer ? doc._pageBuffer.length : 1}`, doc.page.width - 100, footerY + 10, { align: 'right' })
      .text(`By: ${requestedBy?.name || requestedBy?.email || 'System'}`, doc.page.width - 200, footerY + 25, { align: 'right' });
  },

  // COMPREHENSIVE CONSOLIDATED PAYROLL REPORT (like individual payslip but for all employees)
  generateConsolidatedPayrollPDF: async function(res, options = {}, requestedBy = {}) {
    try {
      const { month, startDate, endDate } = options;
      if (!month && !(startDate && endDate)) {
        throw new Error('Provide either month (YYYY-MM) or startDate and endDate (YYYY-MM-DD).');
      }

      // Build query
      const query = { isActive: true };
      if (month) {
        query.payrollMonth = month;
      } else {
        const sd = new Date(startDate);
        const ed = new Date(endDate);
        query['payPeriod.startDate'] = { $gte: sd };
        query['payPeriod.endDate'] = { $lte: ed };
      }

      // Get payrolls with detailed employee information
      const payrolls = await Payroll.find(query)
        .populate({
          path: 'employeeId',
          populate: [
            { path: 'employmentInfo.departmentId', select: 'name code' },
            { path: 'employmentInfo.positionId', select: 'name' },
            { path: 'employmentInfo.gradeId', select: 'name level' }
          ]
        })
        .sort({ 'employeeId.personalInfo.lastName': 1 })
        .lean();

      if (!payrolls || payrolls.length === 0) {
        return res.status(404).json({ error: 'No payroll records found for the selected period.' });
      }

      const fileLabel = month ? month : `${startDate}_to_${endDate}`;
      const filename = `consolidated_payroll_${fileLabel}.pdf`;
      
      res.setHeader('Content-disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-type', 'application/pdf');

      const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
      doc.pipe(res);

      let currentY = this.addReportHeader(doc, 'CONSOLIDATED PAYROLL REPORT', fileLabel, payrolls.length, requestedBy);

      // Helper function for page breaks
      const checkPageBreak = (heightNeeded = 30) => {
        if (currentY + heightNeeded > doc.page.height - 80) {
          this.addReportFooter(doc, requestedBy);
          doc.addPage();
          currentY = this.addReportHeader(doc, 'CONSOLIDATED PAYROLL REPORT', fileLabel, payrolls.length, requestedBy);
          return true;
        }
        return false;
      };

      // Process each employee's payroll like individual payslip
      for (let i = 0; i < payrolls.length; i++) {
        const payroll = payrolls[i];
        const employee = payroll.employeeId || {};
        const personalInfo = employee.personalInfo || {};
        const employmentInfo = employee.employmentInfo || {};

        checkPageBreak(250); // Need space for full employee section

        // Employee header
        const empY = currentY + 20;
        doc.rect(30, empY, doc.page.width - 60, 25)
          .fillAndStroke(COLORS.secondary, COLORS.secondary);

        doc.fontSize(12)
          .fillColor(COLORS.background)
          .font('Helvetica-Bold')
          .text(`${i + 1}. ${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`, 40, empY + 8)
          .fontSize(10)
          .text(`ID: ${employee.employeeId || 'N/A'}`, doc.page.width - 150, empY + 8);

        currentY = empY + 35;

        // Employee details section
        doc.fontSize(9)
          .fillColor(COLORS.text)
          .font('Helvetica')
          .text(`Department: ${employmentInfo.departmentId?.name || 'N/A'}`, 40, currentY)
          .text(`Position: ${employmentInfo.positionId?.name || 'N/A'}`, 200, currentY)
          .text(`Grade: ${employmentInfo.gradeId?.name || 'N/A'}`, 360, currentY)
          .text(`Days Worked: ${payroll.payPeriod?.daysWorked || 0}/${payroll.payPeriod?.workingDays || 0}`, 450, currentY);

        currentY += 25;

        // Earnings and Deductions in two columns
        const leftCol = 40;
        const rightCol = 300;
        const colWidth = 250;

        // EARNINGS COLUMN
        doc.rect(leftCol, currentY, colWidth, 20)
          .fillAndStroke(COLORS.lightBg, COLORS.border);

        doc.fontSize(10)
          .fillColor(COLORS.primary)
          .font('Helvetica-Bold')
          .text('EARNINGS', leftCol + 10, currentY + 6);

        currentY += 25;

        const earnings = [
          { name: 'Basic Salary', amount: payroll.salary?.prorated || 0 },
          { name: 'Transport Allowance', amount: payroll.allowances?.transport || 0 },
          { name: 'Housing Allowance', amount: payroll.allowances?.housing || 0 },
          { name: 'Medical Allowance', amount: payroll.allowances?.medical || 0 },
          { name: 'Meal Allowance', amount: payroll.allowances?.meals || 0 },
          { name: 'Communication Allowance', amount: payroll.allowances?.communication || 0 },
          { name: 'Other Allowances', amount: payroll.allowances?.other || 0 },
          { name: 'Overtime Pay', amount: payroll.overtime?.amount || 0 },
          { name: 'Performance Bonus', amount: payroll.bonuses?.performance || 0 },
          { name: 'Annual Bonus', amount: payroll.bonuses?.annual || 0 },
          { name: 'Other Bonuses', amount: payroll.bonuses?.other || 0 }
        ];

        let earningsY = currentY;
        doc.fontSize(8)
          .fillColor(COLORS.text)
          .font('Helvetica');

        earnings.forEach(item => {
          if (item.amount > 0) {
            doc.text(item.name, leftCol + 10, earningsY)
              .text(`${payroll.currency || 'MWK'} ${item.amount.toLocaleString()}`, leftCol + 150, earningsY, { align: 'right', width: 90 });
            earningsY += 12;
          }
        });

        // Gross Pay
        earningsY += 5;
        doc.fontSize(9)
          .fillColor(COLORS.primary)
          .font('Helvetica-Bold')
          .text('GROSS PAY', leftCol + 10, earningsY)
          .text(`${payroll.currency || 'MWK'} ${(payroll.grossPay || 0).toLocaleString()}`, leftCol + 150, earningsY, { align: 'right', width: 90 });

        // DEDUCTIONS COLUMN
        let deductionsY = currentY - 25;
        doc.rect(rightCol, deductionsY, colWidth, 20)
          .fillAndStroke(COLORS.lightBg, COLORS.border);

        doc.fontSize(10)
          .fillColor(COLORS.primary)
          .font('Helvetica-Bold')
          .text('DEDUCTIONS', rightCol + 10, deductionsY + 6);

        deductionsY += 25;

        const deductions = [
          { name: `PAYE Tax `, amount: payroll.deductions?.tax?.amount || 0 },
          { name: `Pension (${payroll.deductions?.pension?.rate || 0}%)`, amount: payroll.deductions?.pension?.amount || 0 },
          ...((payroll.deductions?.loans || []).map(loan => ({ name: `Loan: ${loan.name}`, amount: loan.amount }))),
          ...((payroll.deductions?.other || []).map(item => ({ name: item.name, amount: item.amount })))
        ];

        doc.fontSize(8)
          .fillColor(COLORS.text)
          .font('Helvetica');

        deductions.forEach(item => {
          if (item.amount > 0) {
            doc.text(item.name, rightCol + 10, deductionsY)
              .text(`${payroll.currency || 'MWK'} ${item.amount.toLocaleString()}`, rightCol + 150, deductionsY, { align: 'right', width: 90 });
            deductionsY += 12;
          }
        });

        // Total Deductions
        deductionsY += 5;
        doc.fontSize(9)
          .fillColor(COLORS.error)
          .font('Helvetica-Bold')
          .text('TOTAL DEDUCTIONS', rightCol + 10, deductionsY)
          .text(`${payroll.currency || 'MWK'} ${(payroll.deductions?.total || 0).toLocaleString()}`, rightCol + 150, deductionsY, { align: 'right', width: 90 });

        // NET PAY (centered at bottom)
        const netPayY = Math.max(earningsY, deductionsY) + 20;
        doc.rect(leftCol, netPayY, doc.page.width - 80, 30)
          .fillAndStroke(COLORS.accent, COLORS.accent);

        doc.fontSize(14)
          .fillColor(COLORS.background)
          .font('Helvetica-Bold')
          .text('NET PAY', leftCol + 20, netPayY + 8)
          .text(`${payroll.currency || 'MWK'} ${(payroll.netPay || 0).toLocaleString()}`, 
                rightCol + 50, netPayY + 8, { align: 'right', width: 150 });

        currentY = netPayY + 50;

        // Separator line between employees
        if (i < payrolls.length - 1) {
          doc.strokeColor(COLORS.border)
            .lineWidth(1)
            .moveTo(30, currentY)
            .lineTo(doc.page.width - 30, currentY)
            .stroke();
          currentY += 10;
        }
      }

      // Final summary
      checkPageBreak(100);
      
      const totals = payrolls.reduce((acc, p) => ({
        gross: acc.gross + (p.grossPay || 0),
        deductions: acc.deductions + (p.deductions?.total || 0),
        net: acc.net + (p.netPay || 0)
      }), { gross: 0, deductions: 0, net: 0 });

      currentY += 20;
      doc.rect(30, currentY, doc.page.width - 60, 60)
        .fillAndStroke(COLORS.lightBg, COLORS.border);

      doc.fontSize(12)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text('PAYROLL SUMMARY', 40, currentY + 10);

      doc.fontSize(10)
        .fillColor(COLORS.text)
        .font('Helvetica')
        .text(`Total Employees: ${payrolls.length}`, 40, currentY + 30)
        .text(`Total Gross Pay: ${payrolls[0].currency || 'MWK'} ${totals.gross.toLocaleString()}`, 180, currentY + 30)
        .text(`Total Deductions: ${payrolls[0].currency || 'MWK'} ${totals.deductions.toLocaleString()}`, 350, currentY + 30)
        .fontSize(11)
        .fillColor(COLORS.accent)
        .font('Helvetica-Bold')
        .text(`Total Net Pay: ${payrolls[0].currency || 'MWK'} ${totals.net.toLocaleString()}`, 40, currentY + 45);

      this.addReportFooter(doc, requestedBy);
      doc.end();

    } catch (err) {
      console.error('generateConsolidatedPayrollPDF error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Failed to generate PDF' });
      }
    }
  },

  // IMPROVED SPECIFIC REPORTS
  generateReport: async function(res, reportType, options = {}, requestedBy = {}) {
    try {
      const { month, startDate, endDate } = options;
      if (!month && !(startDate && endDate)) {
        throw new Error('Provide either month (YYYY-MM) or startDate and endDate (YYYY-MM-DD).');
      }

      const query = { isActive: true };
      if (month) {
        query.payrollMonth = month;
      } else {
        const sd = new Date(startDate);
        const ed = new Date(endDate);
        query['payPeriod.startDate'] = { $gte: sd };
        query['payPeriod.endDate'] = { $lte: ed };
      }

      const payrolls = await Payroll.find(query)
        .populate({
          path: 'employeeId',
          populate: [
            { path: 'employmentInfo.departmentId', select: 'name code' },
            { path: 'employmentInfo.positionId', select: 'name' }
          ]
        })
        .sort({ 'employeeId.personalInfo.lastName': 1 })
        .lean();

      if (!payrolls || payrolls.length === 0) {
        return res.status(404).json({ error: 'No payroll records found for the selected period.' });
      }

      const reportConfigs = {
        'paye': { 
          title: 'PAYE TAX REPORT',
          columns: [
            { key: 'no', title: '#', width: 30, align: 'center' },
            { key: 'employee', title: 'EMPLOYEE NAME', width: 140, align: 'left' },
            { key: 'department', title: 'DEPARTMENT', width: 90, align: 'left' },
            { key: 'grossPay', title: 'GROSS PAY', width: 80, align: 'right' },
            { key: 'taxRate', title: 'TAX RATE', width: 60, align: 'right' },
            { key: 'taxAmount', title: 'PAYE AMOUNT', width: 85, align: 'right' }
          ]
        },
        'pension': { 
          title: 'PENSION CONTRIBUTION REPORT',
          columns: [
            { key: 'no', title: '#', width: 30, align: 'center' },
            { key: 'employee', title: 'EMPLOYEE NAME', width: 140, align: 'left' },
            { key: 'department', title: 'DEPARTMENT', width: 80, align: 'left' },
            { key: 'grossPay', title: 'GROSS PAY', width: 80, align: 'right' },
            { key: 'pensionRate', title: 'RATE', width: 60, align: 'right' },
            { key: 'pensionAmount', title: 'PENSION AMOUNT', width: 85, align: 'right' }
          ]
        },
        'overtime': { 
          title: 'OVERTIME REPORT',
          columns: [
            { key: 'no', title: '#', width: 30, align: 'center' },
            { key: 'employee', title: 'EMPLOYEE NAME', width: 130, align: 'left' },
            { key: 'department', title: 'DEPARTMENT', width: 70, align: 'left' },
            { key: 'hours', title: 'HOURS', width: 50, align: 'right' },
            { key: 'rate', title: 'RATE', width: 60, align: 'right' },
            { key: 'multiplier', title: 'MULT.', width: 40, align: 'center' },
            { key: 'amount', title: 'OT AMOUNT', width: 85, align: 'right' }
          ]
        },
        'loan': { 
          title: 'LOAN DEDUCTION REPORT',
          columns: [
            { key: 'no', title: '#', width: 30, align: 'center' },
            { key: 'employee', title: 'EMPLOYEE NAME', width: 130, align: 'left' },
            { key: 'department', title: 'DEPARTMENT', width: 70, align: 'left' },
            { key: 'loanType', title: 'LOAN TYPE', width: 90, align: 'left' },
            { key: 'deduction', title: 'DEDUCTION', width: 75, align: 'right' },
            { key: 'balance', title: 'BALANCE', width: 80, align: 'right' }
          ]
        },
        'housing': { 
          title: 'HOUSING ALLOWANCE REPORT',
          columns: [
            { key: 'no', title: '#', width: 30, align: 'center' },
            { key: 'employee', title: 'EMPLOYEE NAME', width: 140, align: 'left' },
            { key: 'department', title: 'DEPARTMENT', width: 90, align: 'left' },
            { key: 'position', title: 'POSITION', width: 100, align: 'left' },
            { key: 'amount', title: 'HOUSING ALLOWANCE', width: 115, align: 'right' }
          ]
        },
        'advance': { 
          title: 'SALARY ADVANCE REPORT',
          columns: [
            { key: 'no', title: '#', width: 30, align: 'center' },
            { key: 'employee', title: 'EMPLOYEE NAME', width: 140, align: 'left' },
            { key: 'department', title: 'DEPARTMENT', width: 80, align: 'left' },
            { key: 'advanceType', title: 'ADVANCE TYPE', width: 90, align: 'left' },
            { key: 'deduction', title: 'DEDUCTION', width: 75, align: 'right' },
            { key: 'balance', title: 'BALANCE', width: 80, align: 'right' }
          ]
        }
      };

      const config = reportConfigs[reportType];
      if (!config) {
        throw new Error('Unsupported report type');
      }

      const fileLabel = month ? month : `${startDate}_to_${endDate}`;
      const filename = `${reportType}_report_${fileLabel}.pdf`;
      
      res.setHeader('Content-disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-type', 'application/pdf');

      const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
      doc.pipe(res);

      let currentY = this.addReportHeader(doc, config.title, fileLabel, payrolls.length, requestedBy);

      // Prepare data
      let reportData = [];
      let totalAmount = 0;
      let recordNumber = 1;

      payrolls.forEach(p => {
        const emp = p.employeeId || {};
        const personal = emp.personalInfo || {};
        const dept = emp.employmentInfo?.departmentId || {};
        const position = emp.employmentInfo?.positionId || {};
        const fullname = `${personal.firstName || ''} ${personal.lastName || ''}`.trim();
        
        switch (reportType) {
          case 'paye':
            if (p.deductions?.tax?.amount > 0) {
              reportData.push({
                no: recordNumber++,
                employee: fullname,
                department: dept.name || 'N/A',
                grossPay: p.grossPay || 0,
                taxRate: `${(p.deductions.tax.rate || 0).toFixed(1)}%`,
                taxAmount: p.deductions.tax.amount || 0
              });
              totalAmount += p.deductions.tax.amount || 0;
            }
            break;
            
          case 'pension':
            if (p.deductions?.pension?.amount > 0) {
              reportData.push({
                no: recordNumber++,
                employee: fullname,
                department: dept.name || 'N/A',
                grossPay: p.grossPay || 0,
                pensionRate: `${(p.deductions.pension.rate || 0).toFixed(1)}%`,
                pensionAmount: p.deductions.pension.amount || 0
              });
              totalAmount += p.deductions.pension.amount || 0;
            }
            break;
            
          case 'overtime':
            if (p.overtime?.hours > 0) {
              reportData.push({
                no: recordNumber++,
                employee: fullname,
                department: dept.name || 'N/A',
                hours: (p.overtime.hours || 0).toFixed(1),
                rate: p.overtime.rate || 0,
                multiplier: '1.5x',
                amount: p.overtime.amount || 0
              });
              totalAmount += p.overtime.amount || 0;
            }
            break;
            
          case 'loan':
            if (p.deductions?.loans && p.deductions.loans.length > 0) {
              p.deductions.loans.forEach(loan => {
                reportData.push({
                  no: recordNumber++,
                  employee: fullname,
                  department: dept.name || 'N/A',
                  loanType: loan.name || 'Loan',
                  deduction: loan.amount || 0,
                  balance: loan.balance || 0
                });
                totalAmount += loan.amount || 0;
              });
            }
            break;
            
          case 'housing':
            if (p.allowances?.housing > 0) {
              reportData.push({
                no: recordNumber++,
                employee: fullname,
                department: dept.name || 'N/A',
                position: position.name || 'N/A',
                amount: p.allowances.housing || 0
              });
              totalAmount += p.allowances.housing || 0;
            }
            break;
            
          case 'advance':
            // Look for advances in other deductions
            if (p.deductions?.other && p.deductions.other.length > 0) {
              p.deductions.other.forEach(item => {
                if (item.name.toLowerCase().includes('advance') || item.name.toLowerCase().includes('salary advance')) {
                  reportData.push({
                    no: recordNumber++,
                    employee: fullname,
                    department: dept.name || 'N/A',
                    advanceType: item.name || 'Salary Advance',
                    deduction: item.amount || 0,
                    balance: 0 // Not tracked in current schema
                  });
                  totalAmount += item.amount || 0;
                }
              });
            }
            break;
        }
      });

      if (reportData.length === 0) {
        doc.fontSize(12)
          .fillColor(COLORS.warning)
          .text(`No ${reportType} data found for the selected period.`, 30, currentY + 50, { align: 'center' });
        
        this.addReportFooter(doc, requestedBy);
        doc.end();
        return;
      }

      // Helper function for page breaks
      const checkPageBreak = (heightNeeded = 30) => {
        if (currentY + heightNeeded > doc.page.height - 80) {
          this.addReportFooter(doc, requestedBy);
          doc.addPage();
          currentY = this.addReportHeader(doc, config.title, fileLabel, payrolls.length, requestedBy);
          
          // Redraw table header
          drawTableHeader();
          return true;
        }
        return false;
      };

      // Function to draw table header
      const drawTableHeader = () => {
        const tableY = currentY + 10;
        const tableWidth = doc.page.width - 60;
        
        // Header background
        doc.rect(30, tableY, tableWidth, 25)
          .fillAndStroke(COLORS.primary, COLORS.primary);

        doc.fontSize(9)
          .fillColor(COLORS.background)
          .font('Helvetica-Bold');

        let x = 35;
        config.columns.forEach(col => {
          doc.text(col.title, x, tableY + 8, { width: col.width, align: col.align });
          x += col.width;
        });

        currentY = tableY + 30;
      };

      // Draw initial table header
      checkPageBreak(60);
      drawTableHeader();

      // Draw data rows
      reportData.forEach((row, index) => {
        checkPageBreak(20);
        
        // Alternate row colors
        const rowY = currentY;
        const tableWidth = doc.page.width - 60;
        
        if (index % 2 === 0) {
          doc.rect(30, rowY, tableWidth, 18)
            .fillAndStroke(COLORS.lightBg, COLORS.border);
        }

        doc.fontSize(8)
          .fillColor(COLORS.text)
          .font('Helvetica');

        let x = 35;
        config.columns.forEach((col, colIndex) => {
          let value = row[col.key] || '';
          
          // Format currency values
          if (['grossPay', 'taxAmount', 'pensionAmount', 'amount', 'deduction', 'balance', 'rate'].includes(col.key)) {
            if (typeof value === 'number' && value > 0) {
              value = `${payrolls[0].currency || 'MWK'} ${value.toLocaleString()}`;
            } else if (typeof value === 'number') {
              value = `${payrolls[0].currency || 'MWK'} 0`;
            }
          }
          
          // Truncate long text
          if (typeof value === 'string' && value.length > 25) {
            value = value.substring(0, 23) + '..';
          }
          
          // Use bold for employee names
          const fontWeight = col.key === 'employee' ? 'Helvetica-Bold' : 'Helvetica';
          doc.font(fontWeight)
            .text(String(value), x, rowY + 5, { width: col.width, align: col.align });
          
          x += col.width;
        });
        
        currentY += 18;
      });

      // Summary section
      checkPageBreak(80);
      currentY += 20;
      
      const summaryY = currentY;
      const tableWidth = doc.page.width - 60;
      
      doc.rect(30, summaryY, tableWidth, 50)
        .fillAndStroke(COLORS.lightBg, COLORS.border);

      doc.rect(30, summaryY, tableWidth, 20)
        .fillAndStroke(COLORS.secondary, COLORS.secondary);

      doc.fontSize(11)
        .fillColor(COLORS.background)
        .font('Helvetica-Bold')
        .text('REPORT SUMMARY', 40, summaryY + 6);

      doc.fontSize(10)
        .fillColor(COLORS.text)
        .font('Helvetica')
        .text(`Total Records: ${reportData.length}`, 40, summaryY + 30)
        .font('Helvetica-Bold')
        .fillColor(COLORS.accent)
        .text(`Total Amount: ${payrolls[0].currency || 'MWK'} ${totalAmount.toLocaleString()}`, 
              doc.page.width - 200, summaryY + 30, { align: 'right', width: 150 });

      this.addReportFooter(doc, requestedBy);
      doc.end();
      
    } catch (err) {
      console.error('generateReport error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Failed to generate PDF' });
      }
    }
  },

  // IMPROVED BANK INSTRUCTION PDF
  generateBankInstructionPDF: async function (res, options = {}, requestedBy = {}) {
    try {
      const { month, startDate, endDate } = options;
      if (!month && !(startDate && endDate)) {
        throw new Error('Provide either month (YYYY-MM) or startDate and endDate (YYYY-MM-DD).');
      }

      const query = { isActive: true };
      if (month) {
        query.payrollMonth = month;
      } else {
        const sd = new Date(startDate);
        const ed = new Date(endDate);
        query['payPeriod.startDate'] = { $gte: sd };
        query['payPeriod.endDate'] = { $lte: ed };
      }

      const payrolls = await Payroll.find(query)
        .populate({
          path: 'employeeId',
          populate: [
            { path: 'employmentInfo.departmentId', select: 'name code' }
          ]
        })
        .sort({ 'employeeId.personalInfo.lastName': 1 })
        .lean();

      if (!payrolls || payrolls.length === 0) {
        return res.status(404).json({ error: 'No payroll records found for the selected period.' });
      }

      const fileLabel = month ? month : `${startDate}_to_${endDate}`;
      const filename = `bank_instruction_${fileLabel}.pdf`;

      res.setHeader('Content-disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-type', 'application/pdf');

      const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
      doc.pipe(res);

      let currentY = this.addReportHeader(doc, 'BANK PAYMENT INSTRUCTION', fileLabel, payrolls.length, requestedBy);

      // Bank details section
      currentY += 20;
      const cardHeight = 80;
      const cardWidth = (doc.page.width - 80) / 2;

      // Company bank details card
      doc.rect(30, currentY, cardWidth, cardHeight)
        .fillAndStroke(COLORS.lightBg, COLORS.border);

      doc.rect(30, currentY, cardWidth, 25)
        .fillAndStroke(COLORS.secondary, COLORS.secondary);

      doc.fontSize(10)
        .fillColor(COLORS.background)
        .font('Helvetica-Bold')
        .text('COMPANY BANK DETAILS', 40, currentY + 8);

      doc.fontSize(9)
        .fillColor(COLORS.text)
        .font('Helvetica')
        .text(`Bank Name: ${BANK_NAME}`, 40, currentY + 35)
        .text(`Account Name: ${COMPANY_NAME}`, 40, currentY + 48)
        .text(`Account Number: ${COMPANY_ACCOUNT}`, 40, currentY + 61);

      // Payment summary card
      const rightCardX = 40 + cardWidth + 20;
      doc.rect(rightCardX, currentY, cardWidth, cardHeight)
        .fillAndStroke(COLORS.lightBg, COLORS.border);

      doc.rect(rightCardX, currentY, cardWidth, 25)
        .fillAndStroke(COLORS.accent, COLORS.accent);

      doc.fontSize(10)
        .fillColor(COLORS.background)
        .font('Helvetica-Bold')
        .text('PAYMENT SUMMARY', rightCardX + 10, currentY + 8);

      const totalAmount = payrolls.reduce((sum, p) => sum + (p.netPay || 0), 0);
      doc.fontSize(9)
        .fillColor(COLORS.text)
        .font('Helvetica')
        .text(`Total Employees: ${payrolls.length}`, rightCardX + 10, currentY + 35)
        .fontSize(11)
        .fillColor(COLORS.accent)
        .font('Helvetica-Bold')
        .text(`Total Amount: ${payrolls[0].currency || 'MWK'} ${totalAmount.toLocaleString()}`, 
              rightCardX + 10, currentY + 55);

      currentY += cardHeight + 30;

      // Helper function for page breaks
      const checkPageBreak = (heightNeeded = 25) => {
        if (currentY + heightNeeded > doc.page.height - 80) {
          this.addReportFooter(doc, requestedBy);
          doc.addPage();
          currentY = this.addReportHeader(doc, 'BANK PAYMENT INSTRUCTION', fileLabel, payrolls.length, requestedBy);
          
          // Redraw table header
          drawTableHeader();
          return true;
        }
        return false;
      };

      // Table header function
      const drawTableHeader = () => {
        const tableWidth = doc.page.width - 60;
        
        doc.rect(30, currentY, tableWidth, 25)
          .fillAndStroke(COLORS.primary, COLORS.primary);

        doc.fontSize(9)
          .fillColor(COLORS.background)
          .font('Helvetica-Bold');

        const columns = [
          { text: '#', x: 35, width: 30, align: 'center' },
          { text: 'EMPLOYEE NAME', x: 70, width: 140, align: 'left' },
          { text: 'DEPARTMENT', x: 215, width: 80, align: 'left' },
          { text: 'BANK NAME', x: 300, width: 90, align: 'left' },
          { text: 'ACCOUNT NUMBER', x: 395, width: 90, align: 'left' },
          { text: 'NET PAY', x: 490, width: 75, align: 'right' }
        ];

        columns.forEach(col => {
          doc.text(col.text, col.x, currentY + 8, { width: col.width, align: col.align });
        });

        currentY += 30;
      };

      // Draw initial table header
      checkPageBreak(60);
      drawTableHeader();

      // Employee payment instructions
      payrolls.forEach((payroll, index) => {
        checkPageBreak(20);
        
        const emp = payroll.employeeId || {};
        const personal = emp.personalInfo || {};
        const dept = emp.employmentInfo?.departmentId || {};
        const bankInfo = emp.bankInfo || {};
        
        const fullname = `${personal.firstName || ''} ${personal.lastName || ''}`.trim();
        const bankName = bankInfo.bankName || 'N/A';
        const accountNumber = bankInfo.accountNumber || 'N/A';
        const amount = payroll.netPay || 0;
        
        // Alternate row colors
        const rowY = currentY;
        const tableWidth = doc.page.width - 60;
        
        if (index % 2 === 0) {
          doc.rect(30, rowY, tableWidth, 18)
            .fillAndStroke(COLORS.lightBg, COLORS.border);
        }

        doc.fontSize(8)
          .fillColor(COLORS.text)
          .font('Helvetica');

        // Row data
        doc.text(String(index + 1), 35, rowY + 5, { width: 30, align: 'center' })
          .font('Helvetica-Bold')
          .text(fullname.substring(0, 25), 70, rowY + 5, { width: 140, align: 'left' })
          .font('Helvetica')
          .fillColor(COLORS.textLight)
          .text((dept.name || 'N/A').substring(0, 15), 215, rowY + 5, { width: 80, align: 'left' })
          .fillColor(COLORS.text)
          .text(bankName.substring(0, 15), 300, rowY + 5, { width: 90, align: 'left' })
          .font('Helvetica-Bold')
          .text(accountNumber, 395, rowY + 5, { width: 90, align: 'left' })
          .fillColor(COLORS.accent)
          .text(`${payroll.currency || 'MWK'} ${amount.toLocaleString()}`, 490, rowY + 5, { width: 75, align: 'right' });
        
        currentY += 18;
      });

      // Final summary
      checkPageBreak(100);
      currentY += 20;
      
      const summaryHeight = 60;
      const tableWidth = doc.page.width - 60;
      
      doc.rect(30, currentY, tableWidth, summaryHeight)
        .fillAndStroke(COLORS.lightBg, COLORS.border);

      doc.rect(30, currentY, tableWidth, 25)
        .fillAndStroke(COLORS.secondary, COLORS.secondary);

      doc.fontSize(11)
        .fillColor(COLORS.background)
        .font('Helvetica-Bold')
        .text('PAYMENT INSTRUCTION SUMMARY', 40, currentY + 8);

      doc.fontSize(10)
        .fillColor(COLORS.text)
        .font('Helvetica')
        .text(`Total Payment Instructions: ${payrolls.length}`, 40, currentY + 35)
        .fontSize(12)
        .fillColor(COLORS.accent)
        .font('Helvetica-Bold')
        .text(`Grand Total: ${payrolls[0].currency || 'MWK'} ${totalAmount.toLocaleString()}`, 
              doc.page.width - 250, currentY + 35, { align: 'right', width: 200 });

      currentY += summaryHeight + 20;

      // Authorization section
      checkPageBreak(80);
      
      doc.fontSize(11)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text('AUTHORIZATION & APPROVAL', 30, currentY);

      currentY += 25;

      const sigBoxWidth = (doc.page.width - 80) / 2;
      const sigBoxHeight = 60;

      // Prepared by box
      doc.rect(30, currentY, sigBoxWidth, sigBoxHeight)
        .fillAndStroke(COLORS.background, COLORS.border);

      doc.fontSize(8)
        .fillColor(COLORS.textLight)
        .font('Helvetica')
        .text('PREPARED BY (HR DEPARTMENT)', 40, currentY + 10)
        .text('Name: ___________________________', 40, currentY + 25)
        .text('Signature: _______________________', 40, currentY + 38)
        .text('Date: ___________', 40, currentY + 51);

      // Authorized by box
      const rightSigX = 40 + sigBoxWidth + 20;
      doc.rect(rightSigX, currentY, sigBoxWidth, sigBoxHeight)
        .fillAndStroke(COLORS.background, COLORS.border);

      doc.text('AUTHORIZED BY (FINANCE MANAGER)', rightSigX + 10, currentY + 10)
        .text('Name: ___________________________', rightSigX + 10, currentY + 25)
        .text('Signature: _______________________', rightSigX + 10, currentY + 38)
        .text('Date: ___________', rightSigX + 10, currentY + 51);

      this.addReportFooter(doc, requestedBy);
      doc.end();

    } catch (err) {
      console.error('generateBankInstructionPDF error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Failed to generate PDF' });
      }
    }
  },

getAllPayslips: async (req, res) => {
  try {
    const { month } = req.params;

    const payrolls = await Payroll.find({ 
      payrollMonth: month,
      isActive: true 
    })
      .populate({
        path: 'employeeId',
        select: 'employeeId personalInfo employmentInfo bankInfo',
      })
      .sort({ 'employeeId.personalInfo.lastName': 1 });

    if (!payrolls || payrolls.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No payrolls found for this month' 
      });
    }

    const data = payrolls.map(p => {
      const breakdown = p.getPayslipBreakdown();
      breakdown.employee = p.employeeId;
      return breakdown;
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('getAllPayslips error:', error);
    res.status(500).json({ error: 'Server error' });
  }
},

// Fix the getPayslip method  
getPayslip: async (req, res) => {
  try {
    const { employeeId, month } = req.params;

    const payroll = await Payroll.findOne({
      employeeId,
      payrollMonth: month,
      isActive: true
    })
      .populate({
        path: 'employeeId',
        select: 'employeeId personalInfo employmentInfo bankInfo',
      });

    if (!payroll) {
      return res.status(404).json({ 
        success: false,
        error: 'Payroll not found for this employee and month' 
      });
    }

    const breakdown = payroll.getPayslipBreakdown();
    breakdown.employee = payroll.employeeId;

    res.json({ success: true, data: breakdown });
  } catch (error) {
    console.error('getPayslip error:', error);
    res.status(500).json({ error: 'Server error' });
  }
},
// Generate consolidated payslips (all employees in one document)
generateConsolidatedPayslipsPDF: async function(res, options = {}, requestedBy = {}) {
  try {
    const { month, startDate, endDate } = options;
    
    if (!month && !(startDate && endDate)) {
      throw new Error('Provide either month (YYYY-MM) or startDate and endDate (YYYY-MM-DD).');
    }

    // Build query
    const query = { isActive: true };
    
    if (month) {
      query.payrollMonth = month;
    } else {
      const sd = moment(startDate).startOf('day').toDate();
      const ed = moment(endDate).endOf('day').toDate();
      
      query['payPeriod.startDate'] = { $gte: sd };
      query['payPeriod.endDate'] = { $lte: ed };
    }

    // Get payrolls with detailed employee information
    const payrolls = await Payroll.find(query)
      .populate({
        path: 'employeeId',
        populate: [
          { path: 'employmentInfo.departmentId', select: 'name code' },
          { path: 'employmentInfo.positionId', select: 'name' },
          { path: 'employmentInfo.gradeId', select: 'name level' }
        ]
      })
      .sort({ 'employeeId.personalInfo.lastName': 1 })
      .lean();

    if (!payrolls || payrolls.length === 0) {
      return res.status(404).json({ error: 'No payroll records found for the selected period.' });
    }

    const fileLabel = month ? month : `${startDate}_to_${endDate}`;
    const filename = `consolidated_payslips_${fileLabel}.pdf`;
    
    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'application/pdf');

    const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
    doc.pipe(res);

    let currentY = this.addReportHeader(doc, 'CONSOLIDATED PAYSLIPS', fileLabel, payrolls.length, requestedBy);

    // Helper function for page breaks
    const checkPageBreak = (heightNeeded = 30) => {
      if (currentY + heightNeeded > doc.page.height - 80) {
        this.addReportFooter(doc, requestedBy);
        doc.addPage();
        currentY = this.addReportHeader(doc, 'CONSOLIDATED PAYSLIPS', fileLabel, payrolls.length, requestedBy);
        return true;
      }
      return false;
    };

    // Process each employee's payslip
    for (let i = 0; i < payrolls.length; i++) {
      const payroll = payrolls[i];
      const employee = payroll.employeeId || {};
      const personalInfo = employee.personalInfo || {};
      const employmentInfo = employee.employmentInfo || {};

      // Check if we need a page break before starting a new employee
      checkPageBreak(150); // Need space for full payslip

      // Employee header
      const employeeHeaderY = currentY;
      doc.rect(30, employeeHeaderY, doc.page.width - 60, 25)
        .fillAndStroke(COLORS.secondary, COLORS.secondary);

      doc.fontSize(12)
        .fillColor(COLORS.background)
        .font('Helvetica-Bold')
        .text(`${i + 1}. ${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`, 40, employeeHeaderY + 8)
        .fontSize(10)
        .text(`ID: ${employee.employeeId || 'N/A'} | Department: ${employmentInfo.departmentId?.name || 'N/A'}`, 
              doc.page.width - 150, employeeHeaderY + 8, { width: 140, align: 'right' });

      currentY += 35;

      // Employee details
      doc.fontSize(9)
        .fillColor(COLORS.text)
        .font('Helvetica')
        .text(`Position: ${employmentInfo.positionId?.name || 'N/A'}`, 40, currentY)
        .text(`Grade: ${employmentInfo.gradeId?.name || 'N/A'} (Level ${employmentInfo.gradeId?.level || 'N/A'})`, 40, currentY + 12)
        .text(`Days Worked: ${payroll.payPeriod?.daysWorked || 0}/${payroll.payPeriod?.workingDays || 0}`, 40, currentY + 24)
        .text(`Payment Method: ${payroll.payment?.method || 'Bank Transfer'}`, 300, currentY)
        .text(`Status: ${payroll.payment?.status?.toUpperCase() || 'PENDING'}`, 300, currentY + 12)
        .text(`Payment Date: ${payroll.payment?.paidAt ? moment(payroll.payment.paidAt).format('DD MMM YYYY') : 'Pending'}`, 300, currentY + 24);

      currentY += 45;

      // Earnings and Deductions in two columns
      const leftCol = 40;
      const rightCol = 300;
      const colWidth = (doc.page.width - 80) / 2;
      const sectionStartY = currentY;

      // EARNINGS section
      doc.rect(leftCol, sectionStartY, colWidth, 20)
        .fillAndStroke(COLORS.lightBg, COLORS.border);

      doc.fontSize(10)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text('EARNINGS', leftCol + 10, sectionStartY + 6);

      const earnings = [
        { name: 'Basic Salary', amount: payroll.salary?.prorated || 0 },
        { name: 'Transport', amount: payroll.allowances?.transport || 0 },
        { name: 'Housing', amount: payroll.allowances?.housing || 0 },
        { name: 'Medical', amount: payroll.allowances?.medical || 0 },
        { name: 'Meals', amount: payroll.allowances?.meals || 0 },
        { name: 'Communication', amount: payroll.allowances?.communication || 0 },
        { name: 'Other Allowances', amount: payroll.allowances?.other || 0 },
        { name: 'Overtime', amount: payroll.overtime?.amount || 0 },
        { name: 'Performance Bonus', amount: payroll.bonuses?.performance || 0 },
        { name: 'Annual Bonus', amount: payroll.bonuses?.annual || 0 },
        { name: 'Other Bonuses', amount: payroll.bonuses?.other || 0 }
      ].filter(item => item.amount > 0);

      let earningsY = sectionStartY + 25;
      doc.fontSize(8)
        .fillColor(COLORS.text)
        .font('Helvetica');

      earnings.forEach(item => {
        doc.text(item.name, leftCol + 10, earningsY)
          .text(`${payroll.currency || 'MWK'} ${item.amount.toLocaleString()}`, leftCol + colWidth - 90, earningsY, { align: 'right', width: 80 });
        earningsY += 12;
      });

      const earningsEndY = earningsY + 10;
      doc.fontSize(9)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text('GROSS PAY', leftCol + 10, earningsEndY)
        .text(`${payroll.currency || 'MWK'} ${(payroll.grossPay || 0).toLocaleString()}`, 
              leftCol + colWidth - 90, earningsEndY, { align: 'right', width: 80 });

      // DEDUCTIONS section
      doc.rect(rightCol, sectionStartY, colWidth, 20)
        .fillAndStroke(COLORS.lightBg, COLORS.border);

      doc.fontSize(10)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text('DEDUCTIONS', rightCol + 10, sectionStartY + 6);

      const deductions = [
        { name: `PAYE Tax `, amount: payroll.deductions?.tax?.amount || 0 },
        { name: `Pension (${payroll.deductions?.pension?.rate || 0}%)`, amount: payroll.deductions?.pension?.amount || 0 },
        ...((payroll.deductions?.loans || []).map(loan => ({ name: `Loan: ${loan.name}`, amount: loan.amount }))),
        ...((payroll.deductions?.other || []).map(item => ({ name: item.name, amount: item.amount })))
      ].filter(item => item.amount > 0);

      let deductionsY = sectionStartY + 25;
      doc.fontSize(8)
        .fillColor(COLORS.text)
        .font('Helvetica');

      deductions.forEach(item => {
        doc.text(item.name, rightCol + 10, deductionsY)
          .text(`${payroll.currency || 'MWK'} ${item.amount.toLocaleString()}`, rightCol + colWidth - 90, deductionsY, { align: 'right', width: 80 });
        deductionsY += 12;
      });

      const deductionsEndY = deductionsY + 10;
      doc.fontSize(9)
        .fillColor(COLORS.error)
        .font('Helvetica-Bold')
        .text('TOTAL DEDUCTIONS', rightCol + 10, deductionsEndY)
        .text(`${payroll.currency || 'MWK'} ${(payroll.deductions?.total || 0).toLocaleString()}`, 
              rightCol + colWidth - 90, deductionsEndY, { align: 'right', width: 80 });

      // Determine the maximum Y position between earnings and deductions
      const maxY = Math.max(earningsEndY, deductionsEndY);

      // NET PAY section
      const netPayY = maxY + 20;
      checkPageBreak(netPayY + 30 - currentY); // Check if we need a page break for net pay
      
      doc.rect(30, netPayY, doc.page.width - 60, 30)
        .fillAndStroke(COLORS.accent, COLORS.accent);

      doc.fontSize(14)
        .fillColor(COLORS.background)
        .font('Helvetica-Bold')
        .text('NET PAY', 40, netPayY + 10)
        .text(`${payroll.currency || 'MWK'} ${(payroll.netPay || 0).toLocaleString()}`, 
              doc.page.width - 200, netPayY + 10, { align: 'right', width: 150 });

      currentY = netPayY + 50;

      // Separator line between employees
      if (i < payrolls.length - 1) {
        checkPageBreak(20); // Check if we need a page break for the separator
        doc.strokeColor(COLORS.border)
          .lineWidth(1)
          .moveTo(30, currentY)
          .lineTo(doc.page.width - 30, currentY)
          .stroke();
        currentY += 20;
      }
    }

    this.addReportFooter(doc, requestedBy);
    doc.end();

  } catch (err) {
    console.error('generateConsolidatedPayslipsPDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Failed to generate PDF' });
    }
  }
},
  // Individual payslip PDF generation (existing method improved)
  generatePayslipPDF: async (payroll, options = {}) => {
    const { res = null, disposition = 'attachment' } = options;
    try {
      // Ensure employee is populated
      if (!payroll.employeeId || typeof payroll.employeeId === 'string') {
        await payroll.populate({
          path: 'employeeId',
          populate: [
            { path: 'employmentInfo.departmentId', select: 'name' },
            { path: 'employmentInfo.positionId', select: 'name' },
            { path: 'employmentInfo.gradeId', select: 'name level' }
          ]
        });
      }

      const employee = payroll.employeeId;
      const personalInfo = employee.personalInfo || {};
      const employmentInfo = employee.employmentInfo || {};

      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      let filePath;
      let pdfStream;

      if (res) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `${disposition}; filename="payslip_${payroll.payrollMonth}_${employee.employeeId}.pdf"`
        );
        pdfStream = doc.pipe(res);
      } else {
        filePath = path.join(PAYSLIP_DIR, `payslip_${payroll._id}_${uuidv4()}.pdf`);
        pdfStream = doc.pipe(fs.createWriteStream(filePath));
      }

      // Header
      doc.rect(0, 0, doc.page.width, 80)
        .fillAndStroke(COLORS.primary, COLORS.primary);

      if (fs.existsSync(COMPANY_LOGO)) {
        try {
          doc.image(COMPANY_LOGO, 40, 20, { width: 50 });
        } catch (err) {
          console.error('Logo loading error:', err);
        }
      }

      doc.fontSize(16)
        .fillColor(COLORS.background)
        .font('Helvetica-Bold')
        .text(COMPANY_NAME, 110, 25)
        .fontSize(9)
        .font('Helvetica')
        .text(COMPANY_ADDRESS, 110, 45)
        .fontSize(12)
        .fillColor(COLORS.accent)
        .font('Helvetica-Bold')
        .text('PAYSLIP', 110, 60);

      doc.fontSize(9)
        .fillColor(COLORS.background)
        .font('Helvetica')
        .text(`Period: ${payroll.payrollMonth}`, 400, 25, { align: 'right', width: 150 })
        .text(`Generated: ${moment().format('DD MMM YYYY')}`, 400, 40, { align: 'right', width: 150 });

      let currentY = 100;

      // Employee Information
      doc.rect(30, currentY, doc.page.width - 60, 25)
        .fillAndStroke(COLORS.secondary, COLORS.secondary);

      doc.fontSize(11)
        .fillColor(COLORS.background)
        .font('Helvetica-Bold')
        .text('EMPLOYEE INFORMATION', 40, currentY + 8);

      currentY += 35;

      const leftCol = 40;
      const rightCol = 300;

      doc.fontSize(9)
        .fillColor(COLORS.text)
        .font('Helvetica')
        .text('Employee Name:', leftCol, currentY)
        .font('Helvetica-Bold')
        .text(`${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`, leftCol + 90, currentY)
        .font('Helvetica')
        .text('Employee ID:', leftCol, currentY + 15)
        .font('Helvetica-Bold')
        .text(employee.employeeId || 'N/A', leftCol + 90, currentY + 15)
        .font('Helvetica')
        .text('Department:', leftCol, currentY + 30)
        .font('Helvetica-Bold')
        .text(employmentInfo.departmentId?.name || 'N/A', leftCol + 90, currentY + 30);

      doc.font('Helvetica')
        .text('Position:', rightCol, currentY)
        .font('Helvetica-Bold')
        .text(employmentInfo.positionId?.name || 'N/A', rightCol + 60, currentY)
        .font('Helvetica')
        .text('Grade:', rightCol, currentY + 15)
        .font('Helvetica-Bold')
        .text(`${employmentInfo.gradeId?.name || 'N/A'} (Level ${employmentInfo.gradeId?.level || 'N/A'})`, rightCol + 60, currentY + 15)
        .font('Helvetica')
        .text('Days Worked:', rightCol, currentY + 30)
        .font('Helvetica-Bold')
        .text(`${payroll.payPeriod.daysWorked}/${payroll.payPeriod.workingDays}`, rightCol + 60, currentY + 30);

      currentY += 60;

      // Earnings and Deductions sections
      doc.rect(30, currentY, doc.page.width - 60, 25)
        .fillAndStroke(COLORS.lightBg, COLORS.border);

      doc.fontSize(11)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text('EARNINGS & DEDUCTIONS', 40, currentY + 8);

      currentY += 35;

      // Two-column layout for earnings and deductions
      const colWidth = (doc.page.width - 80) / 2;

      // EARNINGS
      doc.fontSize(10)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text('EARNINGS', leftCol, currentY);

      currentY += 20;

      // Gather earnings including adjustments of type 'addition'
      const earnings = [
        { name: 'Basic Salary', amount: payroll.salary.prorated },
        { name: 'Transport Allowance', amount: payroll.allowances.transport },
        { name: 'Housing Allowance', amount: payroll.allowances.housing },
        { name: 'Medical Allowance', amount: payroll.allowances.medical },
        { name: 'Meal Allowance', amount: payroll.allowances.meals },
        { name: 'Communication Allowance', amount: payroll.allowances.communication },
        { name: 'Other Allowances', amount: payroll.allowances.other },
        { name: 'Overtime Pay', amount: payroll.overtime.amount },
        { name: 'Performance Bonus', amount: payroll.bonuses.performance },
        { name: 'Annual Bonus', amount: payroll.bonuses.annual },
        { name: 'Other Bonuses', amount: payroll.bonuses.other }
      ];

      // Add adjustments of type 'addition' to earnings
      if (Array.isArray(payroll.adjustments)) {
        payroll.adjustments
          .filter(adj => adj.type === 'addition' && adj.amount > 0)
          .forEach(adj => {
        earnings.push({
          name: adj.category ? `Adjustment (${adj.category})` : 'Adjustment',
          amount: adj.amount
        });
          });
      }

      // Only show earnings with amount > 0
      const filteredEarnings = earnings.filter(item => item.amount > 0);

      let earningsY = currentY;
      doc.fontSize(8)
        .fillColor(COLORS.text)
        .font('Helvetica');

      earnings.forEach(item => {
        doc.text(item.name, leftCol, earningsY)
          .text(`${payroll.currency} ${item.amount.toLocaleString()}`, leftCol + 120, earningsY, { align: 'right', width: 80 });
        earningsY += 12;
      });

      earningsY += 10;
      doc.fontSize(9)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text('GROSS PAY', leftCol, earningsY)
        .text(`${payroll.currency} ${payroll.grossPay.toLocaleString()}`, leftCol + 120, earningsY, { align: 'right', width: 80 });

      // DEDUCTIONS
      let deductionsY = currentY;
      doc.fontSize(10)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text('DEDUCTIONS', rightCol, deductionsY);

      deductionsY += 20;

      const deductions = [
        { name: `PAYE Tax `, amount: payroll.deductions.tax.amount },
        { name: `Pension (${payroll.deductions.pension.rate}%)`, amount: payroll.deductions.pension.amount },
        ...((payroll.deductions.loans || []).map(loan => ({ name: `Loan: ${loan.name}`, amount: loan.amount }))),
        ...((payroll.deductions.other || []).map(item => ({ name: item.name, amount: item.amount })))
      ].filter(item => item.amount > 0);

      doc.fontSize(8)
        .fillColor(COLORS.text)
        .font('Helvetica');

      deductions.forEach(item => {
        doc.text(item.name, rightCol, deductionsY)
          .text(`${payroll.currency} ${item.amount.toLocaleString()}`, rightCol + 120, deductionsY, { align: 'right', width: 80 });
        deductionsY += 12;
      });

      deductionsY += 10;
      doc.fontSize(9)
        .fillColor(COLORS.error)
        .font('Helvetica-Bold')
        .text('TOTAL DEDUCTIONS', rightCol, deductionsY)
        .text(`${payroll.currency} ${payroll.deductions.total.toLocaleString()}`, rightCol + 120, deductionsY, { align: 'right', width: 80 });

      // NET PAY
      const netPayY = Math.max(earningsY, deductionsY) + 30;
      doc.rect(30, netPayY, doc.page.width - 60, 35)
        .fillAndStroke(COLORS.accent, COLORS.accent);

      doc.fontSize(14)
        .fillColor(COLORS.background)
        .font('Helvetica-Bold')
        .text('NET PAY', 40, netPayY + 10)
        .text(`${payroll.currency} ${payroll.netPay.toLocaleString()}`, 
              doc.page.width - 200, netPayY + 10, { align: 'right', width: 150 });

      // Payment info
      const paymentY = netPayY + 60;
      doc.fontSize(9)
        .fillColor(COLORS.text)
        .font('Helvetica')
        .text(`Payment Method: ${payroll.payment.method || 'Bank Transfer'}`, 40, paymentY)
        .text(`Payment Status: ${payroll.payment.status.toUpperCase()}`, 40, paymentY + 15)
        .text(`Payment Date: ${payroll.payment.paidAt ? moment(payroll.payment.paidAt).format('DD MMM YYYY') : 'Pending'}`, 40, paymentY + 30);

      // Footer
      const footerY = doc.page.height - 60;
      doc.rect(0, footerY, doc.page.width, 60)
        .fillAndStroke(COLORS.primary, COLORS.primary);

      doc.fontSize(7)
        .fillColor(COLORS.background)
        .font('Helvetica')
        .text('This is a computer-generated document and does not require a signature.', 40, footerY + 10)
        .text(`Generated on ${moment().format('DD MMM YYYY [at] HH:mm')}`, 40, footerY + 25)
        .text('For queries, contact HR department.', 40, footerY + 40)
        .text('CONFIDENTIAL', doc.page.width - 100, footerY + 10, { align: 'right' })
        .text(`${COMPANY_NAME}`, doc.page.width - 200, footerY + 25, { align: 'right', width: 150 });

      doc.end();

      if (filePath) {
        return new Promise((resolve, reject) => {
          pdfStream.on('finish', () => resolve(filePath));
          pdfStream.on('error', reject);
        });
      }

      return null;
    } catch (error) {
      console.error('Payslip generation error:', error);
      if (res && !res.headersSent) {
        res.status(500).json({ error: 'Failed to generate payslip PDF' });
      }
      throw error;
    }
  }
  ,// Add adjustment with duration options
addAdjustment: async (payrollId, adjustmentData, userId) => {
  try {
    const payroll = await Payroll.findById(payrollId);

    if (!payroll) {
      const error = new Error('Payroll record not found');
      error.statusCode = 404;
      throw error;
    }

    if (payroll.payment.status === 'paid') {
      const error = new Error('Cannot adjust paid payroll records');
      error.statusCode = 400;
      throw error;
    }

    // Validate duration details for permanent adjustments
    if (adjustmentData.duration === 'permanent' && !adjustmentData.durationDetails) {
      const error = new Error('Duration details required for permanent adjustments');
      error.statusCode = 400;
      throw error;
    }

    const adjustment = {
      ...adjustmentData,
      appliedBy: userId,
      appliedAt: new Date()
    };

    payroll.adjustments.push(adjustment);
    
    // Recalculate payroll with the new adjustment
    await payroll.save();
    
    return payroll;
  } catch (error) {
    throw error;
  }
},

// Edit existing adjustment
editAdjustment: async (payrollId, adjustmentId, updateData, userId) => {
  try {
    const payroll = await Payroll.findById(payrollId);

    if (!payroll) {
      const error = new Error('Payroll record not found');
      error.statusCode = 404;
      throw error;
    }

    if (payroll.payment.status === 'paid') {
      const error = new Error('Cannot edit adjustments on paid payroll records');
      error.statusCode = 400;
      throw error;
    }

    const adjustment = payroll.adjustments.id(adjustmentId);
    if (!adjustment) {
      const error = new Error('Adjustment not found');
      error.statusCode = 404;
      throw error;
    }

    // Track changes
    const changes = [];
    Object.keys(updateData).forEach(key => {
      if (adjustment[key] !== updateData[key]) {
        changes.push({
          field: key,
          oldValue: adjustment[key],
          newValue: updateData[key]
        });
      }
    });

    // Update adjustment
    Object.assign(adjustment, updateData);
    adjustment.appliedBy = userId;
    adjustment.appliedAt = new Date();
    adjustment.changes = adjustment.changes.concat(changes);

    await payroll.save();
    return payroll;
  } catch (error) {
    throw error;
  }
},

// Remove adjustment
removeAdjustment: async (payrollId, adjustmentId, userId) => {
  try {
    const payroll = await Payroll.findById(payrollId);

    if (!payroll) {
      const error = new Error('Payroll record not found');
      error.statusCode = 404;
      throw error;
    }

    if (payroll.payment.status === 'paid') {
      const error = new Error('Cannot remove adjustments from paid payroll records');
      error.statusCode = 400;
      throw error;
    }

    payroll.adjustments.pull(adjustmentId);
    await payroll.save();
    
    return payroll;
  } catch (error) {
    throw error;
  }
},

// Apply permanent adjustments to future payrolls
applyPermanentAdjustments: async (employeeId, month, userId) => {
  try {
    // Get all permanent adjustments for this employee
    const payrolls = await Payroll.find({
      employeeId,
      'adjustments.duration': 'permanent',
      'adjustments.durationDetails.endDate': { $gte: new Date() }
    });

    const permanentAdjustments = payrolls.flatMap(payroll => 
      payroll.adjustments.filter(adj => 
        adj.duration === 'permanent' && 
        new Date(adj.durationDetails.endDate) >= new Date()
      )
    );

    // Apply to current payroll
    const currentPayroll = await Payroll.findOne({
      employeeId,
      payrollMonth: month
    });

    if (currentPayroll) {
      permanentAdjustments.forEach(adjustment => {
        // Check if this adjustment already exists in current payroll
        const exists = currentPayroll.adjustments.some(adj => 
          adj._id.toString() === adjustment._id.toString()
        );
        
        if (!exists) {
          currentPayroll.adjustments.push({
            ...adjustment.toObject(),
            appliedBy: userId,
            appliedAt: new Date()
          });
        }
      });

      await currentPayroll.save();
    }

    return permanentAdjustments;
  } catch (error) {
    throw error;
  }
},
// Update payroll field
updatePayrollField: async (payrollId, fieldPath, newValue, userId) => {
  try {
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll) {
      throw new Error('Payroll record not found');
    }

    if (payroll.payment.status === 'paid') {
      throw new Error('Cannot update paid payroll records');
    }

    // Convert fieldPath string to object path (e.g., "salary.base" to payroll.salary.base)
    const pathParts = fieldPath.split('.');
    let current = payroll;
    
    // Navigate to the parent object
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
      if (!current) {
        throw new Error(`Invalid field path: ${fieldPath}`);
      }
    }
    
    const fieldName = pathParts[pathParts.length - 1];
    const oldValue = current[fieldName];
    
    // Update the field
    current[fieldName] = newValue;
    
    // Add adjustment record
    payroll.adjustments.push({
      type: newValue > oldValue ? 'addition' : 'deduction',
      category: getCategoryFromField(fieldPath),
      amount: Math.abs(newValue - oldValue),
      reason: `Manual adjustment of ${fieldPath} from ${oldValue} to ${newValue}`,
      appliedBy: userId,
      appliedAt: new Date(),
      changes: [{
        field: fieldPath,
        oldValue: oldValue,
        newValue: newValue
      }]
    });
    
    await payroll.save();
    return payroll;
  } catch (error) {
    throw error;
  }
},

// Helper function to determine category from field path
getCategoryFromField: (fieldPath) => {
  if (fieldPath.startsWith('salary.')) return 'salary';
  if (fieldPath.startsWith('allowances.')) return 'allowance';
  if (fieldPath.startsWith('bonuses.')) return 'bonus';
  if (fieldPath.startsWith('deductions.tax.')) return 'tax';
  if (fieldPath.startsWith('deductions.pension.')) return 'pension';
  if (fieldPath.startsWith('deductions.loans.')) return 'loan';
  if (fieldPath.startsWith('deductions.other.')) return 'other';
  return 'other';
},

// Add custom deduction
addCustomDeduction: async (payrollId, deductionData, userId) => {
  try {
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll) {
      throw new Error('Payroll record not found');
    }

    if (payroll.payment.status === 'paid') {
      throw new Error('Cannot add deductions to paid payroll records');
    }

    payroll.deductions.other.push({
      name: deductionData.name,
      amount: deductionData.amount,
      description: deductionData.description || ''
    });
    
    // Add adjustment record
    payroll.adjustments.push({
      type: 'deduction',
      category: 'other',
      amount: deductionData.amount,
      reason: `Added custom deduction: ${deductionData.name}`,
      appliedBy: userId,
      appliedAt: new Date()
    });
    
    await payroll.save();
    return payroll;
  } catch (error) {
    throw error;
  }
},

// Remove custom deduction
removeCustomDeduction: async (payrollId, deductionIndex, userId) => {
  try {
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll) {
      throw new Error('Payroll record not found');
    }

    if (payroll.payment.status === 'paid') {
      throw new Error('Cannot remove deductions from paid payroll records');
    }

    if (!payroll.deductions.other[deductionIndex]) {
      throw new Error('Deduction not found');
    }
    
    const removedDeduction = payroll.deductions.other[deductionIndex];
    
    // Add adjustment record
    payroll.adjustments.push({
      type: 'addition', // Opposite of deduction
      category: 'other',
      amount: removedDeduction.amount,
      reason: `Removed custom deduction: ${removedDeduction.name}`,
      appliedBy: userId,
      appliedAt: new Date()
    });
    
    // Remove the deduction
    payroll.deductions.other.splice(deductionIndex, 1);
    
    await payroll.save();
    return payroll;
  } catch (error) {
    throw error;
  }
},

// Add custom earning
addCustomEarning: async (payrollId, earningData, userId) => {
  try {
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll) {
      throw new Error('Payroll record not found');
    }

    if (payroll.payment.status === 'paid') {
      throw new Error('Cannot add earnings to paid payroll records');
    }

    // Add to other allowances
    const oldOtherAllowances = payroll.allowances.other || 0;
    payroll.allowances.other = oldOtherAllowances + earningData.amount;
    
    // Add adjustment record
    payroll.adjustments.push({
      type: 'addition',
      category: 'allowance',
      amount: earningData.amount,
      reason: `Added custom earning: ${earningData.name}`,
      appliedBy: userId,
      appliedAt: new Date(),
      changes: [{
        field: 'allowances.other',
        oldValue: oldOtherAllowances,
        newValue: payroll.allowances.other
      }]
    });
    
    await payroll.save();
    return payroll;
  } catch (error) {
    throw error;
  }
}
};

module.exports = payrollController;



