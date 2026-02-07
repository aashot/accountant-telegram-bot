const schedule = require('node-schedule');
const { bot, channelId } = require('./config');
const { getDailySummary, getMonthlySummary, hasTodaySpendings } = require('./spending');

function setupScheduler() {
  schedule.scheduleJob({ tz: 'Asia/Dubai', hour: 23, minute: 0 }, async () => {
    try {
      const hasSpendings = await hasTodaySpendings();
      if (!hasSpendings) {
        await bot.sendMessage(channelId, '⏰ Reminder: Please report your spendings for today!');
      }
    } catch (error) {
      console.error('Scheduler: Failed to send reminder:', error.message);
    }
  });

  schedule.scheduleJob({ tz: 'Asia/Dubai', hour: 23, minute: 55 }, async () => {
    try {
      const summary = await getDailySummary();
      await bot.sendMessage(channelId, summary);
    } catch (error) {
      console.error('Scheduler: Failed to send daily summary:', error.message);
    }
  });

  schedule.scheduleJob({ tz: 'Asia/Dubai', hour: 23, minute: 50, date: 'L' }, async () => {
    try {
      const summary = await getMonthlySummary();
      await bot.sendMessage(channelId, summary);
    } catch (error) {
      console.error('Scheduler: Failed to send monthly summary:', error.message);
    }
  });
}

module.exports = { setupScheduler };
