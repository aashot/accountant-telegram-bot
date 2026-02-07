const { bot, channelId } = require('./config');
const { parseSpending, getToday } = require('./helpers');
const {
  add,
  updateSpending,
  removeSpending,
  resetDay,
  getDailySummary,
  getDailyCsv,
  getMonthlySummary
} = require('./spending');

const HELP_TEXT = `📋 *Available Commands*

/total - Show today's spendings
/monthly-total - Show this month's spendings
/reset-day - Reset all today's spendings and delete messages
/help - Show this help message

📝 *How to record spendings:*
Just type: \`Category Amount\`
Examples: \`Lunch 345\` or \`Coffee 1,000\`

✏️ *Edit/Delete:*
Edit or delete your spending message to update the data.`;

function setupHandlers() {
  bot.on('channel_post', async msg => {
    if (String(msg.chat.id) !== String(channelId) || !msg.text) return;

    const text = msg.text.trim();

    if (/^\/help(@\w+)?$/i.test(text)) {
      return bot.sendMessage(channelId, HELP_TEXT, { parse_mode: 'Markdown' });
    }

    if (/^\/total(@\w+)?$/i.test(text)) {
      const tableMessage = getDailySummary();
      await bot.sendMessage(channelId, tableMessage, { parse_mode: 'Markdown' });

      const csvContent = getDailyCsv();
      if (csvContent) {
        const today = getToday();
        const csvBuffer = Buffer.from(csvContent, 'utf8');
        await bot.sendDocument(channelId, csvBuffer, {}, {
          filename: `spendings_${today}.csv`,
          contentType: 'text/csv'
        });
      }
      return;
    }

    if (/^\/monthly-total(@\w+)?$/i.test(text)) {
      return bot.sendMessage(channelId, getMonthlySummary());
    }

    if (/^\/reset-day(@\w+)?$/i.test(text)) {
      const opts = {
        reply_to_message_id: msg.message_id,
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              { text: '✅ Yes, reset', callback_data: 'reset_confirm' },
              { text: '❌ No, cancel', callback_data: 'reset_cancel' }
            ]
          ]
        })
      };
      return bot.sendMessage(channelId, '⚠️ Are you sure you want to reset all spendings for today? This action cannot be undone.', opts);
    }

    const spending = parseSpending(text);
    if (spending) {
      add(spending.category, spending.amount, msg.message_id);
    }
  });

  bot.on('callback_query', async callbackQuery => {
    const msg = callbackQuery.message;
    const action = callbackQuery.data;

    if (action === 'reset_cancel') {
      await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => { });
      return bot.answerCallbackQuery(callbackQuery.id, { text: 'Cancelled' });
    }

    if (action === 'reset_confirm') {
      const deletedCount = await resetDay();
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Resetting day...' });
      await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => { });
      return bot.sendMessage(channelId, `🔄 Day reset complete! Deleted ${deletedCount} spending message(s).`);
    }
  });

  bot.on('edited_channel_post', async msg => {
    if (String(msg.chat.id) !== String(channelId) || !msg.text) return;

    const spending = parseSpending(msg.text.trim());

    if (!spending) {
      const removed = removeSpending(msg.message_id);
      if (removed) {
        await bot.deleteMessage(channelId, msg.message_id).catch(() => { });
      }
      return;
    }

    const updated = updateSpending(msg.message_id, spending.category, spending.amount);

    if (!updated) {
      add(spending.category, spending.amount, msg.message_id);
    }
  });
}

module.exports = { setupHandlers };
