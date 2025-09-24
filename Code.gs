/**
 * Module: Code.gs — Menu CRM principal
 * But: déclarer le menu Sheets complet et ouvrir l’interface modale du CRM.
 */
/** Menu CRM (complet) + Lanceur UI (fenêtre popup) */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("CRM")
    .addItem("Ouvrir CRM (fenêtre)", "openCRM")
    .addSeparator()
    .addItem("Étape 1 — (re)créer la structure", "runStep1")
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Étape 2 — SKU & Titres")
        .addItem("Nettoyer l’onglet Stock (SKU dans le titre)", "auditStockSkuTitle")
        .addItem("Nettoyer l’onglet Ventes (extraire SKU)", "auditVentesExtractSku")
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Étape 3 — Achats ↔ Stock")
        .addItem("Générer/MAJ Réf Achats + liste déroulante", "step3RefreshRefs")
        .addItem("Propager Prix achat vers Stock (tout)", "step3PropagateAll")
        .addItem("Propager pour la ligne sélectionnée (Stock)", "step3PropagateCurrent")
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Étape 5 — Ingestion Emails")
        .addItem("Scanner tous les labels", "ingestAllLabels")
        .addItem("Ingestion: Stock (JSON)", "ingestStockJson")
        .addItem("Ingestion: Ventes", "ingestSales")
        .addItem("Ingestion: Achats Vinted", "ingestPurchasesVinted")
        .addItem("Ingestion: Favoris/Offres Vinted", "ingestFavsOffersVinted")
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Étape 6 — Bordereaux")
        .addItem("Générer PDF pour la ligne sélectionnée", "labelsGenerateCurrent")
        .addItem("Générer PDF pour les lignes visibles (filtrées)", "labelsGenerateVisible")
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Étape 7 — Boosts & Coûts")
        .addItem("Ajouter un boost (prompt)", "addBoostPrompt")
        .addItem("Ajouter un coût (prompt)", "addCostPrompt")
        .addSeparator()
        .addItem("Résumé mensuel dans Logs", "logMonthlyCostsAndBoosts")
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Étape 8 — Config & Marges avancées")
        .addItem("Ouvrir Config (popup)", "openConfigUI")
        .addItem("Recalculer commissions & marges (tout)", "step8RecalcAll")
        .addItem("Recalculer commissions & marges (ligne)", "step8RecalcCurrent")
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Étape 9 — Dashboard")
        .addItem("Rebâtir KPIs + Graphiques", "buildDashboard")
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Étape 10 — Optimisation")
        .addItem("Ingestion optimisée (rapide)", "ingestAllLabelsFast")
        .addItem("Installer déclencheur horaire (toutes les heures)", "step10InstallHourlyTrigger")
        .addItem("Supprimer déclencheurs Étape 10", "step10RemoveTriggers")
        .addItem("Purger caches/états", "step10ClearCaches")
    )
    .addToUi();
}

/** Ouvre l'application dans une fenêtre modale (nom EXACT du fichier HTML: "Ui App.html") */
function openCRM(){
  const html = HtmlService.createHtmlOutputFromFile('Ui App') // correspond exactement à Ui App.html
    .setWidth(980)
    .setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, 'Le CRM — fenêtre');
}
