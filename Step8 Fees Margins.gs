/**
 * Étape 8 — Calculs commissions & marges avancés
 * - Calcule la commission par plateforme: max(min, pct*prix + flat)
 * - Marge brute = PV − Prix achat − Commission − Frais port
 * - Marge nette = Marge brute − coûts fixes (si ON) − URSSAF (si ON)
 * - Fournit des actions menu: recalcul sur toute la feuille Ventes ou la ligne courante
 * - Override insertSale_ pour utiliser ces règles lors de l'ingestion
 */

// Colonnes Ventes (1-based)
var COL_V_DATE = 1;
var COL_V_PLATFORM = 2;
var COL_V_TITLE = 3;
var COL_V_PRICE = 4;
var COL_V_FEES = 5;       // Frais/Commission
var COL_V_SHIP = 6;       // Frais port
var COL_V_BUYER = 7;      // Acheteur (non utilisé ici)
var COL_V_SKU = 8;
var COL_V_MARGIN_G = 9;   // Marge brute
var COL_V_MARGIN_N = 10;  // Marge nette

// Pour remonter Prix achat depuis Stock
var SHEET_STOCK = "Stock";
var COL_S_SKU = 2;        // B
var COL_S_COST = 9;       // I Prix achat (link)

// ---- Calculs unitaires ----
function step8CommissionFor_(platform, price){
  var fees = getPlatformFees_(platform); // {pct,min,flat}
  var raw = price * (fees.pct||0) + (fees.flat||0);
  return Math.max(raw, fees.min||0);
}

function step8LookupCostBySku_(sku){
  if (!sku) return 0;
  var ss = SpreadsheetApp.getActive();
  var st = ss.getSheetByName(SHEET_STOCK);
  if (!st) return 0;
  var last = st.getLastRow();
  if (last<2) return 0;
  var skus = st.getRange(2, COL_S_SKU, last-1, 1).getValues();
  for (var i=0;i<skus.length;i++){
    if (String(skus[i][0]).toUpperCase()===String(sku).toUpperCase()){
      var cost = st.getRange(i+2, COL_S_COST).getValue();
      return Number(cost||0);
    }
  }
  return 0;
}

function step8ComputeMargins_(platform, price, ship, sku){
  var flags = getGlobalFlags_();
  var fees = step8CommissionFor_(platform, price);
  var cost = step8LookupCostBySku_(sku);
  var gross = Number(price||0) - Number(cost||0) - Number(fees||0) - Number(ship||0);
  var fixed = flags.applyFixedCosts ? Number(flags.fixedCostPerSale||0) : 0;
  var urssaf = flags.applyUrssaf ? (Number(flags.urssafRate||0) * Math.max(gross,0)) : 0; // base: marge brute >=0
  var net = gross - fixed - urssaf;
  if (flags.roundMargins){
    gross = Math.round(gross*100)/100;
    net   = Math.round(net*100)/100;
    fees  = Math.round(fees*100)/100;
  }
  return {fees:fees, gross:gross, net:net};
}

// ---- Recalculs ----
function step8RecalcAll(){
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName("Ventes");
  if (!sh || sh.getLastRow()<2) return;
  var last = sh.getLastRow();
  var vals = sh.getRange(2,1,last-1, COL_V_MARGIN_N).getValues();
  for (var i=0;i<vals.length;i++){
    var r = i+2;
    var platform = vals[i][COL_V_PLATFORM-1];
    var price    = Number(vals[i][COL_V_PRICE-1]||0);
    var ship     = Number(vals[i][COL_V_SHIP-1]||0);
    var sku      = vals[i][COL_V_SKU-1];
    var m = step8ComputeMargins_(platform, price, ship, sku);
    sh.getRange(r, COL_V_FEES).setValue(m.fees);
    sh.getRange(r, COL_V_MARGIN_G).setValue(m.gross);
    sh.getRange(r, COL_V_MARGIN_N).setValue(m.net);
  }
}

function step8RecalcCurrent(){
  var sh = SpreadsheetApp.getActiveSheet();
  if (!sh || sh.getName()!=="Ventes") return;
  var r = sh.getActiveRange().getRow();
  if (r<2) return;
  var platform = sh.getRange(r,COL_V_PLATFORM).getValue();
  var price    = Number(sh.getRange(r,COL_V_PRICE).getValue()||0);
  var ship     = Number(sh.getRange(r,COL_V_SHIP).getValue()||0);
  var sku      = String(sh.getRange(r,COL_V_SKU).getValue()||"");
  var m = step8ComputeMargins_(platform, price, ship, sku);
  sh.getRange(r, COL_V_FEES).setValue(m.fees);
  sh.getRange(r, COL_V_MARGIN_G).setValue(m.gross);
  sh.getRange(r, COL_V_MARGIN_N).setValue(m.net);
}

// ---- Override de insertSale_ (l'ingestion utilisera ces règles automatiquement) ----
function insertSale_(sh, d){
  var row = Math.max(2, sh.getLastRow()+1);
  var m = step8ComputeMargins_(d.platform, Number(d.price||0), 0, d.sku||""); // frais port inconnus à l'ingest
  sh.getRange(row, COL_V_DATE).setValue(new Date());
  sh.getRange(row, COL_V_PLATFORM).setValue(d.platform);
  sh.getRange(row, COL_V_TITLE).setValue(d.title);
  sh.getRange(row, COL_V_PRICE).setValue(d.price);
  sh.getRange(row, COL_V_FEES).setValue(m.fees);
  // COL_V_SHIP laissé à 0 par défaut; tu peux remplir plus tard puis relancer step8RecalcCurrent
  sh.getRange(row, COL_V_SKU).setValue(d.sku||"");
  sh.getRange(row, COL_V_MARGIN_G).setValue(m.gross);
  sh.getRange(row, COL_V_MARGIN_N).setValue(m.net);
}
