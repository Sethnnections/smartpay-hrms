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
    
    // Updated brand colors
    const COLORS = {
      primary: '#0a1f3a',        // Deep navy blue
      secondary: '#0f2a4d',      // Lighter navy blue
      golden: '#e86029',         // Golden yellow/orange
      goldenLight: '#f7d7b3',    // Light golden
      bgWhite: '#ffffff',        // Pure white
      textPrimary: '#1e293b',    // Dark text
      textSecondary: '#64748b',  // Gray text
      borderColor: '#e2e8f0',    // Light border
      success: '#059669',        // Green for paid
      warning: '#d97706',        // Orange for pending
      info: '#0284c7',           // Blue for processing
      lightGray: '#f8fafc'       // Very light gray
    };
    
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
      layout: 'portrait',
      margin: 40,
      bufferPages: true
    });
    doc.pipe(res);

    // ----- Enhanced Header with Gradient Background -----
    // Add subtle watermark background
    doc.fillColor(COLORS.lightGray)
       .fontSize(80)
       .text('BANK INSTRUCTION', 50, 300, {
         opacity: 0.03,
         rotate: -25,
         align: 'center'
       });

    // Header background gradient effect (simulated with rectangles)
    const headerHeight = 120;
    doc.rect(0, 0, doc.page.width, headerHeight)
       .fillAndStroke(COLORS.primary, COLORS.primary);
    
    // Add subtle gradient effect
    doc.rect(0, headerHeight - 20, doc.page.width, 20)
       .fillAndStroke(COLORS.secondary, COLORS.secondary);

    const headerTop = 25;
    const headerLeft = 40;
    const headerRight = doc.page.width - 200;

    // Logo (if exists) with white background circle
    if (fs.existsSync(LOGO_PATH)) {
      try {
        // White circle background for logo
        doc.circle(headerLeft + 40, headerTop + 40, 35)
           .fillAndStroke(COLORS.bgWhite, COLORS.borderColor);
        
        doc.image(LOGO_PATH, headerLeft + 10, headerTop + 10, { 
          width: 60,
          align: 'left'
        });
      } catch (err) {
        console.error('Logo loading error:', err);
      }
    }

    // Company info block with elegant typography
    doc.fillColor(COLORS.bgWhite)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(COMPANY_NAME, headerLeft + 90, headerTop + 15)
       .fontSize(11)
       .font('Helvetica')
       .fillColor(COLORS.goldenLight)
       .text('BANK PAYMENT INSTRUCTION', headerLeft + 90, headerTop + 40)
       .fontSize(10)
       .fillColor(COLORS.bgWhite)
       .text(`Payment Period: ${fileLabel}`, headerLeft + 90, headerTop + 58);

    // Right-aligned details in elegant card style
    const cardWidth = 180;
    const cardHeight = 70;
    doc.rect(headerRight - 10, headerTop, cardWidth, cardHeight)
       .fillAndStroke(COLORS.bgWhite, COLORS.borderColor);
    
    doc.fontSize(8)
       .fillColor(COLORS.textSecondary)
       .text('DOCUMENT DETAILS', headerRight, headerTop + 8, { align: 'center', width: cardWidth - 20 })
       .fontSize(9)
       .fillColor(COLORS.textPrimary)
       .text(`Generated: ${moment().format('DD MMM YYYY, h:mm A')}`, headerRight, headerTop + 22, { align: 'center', width: cardWidth - 20 })
       .text(`By: ${requestedBy?.name || requestedBy?.email || 'System'}`, headerRight, headerTop + 36, { align: 'center', width: cardWidth - 20 })
       .text(`Status: CONFIDENTIAL`, headerRight, headerTop + 50, { align: 'center', width: cardWidth - 20 });

    // Main content area starts here
    let currentY = headerHeight + 30;

    // Bank details section with modern card design
    const cardY = currentY;
    const cardLeft = 40;
    const cardRight = doc.page.width - 40;
    const sectionHeight = 100;

    // Left card - Bank Details
    doc.rect(cardLeft, cardY, (cardRight - cardLeft) / 2 - 10, sectionHeight)
       .fillAndStroke(COLORS.bgWhite, COLORS.borderColor);
    
    // Card header
    doc.rect(cardLeft, cardY, (cardRight - cardLeft) / 2 - 10, 25)
       .fillAndStroke(COLORS.secondary, COLORS.secondary);
    
    doc.fontSize(11)
       .fillColor(COLORS.bgWhite)
       .font('Helvetica-Bold')
       .text('BANK DETAILS', cardLeft + 15, cardY + 8);

    // Card content
    doc.fontSize(9)
       .fillColor(COLORS.textPrimary)
       .font('Helvetica')
       .text(`Bank Name: ${BANK_NAME}`, cardLeft + 15, cardY + 35)
       .text(`Account Name: ${COMPANY_NAME}`, cardLeft + 15, cardY + 48)
       .text(`Account Number: ${COMPANY_ACCOUNT}`, cardLeft + 15, cardY + 61)
       .text(`Currency: ${ACC_CURRENCY}`, cardLeft + 15, cardY + 74);

    // Right card - Payment Summary
    const rightCardX = cardLeft + (cardRight - cardLeft) / 2 + 10;
    doc.rect(rightCardX, cardY, (cardRight - cardLeft) / 2 - 10, sectionHeight)
       .fillAndStroke(COLORS.bgWhite, COLORS.borderColor);
    
    // Card header
    doc.rect(rightCardX, cardY, (cardRight - cardLeft) / 2 - 10, 25)
       .fillAndStroke(COLORS.golden, COLORS.golden);
    
    doc.fontSize(11)
       .fillColor(COLORS.bgWhite)
       .font('Helvetica-Bold')
       .text('PAYMENT SUMMARY', rightCardX + 15, cardY + 8);

    // Payment summary content
    const totalAmount = payrolls.reduce((sum, p) => sum + (p.netPay || 0), 0);
    doc.fontSize(12)
       .fillColor(COLORS.textPrimary)
       .font('Helvetica-Bold')
       .text(`${payrolls.length}`, rightCardX + 15, cardY + 38)
       .fontSize(9)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text('Total Employees', rightCardX + 15, cardY + 52)
       .fontSize(14)
       .fillColor(COLORS.golden)
       .font('Helvetica-Bold')
       .text(`${ACC_CURRENCY} ${totalAmount.toLocaleString()}`, rightCardX + 15, cardY + 68)
       .fontSize(8)
       .fillColor(COLORS.textSecondary)
       .font('Helvetica')
       .text('Total Amount', rightCardX + 15, cardY + 84);

    currentY = cardY + sectionHeight + 30;

    // Enhanced Table Design
    const tableTop = currentY;
    const startX = 40;
    let y = tableTop;
    const tableWidth = doc.page.width - (startX * 2);

    // Column widths (optimized for better spacing)
    const col = {
      no: 30,
      name: 130,
      department: 85,
      bank: 90,
      acct: 95,
      amount: 70,
      status: 55
    };

    // Modern table header with gradient effect
    doc.rect(startX, y, tableWidth, 30)
       .fillAndStroke(COLORS.primary, COLORS.primary);
    
    // Add subtle highlight bar
    doc.rect(startX, y + 25, tableWidth, 5)
       .fillAndStroke(COLORS.golden, COLORS.golden);

    doc.fillColor(COLORS.bgWhite)
       .fontSize(10)
       .font('Helvetica-Bold');

    let cx = startX + 8;
    doc.text('#', cx, y + 8, { width: col.no, align: 'center' }); cx += col.no;
    doc.text('EMPLOYEE NAME', cx, y + 8, { width: col.name, align: 'left' }); cx += col.name;
    doc.text('DEPARTMENT', cx, y + 8, { width: col.department, align: 'left' }); cx += col.department;
    doc.text('BANK NAME', cx, y + 8, { width: col.bank, align: 'left' }); cx += col.bank;
    doc.text('ACCOUNT NO.', cx, y + 8, { width: col.acct, align: 'left' }); cx += col.acct;
    doc.text(`AMOUNT`, cx, y + 4, { width: col.amount, align: 'right' }); 
    doc.fontSize(8).text(`(${ACC_CURRENCY})`, cx, y + 16, { width: col.amount, align: 'right' }); cx += col.amount;
    doc.fontSize(10).text('STATUS', cx, y + 8, { width: col.status, align: 'center' });

    y += 30;

    // Helper to add new page if needed
    function checkPageBreak(heightNeeded = 25) {
      if (y + heightNeeded > doc.page.height - 80) {
        addFooter();
        doc.addPage();
        y = 50;
        
        // Redraw table header on new page
        doc.rect(startX, y, tableWidth, 30)
           .fillAndStroke(COLORS.primary, COLORS.primary);
        
        doc.rect(startX, y + 25, tableWidth, 5)
           .fillAndStroke(COLORS.golden, COLORS.golden);

        doc.fillColor(COLORS.bgWhite)
           .fontSize(10)
           .font('Helvetica-Bold');
        
        let hx = startX + 8;
        doc.text('#', hx, y + 8, { width: col.no, align: 'center' }); hx += col.no;
        doc.text('EMPLOYEE NAME', hx, y + 8, { width: col.name, align: 'left' }); hx += col.name;
        doc.text('DEPARTMENT', hx, y + 8, { width: col.department, align: 'left' }); hx += col.department;
        doc.text('BANK NAME', hx, y + 8, { width: col.bank, align: 'left' }); hx += col.bank;
        doc.text('ACCOUNT NO.', hx, y + 8, { width: col.acct, align: 'left' }); hx += col.acct;
        doc.text(`AMOUNT`, hx, y + 4, { width: col.amount, align: 'right' }); 
        doc.fontSize(8).text(`(${ACC_CURRENCY})`, hx, y + 16, { width: col.amount, align: 'right' }); hx += col.amount;
        doc.fontSize(10).text('STATUS', hx, y + 8, { width: col.status, align: 'center' });
        
        y += 30;
      }
    }

    // Enhanced table rows
    for (let i = 0; i < payrolls.length; i++) {
      const p = payrolls[i];
      const emp = p.employeeId || {};
      const personal = emp.personalInfo || {};
      const dept = emp.employmentInfo?.departmentId || {};
      
      const fullname = `${personal.firstName || ''} ${personal.lastName || ''}`.trim();
      const bankName = (emp.bankDetails?.bankName || p.bankName || '—').substring(0, 18);
      const accountNo = emp.bankDetails?.accountNumber || p.employeeBankAccount || '—';
      const amount = Number(p.netPay || 0);
      const status = p.payment?.status || 'pending';

      checkPageBreak();

      // Enhanced alternating row colors with subtle borders
      const rowColor = i % 2 === 0 ? COLORS.lightGray : COLORS.bgWhite;
      doc.rect(startX, y, tableWidth, 20)
         .fillAndStroke(rowColor, COLORS.borderColor);

      // Row content with improved typography
      doc.fillColor(COLORS.textPrimary)
         .fontSize(9)
         .font('Helvetica');

      let rx = startX + 8;
      doc.text(String(i + 1), rx, y + 6, { width: col.no, align: 'center' }); rx += col.no;
      
      // Employee name in bold
      doc.font('Helvetica-Bold')
         .text(fullname, rx, y + 6, { width: col.name, align: 'left' }); rx += col.name;
      
      doc.font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(dept.name || '—', rx, y + 6, { width: col.department, align: 'left' }); rx += col.department;
      
      doc.fillColor(COLORS.textPrimary)
         .text(bankName, rx, y + 6, { width: col.bank, align: 'left' }); rx += col.bank;
      
      // Account number in monospace-like styling
      doc.font('Helvetica-Bold')
         .text(accountNo, rx, y + 6, { width: col.acct, align: 'left' }); rx += col.acct;
      
      // Amount in golden color and bold
      doc.fillColor(COLORS.golden)
         .font('Helvetica-Bold')
         .text(amount.toLocaleString(), rx, y + 6, { width: col.amount, align: 'right' }); rx += col.amount;
      
      // Enhanced status badge with rounded corners effect
      const statusColors = {
        paid: COLORS.success,
        approved: COLORS.info,
        processing: COLORS.warning,
        pending: COLORS.textSecondary
      };
      
      const statusColor = statusColors[status] || COLORS.textSecondary;
      
      // Status badge background
      doc.fillColor(statusColor)
         .rect(rx + 8, y + 3, col.status - 16, 14)
         .fill();
      
      // Status text
      doc.fillColor(COLORS.bgWhite)
         .fontSize(7)
         .font('Helvetica-Bold')
         .text(status.toUpperCase(), rx + 8, y + 7, { width: col.status - 16, align: 'center' });

      y += 20;
    }

    // Enhanced Summary Section
    checkPageBreak(60);
    
    // Summary card
    const summaryY = y + 10;
    doc.rect(startX, summaryY, tableWidth, 50)
       .fillAndStroke(COLORS.lightGray, COLORS.borderColor);
    
    // Summary header
    doc.rect(startX, summaryY, tableWidth, 20)
       .fillAndStroke(COLORS.secondary, COLORS.secondary);
    
    doc.fontSize(11)
       .fillColor(COLORS.bgWhite)
       .font('Helvetica-Bold')
       .text('PAYMENT SUMMARY', startX + 15, summaryY + 6);
    
    // Summary content in two columns
    doc.fontSize(10)
       .fillColor(COLORS.textPrimary)
       .font('Helvetica')
       .text(`Total Employees: ${payrolls.length}`, startX + 15, summaryY + 30)
       .font('Helvetica-Bold')
       .fillColor(COLORS.golden)
       .text(`Grand Total: ${ACC_CURRENCY} ${totalAmount.toLocaleString()}`, startX + 300, summaryY + 30, { align: 'right', width: 200 });
    
    y = summaryY + 70;

    // Enhanced Authorization Section
    checkPageBreak(80);
    
    doc.fontSize(11)
       .fillColor(COLORS.primary)
       .font('Helvetica-Bold')
       .text('AUTHORIZATION & APPROVAL', startX, y);
    
    y += 25;
    
    // Two signature boxes
    const sigBoxWidth = (tableWidth - 20) / 2;
    
    // Left signature box
    doc.rect(startX, y, sigBoxWidth, 50)
       .fillAndStroke(COLORS.bgWhite, COLORS.borderColor);
    
    doc.fontSize(8)
       .fillColor(COLORS.textSecondary)
       .font('Helvetica')
       .text('PREPARED BY', startX + 10, y + 8)
       .text('Signature: _________________________', startX + 10, y + 25)
       .text('Date: _______________', startX + 10, y + 38);
    
    // Right signature box
    doc.rect(startX + sigBoxWidth + 20, y, sigBoxWidth, 50)
       .fillAndStroke(COLORS.bgWhite, COLORS.borderColor);
    
    doc.text('AUTHORIZED BY', startX + sigBoxWidth + 30, y + 8)
       .text('Signature: _________________________', startX + sigBoxWidth + 30, y + 25)
       .text('Date: _______________', startX + sigBoxWidth + 30, y + 38);

    // Footer function with enhanced design
    function addFooter() {
      const footerY = doc.page.height - 50;
      
      // Footer background
      doc.rect(0, footerY - 10, doc.page.width, 60)
         .fillAndStroke(COLORS.primary, COLORS.primary);
      
      doc.fontSize(8)
         .fillColor(COLORS.goldenLight)
         .font('Helvetica')
         .text('CONFIDENTIAL DOCUMENT - For Bank Processing Only', 40, footerY)
         .fillColor(COLORS.bgWhite)
         .text(`Page ${doc.page.number}`, doc.page.width - 60, footerY, { align: 'right' })
         .text(`${COMPANY_NAME} • Generated ${moment().format('DD MMM YYYY, h:mm A')}`, 40, footerY + 15)
         .fillColor(COLORS.goldenLight)
         .text('This document contains sensitive financial information', 40, footerY + 28);
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


// Add to payrollController.js

// Enhanced Generate Payslip function
payrollController.generatePayslip = async (payrollId) => {
  try {
    const payroll = await Payroll.findById(payrollId)
      .populate({
        path: 'employeeId',
        populate: [
          { path: 'employmentInfo.departmentId', select: 'name' },
          { path: 'employmentInfo.positionId', select: 'title' },
          { path: 'employmentInfo.gradeId', select: 'name level' }
        ]
      });

    if (!payroll) {
      throw new Error('Payroll record not found');
    }

    // Generate payslip PDF
    const payslipPath = await payrollController._generatePayslipPDF(payroll);
    
    // Update payroll record
    payroll.payslip = {
      generated: true,
      path: payslipPath,
      generatedAt: new Date()
    };
    
    await payroll.save();
    
    return {
      success: true,
      message: 'Payslip generated successfully',
      path: payslipPath,
      payrollId: payroll._id
    };
  } catch (error) {
    throw error;
  }
};

// Internal PDF generation function
payrollController._generatePayslipPDF = async (payroll) => {
  return new Promise(async (resolve, reject) => {
    try {
      const employee = payroll.employeeId;
      const personalInfo = employee.personalInfo || {};
      const employmentInfo = employee.employmentInfo || {};
      
      // Create directory if not exists
      const payslipDir = path.join(process.cwd(), 'payslips', payroll.employeeId._id.toString());
      if (!fs.existsSync(payslipDir)) {
        fs.mkdirSync(payslipDir, { recursive: true });
      }
      
      const filename = `payslip_${payroll.payrollMonth}.pdf`;
      const filePath = path.join(payslipDir, filename);
      
      // Create PDF document
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      
      // Company branding
      const COMPANY_NAME = process.env.COMPANY_NAME || 'Norah Tech Supplies Ltd.';
      const COMPANY_LOGO = process.env.COMPANY_LOGO_PATH || path.join(process.cwd(), 'public', 'logo.png');
      
      // Payslip styling
      const colors = {
        primary: '#0a1f3a',
        secondary: '#0f2a4d',
        accent: '#e86029',
        text: '#333333',
        lightGray: '#f5f5f5'
      };
      
      // Header with logo and company info
      if (fs.existsSync(COMPANY_LOGO)) {
        doc.image(COMPANY_LOGO, 30, 30, { width: 60 });
      }
      
      doc.fontSize(18)
         .fillColor(colors.primary)
         .text(COMPANY_NAME, 100, 35)
         .fontSize(10)
         .fillColor(colors.text)
         .text('Monthly Payslip', 100, 60);
      
      // Employee info section
      doc.fontSize(12)
         .fillColor(colors.primary)
         .text('Employee Information', 30, 120)
         .moveDown(0.5);
      
      doc.fontSize(10)
         .fillColor(colors.text)
         .text(`Name: ${personalInfo.firstName} ${personalInfo.lastName}`, { indent: 20 })
         .text(`Employee ID: ${employee.employeeId}`, { indent: 20 })
         .text(`Department: ${employmentInfo.departmentId?.name || 'N/A'}`, { indent: 20 })
         .text(`Position: ${employmentInfo.positionId?.title || 'N/A'}`, { indent: 20 })
         .text(`Grade: ${employmentInfo.gradeId?.name || 'N/A'} (Level ${employmentInfo.gradeId?.level || 'N/A'})`, { indent: 20 })
         .moveDown();
      
      // Pay period info
      doc.fontSize(12)
         .fillColor(colors.primary)
         .text('Pay Period Information', 30, doc.y)
         .moveDown(0.5);
      
      doc.fontSize(10)
         .fillColor(colors.text)
         .text(`Payroll Month: ${payroll.payrollMonth}`, { indent: 20 })
         .text(`Period: ${moment(payroll.payPeriod.startDate).format('DD MMM YYYY')} - ${moment(payroll.payPeriod.endDate).format('DD MMM YYYY')}`, { indent: 20 })
         .text(`Working Days: ${payroll.payPeriod.workingDays}`, { indent: 20 })
         .text(`Days Worked: ${payroll.payPeriod.daysWorked} (${payroll.attendanceRate}%)`, { indent: 20 })
         .moveDown();
      
      // Earnings section
      doc.fontSize(12)
         .fillColor(colors.primary)
         .text('Earnings', 30, doc.y)
         .moveDown(0.5);
      
      const earnings = [
        { name: 'Basic Salary', amount: payroll.salary.prorated },
        { name: 'Transport Allowance', amount: payroll.allowances.transport },
        { name: 'Housing Allowance', amount: payroll.allowances.housing },
        { name: 'Medical Allowance', amount: payroll.allowances.medical },
        { name: 'Meal Allowance', amount: payroll.allowances.meals },
        { name: 'Communication Allowance', amount: payroll.allowances.communication },
        { name: 'Other Allowance', amount: payroll.allowances.other },
        { name: 'Overtime Pay', amount: payroll.overtime.amount },
        { name: 'Performance Bonus', amount: payroll.bonuses.performance },
        { name: 'Annual Bonus', amount: payroll.bonuses.annual },
        { name: 'Other Bonus', amount: payroll.bonuses.other }
      ].filter(item => item.amount > 0);
      
      earnings.forEach(item => {
        doc.fontSize(10)
           .fillColor(colors.text)
           .text(item.name, 50, doc.y)
           .text(`${payroll.currency} ${item.amount.toLocaleString()}`, 400, doc.y, { width: 100, align: 'right' })
           .moveDown(0.3);
      });
      
      // Total earnings
      doc.fontSize(11)
         .fillColor(colors.primary)
         .text('Total Earnings', 350, doc.y)
         .text(`${payroll.currency} ${payroll.grossPay.toLocaleString()}`, 400, doc.y, { width: 100, align: 'right' })
         .moveDown();
      
      // Deductions section
      doc.fontSize(12)
         .fillColor(colors.primary)
         .text('Deductions', 30, doc.y)
         .moveDown(0.5);
      
      const deductions = [
        { name: 'PAYE Tax', amount: payroll.deductions.tax.amount },
        { name: 'Pension Contribution', amount: payroll.deductions.pension.amount },
        ...((payroll.deductions.loans || []).map(loan => ({ name: `Loan: ${loan.name}`, amount: loan.amount }))),
        ...((payroll.deductions.other || []).map(item => ({ name: item.name, amount: item.amount })))
      ].filter(item => item.amount > 0);
      
      deductions.forEach(item => {
        doc.fontSize(10)
           .fillColor(colors.text)
           .text(item.name, 50, doc.y)
           .text(`${payroll.currency} ${item.amount.toLocaleString()}`, 400, doc.y, { width: 100, align: 'right' })
           .moveDown(0.3);
      });
      
      // Total deductions
      doc.fontSize(11)
         .fillColor(colors.primary)
         .text('Total Deductions', 350, doc.y)
         .text(`${payroll.currency} ${payroll.deductions.total.toLocaleString()}`, 400, doc.y, { width: 100, align: 'right' })
         .moveDown();
      
      // Net pay section
      doc.fontSize(14)
         .fillColor(colors.accent)
         .text('Net Pay', 350, doc.y + 20)
         .text(`${payroll.currency} ${payroll.netPay.toLocaleString()}`, 400, doc.y, { width: 100, align: 'right' })
         .moveDown();
      
      // Payment info
      doc.fontSize(10)
         .fillColor(colors.text)
         .text(`Payment Method: ${payroll.payment.method}`, 30, doc.y + 20)
         .text(`Payment Status: ${payroll.payment.status}`, 30, doc.y)
         .text(`Payment Date: ${payroll.payment.paidAt ? moment(payroll.payment.paidAt).format('DD MMM YYYY') : 'Pending'}`, 30, doc.y)
         .moveDown();
      
      // Footer
      doc.fontSize(8)
         .fillColor(colors.text)
         .text('This is a computer generated document and does not require a signature.', 30, doc.page.height - 50)
         .text(`Generated on ${moment().format('DD MMM YYYY HH:mm')}`, 30, doc.page.height - 30);
      
      doc.end();
      
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

// Add this function to download payslip
payrollController.downloadPayslip = async (payrollId, res) => {
  try {
    const payroll = await Payroll.findById(payrollId);
    
    if (!payroll || !payroll.payslip.generated) {
      throw new Error('Payslip not found or not generated');
    }
    
    const filePath = path.join(process.cwd(), payroll.payslip.path);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Payslip file not found');
    }
    
    const filename = `payslip_${payroll.employeeId}_${payroll.payrollMonth}.pdf`;
    
    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'application/pdf');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    throw error;
  }
};

// Add this function to your payrollController.js

// Stream payslip PDF directly to response
payrollController.generatePayslipPDF = async (res, payroll) => {
  try {
    const employee = payroll.employeeId;
    const personalInfo = employee.personalInfo || {};
    const employmentInfo = employee.employmentInfo || {};
    
    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);
    
    // Company branding
    const COMPANY_NAME = process.env.COMPANY_NAME || 'Norah Tech Supplies Ltd.';
    const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || 'Umoyo Building, Blantyre, Malawi';
    const COMPANY_LOGO = process.env.COMPANY_LOGO_PATH || path.join(process.cwd(), 'public', 'logo.png');
    
    // Enhanced styling
    const colors = {
      primary: '#0a1f3a',
      secondary: '#0f2a4d', 
      accent: '#e86029',
      text: '#333333',
      lightGray: '#f8fafc',
      border: '#e2e8f0'
    };
    
    // Header section with enhanced design
    if (fs.existsSync(COMPANY_LOGO)) {
      try {
        doc.image(COMPANY_LOGO, 40, 40, { width: 60 });
      } catch (err) {
        console.error('Logo loading error:', err);
      }
    }
    
    // Company header
    doc.fontSize(20)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text(COMPANY_NAME, 120, 45)
       .fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica')
       .text(COMPANY_ADDRESS, 120, 70)
       .fontSize(14)
       .fillColor(colors.accent)
       .font('Helvetica-Bold')
       .text('PAYSLIP', 120, 90);
    
    // Right-aligned document info
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica')
       .text(`Period: ${payroll.payrollMonth}`, 400, 45, { align: 'right', width: 150 })
       .text(`Generated: ${moment().format('DD MMM YYYY')}`, 400, 60, { align: 'right', width: 150 });
    
    // Employee Information Section
    let currentY = 140;
    
    // Section header
    doc.rect(40, currentY, 515, 25)
       .fillAndStroke(colors.primary, colors.primary);
    
    doc.fontSize(12)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .text('EMPLOYEE INFORMATION', 50, currentY + 8);
    
    currentY += 35;
    
    // Employee details in two columns
    const leftColumn = 50;
    const rightColumn = 300;
    
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica');
    
    // Left column
    doc.text('Employee Name:', leftColumn, currentY)
       .font('Helvetica-Bold')
       .text(`${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`, leftColumn + 100, currentY)
       .font('Helvetica')
       .text('Employee ID:', leftColumn, currentY + 15)
       .font('Helvetica-Bold')
       .text(employee.employeeId || 'N/A', leftColumn + 100, currentY + 15)
       .font('Helvetica')
       .text('Department:', leftColumn, currentY + 30)
       .font('Helvetica-Bold')
       .text(employmentInfo.departmentId?.name || 'N/A', leftColumn + 100, currentY + 30);
    
    // Right column
    doc.font('Helvetica')
       .text('Position:', rightColumn, currentY)
       .font('Helvetica-Bold')
       .text(employmentInfo.positionId?.title || 'N/A', rightColumn + 70, currentY)
       .font('Helvetica')
       .text('Grade:', rightColumn, currentY + 15)
       .font('Helvetica-Bold')
       .text(`${employmentInfo.gradeId?.name || 'N/A'} (Level ${employmentInfo.gradeId?.level || 'N/A'})`, rightColumn + 70, currentY + 15)
       .font('Helvetica')
       .text('Days Worked:', rightColumn, currentY + 30)
       .font('Helvetica-Bold')
       .text(`${payroll.payPeriod.daysWorked}/${payroll.payPeriod.workingDays}`, rightColumn + 70, currentY + 30);
    
    currentY += 70;
    
    // Pay Details Section
    doc.rect(40, currentY, 515, 25)
       .fillAndStroke(colors.secondary, colors.secondary);
    
    doc.fontSize(12)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .text('PAY DETAILS', 50, currentY + 8);
    
    currentY += 35;
    
    // Earnings table
    doc.fontSize(11)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text('EARNINGS', leftColumn, currentY);
    
    currentY += 20;
    
    const earnings = [
      { name: 'Basic Salary', amount: payroll.salary.prorated },
      { name: 'Transport Allowance', amount: payroll.allowances.transport },
      { name: 'Housing Allowance', amount: payroll.allowances.housing },
      { name: 'Medical Allowance', amount: payroll.allowances.medical },
      { name: 'Meal Allowance', amount: payroll.allowances.meals },
      { name: 'Communication Allowance', amount: payroll.allowances.communication },
      { name: 'Other Allowance', amount: payroll.allowances.other },
      { name: 'Overtime Pay', amount: payroll.overtime.amount },
      { name: 'Performance Bonus', amount: payroll.bonuses.performance },
      { name: 'Annual Bonus', amount: payroll.bonuses.annual },
      { name: 'Other Bonus', amount: payroll.bonuses.other }
    ].filter(item => item.amount > 0);
    
    doc.fontSize(9)
       .fillColor(colors.text)
       .font('Helvetica');
    
    earnings.forEach(item => {
      doc.text(item.name, leftColumn + 10, currentY)
         .text(`${payroll.currency} ${item.amount.toLocaleString()}`, 450, currentY, { align: 'right', width: 100 });
      currentY += 15;
    });
    
    // Gross pay total
    currentY += 5;
    doc.fontSize(10)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text('GROSS PAY', leftColumn + 10, currentY)
       .text(`${payroll.currency} ${payroll.grossPay.toLocaleString()}`, 450, currentY, { align: 'right', width: 100 });
    
    currentY += 30;
    
    // Deductions section
    doc.fontSize(11)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text('DEDUCTIONS', leftColumn, currentY);
    
    currentY += 20;
    
    const deductions = [
      { name: `PAYE Tax (${payroll.deductions.tax.rate}%)`, amount: payroll.deductions.tax.amount },
      { name: `Pension (${payroll.deductions.pension.rate}%)`, amount: payroll.deductions.pension.amount },
      ...((payroll.deductions.loans || []).map(loan => ({ name: `Loan: ${loan.name}`, amount: loan.amount }))),
      ...((payroll.deductions.other || []).map(item => ({ name: item.name, amount: item.amount })))
    ].filter(item => item.amount > 0);
    
    doc.fontSize(9)
       .fillColor(colors.text)
       .font('Helvetica');
    
    deductions.forEach(item => {
      doc.text(item.name, leftColumn + 10, currentY)
         .text(`${payroll.currency} ${item.amount.toLocaleString()}`, 450, currentY, { align: 'right', width: 100 });
      currentY += 15;
    });
    
    // Total deductions
    currentY += 5;
    doc.fontSize(10)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text('TOTAL DEDUCTIONS', leftColumn + 10, currentY)
       .text(`${payroll.currency} ${payroll.deductions.total.toLocaleString()}`, 450, currentY, { align: 'right', width: 100 });
    
    currentY += 30;
    
    // Net Pay section with highlight
    doc.rect(40, currentY, 515, 40)
       .fillAndStroke(colors.lightGray, colors.border);
    
    doc.fontSize(16)
       .fillColor(colors.accent)
       .font('Helvetica-Bold')
       .text('NET PAY', leftColumn + 10, currentY + 12)
       .text(`${payroll.currency} ${payroll.netPay.toLocaleString()}`, 450, currentY + 12, { align: 'right', width: 100 });
    
    currentY += 60;
    
    // Payment Information
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica')
       .text(`Payment Method: ${payroll.payment.method || 'Bank Transfer'}`, leftColumn, currentY)
       .text(`Payment Status: ${payroll.payment.status.toUpperCase()}`, leftColumn, currentY + 15)
       .text(`Payment Date: ${payroll.payment.paidAt ? moment(payroll.payment.paidAt).format('DD MMM YYYY') : 'Pending'}`, leftColumn, currentY + 30);
    
    // Adjustments if any
    if (payroll.adjustments && payroll.adjustments.length > 0) {
      currentY += 60;
      doc.fontSize(11)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('ADJUSTMENTS', leftColumn, currentY);
      
      currentY += 20;
      
      payroll.adjustments.forEach(adj => {
        const sign = adj.type === 'addition' ? '+' : '-';
        doc.fontSize(9)
           .fillColor(colors.text)
           .font('Helvetica')
           .text(`${adj.reason}`, leftColumn + 10, currentY)
           .text(`${sign}${payroll.currency} ${adj.amount.toLocaleString()}`, 450, currentY, { align: 'right', width: 100 });
        currentY += 15;
      });
    }
    
    // Footer
    const footerY = doc.page.height - 80;
    
    doc.rect(40, footerY, 515, 40)
       .fillAndStroke(colors.primary, colors.primary);
    
    doc.fontSize(8)
       .fillColor('#ffffff')
       .font('Helvetica')
       .text('This is a computer-generated document and does not require a signature.', 50, footerY + 8)
       .text(`Generated on ${moment().format('DD MMM YYYY [at] HH:mm')}`, 50, footerY + 22)
       .text('For queries, contact HR department.', 400, footerY + 8, { align: 'right', width: 145 })
       .text('CONFIDENTIAL', 400, footerY + 22, { align: 'right', width: 145 });
    
    doc.end();
    
  } catch (error) {
    console.error('PDF generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
};

module.exports = payrollController;