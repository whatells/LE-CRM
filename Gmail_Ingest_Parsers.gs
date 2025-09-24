/**
 * Parseurs d’emails par label.
 * Idempotence: on marque Logs + labels Traite/Erreur pour éviter les doublons.
 * NOTE: pas de variables globales de type SHEET_* ici pour éviter les collisions.
 */

// ---- Utilitaires Logs & Idempotence ----
function alreadyProcessed_(msgId) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName("Logs") || ss.insertSheet("Logs");
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,5).setValues([["Horodatage","Niveau","Source","Message","Détails"]]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  const vals = sh.getRange(2,4,Math.max(0,sh.getLastRow()-1),1).getValues();
  for (let i=0;i<vals.length;i++){ if (vals[i][0]===msgId) return true; }
  return false;
}

function markProcessed_(level, source, msg, details, msgId) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName("Logs") || ss.insertSheet("Logs");
  sh.appendRow([new Date(), level, source, msgId || msg, details||""]);
}

// ---- STOCK: JSON dans corps ou PJ ----
function parseStockJsonMessage_(message) {
  const id = message.getId();
  if (alreadyProcessed_(id)) return null;
  let jsonText = message.getPlainBody();

  // Si pièce jointe JSON, on la préfère
  const atts = message.getAttachments({includeInlineImages: false, includeAttachments: true});
  for (let i=0;i<atts.length;i++){
    const a = atts[i];
    if (/\.json$/i.test(a.getName())){
      jsonText = a.getDataAsString();
      break;
    }
  }

  try {
    const obj = JSON.parse(jsonText);
    // Schéma attendu minimal: { sku, title?, price?, category?, brand?, size?, condition?, photos?, platform? }
    if (!obj || !obj.sku) throw new Error("JSON sans sku");
    return {id, data: obj};
  } catch(e){
    markProcessed_("ERROR","parseStockJson","parse fail", String(e), id);
    return null;
  }
}

// ---- VENTES (parsers simples démo) ----
function parseSaleMessage_(platform, message) {
  const id = message.getId();
  if (alreadyProcessed_(id)) return null;

  const body = message.getPlainBody();
  const subj = message.getSubject() || "";

  // Prix: ex. "20,00 €" ou "20.00€"
  const price = (body.match(/(\d+[\.,]\d{2})\s?€/)||[])[1];
  // Titre: ligne commençant par "Titre:" sinon on prend l’objet
  const title = (body.match(/Titre\s*:\s*(.*)/i)||[])[1] || subj;
  // SKU: premier token <=4 alphanum
  const skuM = title && title.match(/\b[A-Z0-9]{1,4}\b/);
  const sku = skuM ? skuM[0].toUpperCase() : "";

  if (!price || !title) return null;
  return {id, data:{platform, title, price: Number(String(price).replace(',','.')), sku}};
}

// ---- FAVORIS/OFFRES Vinted ----
function parseFavOfferMessage_(type, message) {
  const id = message.getId();
  if (alreadyProcessed_(id)) return null;
  const subj = message.getSubject()||"";
  const sku = (subj.match(/\b[A-Z0-9]{1,4}\b/)||[])[0];
  if (!sku) return null;
  return {id, data:{type, sku}};
}

// ---- ACHATS Vinted ----
function parsePurchaseVinted_(message){
  const id = message.getId();
  if (alreadyProcessed_(id)) return null;
  const body = message.getPlainBody();
  const price = (body.match(/Total\s*:.*?(\d+[\.,]\d{2})\s?€/i)||[])[1];
  const brand = (body.match(/Marque\s*:\s*(.*)/i)||[])[1] || "";
  const size = (body.match(/Taille\s*:\s*(.*)/i)||[])[1] || "";
  if (!price) return null;
  return {id, data:{date:new Date(), fournisseur:"Vinted", price: Number(String(price).replace(',','.')), brand, size}};
}
