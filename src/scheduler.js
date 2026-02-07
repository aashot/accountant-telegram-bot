const schedule = require('node-schedule');
const { bot, channelId } = require('./config');
const { getDailySummary, getMonthlySummary, hasTodaySpendings } = require('./spending');

function setupScheduler() {
  schedule.scheduleJob({ tz: 'Asia/Dubai', hour: 23, minute: 0 }, () => {
    if (!hasTodaySpendings()) {
      bot.sendMessage(channelId, '⏰ Reminder: Please report your spendings for today!');
    }
  });

  schedule.scheduleJob({ tz: 'Asia/Dubai', hour: 23, minute: 55 }, () => {
    bot.sendMessage(channelId, getDailySummary());
  });

  schedule.scheduleJob({ tz: 'Asia/Dubai', hour: 23, minute: 50, date: 'L' }, () => {
    bot.sendMessage(channelId, getMonthlySummary());
  });
}

module.exports = { setupScheduler };
