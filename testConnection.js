const { connectToDatabase } = require('./db');

async function testConnection() {
  try {
    const { db } = await connectToDatabase();
    
    // Test by creating a sample collection
    const collection = db.collection('testCollection');
    
    // Insert a test document
    const insertResult = await collection.insertOne({
      test: 'connection',
      timestamp: new Date()
    });
    console.log('Inserted document ID:', insertResult.insertedId);
    
    // Find all documents
    const documents = await collection.find({}).toArray();
    console.log('Found documents:', documents);
    
    // Clean up
    await collection.drop();
    console.log('Test collection removed');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testConnection();