const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'accountant_bot';

let client = null;
let db = null;

async function connect() {
  if (db) return db;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);

  await db.collection('spendings').createIndex({ messageId: 1 }, { unique: true, sparse: true });
  await db.collection('spendings').createIndex({ date: 1 });

  console.log('✅ Connected to MongoDB');
  return db;
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
