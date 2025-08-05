Basic Get All (First 10 active employees)

text
GET /api/employees
Search by name or ID

text
GET /api/employees?search=john
Filter by department

text
GET /api/employees?departmentId=507f1f77bcf86cd799439011
Filter by salary range

text
GET /api/employees?minSalary=50000&maxSalary=80000
Filter by grade level

text
GET /api/employees?minGradeLevel=3&maxGradeLevel=5
Pagination (page 2, 5 items per page)

text
GET /api/employees?page=2&limit=5
Sorting (by salary descending)

text
GET /api/employees?sortBy=employmentInfo.currentSalary&sortOrder=desc
Combined filters

text
GET /api/employees?departmentId=507f...&minSalary=50000&status=active&page=1&limit=20