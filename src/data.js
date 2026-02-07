const fs = require('fs');
const { DATA_FILE } = require('./config');

const DEFAULT_DATA = { daily: {}, monthly: [] };

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { ...DEFAULT_DATA };

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(content);

    if (!data || typeof data !== 'object' || !data.daily || !Array.isArray(data.monthly)) {
      console.error('Invalid data structure in data.json, returning default');
      return { ...DEFAULT_DATA };
    }

    return data;
  } catch (error) {
    console.error(`Failed to load data.json: ${error.message}`);

    if (fs.existsSync(DATA_FILE)) {
      const backupPath = `${DATA_FILE}.backup.${Date.now()}`;
      try {
        fs.copyFileSync(DATA_FILE, backupPath);
        console.error(`Corrupted file backed up to: ${backupPath}`);
      } catch (backupError) {
        console.error(`Failed to backup corrupted file: ${backupError.message}`);
      }
    }

    return { ...DEFAULT_DATA };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Failed to save data.json: ${error.message}`);
    throw error;
  }
}

module.exports = { loadData, saveData };
