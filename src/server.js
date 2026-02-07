const http = require('http');
const { channelId } = require('./config');

function startServer() {
  const PORT = process.env.PORT || 3000;

  http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running');
  }).listen(PORT, () => {
    console.log(`🚀 Bot running. Channel: ${channelId}, Health check on port ${PORT}`);
  });
}

module.exports = { startServer };
