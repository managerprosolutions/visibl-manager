const API_CONFIG = {
  BASE_URL: "https://script.google.com/macros/s/AKfycbzCxVhwhGfCffRlh3h7HwdvbWqc0GEJMNN-fCNbopOLdEdE84eyKjGmgYAEfVHwRlxFyQ/exec"
};

/**
 * Envoie une requête GET vers VISIBL Backend.
 */
async function apiGet(action, params = {}) {
  const url = new URL(API_CONFIG.BASE_URL);

  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  // Le Dashboard doit toujours interroger réellement le backend pendant
  // sa courte phase de vérification. Sans ce paramètre unique, le navigateur
  // ou un cache HTTP intermédiaire peut renvoyer une ancienne réponse.
  if (["getDashboard", "getDashboardVersion", "getRapports", "getRapportsVersion", "getRapportsPatch"].includes(action)) {
    url.searchParams.set("_visibl_ts", String(Date.now()));
  }

  const response = await fetch(url.toString(), {
    cache:
      ["getDashboard", "getDashboardVersion", "getRapports", "getRapportsVersion", "getRapportsPatch"].includes(action)
        ? "no-store"
        : "default"
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP : ${response.status}`);
  }

  return response.json();
}

/**
 * Actions qui peuvent modifier les chiffres du Dashboard.
 * Après succès, on dépose un signal local pour que le Dashboard
 * vérifie temporairement l'arrivée du nouveau cache.
 */
const DASHBOARD_ACTIONS_A_ACTUALISER = new Set([
  "createClient",
  "updateClient",
  "deleteClient",
  "createProduit",
  "updateProduit",
  "deleteProduit",
  "createMouvementStock",
  "createCommande",
  "updateCommande",
  "changerStatutCommande",
  "deleteCommande",
  "createApprovisionnement",
  "updateApprovisionnement",
  "deleteApprovisionnement",
  "createVente",
  "updateVente",
  "createRetourVente",
  "encaisserPaiementVente",
  "deleteVente",
  "validerPreparationLivraison",
  "confirmerDepartLivraison",
  "enregistrerRetourLivreur",
  "ajouterEncaissementLivraison",
  "saveParametresStock"
]);

function signalerActualisationDashboard(action) {
  if (!DASHBOARD_ACTIONS_A_ACTUALISER.has(action)) return;

  try {
    localStorage.setItem(
      "VISIBL_DASHBOARD_REFRESH_SIGNAL",
      JSON.stringify({
        action,
        timestamp: Date.now()
      })
    );
  } catch (error) {
    console.warn("Signal Dashboard non enregistré :", error);
  }

  // Utile si plusieurs vues vivent dans la même page / le même onglet.
  try {
    window.dispatchEvent(
      new CustomEvent("visibl:dashboard-refresh", {
        detail: { action, timestamp: Date.now() }
      })
    );
  } catch (error) {}
}


const RAPPORTS_ACTIONS_A_ACTUALISER = new Set([
  "createClient","updateClient","deleteClient","createProduit","updateProduit","updateProduitImage","deleteProduit",
  "createMouvementStock","createLivreur","updateLivreur","deleteLivreur","createCommande","updateCommande","changerStatutCommande","deleteCommande",
  "createFournisseur","updateFournisseur","deleteFournisseur","createTransitaire","updateTransitaire","deleteTransitaire",
  "createApprovisionnement","updateApprovisionnement","enregistrerPaiementApprovisionnement","deleteApprovisionnement",
  "createVente","updateVente","createRetourVente","encaisserPaiementVente","deleteVente",
  "validerPreparationLivraison","confirmerDepartLivraison","enregistrerRetourLivreur","ajouterEncaissementLivraison",
  "createOperationCaisse","updateJustificatifCaisse","annulerOperationCaisse","saveParametresFinance","saveParametresStock"
]);

function signalerActualisationRapports(action) {
  if (!RAPPORTS_ACTIONS_A_ACTUALISER.has(action)) return;
  try {
    localStorage.setItem("VISIBL_RAPPORTS_REFRESH_SIGNAL", JSON.stringify({action, timestamp:Date.now()}));
  } catch (e) {}
  try {
    window.dispatchEvent(new CustomEvent("visibl:rapports-refresh", {detail:{action, timestamp:Date.now()}}));
  } catch (e) {}
}

/**
 * Envoie une requête POST vers VISIBL Backend.
 */
async function apiPost(action, data = {}) {
  const response = await fetch(API_CONFIG.BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      ...data
    })
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP : ${response.status}`);
  }

  const resultat = await response.json();

  if (resultat && resultat.success !== false) {
    signalerActualisationDashboard(action);
    signalerActualisationRapports(action);
  }

  return resultat;
}

/**
 * Vérifie que VISIBL Backend est accessible.
 */
async function testApiConnection() {
  try {
    const result = await apiGet("health");
    console.log("VISIBL Backend connecté :", result);
    return result;
  } catch (error) {
    console.error("Connexion à VISIBL Backend impossible :", error);
    throw error;
  }
}
