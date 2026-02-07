const fs = require('fs');
const { DATA_FILE } = require('./config');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { daily: {}, monthly: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = { loadData, saveData };
