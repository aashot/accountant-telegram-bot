require('./src/config');
const { setupHandlers } = require('./src/handlers');
const { setupScheduler } = require('./src/scheduler');
const { startServer } = require('./src/server');

setupHandlers();
setupScheduler();
startServer();