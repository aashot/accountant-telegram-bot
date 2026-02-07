const { bot, channelId } = require('./config');
const { parseSpending, getToday } = require('./helpers');
const { convertToAMD, isSupportedCurrency } = require('./currency');
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

/total - Show today's spendings (table + CSV)
/monthly-total - Show this month's spendings
/reset-day - Reset all today's spendings
/help - Show this help message

📝 *How to record spendings:*
\`Category Amount\` or \`Category Amount Currency\`
Examples:
• \`Lunch 345\` → 345 AMD
• \`Coffee 5.50 USD\` → converted to AMD
• \`Crypto 0.001 BTC\` → converted to AMD

💱 *Currency Support:*
300+ currencies supported (fiat, crypto, metals).
Examples: USD, EUR, RUB, GEL, BTC, ETH, USDT, XAU...
All amounts auto-convert to AMD.

✏️ *Edit/Delete:*
Edit a message to update the amount.
Edit to invalid text (e.g., "-") to delete.`;

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
      if (!isSupportedCurrency(spending.currency)) {
        return bot.sendMessage(channelId, `❌ Invalid currency code "${spending.currency}". Use a valid 3-letter code (USD, EUR, BTC, etc.)`, { reply_to_message_id: msg.message_id });
      }

      const { amountAMD, rate, success } = await convertToAMD(spending.amount, spending.currency);

      if (!success && spending.currency !== 'AMD') {
        return bot.sendMessage(channelId, `⚠️ Could not convert ${spending.currency}. Please try again later.`, { reply_to_message_id: msg.message_id });
      }

      add(spending.category, amountAMD, msg.message_id, msg.date, {
        originalAmount: spending.amount,
        originalCurrency: spending.currency,
        rate
      });

      if (spending.currency !== 'AMD' && success) {
        await bot.sendMessage(channelId, `💱 ${spending.amount.toLocaleString()} ${spending.currency} → ${amountAMD.toLocaleString()} AMD`, { reply_to_message_id: msg.message_id });
      }
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

    if (!isSupportedCurrency(spending.currency)) {
      return;
    }

    const { amountAMD, rate, success } = await convertToAMD(spending.amount, spending.currency);

    if (!success && spending.currency !== 'AMD') {
      return;
    }

    const updated = updateSpending(msg.message_id, spending.category, amountAMD, {
      originalAmount: spending.amount,
      originalCurrency: spending.currency,
      rate
    });

    if (!updated) {
      add(spending.category, amountAMD, msg.message_id, msg.date, {
        originalAmount: spending.amount,
        originalCurrency: spending.currency,
        rate
      });
    }
  });
}

module.exports = { setupHandlers };
