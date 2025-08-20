$(document).ready(function() {
    console.log('Document ready, initializing...');
    
    // Load departments and grades first, then initialize Select2
    loadDepartmentsAndGrades().then(() => {
        console.log('Departments and grades loaded, initializing Select2...');
        
        // Initialize Select2 dropdowns after data is loaded
        $('.select2').select2({
            theme: 'bootstrap-5',
            width: '100%'
        });
        
        console.log('Select2 initialized');
    });

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

    // Reinitialize Select2 when modals are shown
    $('#addPositionModal').on('shown.bs.modal', function() {
        console.log('Add position modal opened, reinitializing Select2...');
        $(this).find('.select2').select2({
            theme: 'bootstrap-5',
            width: '100%',
            dropdownParent: $('#addPositionModal')
        });
    });

    $('#editPositionModal').on('shown.bs.modal', function() {
        console.log('Edit position modal opened, reinitializing Select2...');
        $(this).find('.select2').select2({
            theme: 'bootstrap-5',
            width: '100%',
            dropdownParent: $('#editPositionModal')
        });
    });

    // Initialize tooltips for action buttons
    $('[data-bs-toggle="tooltip"]').tooltip();
});

// Load both departments and grades
async function loadDepartmentsAndGrades() {
    try {
        await Promise.all([
            loadDepartments(),
            loadGrades()
        ]);
        console.log('All dropdowns loaded successfully');
    } catch (error) {
        console.error('Error loading dropdown data:', error);
        showAlert('Failed to load dropdown data', 'danger');
    }
}

let currentPositionId = null;
let positionsTable = null;

// Get auth token
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Get auth headers
function getAuthHeaders() {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// Load departments for dropdown
async function loadDepartments() {
    try {
        console.log('Loading departments...');
        const response = await fetch('/api/departments');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const departments = await response.json();
        console.log('Departments loaded:', departments);
        
        // Check if departments is an array
        if (!Array.isArray(departments)) {
            throw new Error('Invalid departments data received');
        }
        
        const departmentSelects = ['#departmentId', '#editDepartmentId', '#filterDepartment'];
        
        departmentSelects.forEach(selector => {
            const departmentSelect = $(selector);
            console.log(`Populating ${selector} with ${departments.length} departments`);
            
            // Clear existing options
            departmentSelect.empty();
            
            // Add default option
            departmentSelect.append('<option value="">Select Department</option>');
            
            // Add department options
            departments.forEach(dept => {
                if (dept && dept._id && dept.name) {
                    departmentSelect.append(`<option value="${dept._id}">${dept.name} (${dept.code || dept._id})</option>`);
                }
            });
            
            // Trigger change to update Select2
            departmentSelect.trigger('change');
        });
        
        console.log('Departments loaded successfully');
        
    } catch (error) {
        console.error('Error loading departments:', error);
        showAlert('Failed to load departments: ' + error.message, 'danger');
    }
}

// Load grades for dropdown
async function loadGrades() {
    try {
        console.log('Loading grades...');
        const response = await fetch('/api/grades');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const grades = await response.json();
        console.log('Grades loaded:', grades);
        
        // Check if grades is an array
        if (!Array.isArray(grades)) {
            throw new Error('Invalid grades data received');
        }
        
        const gradeSelects = ['#gradeId', '#editGradeId', '#filterGrade'];
        
        gradeSelects.forEach(selector => {
            const gradeSelect = $(selector);
            console.log(`Populating ${selector} with ${grades.length} grades`);
            
            // Clear existing options
            gradeSelect.empty();
            
            // Add default option
            gradeSelect.append('<option value="">Select Grade</option>');
            
            // Add grade options
            grades.forEach(grade => {
                if (grade && grade._id && grade.name) {
                    gradeSelect.append(`<option value="${grade._id}">${grade.name} (Level ${grade.level || 'N/A'})</option>`);
                }
            });
            
            // Trigger change to update Select2
            gradeSelect.trigger('change');
        });
        
        console.log('Grades loaded successfully');
        
    } catch (error) {
        console.error('Error loading grades:', error);
        showAlert('Failed to load grades: ' + error.message, 'danger');
    }
}

// Initialize DataTables
function initializeDataTable() {
    if (positionsTable) {
        positionsTable.destroy();
    }
    
    positionsTable = $('#positionsTable').DataTable({
        responsive: true,
        pageLength: 25,
        lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
        order: [[1, 'asc']], // Sort by name by default
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
             '<"row"<"col-sm-12"B>>' +
             '<"row"<"col-sm-12"tr>>' +
             '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
        buttons: [
            {
                extend: 'copy',
                className: 'btn btn-secondary btn-sm',
                text: '<i class="fas fa-copy me-1"></i>Copy'
            },
            {
                extend: 'csv',
                className: 'btn btn-success btn-sm',
                text: '<i class="fas fa-file-csv me-1"></i>CSV',
                title: 'Positions_Export_' + new Date().toISOString().split('T')[0]
            },
            {
                extend: 'excel',
                className: 'btn btn-success btn-sm',
                text: '<i class="fas fa-file-excel me-1"></i>Excel',
                title: 'Positions_Export_' + new Date().toISOString().split('T')[0]
            },
            {
                extend: 'pdf',
                className: 'btn btn-danger btn-sm',
                text: '<i class="fas fa-file-pdf me-1"></i>PDF',
                title: 'Positions Export',
                orientation: 'landscape',
                pageSize: 'A4'
            },
            {
                extend: 'print',
                className: 'btn btn-info btn-sm',
                text: '<i class="fas fa-print me-1"></i>Print'
            }
        ],
        language: {
            search: "Search positions:",
            lengthMenu: "Show _MENU_ positions per page",
            info: "Showing _START_ to _END_ of _TOTAL_ positions",
            infoEmpty: "No positions available",
            infoFiltered: "(filtered from _MAX_ total positions)",
            paginate: {
                first: "First",
                last: "Last",
                next: "Next",
                previous: "Previous"
            }
        },
        columnDefs: [
            {
                targets: -1, // Last column (Actions)
                orderable: false,
                searchable: false,
                className: 'text-center'
            },
            {
                targets: [4, 5, 6], // Numeric columns
                className: 'text-center'
            },
            {
                targets: [6, 7], // Status columns
                className: 'text-center'
            }
        ]
    });
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
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const positions = await response.json();
        
        renderPositionsTable(positions);
        $('#positionsCount').text(positions.length);
        hideLoading();
    } catch (error) {
        console.error('Error loading positions:', error);
        hideLoading();
        showAlert('Failed to load positions: ' + error.message, 'danger');
    }
}

// Render positions in table with DataTables
function renderPositionsTable(positions) {
    // Destroy existing DataTable if it exists
    if (positionsTable) {
        positionsTable.destroy();
    }
    
    const tableBody = $('#positionsTable tbody');
    tableBody.empty();
    
    if (positions.length === 0) {
        tableBody.append(`
            <tr>
                <td colspan="9" class="text-center py-4">No positions found</td>
            </tr>
        `);
        // Initialize empty DataTable
        initializeDataTable();
        return;
    }
    
    positions.forEach(position => {
        const vacancyRate = position.vacancyRate || 0;
        const vacancyClass = vacancyRate > 50 ? 'danger' : vacancyRate > 20 ? 'warning' : 'success';
        
        tableBody.append(`
            <tr data-id="${position._id}">
                <td><code>${position.code}</code></td>
                <td><strong>${position.name}</strong></td>
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
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-sm btn-outline-primary view-position" data-id="${position._id}" title="View Details" data-bs-toggle="tooltip">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-success edit-position" data-id="${position._id}" title="Edit" data-bs-toggle="tooltip">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${position.isActive ? `
                        <button type="button" class="btn btn-sm btn-outline-danger deactivate-position" data-id="${position._id}" title="Deactivate" data-bs-toggle="tooltip">
                            <i class="fas fa-ban"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `);
    });
    
    // Initialize DataTables after populating data
    initializeDataTable();
    
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

    // Initialize tooltips for new buttons
    $('[data-bs-toggle="tooltip"]').tooltip();
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
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const position = await response.json();
        
        $('#addPositionModal').modal('hide');
        $('#addPositionForm')[0].reset();
        showAlert('Position created successfully!', 'success');
        loadPositions();
        hideLoading();
    } catch (error) {
        console.error('Error creating position:', error);
        hideLoading();
        showAlert('Failed to create position: ' + error.message, 'danger');
    }
}

// Show position details in modal
async function showPositionDetails(positionId) {
    try {
        showLoading();
        currentPositionId = positionId;
        
        const response = await fetch(`/api/positions/${positionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
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
        $('#positionCapacityTotal').text(position.capacity?.total || 0);
        $('#positionCapacityFilled').text(position.capacity?.filled || 0);
        $('#positionCapacityVacant').text(position.capacity?.vacant || 0);
        $('#positionVacancyRate').text(`${position.vacancyRate || 0}%`);
        $('#positionOccupancyRate').text(`${position.occupancyRate || 0}%`);
        
        // Set description
        $('#positionDescription').text(position.description || 'No description provided');
        
        // Set requirements
        const education = position.requirements?.education || {};
        $('#positionEducation').html(`
            <strong>Minimum:</strong> ${formatEducationLevel(education.minimum)}<br>
            ${education.preferred ? `<strong>Preferred:</strong> ${formatEducationLevel(education.preferred)}<br>` : ''}
            ${education.field ? `<strong>Field:</strong> ${education.field}` : ''}
        `);
        
        const experience = position.requirements?.experience || {};
        $('#positionExperience').html(`
            <strong>Minimum:</strong> ${experience.minimum || 0} years<br>
            ${experience.preferred ? `<strong>Preferred:</strong> ${experience.preferred} years<br>` : ''}
            <strong>Type:</strong> ${formatExperienceType(experience.type)}
        `);
        
        // Set compensation
        if (position.effectiveSalary) {
            $('#positionSalary').html(`
                <strong>Base Salary:</strong> ${position.effectiveSalary.currency} ${position.effectiveSalary.baseSalary?.toLocaleString()}<br>
                <strong>Total Allowances:</strong> ${position.effectiveSalary.currency} ${position.effectiveSalary.totalAllowances?.toLocaleString()}<br>
                <strong>Gross Salary:</strong> ${position.effectiveSalary.currency} ${position.effectiveSalary.grossSalary?.toLocaleString()}
            `);
        } else {
            $('#positionSalary').text('Salary information not available');
        }
        
        // Show the modal
        $('#positionDetailsModal').modal('show');
        hideLoading();
    } catch (error) {
        console.error('Error loading position details:', error);
        hideLoading();
        showAlert('Failed to load position details: ' + error.message, 'danger');
    }
}

// Load position details for edit form
async function showEditPositionModal(positionId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/positions/${positionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
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
        $('#editCapacityTotal').val(position.capacity?.total || 1);
        
        // Requirements
        const education = position.requirements?.education || {};
        const experience = position.requirements?.experience || {};
        
        $('#editEducationMinimum').val(education.minimum || 'bachelor');
        $('#editEducationPreferred').val(education.preferred || '');
        $('#editEducationField').val(education.field || '');
        $('#editExperienceMinimum').val(experience.minimum || 0);
        $('#editExperiencePreferred').val(experience.preferred || '');
        $('#editExperienceType').val(experience.type || 'relevant');
        
        // Set position ID in hidden field
        $('#editPositionId').val(positionId);
        
        // Show the modal
        $('#editPositionModal').modal('show');
        hideLoading();
    } catch (error) {
        console.error('Error loading position for editing:', error);
        hideLoading();
        showAlert('Failed to load position for editing: ' + error.message, 'danger');
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
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const position = await response.json();
        
        $('#editPositionModal').modal('hide');
        showAlert('Position updated successfully!', 'success');
        loadPositions();
        hideLoading();
    } catch (error) {
        console.error('Error updating position:', error);
        hideLoading();
        showAlert('Failed to update position: ' + error.message, 'danger');
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
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        showAlert('Position deactivated successfully!', 'success');
        loadPositions();
        hideLoading();
    } catch (error) {
        console.error('Error deactivating position:', error);
        hideLoading();
        showAlert('Failed to deactivate position: ' + error.message, 'danger');
    }
}

// Load position hierarchy
async function loadPositionHierarchy(positionId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/positions/${positionId}/hierarchy`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const hierarchy = await response.json();
        
        const hierarchyContainer = $('#positionHierarchy');
        hierarchyContainer.empty();
        
        if (!hierarchy || hierarchy.length === 0) {
            hierarchyContainer.append('<p>No hierarchy information available</p>');
            return;
        }
        
        let html = '<div class="org-hierarchy">';
        
        hierarchy.forEach((position, index) => {
            const isCurrent = index === hierarchy.length - 1;
            const levelClass = `level-${position.level || 1}`;
            
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
        console.error('Error loading hierarchy:', error);
        hideLoading();
        $('#positionHierarchy').append('<p>Failed to load hierarchy: ' + error.message + '</p>');
    }
}

// Load position statistics
async function loadPositionStatistics(positionId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/positions/${positionId}/statistics`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const stats = await response.json();
        
        // Update statistics display
        $('#statCapacityTotal').text(stats.capacity?.total || 0);
        $('#statCapacityFilled').text(stats.capacity?.filled || 0);
        $('#statCapacityVacant').text(stats.capacity?.vacant || 0);
        $('#statOccupancyRate').text(`${stats.occupancyRate || 0}%`);
        $('#statVacancyRate').text(`${stats.vacancyRate || 0}%`);
        $('#statActiveEmployees').text(stats.activeEmployees || 0);
        $('#statTotalEmployees').text(stats.totalEmployees || 0);
        $('#statAvgTenure').text((stats.averageTenure || 0).toFixed(1));
        
        // Render chart
        renderStatisticsChart(stats);
        hideLoading();
    } catch (error) {
        console.error('Error loading statistics:', error);
        hideLoading();
        $('#position-statistics').append('<p>Failed to load statistics: ' + error.message + '</p>');
    }
}

// Load position details tab content
async function loadPositionDetails(positionId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/positions/${positionId}/details`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const details = await response.json();
        
        // Clear and populate details tab
        const detailsContainer = $('#position-details');
        detailsContainer.empty();
        
        let detailsHtml = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h6 class="mb-0">Job Information</h6>
                        </div>
                        <div class="card-body">
                            <p><strong>Job Type:</strong> ${details.jobType || 'N/A'}</p>
                            <p><strong>Reports To:</strong> ${details.reportingPosition?.name || 'N/A'}</p>
                            <p><strong>Created:</strong> ${new Date(details.createdAt).toLocaleDateString()}</p>
                            <p><strong>Last Updated:</strong> ${new Date(details.updatedAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h6 class="mb-0">Current Employees</h6>
                        </div>
                        <div class="card-body">
                            ${details.employees && details.employees.length > 0 ? 
                                details.employees.map(emp => `
                                    <p class="mb-2">
                                        <strong>${emp.firstName} ${emp.lastName}</strong><br>
                                        <small class="text-muted">${emp.employeeId} - ${emp.status}</small>
                                    </p>
                                `).join('') :
                                '<p>No employees currently in this position</p>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        if (details.responsibilities && details.responsibilities.length > 0) {
            detailsHtml += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0">Key Responsibilities</h6>
                    </div>
                    <div class="card-body">
                        <ul>
                            ${details.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }
        
        detailsContainer.append(detailsHtml);
        hideLoading();
    } catch (error) {
        console.error('Error loading position details:', error);
        hideLoading();
        $('#position-details').append('<p>Failed to load position details: ' + error.message + '</p>');
    }
}

// Render statistics chart
function renderStatisticsChart(stats) {
    const ctx = $('#statsChart')[0]?.getContext('2d');
    if (!ctx) return;
    
    // Destroy previous chart if exists
    if (window.statsChart) {
        window.statsChart.destroy();
    }
    
    const capacity = stats.capacity || {};
    
    window.statsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Total', 'Filled', 'Vacant'],
            datasets: [{
                label: 'Capacity',
                data: [capacity.total || 0, capacity.filled || 0, capacity.vacant || 0],
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
    if (!level) return 'Not specified';
    
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
    if (!type) return 'Not specified';
    
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
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `);
    
    alertsContainer.append(alert);
    setTimeout(() => alert.alert('close'), 5000);
}

function showLoading() {
    $('#loadingOverlay').fadeIn(200);
}

function hideLoading() {
    $('#loadingOverlay').fadeOut(200);
}

// Apply filters with DataTables integration
$('#applyFilters').click(function() {
    const filters = {
        search: $('#searchInput').val(),
        departmentId: $('#filterDepartment').val(),
        gradeId: $('#filterGrade').val(),
        hasVacancies: $('#filterVacancies').is(':checked'),
        isActive: $('#filterActive').is(':checked')
    };
    
    // Apply search filter to DataTable if it exists
    if (positionsTable) {
        positionsTable.search($('#searchInput').val()).draw();
    }
    
    // Load positions with server-side filters
    loadPositions(filters);
});

// Reset filters
$('#resetFilters').click(function() {
    $('#searchInput').val('');
    $('#filterDepartment').val('').trigger('change');
    $('#filterGrade').val('').trigger('change');
    $('#filterVacancies').prop('checked', false);
    $('#filterActive').prop('checked', true);
    
    // Clear DataTable search if it exists
    if (positionsTable) {
        positionsTable.search('').draw();
    }
    
    loadPositions();
});

// Real-time search integration with DataTables
$('#searchInput').on('keyup', function() {
    if (positionsTable) {
        positionsTable.search(this.value).draw();
    }
});

// Custom DataTables search for department filter
$('#filterDepartment').on('change', function() {
    if (positionsTable) {
        const selectedDept = $(this).find('option:selected').text();
        if (selectedDept === 'All Departments' || selectedDept === '' || selectedDept === 'Select Department') {
            positionsTable.column(2).search('').draw();
        } else {
            positionsTable.column(2).search(selectedDept).draw();
        }
    }
});

// Custom DataTables search for grade filter
$('#filterGrade').on('change', function() {
    if (positionsTable) {
        const selectedGrade = $(this).find('option:selected').text();
        if (selectedGrade === 'All Grades' || selectedGrade === '' || selectedGrade === 'Select Grade') {
            positionsTable.column(3).search('').draw();
        } else {
            positionsTable.column(3).search(selectedGrade).draw();
        }
    }
});

// Status filter integration
$('#filterActive').on('change', function() {
    if (positionsTable) {
        if ($(this).is(':checked')) {
            positionsTable.column(7).search('Active').draw();
        } else {
            positionsTable.column(7).search('').draw();
        }
    }
});

// Vacancy filter integration
$('#filterVacancies').on('change', function() {
    if (positionsTable) {
        // This would need custom logic based on your vacancy rate display
        // For now, we'll just reload the data with server-side filtering
        $('#applyFilters').click();
    }
});

// Export functions for custom buttons
function exportPositions(format) {
    if (positionsTable) {
        switch(format) {
            case 'csv':
                positionsTable.button('.buttons-csv').trigger();
                break;
            case 'excel':
                positionsTable.button('.buttons-excel').trigger();
                break;
            case 'pdf':
                positionsTable.button('.buttons-pdf').trigger();
                break;
            case 'print':
                positionsTable.button('.buttons-print').trigger();
                break;
        }
    }
}

// Refresh positions data
function refreshPositions() {
    showAlert('Refreshing positions data...', 'info');
    loadPositions();
}

// Load positions for reporting dropdown (used in modals)
async function loadPositionsForDropdown() {
    try {
        const response = await fetch('/api/positions?isActive=true');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const positions = await response.json();
        
        const reportingSelects = ['#reportingTo', '#editReportingTo'];
        
        reportingSelects.forEach(selector => {
            const select = $(selector);
            
            // Clear existing options except the first one
            select.find('option:not(:first)').remove();
            
            // Add position options
            positions.forEach(position => {
                if (position && position._id && position.name) {
                    select.append(`<option value="${position._id}">${position.name} (${position.code})</option>`);
                }
            });
            
            // Trigger change to update Select2
            select.trigger('change');
        });
        
    } catch (error) {
        console.error('Error loading positions for dropdown:', error);
        showAlert('Failed to load positions for reporting dropdown', 'warning');
    }
}

// Enhanced modal initialization with reporting positions
$('#addPositionModal').on('shown.bs.modal', function() {
    console.log('Add position modal opened, loading data...');
    
    // Load positions for reporting dropdown
    loadPositionsForDropdown();
    
    // Reinitialize Select2
    $(this).find('.select2').select2({
        theme: 'bootstrap-5',
        width: '100%',
        dropdownParent: $('#addPositionModal')
    });
});

$('#editPositionModal').on('shown.bs.modal', function() {
    console.log('Edit position modal opened, loading data...');
    
    // Load positions for reporting dropdown
    loadPositionsForDropdown();
    
    // Reinitialize Select2
    $(this).find('.select2').select2({
        theme: 'bootstrap-5',
        width: '100%',
        dropdownParent: $('#editPositionModal')
    });
});

// Clear forms when modals are hidden
$('#addPositionModal').on('hidden.bs.modal', function() {
    $('#addPositionForm')[0].reset();
    $(this).find('.select2').val('').trigger('change');
});

$('#editPositionModal').on('hidden.bs.modal', function() {
    $('#editPositionForm')[0].reset();
    $(this).find('.select2').val('').trigger('change');
});

// Batch operations (if needed)
function selectAllPositions() {
    if (positionsTable) {
        // Implementation for select all functionality
        console.log('Select all positions functionality');
    }
}

function bulkDeactivatePositions() {
    // Implementation for bulk deactivate functionality
    console.log('Bulk deactivate positions functionality');
}

// Position validation functions
function validatePositionCode(code) {
    // Basic validation for position code
    return code && code.length >= 2 && /^[A-Z0-9-_]+$/i.test(code);
}

function validatePositionName(name) {
    // Basic validation for position name
    return name && name.trim().length >= 3;
}

// Form validation enhancement
function validatePositionForm(formId) {
    const form = $(formId);
    let isValid = true;
    const errors = [];
    
    // Validate required fields
    const name = form.find('[id*="name"]').val();
    const code = form.find('[id*="code"]').val();
    const departmentId = form.find('[id*="departmentId"]').val();
    const gradeId = form.find('[id*="gradeId"]').val();
    
    if (!validatePositionName(name)) {
        errors.push('Position name must be at least 3 characters long');
        isValid = false;
    }
    
    if (!validatePositionCode(code)) {
        errors.push('Position code must be at least 2 characters and contain only letters, numbers, hyphens, and underscores');
        isValid = false;
    }
    
    if (!departmentId) {
        errors.push('Please select a department');
        isValid = false;
    }
    
    if (!gradeId) {
        errors.push('Please select a grade');
        isValid = false;
    }
    
    if (!isValid) {
        showAlert('Please fix the following errors:<br>• ' + errors.join('<br>• '), 'danger');
    }
    
    return isValid;
}

// Enhanced form submission with validation
$('#addPositionForm').off('submit').on('submit', async function(e) {
    e.preventDefault();
    
    if (!validatePositionForm('#addPositionForm')) {
        return;
    }
    
    await createPosition();
});

$('#editPositionForm').off('submit').on('submit', async function(e) {
    e.preventDefault();
    
    if (!validatePositionForm('#editPositionForm')) {
        return;
    }
    
    await updatePosition();
});

// Keyboard shortcuts
$(document).keydown(function(e) {
    // Ctrl+N or Cmd+N for new position
    if ((e.ctrlKey || e.metaKey) && e.keyCode === 78) {
        e.preventDefault();
        $('#addPositionBtn').click();
    }
    
    // ESC to close modals
    if (e.keyCode === 27) {
        $('.modal').modal('hide');
    }
    
    // Ctrl+F or Cmd+F to focus search
    if ((e.ctrlKey || e.metaKey) && e.keyCode === 70) {
        e.preventDefault();
        $('#searchInput').focus();
    }
});

// Auto-save functionality for forms (optional)
function enableAutoSave(formId, storageKey) {
    const form = $(formId);
    
    // Load saved data
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(key => {
                const field = form.find(`#${key}`);
                if (field.length) {
                    field.val(data[key]).trigger('change');
                }
            });
        } catch (error) {
            console.error('Error loading saved form data:', error);
        }
    }
    
    // Save on input change
    form.find('input, select, textarea').on('input change', function() {
        const formData = {};
        form.find('input, select, textarea').each(function() {
            const field = $(this);
            if (field.attr('id')) {
                formData[field.attr('id')] = field.val();
            }
        });
        
        localStorage.setItem(storageKey, JSON.stringify(formData));
    });
    
    // Clear saved data on successful submission
    form.on('submit', function() {
        localStorage.removeItem(storageKey);
    });
}

// Initialize auto-save for forms (uncomment if needed)
// enableAutoSave('#addPositionForm', 'addPositionFormData');
// enableAutoSave('#editPositionForm', 'editPositionFormData');

// Performance optimization: Debounce search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debounced search
const debouncedSearch = debounce(function(searchTerm) {
    if (positionsTable) {
        positionsTable.search(searchTerm).draw();
    }
}, 300);

$('#searchInput').off('keyup').on('keyup', function() {
    debouncedSearch(this.value);
});