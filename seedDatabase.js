// seedDatabase_corrected.js - Fully corrected version
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const moment = require('moment');

// Models
const Department = require('./models/Department');
const Grade = require('./models/Grade');
const Position = require('./models/Position');
const Employee = require('./models/Employee');
const User = require('./models/User');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/smartpay-hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Clear all existing data
const clearExistingData = async () => {
  try {
    console.log('🧹 Clearing all existing data...');
    
    await Employee.deleteMany({});
    console.log('   ✅ Cleared employees');
    
    await User.deleteMany({});
    console.log('   ✅ Cleared users');
    
    await Position.deleteMany({});
    console.log('   ✅ Cleared positions');
    
    await Grade.deleteMany({});
    console.log('   ✅ Cleared grades');
    
    await Department.deleteMany({});
    console.log('   ✅ Cleared departments');
    
    console.log('✅ All existing data cleared\n');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
};

// Parse Excel data with exact mapping
const parseExcelData = () => {
  try {
    // Read the Excel file
    const workbook = xlsx.readFile('./SIMAMA HOTEL (2).XLSX');
    const worksheet = workbook.Sheets['BASIC INFORMATION'];
    
    // Convert to JSON with proper headers
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Skip header rows (first 3 rows are headers)
    const rows = data.slice(3);
    
    console.log(`Total rows in Excel: ${rows.length}`);
    
    const employeesData = [];
    
    for (let index = 0; index < rows.length; index++) {
      try {
        const row = rows[index];
        
        // Skip empty rows
        if (!row || row.length === 0 || !row[0]) {
          continue;
        }
        
        // DEBUG: Print the entire row to see what we're getting
        console.log(`\n=== Row ${index + 4} (0-index: ${index}) ===`);
        console.log('Full row data:');
        row.forEach((cell, colIndex) => {
          console.log(`  [${colIndex}]: "${cell}" (type: ${typeof cell})`);
        });
        
        // Extract data with proper column mapping
        const fullName = String(row[0] || '').trim();
        
        // Column B: Date of Birth (index 1)
        let dobRaw = row[1];
        
        // Column C: Gender (index 2) - THIS IS THE CRITICAL PART
        const genderRaw = row[2];
        console.log(`Raw gender data: "${genderRaw}" (type: ${typeof genderRaw})`);
        
        // Column D: Phone Number (index 3)
        const phoneNumber = row[3] ? String(row[3]) : '';
        
        // Column E: Nationality (index 4)
        const nationality = row[4] ? String(row[4]).trim() : 'Malawian';
        
        // Column F: State/Area (index 5)
        const state = row[5] ? String(row[5]).trim() : '';
        
        // Column G: City (index 6)
        const city = row[6] ? String(row[6]).trim() : 'Lilongwe';
        
        // Column H: Country (index 7)
        const country = row[7] ? String(row[7]).trim() : 'Malawi';
        
        // Column I: Next of Kin Name (index 8)
        const emergencyContactName = row[8] ? String(row[8]).trim() : '';
        
        // Column J: Relationship (index 9)
        const emergencyRelationship = row[9] ? String(row[9]).trim() : '';
        
        // Column K: Phone Number (index 10) - Emergency contact phone
        const emergencyPhone = row[10] ? String(row[10]) : '';
        
        // Column L: Department (index 11)
        const departmentName = row[11] ? String(row[11]).trim() : 'ADMINISTRATION';
        
        // Column M: Position (index 12)
        const positionName = row[12] ? String(row[12]).trim() : '';
        
        // Column N: Employee No (index 13)
        const employeeId = row[13] ? String(row[13]).trim() : '';
        
        // Column O: Employment Type (index 14)
        const employmentType = row[14] ? String(row[14]).trim() : 'PERMANENT';
        
        // Column P: Salary (index 15)
        const salary = row[15] ? parseFloat(row[15]) : 0;
        
        // Column Q: Start Date (index 16)
        let startDateRaw = row[16];
        
        // Column R: Status (index 17)
        const status = row[17] ? String(row[17]).trim() : 'ACTIVE';
        
        // Column S: Bank Name (index 18)
        const bankName = row[18] ? String(row[18]).trim() : '';
        
        // Column T: Account Name (index 19)
        const accountName = row[19] ? String(row[19]).trim() : '';
        
        // Column U: Account Number (index 20)
        const accountNumber = row[20] ? String(row[20]) : '';
        
        // Parse name properly
        const nameParts = fullName.split(' ');
        let firstName = '';
        let lastName = '';
        let middleName = '';
        
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts[nameParts.length - 1];
          if (nameParts.length > 2) {
            middleName = nameParts.slice(1, -1).join(' ');
          }
        } else if (nameParts.length === 1) {
          firstName = fullName;
          lastName = fullName;
        }
        
        // Parse dates correctly
        let dob;
        if (dobRaw instanceof Date) {
          dob = dobRaw;
        } else if (typeof dobRaw === 'number') {
          // Excel stores dates as numbers (days since 1900-01-01)
          const excelEpoch = new Date(1900, 0, 1);
          excelEpoch.setDate(excelEpoch.getDate() + dobRaw - 2); // Excel has a leap year bug
          dob = excelEpoch;
        } else if (typeof dobRaw === 'string') {
          // Try to parse the string
          const parsedDate = new Date(dobRaw);
          dob = isNaN(parsedDate.getTime()) ? new Date('1970-01-01') : parsedDate;
        } else {
          dob = new Date('1970-01-01');
        }
        
        let startDate;
        if (startDateRaw instanceof Date) {
          startDate = startDateRaw;
        } else if (typeof startDateRaw === 'number') {
          const excelEpoch = new Date(1900, 0, 1);
          excelEpoch.setDate(excelEpoch.getDate() + startDateRaw - 2);
          startDate = excelEpoch;
        } else if (typeof startDateRaw === 'string') {
          const parsedDate = new Date(startDateRaw);
          startDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
        } else {
          startDate = new Date();
        }
        
        // FIXED: Gender parsing - handle various formats
        let gender = 'other';
        if (genderRaw !== undefined && genderRaw !== null) {
          const genderStr = String(genderRaw).toUpperCase().trim();
          console.log(`Processing gender: "${genderStr}"`);
          
          if (genderStr === 'MALE' || genderStr === 'M' || genderStr === 'MALE ') {
            gender = 'male';
          } else if (genderStr === 'FEMALE' || genderStr === 'F' || genderStr === 'FEMALE ') {
            gender = 'female';
          } else {
            console.log(`Unknown gender format: "${genderStr}"`);
          }
        }
        
        console.log(`Determined gender: ${gender}`);
        
        // Phone number formatting
        const formatPhone = (phone) => {
          if (!phone || phone === '' || phone === undefined || phone === null) {
            return '';
          }
          
          const phoneStr = String(phone);
          const digits = phoneStr.replace(/\D/g, '');
          
          if (digits.length === 0) return '';
          
          // Handle Malawian phone numbers
          if (digits.startsWith('0')) {
            return `+265${digits.substring(1)}`;
          } else if (digits.startsWith('265')) {
            return `+${digits}`;
          } else if (digits.length === 9) {
            return `+265${digits}`;
          } else {
            return `+${digits}`;
          }
        };
        
        // Generate email
        const cleanFirstName = firstName.toLowerCase().replace(/[^a-z]/g, '');
        const cleanLastName = lastName.toLowerCase().replace(/[^a-z]/g, '');
        let email;
        
        if (cleanFirstName && cleanLastName) {
          email = `${cleanFirstName}.${cleanLastName}@simamahotel.mw`;
        } else {
          email = `employee${index + 1}@simamahotel.mw`;
        }
        
        // Ensure email is unique
        let emailSuffix = 1;
        let originalEmail = email;
        while (employeesData.some(emp => emp.employeeData.personalInfo.email === email)) {
          email = `${cleanFirstName}.${cleanLastName}${emailSuffix}@simamahotel.mw`;
          emailSuffix++;
        }
        
        // Create employee data
        const employeeData = {
          employeeId: employeeId || `SMH${String(300 + index).padStart(3, '0')}`,
          personalInfo: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName.trim(),
            dateOfBirth: dob,
            gender: gender,
            maritalStatus: 'single',
            nationality: nationality,
            idNumber: employeeId ? `SIMAMA-${employeeId}` : `SIMAMA-EMP${10000 + index}`,
            phoneNumber: formatPhone(phoneNumber) || '+265000000000',
            email: email,
            personalEmail: email,
            address: {
              street: state || 'Area 1 (Falls)',
              city: city,
              state: state,
              zipCode: '0000',
              country: country
            },
            passportNumber: '',
            alternatePhone: ''
          },
          employmentInfo: {
            positionId: null,
            departmentId: null,
            gradeId: null,
            startDate: startDate,
            employmentType: employmentType.toLowerCase().includes('permanent') ? 'full-time' : 
                           employmentType.toLowerCase().includes('contract') ? 'contract' : 'full-time',
            status: status.toUpperCase() === 'ACTIVE' ? 'active' : 'inactive',
            currentSalary: salary,
            workLocation: 'office',
            isOnProbation: moment(startDate).add(3, 'months') > new Date(),
            endDate: null,
            probationEndDate: moment(startDate).add(3, 'months').toDate(),
            contractEndDate: null,
            managerId: null
          },
          bankInfo: {
            bankName: bankName || 'ECOBANK',
            accountNumber: accountNumber || '',
            accountName: accountName || fullName,
            routingNumber: '',
            bankCode: bankName ? bankName.toUpperCase().replace(/\s/g, '').slice(0, 4) : 'ECOB',
            branchCode: '',
            iban: ''
          },
          emergencyContact: {
            name: emergencyContactName || 'Not Provided',
            relationship: emergencyRelationship || 'Not Specified',
            phoneNumber: formatPhone(emergencyPhone) || formatPhone(phoneNumber) || '+265000000000',
            alternatePhone: '',
            email: '',
            address: {
              street: '',
              city: '',
              state: '',
              zipCode: '',
              country: ''
            }
          },
          leaveBalance: {
            annual: {
              allocated: 24,
              used: 0,
              pending: 0
            },
            sick: {
              allocated: 12,
              used: 0
            },
            personal: {
              allocated: 5,
              used: 0
            }
          },
          isActive: status.toUpperCase() === 'ACTIVE',
          tags: ['simama-hotel', 'employee'],
          createdBy: null
        };
        
        // Validate required fields
        if (!firstName || !lastName) {
          console.warn(`⚠️ Skipping row ${index + 4}: Missing name`);
          continue;
        }
        
        employeesData.push({
          employeeData: employeeData,
          metadata: {
            departmentName: departmentName.toUpperCase(),
            positionName: positionName,
            originalRow: index + 4,
            excelData: {
              fullName,
              dobRaw: dobRaw,
              genderRaw: genderRaw,
              phoneNumber,
              emergencyPhone,
              emergencyContactName,
              emergencyRelationship,
              positionName,
              salary
            }
          }
        });
        
        console.log(`✅ Parsed: ${fullName} - Gender: ${gender} - Position: ${positionName} - Salary: MWK ${salary}`);
        console.log(`   Emergency Contact: ${emergencyContactName} (${emergencyRelationship}) - Phone: ${formatPhone(emergencyPhone)}`);
        
      } catch (error) {
        console.error(`❌ Error parsing row ${index + 4}:`, error.message);
        console.error('Error stack:', error.stack);
        console.error('Row data:', rows[index]);
        continue;
      }
    }
    
    console.log(`\n📊 Successfully parsed ${employeesData.length} employees from Excel`);
    
    // Show detailed summary
    console.log('\n📋 DETAILED DATA QUALITY CHECK:');
    console.log('================================');
    
    const genderCount = employeesData.reduce((acc, emp) => {
      const gender = emp.employeeData.personalInfo.gender;
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nGender Distribution:');
    console.log('-------------------');
    Object.entries(genderCount).forEach(([gender, count]) => {
      console.log(`  ${gender}: ${count} employees`);
    });
    
    // Show sample of female employees to verify
    const femaleEmployees = employeesData.filter(emp => 
      emp.employeeData.personalInfo.gender === 'female'
    ).slice(0, 5);
    
    if (femaleEmployees.length > 0) {
      console.log('\nSample Female Employees (to verify gender):');
      console.log('------------------------------------------');
      femaleEmployees.forEach(emp => {
        console.log(`  ${emp.employeeData.personalInfo.firstName} ${emp.employeeData.personalInfo.lastName}`);
        console.log(`    From Excel: "${emp.metadata.excelData.genderRaw}"`);
      });
    }
    
    console.log('\nEmergency Contact Analysis:');
    console.log('--------------------------');
    const withEmergencyContact = employeesData.filter(emp => 
      emp.employeeData.emergencyContact.name !== 'Not Provided'
    ).length;
    console.log(`  Employees with emergency contact: ${withEmergencyContact}/${employeesData.length}`);
    
    const withEmergencyPhone = employeesData.filter(emp => 
      emp.employeeData.emergencyContact.phoneNumber && 
      emp.employeeData.emergencyContact.phoneNumber !== '+265000000000'
    ).length;
    console.log(`  Employees with emergency phone: ${withEmergencyPhone}/${employeesData.length}`);
    
    // Show sample emergency contacts
    console.log('\nSample Emergency Contacts:');
    console.log('-------------------------');
    employeesData.slice(0, 5).forEach(emp => {
      console.log(`  ${emp.employeeData.personalInfo.firstName}: ${emp.employeeData.emergencyContact.name}`);
      console.log(`    Relationship: ${emp.employeeData.emergencyContact.relationship}`);
      console.log(`    Phone: ${emp.employeeData.emergencyContact.phoneNumber}`);
    });
    
    const positions = [...new Set(employeesData.map(emp => emp.metadata.positionName))];
    console.log(`\nUnique Positions Found: ${positions.length}`);
    positions.forEach((pos, i) => {
      console.log(`  [${i+1}] ${pos}`);
    });
    
    const salaries = employeesData.map(emp => emp.employeeData.employmentInfo.currentSalary);
    console.log(`\nSalary Analysis:`);
    console.log(`  Min: MWK ${Math.min(...salaries).toLocaleString()}`);
    console.log(`  Max: MWK ${Math.max(...salaries).toLocaleString()}`);
    console.log(`  Avg: MWK ${Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length).toLocaleString()}`);
    
    return employeesData;
  } catch (error) {
    console.error('❌ Error parsing Excel file:', error);
    throw error;
  }
};

// [Rest of the functions remain the same - createDepartments, createGrades, createPositions, createAdminUser, createEmployees]

// Create Departments (same as before)
const createDepartments = async (employeesData, adminUserId) => {
  try {
    console.log('\n🏢 Creating departments...');
    
    const departmentNames = [...new Set(employeesData.map(data => data.metadata.departmentName))];
    const departments = {};
    
    for (const deptName of departmentNames) {
      const deptCode = deptName.replace(/[^A-Z]/g, '').substring(0, 3).toUpperCase();
      
      const department = new Department({
        name: deptName,
        code: deptCode,
        description: `${deptName} Department - Simama Hotel`,
        location: {
          type: 'physical',
          address: {
            street: 'Area 1 (Falls)',
            city: 'Lilongwe',
            state: 'Central Region',
            country: 'Malawi'
          },
          building: 'Simama Hotel',
          floor: 'Ground Floor'
        },
        budget: {
          allocated: 5000000,
          spent: 0,
          fiscalYear: 2025,
          currency: 'MWK'
        },
        isActive: true,
        establishedDate: new Date('2014-01-01'),
        costCenter: `${deptCode}001`,
        tags: ['hotel', 'hospitality', deptName.toLowerCase()]
      });
      
      await department.save();
      departments[deptName] = department._id;
      console.log(`   ✅ Department: ${deptName} (${deptCode})`);
    }
    
    console.log(`✅ Created ${Object.keys(departments).length} departments`);
    return departments;
  } catch (error) {
    console.error('❌ Error creating departments:', error);
    throw error;
  }
};

// Create Grades (same as before)
const createGrades = async (employeesData, adminUserId) => {
  try {
    console.log('\n📊 Creating grades based on actual salary data...');
    
    const salaries = employeesData
      .map(data => data.employeeData.employmentInfo.currentSalary)
      .filter(salary => salary > 0)
      .sort((a, b) => a - b);
    
    console.log(`Analyzing ${salaries.length} salaries...`);
    console.log(`Min: MWK ${Math.min(...salaries)}`);
    console.log(`Max: MWK ${Math.max(...salaries)}`);
    console.log(`Avg: MWK ${Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length)}`);
    
    const salaryRanges = [
      { min: 0, max: 150000, name: 'Grade 1', level: 1 },
      { min: 150001, max: 250000, name: 'Grade 2', level: 2 },
      { min: 250001, max: 350000, name: 'Grade 3', level: 3 },
      { min: 350001, max: 500000, name: 'Grade 4', level: 4 },
      { min: 500001, max: 1000000, name: 'Grade 5', level: 5 },
      { min: 1000001, max: 5000000, name: 'Grade 6', level: 6 }
    ];
    
    const grades = {};
    
    for (const range of salaryRanges) {
      const gradeCode = `G${range.level.toString().padStart(2, '0')}`;
      const baseSalary = Math.round((range.min + range.max) / 2);
      
      const grade = new Grade({
        name: range.name,
        code: gradeCode,
        level: range.level,
        baseSalary: baseSalary,
        salaryRange: {
          minimum: range.min,
          maximum: range.max
        },
        currency: 'MWK',
        payrollSettings: {
          payeePercent: range.level <= 2 ? 0 : range.level * 5,
          pensionPercent: 5,
          overtimeRate: baseSalary / 208,
          overtimeMultiplier: 1.5
        },
        allowances: {
          transport: range.level >= 3 ? 50000 : 20000,
          housing: range.level >= 4 ? 100000 : 0,
          medical: range.level >= 2 ? 30000 : 15000,
          meals: 25000,
          communication: 10000
        },
        taxBracket: {
          bracket: range.level <= 2 ? 'low' : 
                  range.level === 3 ? 'medium' : 
                  range.level >= 4 ? 'high' : 'executive',
          exemptionAmount: range.level <= 2 ? 100000 : 50000,
          additionalTaxPercent: range.level >= 4 ? 5 : 0
        },
        isActive: true,
        effectiveDate: new Date(),
        description: `${range.name} - Salary range MWK ${range.min.toLocaleString()} to MWK ${range.max.toLocaleString()}`,
        createdBy: adminUserId,
        lastModifiedBy: adminUserId
      });
      
      await grade.save();
      grades[range.level] = grade._id;
      console.log(`   ✅ ${range.name}: MWK ${range.min.toLocaleString()} - MWK ${range.max.toLocaleString()}`);
    }
    
    console.log('\n🔄 Setting up promotion paths...');
    for (let i = 1; i <= salaryRanges.length - 1; i++) {
      const currentGrade = await Grade.findOne({ level: i });
      const nextGrade = await Grade.findOne({ level: i + 1 });
      
      if (currentGrade && nextGrade) {
        currentGrade.promotion = {
          nextGrade: nextGrade._id,
          requiresApproval: true,
          minimumTenure: 12,
          performanceThreshold: 3.5
        };
        await currentGrade.save();
        console.log(`   ✅ ${currentGrade.name} → ${nextGrade.name}`);
      }
    }
    
    console.log(`✅ Created ${Object.keys(grades).length} grades`);
    return grades;
  } catch (error) {
    console.error('❌ Error creating grades:', error);
    throw error;
  }
};

// Create Positions (same as before)
const createPositions = async (employeesData, departments, grades, adminUserId) => {
  try {
    console.log('\n💼 Creating positions...');
    
    const positionGroups = {};
    
    employeesData.forEach(data => {
      const positionName = data.metadata.positionName;
      const salary = data.employeeData.employmentInfo.currentSalary;
      
      if (!positionName) return;
      
      if (!positionGroups[positionName]) {
        positionGroups[positionName] = {
          employees: [],
          totalSalary: 0,
          count: 0
        };
      }
      
      positionGroups[positionName].employees.push(data.employeeData.employeeId);
      positionGroups[positionName].totalSalary += salary;
      positionGroups[positionName].count++;
    });
    
    const positions = {};
    const usedCodes = new Set();
    
    for (const [positionName, data] of Object.entries(positionGroups)) {
      let positionCode;
      let attempts = 0;
      
      do {
        const baseCode = positionName.replace(/[^A-Z0-9]/g, '').substring(0, 4).toUpperCase() || 'POS';
        if (attempts === 0) {
          positionCode = `${baseCode}-001`;
        } else {
          positionCode = `${baseCode.substring(0, 3)}${(attempts + 1).toString().padStart(2, '0')}`;
        }
        attempts++;
        
        if (attempts > 20) {
          positionCode = `POS${Date.now().toString().slice(-6)}`;
          break;
        }
      } while (usedCodes.has(positionCode));
      
      usedCodes.add(positionCode);
      
      const deptName = 'ADMINSTRATION';
      const departmentId = departments[deptName];
      const avgSalary = data.totalSalary / data.count;
      
      const allGrades = await Grade.find().sort({ level: 1 });
      let assignedGrade = allGrades[0]._id;
      
      for (const grade of allGrades) {
        if (avgSalary >= grade.salaryRange.minimum && avgSalary <= grade.salaryRange.maximum) {
          assignedGrade = grade._id;
          break;
        }
      }
      
      let minEducation = 'high_school';
      let minExperience = 1;
      
      if (positionName.includes('DIRECTOR')) {
        minEducation = 'bachelor';
        minExperience = 5;
      } else if (positionName.includes('MANAGER') || positionName.includes('SUPERVISOR')) {
        minEducation = 'diploma';
        minExperience = 3;
      } else if (positionName.includes('CHEF') || positionName.includes('ASSISTANT')) {
        minEducation = 'diploma';
        minExperience = 2;
      }
      
      const position = new Position({
        name: positionName,
        code: positionCode,
        departmentId: departmentId,
        gradeId: assignedGrade,
        jobType: 'full-time',
        workSchedule: {
          type: 'standard',
          hoursPerWeek: 48,
          workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          startTime: '08:00',
          endTime: '17:00'
        },
        description: `${positionName} - Simama Hotel`,
        responsibilities: [
          `Perform ${positionName.toLowerCase()} duties`,
          'Follow hotel policies and procedures',
          'Provide excellent customer service',
          'Maintain work area cleanliness'
        ],
        requirements: {
          education: {
            minimum: minEducation,
            field: 'Any relevant field'
          },
          experience: {
            minimum: minExperience,
            type: 'relevant'
          }
        },
        capacity: {
          total: Math.max(data.count, 5),
          filled: data.count,
          vacant: Math.max(1, 5 - data.count)
        },
        location: {
          type: 'office',
          allowRemote: false,
          remotePercentage: 0
        },
        status: 'active',
        isActive: true,
        priority: positionName.includes('DIRECTOR') ? 'high' : 'medium',
        tags: ['simama-hotel', positionName.toLowerCase().replace(/\s/g, '-')],
        createdBy: adminUserId,
        lastModifiedBy: adminUserId
      });
      
      await position.save();
      positions[positionName] = position._id;
      
      const grade = await Grade.findById(assignedGrade);
      console.log(`   ✅ ${positionName} (${positionCode}): ${data.count} employees, Grade: ${grade.name}`);
    }
    
    console.log(`✅ Created ${Object.keys(positions).length} positions`);
    return positions;
  } catch (error) {
    console.error('❌ Error creating positions:', error);
    throw error;
  }
};

// Create Admin User (same as before)
const createAdminUser = async () => {
  try {
    console.log('\n👑 Creating admin user...');
    
    const adminUser = new User({
      email: 'admin@simamahotel.mw',
      password: 'Admin@123',
      role: 'admin',
      isActive: true
    });
    
    await adminUser.save();
    console.log('   ✅ Created admin user');
    
    return adminUser;
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
};

// Create Employees (updated with better logging)
const createEmployees = async (employeesData, departments, grades, positions, adminUser) => {
  try {
    console.log('\n👥 Creating employees with exact Excel data...');
    
    let createdCount = 0;
    let userCreatedCount = 0;
    
    for (const data of employeesData) {
      try {
        const employeeData = data.employeeData;
        const metadata = data.metadata;
        const positionName = metadata.positionName;
        const positionId = positions[positionName];
        
        if (!positionId) {
          console.log(`   ⚠️ Position not found for: ${positionName}`);
          continue;
        }
        
        const deptName = metadata.departmentName;
        const departmentId = departments[deptName];
        
        if (!departmentId) {
          console.log(`   ⚠️ Department not found for: ${deptName}`);
          continue;
        }
        
        const salary = employeeData.employmentInfo.currentSalary;
        const allGrades = await Grade.find().sort({ level: 1 });
        let gradeId = allGrades[0]._id;
        
        for (const grade of allGrades) {
          if (salary >= grade.salaryRange.minimum && salary <= grade.salaryRange.maximum) {
            gradeId = grade._id;
            break;
          }
        }
        
        employeeData.employmentInfo.positionId = positionId;
        employeeData.employmentInfo.departmentId = departmentId;
        employeeData.employmentInfo.gradeId = gradeId;
        employeeData.createdBy = adminUser._id;
        
        // Create user account
        let user = null;
        try {
          user = new User({
            email: employeeData.personalInfo.email,
            password: 'Welcome@123',
            role: employeeData.employmentInfo.status === 'active' ? 'employee' : 'inactive',
            isActive: employeeData.employmentInfo.status === 'active'
          });
          
          await user.save();
          userCreatedCount++;
          employeeData.userId = user._id;
          
        } catch (userError) {
          console.log(`   ⚠️ User creation skipped for ${employeeData.personalInfo.email}: ${userError.message}`);
        }
        
        // Create employee
        const employee = new Employee(employeeData);
        await employee.save();
        createdCount++;
        
        // Log detailed info for first few employees
        if (createdCount <= 3) {
          console.log(`\n   ✅ Created: ${employeeData.personalInfo.firstName} ${employeeData.personalInfo.lastName}`);
          console.log(`      Gender: ${employeeData.personalInfo.gender}`);
          console.log(`      DOB: ${employeeData.personalInfo.dateOfBirth.toISOString().split('T')[0]}`);
          console.log(`      Position: ${positionName}`);
          console.log(`      Salary: MWK ${salary}`);
          console.log(`      Emergency Contact: ${employeeData.emergencyContact.name} (${employeeData.emergencyContact.relationship})`);
          console.log(`      Emergency Phone: ${employeeData.emergencyContact.phoneNumber}`);
        }
        
        if (createdCount % 10 === 0) {
          console.log(`   📈 Progress: ${createdCount}/${employeesData.length} employees created...`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error creating employee ${data.metadata.excelData.fullName}:`, error.message);
      }
    }
    
    console.log(`\n✅ Created ${createdCount} employees, ${userCreatedCount} users`);
    return { createdCount, userCreatedCount };
  } catch (error) {
    console.error('❌ Error creating employees:', error);
    throw error;
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('🚀 Starting database seeding with accurate data capture...\n');
    
    await connectDB();
    await clearExistingData();
    
    const employeesData = parseExcelData();
    if (employeesData.length === 0) {
      console.error('❌ No data found in Excel file.');
      await mongoose.connection.close();
      process.exit(1);
    }
    
    const adminUser = await createAdminUser();
    const departments = await createDepartments(employeesData, adminUser._id);
    const grades = await createGrades(employeesData, adminUser._id);
    const positions = await createPositions(employeesData, departments, grades, adminUser._id);
    
    await createEmployees(employeesData, departments, grades, positions, adminUser);
    
    // Final verification
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 FINAL VERIFICATION SUMMARY:');
    console.log('==============================');
    
    // Query the database to verify what was actually saved
    const savedEmployees = await Employee.find({})
      .populate('userId', 'email role isActive')
      .populate('employmentInfo.positionId', 'name code')
      .populate('employmentInfo.departmentId', 'name code')
      .populate('employmentInfo.gradeId', 'name level')
      .limit(5);
    
    console.log('\nSample of Saved Employees (verification):');
    console.log('----------------------------------------');
    savedEmployees.forEach(emp => {
      console.log(`\n${emp.personalInfo.firstName} ${emp.personalInfo.lastName}:`);
      console.log(`  Gender: ${emp.personalInfo.gender}`);
      console.log(`  DOB: ${emp.personalInfo.dateOfBirth.toISOString().split('T')[0]}`);
      console.log(`  Position: ${emp.employmentInfo.positionId?.name}`);
      console.log(`  Department: ${emp.employmentInfo.departmentId?.name}`);
      console.log(`  Grade: ${emp.employmentInfo.gradeId?.name} (Level ${emp.employmentInfo.gradeId?.level})`);
      console.log(`  Salary: MWK ${emp.employmentInfo.currentSalary}`);
      console.log(`  Emergency Contact: ${emp.emergencyContact.name} (${emp.emergencyContact.relationship})`);
      console.log(`  Emergency Phone: ${emp.emergencyContact.phoneNumber}`);
      console.log(`  User Account: ${emp.userId?.email} - ${emp.userId?.role}`);
    });
    
    // Get gender statistics from database
    const genderStats = await Employee.aggregate([
      {
        $group: {
          _id: '$personalInfo.gender',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\n📈 Gender Distribution in Database:');
    console.log('----------------------------------');
    genderStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} employees`);
    });
    
    console.log('\n🔑 Login Credentials:');
    console.log('-------------------');
    console.log('• Admin: admin@simamahotel.mw / Admin@123');
    console.log('• Employees: Use their email with password: Welcome@123');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
    process.exit(0);
  }
};

// Run the seeder
seedDatabase();