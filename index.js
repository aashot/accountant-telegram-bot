require('./src/config');
const { connect } = require('./src/database');
const { setupHandlers } = require('./src/handlers');
const { setupScheduler } = require('./src/scheduler');
const { startServer } = require('./src/server');

async function main() {
  await connect();
  setupHandlers();
  setupScheduler();
  startServer();
}

main().catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});