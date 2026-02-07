const { bot, channelId } = require('./config');
const { parseSpending, parseSpendings, getToday } = require('./helpers');
const { convertToAMD, isSupportedCurrency } = require('./currency');
const {
  add,
  updateSpending,
  removeSpending,
  removeAllByMessageId,
  resetDay,
  getDailySummary,
  getDailyCsv,
  getMonthlySummary
} = require('./spending');

const HELP_TEXT = `📋 *Available Commands*

/total - Show today's spendings (table + CSV)
/monthly-total - Show this month's spendings
/reset-day - Reset all today's spendings
/add-past - Add spending for a past date
/help - Show this help message

📝 *How to record spendings:*
\`Category Amount\` or \`Category Amount Currency\`
Examples:
• \`Lunch 345\` → 345 AMD
• \`Coffee 5.50 USD\` → converted to AMD
• \`Crypto 0.001 BTC\` → converted to AMD

📅 *Add past spending:*
\`/add-past YYYY-MM-DD Category Amount [Currency]\`
Example: \`/add-past 2026-02-07 lunch 5000\`

💱 *Currency Support:*
300+ currencies supported (fiat, crypto, metals).
Examples: USD, EUR, RUB, GEL, BTC, ETH, USDT, XAU...
All amounts auto-convert to AMD.

✏️ *Edit/Delete:*
Edit a message to update the amount.
Edit to invalid text (e.g., "-") to delete.

📝 *Multi-line support:*
Send multiple expenses in one message:
\`Coffee 500
Lunch 3500
Transport 10 USD\``;

function setupHandlers() {
  bot.on('channel_post', async msg => {
    try {
      if (String(msg.chat.id) !== String(channelId) || !msg.text) return;

      const text = msg.text.trim();

      if (/^\/help(@\w+)?$/i.test(text)) {
        return bot.sendMessage(channelId, HELP_TEXT, { parse_mode: 'Markdown' });
      }

      if (/^\/total(@\w+)?$/i.test(text)) {
        const tableMessage = await getDailySummary();
        await bot.sendMessage(channelId, tableMessage, { parse_mode: 'Markdown' });

        const csvContent = await getDailyCsv();
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
        const summary = await getMonthlySummary();
        return bot.sendMessage(channelId, summary);
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

      const addPastMatch = text.match(/^\/add-past(?:@\w+)?\s+(\d{4}-\d{2}-\d{2})\s+(\w+)\s+([\d,.]+)\s*(\w*)$/i);
      if (addPastMatch) {
        const [, date, category, amountStr, currency] = addPastMatch;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return bot.sendMessage(channelId, '❌ Invalid date format. Use YYYY-MM-DD', { reply_to_message_id: msg.message_id });
        }

        const amount = parseFloat(amountStr.replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) {
          return bot.sendMessage(channelId, '❌ Invalid amount', { reply_to_message_id: msg.message_id });
        }

        const curr = currency.toUpperCase() || 'AMD';

        if (!isSupportedCurrency(curr)) {
          return bot.sendMessage(channelId, `❌ Invalid currency "${curr}"`, { reply_to_message_id: msg.message_id });
        }

        const { amountAMD, rate, success } = await convertToAMD(amount, curr);

        if (!success && curr !== 'AMD') {
          return bot.sendMessage(channelId, `⚠️ Could not convert ${curr}. Try again later.`, { reply_to_message_id: msg.message_id });
        }

        await add(category.toLowerCase(), amountAMD, null, null, {
          originalAmount: amount,
          originalCurrency: curr,
          rate
        }, date);

        const conversionNote = curr !== 'AMD' ? ` (${amount} ${curr} → ${amountAMD.toLocaleString()} AMD)` : '';
        return bot.sendMessage(channelId, `✅ Added to ${date}: ${category} ${amountAMD.toLocaleString()} AMD${conversionNote}`, { reply_to_message_id: msg.message_id });
      }

      const addPastMultiMatch = text.match(/^\/add-past(?:@\w+)?\s+(\d{4}-\d{2}-\d{2})\s*\n([\s\S]+)$/i);
      if (addPastMultiMatch) {
        const [, date, linesText] = addPastMultiMatch;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return bot.sendMessage(channelId, '❌ Invalid date format. Use YYYY-MM-DD', { reply_to_message_id: msg.message_id });
        }

        const spendings = parseSpendings(linesText);
        if (spendings.length === 0) {
          return bot.sendMessage(channelId, '❌ No valid expenses found', { reply_to_message_id: msg.message_id });
        }

        const results = [];
        for (const spending of spendings) {
          if (!isSupportedCurrency(spending.currency)) {
            results.push(`❌ ${spending.category}: Invalid currency "${spending.currency}"`);
            continue;
          }

          const { amountAMD, rate, success } = await convertToAMD(spending.amount, spending.currency);

          if (!success && spending.currency !== 'AMD') {
            results.push(`⚠️ ${spending.category}: Could not convert ${spending.currency}`);
            continue;
          }

          await add(spending.category, amountAMD, null, null, {
            originalAmount: spending.amount,
            originalCurrency: spending.currency,
            rate
          }, date);

          const conversionNote = spending.currency !== 'AMD' ? ` (${spending.amount} ${spending.currency} → ${amountAMD.toLocaleString()} AMD)` : '';
          results.push(`✅ ${spending.category}: ${amountAMD.toLocaleString()} AMD${conversionNote}`);
        }

        return bot.sendMessage(channelId, `📅 Added to ${date}:\n${results.join('\n')}`, { reply_to_message_id: msg.message_id });
      }

      const spendings = parseSpendings(text);
      if (spendings.length > 0) {
        const conversions = [];

        for (const spending of spendings) {
          console.log(`[PARSE] line ${spending.lineIndex}: "${spending.category}" -> amount: ${spending.amount}, currency: ${spending.currency}`);

          if (!isSupportedCurrency(spending.currency)) {
            await bot.sendMessage(channelId, `❌ Invalid currency code "${spending.currency}" on line ${spending.lineIndex + 1}. Use a valid 3-letter code.`, { reply_to_message_id: msg.message_id });
            continue;
          }

          const { amountAMD, rate, success } = await convertToAMD(spending.amount, spending.currency);
          console.log(`[CONVERT] ${spending.amount} ${spending.currency} -> ${amountAMD} AMD (success: ${success})`);

          if (!success && spending.currency !== 'AMD') {
            await bot.sendMessage(channelId, `⚠️ Could not convert ${spending.currency}. Please try again later.`, { reply_to_message_id: msg.message_id });
            continue;
          }

          await add(spending.category, amountAMD, msg.message_id, msg.date, {
            originalAmount: spending.amount,
            originalCurrency: spending.currency,
            rate
          }, null, spending.lineIndex);

          if (spending.currency !== 'AMD' && success) {
            conversions.push(`💱 ${spending.amount.toLocaleString()} ${spending.currency} → ${amountAMD.toLocaleString()} AMD`);
          }
        }

        if (conversions.length > 0) {
          await bot.sendMessage(channelId, conversions.join('\n'), { reply_to_message_id: msg.message_id });
        }
      }
    } catch (error) {
      console.error('Error handling channel_post:', error.message);
    }
  });

  bot.on('callback_query', async callbackQuery => {
    try {
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
    } catch (error) {
      console.error('Error handling callback_query:', error.message);
    }
  });

  bot.on('edited_channel_post', async msg => {
    try {
      if (String(msg.chat.id) !== String(channelId) || !msg.text) return;

      const text = msg.text.trim();
      const spendings = parseSpendings(text);

      if (spendings.length === 0) {
        const removed = await removeAllByMessageId(msg.message_id);
        if (removed > 0) {
          await bot.deleteMessage(channelId, msg.message_id).catch(() => { });
        }
        return;
      }

      await removeAllByMessageId(msg.message_id);

      for (const spending of spendings) {
        if (!isSupportedCurrency(spending.currency)) {
          continue;
        }

        const { amountAMD, rate, success } = await convertToAMD(spending.amount, spending.currency);

        if (!success && spending.currency !== 'AMD') {
          continue;
        }

        await add(spending.category, amountAMD, msg.message_id, msg.date, {
          originalAmount: spending.amount,
          originalCurrency: spending.currency,
          rate
        }, null, spending.lineIndex);
      }
    } catch (error) {
      console.error('Error handling edited_channel_post:', error.message);
    }
  });
}

module.exports = { setupHandlers };
