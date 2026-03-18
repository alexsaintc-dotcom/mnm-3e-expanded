const fs = require('fs-extra');
const csv = require('csv-parser');
const path = require('path');

const EXTRAS = require('./extras');
const FLAWS = require('./flaws');

// M&M 3e French System Translation Mappings
const translationMap = {
  type: {
    'power': 'pouvoir',
    'advantage': 'avantage',
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
    'ranged': 'distance', // Corrected value
    'perception': 'perception',
    'rank': 'rang'
  },
  duration: {
    'instant': 'instantane',
    'sustained': 'prolonge', // Corrected value
    'continuous': 'continu',
    'concentration': 'concentration',
    'permanent': 'permanent'
  }
};

async function build() {
  const csvFile = path.join(__dirname, '../1st Powers Input.csv');
  const distDir = path.join(__dirname, '../mnm-3e-expanded/packs');
  const outFile = path.join(distDir, 'powers.db');

  // Ensure output directory exists
  await fs.ensureDir(distDir);

  const items = [];

  const readCsv = () => {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(csvFile)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '')
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  };

  const rows = await readCsv();
  if (rows.length > 0) {
    console.log('First row data keys:', Object.keys(rows[0]));
    console.log('First row name value:', rows[0].Name || rows[0].name);
  }

  for (const row of rows) {
    const rawName = row.Name || row.name || row.NAME;
    if (!rawName || rawName.trim() === '') continue;
    const name = rawName.trim();

    // Build the description from multiple columns
    let fullDescription = `<h3>Description</h3><p>${row.Description || row.description || row.DESCRIPTION || ''}</p>`;
    if (row.Mechanics || row.mechanics || row.MECHANICS) fullDescription += `<h3>Mechanics</h3><p>${row.Mechanics || row.mechanics || row.MECHANICS}</p>`;
    if (row.Extras || row.extras || row.EXTRAS) fullDescription += `<h3>Extras</h3><p>${row.Extras || row.extras || row.EXTRAS}</p>`;
    if (row.Flaws || row.flaws || row.FLAWS) fullDescription += `<h3>Flaws</h3><p>${row.Flaws || row.flaws || row.FLAWS}</p>`;

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
          extrasObject[count] = EXTRAS[extraName];
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
          flawsObject[count] = FLAWS[flawName];
          count++;
        }
      }
    }

    const foundryItem = {
      name: name,
      type: translationMap.type[type] || 'pouvoir',
      img: `systems/mutants-and-masterminds-3e/assets/icons/${translationMap.type[type] || 'pouvoir'}.svg`,
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
          rangDyn: 0,
          rangDynMax: 0,
          divers: 0,
          modrang: 0,
          modfixe: 0,
          totalTheorique: 0,
          parrangtotal: "0"
        }
      },
      _id: Math.random().toString(36).substring(2, 18)
    };

    items.push(JSON.stringify(foundryItem));
  }

  await fs.writeFile(outFile, items.join('\n'));
  console.log(`Successfully built powers.db with ${items.length} items from CSV.`);
}

build().catch(err => console.error(err));
