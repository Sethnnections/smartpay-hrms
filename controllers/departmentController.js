const Department = require('../models/Department');
const Employee = require('../models/Employee');

exports.createDepartment = async (departmentData, createdBy) => {
  try {
    // Validate headOfDepartment if provided
    if (departmentData.headOfDepartment) {
      const employee = await Employee.findById(departmentData.headOfDepartment);
      if (!employee) throw new Error('Head of Department employee not found');
    }

    const department = new Department({
      ...departmentData,
      createdBy
    });

    await department.save();
    return department;
  } catch (error) {
    throw error;
  }
};

exports.updateDepartment = async (id, updateData) => {
  try {
    // Prevent circular references in parentDepartment
    if (updateData.parentDepartment && updateData.parentDepartment === id) {
      throw new Error('Department cannot be its own parent');
    }

    const department = await Department.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('headOfDepartment', 'personalInfo.firstName personalInfo.lastName');

    if (!department) throw new Error('Department not found');
    return department;
  } catch (error) {
    throw error;
  }
};

exports.getDepartmentHierarchy = async () => {
  return await Department.getHierarchy();
};

exports.getDepartmentDetails = async (id) => {
  const department = await Department.findById(id)
    .populate('headOfDepartment', 'personalInfo.firstName personalInfo.lastName employeeId')
    .populate('parentDepartment', 'name code')
    .lean();

  if (!department) throw new Error('Department not found');

  // Get budget utilization statistics
  department.budgetStats = {
    utilization: department.budgetUtilization,
    remaining: department.remainingBudget
  };

  // Count employees in department
  const employeeCount = await Employee.countDocuments({
    'employmentInfo.departmentId': id,
    'employmentInfo.status': 'active'
  });

  return { ...department, employeeCount };
};

exports.allocateBudget = async (id, amount, fiscalYear, currency = 'USD') => {
  const department = await Department.findById(id);
  if (!department) throw new Error('Department not found');

  department.budget = {
    allocated: amount,
    spent: 0,
    fiscalYear,
    currency
  };

  await department.save();
  return department;
};

exports.addDepartmentExpense = async (id, amount, description) => {
  const department = await Department.findById(id);
  if (!department) throw new Error('Department not found');

  await department.addExpense(amount, description);
  return department;
};

exports.listDepartments = async (filters = {}) => {
  const { search, activeOnly = true, minBudget, maxBudget } = filters;

  const query = {};
  if (activeOnly) query.isActive = true;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { tags: { $in: [search.toLowerCase()] } }
    ];
  }
  if (minBudget || maxBudget) {
    query['budget.allocated'] = {};
    if (minBudget) query['budget.allocated'].$gte = Number(minBudget);
    if (maxBudget) query['budget.allocated'].$lte = Number(maxBudget);
  }

  return await Department.find(query)
    .populate('headOfDepartment', 'personalInfo.firstName personalInfo.lastName')
    .sort({ name: 1 });
};