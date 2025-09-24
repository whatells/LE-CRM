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
