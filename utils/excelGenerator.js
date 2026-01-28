const ExcelJS = require('exceljs');
const moment = require('moment');

const excelGenerator = {
  // Generate Excel for Bank Instruction
  generateBankInstructionExcel: async (payrolls, companyDetails) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bank Instructions');
    
    // Set company details
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').value = companyDetails?.name || 'Company Name';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    worksheet.mergeCells('A2:E2');
    worksheet.getCell('A2').value = 'BANK PAYMENT INSTRUCTION';
    worksheet.getCell('A2').font = { size: 14, bold: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    
    worksheet.mergeCells('A3:E3');
    worksheet.getCell('A3').value = `Generated: ${moment().format('DD MMM YYYY HH:mm')}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center' };
    
    // Add empty row
    worksheet.addRow([]);
    
    // Add headers
    const headers = ['#', 'Employee Name', 'Bank Name', 'Account Number', 'Net Pay', 'Currency'];
    worksheet.addRow(headers);
    
    // Style header row
    const headerRow = worksheet.getRow(5);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6c0c0d' }
    };
    headerRow.font.color = { argb: 'FFFFFFFF' };
    
    // Check if payrolls exists and has data
    if (!payrolls || !Array.isArray(payrolls) || payrolls.length === 0) {
      worksheet.addRow(['No payroll data found for the selected period']);
      return workbook;
    }
    
    // Add data
    let totalAmount = 0;
    let rowNumber = 1;
    
    payrolls.forEach((payroll, index) => {
      // Add null/undefined checks
      const emp = payroll?.employeeId || {};
      const personal = emp?.personalInfo || {};
      const bankInfo = emp?.bankInfo || {};
      
      const firstName = personal?.firstName || '';
      const lastName = personal?.lastName || '';
      const employeeName = `${firstName} ${lastName}`.trim() || 'N/A';
      const bankName = bankInfo?.bankName || 'N/A';
      const accountNumber = bankInfo?.accountNumber || 'N/A';
      const netPay = payroll?.netPay || 0;
      const currency = payroll?.currency || 'MWK';
      
      const row = worksheet.addRow([
        rowNumber,
        employeeName,
        bankName,
        accountNumber,
        netPay,
        currency
      ]);
      
      totalAmount += netPay;
      rowNumber++;
    });
    
    // Add empty row
    worksheet.addRow([]);
    
    // Add total row
    const totalRow = worksheet.addRow(['', '', '', 'TOTAL:', totalAmount, payrolls[0]?.currency || 'MWK']);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1D5D1' }
    };
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.header && column.header.length) {
        column.width = Math.max(column.header.length, 12);
      } else {
        column.width = 12;
      }
    });
    
    return workbook;
  },
  
  // Generate Excel for PAYE Report
  // Generate Excel for PAYE Report
generatePAYEExcel: async (payrolls) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('PAYE Report');
  
  // Add title
  worksheet.mergeCells('A1:H1');
  worksheet.getCell('A1').value = 'PAYE TAX REPORT';
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  
  // Add date
  worksheet.mergeCells('A2:H2');
  worksheet.getCell('A2').value = `Generated: ${moment().format('DD MMM YYYY HH:mm')}`;
  worksheet.getCell('A2').alignment = { horizontal: 'center' };
  
  // Add empty row
  worksheet.addRow([]);
  
  // Add headers
  const headers = ['#', 'Employee Name', 'Employee ID', 'Department', 'Gross Pay', 'Tax Rate', 'PAYE Amount', 'Currency'];
  worksheet.addRow(headers);
  
  // Style header row
  const headerRow = worksheet.getRow(4);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6c0c0d' }
  };
  headerRow.font.color = { argb: 'FFFFFFFF' };
  
  // Check if payrolls exists and has data
  if (!payrolls || !Array.isArray(payrolls) || payrolls.length === 0) {
    worksheet.addRow(['No payroll data found for the selected period']);
    return workbook;
  }
  
  // Add data
  let totalTax = 0;
  let recordNumber = 1;
  
  payrolls.forEach((payroll, index) => {
    // Check if this payroll has tax data
    if (!payroll || !payroll.deductions || !payroll.deductions.tax) {
      return; // Skip if no tax data
    }
    
    const taxAmount = payroll.deductions.tax.amount || 0;
    if (taxAmount <= 0) {
      return; // Skip if no tax deduction
    }
    
    const emp = payroll?.employeeId || {};
    const personal = emp?.personalInfo || {};
    const dept = emp?.employmentInfo?.departmentId || {};
    
    const firstName = personal?.firstName || '';
    const lastName = personal?.lastName || '';
    const employeeName = `${firstName} ${lastName}`.trim() || 'N/A';
    const employeeId = emp?.employeeId || 'N/A';
    const department = dept?.name || 'N/A';
    const grossPay = payroll?.grossPay || 0;
    const taxRate = payroll.deductions.tax.rate || 0;
    const currency = payroll?.currency || 'MWK';
    
    worksheet.addRow([
      recordNumber++,
      employeeName,
      employeeId,
      department,
      grossPay,
      `${taxRate.toFixed(1)}%`,
      taxAmount,
      currency
    ]);
    
    totalTax += taxAmount;
  });
  
  // Add summary if we have data
  if (recordNumber > 1) {
    worksheet.addRow([]);
    const summaryRow = worksheet.addRow(['', '', '', '', '', '', 'TOTAL:', totalTax, payrolls[0]?.currency || 'MWK']);
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1D5D1' }
    };
  } else {
    worksheet.addRow([]);
    worksheet.addRow(['No PAYE tax found for the selected period']);
  }
  
  // Auto-fit columns
  worksheet.columns.forEach(column => {
    if (column.header && column.header.length) {
      column.width = Math.max(column.header.length, 12);
    } else {
      column.width = 12;
    }
  });
  
  return workbook;
},
  
  // Generate Excel for Pension Report
generatePensionExcel: async (payrolls) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pension Report');
    
    // Add title
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = 'PENSION CONTRIBUTION REPORT';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    // Add date
    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = `Generated: ${moment().format('DD MMM YYYY HH:mm')}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    
    // Add empty row
    worksheet.addRow([]);
    
    // Add headers
    const headers = ['#', 'Employee Name', 'Employee ID', 'Department', 'Gross Pay', 'Pension Rate', 'Pension Amount', 'Currency'];
    worksheet.addRow(headers);
    
    // Style header row
    const headerRow = worksheet.getRow(4);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6c0c0d' }
    };
    headerRow.font.color = { argb: 'FFFFFFFF' };
    
    // Check if payrolls exists and has data
    if (!payrolls || !Array.isArray(payrolls) || payrolls.length === 0) {
      worksheet.addRow(['No payroll data found for the selected period']);
      return workbook;
    }
    
    // Add data
    let totalPension = 0;
    let recordNumber = 1;
    
    payrolls.forEach((payroll, index) => {
      // Check if this payroll has pension data
      if (!payroll || !payroll.deductions || !payroll.deductions.pension) {
        return; // Skip if no pension data
      }
      
      const pensionAmount = payroll.deductions.pension.amount || 0;
      if (pensionAmount <= 0) {
        return; // Skip if no pension deduction
      }
      
      const emp = payroll?.employeeId || {};
      const personal = emp?.personalInfo || {};
      const dept = emp?.employmentInfo?.departmentId || {};
      
      const firstName = personal?.firstName || '';
      const lastName = personal?.lastName || '';
      const employeeName = `${firstName} ${lastName}`.trim() || 'N/A';
      const employeeId = emp?.employeeId || 'N/A';
      const department = dept?.name || 'N/A';
      const grossPay = payroll?.grossPay || 0;
      const pensionRate = payroll.deductions.pension.rate || 0;
      const currency = payroll?.currency || 'MWK';
      
      worksheet.addRow([
        recordNumber++,
        employeeName,
        employeeId,
        department,
        grossPay,
        `${pensionRate.toFixed(1)}%`,
        pensionAmount,
        currency
      ]);
      
      totalPension += pensionAmount;
    });
    
    // Add summary if we have data
    if (recordNumber > 1) {
      worksheet.addRow([]);
      const summaryRow = worksheet.addRow(['', '', '', '', '', '', 'TOTAL:', totalPension, payrolls[0]?.currency || 'MWK']);
      summaryRow.font = { bold: true };
      summaryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1D5D1' }
      };
    } else {
      worksheet.addRow([]);
      worksheet.addRow(['No pension contributions found for the selected period']);
    }
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.header && column.header.length) {
        column.width = Math.max(column.header.length, 12);
      } else {
        column.width = 12;
      }
    });
    
    return workbook;
  }
};

module.exports = excelGenerator;