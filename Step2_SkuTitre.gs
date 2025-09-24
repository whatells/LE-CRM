// ==============================
// FICHIER 2 / 3 : Step2_SkuTitre.gs (COMPLET — VERSION ÉTAPE 3)
// ==============================

/**
 * Étape 2 — Règles SKU & Titre + hook Étape 3
 * - Stock : forcer SKU en MAJ, garantir présence du SKU dans le Titre
 * - Ventes : extraire le SKU depuis le Titre vers la colonne SKU
 * - OnEdit prend aussi en charge la colonne "Réf. Achat" de Stock (Étape 3)
 */

var SHEET_STOCK  = "Stock";
var SHEET_VENTES = "Ventes";
var COL_STOCK_SKU = 2;   // B
var COL_STOCK_TIT = 3;   // C
var COL_STOCK_REF = 13;  // M (Réf. Achat)
var COL_VENTES_TIT = 3;  // C
var COL_VENTES_SKU = 8;  // H

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    var r = e.range.getRow();
    var c = e.range.getColumn();
    if (r < 2) return; // ignorer l’en-tête

    var name = sh.getName();
    if (name === SHEET_STOCK) {
      if (c === COL_STOCK_SKU || c === COL_STOCK_TIT) {
        fixOneStockRow_(sh, r);
      }
      if (c === COL_STOCK_REF) {
        // Étape 3 : dès qu’on choisit une Réf Achat, on propage le prix
        step3PropagateRow_(sh, r);
      }
      return;
    }

    if (name === SHEET_VENTES) {
      if (c === COL_VENTES_TIT || c === COL_VENTES_SKU) {
        fixOneVenteRow_(sh, r);
      }
      return;
    }
  } catch (err) {
    log_("ERROR", "onEdit", String(err));
  }
}

// ---------- STOCK : maintenance ligne par ligne ----------
function fixOneStockRow_(sh, row) {
  var sku = String(sh.getRange(row, COL_STOCK_SKU).getValue() || "").trim().toUpperCase();
  var title = String(sh.getRange(row, COL_STOCK_TIT).getValue() || "").trim();

  if (sku && sku !== String(sh.getRange(row, COL_STOCK_SKU).getValue())) {
    sh.getRange(row, COL_STOCK_SKU).setValue(sku);
  }

  var okSku = /^[A-Z0-9]{1,4}$/.test(sku);
  if (okSku) {
    var re = new RegExp("\\b" + sku + "\\b");
    if (!re.test(title)) {
      title = (title ? title + " " : "") + sku;
      sh.getRange(row, COL_STOCK_TIT).setValue(title);
    }
  }
}

// ---------- VENTES : maintenance ligne par ligne ----------
function fixOneVenteRow_(sh, row) {
  var title = String(sh.getRange(row, COL_VENTES_TIT).getValue() || "").trim();
  var sku = String(sh.getRange(row, COL_VENTES_SKU).getValue() || "").trim().toUpperCase();

  var m = title.match(/\b[A-Z0-9]{1,4}\b/);
  if (m && m[0]) {
    var extracted = m[0].toUpperCase();
    if (!sku || sku !== extracted) {
      sku = extracted;
      sh.getRange(row, COL_VENTES_SKU).setValue(sku);
    }
  }

  if (sku) {
    var re = new RegExp("\\b" + sku + "\\b");
    if (!re.test(title)) {
      title = (title ? title + " " : "") + sku;
      sh.getRange(row, COL_VENTES_TIT).setValue(title);
    }
  }
}
