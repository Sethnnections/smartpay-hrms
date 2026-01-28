const ExcelJS = require('exceljs');
const moment = require('moment');

const excelGenerator = {
  // Generate Excel for Bank Instruction
  generateBankInstructionExcel: async (payrolls, companyDetails) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bank Instructions');
    
    // Set company details
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').value = companyDetails.name;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    worksheet.mergeCells('A2:E2');
    worksheet.getCell('A2').value = 'BANK PAYMENT INSTRUCTION';
    worksheet.getCell('A2').font = { size: 14, bold: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    
    worksheet.mergeCells('A3:E3');
    worksheet.getCell('A3').value = `Generated: ${moment().format('DD MMM YYYY HH:mm')}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center' };
    
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
    
    // Add data
    let totalAmount = 0;
    payrolls.forEach((payroll, index) => {
      const emp = payroll.employeeId || {};
      const personal = emp.personalInfo || {};
      const bankInfo = emp.bankInfo || {};
      
      const row = worksheet.addRow([
        index + 1,
        `${personal.firstName || ''} ${personal.lastName || ''}`,
        bankInfo.bankName || 'N/A',
        bankInfo.accountNumber || 'N/A',
        payroll.netPay || 0,
        payroll.currency || 'MWK'
      ]);
      
      totalAmount += payroll.netPay || 0;
    });
    
    // Add total row
    worksheet.addRow([]);
    const totalRow = worksheet.addRow(['', '', '', 'TOTAL:', totalAmount, payrolls[0]?.currency || 'MWK']);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1D5D1' }
    };
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = column.header.length < 12 ? 12 : column.header.length;
    });
    
    return workbook;
  },
  
  // Generate Excel for PAYE Report
  generatePAYEExcel: async (payrolls) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('PAYE Report');
    
    // Add title
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'PAYE TAX REPORT';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    // Add headers
    const headers = ['#', 'Employee Name', 'Employee ID', 'Department', 'Gross Pay', 'Tax Rate', 'PAYE Amount', 'Currency'];
    worksheet.addRow(headers);
    
    // Style header row
    const headerRow = worksheet.getRow(3);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6c0c0d' }
    };
    headerRow.font.color = { argb: 'FFFFFFFF' };
    
    // Add data
    let totalTax = 0;
    let recordNumber = 1;
    
    payrolls.forEach(payroll => {
      if (payroll.deductions?.tax?.amount > 0) {
        const emp = payroll.employeeId || {};
        const personal = emp.personalInfo || {};
        const dept = emp.employmentInfo?.departmentId || {};
        
        worksheet.addRow([
          recordNumber++,
          `${personal.firstName || ''} ${personal.lastName || ''}`,
          emp.employeeId || 'N/A',
          dept.name || 'N/A',
          payroll.grossPay || 0,
          `${(payroll.deductions.tax.rate || 0).toFixed(1)}%`,
          payroll.deductions.tax.amount || 0,
          payroll.currency || 'MWK'
        ]);
        
        totalTax += payroll.deductions.tax.amount || 0;
      }
    });
    
    // Add summary
    worksheet.addRow([]);
    const summaryRow = worksheet.addRow(['', '', '', '', '', 'TOTAL:', totalTax, payrolls[0]?.currency || 'MWK']);
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1D5D1' }
    };
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = column.header.length < 12 ? 12 : column.header.length;
    });
    
    return workbook;
  },
  
  // Generate Excel for Pension Report
  generatePensionExcel: async (payrolls) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pension Report');
    
    // Add title
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'PENSION CONTRIBUTION REPORT';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    // Add headers
    const headers = ['#', 'Employee Name', 'Employee ID', 'Department', 'Gross Pay', 'Pension Rate', 'Pension Amount', 'Currency'];
    worksheet.addRow(headers);
    
    // Style header row
    const headerRow = worksheet.getRow(3);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6c0c0d' }
    };
    headerRow.font.color = { argb: 'FFFFFFFF' };
    
    // Add data
    let totalPension = 0;
    let recordNumber = 1;
    
    payrolls.forEach(payroll => {
      if (payroll.deductions?.pension?.amount > 0) {
        const emp = payroll.employeeId || {};
        const personal = emp.personalInfo || {};
        const dept = emp.employmentInfo?.departmentId || {};
        
        worksheet.addRow([
          recordNumber++,
          `${personal.firstName || ''} ${personal.lastName || ''}`,
          emp.employeeId || 'N/A',
          dept.name || 'N/A',
          payroll.grossPay || 0,
          `${(payroll.deductions.pension.rate || 0).toFixed(1)}%`,
          payroll.deductions.pension.amount || 0,
          payroll.currency || 'MWK'
        ]);
        
        totalPension += payroll.deductions.pension.amount || 0;
      }
    });
    
    // Add summary
    worksheet.addRow([]);
    const summaryRow = worksheet.addRow(['', '', '', '', '', '', 'TOTAL:', totalPension, payrolls[0]?.currency || 'MWK']);
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1D5D1' }
    };
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = column.header.length < 12 ? 12 : column.header.length;
    });
    
    return workbook;
  }
};

module.exports = excelGenerator;