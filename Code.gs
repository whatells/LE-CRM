/**
 * CRM Complet - Point d'entrée principal
 * Inspiré de VintedCRM.com pour l'ergonomie et les couleurs
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 CRM")
    .addItem("📊 Ouvrir le CRM", "openCRM")
    .addSeparator()
    .addItem("⚙️ Configuration", "openConfig")
    .addSeparator()
    .addItem("🔧 Initialiser la structure", "initializeStructure")
    .addToUi();
}

/**
 * Ouvre l'interface principale du CRM
 */
function openCRM() {
  const html = HtmlService.createTemplateFromFile('CRM_Interface');
  const htmlOutput = html.evaluate()
    .setWidth(1200)
    .setHeight(800)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🚀 CRM - Interface Principale');
}

/**
 * Ouvre la fenêtre de configuration
 */
function openConfig() {
  const html = HtmlService.createTemplateFromFile('CRM_Config');
  const htmlOutput = html.evaluate()
    .setWidth(800)
    .setHeight(600)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '⚙️ Configuration CRM');
}

/**
 * Fonction pour inclure des fichiers CSS/JS
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Initialise la structure des feuilles si nécessaire
 */
function initializeStructure() {
  try {
    createSheetsStructure();
    SpreadsheetApp.getUi().alert('✅ Structure initialisée avec succès !');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Erreur lors de l\'initialisation : ' + error.toString());
  }
}