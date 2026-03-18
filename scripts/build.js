const fs = require('fs-extra');
const csv = require('csv-parser');
const path = require('path');

const EXTRAS = require('./extras');
const FLAWS = require('./flaws');

// M&M 3e French System Translation Mappings
const translationMap = {
  type: {
    'power': 'pouvoir',
    'advantage': 'talent', // Corrected for Advantages
    'attack': 'pouvoir',
    'defense': 'pouvoir'
  },
  action: {
    'standard': 'simple',
    'move': 'mouvement',
    'free': 'libre',
    'reaction': 'reaction',
    'none': 'aucune'
  },
  range: {
    'personal': 'personnelle',
    'close': 'contact',
    'ranged': 'distance',
    'perception': 'perception',
    'rank': 'rang'
  },
  duration: {
    'instant': 'instantane',
    'sustained': 'prolonge',
    'continuous': 'continu',
    'concentration': 'concentration',
    'permanent': 'permanent'
  }
};

const distDir = path.join(__dirname, '../mnm-3e-expanded/packs');

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) return resolve([]);
    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '')
      }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

async function buildPowers() {
  const csvFile = path.join(__dirname, '../1st Powers Input.csv');
  const outFile = path.join(distDir, 'powers.db');
  const rows = await readCsv(csvFile);
  const items = [];

  for (const row of rows) {
    const rawName = row.Name || row.name || row.NAME;
    if (!rawName || rawName.trim() === '') continue;
    const name = rawName.trim();

    let fullDescription = `<h3>Description</h3><p>${row.Description || row.description || row.DESCRIPTION || ''}</p>`;
    if (row.Mechanics || row.mechanics || row.MECHANICS) fullDescription += `<h3>Mechanics</h3><p>${row.Mechanics || row.mechanics || row.MECHANICS}</p>`;

    const action = (row.Action || row.action || row.ACTION || 'standard').trim().toLowerCase();
    const range = (row.Range || row.range || row.RANGE || 'close').trim().toLowerCase();
    const duration = (row.Duration || row.duration || row.DURATION || 'instant').trim().toLowerCase();
    const type = (row.Power || row.power || row.POWER || 'power').trim().toLowerCase();

    const extrasText = (row.Extras || row.extras || row.EXTRAS || '');
    const flawsText = (row.Flaws || row.flaws || row.FLAWS || '');

    const extrasObject = {};
    if (extrasText) {
      const extraNames = extrasText.split(',').map(e => e.trim());
      let count = 1;
      for (const extraName of extraNames) {
        if (EXTRAS[extraName]) {
          extrasObject[count] = JSON.parse(JSON.stringify(EXTRAS[extraName]));
          count++;
        }
      }
    }

    const flawsObject = {};
    if (flawsText) {
      const flawNames = flawsText.split(',').map(f => f.trim());
      let count = 1;
      for (const flawName of flawNames) {
        if (FLAWS[flawName]) {
          flawsObject[count] = JSON.parse(JSON.stringify(FLAWS[flawName]));
          count++;
        }
      }
    }

    const foundryItem = {
      name: name,
      type: translationMap.type[type] || 'pouvoir',
      img: `systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg`,
      system: {
        activate: false,
        special: translationMap.action[action] || 'simple',
        type: 'generaux',
        action: translationMap.action[action] || 'simple',
        portee: translationMap.range[range] || 'contact',
        duree: translationMap.duration[duration] || 'instantane',
        effets: fullDescription,
        notes: row.Description || row.description || row.DESCRIPTION || '',
        extras: extrasObject,
        defauts: flawsObject,
        cout: {
          rang: parseInt(row.Rank || row.rank || row.RANK) || 0,
          parrang: parseInt(row.Cost || row.cost || row.COST) || 1,
          total: (parseInt(row.Rank || row.rank || row.RANK) || 0) * (parseInt(row.Cost || row.cost || row.COST) || 1),
          rangDyn: 0, rangDynMax: 0, divers: 0, modrang: 0, modfixe: 0, totalTheorique: 0, parrangtotal: "0"
        }
      },
      _id: Math.random().toString(36).substring(2, 18)
    };
    items.push(JSON.stringify(foundryItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
  console.log(`Successfully built powers.db with ${items.length} items.`);
}

async function buildAdvantages() {
  const csvFile = path.join(__dirname, '../Advantages.csv');
  const outFile = path.join(distDir, 'advantages.db');
  const rows = await readCsv(csvFile);
  const items = [];

  for (const row of rows) {
    const name = row.Name || row.name;
    if (!name) continue;

    const foundryItem = {
      name: name,
      type: 'talent',
      img: 'systems/mutants-and-masterminds-3e/assets/icons/talent.svg',
      system: {
        description: `<p>${row.Description || ''}</p>`,
        equipement: false,
        rang: parseInt(row.Ranks) || 1,
        edit: true,
        listEffectsVariantes: {}
      },
      effects: [],
      _id: Math.random().toString(36).substring(2, 18)
    };
    items.push(JSON.stringify(foundryItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
  console.log(`Successfully built advantages.db with ${items.length} items.`);
}

async function buildModifiers(dataMap, fileName) {
  const outFile = path.join(distDir, fileName);
  const items = [];

  for (const key in dataMap) {
    const mod = dataMap[key];
    const foundryItem = {
      name: mod.name,
      type: 'pouvoir', // Modifiers are technically power components
      img: 'systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg',
      system: {
        description: mod.data.description,
        notes: mod.data.description,
        cout: {
          rang: mod.data.cout.rang ? 1 : 0,
          parrang: mod.data.cout.rang ? mod.data.cout.value : 0,
          total: mod.data.cout.value
        }
      },
      _id: Math.random().toString(36).substring(2, 18)
    };
    items.push(JSON.stringify(foundryItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
  console.log(`Successfully built ${fileName} with ${items.length} items.`);
}

async function main() {
  await fs.ensureDir(distDir);
  await buildPowers();
  await buildAdvantages();
  await buildModifiers(EXTRAS, 'extras.db');
  await buildModifiers(FLAWS, 'flaws.db');
}

main().catch(err => console.error(err));
