const Grade = require('../models/Grade');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

// Helper function to validate promotion path
const validatePromotionPath = async (gradeData, isUpdate = false, currentGradeId = null) => {
  if (gradeData.promotion?.nextGrade) {
    // Check if next grade exists
    const nextGrade = await Grade.findById(gradeData.promotion.nextGrade);
    if (!nextGrade) {
      throw new Error(`Next grade with ID ${gradeData.promotion.nextGrade} not found`);
    }

    // Check if trying to promote to same grade
    if (isUpdate && gradeData.promotion.nextGrade === currentGradeId) {
      throw new Error('Grade cannot promote to itself');
    }

    // Check level hierarchy
    if (gradeData.level && nextGrade.level <= gradeData.level) {
      throw new Error('Promotion next grade must be higher level than current grade');
    }
  }
};

// Create new grade
exports.createGrade = async (gradeData, createdBy) => {
  try {
    // For first grade creation, skip promotion validation
    const gradeCount = await Grade.countDocuments();
    
    if (gradeCount > 0) {
      await validatePromotionPath(gradeData);
    } else if (gradeData.promotion?.nextGrade) {
      // If first grade but has nextGrade specified, remove it
      delete gradeData.promotion.nextGrade;
    }

    const grade = new Grade({
      ...gradeData,
      createdBy
    });

    await grade.save();
    return grade;
  } catch (error) {
    error.statusCode = error.message.includes('not found') ? 404 : 400;
    throw error;
  }
};

// Update existing grade
exports.updateGrade = async (id, updateData, modifiedBy) => {
  try {
    await validatePromotionPath(updateData, true, id);

    const grade = await Grade.findByIdAndUpdate(
      id,
      { ...updateData, lastModifiedBy: modifiedBy },
      { new: true, runValidators: true }
    );

    if (!grade) throw new Error('Grade not found');
    return grade;
  } catch (error) {
    error.statusCode = error.message.includes('not found') ? 404 : 400;
    throw error;
  }
};

// Get grade details
exports.getGradeDetails = async (id) => {
  const grade = await Grade.findById(id)
    .populate('promotion.nextGrade', 'name code level')
    .lean();

  if (!grade) throw new Error('Grade not found');
  return grade;
};

// List grades with filters
exports.listGrades = async (filters = {}) => {
  const { search, activeOnly = true, minLevel, maxLevel, minSalary, maxSalary } = filters;

  console.log('Received filters:', filters); // Debug log

  const query = {};
  
  // Only add isActive if explicitly requested
  if (activeOnly) query.isActive = true;
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (minLevel || maxLevel) {
    query.level = {};
    if (minLevel) query.level.$gte = Number(minLevel);
    if (maxLevel) query.level.$lte = Number(maxLevel);
  }

  console.log('Final query:', query); // Debug log

  const results = await Grade.find(query)
    .sort({ level: 1 })
    .populate('promotion.nextGrade', 'name code level');

  console.log('Query results:', results); // Debug log
  return results;
};
// Calculate salary breakdown
exports.calculateSalary = async (id, overtimeHours = 0) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');
  return grade.calculateNetSalary(overtimeHours);
};

// Check promotion eligibility
exports.checkPromotionEligibility = async (gradeId, employeeId) => {
  const grade = await Grade.findById(gradeId);
  if (!grade) throw new Error('Grade not found');

  const employee = await Employee.findById(employeeId);
  if (!employee) throw new Error('Employee not found');

  return grade.checkPromotionEligibility(employee);
};

// Initialize grade hierarchy (special method for first-time setup)
exports.initializeGradeHierarchy = async (gradesData, createdBy) => {
  try {
    // Remove the session/transaction code
    const createdGrades = [];
    const sortedGrades = [...gradesData].sort((a, b) => b.level - a.level);

    for (let i = 0; i < sortedGrades.length; i++) {
      const gradeData = sortedGrades[i];
      
      if (i > 0) {
        gradeData.promotion = {
          ...gradeData.promotion,
          nextGrade: createdGrades[i-1]._id
        };
      }

      const grade = new Grade({
        ...gradeData,
        createdBy
      });

      await grade.save(); // No session
      createdGrades.push(grade);
    }

    return createdGrades.reverse();
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
};

exports.deactivateGrade = async (id) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');

  // Check if grade has active employees
  const activeEmployees = await Employee.countDocuments({
    'employmentInfo.gradeId': id,
    'employmentInfo.status': 'active'
  });

  if (activeEmployees > 0) {
    throw new Error('Cannot deactivate grade with active employees');
  }

  grade.isActive = false;
  await grade.save();
  return grade;
};

exports.getGradeHierarchy = async () => {
  return await Grade.getHierarchy();
};

exports.addBenefit = async (id, benefitData) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');

  grade.benefits.push(benefitData);
  await grade.save();
  return grade;
};

exports.updateBenefit = async (id, benefitId, updateData) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');

  const benefit = grade.benefits.id(benefitId);
  if (!benefit) throw new Error('Benefit not found');

  benefit.set(updateData);
  await grade.save();
  return grade;
};

exports.removeBenefit = async (id, benefitId) => {
  const grade = await Grade.findById(id);
  if (!grade) throw new Error('Grade not found');

  grade.benefits.pull(benefitId);
  await grade.save();
  return grade;
};