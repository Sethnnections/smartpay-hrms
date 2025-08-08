const Position = require('../models/Position');
const Department = require('../models/Department');
const Grade = require('../models/Grade');
const Employee = require('../models/Employee');


exports.createPosition = async (positionData, createdBy) => {
  try {
     const [department, grade] = await Promise.all([
      Department.findById(positionData.departmentId),
      Grade.findById(positionData.gradeId)
    ]);

    if (!department) throw new Error('Department not found');
    if (!grade) throw new Error('Grade not found');
    
    // Validate reportingTo if provided
    if (positionData.reportingTo) {
      const reportingPosition = await Position.findById(positionData.reportingTo);
      if (!reportingPosition) throw new Error('Reporting position not found');
    } else {
      positionData.reportingTo = null; // Ensure it's null if empty
    }

    // Ensure requirements object is properly structured
    if (!positionData.requirements) {
      positionData.requirements = {
        education: {},
        experience: {}
      };
    }

    const position = new Position({
      ...positionData,
      createdBy
    });

    await position.save();
    return position;
  } catch (error) {
    error.statusCode = 400;
    console.error('Error creating position:', error);
    if (error.name === 'ValidationError') {
      throw new Error('Invalid position data');
    }
    throw error;
  }
};

// Get position details
exports.getPositionDetails = async (id) => {
  const position = await Position.findById(id)
    .populate('department', 'name code')
    .populate('grade', 'name code level')
    .populate('reportingTo', 'name code')
    .lean();

  if (!position) throw new Error('Position not found');
  
  // Calculate effective salary
  const populatedPosition = await Position.findById(id).populate('grade');
  position.effectiveSalary = await populatedPosition.getEffectiveSalary();
  
  return position;
};

// Update position
exports.updatePosition = async (id, updateData, modifiedBy) => {
  try {
    // Validate department if being updated
    if (updateData.departmentId) {
      const department = await Department.findById(updateData.departmentId);
      if (!department) throw new Error('Department not found');
    }

    // Validate grade if being updated
    if (updateData.gradeId) {
      const grade = await Grade.findById(updateData.gradeId);
      if (!grade) throw new Error('Grade not found');
    }

    // Validate reportingTo if being updated
    if (updateData.reportingTo) {
      const reportingPosition = await Position.findById(updateData.reportingTo);
      if (!reportingPosition) throw new Error('Reporting position not found');
      
      // Prevent circular references
      if (updateData.reportingTo === id) {
        throw new Error('Position cannot report to itself');
      }
    }

    const position = await Position.findByIdAndUpdate(
      id,
      { ...updateData, lastModifiedBy: modifiedBy },
      { new: true, runValidators: true }
    ).populate('department grade reportingTo');

    if (!position) throw new Error('Position not found');
    return position;
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
};

// List positions with filters
exports.listPositions = async (filters = {}) => {
  const { 
    search, 
    departmentId, 
    gradeId, 
    isActive = true,
    hasVacancies = false 
  } = filters;

  const query = { isActive };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }

  if (departmentId) query.departmentId = departmentId;
  if (gradeId) query.gradeId = gradeId;
  if (hasVacancies) query['capacity.vacant'] = { $gt: 0 };

  return await Position.find(query)
    .populate('department', 'name code')
    .populate('grade', 'name code level')
    .sort({ name: 1 });
};

// Get position hierarchy
exports.getPositionHierarchy = async (id) => {
  const position = await Position.findById(id);
  if (!position) throw new Error('Position not found');
  
  return await position.getHierarchy();
};

// Update position capacity
exports.updatePositionCapacity = async (id, change) => {
  const position = await Position.findById(id);
  if (!position) throw new Error('Position not found');

  position.capacity.filled = Math.max(0, position.capacity.filled + change);
  position.capacity.vacant = Math.max(0, position.capacity.total - position.capacity.filled);
  
  await position.save();
  return position;
};

// Get position statistics
exports.getPositionStatistics = async (id) => {
  const position = await Position.findById(id);
  if (!position) throw new Error('Position not found');
  
  return await position.getStatistics();
};

// Deactivate position
exports.deactivatePosition = async (id) => {
  const position = await Position.findById(id);
  if (!position) throw new Error('Position not found');

  // Check if position has active employees
  const activeEmployees = await Employee.countDocuments({
    'employmentInfo.positionId': id,
    'employmentInfo.status': 'active'
  });

  if (activeEmployees > 0) {
    throw new Error('Cannot deactivate position with active employees');
  }

  position.isActive = false;
  position.status = 'discontinued';
  await position.save();
  return position;
};