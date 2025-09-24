/**
 * Étape 6 — Bordereaux (v1 overlay via Google Slides -> PDF)
 * - Lit l’onglet Bordereaux (colonnes: Date, SKU, Titre (avec SKU), N° suivi, Transporteur, Statut PDF, Lien PDF, Notes)
 * - Produit un PDF A6 (ou A4) avec overlay: Titre+SKU (+ N° suivi), puis renseigne "Statut PDF" et "Lien PDF"
 * Réf feuille: Bordereaux (Roadmap + entêtes) :contentReference[oaicite:2]{index=2} ; Pipeline attendu: import -> overlay -> export PDF :contentReference[oaicite:3]{index=3}
 */

const SHEET_BORD = "Bordereaux";
const SHEET_STOCK_LOOKUP = "Stock";

// Colonnes Bordereaux (1-based)
const COL_BORD_DATE = 1;
const COL_BORD_SKU  = 2;
const COL_BORD_TIT  = 3;
const COL_BORD_TRACK= 4;
const COL_BORD_TRANS= 5;
const COL_BORD_STAT = 6;
const COL_BORD_LINK = 7;
const COL_BORD_NOTE = 8;

// Page settings
const LABEL_SIZE = "A6"; // "A6" ou "A4"
const MARGIN_MM = 8;

// --- Entrées menu ---
function labelsGenerateCurrent() {
  const sh = SpreadsheetApp.getActiveSheet();
  if (!sh || sh.getName() !== SHEET_BORD) return;
  const r = sh.getActiveRange().getRow();
  if (r < 2) return;
  generateOneLabelPdf_(sh, r);
}

function labelsGenerateVisible() {
  const sh = SpreadsheetApp.getActiveSheet();
  if (!sh || sh.getName() !== SHEET_BORD) return;
  const rng = sh.getDataRange().offset(1,0, sh.getLastRow()-1); // sans entête
  const values = rng.getValues();
  const display = rng.getDisplayValues(); // pour respecter filtres
  for (let i=0;i<values.length;i++){
    // Si ligne masquée par filtre, getDisplayValues renvoie "" pour toutes les cellules visibles du range => heuristique:
    const rowVisible = display[i].some(v => String(v).length>0);
    if (!rowVisible) continue;
    generateOneLabelPdf_(sh, i+2);
  }
}

// --- Cœur génération ---
function generateOneLabelPdf_(sh, row) {
  const sku = String(sh.getRange(row, COL_BORD_SKU).getValue()||"").trim().toUpperCase();
  let title = String(sh.getRange(row, COL_BORD_TIT).getValue()||"").trim();
  const tracking = String(sh.getRange(row, COL_BORD_TRACK).getValue()||"").trim();
  const trans = String(sh.getRange(row, COL_BORD_TRANS).getValue()||"").trim();

  if (!sku) { sh.getRange(row, COL_BORD_STAT).setValue("KO: SKU manquant"); return; }
  if (!title) {
    // fallback: on va le chercher dans Stock par SKU
    title = lookupTitleInStock_(sku) || ("Item " + sku);
    sh.getRange(row, COL_BORD_TIT).setValue(title);
  }

  try {
    const file = buildLabelPdfFile_(title, sku, tracking, trans);
    sh.getRange(row, COL_BORD_LINK).setValue(file.getUrl());
    sh.getRange(row, COL_BORD_STAT).setValue("OK");
  } catch(e) {
    sh.getRange(row, COL_BORD_STAT).setValue("KO: " + String(e));
  }
}

function lookupTitleInStock_(sku){
  const ss = SpreadsheetApp.getActive();
  const st = ss.getSheetByName(SHEET_STOCK_LOOKUP);
  if (!st) return "";
  const last = st.getLastRow();
  if (last<2) return "";
  const rng = st.getRange(2,2,last-1,2).getValues(); // B=SKU,C=Title
  for (let i=0;i<rng.length;i++){
    if (String(rng[i][0]).toUpperCase() === sku) return String(rng[i][1]||"");
  }
  return "";
}

/**
 * Construit un PDF via Google Slides (page A6/A4), pose des zones de texte (overlay),
 * exporte en PDF sur Drive et renvoie le fichier.
 * NB: v1 = overlay propre. (Le “crop auto” d’un PDF existant n’est pas disponible nativement en Apps Script;
 * on pourra plus tard charger une image de fond et ajuster le cadrage.)
 */
function buildLabelPdfFile_(title, sku, tracking, transporter){
  // 1) Créer un Slides temporaire
  const pres = SlidesApp.create("Label " + sku + " " + new Date().toISOString());
  const presId = pres.getId();
  const page = pres.getSlides()[0];

  // 2) Dimensions page
  // A4 = 210x297 mm ; A6 = 105x148 mm — Slides travaille en points (1 pt = 1/72 in)
  const mmToPoints = mm => (mm/25.4)*72;
  let pageWmm = 105, pageHmm = 148; // A6 par défaut
  if (LABEL_SIZE === "A4"){ pageWmm = 210; pageHmm = 297; }
  const pageW = mmToPoints(pageWmm), pageH = mmToPoints(pageHmm);
  page.getPageElements().forEach(el => el.remove());
  page.getPageBackground().setSolidFill(255,255,255); // blanc

  // 3) Marges et styles
  const m = mmToPoints(MARGIN_MM);
  const fontBig = 20;
  const fontSmall = 12;

  // 4) Titre principal (wrap)
  const titleShape = page.insertShape(SlidesApp.ShapeType.TEXT_BOX, m, m, pageW - 2*m, mmToPoints(30));
  titleShape.getText().setText(title);
  titleShape.getText().getTextStyle().setBold(true).setFontSize(fontBig);

  // 5) SKU en “badge”
  const skuShape = page.insertShape(SlidesApp.ShapeType.ROUNDED_RECTANGLE, pageW - m - mmToPoints(35), m, mmToPoints(35), mmToPoints(16));
  skuShape.getFill().setSolidFill(0,0,0);
  skuShape.getText().setText(sku);
  skuShape.getText().getTextStyle().setBold(true).setFontSize(12).setForegroundColor(1,1,1);
  skuShape.getLine().setTransparent();

  // 6) Transporteur + N° suivi
  const infoY = m + mmToPoints(36);
  const transShape = page.insertShape(SlidesApp.ShapeType.TEXT_BOX, m, infoY, pageW - 2*m, mmToPoints(12));
  transShape.getText().setText((transporter? transporter + " — " : "") + (tracking? ("Suivi: " + tracking) : ""));
  transShape.getText().getTextStyle().setFontSize(fontSmall);

  // 7) Avertissement bas de page
  const footer = page.insertShape(SlidesApp.ShapeType.TEXT_BOX, m, pageH - m - mmToPoints(10), pageW - 2*m, mmToPoints(10));
  footer.getText().setText("Généré par CRM (Étape 6)");
  footer.getText().getTextStyle().setFontSize(10).setForegroundColor(0.4,0.4,0.4);

  // 8) Export PDF
  const blob = DriveApp.getFileById(presId).getAs("application/pdf");
  const out = DriveApp.createFile(blob).setName("Bordereau_" + sku + ".pdf");

  // 9) Nettoyage (optionnel): supprimer le Slides source
  DriveApp.getFileById(presId).setTrashed(true);

  return out;
}
