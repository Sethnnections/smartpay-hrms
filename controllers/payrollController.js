const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Grade = require('../models/Grade');
const moment = require('moment');



const payrollController = {
  // Process payroll for all active employees
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

  

  // Get payroll list with filters
listPayrolls: async (filters = {}) => {
  try {
    const user = filters.user;
    
    if (!user) {
      throw new Error('Authentication required');
    }

    // Validate and set default pagination parameters
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const skip = (page - 1) * limit;

    // Set default query
    let query = { isActive: true };

    // Admin users can see all payrolls without restrictions
    if (user.role !== 'admin') {
      // HR users can see all payrolls but with possible filters
      if (user.role !== 'hr') {
        // Regular employees can only see their own payroll
        if (!user.employeeId) {
          throw new Error('Employee record not found for user');
        }
        query.employeeId = user.employeeId;
      }
    }

    // Apply filters from query parameters
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
  // Get single payroll details
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
        })
        .populate('processedBy', 'email')
        .populate('approvals.hr.by', 'email')
        .populate('approvals.finance.by', 'email');

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

  // Generate payslip
  generatePayslip: async (payrollId) => {
    try {
      const payroll = await Payroll.findById(payrollId)
        .populate('employeeId');
      
      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      await payroll.generatePayslip();
      return payroll;
    } catch (error) {
      throw error;
    }
  },

  // Generate all payslips for a month
  generateAllPayslips: async (month) => {
    try {
      const results = await Payroll.generateAllPayslips(month);
      
      return {
        month,
        totalRecords: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      throw error;
    }
  },

  // Get payroll summary
  getPayrollSummary: async (month) => {
    try {
      const summary = await Payroll.getSummary(month);
      
      if (!summary || summary.length === 0) {
        return {
          month,
          totalEmployees: 0,
          totalGrossPay: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          totalTax: 0,
          totalPension: 0,
          paidCount: 0,
          pendingCount: 0
        };
      }

      return {
        month,
        ...summary[0]
      };
    } catch (error) {
      throw error;
    }
  },

  // Get department-wise payroll summary
  getDepartmentSummary: async (month) => {
    try {
      const summary = await Payroll.aggregate([
        { $match: { payrollMonth: month, isActive: true } },
        {
          $lookup: {
            from: 'employees',
            localField: 'employeeId',
            foreignField: '_id',
            as: 'employee'
          }
        },
        { $unwind: '$employee' },
        {
          $lookup: {
            from: 'departments',
            localField: 'employee.employmentInfo.departmentId',
            foreignField: '_id',
            as: 'department'
          }
        },
        { $unwind: '$department' },
        {
          $group: {
            _id: {
              departmentId: '$department._id',
              departmentName: '$department.name'
            },
            employeeCount: { $sum: 1 },
            totalGrossPay: { $sum: '$grossPay' },
            totalNetPay: { $sum: '$netPay' },
            totalDeductions: { $sum: '$deductions.total' },
            averageNetPay: { $avg: '$netPay' }
          }
        },
        { $sort: { totalNetPay: -1 } }
      ]);

      return summary.map(dept => ({
        department: dept._id.departmentName,
        departmentId: dept._id.departmentId,
        employeeCount: dept.employeeCount,
        totalGrossPay: dept.totalGrossPay,
        totalNetPay: dept.totalNetPay,
        totalDeductions: dept.totalDeductions,
        averageNetPay: Math.round(dept.averageNetPay)
      }));
    } catch (error) {
      throw error;
    }
  },

  // Delete/deactivate payroll
  deactivatePayroll: async (payrollId) => {
    try {
      const payroll = await Payroll.findById(payrollId);
      
      if (!payroll) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
      }

      if (payroll.payment.status === 'paid') {
        const error = new Error('Cannot deactivate paid payroll records');
        error.statusCode = 400;
        throw error;
      }

      payroll.isActive = false;
      await payroll.save();
      
      return payroll;
    } catch (error) {
      throw error;
    }
  }
};

/**
 * Streams a bank-ready Payroll Instruction PDF to the provided response.
 * Options: { month: 'YYYY-MM' } OR { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 * Only payrolls that are approved by HR and Finance and pending/approved payment status are included.
 */
payrollController.generateBankInstructionPDF = async function (res, options = {}, requestedBy = {}) {
  try {
    // Validate inputs
    const { month, startDate, endDate } = options;
    if (!month && !(startDate && endDate)) {
      throw new Error('Provide either month (YYYY-MM) or startDate and endDate (YYYY-MM-DD).');
    }
    if (month && !moment(month, 'YYYY-MM', true).isValid()) {
      throw new Error('Invalid month format. Use YYYY-MM.');
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

    // Pull payrolls
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
      res.status(404).json({ error: 'No payroll records found for the selected period.' });
      return;
    }

    // Company branding data
    const COMPANY_NAME = process.env.COMPANY_NAME || 'Norah Tech Supplies Ltd.';
    const COMPANY_ACCOUNT = process.env.COMPANY_ACCOUNT || '123456789';
    const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || 'Umoyo Building, Blantyre, Malawi';
    const BANK_NAME = process.env.BANK_NAME || 'National Bank of Malawi';
    const LOGO_PATH = process.env.COMPANY_LOGO_PATH || path.join(process.cwd(), 'public', 'logo.png');
    const BRAND_COLOR = process.env.COMPANY_BRAND_COLOR || '#0b6b3b';
    const SECONDARY_COLOR = process.env.COMPANY_SECONDARY_COLOR || '#2c3e50';
    const ACC_CURRENCY = payrolls[0].currency || process.env.COMPANY_CURRENCY || 'MWK';

    // Prepare PDF filename
    const fileLabel = month ? month : `${startDate}_to_${endDate}`;
    const filename = `bank_instruction_${fileLabel}.pdf`;

    // Stream headers
    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'application/pdf');

    // Create PDF doc with better margins and layout
    const doc = new PDFDocument({ 
      size: 'A4', 
      layout: 'portrait', // Changed to portrait for better readability
      margin: 30,
      bufferPages: true // For better page handling
    });
    doc.pipe(res);

    // ----- Header with Watermark -----
    // Add watermark background
    doc.fillColor('#f5f5f5')
       .fontSize(60)
       .text('CONFIDENTIAL', 50, 250, {
         opacity: 0.1,
         rotate: -30,
         align: 'center'
       })
       .fillColor('black');

    // Header with logo and company info
    const headerTop = 30;
    const headerLeft = 30;
    const headerRight = doc.page.width - 200;

    // Logo (if exists)
    if (fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, headerLeft, headerTop, { 
          width: 80,
          align: 'left'
        });
      } catch (err) {
        console.error('Logo loading error:', err);
      }
    }

    // Company info block
    doc.fillColor(BRAND_COLOR)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text(COMPANY_NAME, headerLeft + 90, headerTop + 5)
       .fillColor('black')
       .fontSize(9)
       .font('Helvetica')
       .text('Bank Payment Instruction', headerLeft + 90, headerTop + 25)
       .text(`Period: ${fileLabel}`, headerLeft + 90, headerTop + 38);

    // Right-aligned details
    doc.fontSize(9)
       .text(`Generated: ${moment().format('DD MMM YYYY, h:mm A')}`, headerRight, headerTop + 5, { align: 'right' })
       .text(`By: ${requestedBy?.name || requestedBy?.email || 'System'}`, headerRight, headerTop + 18, { align: 'right' })
       .text(`Page 1 of 1`, headerRight, headerTop + 31, { align: 'right' });

    // Header divider line
    doc.moveTo(headerLeft, headerTop + 55)
       .lineTo(doc.page.width - headerLeft, headerTop + 55)
       .lineWidth(1)
       .stroke(BRAND_COLOR);

    // Bank details section
    const bankDetailsTop = headerTop + 70;
    doc.fontSize(10)
       .fillColor(SECONDARY_COLOR)
       .text('BANK DETAILS', headerLeft, bankDetailsTop)
       .fillColor('black')
       .text(`Bank Name: ${BANK_NAME}`, headerLeft, bankDetailsTop + 15)
       .text(`Account Name: ${COMPANY_NAME}`, headerLeft, bankDetailsTop + 30)
       .text(`Account Number: ${COMPANY_ACCOUNT}`, headerLeft, bankDetailsTop + 45)
       .text(`Currency: ${ACC_CURRENCY}`, headerLeft, bankDetailsTop + 60);

    // Payment summary
    const totalAmount = payrolls.reduce((sum, p) => sum + (p.netPay || 0), 0);
    doc.text(`Total Employees: ${payrolls.length}`, headerRight, bankDetailsTop + 15, { align: 'right' })
       .text(`Total Amount: ${ACC_CURRENCY} ${totalAmount.toLocaleString()}`, headerRight, bankDetailsTop + 30, { align: 'right' });

    // Table header
    const tableTop = bankDetailsTop + 85;
    const startX = headerLeft;
    let y = tableTop;
    const tableWidth = doc.page.width - (startX * 2);

    // Column widths
    const col = {
      no: 25,
      name: 120,
      department: 80,
      bank: 90,
      acct: 90,
      amount: 60,
      status: 50
    };

    // Draw table header
    doc.rect(startX, y, tableWidth, 20)
       .fillAndStroke(BRAND_COLOR, BRAND_COLOR)
       .fillColor('white')
       .fontSize(9)
       .font('Helvetica-Bold');

    let cx = startX + 5;
    doc.text('#', cx, y + 5, { width: col.no, align: 'center' }); cx += col.no;
    doc.text('EMPLOYEE NAME', cx, y + 5, { width: col.name, align: 'left' }); cx += col.name;
    doc.text('DEPARTMENT', cx, y + 5, { width: col.department, align: 'left' }); cx += col.department;
    doc.text('BANK NAME', cx, y + 5, { width: col.bank, align: 'left' }); cx += col.bank;
    doc.text('ACCOUNT NO.', cx, y + 5, { width: col.acct, align: 'left' }); cx += col.acct;
    doc.text(`AMOUNT (${ACC_CURRENCY})`, cx, y + 5, { width: col.amount, align: 'right' }); cx += col.amount;
    doc.text('STATUS', cx, y + 5, { width: col.status, align: 'center' });

    // Reset styles for table rows
    doc.fillColor('black')
       .font('Helvetica')
       .fontSize(8);
    y += 20;

    // Helper to add new page if needed
    function checkPageBreak(heightNeeded = 20) {
      if (y + heightNeeded > doc.page.height - 50) {
        addFooter();
        doc.addPage();
        y = 50;
        // Redraw table header on new page
        doc.rect(startX, y, tableWidth, 20)
           .fillAndStroke(BRAND_COLOR, BRAND_COLOR)
           .fillColor('white')
           .fontSize(9)
           .font('Helvetica-Bold');
        
        let hx = startX + 5;
        doc.text('#', hx, y + 5, { width: col.no, align: 'center' }); hx += col.no;
        doc.text('EMPLOYEE NAME', hx, y + 5, { width: col.name, align: 'left' }); hx += col.name;
        doc.text('DEPARTMENT', hx, y + 5, { width: col.department, align: 'left' }); hx += col.department;
        doc.text('BANK NAME', hx, y + 5, { width: col.bank, align: 'left' }); hx += col.bank;
        doc.text('ACCOUNT NO.', hx, y + 5, { width: col.acct, align: 'left' }); hx += col.acct;
        doc.text(`AMOUNT (${ACC_CURRENCY})`, hx, y + 5, { width: col.amount, align: 'right' }); hx += col.amount;
        doc.text('STATUS', hx, y + 5, { width: col.status, align: 'center' });
        
        doc.fillColor('black')
           .font('Helvetica')
           .fontSize(8);
        y += 20;
      }
    }

    // Draw table rows
    for (let i = 0; i < payrolls.length; i++) {
      const p = payrolls[i];
      const emp = p.employeeId || {};
      const personal = emp.personalInfo || {};
      const dept = emp.employmentInfo?.departmentId || {};
      
      const fullname = `${personal.firstName || ''} ${personal.lastName || ''}`.trim();
      const bankName = (emp.bankDetails?.bankName || p.bankName || '—').substring(0, 20);
      const accountNo = emp.bankDetails?.accountNumber || p.employeeBankAccount || '—';
      const amount = Number(p.netPay || 0);
      const status = p.payment?.status || 'pending';

      checkPageBreak();

      // Alternate row colors
      if (i % 2 === 0) {
        doc.rect(startX, y, tableWidth, 15).fill('#f9f9f9');
      }

      let rx = startX + 5;
      doc.fillColor('black').text(String(i + 1), rx, y + 3, { width: col.no, align: 'center' }); rx += col.no;
      doc.text(fullname, rx, y + 3, { width: col.name, align: 'left' }); rx += col.name;
      doc.text(dept.name || '—', rx, y + 3, { width: col.department, align: 'left' }); rx += col.department;
      doc.text(bankName, rx, y + 3, { width: col.bank, align: 'left' }); rx += col.bank;
      doc.text(accountNo, rx, y + 3, { width: col.acct, align: 'left' }); rx += col.acct;
      doc.text(amount.toLocaleString(), rx, y + 3, { width: col.amount, align: 'right' }); rx += col.amount;
      
      // Status badge
      const statusColor = status === 'paid' ? '#28a745' : 
                         status === 'approved' ? '#17a2b8' : 
                         status === 'processing' ? '#ffc107' : '#6c757d';
      doc.fillColor(statusColor)
         .rect(rx + 5, y + 1, col.status - 10, 13)
         .fill()
         .fillColor('white')
         .fontSize(7)
         .text(status.toUpperCase(), rx + 5, y + 4, { width: col.status - 10, align: 'center' })
         .fillColor('black')
         .fontSize(8);

      y += 15;
    }

    // Summary section
    checkPageBreak(40);
    doc.moveTo(startX, y).lineTo(startX + tableWidth, y).stroke('#cccccc');
    y += 10;
    
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .text('SUMMARY', startX, y)
       .font('Helvetica')
       .text(`Total Employees: ${payrolls.length}`, startX + 200, y)
       .text(`Total Amount: ${ACC_CURRENCY} ${totalAmount.toLocaleString()}`, startX + 400, y, { align: 'right' });
    
    y += 30;

    // Approval section
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .text('AUTHORIZATION', startX, y);
    
    y += 15;
    doc.moveTo(startX, y).lineTo(startX + 250, y).stroke('#cccccc');
    doc.moveTo(startX + 300, y).lineTo(startX + 550, y).stroke('#cccccc');
    doc.text('Authorized Signature', startX, y + 5);
    doc.text('Date', startX + 300, y + 5);
    
    y += 20;
    doc.text('Name:', startX, y + 5);
    doc.text('Designation:', startX + 300, y + 5);

    // Footer function
    function addFooter() {
      const footerY = doc.page.height - 30;
      doc.fontSize(7)
         .fillColor('#666666')
         .text('Confidential - For bank processing only', startX, footerY)
         .text(`Page ${doc.page.number}`, doc.page.width - startX - 20, footerY, { align: 'right' })
         .text(`Generated on ${moment().format('DD MMM YYYY, h:mm A')}`, doc.page.width / 2 - 100, footerY, { align: 'center' });
    }

    // Add footer to last page
    addFooter();
    doc.end();

  } catch (err) {
    console.error('generateBankInstructionPDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Failed to generate PDF' });
    } else {
      try { res.end(); } catch (e) { /* ignore */ }
    }
  }
};


module.exports = payrollController;