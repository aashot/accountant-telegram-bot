const http = require('http');
const { channelId } = require('./config');

function startServer() {
  const PORT = process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running');
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Is another instance running?`);
    } else {
      console.error(`❌ Server error: ${error.message}`);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`🚀 Bot running. Channel: ${channelId}, Health check on port ${PORT}`);
  });
}

module.exports = { startServer };
