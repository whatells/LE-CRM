/**
 * App.gs — Entrées principales Apps Script pour LE-CRM.
 * Fournit le menu Sheets, l'ouverture de l'UI et les fonctions partagées
 * entre le client HtmlService et le serveur Apps Script.
 */

const APP_TITLE = 'LE-CRM Dashboard';

/**
 * Ajoute le menu personnalisé dans Google Sheets.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('LE-CRM')
    .addItem('Ouvrir le Dashboard', 'showDashboardSidebar')
    .addItem('Rafraîchir les données', 'refreshDashboard')
    .addItem('Paramètres', 'showSettingsSidebar')
    .addToUi();
}

/**
 * Affiche la sidebar principale avec l'écran Dashboard.
 */
function showDashboardSidebar() {
  const template = HtmlService.createTemplateFromFile('App');
  template.initialView = 'dashboard';
  const html = template.evaluate()
    .setTitle(APP_TITLE)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Affiche la sidebar directement sur l'onglet Paramètres.
 */
function showSettingsSidebar() {
  const template = HtmlService.createTemplateFromFile('App');
  template.initialView = 'settings';
  const html = template.evaluate()
    .setTitle(APP_TITLE + ' — Paramètres')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Action du menu "Rafraîchir les données".
 */
function refreshDashboard() {
  const data = refreshDashboardData();
  return data; // renvoyé pour les tests ou exécutions manuelles
}

/**
 * Support WebApp (facultatif) pour réutiliser la même interface.
 */
function doGet() {
  const template = HtmlService.createTemplateFromFile('App');
  template.initialView = 'dashboard';
  return template.evaluate()
    .setTitle(APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Utilitaire pour inclure des fichiers Html dans les templates.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
