$(document).ready(function() {
    // Initialize Select2 dropdowns
    $('.select2').select2({
        theme: 'bootstrap-5'
    });

    // Load departments and grades for dropdowns
    loadDepartments();
    loadGrades();

    // Load positions on page load
    loadPositions();

    // Form submission for adding new position
    $('#addPositionForm').submit(async function(e) {
        e.preventDefault();
        await createPosition();
    });

    // Form submission for updating position
    $('#editPositionForm').submit(async function(e) {
        e.preventDefault();
        await updatePosition();
    });

    // Initialize tabs
    $('[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
        const target = $(e.target).attr('href');
        if (target === '#position-details') {
            loadPositionDetails(currentPositionId);
        } else if (target === '#position-hierarchy') {
            loadPositionHierarchy(currentPositionId);
        } else if (target === '#position-statistics') {
            loadPositionStatistics(currentPositionId);
        }
    });
});

let currentPositionId = null;

// Load departments for dropdown
async function loadDepartments() {
    try {
        const response = await fetch('/api/departments');
        const departments = await response.json();
        
        const departmentSelect = $('#departmentId');
        departmentSelect.empty();
        departmentSelect.append('<option value="">Select Department</option>');
        
        departments.forEach(dept => {
            departmentSelect.append(`<option value="${dept._id}">${dept.name} (${dept.code})</option>`);
        });
        
        // Also populate in edit form
        const editDeptSelect = $('#editDepartmentId');
        editDeptSelect.empty();
        editDeptSelect.append('<option value="">Select Department</option>');
        departments.forEach(dept => {
            editDeptSelect.append(`<option value="${dept._id}">${dept.name} (${dept.code})</option>`);
        });
    } catch (error) {
        showAlert('Failed to load departments', 'danger');
    }
}

// Load grades for dropdown
async function loadGrades() {
    try {
        const response = await fetch('/api/grades');
        const grades = await response.json();
        
        const gradeSelect = $('#gradeId');
        gradeSelect.empty();
        gradeSelect.append('<option value="">Select Grade</option>');
        
        grades.forEach(grade => {
            gradeSelect.append(`<option value="${grade._id}">${grade.name} (Level ${grade.level})</option>`);
        });
        
        // Also populate in edit form
        const editGradeSelect = $('#editGradeId');
        editGradeSelect.empty();
        editGradeSelect.append('<option value="">Select Grade</option>');
        grades.forEach(grade => {
            editGradeSelect.append(`<option value="${grade._id}">${grade.name} (Level ${grade.level})</option>`);
        });
    } catch (error) {
        showAlert('Failed to load grades', 'danger');
    }
}

// Load positions with optional filters
async function loadPositions(filters = {}) {
    try {
        showLoading();
        
        // Build query string from filters
        const queryParams = new URLSearchParams();
        if (filters.search) queryParams.append('search', filters.search);
        if (filters.departmentId) queryParams.append('departmentId', filters.departmentId);
        if (filters.gradeId) queryParams.append('gradeId', filters.gradeId);
        if (filters.hasVacancies) queryParams.append('hasVacancies', filters.hasVacancies);
        if (filters.isActive !== undefined) queryParams.append('isActive', filters.isActive);
        
        const response = await fetch(`/api/positions?${queryParams.toString()}`);
        const positions = await response.json();
        
        renderPositionsTable(positions);
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert('Failed to load positions', 'danger');
    }
}

// Render positions in table
function renderPositionsTable(positions) {
    const tableBody = $('#positionsTable tbody');
    tableBody.empty();
    
    if (positions.length === 0) {
        tableBody.append(`
            <tr>
                <td colspan="9" class="text-center py-4">No positions found</td>
            </tr>
        `);
        return;
    }
    
    positions.forEach(position => {
        const vacancyRate = position.vacancyRate || 0;
        const vacancyClass = vacancyRate > 50 ? 'danger' : vacancyRate > 20 ? 'warning' : 'success';
        
        tableBody.append(`
            <tr data-id="${position._id}">
                <td>${position.code}</td>
                <td>${position.name}</td>
                <td>${position.department?.name || 'N/A'}</td>
                <td>${position.grade?.name || 'N/A'}</td>
                <td>${position.capacity?.total || 0}</td>
                <td>${position.capacity?.filled || 0}</td>
                <td>
                    <span class="badge bg-${vacancyClass}">
                        ${vacancyRate}% (${position.capacity?.vacant || 0})
                    </span>
                </td>
                <td>
                    <span class="badge ${position.isActive ? 'bg-success' : 'bg-secondary'}">
                        ${position.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            Actions
                        </button>
                        <ul class="dropdown-menu">
                            <li>
                                <a class="dropdown-item view-position" href="#" data-id="${position._id}">
                                    <i class="fas fa-eye me-2"></i>View
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item edit-position" href="#" data-id="${position._id}">
                                    <i class="fas fa-edit me-2"></i>Edit
                                </a>
                            </li>
                            ${position.isActive ? `
                            <li>
                                <a class="dropdown-item deactivate-position" href="#" data-id="${position._id}">
                                    <i class="fas fa-ban me-2"></i>Deactivate
                                </a>
                            </li>
                            ` : ''}
                        </ul>
                    </div>
                </td>
            </tr>
        `);
    });
    
    // Add event listeners to action buttons
    $('.view-position').click(function(e) {
        e.preventDefault();
        const positionId = $(this).data('id');
        showPositionDetails(positionId);
    });
    
    $('.edit-position').click(function(e) {
        e.preventDefault();
        const positionId = $(this).data('id');
        showEditPositionModal(positionId);
    });
    
    $('.deactivate-position').click(function(e) {
        e.preventDefault();
        const positionId = $(this).data('id');
        deactivatePosition(positionId);
    });
}

// Create new position
async function createPosition() {
    try {
        showLoading();
        
        const formData = {
            name: $('#name').val(),
            code: $('#code').val(),
            departmentId: $('#departmentId').val(),
            gradeId: $('#gradeId').val(),
            reportingTo: $('#reportingTo').val() || null,
            jobType: $('#jobType').val(),
            description: $('#description').val(),
            responsibilities: $('#responsibilities').val().split('\n').filter(r => r.trim()),
            capacity: {
                total: parseInt($('#capacityTotal').val()) || 1
            },
            requirements: {
                education: {
                    minimum: $('#educationMinimum').val(),
                    preferred: $('#educationPreferred').val() || null,
                    field: $('#educationField').val() || null
                },
                experience: {
                    minimum: parseInt($('#experienceMinimum').val()) || 0,
                    preferred: parseInt($('#experiencePreferred').val()) || null,
                    type: $('#experienceType').val()
                }
            }
        };
        
        const response = await fetch('/api/positions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create position');
        }
        
        const position = await response.json();
        
        $('#addPositionModal').modal('hide');
        $('#addPositionForm')[0].reset();
        showAlert('Position created successfully!', 'success');
        loadPositions();
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'danger');
    }
}

// Show position details in modal
async function showPositionDetails(positionId) {
    try {
        showLoading();
        currentPositionId = positionId;
        
        const response = await fetch(`/api/positions/${positionId}`);
        const position = await response.json();
        
        // Set basic info
        $('#positionName').text(position.name);
        $('#positionCode').text(position.fullCode || position.code);
        $('#positionDepartment').text(position.department?.name || 'N/A');
        $('#positionGrade').text(position.grade?.name || 'N/A');
        $('#positionStatus').html(`
            <span class="badge ${position.isActive ? 'bg-success' : 'bg-secondary'}">
                ${position.isActive ? 'Active' : 'Inactive'}
            </span>
        `);
        
        // Set capacity info
        $('#positionCapacityTotal').text(position.capacity.total);
        $('#positionCapacityFilled').text(position.capacity.filled);
        $('#positionCapacityVacant').text(position.capacity.vacant);
        $('#positionVacancyRate').text(`${position.vacancyRate}%`);
        $('#positionOccupancyRate').text(`${position.occupancyRate}%`);
        
        // Set description
        $('#positionDescription').text(position.description || 'No description provided');
        
        // Set requirements
        $('#positionEducation').html(`
            <strong>Minimum:</strong> ${formatEducationLevel(position.requirements.education.minimum)}<br>
            ${position.requirements.education.preferred ? `<strong>Preferred:</strong> ${formatEducationLevel(position.requirements.education.preferred)}<br>` : ''}
            ${position.requirements.education.field ? `<strong>Field:</strong> ${position.requirements.education.field}` : ''}
        `);
        
        $('#positionExperience').html(`
            <strong>Minimum:</strong> ${position.requirements.experience.minimum} years<br>
            ${position.requirements.experience.preferred ? `<strong>Preferred:</strong> ${position.requirements.experience.preferred} years<br>` : ''}
            <strong>Type:</strong> ${formatExperienceType(position.requirements.experience.type)}
        `);
        
        // Set compensation
        if (position.effectiveSalary) {
            $('#positionSalary').html(`
                <strong>Base Salary:</strong> $${position.effectiveSalary.baseSalary.toLocaleString()}<br>
                <strong>Total Allowances:</strong> $${position.effectiveSalary.totalAllowances.toLocaleString()}<br>
                <strong>Gross Salary:</strong> $${position.effectiveSalary.grossSalary.toLocaleString()}
            `);
        } else {
            $('#positionSalary').text('Salary information not available');
        }
        
        // Show the modal
        $('#positionDetailsModal').modal('show');
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert('Failed to load position details', 'danger');
    }
}

// Load position details for edit form
async function showEditPositionModal(positionId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/positions/${positionId}`);
        const position = await response.json();
        
        // Fill form fields
        $('#editName').val(position.name);
        $('#editCode').val(position.code);
        $('#editDepartmentId').val(position.departmentId).trigger('change');
        $('#editGradeId').val(position.gradeId).trigger('change');
        $('#editReportingTo').val(position.reportingTo || '').trigger('change');
        $('#editJobType').val(position.jobType);
        $('#editDescription').val(position.description);
        $('#editResponsibilities').val(position.responsibilities?.join('\n') || '');
        $('#editCapacityTotal').val(position.capacity.total);
        
        // Requirements
        $('#editEducationMinimum').val(position.requirements.education.minimum);
        $('#editEducationPreferred').val(position.requirements.education.preferred || '');
        $('#editEducationField').val(position.requirements.education.field || '');
        $('#editExperienceMinimum').val(position.requirements.experience.minimum);
        $('#editExperiencePreferred').val(position.requirements.experience.preferred || '');
        $('#editExperienceType').val(position.requirements.experience.type);
        
        // Set position ID in hidden field
        $('#editPositionId').val(positionId);
        
        // Show the modal
        $('#editPositionModal').modal('show');
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert('Failed to load position for editing', 'danger');
    }
}

// Update position
async function updatePosition() {
    try {
        showLoading();
        
        const positionId = $('#editPositionId').val();
        const formData = {
            name: $('#editName').val(),
            code: $('#editCode').val(),
            departmentId: $('#editDepartmentId').val(),
            gradeId: $('#editGradeId').val(),
            reportingTo: $('#editReportingTo').val() || null,
            jobType: $('#editJobType').val(),
            description: $('#editDescription').val(),
            responsibilities: $('#editResponsibilities').val().split('\n').filter(r => r.trim()),
            capacity: {
                total: parseInt($('#editCapacityTotal').val()) || 1
            },
            requirements: {
                education: {
                    minimum: $('#editEducationMinimum').val(),
                    preferred: $('#editEducationPreferred').val() || null,
                    field: $('#editEducationField').val() || null
                },
                experience: {
                    minimum: parseInt($('#editExperienceMinimum').val()) || 0,
                    preferred: parseInt($('#editExperiencePreferred').val()) || null,
                    type: $('#editExperienceType').val()
                }
            }
        };
        
        const response = await fetch(`/api/positions/${positionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update position');
        }
        
        const position = await response.json();
        
        $('#editPositionModal').modal('hide');
        showAlert('Position updated successfully!', 'success');
        loadPositions();
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'danger');
    }
}

// Deactivate position
async function deactivatePosition(positionId) {
    try {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "This will deactivate the position and it will no longer be available for new hires.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, deactivate it!'
        });
        
        if (!result.isConfirmed) return;
        
        showLoading();
        
        const response = await fetch(`/api/positions/${positionId}/deactivate`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to deactivate position');
        }
        
        showAlert('Position deactivated successfully!', 'success');
        loadPositions();
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'danger');
    }
}

// Load position hierarchy
async function loadPositionHierarchy(positionId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/positions/${positionId}/hierarchy`);
        const hierarchy = await response.json();
        
        const hierarchyContainer = $('#positionHierarchy');
        hierarchyContainer.empty();
        
        if (hierarchy.length === 0) {
            hierarchyContainer.append('<p>No hierarchy information available</p>');
            return;
        }
        
        let html = '<div class="org-hierarchy">';
        
        hierarchy.forEach((position, index) => {
            const isCurrent = index === hierarchy.length - 1;
            const levelClass = `level-${position.level}`;
            
            html += `
                <div class="org-node ${levelClass} ${isCurrent ? 'current' : ''}">
                    <div class="org-node-content">
                        <h5>${position.name}</h5>
                        <p class="text-muted">${position.code}</p>
                    </div>
                </div>
            `;
            
            if (index < hierarchy.length - 1) {
                html += '<div class="org-connector"></div>';
            }
        });
        
        html += '</div>';
        hierarchyContainer.append(html);
        hideLoading();
    } catch (error) {
        hideLoading();
        hierarchyContainer.append('<p>Failed to load hierarchy</p>');
    }
}

// Load position statistics
async function loadPositionStatistics(positionId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/positions/${positionId}/statistics`);
        const stats = await response.json();
        
        // Update statistics display
        $('#statCapacityTotal').text(stats.capacity.total);
        $('#statCapacityFilled').text(stats.capacity.filled);
        $('#statCapacityVacant').text(stats.capacity.vacant);
        $('#statOccupancyRate').text(`${stats.occupancyRate}%`);
        $('#statVacancyRate').text(`${stats.vacancyRate}%`);
        $('#statActiveEmployees').text(stats.activeEmployees);
        $('#statTotalEmployees').text(stats.totalEmployees);
        $('#statAvgTenure').text(stats.averageTenure.toFixed(1));
        
        // Render chart
        renderStatisticsChart(stats);
        hideLoading();
    } catch (error) {
        hideLoading();
        $('#positionStatistics').append('<p>Failed to load statistics</p>');
    }
}

// Render statistics chart
function renderStatisticsChart(stats) {
    const ctx = $('#statsChart')[0].getContext('2d');
    
    // Destroy previous chart if exists
    if (window.statsChart) {
        window.statsChart.destroy();
    }
    
    window.statsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Total', 'Filled', 'Vacant'],
            datasets: [{
                label: 'Capacity',
                data: [stats.capacity.total, stats.capacity.filled, stats.capacity.vacant],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(255, 99, 132, 0.5)'
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Helper functions
function formatEducationLevel(level) {
    const levels = {
        'high_school': 'High School',
        'diploma': 'Diploma',
        'bachelor': "Bachelor's Degree",
        'master': "Master's Degree",
        'phd': 'PhD'
    };
    return levels[level] || level;
}

function formatExperienceType(type) {
    const types = {
        'any': 'Any',
        'relevant': 'Relevant',
        'management': 'Management',
        'technical': 'Technical',
        'leadership': 'Leadership'
    };
    return types[type] || type;
}

function showAlert(message, type) {
    const alertsContainer = $('#alertsContainer');
    const alert = $(`
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `);
    
    alertsContainer.append(alert);
    setTimeout(() => alert.alert('close'), 5000);
}

function showLoading() {
    $('#loadingOverlay').fadeIn();
}

function hideLoading() {
    $('#loadingOverlay').fadeOut();
}

// Apply filters
$('#applyFilters').click(function() {
    const filters = {
        search: $('#searchInput').val(),
        departmentId: $('#filterDepartment').val(),
        gradeId: $('#filterGrade').val(),
        hasVacancies: $('#filterVacancies').is(':checked'),
        isActive: $('#filterActive').is(':checked')
    };
    
    loadPositions(filters);
});

// Reset filters
$('#resetFilters').click(function() {
    $('#searchInput').val('');
    $('#filterDepartment').val('').trigger('change');
    $('#filterGrade').val('').trigger('change');
    $('#filterVacancies').prop('checked', false);
    $('#filterActive').prop('checked', true);
    
    loadPositions();
});