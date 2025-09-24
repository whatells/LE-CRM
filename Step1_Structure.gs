/** Étape 1 : Structure des onglets + formats + validations */
function formulaSep_() {
  var loc = SpreadsheetApp.getActive().getSpreadsheetLocale() || "";
  return /^fr/i.test(loc) ? ";" : ",";
}

var SHEETS_ORDER = [
  "Dashboard",
  "Achats",
  "Stock",
  "Ventes",
  "Bordereaux",
  "Boosts",
  "Coûts fonctionnement",
  "Configuration",
  "Logs"
];

var HEADERS = {
  "Dashboard": ["KPI", "Valeur"],
  "Achats": ["Date achat", "Fournisseur", "Prix achat", "Catégorie", "Marque", "Taille", "État", "Notes"],
  "Stock": ["Date entrée", "SKU", "Titre (avec SKU)", "Photos", "Catégorie", "Marque", "Taille", "État", "Prix achat (link)", "Prix cible", "Statut", "Plateforme", "Réf. Achat", "Favoris", "Offres", "Notes"],
  "Ventes": ["Date vente", "Plateforme", "Titre (avec SKU)", "Prix de vente", "Frais/Commission", "Frais port", "Acheteur", "SKU", "Marge brute", "Marge nette", "N° suivi", "Mode d’envoi"],
  "Bordereaux": ["Date", "Plateforme", "SKU", "Titre", "PDF (lien)", "N° suivi", "Statut"],
  "Boosts": ["Date", "Plateforme", "Type boost", "Cible", "Coût", "KPI/Notes"],
  "Coûts fonctionnement": ["Date", "Catégorie", "Libellé", "Montant", "Notes"],
  "Configuration": ["Clé", "Valeur", "Notes"],
  "Logs": ["Horodatage", "Niveau", "Source", "Message", "Détails"]
};

var DATE_FMT = "dd/mm/yyyy";
var EUR_FMT  = "#,##0.00\\ €";
var FORMATS = {
  "Achats": { dateCols: [1], eurCols: [3] },
  "Stock":  { dateCols: [1], eurCols: [9,10] },
  "Ventes": { dateCols: [1], eurCols: [4,5,6,9,10] },
  "Bordereaux": { dateCols: [1] },
  "Boosts": { dateCols: [1], eurCols: [5] },
  "Coûts fonctionnement": { dateCols: [1], eurCols: [4] }
};
var SAMPLE_ROWS = 10;

function runStep1() {
  var ss = SpreadsheetApp.getActive();

  var sheets = ensureSheets_(ss, SHEETS_ORDER, HEADERS);

  Object.keys(HEADERS).forEach(function(name) {
    var sh = sheets[name];
    applyFormats_(sh, name);
    addFilter_(sh);
  });

  buildStock_(sheets["Stock"]);
  buildVentesSKU_(sheets["Ventes"]);

  addConditionalFormatting_(sheets["Stock"]);
  addConditionalFormatting_(sheets["Ventes"]);

  seedExamples_(sheets);
  protectHeadersWarn_(sheets);

  ss.setActiveSheet(sheets["Dashboard"]);
  log_("INFO", "runStep1", "Structure créée/mise à jour.");
}

/** Création + ordre + en-têtes */
function ensureSheets_(ss, order, headersBySheet) {
  var map = {};
  order.forEach(function(name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name, ss.getNumSheets());
    map[name] = sh;
  });

  order.forEach(function(name, i) {
    ss.setActiveSheet(map[name]);
    ss.moveActiveSheet(i + 1);
  });

  order.forEach(function(name) {
    var sh = map[name];
    var headers = headersBySheet[name] || [];
    sh.clear({ contentsOnly: true });
    if (headers.length) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
      sh.setFrozenRows(1);
      headers.forEach(function(_, i) { sh.setColumnWidth(i + 1, 160); });
    }
  });

  return map;
}

/** Formats + filtres */
function applyFormats_(sheet, name) {
  var maxCols = sheet.getLastColumn() || (HEADERS[name] && HEADERS[name].length) || 20;
  var lastRow = Math.max(sheet.getLastRow(), SAMPLE_ROWS + 1);
  sheet.getRange(1, 1, lastRow, maxCols).setNumberFormat("@");

  var conf = FORMATS[name];
  if (conf && conf.dateCols) {
    conf.dateCols.forEach(function(c) {
      sheet.getRange(2, c, lastRow - 1, 1).setNumberFormat(DATE_FMT);
    });
  }
  if (conf && conf.eurCols) {
    conf.eurCols.forEach(function(c) {
      sheet.getRange(2, c, lastRow - 1, 1).setNumberFormat(EUR_FMT);
    });
  }
}

function addFilter_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  var r = sheet.getRange(1, 1, sheet.getMaxRows(), lastCol);
  if (sheet.getFilter()) sheet.getFilter().remove();
  r.createFilter();
}

/** Validations */
function buildStock_(sheet) {
  var sep = formulaSep_();
  var skuCol = 2; // B
  var lastRow = sheet.getMaxRows();

  var skuFormula =
    '=OR(B2=""' + sep +
    ' AND(REGEXMATCH(B2' + sep + ' "^[A-Z0-9]{1,4}$")' + sep +
    ' COUNTIF($B$2:$B' + sep + ' B2)=1))';

  var rule = SpreadsheetApp.newDataValidation()
    .setAllowInvalid(false)
    .requireFormulaSatisfied(skuFormula)
    .build();
  sheet.getRange(2, skuCol, lastRow - 1, 1).setDataValidation(rule);

  var prixCibleCol = 10; // J
  sheet.getRange(2, prixCibleCol).setFormulaR1C1('=IF(RC[-1]="","",RC[-1]*1.5)');
  sheet.getRange(2, prixCibleCol, lastRow - 1, 1)
       .autoFill(sheet.getRange(2, prixCibleCol, lastRow - 1, 1), SpreadsheetApp.AutoFillSeries.DEFAULT_SERIES);
}

function buildVentesSKU_(sheet) {
  var sep = formulaSep_();
  var skuCol = 8; // H
  var lastRow = sheet.getMaxRows();

  var skuFormula =
    '=OR(H2=""' + sep +
    ' AND(REGEXMATCH(H2' + sep + ' "^[A-Z0-9]{1,4}$")' + sep +
    ' COUNTIF($H$2:$H' + sep + ' H2)>=1))';

  var rule = SpreadsheetApp.newDataValidation()
    .setAllowInvalid(false)
    .requireFormulaSatisfied(skuFormula)
    .build();
  sheet.getRange(2, skuCol, lastRow - 1, 1).setDataValidation(rule);
}

/** MFC */
function addConditionalFormatting_(sheet) {
  var sep = formulaSep_();
  var rules = [];

  if (sheet.getName() === "Stock") {
    var f1 = '=AND($B2<>""' + sep + ' $C2="")';
    var r1 = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(f1)
      .setBackground("#fff2f2")
      .setRanges([sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getLastColumn())])
      .build();
    rules.push(r1);
  }

  if (sheet.getName() === "Ventes") {
    var f2 = '=AND($D2<>""' + sep + ' $H2="")';
    var r2 = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(f2)
      .setBackground("#fff2f2")
      .setRanges([sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getLastColumn())])
      .build();
    rules.push(r2);
  }

  sheet.setConditionalFormatRules(rules);
}

/** Exemples */
function seedExamples_(sheets) {
  Object.keys(HEADERS).forEach(function(name) {
    var sh = sheets[name];
    var cols = HEADERS[name].length;
    var rows = Math.max(SAMPLE_ROWS, 10);
    var data = Array(rows).fill(0).map(function(){ return Array(cols).fill(""); });
    sh.getRange(2, 1, rows, cols).setValues(data);
  });

  var stock = sheets["Stock"];
  stock.getRange("A2:F2").setValues([["01/01/2025", "A1", "Chemise bleu A1", "", "Haut", "MarqueX"]]);
  stock.getRange("I2").setValue(10);

  var ventes = sheets["Ventes"];
  ventes.getRange("A2:D2").setValues([["02/01/2025", "Vinted", "Chemise bleu A1", 20]]);
  ventes.getRange("H2").setValue("A1");
}

/** Protections */
function protectHeadersWarn_(sheets) {
  Object.keys(sheets).forEach(function(name) {
    var sh = sheets[name];
    var prot = sh.protect();
    prot.setDescription("Protection en-têtes (" + name + ")");
    prot.setWarningOnly(true);
    prot.setUnprotectedRanges([sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getLastColumn())]);
  });
}

/** Logs */
function log_(level, source, message, details) {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName("Logs") || ss.insertSheet("Logs");
    if (sh.getLastRow() === 0) {
      sh.getRange(1,1,1,5)
        .setValues([["Horodatage","Niveau","Source","Message","Détails"]])
        .setFontWeight("bold");
      sh.setFrozenRows(1);
    }
    sh.appendRow([new Date(), level, source, message, details || ""]);
  } catch (e) {
    console.log({level: level, source: source, message: message, details: details, err: String(e)});
  }
}
