const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('login', {
        title: 'Login',
        layout: false // Use no layout for login page
    });
});

// Admin Dashboard Routes
router.get('/admin', (req, res) => {
    res.render('admin/dashboard', {
        title: 'Dashboard',
        currentPage: 'dashboard',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/employees', (req, res) => {
    res.render('admin/employees', {
        title: 'Employees',
        currentPage: 'employees',
        layout: false, 
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/departments', (req, res) => {
    res.render('admin/departments', {
        title: 'Departments',
        currentPage: 'departments',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/grades', (req, res) => {
    res.render('admin/grades', {
        title: 'Grades',
        currentPage: 'grades',
        layout: false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});
router.get('/admin/positions', (req, res) => {
    res.render('admin/positions', {
        title: 'Positions',
        currentPage: 'positions',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/payroll', (req, res) => {
    res.render('admin/payroll', {
        title: 'Process Payroll',
        currentPage: 'payroll',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/payslips', (req, res) => {
    res.render('admin/payslips', {
        title: 'Payslips',
        currentPage: 'payslips',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/reports', (req, res) => {
    res.render('admin/reports', {
        title: 'Analytics',
        currentPage: 'reports',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/exports', (req, res) => {
    res.render('admin/exports', {
        title: 'Export Data',
        currentPage: 'exports',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/settings', (req, res) => {
    res.render('admin/settings', {
        title: 'Settings',
        currentPage: 'settings',
        layout:false,
        user: {
            name: 'Administrator',
            email: 'admin@teampay.com',
            avatar: 'AD'
        }
    });
});

router.get('/admin/users', (req, res) => {
    res.render('admin/users', {
        title: 'User Management',
        currentPage: 'users',
        user: {
            name: 'Administrator 2',
            email: 'admin@teampay.com',
            avatar: 'AD'
        },
        layout: false // Use no layout for error page

    });
});

// API Routes for AJAX calls
router.get('/admin/api/stats', (req, res) => {
    res.json({
        employees: 247,
        departments: 15,
        positions: 42,
        payroll: '$2.4M'
    });
});

//render error page
router.get('/error', (req, res) => {
    res.render('error', {
        title: 'Error',
        message: 'An unexpected error occurred. Please try again later.',
        layout: false // Use no layout for error page
    });
});

router.post('/admin/logout', (req, res) => {
    // Handle logout logic here
    res.redirect('/');
});

module.exports = router;