Here’s a **detailed breakdown of the `/grades` API endpoints** with example requests/responses for testing and documentation, formatted clearly for reference:

---

### **1. `POST /grades` – Create a New Grade**  
**Authorization**: `Admin` or `HR`  
**Request Body**:
```json
{
  "name": "Senior Developer",
  "code": "SD01",
  "level": 5,
  "baseSalary": 8000,
  "salaryRange": {
    "minimum": 7000,
    "maximum": 9500
  },
  "currency": "USD",
  "promotion": {
    "nextGrade": "60a1b2c3d4e5f6a1b2c3d4e5",
    "minimumTenure": 12
  }
}
```
**Success Response (201 Created)**:
```json
{
  "_id": "60a1b2c3d4e5f6a1b2c3d4e6",
  "name": "Senior Developer",
  "level": 5,
  "promotion": {
    "nextGrade": "60a1b2c3d4e5f6a1b2c3d4e5"
  }
}
```
**Error Cases**:  
- `400 Bad Request` – Missing required fields.  
- `404 Not Found` – Invalid `nextGrade` ID.  

---

### **2. `GET /grades` – List All Grades**  
**Query Params**:  
- `?activeOnly=true` (default)  
- `?minLevel=3&maxLevel=5`  
- `?search=senior`  

**Success Response (200 OK)**:
```json
[
  {
    "_id": "60a1b2c3d4e5f6a1b2c3d4e6",
    "name": "Senior Developer",
    "level": 5,
    "isActive": true,
    "promotion": {
      "nextGrade": {
        "_id": "60a1b2c3d4e5f6a1b2c3d4e5",
        "name": "Lead Developer"
      }
    }
  }
]
```

---

### **3. `GET /grades/:id` – Get Grade Details**  
**Path Param**: `id` (Grade ID)  
**Success Response (200 OK)**:
```json
{
  "_id": "60a1b2c3d4e5f6a1b2c3d4e6",
  "name": "Senior Developer",
  "baseSalary": 8000,
  "salaryRange": {
    "minimum": 7000,
    "maximum": 9500
  },
  "promotion": {
    "nextGrade": {
      "_id": "60a1b2c3d4e5f6a1b2c3d4e5",
      "name": "Lead Developer"
    }
  }
}
```
**Error Cases**:  
- `404 Not Found` – Grade not found.  

---

### **4. `PUT /grades/:id` – Update Grade**  
**Authorization**: `Admin` or `HR`  
**Request Body**:
```json
{
  "baseSalary": 8500,
  "salaryRange": {
    "minimum": 7500,
    "maximum": 10000
  }
}
```
**Success Response (200 OK)**:
```json
{
  "_id": "60a1b2c3d4e5f6a1b2c3d4e6",
  "baseSalary": 8500,
  "salaryRange": {
    "minimum": 7500,
    "maximum": 10000
  }
}
```
**Error Cases**:  
- `400 Bad Request` – Invalid salary range.  

---

### **5. `GET /grades/:id/calculate-salary` – Calculate Salary**  
**Query Param**: `?overtime=10` (optional)  
**Success Response (200 OK)**:
```json
{
  "grossSalary": 9200,
  "deductions": {
    "paye": 1380,
    "pension": 460,
    "total": 1840
  },
  "netSalary": 7360,
  "overtimePay": 675
}
```

---

### **6. `POST /grades/initialize` – Bulk Initialize Grades**  
**Authorization**: `Admin`  
**Request Body**:
```json
{
  "grades": [
    {
      "name": "Junior Developer",
      "level": 1,
      "baseSalary": 5000
    },
    {
      "name": "Senior Developer",
      "level": 2,
      "baseSalary": 8000
    }
  ]
}
```
**Success Response (201 Created)**:
```json
[
  {
    "_id": "60a1b2c3d4e5f6a1b2c3d4e7",
    "name": "Junior Developer",
    "level": 1,
    "promotion": {
      "nextGrade": "60a1b2c3d4e5f6a1b2c3d4e8"
    }
  },
  {
    "_id": "60a1b2c3d4e5f6a1b2c3d4e8",
    "name": "Senior Developer",
    "level": 2
  }
]
```

---

### **7. `GET /grades/hierarchy` – Get Grade Hierarchy**  
**Success Response (200 OK)**:
```json
[
  {
    "_id": "60a1b2c3d4e5f6a1b2c3d4e7",
    "name": "Junior Developer",
    "level": 1,
    "promotion": {
      "nextGrade": {
        "_id": "60a1b2c3d4e5f6a1b2c3d4e8",
        "name": "Senior Developer"
      }
    }
  }
]
```

---

### **Key Notes**:
1. **Authentication**: Include `Authorization: Bearer <token>` in headers.  
2. **Validation**:  
   - `level` must be unique and sequential.  
   - `salaryRange.minimum` ≤ `baseSalary` ≤ `salaryRange.maximum`.  
3. **Error Responses**: Always include a `message` (e.g., `"Grade not found"`).  

