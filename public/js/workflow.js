// Global variables
let currentUser = null;
let currentMonth = moment().format('YYYY-MM');
let workflowData = null;
let selectedEmployee = null;

// Authentication headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/';
        return {};
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initApplication();
});

function initApplication() {
    console.log('Initializing application...');
    
    // Get user from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
        currentUser = JSON.parse(userData);
        console.log('Current user:', currentUser);
    } else {
        console.log('No user found, redirecting to login...');
        window.location.href = '/';
        return;
    }
    
    // Set current month display
    document.getElementById('currentMonthDisplay').textContent = moment(currentMonth).format('MMMM YYYY');
    document.getElementById('payrollMonth').value = currentMonth;
    
    // Load initial data
    loadWorkflowStatus(currentMonth);
    loadMonthList();
    loadAdjustments();
    
    // Initialize Select2 AFTER ensuring jQuery is loaded
    setTimeout(() => {
        initSelect2();
    }, 100);
    
    // Event listeners
    setupEventListeners();
    
    // Hide all phases initially
    hideAllPhases();
}

function hideAllPhases() {
    document.getElementById('phase1').style.display = 'none';
    document.getElementById('phase2').style.display = 'none';
    document.getElementById('phase3').style.display = 'none';
}

function showPhase(phaseId) {
    hideAllPhases();
    document.getElementById(phaseId).style.display = 'block';
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Month navigation
    document.getElementById('prevMonthBtn').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('nextMonthBtn').addEventListener('click', () => navigateMonth(1));
    
    // Phase 1: Generate Payroll
    document.getElementById('generatePayrollBtn').addEventListener('click', generatePayroll);
    document.getElementById('viewGeneratedPayrollBtn').addEventListener('click', viewGeneratedPayroll);
    
    // Phase 2: Adjustment buttons
    document.getElementById('addEarningsBtn').addEventListener('click', addEarnings);
    document.getElementById('addSalaryAdvanceBtn').addEventListener('click', addSalaryAdvance);
    document.getElementById('addDeductionsBtn').addEventListener('click', addDeductions);
    document.getElementById('editPayrollBtn').addEventListener('click', editPayroll);
    document.getElementById('startApprovalBtn').addEventListener('click', startApprovalProcess);
    document.getElementById('previewPayslipsBtn').addEventListener('click', previewPayslips);
    document.getElementById('viewAllAdjustmentsBtn').addEventListener('click', viewAllAdjustments);
    
    // Phase 3: Approval
    document.getElementById('markPaidBtn').addEventListener('click', markPayrollPaid);
    document.getElementById('generatePayslipsBtn').addEventListener('click', generatePayslips);
    document.getElementById('generateBankInstructionsBtn').addEventListener('click', generateBankInstructions);
    
    console.log('Event listeners setup complete');
}

// Month navigation
function navigateMonth(direction) {
    currentMonth = moment(currentMonth).add(direction, 'months').format('YYYY-MM');
    updateMonthDisplay();
    loadWorkflowStatus(currentMonth);
    loadAdjustments();
}

function updateMonthDisplay() {
    document.getElementById('currentMonthDisplay').textContent = moment(currentMonth).format('MMMM YYYY');
    document.getElementById('payrollMonth').value = currentMonth;
}

// Load workflow status
async function loadWorkflowStatus(month) {
    try {
        console.log('Loading workflow status for:', month);
        showLoading(true);
        
        const response = await axios.get(`/api/workflow/status?month=${month}`, {
            headers: getAuthHeaders()
        });
        
        console.log('Workflow status loaded:', response.data);
        workflowData = response.data;
        
        updateWorkflowUI(response.data);
        updatePhaseVisibility(response.data);
        
    } catch (error) {
        console.error('Error loading workflow status:', error);
        showAlert('Failed to load workflow status', 'error');
        
        // Show phase 1 by default if error
        showPhase('phase1');
    } finally {
        showLoading(false);
    }
}

function updateWorkflowUI(data) {
    // Update workflow info
    const workflowInfo = document.getElementById('workflowInfo');
    if (workflowInfo) {
        if (data.exists) {
            workflowInfo.textContent = `Workflow: ${data.status.replace('_', ' ').toUpperCase()}`;
        } else {
            workflowInfo.textContent = 'No workflow for this month';
        }
    }
    
    // Update alert
    updateAlert(data);
    
    // Update timeline if exists
    if (data.steps && data.steps.length > 0) {
        updateTimeline(data);
    }
}

function updatePhaseVisibility(data) {
    console.log('Updating phase visibility:', data);
    
    if (!data.exists || !data.payrollGenerated) {
        // Phase 1: Generate Payroll
        showPhase('phase1');
        updatePhaseStatus('phase1Status', 'Current', 'in-progress');
        document.getElementById('generatePayrollBtn').disabled = false;
        document.getElementById('generatePayrollBtn').innerHTML = '<i class="fas fa-cogs me-2"></i> Generate Payroll';
        
    } else if (data.exists && data.payrollGenerated) {
        if (data.status === 'in_progress' && data.canMakeAdjustments) {
            // Phase 2: Adjustments
            showPhase('phase2');
            updatePhaseStatus('phase2Status', 'Current', 'in-progress');
            document.getElementById('startApprovalBtn').disabled = false;
            document.getElementById('startApprovalBtn').innerHTML = '<i class="fas fa-play-circle me-2"></i> Start Approval Process';
            
        } else if (data.status === 'in_progress' && !data.canMakeAdjustments) {
            // Phase 3: Approval
            showPhase('phase3');
            updatePhaseStatus('phase3Status', 'Current', 'in-progress');
            
            // Update approval steps visibility based on user role
            updateApprovalStepsVisibility();
            
        } else if (data.status === 'approved') {
            // Phase 3: Ready for payment
            showPhase('phase3');
            updatePhaseStatus('phase3Status', 'Completed', 'completed');
            document.getElementById('markPaidBtn').disabled = false;
            document.getElementById('generatePayslipsBtn').disabled = false;
            document.getElementById('generateBankInstructionsBtn').disabled = false;
            
        } else if (data.status === 'completed') {
            // All done
            showPhase('phase3');
            updatePhaseStatus('phase3Status', 'Completed', 'completed');
            document.getElementById('markPaidBtn').disabled = true;
            document.getElementById('generatePayslipsBtn').disabled = false;
            document.getElementById('generateBankInstructionsBtn').disabled = false;
        }
    }
}

function updatePhaseStatus(elementId, status, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = status;
        element.className = 'phase-status';
        
        switch(type) {
            case 'pending':
                element.classList.add('status-pending');
                break;
            case 'in-progress':
                element.classList.add('status-in-progress');
                break;
            case 'completed':
                element.classList.add('status-completed');
                break;
            case 'approved':
                element.classList.add('status-approved');
                break;
            case 'rejected':
                element.classList.add('status-rejected');
                break;
        }
    }
}

function updateAlert(data) {
    const alert = document.getElementById('workflowAlert');
    const title = document.getElementById('alertTitle');
    const text = document.getElementById('alertText');
    
    if (!alert || !title || !text) return;
    
    if (!data.exists) {
        title.textContent = 'Ready to Start';
        text.textContent = 'No workflow exists for this month. Click "Generate Payroll" to begin.';
        alert.className = 'alert-custom alert-info';
        return;
    }
    
    switch(data.status) {
        case 'in_progress':
            if (data.canMakeAdjustments) {
                title.textContent = 'Adjustments Phase';
                text.textContent = 'Make any necessary adjustments before starting approval.';
                alert.className = 'alert-custom alert-warning';
            } else {
                title.textContent = 'Approval Phase';
                text.textContent = 'Workflow is in approval process. Pending approvals will be shown below.';
                alert.className = 'alert-custom alert-info';
            }
            break;
            
        case 'approved':
            title.textContent = 'Ready for Payment';
            text.textContent = 'All approvals complete! You can now mark payroll as paid.';
            alert.className = 'alert-custom alert-success';
            break;
            
        case 'completed':
            title.textContent = 'Payroll Completed';
            text.textContent = 'Payroll has been processed and paid.';
            alert.className = 'alert-custom alert-success';
            break;
            
        case 'rejected':
            title.textContent = 'Workflow Rejected';
            text.textContent = 'The workflow has been rejected. You can start over.';
            alert.className = 'alert-custom alert-danger';
            break;
            
        default:
            title.textContent = 'Workflow Status';
            text.textContent = `Status: ${data.status}`;
            alert.className = 'alert-custom alert-info';
    }
}

function updateTimeline(data) {
    if (!data.steps || !data.steps.length) return;
    
    data.steps.forEach((step, index) => {
        const stepNum = index + 1;
        const stepStatus = document.getElementById(`step${stepNum}Status`);
        const stepActions = document.getElementById(`step${stepNum}Actions`);
        
        if (stepStatus) {
            stepStatus.textContent = step.status.charAt(0).toUpperCase() + step.status.slice(1);
        }
        
        // Update marker
        const marker = document.getElementById(`step${stepNum}Marker`);
        if (marker) {
            marker.className = 'timeline-marker';
            
            if (step.status === 'approved') {
                marker.classList.add('completed');
                if (stepActions) stepActions.style.display = 'none';
            } else if (step.status === 'pending') {
                marker.classList.add('current');
                // Only show actions if this is the current step AND user has the right role
                if (stepActions && currentUser && currentUser.role === step.role) {
                    stepActions.style.display = 'block';
                } else if (stepActions) {
                    stepActions.style.display = 'none';
                }
            } else if (step.status === 'rejected') {
                marker.classList.add('status-rejected');
                if (stepActions) stepActions.style.display = 'none';
            }
        }
    });
}

function updateApprovalStepsVisibility() {
    // Hide all approval actions initially
    for (let i = 1; i <= 3; i++) {
        const actions = document.getElementById(`step${i}Actions`);
        if (actions) actions.style.display = 'none';
    }
    
    // Show only the actions for user's role
    if (currentUser) {
        const role = currentUser.role;
        let stepNumber = 1;
        
        // Map roles to step numbers
        if (role === 'hr') stepNumber = 1;
        else if (role === 'employee') stepNumber = 2; // Finance approval
        else if (role === 'admin') stepNumber = 3;
        
        const actions = document.getElementById(`step${stepNumber}Actions`);
        if (actions) {
            actions.style.display = 'block';
            console.log(`Showing approval actions for ${role} at step ${stepNumber}`);
        }
    }
}



function loadEmployeeDetails(employee) {
    if (!employee) return;
    
    const personalInfo = employee.personalInfo || {};
    const employmentInfo = employee.employmentInfo || {};
    const department = employmentInfo.departmentId || {};
    const position = employmentInfo.positionId || {};
    
    // Update employee details card
    $('#employeeName').text(`${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`);
    $('#employeeIdDisplay').text(employee.employeeId || 'N/A');
    $('#employeeDepartment').text(department.name || 'N/A');
    $('#employeePosition').text(position.name || 'N/A');
    $('#employeeSalary').text(`MWK ${(employmentInfo.currentSalary || 0).toLocaleString()}`);
    $('#currentEmployeeName').text(`${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`);
    
    // Show employee details card
    $('#employeeDetails').show();
    $('#currentAdjustmentsCard').show();
}

function enableAdjustmentButtons(enabled) {
    // Check if jQuery is available
    if (typeof $ === 'undefined') {
        console.error('jQuery not available for enableAdjustmentButtons');
        return;
    }
    
    $('#addEarningsBtn').prop('disabled', !enabled);
    $('#addSalaryAdvanceBtn').prop('disabled', !enabled);
    $('#addDeductionsBtn').prop('disabled', !enabled);
    $('#editPayrollBtn').prop('disabled', !enabled);
}

async function loadEmployeeAdjustments(employeeId) {
    try {
        // First, try to get the payroll for this employee
        const response = await axios.get(`/api/payroll?month=${currentMonth}&employeeId=${employeeId}`, {
            headers: getAuthHeaders()
        });
        
        if (response.data.payrolls && response.data.payrolls.length > 0) {
            const payroll = response.data.payrolls[0];
            
            // If payroll has adjustments, render them
            if (payroll.adjustments && payroll.adjustments.length > 0) {
                renderCurrentAdjustments(payroll.adjustments);
            } else {
                // Try to get adjustments from the adjustments endpoint
                try {
                    const adjResponse = await axios.get(`/api/payroll/adjustments/${currentMonth}?employeeId=${employeeId}`, {
                        headers: getAuthHeaders()
                    });
                    
                    if (adjResponse.data.adjustments) {
                        const employeeAdjustments = adjResponse.data.adjustments.filter(
                            adj => adj.employeeId === employeeId
                        );
                        renderCurrentAdjustments(employeeAdjustments);
                    } else {
                        renderCurrentAdjustments([]);
                    }
                } catch (adjError) {
                    console.log('No specific adjustments found:', adjError.message);
                    renderCurrentAdjustments([]);
                }
            }
        } else {
            renderCurrentAdjustments([]);
        }
    } catch (error) {
        console.error('Error loading employee adjustments:', error);
        renderCurrentAdjustments([]);
    }
}

function renderCurrentAdjustments(adjustments) {
    const tbody = $('#currentAdjustmentsTable tbody');
    
    if (adjustments.length === 0) {
        tbody.html('<tr><td colspan="5" class="text-center py-3">No adjustments yet</td></tr>');
        return;
    }
    
    const rows = adjustments.map((adj, index) => `
        <tr>
            <td>
                <span class="badge ${adj.type === 'addition' ? 'bg-success' : 'bg-danger'}">
                    ${adj.type}
                </span>
            </td>
            <td>${adj.reason || 'No description'}</td>
            <td>MWK ${(adj.amount || 0).toLocaleString()}</td>
            <td>
                <span class="badge ${adj.duration === 'permanent' ? 'bg-info' : 'bg-warning'}">
                    ${adj.duration || 'temporary'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="removeAdjustment('${adj._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    tbody.html(rows);
}

// Month list functions
async function loadMonthList() {
    try {
        const response = await axios.get('/api/payroll/periods/available', {
            headers: getAuthHeaders()
        });
        
        const months = response.data || [];
        const monthListHtml = months.map(month => `
            <li>
                <a class="dropdown-item month-item" href="#" data-month="${month._id}">
                    ${moment(month._id).format('MMMM YYYY')}
                    ${month._id === currentMonth ? '<i class="fas fa-check text-success ms-2"></i>' : ''}
                </a>
            </li>
        `).join('');
        
        const monthList = document.getElementById('monthList');
        if (monthList) {
            monthList.innerHTML = monthListHtml;
            
            // Add click event listeners
            const monthItems = monthList.querySelectorAll('.month-item');
            monthItems.forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    const month = this.getAttribute('data-month');
                    selectMonth(month);
                });
            });
        }
    } catch (error) {
        console.error('Error loading month list:', error);
        // Fallback to generated months
        const months = [];
        for (let i = 0; i < 12; i++) {
            const month = moment().subtract(i, 'months').format('YYYY-MM');
            months.push({
                _id: month,
                label: moment(month).format('MMMM YYYY')
            });
        }
        
        const monthListHtml = months.map(month => `
            <li>
                <a class="dropdown-item month-item" href="#" data-month="${month._id}">
                    ${month.label}
                    ${month._id === currentMonth ? '<i class="fas fa-check text-success ms-2"></i>' : ''}
                </a>
            </li>
        `).join('');
        
        const monthList = document.getElementById('monthList');
        if (monthList) {
            monthList.innerHTML = monthListHtml;
            
            // Add click event listeners
            const monthItems = monthList.querySelectorAll('.month-item');
            monthItems.forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    const month = this.getAttribute('data-month');
                    selectMonth(month);
                });
            });
        }
    }
}

function selectMonth(month) {
    currentMonth = month;
    document.getElementById('currentMonthDisplay').textContent = moment(currentMonth).format('MMMM YYYY');
    document.getElementById('payrollMonth').value = currentMonth;
    loadWorkflowStatus(currentMonth);
    loadAdjustments();
}

// ============================================
// PHASE 1: GENERATE PAYROLL
// ============================================
async function generatePayroll() {
    const month = document.getElementById('payrollMonth').value;
    
    if (!month) {
        showAlert('Please select a month', 'warning');
        return;
    }
    
    try {
        const result = await Swal.fire({
            title: 'Generate Payroll?',
            html: `
                <div class="text-start">
                    <p>Generate payroll for <strong>${moment(month).format('MMMM YYYY')}</strong>?</p>
                    <div class="alert alert-info">
                        This will create payroll records for all active employees.
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Generate',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                try {
                    const response = await axios.post(`/api/payroll/workflow/generate-payroll/${month}`, {}, {
                        headers: getAuthHeaders()
                    });
                    return response.data;
                } catch (error) {
                    Swal.showValidationMessage(
                        `Failed: ${error.response?.data?.message || error.message}`
                    );
                }
            }
        });
        
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Success!',
                html: `
                    <div class="text-center">
                        <div class="mb-3">
                            <i class="fas fa-check-circle fa-3x text-success"></i>
                        </div>
                        <p>${result.value.message}</p>
                        <div class="alert alert-info mt-3">
                            <strong>${result.value.payroll?.processedCount || 0}</strong> employee records processed
                        </div>
                    </div>
                `,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
            });
            
            // Reload workflow status
            await loadWorkflowStatus(month);
            loadAdjustments();
        }
    } catch (error) {
        console.error('Error generating payroll:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
    }
}

// ============================================
// PHASE 2: ADJUSTMENTS - COMPLETE FUNCTIONS
// ============================================

// Add Earnings (Bonuses, Allowances)
async function addEarnings() {
    if (!selectedEmployee) {
        showAlert('Please select an employee first', 'warning');
        return;
    }
    
    try {
        const { value: formValues } = await Swal.fire({
            title: 'Add Earnings',
            html: `
                <div class="text-start">
                    <div class="alert alert-info mb-3">
                        <strong>Employee:</strong> ${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}
                        <br>
                        <small>Employee ID: ${selectedEmployee.employeeId || 'N/A'}</small>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Earnings Type</label>
                        <select id="earningType" class="form-control">
                            <option value="performance">Performance Bonus</option>
                            <option value="annual">Annual Bonus</option>
                            <option value="allowance">Additional Allowance</option>
                            <option value="other">Other Earnings</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Amount (MWK)</label>
                        <div class="input-group">
                            <span class="input-group-text">MWK</span>
                            <input type="number" id="amount" class="form-control" placeholder="Enter amount" min="1" step="100" required>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Duration</label>
                        <select id="duration" class="form-control">
                            <option value="temporary">Temporary (This month only)</option>
                            <option value="permanent">Permanent (Apply to future months)</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea id="reason" class="form-control" placeholder="e.g., Performance bonus for Q4" rows="2"></textarea>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Add Earnings',
            cancelButtonText: 'Cancel',
            preConfirm: () => {
                const amount = parseFloat(document.getElementById('amount').value);
                
                if (!amount || amount <= 0) {
                    Swal.showValidationMessage('Please enter a valid amount greater than 0');
                    return false;
                }
                
                return {
                    type: document.getElementById('earningType').value,
                    amount: amount,
                    duration: document.getElementById('duration').value,
                    reason: document.getElementById('reason').value || `${document.getElementById('earningType').value} Earnings`
                };
            }
        });
        
        if (formValues) {
            // Find payroll for this employee
            const payrollResponse = await axios.get(`/api/payroll?month=${currentMonth}&employeeId=${selectedEmployee._id}`, {
                headers: getAuthHeaders()
            });
            
            if (!payrollResponse.data.payrolls || payrollResponse.data.payrolls.length === 0) {
                showAlert('No payroll found for this employee', 'error');
                return;
            }
            
            const payrollId = payrollResponse.data.payrolls[0]._id;
            
            // Prepare adjustment data
            const adjustmentData = {
                type: 'addition',
                category: formValues.type,
                amount: formValues.amount,
                duration: formValues.duration,
                reason: formValues.reason,
                appliedBy: currentUser.id
            };
            
            // Add adjustment
            const response = await axios.post(`/api/payroll/${payrollId}/adjustments`, adjustmentData, {
                headers: getAuthHeaders()
            });
            
            Swal.fire({
                title: 'Success!',
                html: `
                    <div class="text-center">
                        <div class="mb-3">
                            <i class="fas fa-check-circle fa-3x text-success"></i>
                        </div>
                        <p>Earnings added successfully</p>
                        <div class="alert alert-info mt-3">
                            <strong>MWK ${formValues.amount.toLocaleString()}</strong> added as ${formValues.type} earnings
                        </div>
                    </div>
                `,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
            });
            
            // Reload adjustments
            await loadEmployeeAdjustments(selectedEmployee._id);
        }
    } catch (error) {
        console.error('Error adding earnings:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
    }
}

// Add Salary Advance with Recovery
async function addSalaryAdvance() {
    if (!selectedEmployee) {
        showAlert('Please select an employee first', 'warning');
        return;
    }
    
    try {
        const maxAdvance = (selectedEmployee.employmentInfo.currentSalary || 0) * 0.5;
        
        const { value: formValues } = await Swal.fire({
            title: 'Add Salary Advance',
            html: `
                <div class="text-start">
                    <div class="alert alert-info mb-3">
                        <strong>Employee:</strong> ${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}
                        <br>
                        <small>Maximum advance: MWK ${maxAdvance.toLocaleString()} (50% of basic salary)</small>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Advance Amount (MWK)</label>
                        <input type="number" id="amount" class="form-control" placeholder="Enter amount" min="1" max="${maxAdvance}" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Recovery Period (Months)</label>
                        <select id="recoveryMonths" class="form-control">
                            <option value="1">1 Month</option>
                            <option value="2">2 Months</option>
                            <option value="3" selected>3 Months</option>
                            <option value="4">4 Months</option>
                            <option value="5">5 Months</option>
                            <option value="6">6 Months</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Reason</label>
                        <textarea id="reason" class="form-control" placeholder="Reason for advance" rows="2"></textarea>
                    </div>
                    
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        The advance will be recovered over the selected months.
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Add Advance',
            cancelButtonText: 'Cancel',
            preConfirm: () => {
                const amount = parseFloat(document.getElementById('amount').value);
                
                if (amount > maxAdvance) {
                    Swal.showValidationMessage(`Amount cannot exceed MWK ${maxAdvance.toLocaleString()}`);
                    return false;
                }
                
                if (amount <= 0) {
                    Swal.showValidationMessage('Amount must be greater than 0');
                    return false;
                }
                
                return {
                    amount: amount,
                    recoveryMonths: parseInt(document.getElementById('recoveryMonths').value),
                    reason: document.getElementById('reason').value || 'Salary Advance'
                };
            }
        });
        
        if (formValues) {
            // Find payroll for this employee
            const payrollResponse = await axios.get(`/api/payroll?month=${currentMonth}&employeeId=${selectedEmployee._id}`, {
                headers: getAuthHeaders()
            });
            
            if (!payrollResponse.data.payrolls || payrollResponse.data.payrolls.length === 0) {
                showAlert('No payroll found for this employee', 'error');
                return;
            }
            
            const payrollId = payrollResponse.data.payrolls[0]._id;
            const monthlyDeduction = formValues.amount / formValues.recoveryMonths;
            
            // Create advance using the advance endpoint
            const response = await axios.post(`/api/payroll/${payrollId}/advance`, {
                amount: formValues.amount,
                numberOfMonths: formValues.recoveryMonths,
                reason: formValues.reason,
                monthlyDeduction: monthlyDeduction
            }, {
                headers: getAuthHeaders()
            });
            
            Swal.fire({
                title: 'Success!',
                html: `
                    <div class="text-center">
                        <div class="mb-3">
                            <i class="fas fa-check-circle fa-3x text-success"></i>
                        </div>
                        <p>Salary advance added successfully</p>
                        <div class="alert alert-info mt-3">
                            <strong>MWK ${formValues.amount.toLocaleString()}</strong> will be recovered over <strong>${formValues.recoveryMonths} months</strong><br>
                            <strong>Monthly deduction:</strong> MWK ${monthlyDeduction.toLocaleString()}
                        </div>
                    </div>
                `,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
            });
            
            // Reload adjustments
            await loadEmployeeAdjustments(selectedEmployee._id);
        }
    } catch (error) {
        console.error('Error adding salary advance:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
    }
}

// Add Deductions
async function addDeductions() {
    if (!selectedEmployee) {
        showAlert('Please select an employee first', 'warning');
        return;
    }
    
    try {
        const { value: formValues } = await Swal.fire({
            title: 'Add Deductions',
            html: `
                <div class="text-start">
                    <div class="alert alert-info mb-3">
                        <strong>Employee:</strong> ${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Deduction Type</label>
                        <select id="deductionType" class="form-control">
                            <option value="loan">Loan Repayment</option>
                            <option value="advance">Salary Advance Recovery</option>
                            <option value="fine">Fine/Penalty</option>
                            <option value="insurance">Insurance</option>
                            <option value="tax">Additional Tax</option>
                            <option value="other">Other Deduction</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Amount (MWK)</label>
                        <input type="number" id="amount" class="form-control" placeholder="Enter amount" min="1" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Duration</label>
                        <select id="duration" class="form-control">
                            <option value="temporary">Temporary (One-time)</option>
                            <option value="recovery">Recovery (Multiple months)</option>
                            <option value="permanent">Permanent</option>
                        </select>
                    </div>
                    
                    <div class="mb-3" id="recoveryDetails" style="display: none;">
                        <label class="form-label">Recovery Period (Months)</label>
                        <input type="number" id="recoveryMonths" class="form-control" placeholder="Number of months" min="1" value="3">
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea id="reason" class="form-control" placeholder="Description of deduction" rows="2"></textarea>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Add Deduction',
            cancelButtonText: 'Cancel',
            didOpen: () => {
                // Show/hide recovery details based on duration selection
                document.getElementById('duration').addEventListener('change', function() {
                    const recoveryDetails = document.getElementById('recoveryDetails');
                    recoveryDetails.style.display = this.value === 'recovery' ? 'block' : 'none';
                });
            },
            preConfirm: () => {
                const amount = parseFloat(document.getElementById('amount').value);
                
                if (!amount || amount <= 0) {
                    Swal.showValidationMessage('Please enter a valid amount greater than 0');
                    return false;
                }
                
                return {
                    type: document.getElementById('deductionType').value,
                    amount: amount,
                    duration: document.getElementById('duration').value,
                    recoveryMonths: document.getElementById('recoveryMonths') ? parseInt(document.getElementById('recoveryMonths').value) : 1,
                    reason: document.getElementById('reason').value
                };
            }
        });
        
        if (formValues) {
            // Find payroll for this employee
            const payrollResponse = await axios.get(`/api/payroll?month=${currentMonth}&employeeId=${selectedEmployee._id}`, {
                headers: getAuthHeaders()
            });
            
            if (!payrollResponse.data.payrolls || payrollResponse.data.payrolls.length === 0) {
                showAlert('No payroll found for this employee', 'error');
                return;
            }
            
            const payrollId = payrollResponse.data.payrolls[0]._id;
            
            // Prepare adjustment data
            const adjustmentData = {
                type: 'deduction',
                category: formValues.type,
                amount: formValues.amount,
                duration: formValues.duration,
                reason: formValues.reason || `${formValues.type} Deduction`,
                appliedBy: currentUser.id
            };
            
            // Add recovery period if selected
            if (formValues.duration === 'recovery') {
                adjustmentData.recoveryPeriod = {
                    numberOfMonths: formValues.recoveryMonths,
                    amountPerMonth: formValues.amount / formValues.recoveryMonths,
                    totalAmount: formValues.amount
                };
                adjustmentData.remainingMonths = formValues.recoveryMonths - 1;
            }
            
            // Add the adjustment
            const response = await axios.post(`/api/payroll/${payrollId}/adjustments`, adjustmentData, {
                headers: getAuthHeaders()
            });
            
            Swal.fire({
                title: 'Success!',
                text: 'Deduction added successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Reload adjustments
            await loadEmployeeAdjustments(selectedEmployee._id);
        }
    } catch (error) {
        console.error('Error adding deduction:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
    }
}

// Edit Payroll Details
async function editPayroll() {
    if (!selectedEmployee) {
        showAlert('Please select an employee first', 'warning');
        return;
    }
    
    try {
        // Find the payroll for this employee
        const payrollResponse = await axios.get(`/api/payroll?month=${currentMonth}&employeeId=${selectedEmployee._id}`, {
            headers: getAuthHeaders()
        });
        
        if (!payrollResponse.data.payrolls || payrollResponse.data.payrolls.length === 0) {
            showAlert('No payroll found for this employee', 'error');
            return;
        }
        
        const payroll = payrollResponse.data.payrolls[0];
        
        const { value: formValues } = await Swal.fire({
            title: 'Edit Payroll Details',
            html: `
                <div class="text-start">
                    <div class="alert alert-info mb-3">
                        <strong>Employee:</strong> ${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <label class="form-label">Days Worked</label>
                            <input type="number" id="daysWorked" class="form-control" value="${payroll.payPeriod?.daysWorked || 0}" min="0" max="${payroll.payPeriod?.workingDays || 0}">
                            <small class="text-muted">Total working days: ${payroll.payPeriod?.workingDays || 0}</small>
                        </div>
                    </div>
                    
                    <h6 class="mt-4 mb-3">Allowances</h6>
                    <div class="row mb-3">
                        <div class="col-md-4">
                            <label class="form-label">Transport</label>
                            <input type="number" id="transport" class="form-control" value="${payroll.allowances?.transport || 0}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Housing</label>
                            <input type="number" id="housing" class="form-control" value="${payroll.allowances?.housing || 0}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Medical</label>
                            <input type="number" id="medical" class="form-control" value="${payroll.allowances?.medical || 0}">
                        </div>
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-4">
                            <label class="form-label">Meals</label>
                            <input type="number" id="meals" class="form-control" value="${payroll.allowances?.meals || 0}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Communication</label>
                            <input type="number" id="communication" class="form-control" value="${payroll.allowances?.communication || 0}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Other Allowances</label>
                            <input type="number" id="otherAllowances" class="form-control" value="${payroll.allowances?.other || 0}">
                        </div>
                    </div>
                    
                    <h6 class="mt-4 mb-3">Bonuses</h6>
                    <div class="row mb-3">
                        <div class="col-md-4">
                            <label class="form-label">Performance Bonus</label>
                            <input type="number" id="performanceBonus" class="form-control" value="${payroll.bonuses?.performance || 0}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Annual Bonus</label>
                            <input type="number" id="annualBonus" class="form-control" value="${payroll.bonuses?.annual || 0}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Other Bonuses</label>
                            <input type="number" id="otherBonuses" class="form-control" value="${payroll.bonuses?.other || 0}">
                        </div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Save Changes',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true,
            preConfirm: () => {
                return {
                    'payPeriod.daysWorked': parseInt(document.getElementById('daysWorked').value),
                    'allowances.transport': parseFloat(document.getElementById('transport').value),
                    'allowances.housing': parseFloat(document.getElementById('housing').value),
                    'allowances.medical': parseFloat(document.getElementById('medical').value),
                    'allowances.meals': parseFloat(document.getElementById('meals').value),
                    'allowances.communication': parseFloat(document.getElementById('communication').value),
                    'allowances.other': parseFloat(document.getElementById('otherAllowances').value),
                    'bonuses.performance': parseFloat(document.getElementById('performanceBonus').value),
                    'bonuses.annual': parseFloat(document.getElementById('annualBonus').value),
                    'bonuses.other': parseFloat(document.getElementById('otherBonuses').value)
                };
            }
        });
        
        if (formValues) {
            const response = await axios.put(`/api/payroll/${payroll._id}`, formValues, {
                headers: getAuthHeaders()
            });
            
            Swal.fire({
                title: 'Success!',
                text: 'Payroll updated successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Reload employee details and adjustments
            await loadEmployeeAdjustments(selectedEmployee._id);
        }
    } catch (error) {
        console.error('Error editing payroll:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
    }
}

// Remove adjustment
async function removeAdjustment(adjustmentId) {
    try {
        if (!selectedEmployee) {
            showAlert('Please select an employee first', 'warning');
            return;
        }
        
        const result = await Swal.fire({
            title: 'Remove Adjustment?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Remove',
            cancelButtonText: 'Cancel'
        });
        
        if (result.isConfirmed) {
            // Find the payroll first
            const payrollResponse = await axios.get(`/api/payroll?month=${currentMonth}&employeeId=${selectedEmployee._id}`, {
                headers: getAuthHeaders()
            });
            
            if (payrollResponse.data.payrolls && payrollResponse.data.payrolls.length > 0) {
                const payrollId = payrollResponse.data.payrolls[0]._id;
                
                // Remove the adjustment
                const response = await axios.delete(`/api/payroll/${payrollId}/adjustments/${adjustmentId}`, {
                    headers: getAuthHeaders()
                });
                
                Swal.fire({
                    title: 'Removed!',
                    text: 'Adjustment removed successfully',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
                
                // Reload adjustments
                await loadEmployeeAdjustments(selectedEmployee._id);
            }
        }
    } catch (error) {
        console.error('Error removing adjustment:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
    }
}

// View all adjustments
async function viewAllAdjustments() {
    await loadAdjustments();
    
    const tbody = document.querySelector('#adjustmentsTable tbody');
    if (tbody.children.length === 1 && tbody.children[0].textContent.includes('No adjustments')) {
        Swal.fire('Info', 'No adjustments found for this month', 'info');
        return;
    }
    
    // Show detailed view in modal
    const adjustments = await loadAdjustmentsForView();
    
    if (adjustments.length === 0) {
        Swal.fire('Info', 'No adjustments found for this month', 'info');
        return;
    }
    
    const adjustmentsHtml = adjustments.map(adj => `
        <div class="adjustment-card mb-3">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h6 class="mb-1">${adj.employeeName}</h6>
                    <small class="text-muted">${adj.employeeId} • ${adj.department}</small>
                </div>
                <span class="badge ${adj.type === 'addition' ? 'bg-success' : 'bg-danger'}">
                    ${adj.type}
                </span>
            </div>
            <p class="mb-1 mt-2">${adj.reason}</p>
            <div class="d-flex justify-content-between align-items-center mt-2">
                <small class="text-muted">${moment(adj.appliedAt).format('DD MMM YYYY')}</small>
                <strong>MWK ${adj.amount?.toLocaleString() || '0'}</strong>
            </div>
        </div>
    `).join('');
    
    Swal.fire({
        title: 'All Adjustments',
        html: `<div style="max-height: 400px; overflow-y: auto;">${adjustmentsHtml}</div>`,
        width: 700,
        showConfirmButton: false,
        showCloseButton: true
    });
}

async function loadAdjustmentsForView() {
    try {
        const response = await axios.get(`/api/payroll/adjustments/${currentMonth}`, {
            headers: getAuthHeaders()
        });
        return response.data.adjustments || [];
    } catch (error) {
        console.error('Error loading adjustments:', error);
        return [];
    }
}

// Start Approval Process
function initSelect2() {
    console.log('Initializing Select2...');
    
    if (typeof jQuery === 'undefined') {
        console.error('jQuery is not loaded!');
        showAlert('jQuery is required for employee selection. Please refresh the page.', 'error');
        return;
    }
    
    if (typeof $.fn.select2 === 'undefined') {
        console.error('Select2 is not loaded!');
        return;
    }
    
    try {
        $('#employeeSelect').select2({
            placeholder: "Search employee by name or ID...",
            allowClear: true,
            width: '100%',
            minimumInputLength: 2,
            ajax: {
                url: '/api/employees/select-search', // Updated endpoint
                dataType: 'json',
                delay: 300,
                data: function (params) {
                    return {
                        q: params.term,
                        page: params.page || 1
                    };
                },
                processResults: function (data, params) {
                    params.page = params.page || 1;
                    return {
                        results: data.results || [],
                        pagination: {
                            more: data.pagination && data.pagination.more
                        }
                    };
                },
                cache: true,
                headers: getAuthHeaders()
            }
        }).on('select2:select', function (e) {
            const data = e.params.data;
            selectedEmployee = data.employee;
            loadEmployeeDetails(selectedEmployee);
            enableAdjustmentButtons(true);
            loadEmployeeAdjustments(selectedEmployee._id);
        }).on('select2:clear', function () {
            selectedEmployee = null;
            $('#employeeDetails').hide();
            $('#currentAdjustmentsCard').hide();
            enableAdjustmentButtons(false);
        });
        
        console.log('Select2 initialized successfully');
    } catch (error) {
        console.error('Error initializing Select2:', error);
    }
}

// Fix the startApprovalProcess function
async function startApprovalProcess() {
    try {
        const result = await Swal.fire({
            title: 'Start Approval Process?',
            html: `
                <div class="text-start">
                    <p>Start approval process for <strong>${moment(currentMonth).format('MMMM YYYY')}</strong>?</p>
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Once started, no more adjustments can be made.
                    </div>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Start Approval',
            cancelButtonText: 'Cancel'
        });
        
        if (result.isConfirmed) {
            showLoading(true);
            const response = await axios.post(`/api/workflow/start-approval/${currentMonth}`, {}, {
                headers: getAuthHeaders()
            });
            
            Swal.fire({
                title: 'Started!',
                text: response.data.message,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            await loadWorkflowStatus(currentMonth);
            showLoading(false);
        }
    } catch (error) {
        console.error('Error starting approval:', error);
        showAlert(error.response?.data?.message || error.message || 'Failed to start approval process', 'error');
        showLoading(false);
    }
}

// Fix the approveStep function
async function approveStep(role) {
    try {
        // Check if current user has the right role
        if (currentUser.role !== role && currentUser.role !== 'admin') {
            Swal.fire('Error!', `You need ${role.toUpperCase()} role to approve this step`, 'error');
            return;
        }
        
        const { value: notes } = await Swal.fire({
            title: `Approve as ${role.toUpperCase()}?`,
            input: 'textarea',
            inputLabel: 'Notes (optional)',
            inputPlaceholder: 'Add any notes...',
            showCancelButton: true,
            confirmButtonText: 'Approve',
            cancelButtonText: 'Cancel'
        });
        
        if (notes !== undefined) {
            showLoading(true);
            const response = await axios.post('/api/workflow/approve-step', {
                notes: notes,
                role: role,
                month: currentMonth
            }, {
                headers: getAuthHeaders()
            });
            
            Swal.fire({
                title: 'Approved!',
                text: response.data.message,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            await loadWorkflowStatus(currentMonth);
            showLoading(false);
        }
    } catch (error) {
        console.error('Error approving step:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
        showLoading(false);
    }
}

// Fix the rejectStep function
async function rejectStep(role) {
    try {
        // Check if current user has the right role
        if (currentUser.role !== role && currentUser.role !== 'admin') {
            Swal.fire('Error!', `You need ${role.toUpperCase()} role to reject this step`, 'error');
            return;
        }
        
        const { value: reason } = await Swal.fire({
            title: `Reject as ${role.toUpperCase()}?`,
            input: 'textarea',
            inputLabel: 'Reason for rejection',
            inputPlaceholder: 'Please provide a reason...',
            inputAttributes: { required: true },
            showCancelButton: true,
            confirmButtonText: 'Reject',
            cancelButtonText: 'Cancel',
            inputValidator: (value) => {
                if (!value) {
                    return 'Please provide a reason for rejection';
                }
            }
        });
        
        if (reason) {
            showLoading(true);
            const response = await axios.post('/api/workflow/reject-step', {
                reason: reason,
                role: role,
                month: currentMonth
            }, {
                headers: getAuthHeaders()
            });
            
            Swal.fire({
                title: 'Rejected!',
                text: response.data.message,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            await loadWorkflowStatus(currentMonth);
            showLoading(false);
        }
    } catch (error) {
        console.error('Error rejecting step:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
        showLoading(false);
    }
}

// Mark payroll as paid
async function markPayrollPaid() {
    try {
        const result = await Swal.fire({
            title: 'Mark Payroll as Paid?',
            html: `
                <div class="text-start">
                    <p>This will mark all payroll records for <strong>${moment(currentMonth).format('MMMM YYYY')}</strong> as paid.</p>
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        This action cannot be undone.
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Mark as Paid',
            cancelButtonText: 'Cancel'
        });
        
        if (result.isConfirmed) {
            const response = await axios.post(`/api/payroll/workflow/mark-paid/${currentMonth}`, {}, {
                headers: getAuthHeaders()
            });
            
            Swal.fire({
                title: 'Success!',
                html: `
                    <div class="text-center">
                        <div class="mb-3">
                            <i class="fas fa-check-circle fa-3x text-success"></i>
                        </div>
                        <p>${response.data.message}</p>
                        <div class="alert alert-info mt-3">
                            <strong>${response.data.count}</strong> payroll records marked as paid
                        </div>
                    </div>
                `,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
            });
            
            await loadWorkflowStatus(currentMonth);
        }
    } catch (error) {
        console.error('Error marking payroll as paid:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
    }
}

// Document Generation
async function generatePayslips() {
    try {
        const result = await Swal.fire({
            title: 'Generate Payslips?',
            html: `
                <div class="text-start">
                    <p>Generate payslips for <strong>${moment(currentMonth).format('MMMM YYYY')}</strong>.</p>
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Payslips will be generated as PDF files for each employee.
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Generate Payslips',
            cancelButtonText: 'Cancel'
        });
        
        if (result.isConfirmed) {
            // Generate consolidated payslips
            window.open(`/api/payroll/payslips/consolidated?month=${currentMonth}`, '_blank');
        }
    } catch (error) {
        console.error('Error generating payslips:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
    }
}

async function generateBankInstructions() {
    try {
        const result = await Swal.fire({
            title: 'Generate Bank Instructions?',
            html: `
                <div class="text-start">
                    <p>Generate bank payment instructions for <strong>${moment(currentMonth).format('MMMM YYYY')}</strong>.</p>
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        You can download as PDF or Excel format.
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Generate',
            cancelButtonText: 'Cancel'
        });
        
        if (result.isConfirmed) {
            window.open(`/api/payroll/bank-instruction?month=${currentMonth}`, '_blank');
        }
    } catch (error) {
        console.error('Error generating bank instructions:', error);
        showAlert(error.response?.data?.message || error.message, 'error');
    }
}

// Helper Functions
async function loadAdjustments() {
    try {
        const response = await axios.get(`/api/payroll/adjustments/${currentMonth}`, {
            headers: getAuthHeaders()
        });
        
        const adjustments = response.data.adjustments || [];
        renderAdjustmentsTable(adjustments);
    } catch (error) {
        console.error('Error loading adjustments:', error);
    }
}

function renderAdjustmentsTable(adjustments) {
    const tbody = document.querySelector('#adjustmentsTable tbody');
    
    if (!tbody) return;
    
    if (adjustments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3">No adjustments yet</td></tr>';
        return;
    }
    
    const rows = adjustments.map(adj => `
        <tr>
            <td>${moment(adj.appliedAt).format('DD MMM YYYY')}</td>
            <td>
                <span class="badge ${adj.type === 'addition' ? 'bg-success' : 'bg-danger'}">
                    ${adj.type}
                </span>
            </td>
            <td>${adj.reason}</td>
            <td>MWK ${adj.amount?.toLocaleString() || '0'}</td>
            <td>
                <span class="badge ${adj.duration === 'permanent' ? 'bg-info' : 'bg-warning'}">
                    ${adj.duration}
                </span>
            </td>
            <td>${adj.appliedBy?.name || 'System'}</td>
        </tr>
    `).join('');
    
    tbody.innerHTML = rows;
}

function viewGeneratedPayroll() {
    window.location.href = `/admin/payrolls?month=${currentMonth}`;
}

function previewPayslips() {
    window.open(`/api/payroll/payslips/consolidated?month=${currentMonth}&preview=true`, '_blank');
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showAlert(message, type = 'info') {
    const alertTypes = {
        success: { icon: 'success', title: 'Success' },
        error: { icon: 'error', title: 'Error' },
        warning: { icon: 'warning', title: 'Warning' },
        info: { icon: 'info', title: 'Info' }
    };
    
    const alertConfig = alertTypes[type] || alertTypes.info;
    
    Swal.fire({
        title: alertConfig.title,
        text: message,
        icon: alertConfig.icon,
        timer: 3000,
        showConfirmButton: false
    });
}

// Export functions to global scope
window.approveStep = approveStep;
window.rejectStep = rejectStep;
window.removeAdjustment = removeAdjustment;

// Add loading overlay to HTML if not present
if (!document.getElementById('loadingOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="ms-2">Loading...</div>
    `;
    overlay.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        z-index: 9999;
        justify-content: center;
        align-items: center;
        flex-direction: column;
    `;
    
    const spinnerStyle = document.createElement('style');
    spinnerStyle.textContent = `
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    
    document.head.appendChild(spinnerStyle);
    document.body.appendChild(overlay);
}