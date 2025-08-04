Here's a step-by-step procedure to build a complete employee management system with payroll processing, including tax and deductions:

### Step 1: Create Core Models (Foundation)
1. **User Model** (`User.js`)
   - Authentication foundation
   - Roles (admin, hr, employee)
   - Basic profile info

2. **Department Model** (`Department.js`)
   - Organizational structure
   - Budget information
   - Location details

3. **Grade Model** (`Grade.js`)
   - Salary scales
   - Allowances (housing, transport, etc.)
   - Payroll settings (PAYE %, pension %, overtime rates)
   - Tax brackets
   - Benefits packages

### Step 2: Position Management
4. **Position Model** (`Position.js`)
   - Job titles and descriptions
   - Department association
   - Grade linkage
   - Reporting structure
   - Capacity planning (filled/vacant positions)

### Step 3: Employee Records
5. **Employee Model** (`Employee.js`)
   - Personal information
   - Employment details (position, department, grade)
   - Salary and compensation
   - Bank details
   - Documents (contracts, IDs)
   - Leave balances

### Step 4: Payroll System
6. **Payroll Model** (`Payroll.js`)
   - Pay period definition
   - Earnings (basic salary, allowances, overtime, bonuses)
   - Deductions:
     - PAYE/Tax (percentage based on grade)
     - Pension (employee + employer contributions)
     - Insurance (health, life)
     - Loans/advances
     - Other statutory deductions
   - Net pay calculation
   - Payment status
   - Approval workflow

### Implementation Order:

1. **Setup Authentication**
   - Register admin user first
   - Create user roles/permissions

2. **Build Organizational Structure**
   - Create departments
   - Define grades with salary ranges and benefits
   - Set up positions linked to departments and grades

3. **Employee Creation Flow**
   ```mermaid
   graph TD
     A[Register User] --> B[Create Employee Record]
     B --> C[Assign to Position]
     C --> D[Set Grade-Specific Benefits]
     D --> E[Complete Tax Profile]
   ```

4. **Payroll Processing Steps**
   ```mermaid
   graph TD
     A[Initiate Payroll Run] --> B[Calculate for Each Employee]
     B --> C[Apply Grade-Based Earnings]
     C --> D[Compute Deductions]
     D --> E[Generate Payslips]
     E --> F[Approval Workflow]
     F --> G[Payment Processing]
     G --> H[Reporting]
   ```

### Detailed Payroll Calculation Procedure:

1. **Initiate Payroll**
   - Select pay period (monthly/bi-weekly)
   - Confirm active employee list

2. **For Each Employee:**
   ```
   1. Get base salary from grade
   2. Add allowances:
      - Housing
      - Transport
      - Medical
      - Other benefits
   3. Calculate overtime:
      - Hours × Grade rate × Multiplier
   4. Add bonuses (if applicable)
   5. Calculate GROSS PAY (sum of above)
   
   6. Compute Deductions:
      - PAYE/Tax:
        - Apply tax bracket from grade
        - Subtract exemption amount
        - Calculate percentage
      - Pension:
        - Employee contribution (%)
        - Employer contribution (%)
      - Insurance premiums
      - Loan repayments
      - Other deductions
   
   7. Calculate NET PAY:
      Gross Pay - Total Deductions
   
   8. Generate Payslip:
      - Breakdown of all components
      - Tax calculations
      - Payment instructions
   ```

3. **Approval Process**
   - HR verifies calculations
   - Finance approves payments
   - Audit trail of changes

4. **Payment Execution**
   - Bulk bank transfers
   - Payment confirmation
   - Record payment references

5. **Reporting**
   - Departmental payroll costs
   - Tax liability reports
   - Pension contributions
   - Custom reports by date range

### Tax Handling Specifics:

1. **PAYE Calculation:**
   ```javascript
   // Sample tax calculation
   function calculatePAYE(grossPay, taxBracket) {
     const { exemptionAmount, baseTax, percentage } = taxBracket;
     const taxableAmount = Math.max(0, grossPay - exemptionAmount);
     return baseTax + (taxableAmount * percentage / 100);
   }
   ```

2. **Pension Processing:**
   - Employee contribution (e.g., 5% of basic salary)
   - Employer contribution (e.g., 10% of basic salary)
   - Cap at statutory limits

3. **Statutory Deductions:**
   - National health insurance
   - Union dues
   - Other government-mandated deductions

### Complete Workflow Example:

1. **Admin creates HR user**
2. **HR user:**
   - Adds "Finance" department
   - Creates "Accountant" grade (level 4, $50k base)
   - Opens "Senior Accountant" position (linked to Finance dept and grade)
3. **Hires employee:**
   - Registers user jane@company.com
   - Creates employee record for Jane Doe
   - Assigns to Senior Accountant position
4. **Payroll processing:**
   - System pulls Jane's grade (level 4)
   - Base salary: $4,166.67/month
   - Adds housing allowance: $500
   - Adds transport allowance: $200
   - 5 hours overtime: 5 × $30 × 1.5 = $225
   - Gross pay: $5,091.67
   - Deductions:
     - PAYE: $1,016.67 (20%)
     - Pension: $208.33 (5%)
     - Health insurance: $150
   - Net pay: $3,716.67

