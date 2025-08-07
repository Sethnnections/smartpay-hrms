$(document).ready(function() {
    // Global variables
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalPositions = 0;
    let departments = [];
    let grades = [];
    let positions = [];
    
    // Initialize Select2 dropdowns
    $('.form-select').select2({
        width: '100%',
        theme: 'bootstrap-5'
    });
    
    // Load initial data
    loadDepartments();
    loadGrades();
    loadPositions();
    loadStats();
    
    // Event listeners
    $('#filterForm').on('submit', function(e) {
        e.preventDefault();
        currentPage = 1;
        loadPositions();
    });
    
    $('#addPositionForm').on('submit', function(e) {
        e.preventDefault();
        addPosition();
    });
    
    $('#editPositionForm').on('submit', function(e) {
        e.preventDefault();
        updatePosition();
    });
    
    $('#capacityForm').on('submit', function(e) {
        e.preventDefault();
        updateCapacity();
    });
    
    $('#deactivatePositionForm').on('submit', function(e) {
        e.preventDefault();
        deactivatePosition();
    });
    
    $('#addResponsibility').on('click', function() {
        addResponsibilityField();
    });
    
    $(document).on('click', '.remove-responsibility', function() {
        $(this).closest('.input-group').remove();
    });
    
    // Functions
    function loadDepartments() {
        const token = localStorage.getItem('authToken');
        
        $.ajax({
            url: 'http://localhost:3000/api/departments',
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            success: function(response) {
                departments = response;
                
                // Populate department dropdowns
                const departmentDropdowns = ['#departmentFilter', '#positionDepartment'];
                
                departmentDropdowns.forEach(selector => {
                    $(selector).empty().append('<option value="">Select Department</option>');
                    response.forEach(dept => {
                        $(selector).append(`<option value="${dept._id}">${dept.name} (${dept.code})</option>`);
                    });
                });
            },
            error: function(xhr) {
                showAlert('Failed to load departments: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function loadGrades() {
        const token = localStorage.getItem('authToken');
        
        $.ajax({
            url: 'http://localhost:3000/api/grades',
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            success: function(response) {
                grades = response;
                
                // Populate grade dropdowns
                const gradeDropdowns = ['#gradeFilter', '#positionGrade'];
                
                gradeDropdowns.forEach(selector => {
                    $(selector).empty().append('<option value="">Select Grade</option>');
                    response.forEach(grade => {
                        $(selector).append(`<option value="${grade._id}">${grade.name} (Level ${grade.level})</option>`);
                    });
                });
            },
            error: function(xhr) {
                showAlert('Failed to load grades: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function loadPositions() {
        const token = localStorage.getItem('authToken');
        const search = $('#searchInput').val();
        const departmentId = $('#departmentFilter').val();
        const gradeId = $('#gradeFilter').val();
        const isActive = $('#statusFilter').val() === 'true';
        const hasVacancies = $('#vacancyFilter').val() === 'true';
        
        let url = `http://localhost:3000/api/positions?page=${currentPage}&limit=${itemsPerPage}`;
        
        if (search) url += `&search=${search}`;
        if (departmentId) url += `&departmentId=${departmentId}`;
        if (gradeId) url += `&gradeId=${gradeId}`;
        if (isActive) url += `&isActive=true`;
        if (hasVacancies) url += `&hasVacancies=true`;
        
        $.ajax({
            url: url,
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            success: function(response) {
                positions = response;
                renderPositionsTable(response);
            },
            error: function(xhr) {
                showAlert('Failed to load positions: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function renderPositionsTable(positions) {
        const $tableBody = $('#positionsTableBody');
        $tableBody.empty();
        
        if (positions.length === 0) {
            $tableBody.append('<tr><td colspan="7" class="text-center">No positions found</td></tr>');
            return;
        }
        
        positions.forEach(position => {
            const department = departments.find(d => d._id === position.departmentId) || {};
            const grade = grades.find(g => g._id === position.gradeId) || {};
            
            const statusBadge = position.isActive ? 
                `<span class="badge bg-success">Active</span>` : 
                `<span class="badge bg-secondary">Inactive</span>`;
                
            const vacancyInfo = position.capacity.vacant > 0 ? 
                `<span class="text-warning">${position.capacity.vacant} vacant</span>` : 
                `<span class="text-success">Filled</span>`;
            
            const row = `
                <tr data-id="${position._id}">
                    <td>
                        <strong>${position.name}</strong><br>
                        <small class="text-muted">${position.code}</small>
                    </td>
                    <td>${department.name || 'N/A'}</td>
                    <td>${grade.name || 'N/A'} (L${grade.level || '?'})</td>
                    <td>
                        ${position.capacity.filled}/${position.capacity.total}<br>
                        ${vacancyInfo}
                    </td>
                    <td>
                        ${grade.currency || '$'}${grade.baseSalary || '0'}<br>
                        <small class="text-muted">${grade.currency || '$'}${grade.salaryRange?.minimum || '0'} - ${grade.currency || '$'}${grade.salaryRange?.maximum || '0'}</small>
                    </td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-h"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item view-details" href="#" data-id="${position._id}"><i class="fas fa-eye me-2"></i>View Details</a></li>
                                <li><a class="dropdown-item edit-position" href="#" data-id="${position._id}"><i class="fas fa-edit me-2"></i>Edit</a></li>
                                <li><a class="dropdown-item update-capacity" href="#" data-id="${position._id}"><i class="fas fa-users me-2"></i>Update Capacity</a></li>
                                <li><a class="dropdown-item view-hierarchy" href="#" data-id="${position._id}"><i class="fas fa-sitemap me-2"></i>View Hierarchy</a></li>
                                <li><a class="dropdown-item view-statistics" href="#" data-id="${position._id}"><i class="fas fa-chart-bar me-2"></i>View Statistics</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger deactivate-position" href="#" data-id="${position._id}"><i class="fas fa-ban me-2"></i>Deactivate</a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `;
            
            $tableBody.append(row);
        });
        
        // Add event listeners for action buttons
        $('.view-details').on('click', function() {
            const positionId = $(this).data('id');
            showPositionDetails(positionId);
        });
        
        $('.edit-position').on('click', function() {
            const positionId = $(this).data('id');
            showEditPositionModal(positionId);
        });
        
        $('.update-capacity').on('click', function() {
            const positionId = $(this).data('id');
            showCapacityModal(positionId);
        });
        
        $('.view-hierarchy').on('click', function() {
            const positionId = $(this).data('id');
            showHierarchy(positionId);
        });
        
        $('.view-statistics').on('click', function() {
            const positionId = $(this).data('id');
            showStatistics(positionId);
        });
        
        $('.deactivate-position').on('click', function() {
            const positionId = $(this).data('id');
            showDeactivateModal(positionId);
        });
    }
    
    function loadStats() {
        const token = localStorage.getItem('authToken');
        
        $.ajax({
            url: 'http://localhost:3000/api/positions',
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            success: function(positions) {
                const totalPositions = positions.length;
                const activePositions = positions.filter(p => p.isActive).length;
                const positionsWithVacancies = positions.filter(p => p.isActive && p.capacity.vacant > 0).length;
                
                const statsHtml = `
                    <div class="col-md-4">
                        <div class="card stat-card">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 class="stat-value">${totalPositions}</h5>
                                        <p class="stat-label">Total Positions</p>
                                    </div>
                                    <div class="stat-icon bg-primary">
                                        <i class="fas fa-briefcase"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card stat-card">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 class="stat-value">${activePositions}</h5>
                                        <p class="stat-label">Active Positions</p>
                                    </div>
                                    <div class="stat-icon bg-success">
                                        <i class="fas fa-check-circle"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card stat-card">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 class="stat-value">${positionsWithVacancies}</h5>
                                        <p class="stat-label">Positions with Vacancies</p>
                                    </div>
                                    <div class="stat-icon bg-warning">
                                        <i class="fas fa-user-plus"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                $('#positionsStats').html(statsHtml);
            },
            error: function(xhr) {
                showAlert('Failed to load position statistics: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function addPosition() {
        const token = localStorage.getItem('authToken');
        const formData = $('#addPositionForm').serializeArray();
        const positionData = {};
        
        // Convert form data to object
        formData.forEach(item => {
            // Handle nested objects
            if (item.name.includes('.')) {
                const parts = item.name.split('.');
                if (!positionData[parts[0]]) positionData[parts[0]] = {};
                positionData[parts[0]][parts[1]] = item.value;
            } else {
                positionData[item.name] = item.value;
            }
        });
        
        // Handle responsibilities array
        const responsibilities = [];
        $('.responsibility-input').each(function() {
            if ($(this).val()) responsibilities.push($(this).val());
        });
        positionData.responsibilities = responsibilities;
        
        // Handle capacity object
        positionData.capacity = {
            total: parseInt(positionData.capacity.total),
            filled: 0,
            vacant: parseInt(positionData.capacity.total)
        };
        
        $.ajax({
            url: 'http://localhost:3000/api/positions',
            type: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(positionData),
            success: function(response) {
                $('#addPositionModal').modal('hide');
                showAlert('Position created successfully!', 'success');
                loadPositions();
                loadStats();
                resetAddPositionForm();
            },
            error: function(xhr) {
                showAlert('Failed to create position: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function resetAddPositionForm() {
        $('#addPositionForm')[0].reset();
        $('#responsibilitiesContainer').html(`
            <div class="input-group mb-2">
                <input type="text" class="form-control responsibility-input" name="responsibilities[]">
                <button type="button" class="btn btn-outline-danger remove-responsibility" disabled>
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `);
    }
    
    function addResponsibilityField() {
        const $container = $('#responsibilitiesContainer');
        const $newField = $(`
            <div class="input-group mb-2">
                <input type="text" class="form-control responsibility-input" name="responsibilities[]">
                <button type="button" class="btn btn-outline-danger remove-responsibility">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `);
        
        $container.append($newField);
    }
    
    function showPositionDetails(positionId) {
        const token = localStorage.getItem('authToken');
        const position = positions.find(p => p._id === positionId);
        
        if (!position) return;
        
        const department = departments.find(d => d._id === position.departmentId) || {};
        const grade = grades.find(g => g._id === position.gradeId) || {};
        const reportingTo = positions.find(p => p._id === position.reportingTo) || {};
        
        let detailsHtml = `
            <div class="row">
                <div class="col-md-6">
                    <h5>${position.name}</h5>
                    <p class="text-muted">${position.code}</p>
                    
                    <div class="mb-3">
                        <h6>Basic Information</h6>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Department:</span>
                                <span>${department.name || 'N/A'}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Grade:</span>
                                <span>${grade.name || 'N/A'} (Level ${grade.level || '?'})</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Reports To:</span>
                                <span>${reportingTo.name || 'None'}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Job Type:</span>
                                <span>${position.jobType || 'N/A'}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Status:</span>
                                <span class="badge ${position.isActive ? 'bg-success' : 'bg-secondary'}">
                                    ${position.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Capacity:</span>
                                <span>${position.capacity.filled} filled / ${position.capacity.total} total</span>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="mb-3">
                        <h6>Salary Information</h6>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Base Salary:</span>
                                <span>${grade.currency || '$'}${grade.baseSalary || '0'}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Salary Range:</span>
                                <span>${grade.currency || '$'}${grade.salaryRange?.minimum || '0'} - ${grade.currency || '$'}${grade.salaryRange?.maximum || '0'}</span>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="mb-3">
                        <h6>Description</h6>
                        <p>${position.description || 'No description provided'}</p>
                    </div>
                    
                    <div class="mb-3">
                        <h6>Responsibilities</h6>
                        <ul class="list-group list-group-flush">
                            ${position.responsibilities && position.responsibilities.length > 0 ? 
                                position.responsibilities.map(resp => `<li class="list-group-item">${resp}</li>`).join('') : 
                                '<li class="list-group-item text-muted">No responsibilities defined</li>'}
                        </ul>
                    </div>
                    
                    <div class="mb-3">
                        <h6>Requirements</h6>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Minimum Education:</span>
                                <span>${formatEducationLevel(position.requirements?.education?.minimum)}</span>
                            </li>
                            ${position.requirements?.education?.preferred ? `
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Preferred Education:</span>
                                <span>${formatEducationLevel(position.requirements.education.preferred)}</span>
                            </li>` : ''}
                            ${position.requirements?.education?.field ? `
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Education Field:</span>
                                <span>${position.requirements.education.field}</span>
                            </li>` : ''}
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Minimum Experience:</span>
                                <span>${position.requirements?.experience?.minimum || 0} years</span>
                            </li>
                            ${position.requirements?.experience?.preferred ? `
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Preferred Experience:</span>
                                <span>${position.requirements.experience.preferred} years</span>
                            </li>` : ''}
                        </ul>
                    </div>
                </div>
            </div>
        `;
        
        $('#positionDetailsContent').html(detailsHtml);
        $('#positionDetailsModal').modal('show');
    }
    
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
    
    function showEditPositionModal(positionId) {
        const token = localStorage.getItem('authToken');
        const position = positions.find(p => p._id === positionId);
        
        if (!position) return;
        
        // Populate the edit form
        $('#editPositionId').val(position._id);
        
        let editFormHtml = $('#addPositionForm').html();
        $('#editPositionForm .modal-body').html(editFormHtml);
        
        // Set form values
        $('#editPositionForm [name="name"]').val(position.name);
        $('#editPositionForm [name="code"]').val(position.code);
        $('#editPositionForm [name="departmentId"]').val(position.departmentId).trigger('change');
        $('#editPositionForm [name="gradeId"]').val(position.gradeId).trigger('change');
        $('#editPositionForm [name="reportingTo"]').val(position.reportingTo).trigger('change');
        $('#editPositionForm [name="jobType"]').val(position.jobType).trigger('change');
        $('#editPositionForm [name="capacity.total"]').val(position.capacity.total);
        $('#editPositionForm [name="status"]').val(position.status).trigger('change');
        $('#editPositionForm [name="description"]').val(position.description);
        
        // Set requirements
        if (position.requirements?.education) {
            $('#editPositionForm [name="requirements.education.minimum"]').val(position.requirements.education.minimum).trigger('change');
            $('#editPositionForm [name="requirements.education.preferred"]').val(position.requirements.education.preferred || '').trigger('change');
            $('#editPositionForm [name="requirements.education.field"]').val(position.requirements.education.field || '');
        }
        
        if (position.requirements?.experience) {
            $('#editPositionForm [name="requirements.experience.minimum"]').val(position.requirements.experience.minimum);
            $('#editPositionForm [name="requirements.experience.preferred"]').val(position.requirements.experience.preferred || '');
            $('#editPositionForm [name="requirements.experience.type"]').val(position.requirements.experience.type || 'relevant').trigger('change');
        }
        
        // Set responsibilities
        const $responsibilitiesContainer = $('#editPositionForm #responsibilitiesContainer');
        $responsibilitiesContainer.empty();
        
        if (position.responsibilities && position.responsibilities.length > 0) {
            position.responsibilities.forEach(resp => {
                const $field = $(`
                    <div class="input-group mb-2">
                        <input type="text" class="form-control responsibility-input" name="responsibilities[]" value="${resp}">
                        <button type="button" class="btn btn-outline-danger remove-responsibility">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `);
                $responsibilitiesContainer.append($field);
            });
        } else {
            $responsibilitiesContainer.append(`
                <div class="input-group mb-2">
                    <input type="text" class="form-control responsibility-input" name="responsibilities[]">
                    <button type="button" class="btn btn-outline-danger remove-responsibility" disabled>
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `);
        }
        
        // Reinitialize Select2
        $('#editPositionForm .form-select').select2({
            width: '100%',
            theme: 'bootstrap-5'
        });
        
        // Reattach event listeners
        $('#editPositionForm #addResponsibility').on('click', function() {
            addResponsibilityField('edit');
        });
        
        $('#editPositionForm').on('click', '.remove-responsibility', function() {
            $(this).closest('.input-group').remove();
        });
        
        $('#editPositionModal').modal('show');
    }
    
    function updatePosition() {
        const token = localStorage.getItem('authToken');
        const positionId = $('#editPositionId').val();
        const formData = $('#editPositionForm').serializeArray();
        const positionData = {};
        
        // Convert form data to object
        formData.forEach(item => {
            // Skip the id field
            if (item.name === 'id') return;
            
            // Handle nested objects
            if (item.name.includes('.')) {
                const parts = item.name.split('.');
                if (!positionData[parts[0]]) positionData[parts[0]] = {};
                positionData[parts[0]][parts[1]] = item.value;
            } else {
                positionData[item.name] = item.value;
            }
        });
        
        // Handle responsibilities array
        const responsibilities = [];
        $('#editPositionForm .responsibility-input').each(function() {
            if ($(this).val()) responsibilities.push($(this).val());
        });
        positionData.responsibilities = responsibilities;
        
        // Handle capacity object (don't update filled/vacant here)
        positionData.capacity = {
            total: parseInt(positionData.capacity.total)
        };
        
        $.ajax({
            url: `http://localhost:3000/api/positions/${positionId}`,
            type: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(positionData),
            success: function(response) {
                $('#editPositionModal').modal('hide');
                showAlert('Position updated successfully!', 'success');
                loadPositions();
            },
            error: function(xhr) {
                showAlert('Failed to update position: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function showCapacityModal(positionId) {
        const position = positions.find(p => p._id === positionId);
        
        if (!position) return;
        
        $('#capacityPositionId').val(positionId);
        $('#currentCapacityDisplay').html(`
            ${position.capacity.filled} filled / ${position.capacity.total} total (${position.capacity.vacant} vacant)
        `);
        
        $('#capacityModal').modal('show');
    }
    
    function updateCapacity() {
        const token = localStorage.getItem('authToken');
        const positionId = $('#capacityPositionId').val();
        const change = parseInt($('#capacityChange').val()) || 0;
        
        $.ajax({
            url: `http://localhost:3000/api/positions/${positionId}/capacity`,
            type: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({ change }),
            success: function(response) {
                $('#capacityModal').modal('hide');
                showAlert('Position capacity updated successfully!', 'success');
                loadPositions();
                loadStats();
            },
            error: function(xhr) {
                showAlert('Failed to update capacity: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function showDeactivateModal(positionId) {
        const position = positions.find(p => p._id === positionId);
        
        if (!position) return;
        
        $('#deactivatePositionId').val(positionId);
        
        // Check if position has active employees
        const token = localStorage.getItem('authToken');
        
        $.ajax({
            url: `http://localhost:3000/api/employees?positionId=${positionId}&status=active`,
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            success: function(employees) {
                if (employees.length > 0) {
                    $('#deactivatePositionWarning').show();
                    $('#deactivateWarningText').text(`
                        This position has ${employees.length} active employee(s). 
                        You must reassign them before deactivating.
                    `);
                    $('#deactivatePositionForm button[type="submit"]').prop('disabled', true);
                } else {
                    $('#deactivatePositionWarning').hide();
                    $('#deactivatePositionForm button[type="submit"]').prop('disabled', false);
                }
            },
            error: function() {
                $('#deactivatePositionWarning').hide();
            }
        });
        
        $('#deactivatePositionModal').modal('show');
    }
    
    function deactivatePosition() {
        const token = localStorage.getItem('authToken');
        const positionId = $('#deactivatePositionId').val();
        
        $.ajax({
            url: `http://localhost:3000/api/positions/${positionId}/deactivate`,
            type: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            success: function(response) {
                $('#deactivatePositionModal').modal('hide');
                showAlert('Position deactivated successfully!', 'success');
                loadPositions();
                loadStats();
            },
            error: function(xhr) {
                showAlert('Failed to deactivate position: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function showHierarchy(positionId) {
        const token = localStorage.getItem('authToken');
        
        $.ajax({
            url: `http://localhost:3000/api/positions/${positionId}/hierarchy`,
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            success: function(hierarchy) {
                let hierarchyHtml = `
                    <div class="org-chart">
                        <ul>
                            ${buildHierarchyTree(hierarchy)}
                        </ul>
                    </div>
                `;
                
                $('#hierarchyChart').html(hierarchyHtml);
                $('#hierarchyModal').modal('show');
            },
            error: function(xhr) {
                showAlert('Failed to load hierarchy: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function buildHierarchyTree(hierarchy) {
        let html = '';
        
        hierarchy.forEach((item, index) => {
            const isLast = index === hierarchy.length - 1;
            
            html += `
                <li>
                    <div class="node ${item._id === hierarchy[hierarchy.length - 1]._id ? 'current' : ''}">
                        <span>${item.name}</span>
                        <small class="text-muted">${item.code}</small>
                    </div>
                    ${!isLast ? '<ul><li><div class="node-connector"></div></li></ul>' : ''}
                </li>
            `;
        });
        
        return html;
    }
    
    function showStatistics(positionId) {
        const token = localStorage.getItem('authToken');
        
        // Get position details for salary info
        $.ajax({
            url: `http://localhost:3000/api/positions/${positionId}`,
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            success: function(position) {
                // Get statistics
                $.ajax({
                    url: `http://localhost:3000/api/positions/${positionId}/statistics`,
                    type: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    success: function(stats) {
                        // Update capacity stats
                        $('#totalCapacityStat').text(stats.capacity.total);
                        $('#filledCapacityStat').text(stats.capacity.filled);
                        $('#vacantCapacityStat').text(stats.capacity.vacant);
                        
                        // Update progress bars
                        const filledPercent = (stats.capacity.filled / stats.capacity.total) * 100;
                        const vacantPercent = (stats.capacity.vacant / stats.capacity.total) * 100;
                        
                        $('#filledProgress').css('width', `${filledPercent}%`);
                        $('#vacantProgress').css('width', `${vacantPercent}%`);
                        
                        // Update employee stats
                        $('#activeEmployeesStat').text(stats.activeEmployees);
                        $('#totalEmployeesStat').text(stats.totalEmployees);
                        $('#avgTenureStat').text(stats.averageTenure.toFixed(1));
                        
                        // Update salary stats
                        let salaryHtml = '';
                        
                        if (position.effectiveSalary) {
                            salaryHtml = `
                                <tr>
                                    <td>Base Salary</td>
                                    <td>${position.grade.currency || '$'}${position.effectiveSalary.baseSalary}</td>
                                </tr>
                                <tr>
                                    <td>Transport Allowance</td>
                                    <td>${position.grade.currency || '$'}${position.effectiveSalary.allowances.transport || '0'}</td>
                                </tr>
                                <tr>
                                    <td>Housing Allowance</td>
                                    <td>${position.grade.currency || '$'}${position.effectiveSalary.allowances.housing || '0'}</td>
                                </tr>
                                <tr>
                                    <td>Medical Allowance</td>
                                    <td>${position.grade.currency || '$'}${position.effectiveSalary.allowances.medical || '0'}</td>
                                </tr>
                                <tr>
                                    <td>Other Allowances</td>
                                    <td>${position.grade.currency || '$'}${position.effectiveSalary.allowances.other || '0'}</td>
                                </tr>
                                <tr class="table-active">
                                    <td><strong>Total Gross Salary</strong></td>
                                    <td><strong>${position.grade.currency || '$'}${position.effectiveSalary.grossSalary}</strong></td>
                                </tr>
                            `;
                        } else {
                            salaryHtml = '<tr><td colspan="2" class="text-center">Salary information not available</td></tr>';
                        }
                        
                        $('#salaryStatsBody').html(salaryHtml);
                        
                        $('#statisticsModal').modal('show');
                    },
                    error: function(xhr) {
                        showAlert('Failed to load statistics: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
                    }
                });
            },
            error: function(xhr) {
                showAlert('Failed to load position details: ' + xhr.responseJSON?.error || 'Unknown error', 'danger');
            }
        });
    }
    
    function showAlert(message, type) {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        // Prepend to the container
        $('.container-fluid').prepend(alertHtml);
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            $('.alert').alert('close');
        }, 5000);
    }
});