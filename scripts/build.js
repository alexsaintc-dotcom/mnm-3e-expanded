const fs = require('fs-extra');
const csv = require('csv-parser');
const path = require('path');

const EXTRAS = require('./extras.json');
const FLAWS = require('./flaws.json');
const ADVANTAGES = require('./advantages.json');

const translationMap = {
  type: { 'power': 'pouvoir', 'advantage': 'talent' },
  action: { 'standard': 'simple', 'move': 'mouvement', 'free': 'libre', 'reaction': 'reaction', 'none': 'aucune' },
  range: { 'personal': 'personnelle', 'close': 'contact', 'ranged': 'distance', 'perception': 'perception', 'rank': 'rang' },
  duration: { 'instant': 'instantane', 'sustained': 'prolonge', 'continuous': 'continu', 'concentration': 'concentration', 'permanent': 'permanent' }
};

const distDir = path.join(__dirname, '../mnm-3e-expanded/packs');

// Read existing .db file and build a name-to-ID map for ID stability across rebuilds
async function loadExistingIds(packName) {
  const dbFile = path.join(distDir, `${packName}.db`);
  const idMap = {};
  if (!fs.existsSync(dbFile)) return idMap;
  // Using synchronous read for simplicity and to avoid potential async issues
  const lines = fs.readFileSync(dbFile, 'utf-8').split('
').filter(Boolean);
  for (const line of lines) {
    try {
      const doc = JSON.parse(line);
      if (doc.name && doc._id) idMap[doc.name] = doc._id;
    } catch (e) { console.warn(`Failed to parse line in ${dbFile}: ${e.message}`); /* skip malformed lines */ }
  }
  return idMap;
}

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) {
      console.warn(`CSV file not found: ${filePath}`);
      return resolve([]);
    }
    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

function sanitizeText(text) {
  if (!text) return "";
  // Updated regex for robustness and consistency
  return text.replace(/[\u2013\u2014]/g, '—') // Em dashes
             .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // Quotation marks
             .replace(/[\u2018\u2019\u201B]/g, "'") // Apostrophes/single quotes
             .replace(/[\u00C2]/g, '') // Remove Â
             .replace(/\s\s+/g, ' ').trim(); // Collapse whitespace
}

function createId() {
  return Math.random().toString(36).substring(2, 18);
}

async function savePack(packName, documents) {
  const outFile = path.join(distDir, `${packName}.db`);
  console.log(`Saving pack: ${packName} to ${outFile}`);
  // Ensure correct string encoding and newline handling for JSON lines
  // Using JSON.stringify directly for each document and joining with '
'
  const lines = documents.map(d => JSON.stringify(d));
  await fs.writeFile(outFile, lines.join('
'), 'utf-8'); // Explicitly setting utf-8
}

async function buildPowers() {
  console.log("Building Powers...");
  const existingIds = await loadExistingIds('powers');
  const rows = await readCsv(path.join(__dirname, '../1st Powers Input.csv'));
  const items = rows.map(row => {
    const rawName = row.Name || row.name || row.NAME;
    if (!rawName) return null;
    const name = rawName.trim();
    const action = (row.Action || 'standard').trim().toLowerCase();
    const range = (row.Range || 'close').trim().toLowerCase();
    const duration = (row.Duration || 'instant').trim().toLowerCase();
    const baseRank = parseInt(row.Rank) || 1;
    const baseCostPerRank = parseInt(row.Cost) || 1;
    
    const rawType = (row.Power || row.power || row.TYPE || 'General').trim().toLowerCase();
    const mechanics = (row.Mechanics || '').toLowerCase();
    
    let systemType = 'generaux';
    if (rawType === 'attack' || mechanics.includes('attack check') || mechanics.includes('resistance check') || (action !== 'none' && range !== 'personal')) systemType = 'attaque';
    else if (rawType === 'movement') systemType = 'mouvement';
    else if (rawType === 'sensory') systemType = 'sensoriel';
    else if (rawType === 'defense') systemType = 'defensif';
    else if (rawType === 'control') systemType = 'generaux';

    const translatedAction = translationMap.action[action] || 'simple';

    const extrasObj = {};
    const flawsObj = {};
    let modCostPerRank = 0;
    let flatCost = 0;
    let extraCount = 0;
    let flawCount = 0;

    const extrasList = (row.Extras || "").split(',').map(e => e.trim()).filter(Boolean);
    extrasList.forEach(extraName => {
        const masterExtra = Object.values(EXTRAS).find(e => e.name.toLowerCase() === extraName.toLowerCase());
        if (masterExtra) {
            extraCount++;
            extrasObj[extraCount.toString()] = { name: masterExtra.name, data: masterExtra.system };
            if (masterExtra.system.cout.rang) modCostPerRank += masterExtra.system.cout.value;
            if (masterExtra.system.cout.fixe) flatCost += masterExtra.system.cout.value;
        }
    });

    const flawsList = (row.Flaws || "").split(',').map(f => f.trim()).filter(Boolean);
    flawsList.forEach(flawName => {
        const masterFlaw = Object.values(FLAWS).find(f => f.name.toLowerCase() === flawName.toLowerCase());
        if (masterFlaw) {
            flawCount++;
            flawsObj[flawCount.toString()] = { name: masterFlaw.name, data: masterFlaw.system };
            if (masterFlaw.system.cout.rang) modCostPerRank -= masterFlaw.system.cout.value;
            if (masterFlaw.system.cout.fixe) flatCost -= masterFlaw.system.cout.value;
        }
    });

    let netCostPerRank = baseCostPerRank + modCostPerRank;
    let totalRankCost = 0;
    let displayCostPerRank = "";

    if (netCostPerRank > 0) {
        totalRankCost = netCostPerRank * baseRank;
        displayCostPerRank = netCostPerRank.toString();
    } else {
        let ranksPerPoint = 2 - netCostPerRank;
        totalRankCost = Math.ceil(baseRank / ranksPerPoint);
        displayCostPerRank = `1/${ranksPerPoint}`;
    }

    return {
      "_id": existingIds[name] || createId(),
      "name": name,
      "type": "pouvoir",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg",
      "system": {
        "type": systemType,
        "activate": true,
        "special": "standard",
        "action": translatedAction,
        "portee": translationMap.range[range] || 'contact',
        "duree": translationMap.duration[duration] || 'instantane',
        "notes": `<p>${sanitizeText(row.Description)}</p>`,
        "description": `<p>${sanitizeText(row.Description)}</p>`,
        "effets": sanitizeText(row.Mechanics) ? `<p>${sanitizeText(row.Mechanics).toUpperCase()}</p>` : "",
        "effetsprincipaux": sanitizeText(row.Mechanics) ? `<p>${sanitizeText(row.Mechanics).toUpperCase()}</p>` : "",
        "link": "",
        "descripteurs": {},
        "extras": extrasObj,
        "defauts": flawsObj,
        "effectsVarianteSelected": "",
        "listEffectsVariantes": {},
        "edit": false,
        "carac": 0,
        "check": "",
        "cout": { 
          "rang": baseRank, 
          "parrang": baseCostPerRank, 
          "total": Math.max(1, totalRankCost + flatCost),
          "rangDyn": 0,
          "rangDynMax": 0,
          "divers": 0,
          "modrang": modCostPerRank,
          "modfixe": flatCost,
          "totalTheorique": Math.max(1, totalRankCost + flatCost),
          "parrangtotal": displayCostPerRank
        }
      },
      "effects": [],
      "folder": null,
      "sort": 0,
      "flags": {},
      "_stats": {
        "systemId": "mutants-and-masterminds-3e",
        "systemVersion": "1.39.13",
        "coreVersion": "12"
      }
    };
  }).filter(Boolean);
  await savePack('powers', items);
}

async function buildEquipment() {
  const existingIds = await loadExistingIds('equipment');
  const categories = ['melee', 'ranged', 'armor', 'utility'];
  const allDocs = [];
  for (const cat of categories) {
    const rows = await readCsv(path.join(__dirname, `../src/equipment/${cat}/${cat}.csv`));
    for (const row of rows) {
      const name = (row.Name || "").trim();
      if (!name) continue;
      allDocs.push({
        "_id": existingIds[name] || createId(),
        "name": name,
        "type": "equipement",
        "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
        "system": { "description": `<p>${sanitizeText(row.Notes)}</p>`, "cout": parseInt(row.Cost) || 1 },
        "effects": [],
        "flags": {
          "mnm-3e-expanded": {
            "link": row.ArrayGroup || ""
          }
        }
      });
    }
  }
  await savePack('equipment', allDocs);
}

async function buildVehicles() {
  const existingIds = await loadExistingIds('vehicles');
  const rows = await readCsv(path.join(__dirname, '../src/vehicles/vehicles.csv'));
  const allDocs = [];
  for (const row of rows) {
    const name = (row.Name || "").trim();
    if (!name) continue;
    allDocs.push({
      "_id": existingIds[name] || createId(),
      "name": name,
      "type": "equipement",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
      "system": { "description": `<p>${sanitizeText(row.Notes)}</p>`, "cout": parseInt(row.Cost) || 1 },
      "effects": [],
      "flags": {}
    });
  }
  await savePack('vehicles', allDocs);
}

async function buildHeadquarters() {
  const existingIds = await loadExistingIds('headquarters');
  const rows = await readCsv(path.join(__dirname, '../src/headquarters/headquarters.csv'));
  const allDocs = [];
  for (const row of rows) {
    const name = (row.Name || "").trim();
    if (!name) continue;
    allDocs.push({
      "_id": existingIds[name] || createId(),
      "name": name,
      "type": "equipement",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
      "system": { "description": `<p>${sanitizeText(row.Notes)}</p>`, "cout": parseInt(row.Cost) || 1 },
      "effects": [],
      "flags": {}
    });
  }
  await savePack('headquarters', allDocs);
}

async function buildModifiers(items, fileName) {
  const outFile = path.join(distDir, fileName);
  await fs.writeFile(outFile, items.map(i => JSON.stringify(i)).join('
'));
}

async function main() {
  await fs.ensureDir(distDir);
  await buildPowers();
  await buildModifiers(ADVANTAGES, 'advantages.db');
  await buildEquipment();
  await buildVehicles();
  await buildHeadquarters();
  await buildModifiers(EXTRAS, 'extras.db');
  await buildModifiers(FLAWS, 'flaws.db');
  console.log("Build Complete: Reorganized Extras and Flaws.");
}

main().catch(err => console.error(err));
