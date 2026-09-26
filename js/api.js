const API_CONFIG = {
  BASE_URL: "https://script.google.com/macros/s/AKfycby9oFIInHTN0xywR8pSvyewr-uIkx6exuZ4scr227Yke9X_mNPO5i5_EdhTlk9sxTgOMA/exec"
};



/**
 * Retourne le jeton de session serveur de l'utilisateur connecté.
 * Le backend place ce jeton dans visibl_user.sessionToken au login.
 */
function obtenirSessionTokenVisiblApi_() {
  try {
    const brut = localStorage.getItem("visibl_user");
    if (!brut) return "";

    const utilisateur = JSON.parse(brut);
    return String(
      utilisateur &&
      utilisateur.sessionToken
        ? utilisateur.sessionToken
        : ""
    ).trim();
  } catch (error) {
    console.warn(
      "Impossible de lire le jeton de session VISIBL :",
      error
    );
    return "";
  }
}

/**
 * Envoie une requête GET vers VISIBL Backend.
 */
async function apiGet(action, params = {}) {
  const url = new URL(API_CONFIG.BASE_URL);

  url.searchParams.set("action", action);

  // Toutes les routes protégées peuvent ainsi récupérer automatiquement
  // la session créée au login, sans modifier chaque module séparément.
  const sessionToken = obtenirSessionTokenVisiblApi_();
  if (
    sessionToken &&
    !url.searchParams.has("_session")
  ) {
    url.searchParams.set("_session", sessionToken);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  // Ces lectures doivent toujours interroger réellement le backend.
  // Cela évite qu'un navigateur, un appareil mobile ou un cache HTTP
  // intermédiaire renvoie une ancienne version des données / signatures.
  const ACTIONS_GET_SANS_CACHE = new Set([
    "getDashboard",
    "getDashboardVersion",
    "getRapports",
    "getRapportsVersion",
    "getRapportsPatch",
    "getClients",
    "getEtatSyncClients"
  ]);

  const sansCache = ACTIONS_GET_SANS_CACHE.has(action);

  if (sansCache) {
    url.searchParams.set("_visibl_ts", String(Date.now()));
  }

  const response = await fetch(url.toString(), {
    cache: sansCache ? "no-store" : "default"
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
      ...data,
      ...(
        data && data._session
          ? {}
          : {
              _session:
                obtenirSessionTokenVisiblApi_()
            }
      )
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
