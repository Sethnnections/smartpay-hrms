// simple-db-test.js
const mongoose = require('mongoose');
require('dotenv').config();

async function testLocalDB() {
  console.log('🔌 Testing Local MongoDB Connection...\n');
  
  // Try different local MongoDB connection strings
  const connectionStrings = [
    'mongodb://127.0.0.1:27017/smartpay-hrms',  // IPv4 localhost
    'mongodb://localhost:27017/smartpay-hrms',   // Localhost
    'mongodb://0.0.0.0:27017/smartpay-hrms'      // All interfaces
  ];
  
  for (const uri of connectionStrings) {
    console.log(`Trying: ${uri}`);
    
    try {
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 3000
      });
      
      console.log(`✅ SUCCESS: Connected to ${uri}`);
      
      // Show database info
      const db = mongoose.connection.db;
      console.log(`Database name: ${db.databaseName}`);
      
      // List collections
      const collections = await db.listCollections().toArray();
      console.log('\n📁 Collections:');
      collections.forEach(col => console.log(`  - ${col.name}`));
      
      await mongoose.disconnect();
      console.log('\n🎉 Connection test passed!');
      return true;
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
      await mongoose.disconnect();
    }
  }
  
  console.log('\n⚠️  All connection attempts failed.');
  console.log('\n💡 Check if MongoDB is running:');
  console.log('1. Start MongoDB: sudo systemctl start mongodb');
  console.log('2. Check status: sudo systemctl status mongodb');
  console.log('3. Install if needed: sudo apt install mongodb');
  
  return false;
}

// Run the test
testLocalDB().then(success => {
  if (success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});