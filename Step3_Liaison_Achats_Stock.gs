// ==============================
// FICHIER 3 / 3 : Step3_Liaison_Achats_Stock.gs (COMPLET)
// ==============================

/**
 * Étape 3 — Liaison Achats ↔ Stock
 * Objectif : choisir une "Réf. Achat" (générée automatiquement) dans Stock!M
 * et propager le "Prix achat" depuis Achats!C vers Stock!I.
 *
 * Implémentation :
 * - Ajoute/maintient une colonne "Réf (auto)" en fin d’onglet Achats (colonne I)
 *   avec des IDs de type ACH-00001, ACH-00002…
 * - Fait une liste déroulante dans Stock!M basée sur Achats!I
 * - À la sélection d’une Réf, on recopie le Prix achat correspondant dans Stock!I
 */

var SHEET_ACHATS = "Achats";
var COL_ACHATS_DATE = 1;     // A
var COL_ACHATS_FOURN = 2;    // B
var COL_ACHATS_PRIX = 3;     // C
var COL_ACHATS_REF  = 9;     // I (ajouté automatiquement : "Réf (auto)")

var COL_STOCK_PRIX_ACHAT = 9; // I
var COL_STOCK_REF_ACHAT  = 13; // M

// ---- Menu actions ----
function step3RefreshRefs() {
  var ss = SpreadsheetApp.getActive();
  var shA = ss.getSheetByName(SHEET_ACHATS);
  var shS = ss.getSheetByName(SHEET_STOCK);
  if (!shA || !shS) return;

  step3EnsureAchatsRefColumn_(shA);
  step3FillRefs_(shA);
  step3ApplyStockValidation_(shS, shA);
  log_("INFO", "Étape3", "Références Achats générées + liste déroulante mise à jour");
}

function step3PropagateAll() {
  var ss = SpreadsheetApp.getActive();
  var shA = ss.getSheetByName(SHEET_ACHATS);
  var shS = ss.getSheetByName(SHEET_STOCK);
  if (!shA || !shS) return;

  var map = step3BuildRefToPriceMap_(shA);
  var lastRow = shS.getLastRow();
  for (var r = 2; r <= lastRow; r++) {
    step3PropagateRowWithMap_(shS, r, map);
  }
  log_("INFO", "Étape3", "Propagation complète effectuée");
}

function step3PropagateCurrent() {
  var shS = SpreadsheetApp.getActiveSheet();
  if (!shS || shS.getName() !== SHEET_STOCK) return;
  var r = shS.getActiveRange().getRow();
  if (r < 2) return;
  step3PropagateRow_(shS, r);
}

// ---- Cœur de la liaison ----
function step3PropagateRow_(stockSheet, row) {
  var ss = SpreadsheetApp.getActive();
  var shA = ss.getSheetByName(SHEET_ACHATS);
  if (!shA) return;
  var map = step3BuildRefToPriceMap_(shA);
  step3PropagateRowWithMap_(stockSheet, row, map);
}

function step3PropagateRowWithMap_(shS, row, map) {
  var ref = String(shS.getRange(row, COL_STOCK_REF_ACHAT).getValue() || "").trim();
  if (!ref) return;
  var price = map[ref];
  if (price == null || price === "") return;
  var cell = shS.getRange(row, COL_STOCK_PRIX_ACHAT);
  if (String(cell.getValue()) !== String(price)) {
    cell.setValue(price);
  }
}

function step3BuildRefToPriceMap_(shA) {
  var lastRow = shA.getLastRow();
  if (lastRow < 2) return {};
  var refs = shA.getRange(2, COL_ACHATS_REF, lastRow - 1, 1).getValues();
  var prix = shA.getRange(2, COL_ACHATS_PRIX, lastRow - 1, 1).getValues();
  var out = {};
  for (var i = 0; i < refs.length; i++) {
    var ref = String(refs[i][0] || "").trim();
    if (!ref) continue;
    out[ref] = prix[i][0];
  }
  return out;
}

// ---- Préparation côté Achats ----
function step3EnsureAchatsRefColumn_(shA) {
  var lastCol = shA.getLastColumn();
  if (lastCol < COL_ACHATS_REF) {
    // Ajoute des colonnes jusqu’à I si besoin
    shA.insertColumnsAfter(lastCol, COL_ACHATS_REF - lastCol);
  }
  // Pose l’en-tête si manquant
  if (!String(shA.getRange(1, COL_ACHATS_REF).getValue())) {
    shA.getRange(1, COL_ACHATS_REF).setValue("Réf (auto)").setFontWeight("bold");
  }
}

function step3FillRefs_(shA) {
  var lastRow = shA.getLastRow();
  if (lastRow < 2) return;
  var rng = shA.getRange(2, COL_ACHATS_REF, lastRow - 1, 1);
  var vals = rng.getValues();
  for (var i = 0; i < vals.length; i++) {
    if (!vals[i][0]) {
      var id = "ACH-" + Utilities.formatString("%05d", (i + 1));
      vals[i][0] = id;
    }
  }
  rng.setValues(vals);
}

// ---- Validation côté Stock ----
function step3ApplyStockValidation_(shS, shA) {
  var lastRowA = Math.max(2, shA.getLastRow());
  var listRange = shA.getRange(2, COL_ACHATS_REF, lastRowA - 1, 1); // Achats!I2:I
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(listRange, true) // liste déroulante, cellule vide autorisée
    .setAllowInvalid(false)
    .build();
  // Applique la validation sur toute la colonne M du Stock
  var lastRowS = shS.getMaxRows();
  shS.getRange(2, COL_STOCK_REF_ACHAT, lastRowS - 1, 1).setDataValidation(rule);
}
