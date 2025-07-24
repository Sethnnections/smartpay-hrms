const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import all models
const User = require('./User');
const Department = require('./Department');
const Grade = require('./Grade');
const Position = require('./Position');
const Employee = require('./Employee');
const Payroll = require('./Payroll');

// Model registry for easy access
const models = {
  User,
  Department,
  Grade,
  Position,
  Employee,
  Payroll
};

// Helper function to get model by name
const getModel = (modelName) => {
  if (models[modelName]) {
    return models[modelName];
  }
  throw new Error(`Model ${modelName} not found`);
};

// Database connection helper
const connectDatabase = async (uri, options = {}) => {
  try {
    const defaultOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
    };

    const finalOptions = { ...defaultOptions, ...options };

    await mongoose.connect(uri, finalOptions);
    console.log('✅ Database connected successfully');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ Database connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ Database disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ Database reconnected');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed due to application termination');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error closing database connection:', error);
        process.exit(1);
      }
    });

    return mongoose.connection;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Initialize default admin user
const initializeAdmin = async (adminData = {}) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash(
        adminData.password || process.env.ADMIN_PASSWORD || 'SmartPay@2025', 
        12
      );

      const defaultAdmin = {
        email: adminData.email || process.env.ADMIN_EMAIL || 'admin@smartpay.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        ...adminData
      };

      const admin = await User.create(defaultAdmin);
      console.log('✅ Default admin user created:', admin.email);
      return admin;
    } else {
      console.log('ℹ️ Admin user already exists');
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
};

// Seed sample data for development
const seedSampleData = async () => {
  try {
    // Check if data already exists
    const departmentCount = await Department.countDocuments();
    if (departmentCount > 0) {
      console.log('ℹ️ Sample data already exists');
      return;
    }

    console.log('🌱 Seeding sample data...');

    // Get admin user for createdBy fields
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      throw new Error('Admin user not found for seeding');
    }

    // Create sample departments
    const departments = await Department.insertMany([
      {
        name: 'Human Resources',
        code: 'HR001',
        description: 'Manages employee relations and organizational development',
        createdBy: admin._id
      },
      {
        name: 'Information Technology',
        code: 'IT001',
        description: 'Manages technology infrastructure and systems',
        createdBy: admin._id
      },
      {
        name: 'Finance',
        code: 'FIN001',
        description: 'Manages financial operations and accounting',
        createdBy: admin._id
      },
      {
        name: 'Marketing',
        code: 'MKT001',
        description: 'Manages marketing and promotional activities',
        createdBy: admin._id
      }
    ]);

    // Create sample grades
    const grades = await Grade.insertMany([
      {
        name: 'Entry Level',
        code: 'ENT01',
        level: 1,
        baseSalary: 35000,
        salaryRange: { minimum: 30000, maximum: 40000 },
        payrollSettings: {
          payeePercent: 15,
          pensionPercent: 8,
          overtimeRate: 25,
          overtimeMultiplier: 1.5
        },
        allowances: {
          transport: 200,
          housing: 500,
          medical: 150,
          meals: 100,
          communication: 50,
          other: 0
        },
        createdBy: admin._id
      },
      {
        name: 'Mid Level',
        code: 'MID01',
        level: 2,
        baseSalary: 55000,
        salaryRange: { minimum: 50000, maximum: 65000 },
        payrollSettings: {
          payeePercent: 20,
          pensionPercent: 10,
          overtimeRate: 35,
          overtimeMultiplier: 1.5
        },
        allowances: {
          transport: 300,
          housing: 800,
          medical: 250,
          meals: 150,
          communication: 100,
          other: 0
        },
        createdBy: admin._id
      },
      {
        name: 'Senior Level',
        code: 'SEN01',
        level: 3,
        baseSalary: 85000,
        salaryRange: { minimum: 75000, maximum: 95000 },
        payrollSettings: {
          payeePercent: 25,
          pensionPercent: 12,
          overtimeRate: 50,
          overtimeMultiplier: 1.5
        },
        allowances: {
          transport: 500,
          housing: 1200,
          medical: 400,
          meals: 200,
          communication: 150,
          other: 100
        },
        createdBy: admin._id
      }
    ]);

    // Create sample positions
    const positions = await Position.insertMany([
      {
        name: 'HR Assistant',
        code: 'HRA001',
        departmentId: departments[0]._id,
        gradeId: grades[0]._id,
        description: 'Assists with HR operations and employee onboarding',
        responsibilities: [
          'Process employee documentation',
          'Assist with recruitment activities',
          'Maintain employee records'
        ],
        requirements: {
          education: {
            minimum: 'bachelor',
            field: 'Human Resources or related field'
          },
          experience: {
            minimum: 1,
            type: 'relevant'
          },
          skills: [
            { name: 'Communication', level: 'intermediate', required: true },
            { name: 'MS Office', level: 'intermediate', required: true }
          ]
        },
        createdBy: admin._id
      },
      {
        name: 'Software Developer',
        code: 'DEV001',
        departmentId: departments[1]._id,
        gradeId: grades[1]._id,
        description: 'Develops and maintains software applications',
        responsibilities: [
          'Write clean, maintainable code',
          'Participate in code reviews',
          'Debug and fix software issues'
        ],
        requirements: {
          education: {
            minimum: 'bachelor',
            field: 'Computer Science or related field'
          },
          experience: {
            minimum: 2,
            type: 'technical'
          },
          skills: [
            { name: 'JavaScript', level: 'advanced', required: true },
            { name: 'Node.js', level: 'intermediate', required: true },
            { name: 'MongoDB', level: 'intermediate', required: false }
          ]
        },
        createdBy: admin._id
      },
      {
        name: 'Finance Manager',
        code: 'FINMGR001',
        departmentId: departments[2]._id,
        gradeId: grades[2]._id,
        description: 'Manages financial operations and reporting',
        responsibilities: [
          'Prepare financial statements',
          'Manage budgeting process',
          'Oversee accounting operations'
        ],
        requirements: {
          education: {
            minimum: 'bachelor',
            field: 'Finance or Accounting'
          },
          experience: {
            minimum: 5,
            type: 'management'
          },
          skills: [
            { name: 'Financial Analysis', level: 'advanced', required: true },
            { name: 'Excel', level: 'advanced', required: true },
            { name: 'Accounting Software', level: 'intermediate', required: true }
          ]
        },
        createdBy: admin._id
      }
    ]);

    // Create sample employees
    const employees = await Employee.insertMany([
      {
        employeeId: 'EMP00001',
        userId: admin._id,
        personalInfo: {
          firstName: 'System',
          lastName: 'Administrator',
          dateOfBirth: new Date(1985, 0, 1),
          gender: 'male',
          maritalStatus: 'married',
          nationality: 'American',
          phoneNumber: '+1234567890',
          email: admin.email,
          address: {
            street: '123 Admin St',
            city: 'Techville',
            state: 'CA',
            zipCode: '12345',
            country: 'United States'
          }
        },
        employmentInfo: {
          positionId: positions[2]._id,
          departmentId: departments[2]._id,
          gradeId: grades[2]._id,
          startDate: new Date(2020, 0, 1),
          employmentType: 'full-time',
          status: 'active',
          currentSalary: 90000
        },
        bankInfo: {
          bankName: 'National Bank',
          accountNumber: '1234567890',
          accountName: 'System Administrator'
        },
        createdBy: admin._id
      },
      {
        employeeId: 'EMP00002',
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date(1990, 5, 15),
          gender: 'male',
          maritalStatus: 'single',
          nationality: 'American',
          phoneNumber: '+1987654321',
          email: 'john.doe@example.com',
          address: {
            street: '456 Developer Ave',
            city: 'Techville',
            state: 'CA',
            zipCode: '12345',
            country: 'United States'
          }
        },
        employmentInfo: {
          positionId: positions[1]._id,
          departmentId: departments[1]._id,
          gradeId: grades[1]._id,
          startDate: new Date(2021, 3, 15),
          employmentType: 'full-time',
          status: 'active',
          currentSalary: 60000
        },
        bankInfo: {
          bankName: 'Tech Credit Union',
          accountNumber: '9876543210',
          accountName: 'John Doe'
        },
        createdBy: admin._id
      }
    ]);

    // Update admin user with employee reference
    await User.findByIdAndUpdate(admin._id, { employeeId: employees[0]._id });

    console.log('✅ Sample data seeded successfully');
    console.log(`   - ${departments.length} departments created`);
    console.log(`   - ${grades.length} grades created`);
    console.log(`   - ${positions.length} positions created`);
    console.log(`   - ${employees.length} employees created`);

  } catch (error) {
    console.error('❌ Error seeding sample data:', error);
    throw error;
  }
};

// Database cleanup utility
const cleanupDatabase = async (confirm = false) => {
  if (!confirm) {
    throw new Error('Database cleanup requires explicit confirmation');
  }

  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      await mongoose.connection.db.collection(collection.name).deleteMany({});
    }
    
    console.log('🧹 Database cleaned successfully');
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    throw error;
  }
};

// Get database statistics
const getDatabaseStats = async () => {
  try {
    const stats = {};
    
    for (const [modelName, Model] of Object.entries(models)) {
      stats[modelName] = await Model.countDocuments();
    }
    
    stats.dbStats = await mongoose.connection.db.stats();
    return stats;
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    throw error;
  }
};

// Model validation utility
const validateModel = async (ModelClass, data) => {
  try {
    const instance = new ModelClass(data);
    await instance.validate();
    return { valid: true, errors: null };
  } catch (error) {
    return { valid: false, errors: error.errors };
  }
};

// Export everything
module.exports = {
  // Models
  User,
  Department,
  Grade,
  Position,
  Employee,
  Payroll,
  
  // Model registry
  models,
  getModel,
  
  // Database utilities
  connectDatabase,
  initializeAdmin,
  seedSampleData,
  cleanupDatabase,
  getDatabaseStats,
  validateModel,
  
  // Mongoose instance for direct access if needed
  mongoose
};