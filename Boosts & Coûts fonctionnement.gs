/**
 * Étape 7 — Boosts & Coûts fonctionnement (v1 simple)
 * - Deux prompts rapides pour ajouter des lignes dans les onglets Boosts / Coûts fonctionnement
 * - Un résumé mensuel (sommes) écrit dans Logs
 * - Idempotent: juste des insertions, pas d’API externe
 */

const SHEET_BOOSTS = "Boosts";
const SHEET_COSTS  = "Coûts fonctionnement";
const SHEET_LOGS   = "Logs";

// ---------- Ajout via prompts ----------
function addBoostPrompt(){
  const ui = SpreadsheetApp.getUi();
  const platform = ui.prompt("Boost — Plateforme", "Ex: Vinted / eBay / Vestiaire…", ui.ButtonSet.OK_CANCEL);
  if (platform.getSelectedButton() !== ui.Button.OK) return;
  const type = ui.prompt("Type de boost", "Ex: dressing / article / sponsorisé", ui.ButtonSet.OK_CANCEL);
  if (type.getSelectedButton() !== ui.Button.OK) return;
  const cible = ui.prompt("Cible", "Ex: SKU, catégorie, ou 'dressing'", ui.ButtonSet.OK_CANCEL);
  if (cible.getSelectedButton() !== ui.Button.OK) return;
  const cost = ui.prompt("Coût (€)", "Ex: 3.50", ui.ButtonSet.OK_CANCEL);
  if (cost.getSelectedButton() !== ui.Button.OK) return;

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_BOOSTS);
  const row = Math.max(2, sh.getLastRow()+1);
  sh.getRange(row,1).setValue(new Date());
  sh.getRange(row,2).setValue(platform.getResponseText());
  sh.getRange(row,3).setValue(type.getResponseText());
  sh.getRange(row,4).setValue(cible.getResponseText());
  sh.getRange(row,5).setValue(Number(String(cost.getResponseText()).replace(',','.')));
  sh.getRange(row,6).setValue(""); // KPI/Notes libre
}

function addCostPrompt(){
  const ui = SpreadsheetApp.getUi();
  const cat = ui.prompt("Catégorie", "Ex: logiciel / emballage / paiement", ui.ButtonSet.OK_CANCEL);
  if (cat.getSelectedButton() !== ui.Button.OK) return;
  const label = ui.prompt("Libellé", "Ex: Abonnement Pro", ui.ButtonSet.OK_CANCEL);
  if (label.getSelectedButton() !== ui.Button.OK) return;
  const amount = ui.prompt("Montant (€)", "Ex: 9.99", ui.ButtonSet.OK_CANCEL);
  if (amount.getSelectedButton() !== ui.Button.OK) return;

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_COSTS);
  const row = Math.max(2, sh.getLastRow()+1);
  sh.getRange(row,1).setValue(new Date());
  sh.getRange(row,2).setValue(cat.getResponseText());
  sh.getRange(row,3).setValue(label.getResponseText());
  sh.getRange(row,4).setValue(Number(String(amount.getResponseText()).replace(',','.')));
  sh.getRange(row,5).setValue(""); // Notes
}

// ---------- Résumé mensuel écrit dans Logs ----------
function logMonthlyCostsAndBoosts(){
  const ss = SpreadsheetApp.getActive();
  const shB = ss.getSheetByName(SHEET_BOOSTS);
  const shC = ss.getSheetByName(SHEET_COSTS);
  const month = new Date();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const next = new Date(month.getFullYear(), month.getMonth()+1, 1);

  const sumB = sumInDateRange_(shB, 1, 5, first, next); // date col1, coût col5
  const sumC = sumInDateRange_(shC, 1, 4, first, next); // date col1, montant col4

  appendLog_("INFO", "Étape7", `Boosts/mois: ${sumB.toFixed(2)} € | Coûts/mois: ${sumC.toFixed(2)} €`);
}

function sumInDateRange_(sheet, colDate, colAmount, start, end){
  if (!sheet || sheet.getLastRow()<2) return 0;
  const vals = sheet.getRange(2,1, sheet.getLastRow()-1, Math.max(colDate,colAmount)).getValues();
  let sum = 0;
  for (let i=0;i<vals.length;i++){
    const d = vals[i][colDate-1];
    const a = Number(vals[i][colAmount-1]||0);
    if (d && d>=start && d<end) sum += a;
  }
  return sum;
}

function appendLog_(level, source, message){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_LOGS) || ss.insertSheet(SHEET_LOGS);
  if (sh.getLastRow()===0){
    sh.getRange(1,1,1,5).setValues([["Horodatage","Niveau","Source","Message","Détails"]]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), level, source, message, ""]);
}
