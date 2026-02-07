const http = require('http');
const { bot, channelId, token, WEBHOOK_URL } = require('./config');

function startServer() {
  const PORT = process.env.PORT || 3000;
  const webhookPath = `/bot${token}`;

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === webhookPath) {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const update = JSON.parse(body);
          bot.processUpdate(update);
          res.writeHead(200);
          res.end('OK');
        } catch (error) {
          console.error('Error processing webhook:', error.message);
          res.writeHead(400);
          res.end('Bad Request');
        }
      });
      return;
    }

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

  server.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);

    try {
      const webhookUrl = `${WEBHOOK_URL}${webhookPath}`;
      await bot.setWebHook(webhookUrl);
      console.log(`✅ Webhook set: ${WEBHOOK_URL}/bot***`);
      console.log(`📢 Channel: ${channelId}`);
    } catch (error) {
      console.error('❌ Failed to set webhook:', error.message);
    }
  });
}

module.exports = { startServer };
