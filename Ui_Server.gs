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

// STOCK
function ui_getStockPage(page, size){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Stock');
  const total = sh ? Math.max(0, sh.getLastRow()-1) : 0;
  if (!sh || total===0) return {total:0, rows:[]};
  const start = Math.max(0, (page-1)*size);
  const rows = sh.getRange(2+start,1, Math.min(size,total-start), 15).getValues();
  return {total: total, rows: rows};
}
function ui_step3RefreshRefs(){ step3RefreshRefs(); return true; }

// VENTES
function ui_getVentesPage(page, size){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Ventes');
  const total = sh ? Math.max(0, sh.getLastRow()-1) : 0;
  if (!sh || total===0) return {total:0, rows:[]};
  const start = Math.max(0, (page-1)*size);
  const rows = sh.getRange(2+start,1, Math.min(size,total-start), 10).getValues();
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
