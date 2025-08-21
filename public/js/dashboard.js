document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let authToken = localStorage.getItem('authToken');
    let currentPeriod = 12;
    let currentPeriodType = 'month';
    
    // Chart instances
    let employeeDistributionChart;
    let payrollTrendChart;
    let departmentBudgetChart;
    let employeeActivityChart; // Changed from employeeStatusChart
    
    // Initialize the dashboard
    initDashboard();
    
    // Event listeners
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active button
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update period and refresh data
            currentPeriod = parseInt(this.dataset.period);
            currentPeriodType = this.dataset.type;
            refreshDashboardData();
        });
    });
    
    // Employee distribution filter
    document.querySelectorAll('.emp-dist-filter').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active filter
            document.querySelectorAll('.emp-dist-filter').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Update dropdown text
            document.getElementById('empDistDropdown').textContent = this.textContent;
            
            // Update chart
            updateEmployeeDistributionChart(this.dataset.type);
        });
    });
    
    // Payroll trend filter
    document.querySelectorAll('.payroll-trend-filter').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active filter
            document.querySelectorAll('.payroll-trend-filter').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Update dropdown text
            document.getElementById('payrollTrendDropdown').textContent = this.textContent;
            
            // Update chart
            updatePayrollTrendChart(this.dataset.type);
        });
    });
    
    // Initialize dashboard
    function initDashboard() {
        if (!authToken) {
            showError('Authentication token not found. Please login again.');
            return;
        }
        
        refreshDashboardData();
    }
    
    // Refresh all dashboard data
    function refreshDashboardData() {
        showLoading();
        
        // Fetch all data in parallel
        Promise.all([
            fetchSummaryData(),
            fetchEmployeeData(),
            fetchPayrollData()
        ])
        .then(() => {
            hideLoading();
        })
        .catch(error => {
            hideLoading();
            showError('Failed to load dashboard data: ' + error.message);
        });
    }
    
    // Fetch summary data
    function fetchSummaryData() {
        return axios.get('/api/dashboard/summary', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                period: currentPeriod,
                type: currentPeriodType
            }
        })
        .then(response => {
            if (response.data.success) {
                updateSummaryCards(response.data.data);
                updateEmployeeActivityChart(response.data.data); // Update activity chart with summary data
            } else {
                throw new Error(response.data.message || 'Failed to fetch summary data');
            }
        })
        .catch(error => {
            console.error('Error fetching summary data:', error);
            throw error;
        });
    }
    
    // Fetch employee data
    function fetchEmployeeData() {
        return axios.get('/api/dashboard/employees', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                period: currentPeriod,
                type: currentPeriodType
            }
        })
        .then(response => {
            if (response.data.success) {
                window.employeeData = response.data.data; // Store for chart updates
                updateEmployeeDistributionChart('department');
            } else {
                throw new Error(response.data.message || 'Failed to fetch employee data');
            }
        })
        .catch(error => {
            console.error('Error fetching employee data:', error);
            throw error;
        });
    }
    
    // Fetch payroll data
    function fetchPayrollData() {
        return axios.get('/api/dashboard/payroll', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                period: currentPeriod,
                type: currentPeriodType
            }
        })
        .then(response => {
            if (response.data.success) {
                window.payrollData = response.data.data; // Store for chart updates
                updatePayrollTrendChart('gross');
                updateDepartmentBudgetChart(response.data.data);
            } else {
                throw new Error(response.data.message || 'Failed to fetch payroll data');
            }
        })
        .catch(error => {
            console.error('Error fetching payroll data:', error);
            throw error;
        });
    }
    
    // Update summary cards
    function updateSummaryCards(data) {
        // Employees
        document.getElementById('totalEmployees').textContent = data.employees.total;
        document.getElementById('activeEmployees').textContent = data.employees.active;
        
        // Calculate active percentage
        const activePercentage = data.employees.total > 0 
            ? ((data.employees.active / data.employees.total) * 100).toFixed(1)
            : 0;
        document.getElementById('activePercentage').textContent = activePercentage;
        
        document.getElementById('employeeChange').innerHTML = 
            `<i class="fas fa-caret-up me-1"></i> ${data.employees.newHires} new hires`;
        document.getElementById('terminations').innerHTML = 
            `<i class="fas fa-caret-down me-1"></i> ${data.employees.terminations} terminations`;
        
        // Payroll
        const payrollTrend = data.payroll.trends[0];
        if (payrollTrend) {
            document.getElementById('totalPayroll').textContent = formatCurrency(payrollTrend.totalGrossPay);
            const avgSalary = payrollTrend.totalGrossPay / payrollTrend.employeeCount;
            document.getElementById('avgSalary').textContent = formatCurrency(avgSalary);
        }
        
        // Turnover rate (from employee data if available)
        if (window.employeeData) {
            document.getElementById('turnoverRate').textContent = window.employeeData.summary.turnoverRate;
        }
    }
    
    // Update employee distribution chart
    function updateEmployeeDistributionChart(type = 'department') {
        if (!window.employeeData) return;
        
        const distributionData = window.employeeData.distributions[type];
        if (!distributionData) return;
        
        const labels = distributionData.map(item => item._id);
        const data = distributionData.map(item => item.count);
        const backgroundColors = generateColors(labels.length);
        
        const ctx = document.getElementById('employeeDistributionChart').getContext('2d');
        
        // Destroy previous chart if exists
        if (employeeDistributionChart) {
            employeeDistributionChart.destroy();
        }
        
        employeeDistributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Update payroll trend chart
    function updatePayrollTrendChart(type = 'gross') {
        if (!window.payrollData) return;
        
        const trends = window.payrollData.monthlyTrends;
        if (!trends || trends.length === 0) return;
        
        const labels = trends.map(item => formatMonthYear(item._id));
        let data, label;
        
        switch(type) {
            case 'net':
                data = trends.map(item => item.totalNetPay);
                label = 'Net Pay';
                break;
            case 'tax':
                data = trends.map(item => item.totalTax);
                label = 'Tax';
                break;
            default: // gross
                data = trends.map(item => item.totalGrossPay);
                label = 'Gross Pay';
        }
        
        const ctx = document.getElementById('payrollTrendChart').getContext('2d');
        
        // Destroy previous chart if exists
        if (payrollTrendChart) {
            payrollTrendChart.destroy();
        }
        
        payrollTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: '#0a1f3a',
                    backgroundColor: 'rgba(10, 31, 58, 0.1)',
                    pointBackgroundColor: '#0a1f3a',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Update department budget chart
    function updateDepartmentBudgetChart(data) {
        const departmentPayroll = data.departmentPayroll;
        if (!departmentPayroll || departmentPayroll.length === 0) return;
        
        const labels = departmentPayroll.map(item => item._id);
        const allocated = departmentPayroll.map(item => item.avgSalary * item.totalEmployees); // Simplified allocation
        const spent = departmentPayroll.map(item => item.totalPayroll);
        
        const ctx = document.getElementById('departmentBudgetChart').getContext('2d');
        
        // Destroy previous chart if exists
        if (departmentBudgetChart) {
            departmentBudgetChart.destroy();
        }
        
        departmentBudgetChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Budget Allocated',
                        data: allocated,
                        backgroundColor: 'rgba(232, 96, 41, 0.7)',
                        borderColor: 'rgba(232, 96, 41, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Budget Spent',
                        data: spent,
                        backgroundColor: 'rgba(10, 31, 58, 0.7)',
                        borderColor: 'rgba(10, 31, 58, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Update employee activity chart (replaces the old status chart)
    function updateEmployeeActivityChart(data) {
        if (!data || !data.employees) return;
        
        const activeCount = data.employees.active || 0;
        const inactiveCount = data.employees.total - activeCount;
        
        const ctx = document.getElementById('employeeActivityChart').getContext('2d');
        
        // Destroy previous chart if exists
        if (employeeActivityChart) {
            employeeActivityChart.destroy();
        }
        
        employeeActivityChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Active Employees', 'Inactive Employees'],
                datasets: [{
                    data: [activeCount, inactiveCount],
                    backgroundColor: ['#28a745', '#dc3545'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Helper functions
    function showLoading() {
        document.getElementById('loadingSpinner').classList.add('show');
    }
    
    function hideLoading() {
        document.getElementById('loadingSpinner').classList.remove('show');
    }
    
    function showError(message) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: message,
            confirmButtonText: 'OK'
        });
    }
    
    function formatCurrency(amount) {
        if (amount >= 1000000) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'MWK',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(amount).replace(/(\.|,)00$/g, '') + 'M';
        }
        if (amount >= 1000) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'MWK',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(amount).replace(/(\.|,)00$/g, '') + 'K';
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'MWK',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
    
    function formatMonthYear(monthYear) {
        const [year, month] = monthYear.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    
    function generateColors(count) {
        const baseColors = ['#0a1f3a', '#e86029', '#f7d7b3', '#28a745', '#0f2a4d'];
        const colors = [];
        
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        
        return colors;
    }
});