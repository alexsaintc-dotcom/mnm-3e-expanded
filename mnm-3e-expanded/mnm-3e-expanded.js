console.log('%c M&M 3E EXPANDED | SYSTEM HIJACK ACTIVE (V3.3.58) ', 'background: #800080; color: #fff; font-weight: bold;');

/**
 * Calculates the theoretical full cost of a power based on M&M 3e rules.
 */
function calculatePowerCost(item) {
  const c = item.system?.cout || {};
  const r = c.rang || 0;
  const pr = c.parrang || 0;
  const mr = c.modrang || 0;
  const fc = c.modfixe || 0;
  const d = c.divers || 0;
  const net = pr + mr;
  
  if (net > 0) return Math.max(1, (net * r) + fc + d);
  const ranksPerPoint = 2 - net;
  return Math.max(1, Math.ceil(r / ranksPerPoint) + fc + d);
}

/**
 * The core logic to override Power and Equipment PP/EP totals.
 * This is run every time the actor data is prepared.
 */
function applyExpandedLogic(actor) {
  if (actor.type !== 'personnage') return;

  const powers = actor.items.filter(i => i.type === 'pouvoir');
  const equipment = actor.items.filter(i => i.type === 'equipement');

  // --- 1. POWER ARRAY LOGIC ---
  if (powers.length > 0) {
    const pArrays = {};
    powers.forEach(p => {
      const link = p.system.link;
      if (link) {
        const parent = actor.items.get(link) || powers.find(i => i.name === link);
        if (parent) {
          const pId = parent._id;
          if (!pArrays[pId]) pArrays[pId] = [pId];
          if (!pArrays[pId].includes(p._id)) pArrays[pId].push(p._id);
        }
      }
    });

    const pArrayMetadata = {};
    for (const pId in pArrays) {
      let maxCost = 0;
      let bearerId = pId;
      pArrays[pId].forEach(id => {
        const item = actor.items.get(id);
        if (!item) return;
        const full = calculatePowerCost(item);
        if (full > maxCost) { maxCost = full; bearerId = id; }
      });
      pArrayMetadata[pId] = { max: maxCost, bearer: bearerId };
    }

    let totalPowerPP = 0;
    powers.forEach(item => {
      const full = calculatePowerCost(item);
      let target = full;
      const link = item.system.link;
      const parent = link ? (actor.items.get(link) || powers.find(i => i.name === link)) : null;
      const parentId = pArrays[item._id] ? item._id : (parent ? parent._id : null);

      if (parentId && pArrayMetadata[parentId]) {
        const meta = pArrayMetadata[parentId];
        target = (item._id === meta.bearer) ? meta.max : 0;
      }
      item.system.cout.total = target;
      item.system.cout.totalTheorique = target;
      if (target === 0) item.system.cout.parrangtotal = "0";
      totalPowerPP += target;
    });

    if (actor.system?.pp) {
      actor.system.pp.pouvoirs = totalPowerPP;
      const pp = actor.system.pp;
      const newUsed = (pp.caracteristiques || 0) + totalPowerPP + (pp.talents || 0) + (pp.competences || 0) + (pp.defenses || 0) + (pp.divers || 0);
      actor.system.pp.used = newUsed;
    }
  }

  // --- 2. EQUIPMENT ARRAY LOGIC ---
  if (equipment.length > 0) {
    const eArrays = {};
    equipment.forEach(e => {
      const link = e.flags['mnm-3e-expanded']?.link;
      if (link) {
        const parent = actor.items.get(link) || equipment.find(i => i.name === link);
        if (parent) {
          const pId = parent._id;
          if (!eArrays[pId]) eArrays[pId] = [pId];
          if (!eArrays[pId].includes(e._id)) eArrays[pId].push(e._id);
        }
      }
    });

    const eArrayMetadata = {};
    for (const pId in eArrays) {
      let maxCost = 0;
      let bearerId = pId;
      eArrays[pId].forEach(id => {
        const item = actor.items.get(id);
        if (!item) return;
        const cost = parseInt(item.system.cout) || 0;
        if (cost > maxCost) { maxCost = cost; bearerId = id; }
      });
      eArrayMetadata[pId] = { max: maxCost, bearer: bearerId };
    }

    let totalEquipmentEP = 0;
    equipment.forEach(item => {
      const baseCost = parseInt(item.system.cout) || 0;
      let target = baseCost;
      const link = item.flags['mnm-3e-expanded']?.link;
      const parent = link ? (actor.items.get(link) || equipment.find(i => i.name === link)) : null;
      const parentId = eArrays[item._id] ? item._id : (parent ? parent._id : null);

      if (parentId && eArrayMetadata[parentId]) {
        const meta = eArrayMetadata[parentId];
        // In M&M 3e, Equipment Arrays usually cost: Most Expensive + 1 EP per Alternate.
        // We simulate this by making alternates cost 1 EP instead of their full cost.
        target = (item._id === meta.bearer) ? meta.max : 1;
      }
      
      // Update the derived cost for the sheet display
      item.system.derivedCout = target;
      totalEquipmentEP += target;
    });

    if (actor.system?.ptsEquipements) {
      actor.system.ptsEquipements.use = totalEquipmentEP;
    }
  }
}

// HIJACK: Inject our logic into the Actor's calculation process
Hooks.once('init', () => {
  const originalPrepareDerivedData = CONFIG.Actor.documentClass.prototype.prepareDerivedData;
  CONFIG.Actor.documentClass.prototype.prepareDerivedData = function() {
    originalPrepareDerivedData.call(this);
    applyExpandedLogic(this);
  };
});

// Structural Healing
async function structuralFixes(actor) {
  if (!actor.isOwner || actor._fixing) return;
  const updates = [];
  for (let item of actor.items) {
    if (item.type === 'pouvoir') {
      let needsUpdate = false;
      const update = { _id: item._id };
      if (Array.isArray(item.system.extras)) {
        const obj = {};
        item.system.extras.forEach((e, i) => { if (e) obj[i + 1] = e; });
        update['system.extras'] = obj;
        needsUpdate = true;
      }
      if (Array.isArray(item.system.defauts)) {
        const obj = {};
        item.system.defauts.forEach((f, i) => { if (f) obj[i + 1] = f; });
        update['system.defauts'] = obj;
        needsUpdate = true;
      }
      if (needsUpdate) updates.push(update);
    }
  }
  if (updates.length > 0) {
    actor._fixing = true;
    await actor.updateEmbeddedDocuments('Item', updates);
    delete actor._fixing;
  }
}

Hooks.on('renderActorSheet', (app, html, data) => {
  const actor = data.actor || app.actor;
  if (actor) structuralFixes(actor);
});

// Drag and Drop Logic for Powers
Hooks.on('renderActorSheet', (app, html, data) => {
  const actor = data.actor || app.actor;
  if (!actor || actor.type !== 'personnage') return;

  const powerList = html.find('.pouvoir-list, .item-list');
  const powers = powerList.find('.item.pouvoir, .pouvoir-item');

  if (powers.length > 0) {
    powers.attr('draggable', true);
    powers.on('dragstart', (ev) => {
      const li = ev.currentTarget;
      ev.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'Item',
        uuid: actor.items.get(li.dataset.itemId).uuid,
        sort: parseInt(li.dataset.sort || 0)
      }));
    });

    powerList.on('drop', async (ev) => {
      const dragData = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
      if (dragData.type !== 'Item') return;
      const targetLi = $(ev.target).closest('.item');
      if (!targetLi.length) return;
      const targetId = targetLi.data('itemId');
      const sourceId = dragData.uuid.split('.').pop();
      if (targetId === sourceId) return;
      const siblings = actor.items.filter(i => i.type === 'pouvoir');
      const sourceItem = actor.items.get(sourceId);
      const targetItem = actor.items.get(targetId);
      if (!sourceItem || !targetItem) return;
      const updates = SortingHelpers.performIntegerSort(sourceItem, { target: targetItem, siblings: siblings, sortKey: 'sort' });
      const updateData = updates.map(u => ({ _id: u.target._id, sort: u.update.sort }));
      await actor.updateEmbeddedDocuments('Item', updateData);
    });
  }
});
