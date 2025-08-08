# Complete Vercel Deployment Guide for SmartPay HRMS

## 🚀 Step 1: Prepare Your Project for Vercel

### 1.1 Create Vercel Configuration File

Create a `vercel.json` file in your project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node",
      "config": {
        "maxLambdaSize": "50mb"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "server.js": {
      "maxDuration": 30
    }
  }
}
```

### 1.2 Update Your Server.js for Serverless

Modify your `server.js` to handle Vercel's serverless environment:

```javascript
require('dotenv').config();
const http = require('http');
const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const app = require('./app');

const port = process.env.PORT || 3000;

// For Vercel serverless deployment
if (process.env.VERCEL) {
  // Export the app for Vercel
  module.exports = app;
} else {
  // Local development server
  const server = http.createServer(app);
  
  const startServer = async () => {
    try {
      await connectDB();
      server.listen(port, () => {
        logger.info(`🚀 Server running on port ${port}`);
        logger.info(`📁 Views: ${app.get('views')}`);
        logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  // Graceful shutdown
  const shutdown = () => {
    logger.info('🛑 Server is shutting down...');
    server.close(() => {
      logger.info('⛔ Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  startServer();
}
```

### 1.3 Create API Entry Point

Create `/api/index.js` for better Vercel compatibility:

```javascript
const app = require('../app');

module.exports = app;
```

### 1.4 Update Package.json Scripts

Add Vercel-specific scripts to your `package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "npm run lint",
    "vercel-build": "echo 'Build complete'",
    "postinstall": "echo 'Dependencies installed'",
    "test": "jest",
    "lint": "eslint .",
    "seed": "node seeds/index.js"
  }
}
```

## 🔧 Step 2: Environment Variables Setup

### 2.1 Create .env.example

Create a `.env.example` file (don't include sensitive values):

```env
# Default users
ADMIN_EMAIL=admin@smartpay.com
ADMIN_PASSWORD=
HR_EMAIL=hr@smartpay.com
HR_PASSWORD=
EMPLOYEE_EMAIL=employee@smartpay.com
EMPLOYEE_PASSWORD=

# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
MONGODB_URI=
DB_USER=
DB_NAME=

# Session Configuration
SESSION_SECRET=
SESSION_EXPIRY=7d

# File Upload Configuration
MAX_FILE_SIZE=5MB
UPLOAD_PATH=./uploads

# PDF Generation
PDF_ENGINE=puppeteer

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# JWT Secret
JWT_SECRET=
```

### 2.2 Update .gitignore

Ensure your `.gitignore` includes:

```gitignore
node_modules/
.env
.env.local
.env.production
uploads/
logs/
*.log
.vercel
.DS_Store
coverage/
```

## 🌐 Step 3: Deploy to Vercel

### 3.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Login to Vercel

```bash
vercel login
```

### 3.3 Initial Deployment

From your project root directory:

```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Select your account
- **Link to existing project?** No
- **Project name:** smartpay-hrms
- **Directory:** ./ (current directory)
- **Override settings?** Yes if needed

### 3.4 Set Environment Variables

After deployment, set your environment variables:

```bash
# Set each environment variable
vercel env add MONGODB_URI
vercel env add SESSION_SECRET
vercel env add JWT_SECRET
vercel env add ADMIN_PASSWORD
vercel env add HR_PASSWORD
vercel env add EMPLOYEE_PASSWORD
# ... add all other variables
```

Or use the Vercel Dashboard:
1. Go to your project dashboard
2. Click "Settings" → "Environment Variables"
3. Add all your environment variables

## 🔄 Step 4: Set Up CI/CD Pipeline with GitHub

### 4.1 Connect GitHub Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Framework Preset:** Other
   - **Root Directory:** ./
   - **Build Command:** `npm run build`
   - **Output Directory:** (leave empty)
   - **Install Command:** `npm install`

### 4.2 Configure Automatic Deployments

Vercel automatically sets up CI/CD when you connect a Git repository:

- **Production Branch:** `main` or `master`
- **Preview Deployments:** All other branches
- **Deploy Hooks:** Automatic on push

### 4.3 Create GitHub Actions (Optional Enhanced CI/CD)

Create `.github/workflows/vercel.yml`:

```yaml
name: Vercel Deployment

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 📊 Step 5: Database Configuration

### 5.1 MongoDB Atlas Setup (Recommended for Production)

1. Create [MongoDB Atlas](https://www.mongodb.com/atlas) account
2. Create a cluster
3. Create database user
4. Whitelist IP addresses (0.0.0.0/0 for Vercel)
5. Get connection string
6. Update `MONGODB_URI` in Vercel environment variables

### 5.2 Alternative: MongoDB Connection Handling

Update your database connection to handle serverless:

```javascript
// config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    logger.info('Using existing database connection');
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0
    });

    isConnected = db.connections[0].readyState === 1;
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection error:', error);
    throw error;
  }
};

module.exports = { connectDB };
```

## 🚦 Step 6: Testing and Monitoring

### 6.1 Test Your Deployment

1. Visit your Vercel URL
2. Test all major features
3. Check logs in Vercel dashboard
4. Monitor performance

### 6.2 Set Up Monitoring

Add basic health check endpoint in your app:

```javascript
// Add to your main app file
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});
```

## 🔧 Step 7: Optimization for Production

### 7.1 Performance Optimizations

Update your `app.js` with production optimizations:

```javascript
const compression = require('compression');
const helmet = require('helmet');

// Add these middlewares
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false // Adjust based on your needs
}));

// Optimize for serverless
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
```

### 7.2 File Upload Considerations

For file uploads on Vercel, consider using:
- Cloudinary for image uploads
- AWS S3 for file storage
- Vercel Blob for simple file storage

## 🎯 Step 8: Final Checklist

- [ ] `vercel.json` configured
- [ ] Environment variables set in Vercel
- [ ] GitHub repository connected
- [ ] MongoDB Atlas configured
- [ ] SSL certificate (automatic with Vercel)
- [ ] Domain configured (if custom domain needed)
- [ ] File upload strategy implemented
- [ ] Error monitoring set up
- [ ] Performance testing completed

## 🚨 Common Issues and Solutions

### Issue 1: Function Timeout
**Solution:** Optimize database queries and use connection pooling

### Issue 2: File Upload Limits
**Solution:** Use external storage services (AWS S3, Cloudinary)

### Issue 3: Environment Variables Not Loading
**Solution:** Ensure variables are set in Vercel dashboard and restart deployment

### Issue 4: Database Connection Issues
**Solution:** Check MongoDB Atlas IP whitelist and connection string

### Issue 5: Static Files Not Loading
**Solution:** Update static file paths and ensure proper middleware setup

## 📱 Step 9: Custom Domain (Optional)

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Configure DNS records with your domain provider
4. Wait for SSL certificate provisioning

## 🔄 Step 10: Maintenance and Updates

### Automatic Deployments
- Push to main branch triggers production deployment
- Feature branches create preview deployments
- Pull requests show deployment previews

### Manual Deployments
```bash
vercel --prod  # Deploy to production
vercel         # Deploy preview
```

### Rollback
```bash
vercel rollback [deployment-url]
```

---
