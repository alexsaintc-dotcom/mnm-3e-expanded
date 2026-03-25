const fs = require('fs-extra');
const path = require('path');

const packsDir = path.join(__dirname, '../mnm-3e-expanded/packs');
const files = ['powers.db', 'advantages.db', 'flaws.db', 'extras.db'];

async function exportData() {
  const allData = {};
  for (const file of files) {
    const filePath = path.join(packsDir, file);
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      if (content.trim().startsWith('[')) {
        allData[file.replace('.db', '')] = JSON.parse(content);
      } else {
        const lines = content.trim().split('\n');
        allData[file.replace('.db', '')] = lines.map(line => JSON.parse(line));
      }
    }
  }
  await fs.writeJson(path.join(__dirname, '../compendium.json'), allData, { spaces: 2 });
  console.log('Exported all data to compendium.json');
}

exportData();
