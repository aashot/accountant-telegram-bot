const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'accountant_bot';

let client = null;
let db = null;

async function connect(retries = 3) {
  if (db) return db;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  const options = {
    tls: true,
    tlsAllowInvalidCertificates: false,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 MongoDB connection attempt ${attempt}/${retries}...`);
      client = new MongoClient(MONGODB_URI, options);
      await client.connect();
      db = client.db(DB_NAME);

      // Drop old unique messageId index if it exists (it caused issues with null values)
      try {
        await db.collection('spendings').dropIndex('messageId_1');
        console.log('🗑️ Dropped old messageId_1 index');
      } catch (e) {
        // Index might not exist, ignore
      }

      await db.collection('spendings').createIndex({ messageId: 1, lineIndex: 1 }, { sparse: true });
      await db.collection('spendings').createIndex({ date: 1 });

      console.log('✅ Connected to MongoDB');
      return db;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt} failed:`, error.message);
      if (attempt < retries) {
        const delay = attempt * 2000;
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return db;
}

function getSpendings() {
  return getDb().collection('spendings');
}

async function disconnect() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connect, getDb, getSpendings, disconnect };
