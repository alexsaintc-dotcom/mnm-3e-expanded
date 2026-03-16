const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../1st Powers Input.csv');

function cleanup() {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  const powerMap = new Map();

  // Skip header, process each line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith(',,,,')) continue; // Skip truly empty rows

    const parts = line.split(',');
    const name = (parts[0] || '').trim().replace(/"/g, '');
    
    if (name && name !== 'Name' && name !== 'Power') {
      // If we haven't seen this power, or this version is longer (more data)
      if (!powerMap.has(name) || line.length > powerMap.get(name).length) {
        powerMap.set(name, line);
      }
    }
  }

  const result = [lines[0], ...Array.from(powerMap.values())];
  fs.writeFileSync(csvPath, result.join('\n'));
  
  console.log(`Cleanup complete. Kept ${powerMap.size} unique powers.`);
}

cleanup();
