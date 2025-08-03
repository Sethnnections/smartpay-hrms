// SmartPay Admin Dashboard JavaScript
class SmartPayDashboard {
    constructor() {
        this.initializeDateTime();
        this.setupEventListeners();
        this.animateCounters();
        this.setupSidebar();
    }

    setupSidebar() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    // Mobile behavior
                    sidebar.classList.toggle('mobile-open');
                    sidebarOverlay.classList.toggle('active');
                } else {
                    // Desktop behavior
                    sidebar.classList.toggle('collapsed');
                    mainContent.classList.toggle('expanded');
                }
            });
        }

        // Close sidebar when clicking overlay
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            });
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            }
        });
    }

    initializeDateTime() {
        const dateTimeElement = document.getElementById('dateTime');
        if (!dateTimeElement) return;

        const updateDateTime = () => {
            const now = new Date();
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            dateTimeElement.textContent = now.toLocaleDateString('en-US', options);
        };

        updateDateTime();
        setInterval(updateDateTime, 60000);
    }

    setupEventListeners() {
        // Navigation links active state is handled by EJS template
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch(e.key) {
                    case 'b':
                        e.preventDefault();
                        const sidebarToggle = document.getElementById('sidebarToggle');
                        if (sidebarToggle) sidebarToggle.click();
                        break;
                }
            }

            // Escape key closes mobile sidebar
            if (e.key === 'Escape') {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (sidebar && sidebar.classList.contains('mobile-open')) {
                    sidebar.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                }
            }
        });
    }

    animateCounters() {
        const counters = [
            { element: document.getElementById('employeeCount'), target: 247, duration: 2000 },
            { element: document.getElementById('departmentCount'), target: 15, duration: 1500 },
            { element: document.getElementById('positionCount'), target: 42, duration: 1800 }
        ];

        counters.forEach(counter => {
            if (counter.element) {
                this.animateCounter(counter.element, counter.target, counter.duration);
            }
        });
    }

    animateCounter(element, target, duration) {
        let start = 0;
        const increment = target / (duration / 16);
        
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(start);
            }
        }, 16);
    }
}

// Dashboard Charts
function initializeDashboardCharts() {
    createDepartmentChart();
    createPayrollChart();
}

function createDepartmentChart() {
    const canvas = document.getElementById('departmentChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['IT', 'HR', 'Finance', 'Operations', 'Marketing', 'Others'],
            datasets: [{
                data: [45, 25, 30, 35, 28, 84],
                backgroundColor: [
                    '#0a1f3a',
                    '#FFD700',
                    '#0f2a4d',
                    '#64748b',
                    '#0a1f3a',
                    '#FFD700'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function createPayrollChart() {
    const canvas = document.getElementById('payrollChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Monthly Payroll ($M)',
                data: [2.1, 2.2, 2.0, 2.3, 2.4, 2.4],
                borderColor: '#FFD700',
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#FFD700',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 1.8,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        font: {
                            family: 'Inter'
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        font: {
                            family: 'Inter'
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification alert alert-${type} alert-dismissible fade show`;
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        border-radius: 8px;
        border: none;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        font-family: 'Inter', sans-serif;
    `;

    let icon = '';
    let bgColor = '';
    switch(type) {
        case 'success': 
            icon = 'fas fa-check-circle'; 
            bgColor = '#28a745';
            break;
        case 'info': 
            icon = 'fas fa-info-circle'; 
            bgColor = '#0a1f3a';
            break;
        case 'warning': 
            icon = 'fas fa-exclamation-triangle'; 
            bgColor = '#f59e0b';
            break;
        case 'danger': 
            icon = 'fas fa-exclamation-circle'; 
            bgColor = '#ef4444';
            break;
    }

    notification.style.backgroundColor = bgColor;
    notification.style.color = 'white';
    notification.style.border = 'none';

    notification.innerHTML = `
        <i class="${icon} me-2"></i>${message}
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 150);
        }
    }, 3000);
}

// Touch gestures for mobile
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 100;
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (touchEndX - touchStartX > swipeThreshold) {
        // Swipe right - open sidebar
        if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
        }
    } else if (touchStartX - touchEndX > swipeThreshold) {
        // Swipe left - close sidebar
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
        }
    }
}

// Performance monitoring
function monitorPerformance() {
    if ('performance' in window) {
        window.addEventListener('load', () => {
            const perfData = performance.getEntriesByType('navigation')[0];
            if (perfData) {
                console.log('Page Load Time:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
            }
        });
    }
}

// Focus management for sidebar accessibility
function setupAccessibility() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const focusableElements = sidebar.querySelectorAll('a, button');
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    sidebar.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusableElement) {
                    lastFocusableElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusableElement) {
                    firstFocusableElement.focus();
                    e.preventDefault();
                }
            }
        }
    });
}

// Real-time updates simulation (optional)
function startRealTimeUpdates() {
    setInterval(() => {
        const employeeCount = document.getElementById('employeeCount');
        if (!employeeCount) return;

        const currentCount = parseInt(employeeCount.textContent);
        
        if (Math.random() > 0.98) {
            const newCount = currentCount + (Math.random() > 0.5 ? 1 : -1);
            employeeCount.textContent = Math.max(0, newCount);
            
            // Flash effect for updates
            employeeCount.style.color = '#FFD700';
            setTimeout(() => {
                employeeCount.style.color = '';
            }, 1000);
        }
    }, 5000);
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    new SmartPayDashboard();
    setupAccessibility();
    monitorPerformance();
    
    // Add loading animation for stats
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease-out';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 150 * (index + 1));
    });

    // Start real-time updates if on dashboard
    if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
        startRealTimeUpdates();
    }
});

// Export functions for use in other scripts
window.SmartPayDashboard = SmartPayDashboard;
window.showNotification = showNotification;
window.initializeDashboardCharts = initializeDashboardCharts;