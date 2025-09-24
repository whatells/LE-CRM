/**
 * Module: Ui_Server.gs — API Apps Script pour l’UI
 * But: exposer les endpoints nécessaires à l’interface HtmlService sans dupliquer la logique métier.
 */
/**
 * Ponts serveur pour l'UI popup (HtmlService)
 * — Appelle tes fonctions existantes sans rien réécrire.
 */

// DASHBOARD
function ui_getDashboard(){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Dashboard');
  if (!sh) return {kpis:[], blocks:{}};
  const last = Math.max(2, sh.getLastRow());
  const kpis = sh.getRange(2,1,last-1,2).getValues().filter(r=>r[0]);
  return {kpis:kpis, blocks:{}};
}
function ui_buildDashboard(){ buildDashboard(); return true; }
function ui_ping(){ return {ok: true, ts: new Date().toISOString()}; }

// STOCK
function ui_getStockPage(page, size){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Stock');
  const total = sh ? Math.max(0, sh.getLastRow()-1) : 0;
  if (!sh || total === 0) return {total: 0, rows: []};
  const effectiveSize = Math.max(1, size || 1);
  const pages = Math.max(1, Math.ceil(total / effectiveSize));
  const current = Math.min(pages, Math.max(1, page || 1));
  const start = (current - 1) * effectiveSize;
  if (start >= total) return {total: total, rows: []};
  const height = Math.min(effectiveSize, total - start);
  if (height <= 0) return {total: total, rows: []};
  const rows = sh.getRange(2 + start, 1, height, 15).getValues();
  return {total: total, rows: rows};
}
function ui_step3RefreshRefs(){ step3RefreshRefs(); return true; }

// VENTES
function ui_getVentesPage(page, size){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Ventes');
  const total = sh ? Math.max(0, sh.getLastRow()-1) : 0;
  if (!sh || total === 0) return {total: 0, rows: []};
  const effectiveSize = Math.max(1, size || 1);
  const pages = Math.max(1, Math.ceil(total / effectiveSize));
  const current = Math.min(pages, Math.max(1, page || 1));
  const start = (current - 1) * effectiveSize;
  if (start >= total) return {total: total, rows: []};
  const height = Math.min(effectiveSize, total - start);
  if (height <= 0) return {total: total, rows: []};
  const rows = sh.getRange(2 + start, 1, height, 10).getValues();
  return {total: total, rows: rows};
}
function ui_step8RecalcAll(){ step8RecalcAll(); return true; }

// EMAILS & LOGS
function ui_getLogsTail(n){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Logs');
  if (!sh || sh.getLastRow()<2) return [];
  const last = sh.getLastRow();
  const take = Math.min(n||50, last-1);
  return sh.getRange(last-take+1,1,take,5).getValues();
}
function ui_ingestFast(){ ingestAllLabelsFast(); return true; }

// CONFIG
function ui_getConfig(){ return (typeof getKnownConfig==='function') ? getKnownConfig() : []; }
function ui_saveConfig(rows){ return saveConfigValues(rows); }

// COUTS DE FONCTIONNEMENT
const COSTS_SHEET_NAME = 'Coûts fonctionnement';
const COSTS_HEADERS = ['Date','Catégorie','Libellé','Montant','Notes'];

function getOrCreateCostsSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(COSTS_SHEET_NAME);
  if (!sh){
    sh = ss.insertSheet(COSTS_SHEET_NAME);
    sh.getRange(1, 1, 1, COSTS_HEADERS.length).setValues([COSTS_HEADERS]);
    sh.getRange(1, 1, 1, COSTS_HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  }
  const headerRange = sh.getRange(1, 1, 1, COSTS_HEADERS.length);
  const currentHeader = headerRange.getValues()[0];
  const needsUpdate = COSTS_HEADERS.some((h, idx)=>currentHeader[idx] !== h);
  if (needsUpdate){
    headerRange.setValues([COSTS_HEADERS]);
  }
  headerRange.setFontWeight('bold');
  if (sh.getFrozenRows() < 1){
    sh.setFrozenRows(1);
  }
  return sh;
}

function ui_getCostsPage(page, size){
  const sh = getOrCreateCostsSheet_();
  const total = Math.max(0, sh.getLastRow() - 1);
  if (total === 0) return {total: 0, rows: []};
  const effectiveSize = Math.max(1, size || 1);
  const pages = Math.max(1, Math.ceil(total / effectiveSize));
  const current = Math.min(pages, Math.max(1, page || 1));
  const start = (current - 1) * effectiveSize;
  if (start >= total) return {total: total, rows: []};
  const height = Math.min(effectiveSize, total - start);
  if (height <= 0) return {total: total, rows: []};
  const rows = sh.getRange(2 + start, 1, height, COSTS_HEADERS.length).getValues();
  const tz = Session.getScriptTimeZone();
  const formatted = rows.map(row=>{
    const copy = row.slice(0, COSTS_HEADERS.length);
    if (copy[0] instanceof Date){
      copy[0] = Utilities.formatDate(copy[0], tz, 'yyyy-MM-dd');
    }
    if (typeof copy[3] === 'number'){
      copy[3] = copy[3].toFixed(2);
    }
    return copy;
  });
  return {total: total, rows: formatted};
}

function ui_addCost(data){
  const payload = data || {};
  const label = String(payload.label || '').trim();
  if (!label){
    throw new Error('Libellé requis');
  }
  let amountRaw = payload.amount;
  if (typeof amountRaw === 'string'){
    amountRaw = amountRaw.replace(',', '.').trim();
  }
  if (amountRaw === '' || amountRaw === null || amountRaw === undefined){
    throw new Error('Montant requis');
  }
  const amount = Number(amountRaw);
  if (!isFinite(amount)){
    throw new Error('Montant invalide');
  }
  const typeRaw = String(payload.type || '').toLowerCase();
  const category = typeRaw.startsWith('r') ? 'Récurrent' : 'Ponctuel';
  let notes = '';
  if (category === 'Récurrent'){
    const recurrenceRaw = String(payload.recurrence || '').toLowerCase();
    const recurrenceMap = {
      'hebdo': 'hebdo',
      'hebdomadaire': 'hebdo',
      'mensuel': 'mensuel',
      'mensuelle': 'mensuel',
      'trimestriel': 'trimestriel',
      'trimestrielle': 'trimestriel',
      'annuel': 'annuel',
      'annuelle': 'annuel'
    };
    const recurrenceKey = recurrenceMap[recurrenceRaw];
    if (!recurrenceKey){
      throw new Error('Récurrence invalide');
    }
    notes = 'recurrence:' + recurrenceKey;
  }
  const sh = getOrCreateCostsSheet_();
  const normalizedAmount = Math.round(amount * 100) / 100;
  sh.appendRow([new Date(), category, label, normalizedAmount, notes]);
  const rowNumber = sh.getLastRow();
  return {ok: true, row: rowNumber};
}

function ui_seedDefaultCosts(){
  const sh = getOrCreateCostsSheet_();
  const tz = Session.getScriptTimeZone();
  const todayKey = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const existingKeys = new Set();
  const lastRow = sh.getLastRow();
  if (lastRow > 1){
    const values = sh.getRange(2, 1, lastRow - 1, 3).getValues();
    values.forEach(row=>{
      const rawDate = row[0];
      const rawLabel = row[2];
      if (!rawLabel){
        return;
      }
      let dateKey = '';
      if (rawDate instanceof Date){
        dateKey = Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd');
      } else if (rawDate) {
        dateKey = String(rawDate).slice(0, 10);
      }
      if (dateKey){
        existingKeys.add(`${dateKey}::${String(rawLabel).trim()}`);
      }
    });
  }
  const defaults = ['Vtools','Photoroom','readycook','VintedCRM'];
  const rowsToInsert = [];
  defaults.forEach(label=>{
    const key = `${todayKey}::${label}`;
    if (!existingKeys.has(key)){
      rowsToInsert.push([new Date(), 'Récurrent', label, 0, 'recurrence:mensuel']);
      existingKeys.add(key);
    }
  });
  if (rowsToInsert.length){
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, rowsToInsert.length, COSTS_HEADERS.length).setValues(rowsToInsert);
  }
  return {ok: true, count: rowsToInsert.length};
}
