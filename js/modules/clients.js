let clientsCharges = [];
let clientsAffiches = [];
let clientEnModificationId = null;
let clientASupprimer = null;

// État de consultation de la page Clients
let rechercheClients = "";
let filtresClients = {
    typeClient: "",
    statut: "",
    commune: ""
};


/* ===========================================================
   LOADER GLOBAL VISIBL — CLIENTS
   Même fonctionnement que Commandes.
=========================================================== */

const CLIENTS_NAV_CACHE_KEY = "visibl:clients:nav-cache:v1";

// Signature légère renvoyée par le backend.
// Elle permet de savoir si le cache local est encore à jour.
let signatureSyncClients = null;
let verificationSyncClientsEnCours = null;

// Synchronisation automatique légère.
// On vérifie uniquement la signature toutes les 10 secondes.
// getClients() n'est appelé que si cette signature a réellement changé.
const CLIENTS_SYNC_INTERVAL_MS = 10000;
let intervalleSyncClients = null;
let synchronisationAutoClientsInitialisee = false;

// Pagination serveur Clients.
let totalClientsFiltresServeur = 0;
let totalPagesClientsServeur = 1;
let totalClientsGlobalServeur = 0;
let kpisClientsServeur = null;
let chargementPageClientsEnCours = null;
let generationChargementClients = 0;
let timerRechercheClientsServeur = null;

// Conserve les objets sélectionnés pendant la navigation entre les pages.
const cacheClientsSelectionnes = new Map();

function sauvegarderCacheNavigationClients() {
    try {
        sessionStorage.setItem(
            CLIENTS_NAV_CACHE_KEY,
            JSON.stringify({
                clients: Array.isArray(clientsCharges) ? clientsCharges : [],
                signature: signatureSyncClients,
                page: typeof pageClientsCourante !== "undefined"
                    ? pageClientsCourante
                    : 1,
                limite: 10,
                total: totalClientsFiltresServeur,
                totalPages: totalPagesClientsServeur,
                totalGlobal: totalClientsGlobalServeur,
                kpis: kpisClientsServeur,
                recherche: rechercheClients,
                filtres: filtresClients,
                tri: typeof triClients !== "undefined"
                    ? triClients
                    : { cle: "", direction: "asc" },
                savedAt: Date.now()
            })
        );
    } catch (error) {
        console.warn("Cache navigation Clients indisponible :", error);
    }
}

function restaurerCacheNavigationClients() {
    try {
        const brut = sessionStorage.getItem(CLIENTS_NAV_CACHE_KEY);
        if (!brut) return false;

        const cache = JSON.parse(brut);
        if (!Array.isArray(cache?.clients)) return false;

        clientsCharges = cache.clients;
        clientsAffiches = cache.clients.slice();

        signatureSyncClients =
            cache.signature != null
                ? String(cache.signature)
                : null;

        if (typeof pageClientsCourante !== "undefined") {
            pageClientsCourante =
                Number(cache.page) > 0
                    ? Number(cache.page)
                    : 1;
        }

        totalClientsFiltresServeur =
            Number(cache.total) >= 0
                ? Number(cache.total)
                : clientsCharges.length;

        totalPagesClientsServeur =
            Number(cache.totalPages) > 0
                ? Number(cache.totalPages)
                : 1;

        totalClientsGlobalServeur =
            Number(cache.totalGlobal) >= 0
                ? Number(cache.totalGlobal)
                : totalClientsFiltresServeur;

        kpisClientsServeur =
            cache.kpis && typeof cache.kpis === "object"
                ? cache.kpis
                : null;

        if (cache.recherche != null) {
            rechercheClients = String(cache.recherche);
        }

        if (cache.filtres && typeof cache.filtres === "object") {
            filtresClients = Object.assign(
                { typeClient: "", statut: "", commune: "" },
                cache.filtres
            );
        }

        if (
            typeof triClients !== "undefined" &&
            cache.tri &&
            typeof cache.tri === "object"
        ) {
            triClients = {
                cle: String(cache.tri.cle || ""),
                direction:
                    String(cache.tri.direction || "").toLowerCase() === "desc"
                        ? "desc"
                        : "asc"
            };
        }

        clientsCharges.forEach(function(client) {
            if (client && client.idClient != null) {
                cacheClientsSelectionnes.set(
                    String(client.idClient),
                    client
                );
            }
        });

        mettreAJourKPIsClients();
        afficherClients(clientsAffiches);
        mettreAJourCompteurClients(totalClientsFiltresServeur);
        mettreAJourEtatBoutonEffacer();
        definirEtatChargementKPIsClients(false);
        return true;
    } catch (error) {
        console.warn("Restauration cache navigation Clients impossible :", error);
        return false;
    }
}


async function obtenirSignatureSyncClients() {
    try {
        const resultat = await apiGet("getEtatSyncClients", { _ts: Date.now() });

        if (
            !resultat ||
            resultat.success !== true ||
            resultat.signature == null
        ) {
            return null;
        }

        return String(resultat.signature);

    } catch (error) {
        console.warn(
            "Vérification légère Clients indisponible :",
            error
        );
        return null;
    }
}


/**
 * Vérifie en arrière-plan si les données Clients ont changé.
 *
 * - le cache reste affiché immédiatement ;
 * - aucune animation de loader n'est lancée ;
 * - getClients() n'est rappelé que si la signature serveur diffère.
 */
async function verifierSynchronisationClients() {

    if (verificationSyncClientsEnCours) {
        return verificationSyncClientsEnCours;
    }

    verificationSyncClientsEnCours = (async function () {

        const signatureServeur =
            await obtenirSignatureSyncClients();

        if (signatureServeur == null) {
            return false;
        }

        const signatureLocale =
            signatureSyncClients == null
                ? null
                : String(signatureSyncClients);

        if (
            signatureLocale !== null &&
            signatureLocale === signatureServeur
        ) {
            return false;
        }

        /*
         * Cache ancien sans signature OU données réellement modifiées :
         * on recharge silencieusement les données fraîches.
         */
        await chargerClients({
            forcer: true,
            silencieux: true,
            verifierSync: false
        });

        return true;

    })().finally(function () {
        verificationSyncClientsEnCours = null;
    });

    return verificationSyncClientsEnCours;
}



function demanderVerificationSyncClients() {

    // Pas d'appel périodique inutile quand l'onglet n'est pas visible.
    if (document.visibilityState === "hidden") {
        return;
    }

    verifierSynchronisationClients();
}


function initialiserSynchronisationAutomatiqueClients() {

    if (synchronisationAutoClientsInitialisee) {
        return;
    }

    synchronisationAutoClientsInitialisee = true;

    // Vérification régulière légère.
    intervalleSyncClients = window.setInterval(
        demanderVerificationSyncClients,
        CLIENTS_SYNC_INTERVAL_MS
    );

    // Retour sur l'onglet : contrôle immédiat.
    document.addEventListener(
        "visibilitychange",
        function () {
            if (document.visibilityState === "visible") {
                demanderVerificationSyncClients();
            }
        }
    );

    // Retour sur la fenêtre : contrôle immédiat.
    window.addEventListener(
        "focus",
        demanderVerificationSyncClients
    );

    // Nettoyage si la page est réellement quittée.
    window.addEventListener(
        "pagehide",
        function () {
            if (intervalleSyncClients) {
                window.clearInterval(intervalleSyncClients);
                intervalleSyncClients = null;
            }
        },
        { once: true }
    );
}


function preparerLoaderClients() {
    const zonePage = document.querySelector(".content");

    if (zonePage) {
        zonePage.setAttribute("data-visibl-page", "");
        zonePage.classList.add("visibl-loading-scope");

        const ancre = zonePage.querySelector(".welcome-section");
        if (ancre) {
            ancre.setAttribute("data-loading-anchor", "");
        }
    }

    [
        "total-clients-value",
        "active-clients-value",
        "new-clients-value",
        "client-revenue-value"
    ].forEach(id => {
        document
            .getElementById(id)
            ?.setAttribute("data-kpi-value", "");
    });

    document
        .getElementById("clients-table-body")
        ?.setAttribute("data-loading-table-body", "");
}

function demarrerLoaderClients(
    message = "Chargement des clients…"
) {
    preparerLoaderClients();

    if (
        window.VisiblLoading &&
        typeof window.VisiblLoading.start === "function"
    ) {
        window.VisiblLoading.start({
            scope: ".content",
            tableBody: "#clients-table-body",
            rows: 10,
            message: message
        });
    }
}

function terminerLoaderClients() {
    if (
        window.VisiblLoading &&
        typeof window.VisiblLoading.stop === "function"
    ) {
        window.VisiblLoading.stop({
            scope: ".content",
            tableBody: "#clients-table-body"
        });
    }
}


// ========================================
// INITIALISATION
// ========================================

function initialiserDeconnexion() {
    const logoutButton = document.getElementById("logout-button");
    if (!logoutButton) return;

    logoutButton.addEventListener("click", function (event) {
        event.preventDefault();

        try {
            if (typeof logoutUser === "function") {
                logoutUser();
            }
        } catch (error) {
            console.warn("Erreur pendant la déconnexion :", error);
        }

        try {
            sessionStorage.clear();
            [
                "visibl_user",
                "user",
                "utilisateur",
                "currentUser",
                "authUser",
                "isAuthenticated",
                "token",
                "authToken"
            ].forEach(cle => localStorage.removeItem(cle));
        } catch (error) {}

        window.location.replace("connexion.html");
    });
}


function initialiserClients() {

    if (
        typeof requireAuth === "function" &&
        !requireAuth()
    ) {
        return;
    }

    initialiserDeconnexion();

    // ========================================
    // FENÊTRE NOUVEAU CLIENT
    // ========================================

    const openModalBtn =
        document.getElementById("new-client-btn");

    const openToolbarBtn =
        document.getElementById("new-client-toolbar-btn");

    const closeModalBtn =
        document.getElementById("close-client-modal");

    const cancelModalBtn =
        document.getElementById("cancel-client-btn");

    const clientModal =
        document.getElementById("client-modal");

    const deleteModal =
        document.getElementById("delete-client-modal");

    const cancelDeleteBtn =
        document.getElementById("cancel-delete-client-btn");

    const confirmDeleteBtn =
        document.getElementById("confirm-delete-client-btn");


    function openModal() {

        if (!clientModal) {
            return;
        }

        clientModal.classList.add("active");
        clientModal.setAttribute("aria-hidden", "false");
    }


    function closeModal() {

    if (!clientModal) {
        return;
    }

    clientModal.classList.remove("active");
    clientModal.setAttribute("aria-hidden", "true");
}


function remplirFormulaireClient(client) {

    document.getElementById("client-type").value =
        client.typeClient || "";

    document.getElementById("client-status").value =
        client.statut || "actif";

    document.getElementById("client-lastname").value =
        client.nom || "";

    document.getElementById("client-firstname").value =
        client.prenom || "";

    document.getElementById("client-phone").value =
        client.telephone || "";

    document.getElementById("client-email").value =
        client.email || "";

    document.getElementById("client-commune").value =
        client.commune || "";

    document.getElementById("client-neighborhood").value =
        client.quartier || "";

    document.getElementById("client-comment").value =
        client.commentaire || "";

    document.getElementById("client-modal-title").textContent =
        "Modifier le client";

    document.getElementById("save-client-btn").textContent =
        "Enregistrer les modifications";
}


function ouvrirNouveauClient() {

    clientEnModificationId = null;

    const clientForm = document.getElementById("client-form");
    clientForm?.reset();

    const modalTitle = document.getElementById("client-modal-title");
    const saveButton = document.getElementById("save-client-btn");

    if (modalTitle) {
        modalTitle.textContent = "Nouveau client";
    }

    if (saveButton) {
        saveButton.textContent = "Enregistrer le client";
    }

    openModal();
}

openModalBtn?.addEventListener(
    "click",
    ouvrirNouveauClient
);

openToolbarBtn?.addEventListener(
    "click",
    ouvrirNouveauClient
);

    closeModalBtn?.addEventListener(
        "click",
        closeModal
    );

    cancelModalBtn?.addEventListener(
        "click",
        closeModal
    );

    cancelDeleteBtn?.addEventListener(
        "click",
        fermerModalSuppression
    );

    deleteModal?.addEventListener(
        "click",
        function (event) {

            if (event.target === deleteModal) {
                fermerModalSuppression();
            }
        }
    );

    confirmDeleteBtn?.addEventListener(
        "click",
        async function () {

            if (!clientASupprimer || confirmDeleteBtn.disabled) {
                return;
            }

            const idClient = clientASupprimer.idClient;

            // On conserve les infos avant que la suppression ne réinitialise l'état.
            const clientSupprime = { ...clientASupprimer };

            let suppressionReussie = false;

            const texteInitialSuppression =
                confirmDeleteBtn.innerHTML;

            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.classList.add("is-loading");
            confirmDeleteBtn.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i><span>Suppression...</span>';

            try {

                suppressionReussie =
                    await supprimerClient(idClient);

            } finally {

                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.classList.remove("is-loading");
                confirmDeleteBtn.innerHTML =
                    texteInitialSuppression;
            }

            if (suppressionReussie) {
                fermerModalSuppression();

                // Confirmation centrale, identique au modèle Enregistrer / Modifier.
                await afficherSuccesSuppressionClient(clientSupprime);
            }
        }
    );


    // ========================================
    // FENÊTRE VOIR CLIENT
    // ========================================

    const closeViewBtn =
        document.getElementById("close-view-client-modal");

    const closeViewFooterBtn =
        document.getElementById("close-view-client-footer");


    closeViewBtn?.addEventListener(
        "click",
        fermerModalVoirClient
    );

    closeViewFooterBtn?.addEventListener(
        "click",
        fermerModalVoirClient
    );

// ========================================
// CLIC SUR LES ACTIONS DU TABLEAU
// ========================================

const clientsTableBody =
    document.getElementById("clients-table-body");

clientsTableBody?.addEventListener(
    "click",
    function (event) {

        const viewButton =
            event.target.closest(".view-btn");

        if (viewButton) {

            const clientId =
                viewButton.dataset.clientId;

            const client =
                clientsCharges.find(
                    function (element) {

                        return String(element.idClient) ===
                            String(clientId);
                    }
                );

            if (!client) {

                showToast(
                    "Impossible de retrouver les informations du client.",
                    "error"
                );

                return;
            }

            afficherDetailsClient(client);
            ouvrirModalVoirClient();

            return;
        }

        // ========================================
        // BOUTON MODIFIER
        // ========================================

        const editButton =
            event.target.closest(".edit-btn");

        if (editButton) {

            const clientId =
                editButton.dataset.clientId;

            const client =
                clientsCharges.find(
                    function (element) {

                        return String(element.idClient) ===
                            String(clientId);
                    }
                );

            if (!client) {

                showToast(
                    "Impossible de retrouver le client à modifier.",
                    "error"
                );

                return;
            }

clientEnModificationId = client.idClient;
            
            remplirFormulaireClient(client);
openModal();

            return;
        }

   // ========================================
// BOUTON SUPPRIMER
// ========================================

const deleteButton =
    event.target.closest(".delete-btn");

if (deleteButton) {

    const clientId =
        deleteButton.dataset.clientId;

    const client =
        clientsCharges.find(
            function (element) {

                return String(element.idClient) ===
                    String(clientId);
            }
        );

    if (!client) {

        showToast(
            "Impossible de retrouver le client à supprimer.",
            "error"
        );

        return;
    }

    ouvrirModalSuppression(client);

    return;
} 

    }
);

    // ========================================
    // FERMETURE AVEC LA TOUCHE ÉCHAP
    // ========================================

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                closeModal();

                fermerModalVoirClient();

                fermerModalSuppression();
            }
        }
    );


    // ========================================
    // RECHERCHE, FILTRES ET ACTUALISATION
    // ========================================

    initialiserRechercheEtFiltresClients();
    initialiserExportsClients();
    initialiserImpressionClients();

    // ========================================
    // FORMULAIRE CLIENT
    // ========================================

    const clientForm =
        document.getElementById("client-form");

    clientForm?.addEventListener(
        "submit",
        enregistrerClient
    );


    // Charger les clients au démarrage, puis activer la
    // synchronisation légère automatique toutes les 10 secondes.
    Promise.resolve(
        chargerClients()
    ).finally(function () {
        initialiserSynchronisationAutomatiqueClients();
    });
}


// ========================================
// DÉMARRAGE DE LA PAGE
// ========================================

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initialiserClients
    );

} else {

    initialiserClients();
}


// ========================================
// MISE À JOUR LOCALE APRÈS CRUD CLIENTS
// ========================================

function finaliserMutationLocaleClients(signature) {
    if (signature != null) {
        signatureSyncClients = String(signature);
    }

    /*
     * Mise à jour immédiate locale pour garder l'UX instantanée,
     * puis revalidation silencieuse de la page serveur afin de corriger
     * automatiquement l'ordre, le total, les KPI et les filtres.
     */
    clientsAffiches = clientsCharges.slice();
    afficherClients(clientsAffiches);
    mettreAJourKPIsClients();
    sauvegarderCacheNavigationClients();

    Promise.resolve().then(function() {
        return chargerClients({
            forcer: true,
            silencieux: true,
            verifierSync: false
        });
    }).catch(function(error) {
        console.warn(
            "Revalidation Clients après mutation indisponible :",
            error
        );
    });
}

function ajouterClientLocal(client, signature) {
    if (!client || !client.idClient) return false;

    const existe = clientsCharges.some(function (element) {
        return String(element.idClient) === String(client.idClient);
    });

    if (!existe) {
        clientsCharges.unshift(client);
    }

    finaliserMutationLocaleClients(signature);
    return true;
}

function modifierClientLocal(client, signature) {
    if (!client || !client.idClient) return false;

    const index = clientsCharges.findIndex(function (element) {
        return String(element.idClient) === String(client.idClient);
    });

    if (index === -1) return false;

    // On conserve les champs calculés par getClients() :
    // date d'inscription, nombre de commandes, achats et avoirs.
    clientsCharges[index] = Object.assign(
        {},
        clientsCharges[index],
        client
    );

    finaliserMutationLocaleClients(signature);
    return true;
}

function supprimerClientLocal(idClient, signature) {
    const longueurAvant = clientsCharges.length;

    idsClientsSelectionnes.delete(String(idClient));
    cacheClientsSelectionnes.delete(String(idClient));

    clientsCharges = clientsCharges.filter(function (element) {
        return String(element.idClient) !== String(idClient);
    });

    if (clientsCharges.length === longueurAvant) {
        return false;
    }

    finaliserMutationLocaleClients(signature);
    return true;
}



/* ===========================================================
   FEEDBACK SOFT — ENREGISTREMENT / MODIFICATION CLIENT
   Même principe que Commandes : blocage anti double-clic,
   loader centré puis confirmation de succès au même endroit.
=========================================================== */

function obtenirLoaderEnregistrementClient() {
    const formulaire = document.getElementById("client-form");
    if (!formulaire) return null;

    let loader = formulaire.querySelector(".client-save-soft-loader");
    if (loader) return loader;

    loader = document.createElement("div");
    loader.className = "client-save-soft-loader";
    loader.setAttribute("aria-hidden", "true");

    loader.innerHTML = `
        <div class="client-save-soft-loader-card" role="status" aria-live="polite">
            <div class="client-save-loading-view">
                <span class="client-save-soft-spinner" aria-hidden="true"></span>

                <div class="client-save-soft-loader-copy">
                    <strong class="client-save-soft-loader-title">
                        Enregistrement du client…
                    </strong>
                    <span class="client-save-soft-loader-text">
                        Quelques secondes, s’il vous plaît.
                    </span>
                </div>
            </div>

            <div class="client-save-success-view" aria-hidden="true">
                <div class="client-save-success-icon" aria-hidden="true">✓</div>

                <div class="client-save-success-confetti" aria-hidden="true">
                    <span>◆</span><span>●</span><span>◆</span>
                    <span>●</span><span>◆</span><span>●</span>
                </div>

                <strong class="client-save-success-title">
                    Client enregistré !
                </strong>

                <span class="client-save-success-text">
                    Le client a été enregistré avec succès.
                </span>

                <div class="client-save-success-reference" hidden>
                    <span class="client-save-success-reference-label">Client</span>
                    <strong class="client-save-success-reference-value"></strong>
                </div>

                <button type="button" class="client-save-success-btn">
                    ✓ Parfait !
                </button>
            </div>
        </div>
    `;

    formulaire.appendChild(loader);
    return loader;
}

function demarrerLoaderEnregistrementClient(modification = false) {
    const loader = obtenirLoaderEnregistrementClient();
    if (!loader) return;

    loader.classList.remove("is-success");

    const loadingView = loader.querySelector(".client-save-loading-view");
    const successView = loader.querySelector(".client-save-success-view");
    const titre = loader.querySelector(".client-save-soft-loader-title");

    loadingView?.removeAttribute("aria-hidden");
    successView?.setAttribute("aria-hidden", "true");

    if (titre) {
        titre.textContent = modification
            ? "Modification du client…"
            : "Enregistrement du client…";
    }

    loader.classList.add("is-visible");
    loader.setAttribute("aria-hidden", "false");
}

function terminerLoaderEnregistrementClient() {
    const loader = document.querySelector("#client-form .client-save-soft-loader");
    if (!loader) return;

    loader.classList.remove("is-visible", "is-success");
    loader.setAttribute("aria-hidden", "true");
}

function afficherSuccesEnregistrementClient(client, modification = false) {
    return new Promise(resolve => {
        const loader = obtenirLoaderEnregistrementClient();
        if (!loader) {
            resolve();
            return;
        }

        const loadingView = loader.querySelector(".client-save-loading-view");
        const successView = loader.querySelector(".client-save-success-view");
        const titre = loader.querySelector(".client-save-success-title");
        const texte = loader.querySelector(".client-save-success-text");
        const blocReference = loader.querySelector(".client-save-success-reference");
        const valeurReference = loader.querySelector(".client-save-success-reference-value");
        const bouton = loader.querySelector(".client-save-success-btn");

        loadingView?.setAttribute("aria-hidden", "true");
        successView?.removeAttribute("aria-hidden");

        if (titre) {
            titre.textContent = modification
                ? "Client modifié !"
                : "Client enregistré !";
        }

        if (texte) {
            texte.textContent = modification
                ? "Les modifications ont été enregistrées avec succès."
                : "Le client a été enregistré avec succès.";
        }

        const nomClient = [
            client?.nom || "",
            client?.prenom || ""
        ].filter(Boolean).join(" ").trim();

        if (blocReference && valeurReference && nomClient) {
            valeurReference.textContent = nomClient;
            blocReference.hidden = false;
        } else if (blocReference) {
            blocReference.hidden = true;
        }

        loader.classList.add("is-success");

        const terminer = () => resolve();

        if (bouton) {
            bouton.addEventListener("click", terminer, { once: true });
            window.setTimeout(() => bouton.focus(), 80);
        } else {
            resolve();
        }
    });
}




function obtenirTitreErreurClientCentre(message) {
    const texte = String(message || "").toLowerCase();

    if (
        texte.includes("connexion impossible") ||
        texte.includes("failed to fetch") ||
        texte.includes("network")
    ) return "Connexion impossible";

    if (texte.includes("téléphone") || texte.includes("telephone")) {
        if (texte.includes("déjà utilisé") || texte.includes("deja utilise")) {
            return "Numéro déjà utilisé";
        }
        return "Numéro de téléphone invalide";
    }

    if (texte.includes("email") || texte.includes("e-mail")) {
        if (texte.includes("déjà") || texte.includes("deja") || texte.includes("existe déjà")) {
            return "Email déjà utilisé";
        }
        return "Email invalide";
    }

    if (
        texte.includes("historique") ||
        texte.includes("traçabilité") ||
        texte.includes("tracabilite") ||
        texte.includes("supprimer") ||
        texte.includes("suppression")
    ) return "Suppression impossible";

    if (texte.includes("type de client")) return "Type de client invalide";
    if (texte.includes("statut")) return "Statut invalide";

    return "Action impossible";
}


function afficherErreurClientCentre(message) {
    return new Promise(resolve => {
        let overlay = document.getElementById("client-error-center-overlay");

        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "client-error-center-overlay";
            overlay.setAttribute("aria-hidden", "true");

            overlay.innerHTML = `
                <div class="client-error-center-card" role="alertdialog"
                     aria-modal="true"
                     aria-labelledby="client-error-center-title">
                    <div class="client-error-center-icon" aria-hidden="true">!</div>
                    <strong id="client-error-center-title"
                            class="client-error-center-title"></strong>
                    <span class="client-error-center-message"></span>
                    <button type="button" class="client-error-center-btn">
                        Compris
                    </button>
                </div>
            `;

            const style = document.createElement("style");
            style.id = "client-error-center-style";
            style.textContent = `
                #client-error-center-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    background: rgba(15,23,42,.30);
                    backdrop-filter: blur(2px);
                    -webkit-backdrop-filter: blur(2px);
                    opacity: 0;
                    visibility: hidden;
                    pointer-events: none;
                    transition: opacity .18s ease, visibility .18s ease;
                }

                #client-error-center-overlay.is-visible {
                    opacity: 1;
                    visibility: visible;
                    pointer-events: auto;
                }

                .client-error-center-card {
                    width: min(420px, 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    padding: 26px 24px 22px;
                    text-align: center;
                    background: #fff;
                    border: 1px solid rgba(239,68,68,.16);
                    border-radius: 16px;
                    box-shadow: 0 22px 55px rgba(15,23,42,.20);
                    transform: translateY(8px) scale(.98);
                    transition: transform .20s ease;
                }

                #client-error-center-overlay.is-visible
                .client-error-center-card {
                    transform: translateY(0) scale(1);
                }

                .client-error-center-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 62px;
                    height: 62px;
                    margin-bottom: 2px;
                    color: #fff;
                    font-size: 34px;
                    font-weight: 800;
                    line-height: 1;
                    background: #ef4444;
                    border-radius: 50%;
                    box-shadow:
                        0 0 0 9px rgba(239,68,68,.08),
                        0 10px 24px rgba(239,68,68,.20);
                }

                .client-error-center-title {
                    margin-top: 5px;
                    color: #dc2626;
                    font-size: 20px;
                    line-height: 1.25;
                }

                .client-error-center-message {
                    max-width: 340px;
                    color: #64748b;
                    font-size: 13px;
                    line-height: 1.55;
                }

                .client-error-center-btn {
                    min-width: 150px;
                    margin-top: 9px;
                    padding: 10px 20px;
                    color: #fff;
                    font-size: 13px;
                    font-weight: 800;
                    background: #ef4444;
                    border: 0;
                    border-radius: 9px;
                    cursor: pointer;
                    box-shadow: 0 8px 18px rgba(239,68,68,.18);
                    transition: transform .16s ease, box-shadow .16s ease;
                }

                .client-error-center-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 10px 22px rgba(239,68,68,.24);
                }

                @media (max-width: 480px) {
                    #client-error-center-overlay {
                        padding: 16px;
                    }

                    .client-error-center-card {
                        padding: 23px 18px 19px;
                    }
                }
            `;

            document.head.appendChild(style);
            document.body.appendChild(overlay);
        }

        const titreElement =
            overlay.querySelector(".client-error-center-title");
        const messageElement =
            overlay.querySelector(".client-error-center-message");
        const bouton =
            overlay.querySelector(".client-error-center-btn");

        if (titreElement) {
            titreElement.textContent =
                obtenirTitreErreurClientCentre(message);
        }

        if (messageElement) {
            messageElement.textContent =
                message ||
                "Une erreur est survenue. Veuillez réessayer.";
        }

        overlay.classList.add("is-visible");
        overlay.setAttribute("aria-hidden", "false");

        const fermer = () => {
            overlay.classList.remove("is-visible");
            overlay.setAttribute("aria-hidden", "true");
            resolve();
        };

        bouton?.addEventListener("click", fermer, { once: true });
        setTimeout(() => bouton?.focus(), 80);
    });
}


function obtenirMessageErreurEnregistrementClient(error) {
    const messageBrut = String(
        error?.message ||
        error ||
        ""
    ).trim();

    const messageNormalise = messageBrut.toLowerCase();

    const erreurReseau =
        navigator.onLine === false ||
        messageNormalise.includes("failed to fetch") ||
        messageNormalise.includes("networkerror") ||
        messageNormalise.includes("network error") ||
        messageNormalise.includes("load failed") ||
        messageNormalise.includes("fetch failed") ||
        messageNormalise.includes("connexion") && messageNormalise.includes("réseau");

    if (erreurReseau) {
        return "Connexion impossible. Vérifiez votre connexion Internet puis réessayez.";
    }

    return (
        messageBrut ||
        "Impossible d’enregistrer le client. Veuillez réessayer."
    );
}

// ========================================
// ENREGISTREMENT D'UN CLIENT
// ========================================

async function enregistrerClient(event) {

    event.preventDefault();

    const clientForm = document.getElementById("client-form");
    const saveButton = document.getElementById("save-client-btn");

    if (!clientForm) {
        return;
    }

    // Anti double-clic / double soumission.
    if (clientForm.dataset.processing === "true") {
        return;
    }

    // Validation HTML native avant toute requête.
    if (!clientForm.checkValidity()) {
        clientForm.reportValidity();
        return;
    }

    /*
     * Si le navigateur sait déjà qu'il est hors connexion,
     * on n'affiche même pas le loader et aucune requête n'est lancée.
     */
    if (navigator.onLine === false) {
        terminerLoaderEnregistrementClient();

        await afficherErreurClientCentre(
            "Connexion impossible. Vérifiez votre connexion Internet puis réessayez."
        );

        return;
    }

    const estModification = Boolean(clientEnModificationId);

    const data = {
        nom: document.getElementById("client-lastname").value.trim(),
        prenom: document.getElementById("client-firstname").value.trim(),
        telephone: document.getElementById("client-phone").value.trim(),
        email: document.getElementById("client-email").value.trim(),
        commune: document.getElementById("client-commune").value,
        quartier: document.getElementById("client-neighborhood").value.trim(),
        typeClient: document.getElementById("client-type").value,
        statut: document.getElementById("client-status").value,
        commentaire: document.getElementById("client-comment").value.trim()
    };

    clientForm.dataset.processing = "true";

    try {
        demarrerLoaderEnregistrementClient(estModification);

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.classList.add("is-processing");
            saveButton.dataset.originalText = saveButton.textContent.trim();
            saveButton.textContent = estModification
                ? "Modification..."
                : "Enregistrement...";
        }

        let resultat;

        if (estModification) {
            data.idClient = clientEnModificationId;
            resultat = await apiPost("updateClient", data);
        } else {
            resultat = await apiPost("createClient", data);
        }

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                (estModification
                    ? "Impossible de modifier le client."
                    : "Impossible d'enregistrer le client.")
            );
        }

        let miseAJourLocaleOk = false;

        if (estModification) {
            miseAJourLocaleOk = modifierClientLocal(
                resultat.client,
                resultat.signature
            );
        } else {
            miseAJourLocaleOk = ajouterClientLocal(
                resultat.client,
                resultat.signature
            );
        }

        if (!miseAJourLocaleOk) {
            await chargerClients({
                forcer: true,
                silencieux: true
            });
        }

        // Même expérience que Commandes :
        // le loader devient une carte de succès centrée.
        await afficherSuccesEnregistrementClient(
            resultat.client || data,
            estModification
        );

        clientForm.reset();
        clientEnModificationId = null;

        const modalTitle = document.getElementById("client-modal-title");
        if (modalTitle) {
            modalTitle.textContent = "Nouveau client";
        }

        const clientModal = document.getElementById("client-modal");
        clientModal?.classList.remove("active");
        clientModal?.setAttribute("aria-hidden", "true");

    } catch (error) {
        console.error("Erreur d'enregistrement client :", error);

        // Le loader disparaît dès que l'échec est capturé.
        terminerLoaderEnregistrementClient();

        const messageErreur =
            obtenirMessageErreurEnregistrementClient(error);

        await afficherErreurClientCentre(
            messageErreur
        );

    } finally {
        terminerLoaderEnregistrementClient();

        clientForm.dataset.processing = "false";

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.classList.remove("is-processing");
            saveButton.textContent = clientEnModificationId
                ? "Enregistrer les modifications"
                : "Enregistrer le client";
        }
    }
}


// ========================================
// FENÊTRE DE CONFIRMATION DE SUPPRESSION
// ========================================

function ouvrirModalSuppression(client) {

    const modal =
        document.getElementById("delete-client-modal");

    const clientName =
        document.getElementById("delete-client-name");

    if (!modal || !clientName) {

        console.error(
            'La fenêtre de suppression est introuvable.'
        );

        showToast(
            "Impossible d’ouvrir la confirmation de suppression.",
            "error"
        );

        return;
    }

    clientASupprimer = client;

    const nomComplet = [
        client.nom,
        client.prenom
    ]
        .filter(Boolean)
        .join(" ")
        .trim();

    clientName.textContent =
        nomComplet || client.idClient || "Ce client";

    modal.classList.add("active");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    const confirmDeleteBtn =
        document.getElementById("confirm-delete-client-btn");

    window.setTimeout(
        function () {
            confirmDeleteBtn?.focus();
        },
        50
    );
}


function fermerModalSuppression() {

    const modal =
        document.getElementById("delete-client-modal");

    if (!modal) {
        return;
    }

    const confirmDeleteBtn =
        document.getElementById("confirm-delete-client-btn");

    if (confirmDeleteBtn?.disabled) {
        return;
    }

    modal.classList.remove("active");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    clientASupprimer = null;
}



/* ===========================================================
   SUCCÈS — SUPPRESSION CLIENT
   Même modèle centré que l'enregistrement / modification.
=========================================================== */
function afficherSuccesSuppressionClient(client) {
    return new Promise(resolve => {
        let overlay = document.getElementById("client-delete-success-overlay");

        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "client-delete-success-overlay";
            overlay.className = "client-delete-success-overlay";
            overlay.setAttribute("aria-hidden", "true");

            overlay.innerHTML = `
                <div class="client-delete-success-card" role="status" aria-live="polite">
                    <div class="client-delete-success-icon" aria-hidden="true">✓</div>

                    <div class="client-delete-success-confetti" aria-hidden="true">
                        <span>◆</span><span>●</span><span>◆</span>
                        <span>●</span><span>◆</span><span>●</span>
                    </div>

                    <strong class="client-delete-success-title">
                        Client supprimé !
                    </strong>

                    <span class="client-delete-success-text">
                        Le client a été supprimé avec succès.
                    </span>

                    <div class="client-delete-success-reference" hidden>
                        <span class="client-delete-success-reference-label">Client</span>
                        <strong class="client-delete-success-reference-value"></strong>
                    </div>

                    <button type="button" class="client-delete-success-btn">
                        ✓ Parfait !
                    </button>
                </div>
            `;

            document.body.appendChild(overlay);
        }

        if (!document.getElementById("client-delete-success-style-inline")) {
            const style = document.createElement("style");
            style.id = "client-delete-success-style-inline";
            style.textContent = `
                #client-delete-success-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    background: rgba(15,23,42,.30);
                    backdrop-filter: blur(2px);
                    -webkit-backdrop-filter: blur(2px);
                    opacity: 0;
                    visibility: hidden;
                    pointer-events: none;
                    transition: opacity .18s ease, visibility .18s ease;
                }
                #client-delete-success-overlay.is-visible {
                    opacity: 1;
                    visibility: visible;
                    pointer-events: auto;
                }
                #client-delete-success-overlay .client-delete-success-card {
                    width: min(420px, 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    padding: 28px 24px 22px;
                    text-align: center;
                    background: #fff;
                    border-radius: 16px;
                    box-shadow: 0 22px 55px rgba(15,23,42,.20);
                }
                #client-delete-success-overlay .client-delete-success-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 64px;
                    height: 64px;
                    color: #fff;
                    font-size: 32px;
                    font-weight: 900;
                    background: #22c55e;
                    border-radius: 50%;
                    box-shadow: 0 0 0 9px rgba(34,197,94,.08), 0 10px 24px rgba(34,197,94,.20);
                }
                #client-delete-success-overlay .client-delete-success-title {
                    margin-top: 6px;
                    font-size: 21px;
                    color: #0f172a;
                }
                #client-delete-success-overlay .client-delete-success-text {
                    color: #64748b;
                    font-size: 13px;
                    line-height: 1.55;
                }
                #client-delete-success-overlay .client-delete-success-reference {
                    margin-top: 3px;
                    padding: 8px 12px;
                    border-radius: 10px;
                    background: #f8fafc;
                    color: #334155;
                }
                #client-delete-success-overlay .client-delete-success-reference-label {
                    margin-right: 6px;
                    color: #94a3b8;
                    font-size: 12px;
                }
                #client-delete-success-overlay .client-delete-success-btn {
                    min-width: 150px;
                    margin-top: 8px;
                    padding: 10px 20px;
                    border: 0;
                    border-radius: 9px;
                    color: #fff;
                    font-size: 13px;
                    font-weight: 800;
                    background: #22c55e;
                    cursor: pointer;
                }
                #client-delete-success-overlay .client-delete-success-confetti {
                    display: none;
                }
            `;
            document.head.appendChild(style);
        }

        const valeur = overlay.querySelector(".client-delete-success-reference-value");
        const bloc = overlay.querySelector(".client-delete-success-reference");
        const bouton = overlay.querySelector(".client-delete-success-btn");

        const nomClient = [
            client?.nom || "",
            client?.prenom || ""
        ].filter(Boolean).join(" ").trim();

        if (bloc && valeur && nomClient) {
            valeur.textContent = nomClient;
            bloc.hidden = false;
        } else if (bloc) {
            bloc.hidden = true;
        }

        overlay.classList.add("is-visible");
        overlay.setAttribute("aria-hidden", "false");

        const terminer = () => {
            overlay.classList.remove("is-visible");
            overlay.setAttribute("aria-hidden", "true");
            resolve();
        };

        if (bouton) {
            bouton.addEventListener("click", terminer, { once: true });
            setTimeout(() => bouton.focus(), 80);
        } else {
            resolve();
        }
    });
}

// ========================================
// SUPPRESSION D'UN CLIENT
// ========================================

async function supprimerClient(idClient) {

    try {

        const resultat =
            await apiPost(
                "deleteClient",
                {
                    idClient: idClient
                }
            );

        if (resultat.success) {

            /*
             * Suppression locale immédiate :
             * aucun getClients() complet n'est nécessaire.
             */
            const suppressionLocaleOk =
                supprimerClientLocal(
                    idClient,
                    resultat.signature
                );

            // Fallback uniquement si l'état local était incohérent.
            if (!suppressionLocaleOk) {
                await chargerClients({
                    forcer: true,
                    silencieux: true
                });
            }

            showToast(
                resultat.message,
                "success"
            );

            return true;

        } else {

            await afficherErreurClientCentre(
                resultat.message ||
                "Impossible de supprimer le client."
            );

            return false;
        }

    } catch (error) {

        console.error(
            "Erreur suppression client :",
            error
        );

        await afficherErreurClientCentre(
            obtenirMessageErreurEnregistrementClient(error)
        );

        return false;
    }
}


// ========================================
// CHARGEMENT DES CLIENTS
// ========================================

async function chargerClients(options = {}) {

    const forcer = options?.forcer === true;
    const silencieux = options?.silencieux === true;
    const verifierSync = options?.verifierSync !== false;

    // Retour sur Clients : page en cache immédiatement, puis vérification légère.
    if (!forcer && restaurerCacheNavigationClients()) {

        if (verifierSync) {
            verifierSynchronisationClients();
        }

        return;
    }

    /*
     * Une nouvelle recherche / un nouveau filtre ne doit jamais attendre
     * une requête lancée avec d'anciens critères.
     * Chaque appel reçoit une génération ; seule la réponse la plus récente
     * est autorisée à mettre à jour l'interface.
     */
    const generationCourante =
        ++generationChargementClients;

    if (!silencieux) {
        demarrerLoaderClients("Chargement des clients…");
        definirEtatChargementKPIsClients(true);
    }

    chargementPageClientsEnCours = (async function () {
        try {

            const resultat =
                await apiGet(
                    "getClientsPage",
                    {
                        page:
                            typeof pageClientsCourante !== "undefined"
                                ? pageClientsCourante
                                : 1,
                        limite: 10,
                        recherche: rechercheClients || "",
                        typeClient: filtresClients.typeClient || "",
                        statut: filtresClients.statut || "",
                        commune: filtresClients.commune || "",
                        tri:
                            typeof triClients !== "undefined"
                                ? (triClients.cle || "")
                                : "",
                        direction:
                            typeof triClients !== "undefined"
                                ? (triClients.direction || "asc")
                                : "asc",
                        _ts: Date.now()
                    }
                );

            if (!resultat || resultat.success === false) {

                /*
                 * Une ancienne requête peut revenir après une nouvelle recherche.
                 * Dans ce cas, on ignore silencieusement sa réponse.
                 */
                if (generationCourante !== generationChargementClients) {
                    return;
                }

                showToast(
                    resultat?.message ||
                    "Impossible de charger les clients.",
                    "error"
                );

                return;
            }

            if (generationCourante !== generationChargementClients) {
                return;
            }

            clientsCharges =
                Array.isArray(resultat.clients)
                    ? resultat.clients
                    : [];

            clientsAffiches = clientsCharges.slice();

            if (resultat.signature != null) {
                signatureSyncClients =
                    String(resultat.signature);
            }

            if (typeof pageClientsCourante !== "undefined") {
                pageClientsCourante =
                    Number(resultat.page) > 0
                        ? Number(resultat.page)
                        : 1;
            }

            totalClientsFiltresServeur =
                Number(resultat.total) >= 0
                    ? Number(resultat.total)
                    : clientsCharges.length;

            totalPagesClientsServeur =
                Number(resultat.totalPages) > 0
                    ? Number(resultat.totalPages)
                    : 1;

            totalClientsGlobalServeur =
                Number(resultat.totalGlobal) >= 0
                    ? Number(resultat.totalGlobal)
                    : totalClientsFiltresServeur;

            kpisClientsServeur =
                resultat.kpis && typeof resultat.kpis === "object"
                    ? resultat.kpis
                    : null;

            clientsCharges.forEach(function(client) {
                if (client && client.idClient != null) {
                    cacheClientsSelectionnes.set(
                        String(client.idClient),
                        client
                    );
                }
            });

            mettreAJourKPIsClients();
            afficherClients(clientsAffiches);
            mettreAJourCompteurClients(
                totalClientsFiltresServeur
            );
            mettreAJourEtatBoutonEffacer();
            sauvegarderCacheNavigationClients();

            if (
                signatureSyncClients == null &&
                verifierSync
            ) {
                obtenirSignatureSyncClients()
                    .then(function(signature) {
                        if (signature == null) return;
                        signatureSyncClients = signature;
                        sauvegarderCacheNavigationClients();
                    });
            }

        } catch (error) {

            console.error(
                "Erreur chargement clients :",
                error
            );

            showToast(
                "Impossible de charger la liste des clients.",
                "error"
            );

        } finally {

            definirEtatChargementKPIsClients(false);

            if (!silencieux) {
                terminerLoaderClients();
            }
        }
    })().finally(function() {
        /*
         * Ne pas effacer la référence d'une requête plus récente
         * si une ancienne requête se termine après elle.
         */
        if (generationCourante === generationChargementClients) {
            chargementPageClientsEnCours = null;
        }
    });

    return chargementPageClientsEnCours;
}


function definirEtatChargementKPIsClients(actif) {
    [
        "total-clients-value",
        "active-clients-value",
        "new-clients-value",
        "client-revenue-value"
    ].forEach(id => {
        const element = document.getElementById(id);
        element?.classList.toggle("is-loading", Boolean(actif));
        element?.setAttribute("aria-busy", String(Boolean(actif)));
    });
}

// ========================================
// KPI DYNAMIQUES DES CLIENTS
// ========================================

function mettreAJourKPIsClients() {

    const kpis =
        kpisClientsServeur &&
        typeof kpisClientsServeur === "object"
            ? kpisClientsServeur
            : null;

    const totalClients =
        kpis
            ? Number(kpis.totalClients || 0)
            : clientsCharges.length;

    const clientsActifs =
        kpis
            ? Number(kpis.clientsActifs || 0)
            : clientsCharges.filter(function (client) {
                return normaliserValeurRecherche(client.statut) === "actif";
            }).length;

    const pourcentageActifs =
        totalClients > 0
            ? Math.round((clientsActifs / totalClients) * 100)
            : 0;

    let nouveauxCeMois = 0;
    let achatsCumules = 0;
    let moyenneAchats = 0;

    if (kpis) {
        nouveauxCeMois =
            Number(kpis.nouveauxCeMois || 0);

        achatsCumules =
            convertirMontantClient(
                kpis.achatsCumules || 0
            );

        moyenneAchats =
            convertirMontantClient(
                kpis.moyenneAchats || 0
            );

    } else {
        const maintenant = new Date();
        const moisActuel = maintenant.getMonth();
        const anneeActuelle = maintenant.getFullYear();

        nouveauxCeMois =
            clientsCharges.filter(function (client) {
                const dateInscription =
                    convertirDateClient(client.dateInscription);

                return (
                    dateInscription &&
                    dateInscription.getMonth() === moisActuel &&
                    dateInscription.getFullYear() === anneeActuelle
                );
            }).length;

        achatsCumules =
            clientsCharges.reduce(function (total, client) {
                return total +
                    convertirMontantClient(
                        client.montantTotalAchats
                    );
            }, 0);

        moyenneAchats =
            totalClients > 0
                ? achatsCumules / totalClients
                : 0;
    }

    /*
     * Nouveau composant KPI global.
     * Les valeurs proviennent exclusivement des données déjà calculées
     * par le module / backend. Rien n'est codé en dur dans kpi.js.
     */
    if (
        window.VisiblKPI &&
        typeof window.VisiblKPI.update === "function"
    ) {
        window.VisiblKPI.update("clients-total", {
            value: totalClients,
            subtitle:
                `${nouveauxCeMois.toLocaleString("fr-FR")} nouveau${nouveauxCeMois > 1 ? "x" : ""} client${nouveauxCeMois > 1 ? "s" : ""} ce mois`,
            theme: "blue"
        });

        window.VisiblKPI.update("clients-actifs", {
            value: clientsActifs,
            subtitle:
                `${pourcentageActifs.toLocaleString("fr-FR")} % des clients`,
            ring: pourcentageActifs,
            theme: "green"
        });

        window.VisiblKPI.update("clients-nouveaux", {
            value: nouveauxCeMois,
            subtitle: "Inscrits durant le mois en cours",
            theme: "purple"
        });

        window.VisiblKPI.update("clients-achats", {
            value: achatsCumules,
            unit: "FCFA",
            subtitle:
                `Moyenne : ${formaterMontantClient(moyenneAchats)} / client`,
            theme: "orange"
        });

        return;
    }

    /*
     * Fallback : si kpi.js n'est pas chargé, l'ancien affichage
     * continue à fonctionner au lieu de casser le module.
     */
    definirTexteKPI(
        "total-clients-value",
        totalClients.toLocaleString("fr-FR")
    );

    definirTexteKPI(
        "total-clients-description",
        `${nouveauxCeMois.toLocaleString("fr-FR")} nouveau${nouveauxCeMois > 1 ? "x" : ""} client${nouveauxCeMois > 1 ? "s" : ""} ce mois`
    );

    definirTexteKPI(
        "active-clients-value",
        clientsActifs.toLocaleString("fr-FR")
    );

    definirTexteKPI(
        "active-clients-description",
        `${pourcentageActifs.toLocaleString("fr-FR")} % des clients`
    );

    definirTexteKPI(
        "new-clients-value",
        nouveauxCeMois.toLocaleString("fr-FR")
    );

    definirTexteKPI(
        "new-clients-description",
        "Inscrits durant le mois en cours"
    );

    definirTexteKPI(
        "client-revenue-value",
        formaterMontantClient(achatsCumules)
    );

    definirTexteKPI(
        "client-revenue-description",
        `Moyenne : ${formaterMontantClient(moyenneAchats)} / client`
    );
}

function definirTexteKPI(idElement, texte) {

    const element = document.getElementById(idElement);

    if (element) {
        element.textContent = texte;
    }
}


function convertirMontantClient(montant) {

    if (typeof montant === "number") {
        return Number.isFinite(montant) ? montant : 0;
    }

    const valeurNettoyee = String(montant ?? "")
        .replace(/\s/g, "")
        .replace(/FCFA/gi, "")
        .replace(/[^0-9,.-]/g, "")
        .replace(/,/g, ".");

    const valeur = Number(valeurNettoyee);

    return Number.isFinite(valeur) ? valeur : 0;
}


function convertirDateClient(date) {

    if (!date) {
        return null;
    }

    const dateClient = date instanceof Date
        ? new Date(date.getTime())
        : new Date(date);

    return Number.isNaN(dateClient.getTime())
        ? null
        : dateClient;
}


// ========================================
// DONNÉES COMPLÈTES POUR IMPRESSION / EXPORT
// ========================================

async function obtenirTousClientsPourSortie_() {

    /*
     * Si le snapshot complet est déjà disponible et correspond
     * à la signature courante, on réutilise les données locales :
     * aucun appel serveur supplémentaire.
     */
    if (
        Array.isArray(snapshotClientsComplet_) &&
        snapshotClientsSignature_ ===
            String(signatureSyncClients || "")
    ) {
        return filtrerEtTrierSnapshotClients_().slice();
    }

    const options = {
        recherche: rechercheClients || "",
        typeClient: filtresClients.typeClient || "",
        statut: filtresClients.statut || "",
        commune: filtresClients.commune || "",
        tri: triClients?.cle || "",
        direction: triClients?.direction || "asc"
    };

    const premierePage = await apiGet(
        "getClientsPage",
        {
            page: 1,
            limite: 10,
            ...options,
            _ts: Date.now()
        }
    );

    if (
        !premierePage ||
        premierePage.success === false
    ) {
        throw new Error(
            premierePage?.message ||
            "Impossible de récupérer tous les clients."
        );
    }

    const totalPages =
        Math.max(
            1,
            Number(premierePage.totalPages) || 1
        );

    const pages = [
        Array.isArray(premierePage.clients)
            ? premierePage.clients
            : []
    ];

    if (totalPages > 1) {
        const appels = [];

        for (let page = 2; page <= totalPages; page++) {
            appels.push(
                apiGet(
                    "getClientsPage",
                    {
                        page: page,
                        limite: 10,
                        ...options,
                        _ts: Date.now()
                    }
                )
            );
        }

        const resultats =
            await Promise.all(appels);

        resultats.forEach(function(resultat) {
            if (
                resultat &&
                resultat.success !== false &&
                Array.isArray(resultat.clients)
            ) {
                pages.push(resultat.clients);
            }
        });
    }

    const clients = pages.flat();

    /*
     * Sécurité contre un doublon éventuel entre deux pages.
     */
    const uniques = new Map();

    clients.forEach(function(client) {
        if (!client) return;

        const cle = String(
            client.idClient ?? ""
        ).trim();

        if (!cle) return;

        uniques.set(cle, client);
    });

    return [...uniques.values()];
}


// ========================================
// IMPRESSION DES CLIENTS
// ========================================

function initialiserImpressionClients() {
    const boutonImprimer = document.getElementById("print-clients-btn");
    if (!boutonImprimer) return;

    boutonImprimer.addEventListener("click", function () {
        imprimerClients();
    });
}

async function imprimerClients() {

    /*
     * Ouvrir immédiatement la fenêtre afin que le navigateur
     * ne la bloque pas pendant la récupération asynchrone.
     */
    const fenetreImpression =
        window.open(
            "",
            "_blank",
            "width=1200,height=800"
        );

    if (!fenetreImpression) {
        showToast(
            "Autorisez les fenêtres contextuelles pour lancer l’impression.",
            "error"
        );
        return;
    }

    fenetreImpression.document.open();
    fenetreImpression.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Préparation de l’impression…</title>
        </head>
        <body style="font-family:Arial,sans-serif;padding:24px;">
            Préparation de la liste complète des clients…
        </body>
        </html>
    `);
    fenetreImpression.document.close();

    try {
        const clientsAImprimer =
            await obtenirTousClientsPourSortie_();

        if (
            !Array.isArray(clientsAImprimer) ||
            clientsAImprimer.length === 0
        ) {
            fenetreImpression.close();

            showToast(
                "Aucun client à imprimer.",
                "error"
            );
            return;
        }

        const echapperHTML = function (valeur) {
            return String(valeur ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const lignes =
            clientsAImprimer.map(
                function (client, index) {

                    const nomComplet =
                        `${client.nom || ""} ${client.prenom || ""}`.trim();

                    return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${echapperHTML(client.idClient || "")}</td>
                            <td>${echapperHTML(nomComplet)}</td>
                            <td>${echapperHTML(formaterTelephone(client.telephone))}</td>
                            <td>${echapperHTML(client.email || "")}</td>
                            <td>${echapperHTML(mettreMajuscule(client.commune))}</td>
                            <td>${echapperHTML(mettreMajuscule(client.typeClient))}</td>
                            <td>${echapperHTML(formaterDateClient(client.dateInscription))}</td>
                            <td>${echapperHTML(client.nombreCommandes || 0)}</td>
                            <td>${echapperHTML(
                                formaterMontantClient(
                                    convertirMontantClient(
                                        client.montantTotalAchats
                                    )
                                )
                            )}</td>
                            <td>${echapperHTML(
                                formaterMontantClient(
                                    convertirMontantClient(
                                        client.creditClient ??
                                        client.soldeAvoir ??
                                        0
                                    )
                                )
                            )}</td>
                            <td>${echapperHTML(
                                mettreMajuscule(client.statut)
                            )}</td>
                        </tr>`;
                }
            ).join("");

        const dateImpression =
            new Date().toLocaleString("fr-FR");

        fenetreImpression.document.open();
        fenetreImpression.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>VISIBL — Liste des clients</title>
    <style>
        @page { size: landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; color: #111827; }
        .print-header { margin-bottom: 16px; }
        h1 { margin: 0 0 6px; font-size: 22px; }
        .meta { color: #4b5563; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #d1d5db; padding: 6px; font-size: 9px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
        th { background: #e5e7eb; font-weight: 700; }
        tbody tr:nth-child(even) { background: #f9fafb; }
        th:nth-child(1), td:nth-child(1) { width: 3%; text-align: center; }
        th:nth-child(2), td:nth-child(2) { width: 8%; }
        th:nth-child(3), td:nth-child(3) { width: 13%; }
        th:nth-child(4), td:nth-child(4) { width: 10%; }
        th:nth-child(5), td:nth-child(5) { width: 15%; }
        th:nth-child(6), td:nth-child(6) { width: 9%; }
        th:nth-child(7), td:nth-child(7) { width: 8%; }
        th:nth-child(8), td:nth-child(8) { width: 10%; }
        th:nth-child(9), td:nth-child(9) { width: 6%; text-align: center; }
        th:nth-child(10), td:nth-child(10) { width: 10%; text-align: right; }
        th:nth-child(11), td:nth-child(11) { width: 9%; text-align: right; }
        th:nth-child(12), td:nth-child(12) { width: 7%; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; }
        .no-print { margin-top: 12px; font-size: 11px; color: #6b7280; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="print-header">
        <h1>VISIBL — Liste des clients</h1>
        <div class="meta">
            Imprimé le ${echapperHTML(dateImpression)}
            • ${clientsAImprimer.length} client(s)
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>N°</th>
                <th>ID</th>
                <th>Client</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Commune</th>
                <th>Type</th>
                <th>Inscription</th>
                <th>Cmd.</th>
                <th>Achats</th>
                <th>Crédit</th>
                <th>Statut</th>
            </tr>
        </thead>
        <tbody>${lignes}</tbody>
    </table>

    <p class="no-print">
        La fenêtre d’impression va s’ouvrir automatiquement.
    </p>
</body>
</html>`);

        fenetreImpression.document.close();

        fenetreImpression.onload = function () {
            fenetreImpression.focus();
            fenetreImpression.print();

            fenetreImpression.onafterprint =
                function () {
                    fenetreImpression.close();
                };
        };

    } catch (error) {
        console.error(
            "Erreur impression complète Clients :",
            error
        );

        try {
            fenetreImpression.close();
        } catch (e) {}

        showToast(
            "Impossible de préparer l’impression complète.",
            "error"
        );
    }
}


// ========================================
// EXPORT DES CLIENTS (PDF, EXCEL ET CSV)
// ========================================

function initialiserExportsClients() {

    const menu = document.getElementById("export-clients-menu");
    const bouton = document.getElementById("export-clients-btn");
    const liste = document.getElementById("export-clients-dropdown");

    if (!menu || !bouton || !liste) return;

    const fermerMenu = function () {
        menu.classList.remove("is-open");
        liste.hidden = true;
        bouton.setAttribute("aria-expanded", "false");
    };

    const ouvrirMenu = function () {
        menu.classList.add("is-open");
        liste.hidden = false;
        bouton.setAttribute("aria-expanded", "true");
        liste.querySelector(".export-option")?.focus();
    };

    bouton.addEventListener("click", function (event) {
        event.stopPropagation();
        liste.hidden ? ouvrirMenu() : fermerMenu();
    });

    liste.addEventListener("click", async function (event) {
        const option = event.target.closest("[data-export-format]");
        if (!option) return;

        const format = option.dataset.exportFormat;
        fermerMenu();

        if (clientsAffiches.length === 0) {
            showToast("Aucun client à exporter.", "error");
            return;
        }

        try {
            if (format === "pdf") await exporterClientsPDF();
            if (format === "xlsx") await exporterClientsExcel();
            if (format === "csv") await exporterClientsCSV();
        } catch (error) {
            console.error("Erreur export clients :", error);
            showToast("Impossible de générer le fichier d’export.", "error");
        }
    });

    document.addEventListener("click", function (event) {
        if (!menu.contains(event.target)) fermerMenu();
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !liste.hidden) {
            fermerMenu();
            bouton.focus();
        }
    });
}

function obtenirDonneesExportClients(clients = clientsAffiches) {
    const liste = Array.isArray(clients) ? clients : [];

    return liste.map(function (client) {
        return {
            "Identifiant": client.idClient || "",
            "Nom": client.nom || "",
            "Prénom": client.prenom || "",
            "Téléphone": formaterTelephone(client.telephone),
            "Email": client.email || "",
            "Commune": mettreMajuscule(client.commune),
            "Quartier": client.quartier || "",
            "Type": mettreMajuscule(client.typeClient),
            "Date d’inscription": formaterDateClient(client.dateInscription),
            "Commandes": Number(client.nombreCommandes || 0),
            "Total achats (FCFA)": convertirMontantClient(client.montantTotalAchats),
            "Crédit client (FCFA)": convertirMontantClient(
                client.creditClient ?? client.soldeAvoir ?? 0
            ),
            "Statut": mettreMajuscule(client.statut)
        };
    });
}

function obtenirNomFichierExport(extension) {
    const date = new Date();
    const estampille = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
    return `VISIBL_clients_${estampille}.${extension}`;
}

async function exporterClientsCSV() {
    const clients =
        await obtenirTousClientsPourSortie_();

    if (!clients.length) {
        showToast(
            "Aucun client à exporter.",
            "error"
        );
        return;
    }

    const donnees =
        obtenirDonneesExportClients(clients);

    const colonnes = Object.keys(donnees[0]);
    const separateur = ";";

    const protegerCSV = function (valeur) {
        const texte =
            String(valeur ?? "")
                .replace(/"/g, '""');

        return `"${texte}"`;
    };

    const lignes = [
        colonnes
            .map(protegerCSV)
            .join(separateur),

        ...donnees.map(function (ligne) {
            return colonnes
                .map(function (colonne) {
                    return protegerCSV(
                        ligne[colonne]
                    );
                })
                .join(separateur);
        })
    ];

    telechargerBlob(
        new Blob(
            ["\ufeff" + lignes.join("\r\n")],
            {
                type: "text/csv;charset=utf-8;"
            }
        ),
        obtenirNomFichierExport("csv")
    );

    showToast(
        `${donnees.length} client(s) exporté(s) en CSV.`,
        "success"
    );
}


async function exporterClientsExcel() {
    if (typeof XLSX === "undefined") {
        throw new Error(
            "La bibliothèque Excel n’est pas chargée."
        );
    }

    const clients =
        await obtenirTousClientsPourSortie_();

    if (!clients.length) {
        showToast(
            "Aucun client à exporter.",
            "error"
        );
        return;
    }

    const donnees =
        obtenirDonneesExportClients(clients);

    const feuille =
        XLSX.utils.json_to_sheet(donnees);

    feuille["!cols"] = [
        { wch: 16 }, { wch: 18 }, { wch: 18 },
        { wch: 18 }, { wch: 28 }, { wch: 16 },
        { wch: 22 }, { wch: 14 }, { wch: 18 },
        { wch: 12 }, { wch: 22 }, { wch: 18 },
        { wch: 14 }
    ];

    feuille["!autofilter"] = {
        ref: feuille["!ref"]
    };

    const classeur =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        classeur,
        feuille,
        "Clients"
    );

    XLSX.writeFile(
        classeur,
        obtenirNomFichierExport("xlsx")
    );

    showToast(
        `${donnees.length} client(s) exporté(s) vers Excel.`,
        "success"
    );
}


async function exporterClientsPDF() {
    if (!window.jspdf?.jsPDF) {
        throw new Error(
            "La bibliothèque PDF n’est pas chargée."
        );
    }

    const clients =
        await obtenirTousClientsPourSortie_();

    if (!clients.length) {
        showToast(
            "Aucun client à exporter.",
            "error"
        );
        return;
    }

    const donnees =
        obtenirDonneesExportClients(clients);

    const { jsPDF } = window.jspdf;

    const documentPDF =
        new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });

    const dateExport =
        new Date().toLocaleString("fr-FR");

    documentPDF.setFontSize(18);
    documentPDF.text(
        "VISIBL — Liste des clients",
        14,
        16
    );

    documentPDF.setFontSize(9);
    documentPDF.text(
        `Exporté le ${dateExport} • ${donnees.length} client(s)`,
        14,
        23
    );

    documentPDF.autoTable({
        startY: 29,

        head: [[
            "ID",
            "Client",
            "Téléphone",
            "Email",
            "Commune",
            "Type",
            "Inscription",
            "Cmd.",
            "Achats",
            "Crédit",
            "Statut"
        ]],

        body: donnees.map(function (client) {
            return [
                client["Identifiant"],
                `${client["Nom"]} ${client["Prénom"]}`.trim(),
                client["Téléphone"],
                client["Email"],
                client["Commune"],
                client["Type"],
                client["Date d’inscription"],
                client["Commandes"],
                formaterMontantClient(
                    client["Total achats (FCFA)"]
                ),
                formaterMontantClient(
                    client["Crédit client (FCFA)"]
                ),
                client["Statut"]
            ];
        }),

        styles: {
            fontSize: 7,
            cellPadding: 2,
            overflow: "linebreak"
        },

        headStyles: {
            fillColor: [30, 64, 175]
        },

        alternateRowStyles: {
            fillColor: [245, 247, 250]
        },

        margin: {
            left: 10,
            right: 10
        },

        didDrawPage: function () {
            const numeroPage =
                documentPDF.internal
                    .getNumberOfPages();

            documentPDF.setFontSize(8);

            documentPDF.text(
                `VISIBL • Page ${numeroPage}`,
                documentPDF.internal
                    .pageSize
                    .getWidth() - 10,
                documentPDF.internal
                    .pageSize
                    .getHeight() - 6,
                {
                    align: "right"
                }
            );
        }
    });

    documentPDF.save(
        obtenirNomFichierExport("pdf")
    );

    showToast(
        `${donnees.length} client(s) exporté(s) en PDF.`,
        "success"
    );
}


function telechargerBlob(blob, nomFichier) {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}


// ========================================
// RECHERCHE ET FILTRES DES CLIENTS
// ========================================

function initialiserRechercheEtFiltresClients() {

    const recherchePage =
        document.getElementById("clients-search-input");

    const rechercheHeader =
        document.querySelector(".header .search-input");

    const boutonRechercheHeader =
        document.querySelector(".header .search-btn");

    const filtreType =
        document.getElementById("client-type-filter");

    const filtreStatut =
        document.getElementById("client-status-filter");

    const filtreCommune =
        document.getElementById("client-commune-filter");

    const boutonEffacer =
        document.getElementById("reset-client-filters");

    const boutonActualiser =
        document.getElementById("refresh-clients-btn");

    const synchroniserRecherche = function (valeur, source) {

        rechercheClients = String(valeur ?? "");

        if (source !== recherchePage && recherchePage) {
            recherchePage.value = rechercheClients;
        }

        if (source !== rechercheHeader && rechercheHeader) {
            rechercheHeader.value = rechercheClients;
        }

        appliquerRechercheEtFiltresClients();
    };

    recherchePage?.addEventListener("input", function () {
        synchroniserRecherche(recherchePage.value, recherchePage);
    });

    rechercheHeader?.addEventListener("input", function () {
        synchroniserRecherche(rechercheHeader.value, rechercheHeader);
    });

    boutonRechercheHeader?.addEventListener("click", function (event) {
        event.preventDefault();
        synchroniserRecherche(rechercheHeader?.value || "", rechercheHeader);
    });

    rechercheHeader?.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            synchroniserRecherche(rechercheHeader.value, rechercheHeader);
        }
    });

    filtreType?.addEventListener("change", function () {
        filtresClients.typeClient = filtreType.value;
        appliquerRechercheEtFiltresClients();
    });

    filtreStatut?.addEventListener("change", function () {
        filtresClients.statut = filtreStatut.value;
        appliquerRechercheEtFiltresClients();
    });

    filtreCommune?.addEventListener("change", function () {
        filtresClients.commune = filtreCommune.value;
        appliquerRechercheEtFiltresClients();
    });

    boutonEffacer?.addEventListener("click", function () {

        rechercheClients = "";
        filtresClients = {
            typeClient: "",
            statut: "",
            commune: ""
        };

        if (recherchePage) recherchePage.value = "";
        if (rechercheHeader) rechercheHeader.value = "";
        if (filtreType) filtreType.value = "";
        if (filtreStatut) filtreStatut.value = "";
        if (filtreCommune) filtreCommune.value = "";

        appliquerRechercheEtFiltresClients();
    });

    boutonActualiser?.addEventListener("click", async function () {

        if (boutonActualiser.disabled) return;

        boutonActualiser.disabled = true;
        boutonActualiser.classList.add("is-loading");

        try {
            await chargerClients({ forcer: true, silencieux: false });
            showToast("Liste des clients actualisée.", "success");
        } finally {
            boutonActualiser.disabled = false;
            boutonActualiser.classList.remove("is-loading");
        }
    });
}


function programmerChargementClientsServeur(delai = 220) {
    if (timerRechercheClientsServeur) {
        window.clearTimeout(timerRechercheClientsServeur);
    }

    timerRechercheClientsServeur =
        window.setTimeout(function() {
            timerRechercheClientsServeur = null;

            chargerClients({
                forcer: true,
                silencieux: true
            });
        }, delai);
}

function appliquerRechercheEtFiltresClients() {

    if (typeof pageClientsCourante !== "undefined") {
        pageClientsCourante = 1;
    }

    mettreAJourEtatBoutonEffacer();
    programmerChargementClientsServeur();
}


function normaliserValeurRecherche(valeur) {

    return String(valeur ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9@.+-]+/g, " ")
        .replace(/\s+/g, " ");
}


function mettreAJourCompteurClients(nombre) {

    const compteur =
        document.getElementById("filtered-client-count");

    if (compteur) {
        compteur.textContent = String(nombre);
    }
}


function mettreAJourEtatBoutonEffacer() {

    const bouton =
        document.getElementById("reset-client-filters");

    if (!bouton) return;

    const filtreActif = Boolean(
        rechercheClients.trim() ||
        filtresClients.typeClient ||
        filtresClients.statut ||
        filtresClients.commune
    );

    bouton.disabled = !filtreActif;
    bouton.setAttribute(
        "aria-disabled",
        filtreActif ? "false" : "true"
    );
}


// ========================================
// FENÊTRE VOIR CLIENT
// ========================================

function ouvrirModalVoirClient() {

    const modal =
        document.getElementById("view-client-modal");

    if (!modal) {

        console.error(
            'La fenêtre avec id="view-client-modal" est introuvable.'
        );

        return;
    }

    modal.classList.add("active");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}


function fermerModalVoirClient() {

    const modal =
        document.getElementById("view-client-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("active");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}



// ========================================
// INFORMATIONS DU CLIENT DANS LA FENÊTRE
// ========================================

function afficherDetailsClient(client) {

    const nomComplet = [
        client.nom,
        client.prenom
    ]
        .filter(Boolean)
        .join(" ");

    definirTexteClient(
        "view-client-id",
        client.idClient
    );

    definirTexteClient(
        "view-client-name",
        nomComplet
    );

    definirTexteClient(
        "view-client-phone",
        formaterTelephone(client.telephone)
    );

    definirTexteClient(
        "view-client-email",
        client.email
    );

    definirTexteClient(
        "view-client-type",
        mettreMajuscule(client.typeClient)
    );

    definirTexteClient(
        "view-client-status",
        mettreMajuscule(client.statut)
    );

    definirTexteClient(
        "view-client-commune",
        mettreMajuscule(client.commune)
    );

    definirTexteClient(
        "view-client-neighborhood",
        client.quartier
    );

    definirTexteClient(
        "view-client-date",
        formaterDateClient(
            client.dateInscription
        )
    );

    definirTexteClient(
        "view-client-orders",
        client.nombreCommandes ?? 0
    );

    definirTexteClient(
        "view-client-purchases",
        formaterMontantClient(
            client.montantTotalAchats
        )
    );

    definirTexteClient(
        "view-client-credit",
        formaterMontantClient(
            client.creditClient ?? client.soldeAvoir ?? 0
        )
    );

    definirTexteClient(
        "view-client-comment",
        client.commentaire
    );
}


function definirTexteClient(idElement, valeur) {

    const element =
        document.getElementById(idElement);

    if (!element) {

        console.warn(
            `Élément introuvable : ${idElement}`
        );

        return;
    }

    const texte =
        String(valeur ?? "")
            .trim();

    element.textContent =
        texte || "—";
}


// ========================================
// AFFICHAGE DES CLIENTS
// ========================================

function afficherClients(clients) {

    const tbody =
        document.getElementById("clients-table-body");

    const emptyState =
        document.getElementById("clients-empty-state");


    if (!tbody) {

        console.error(
            'Le tableau doit contenir un tbody avec id="clients-table-body".'
        );

        return;
    }


    tbody.innerHTML = "";


    if (clients.length === 0) {

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;
    }


    if (emptyState) {
        emptyState.hidden = true;
    }


    clients.forEach(function (client) {

        const ligne =
            document.createElement("tr");


        const nomComplet = [

            client.nom,
            client.prenom

        ]
            .filter(Boolean)
            .join(" ");


        const contact = `
            <div>
                ${echapperHTML(
                    formaterTelephone(client.telephone)
                )}
            </div>

            <div>
                ${echapperHTML(client.email)}
            </div>
        `;


        ligne.innerHTML = `
            <td class="client-selection-column">
                <input
                    type="checkbox"
                    class="client-checkbox"
                    value="${echapperHTML(client.idClient)}"
                    aria-label="Sélectionner ${echapperHTML(nomComplet)}"
                >
            </td>

            <td>
                <div>
                    ${echapperHTML(nomComplet)}
                </div>

                <small>
                    ${echapperHTML(client.idClient)}
                </small>
            </td>

            <td>
                ${contact}
            </td>

            <td>
                ${echapperHTML(
                    mettreMajuscule(client.commune)
                )}
            </td>

            <td>
                ${echapperHTML(
                    mettreMajuscule(client.typeClient)
                )}
            </td>

            <td>
                ${formaterDateClient(
                    client.dateInscription
                )}
            </td>

            <td>
                ${echapperHTML(
                    client.nombreCommandes ?? 0
                )}
            </td>

            <td>
                ${formaterMontantClient(
                    client.montantTotalAchats
                )}
            </td>

            <td>
                <span class="${
                    convertirMontantClient(
                        client.creditClient ?? client.soldeAvoir ?? 0
                    ) > 0
                        ? "client-credit-positive"
                        : "client-credit-zero"
                }">
                    ${formaterMontantClient(
                        client.creditClient ?? client.soldeAvoir ?? 0
                    )}
                </span>
            </td>

            <td>
                ${echapperHTML(client.quartier)}
            </td>

            <td>
                <span
                    class="
                        status-badge
                        status-${obtenirClasseStatut(client.statut)}
                    "
                >
                    ${echapperHTML(
                        mettreMajuscule(client.statut)
                    )}
                </span>
            </td>

            <td class="client-actions-cell">
                <div class="client-row-menu">
                    <button
                        type="button"
                        class="client-row-menu-trigger"
                        data-client-actions-toggle="${echapperHTML(client.idClient)}"
                        aria-expanded="false"
                        aria-label="Actions du client"
                    >⋮</button>

                    <div
                        class="client-row-menu-dropdown"
                        data-client-actions-menu="${echapperHTML(client.idClient)}"
                        hidden
                    >
                        <button
                            type="button"
                            class="view-btn"
                            data-client-id="${echapperHTML(client.idClient)}"
                        >
                            <i class="fa-solid fa-eye"></i>
                            <span>Voir</span>
                        </button>

                        <button
                            type="button"
                            class="edit-btn"
                            data-client-id="${echapperHTML(client.idClient)}"
                        >
                            <i class="fa-solid fa-pen"></i>
                            <span>Modifier</span>
                        </button>

                        <button
                            type="button"
                            class="delete-btn danger-action"
                            data-client-id="${echapperHTML(client.idClient)}"
                        >
                            <i class="fa-solid fa-trash"></i>
                            <span>Supprimer</span>
                        </button>
                    </div>
                </div>
            </td>
        `;


        tbody.appendChild(ligne);
    });
}


// ========================================
// FORMATAGE DE LA DATE
// ========================================

function formaterDateClient(date) {

    if (!date) {
        return "";
    }


    const dateClient =
        new Date(date);


    if (Number.isNaN(dateClient.getTime())) {

        return echapperHTML(date);
    }


    return dateClient.toLocaleDateString(
        "fr-FR"
    );
}


// ========================================
// FORMATAGE DU MONTANT
// ========================================

function formaterMontantClient(montant) {

    const valeur =
        Number(montant || 0);


    return valeur.toLocaleString("fr-FR")
        + " FCFA";
}


// ========================================
// CLASSE CSS DU STATUT
// ========================================

function obtenirClasseStatut(statut) {

    const valeur =
        String(statut ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            );


    const classes = {

        actif: "actif",
        inactif: "inactif",
        prospect: "prospect",
        bloque: "bloque"
    };


    return classes[valeur] || "inconnu";
}


// ========================================
// PREMIÈRE LETTRE EN MAJUSCULE
// ========================================

function mettreMajuscule(valeur) {

    const texte =
        String(valeur ?? "")
            .trim();


    if (!texte) {
        return "";
    }


    return texte
        .charAt(0)
        .toUpperCase()
        + texte
            .slice(1)
            .toLowerCase();
}


// ========================================
// FORMATAGE DU TÉLÉPHONE
// ========================================

function formaterTelephone(telephone) {

    let numero =
        String(telephone ?? "")
            .replace(/\s+/g, "");


    if (!numero) {
        return "";
    }

    // Anciennes cellules Google Sheets numériques : le zéro initial a pu disparaître.
    if (/^\d{9}$/.test(numero)) {
        numero = "0" + numero;
    }


    // Cas : +225XXXXXXXXXX
    if (numero.startsWith("+225")) {

        const reste =
            numero.substring(4);


        if (reste.length === 10) {

            return "+225 "
                + reste
                    .match(/.{1,2}/g)
                    .join(" ");
        }


        return numero;
    }


    // Cas : numéro ivoirien sur 8 ou 10 chiffres
    if (
        numero.length === 8 ||
        numero.length === 10
    ) {

        return numero
            .match(/.{1,2}/g)
            .join(" ");
    }


    return numero;
}


// ========================================
// PROTECTION HTML
// ========================================

function echapperHTML(valeur) {

    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
// ========================================
// ÉTAPE 4 — TRI, PAGINATION, SÉLECTION ET COLONNES
// ========================================
let pageClientsCourante = 1;
let clientsParPage = 10;
let triClients = { cle: "", direction: "asc" };
const idsClientsSelectionnes = new Set();
let clientsPageCourante = [];

const colonnesClients = [
    { id: "client", label: "Client", index: 1, visible: true },
    { id: "contact", label: "Contact", index: 2, visible: true },
    { id: "commune", label: "Commune", index: 3, visible: true },
    { id: "type", label: "Type", index: 4, visible: true },
    { id: "date", label: "Date d’inscription", index: 5, visible: true },
    { id: "commandes", label: "Commandes", index: 6, visible: true },
    { id: "achats", label: "Total achats", index: 7, visible: true },
    { id: "credit", label: "Crédit client", index: 8, visible: true },
    { id: "quartier", label: "Quartier", index: 9, visible: true },
    { id: "statut", label: "Statut", index: 10, visible: true },
    { id: "actions", label: "Actions", index: 11, visible: true }
];

function initialiserFonctionsAvanceesClients() {
    const selectParPage = document.getElementById("clients-per-page");
    if (selectParPage) {
        selectParPage.value = "10";
        selectParPage.disabled = true;
        selectParPage.hidden = true;
    }

    document.getElementById("previous-page-btn")
        ?.addEventListener("click", function () {
            if (pageClientsCourante <= 1) return;

            pageClientsCourante--;

            chargerClients({
                forcer: true,
                silencieux: true
            });
        });

    document.getElementById("next-page-btn")
        ?.addEventListener("click", function () {
            if (pageClientsCourante >= totalPagesClientsServeur) return;

            pageClientsCourante++;

            chargerClients({
                forcer: true,
                silencieux: true
            });
        });

    document.querySelector(".clients-table thead")
        ?.addEventListener("click", function (event) {
            const entete = event.target.closest("th[data-sort-key]");
            if (!entete) return;

            const cle = entete.dataset.sortKey;

            triClients.direction =
                triClients.cle === cle &&
                triClients.direction === "asc"
                    ? "desc"
                    : "asc";

            triClients.cle = cle;
            pageClientsCourante = 1;

            chargerClients({
                forcer: true,
                silencieux: true
            });
        });

    const tbody = document.getElementById("clients-table-body");
    tbody?.addEventListener("change", function (event) {
        const checkbox = event.target.closest(".client-checkbox");
        if (!checkbox) return;
        const id = String(checkbox.value);

        if (checkbox.checked) {
            idsClientsSelectionnes.add(id);

            const client = clientsPageCourante.find(function(item) {
                return String(item.idClient) === id;
            });

            if (client) {
                cacheClientsSelectionnes.set(id, client);
            }
        } else {
            idsClientsSelectionnes.delete(id);
            cacheClientsSelectionnes.delete(id);
        }
        checkbox.closest("tr")?.classList.toggle("is-selected", checkbox.checked);
        mettreAJourSelectionClients();
    });

    document.getElementById("select-all-clients")?.addEventListener("change", function (event) {
        const cocher = event.target.checked;
        clientsPageCourante.forEach(function (client) {
            const id = String(client.idClient);

            if (cocher) {
                idsClientsSelectionnes.add(id);
                cacheClientsSelectionnes.set(id, client);
            } else {
                idsClientsSelectionnes.delete(id);
                cacheClientsSelectionnes.delete(id);
            }
        });
        afficherClients(clientsAffiches);
    });

    document.getElementById("bulk-clear-selection")?.addEventListener("click", function () {
        idsClientsSelectionnes.clear(); afficherClients(clientsAffiches);
    });
    document.getElementById("bulk-export-pdf")?.addEventListener("click", function () { exporterSelectionClients("pdf"); });
    document.getElementById("bulk-export-xlsx")?.addEventListener("click", function () { exporterSelectionClients("xlsx"); });
    document.getElementById("bulk-export-csv")?.addEventListener("click", function () { exporterSelectionClients("csv"); });
    document.getElementById("bulk-delete-clients")?.addEventListener("click", ouvrirModalSuppressionMultiple);
    document.getElementById("cancel-bulk-delete-client-btn")?.addEventListener("click", fermerModalSuppressionMultiple);
    document.getElementById("close-bulk-delete-client-btn")?.addEventListener("click", fermerModalSuppressionMultiple);
    document.getElementById("bulk-delete-client-modal")?.addEventListener("click", function (event) { if (event.target === event.currentTarget) fermerModalSuppressionMultiple(); });
    document.getElementById("confirm-bulk-delete-client-btn")?.addEventListener("click", supprimerClientsSelectionnes);

}

function comparerClients(a, b, cle) {
    if (["nombreCommandes", "montantTotalAchats"].includes(cle)) {
        return convertirMontantClient(a[cle]) - convertirMontantClient(b[cle]);
    }
    if (cle === "dateInscription") {
        const da = convertirDateClient(a[cle])?.getTime?.() || 0;
        const db = convertirDateClient(b[cle])?.getTime?.() || 0;
        return da - db;
    }
    const va = normaliserValeurRecherche(cle === "nom" ? `${a.nom || ""} ${a.prenom || ""}` : a[cle]);
    const vb = normaliserValeurRecherche(cle === "nom" ? `${b.nom || ""} ${b.prenom || ""}` : b[cle]);
    return va.localeCompare(vb, "fr", { numeric: true });
}

// Renderer de base conservé pour le rendu des lignes.
const afficherClientsOriginal = afficherClients;

function mettreAJourIndicateursTri() {
    document.querySelectorAll("th[data-sort-key]").forEach(function(th){
        const indicateur=th.querySelector(".sort-indicator");
        if (indicateur) indicateur.textContent = th.dataset.sortKey === triClients.cle ? (triClients.direction === "asc" ? "▲" : "▼") : "↕";
        th.setAttribute("aria-sort", th.dataset.sortKey === triClients.cle ? (triClients.direction === "asc" ? "ascending" : "descending") : "none");
    });
}

function restaurerSelectionDansTableau() {
    document.querySelectorAll(".client-checkbox").forEach(function(cb){
        cb.checked = idsClientsSelectionnes.has(String(cb.value));
        cb.closest("tr")?.classList.toggle("is-selected", cb.checked);
    });
}

function mettreAJourSelectionClients() {
    const nombre = idsClientsSelectionnes.size;

    const barre =
        document.getElementById("bulk-clients-bar");

    const compteur =
        document.getElementById("selected-clients-count");

    if (barre) {
        barre.hidden = nombre === 0;
    }

    if (compteur) {
        compteur.textContent = String(nombre);
    }

    const selectAll =
        document.getElementById("select-all-clients");

    if (selectAll) {
        const coches =
            clientsPageCourante.filter(function(client) {
                return idsClientsSelectionnes.has(
                    String(client.idClient)
                );
            }).length;

        selectAll.checked =
            clientsPageCourante.length > 0 &&
            coches === clientsPageCourante.length;

        selectAll.indeterminate =
            coches > 0 &&
            coches < clientsPageCourante.length;
    }
}

function obtenirClientsSelectionnes() {
    return [...idsClientsSelectionnes]
        .map(function(id) {
            return (
                cacheClientsSelectionnes.get(String(id)) ||
                clientsCharges.find(function(client) {
                    return String(client.idClient) === String(id);
                })
            );
        })
        .filter(Boolean);
}

function exporterSelectionClients(format) {
    const selection = obtenirClientsSelectionnes();
    if (!selection.length) return showToast("Sélectionnez au moins un client.", "error");
    const sauvegarde = clientsAffiches;
    clientsAffiches = selection;
    try { if(format==="pdf") exporterClientsPDF(); if(format==="xlsx") exporterClientsExcel(); if(format==="csv") exporterClientsCSV(); }
    finally { clientsAffiches = sauvegarde; }
}

function ouvrirModalSuppressionMultiple() {
    const nombre=idsClientsSelectionnes.size; if(!nombre) return;
    const modal=document.getElementById("bulk-delete-client-modal"), message=document.getElementById("bulk-delete-client-message");
    if(message) message.textContent=`Vous allez supprimer définitivement ${nombre} client(s). Cette action est irréversible.`;
    modal?.classList.add("active"); modal?.setAttribute("aria-hidden","false");
}
function fermerModalSuppressionMultiple() { const modal=document.getElementById("bulk-delete-client-modal"); modal?.classList.remove("active"); modal?.setAttribute("aria-hidden","true"); }

async function supprimerClientsSelectionnes() {
    const bouton = document.getElementById("confirm-bulk-delete-client-btn");
    const ids = [...idsClientsSelectionnes]
        .map(id => String(id || "").trim())
        .filter(Boolean);

    if (!ids.length || bouton?.disabled) return;

    if (bouton) {
        bouton.disabled = true;
        bouton.classList.add("is-loading");
    }

    try {
        // Un seul appel API, quel que soit le nombre de clients sélectionnés.
        const resultat = await apiPost("deleteClientsBulk", {
            idsClients: ids
        });

        if (!resultat || resultat.success !== true) {
            showToast(
                resultat?.message || "La suppression multiple a échoué.",
                "error"
            );
            return;
        }

        const idsSupprimes = Array.isArray(resultat.idsSupprimes)
            ? resultat.idsSupprimes.map(String)
            : [];

        const idsIntrouvables = Array.isArray(resultat.idsIntrouvables)
            ? resultat.idsIntrouvables.map(String)
            : [];

        // Mise à jour immédiate de l'état local.
        const supprimesSet = new Set(idsSupprimes);

        clientsCharges = clientsCharges.filter(
            client => !supprimesSet.has(String(client?.idClient))
        );

        clientsAffiches = clientsAffiches.filter(
            client => !supprimesSet.has(String(client?.idClient))
        );

        idsSupprimes.forEach(id => {
            idsClientsSelectionnes.delete(String(id));
            cacheClientsSelectionnes.delete(String(id));
        });

        // Si tout s'est bien passé, aucune sélection ne doit rester.
        if (!idsIntrouvables.length) {
            idsClientsSelectionnes.clear();
        }

        if (resultat.signature != null) {
            signatureSyncClients = String(resultat.signature);
        }

        // Revalidation unique après la mutation pour total/KPI/pagination.
        await chargerClients({
            forcer: true,
            silencieux: true,
            verifierSync: false
        });

        fermerModalSuppressionMultiple();

        if (idsSupprimes.length) {
            showToast(
                `${idsSupprimes.length} client(s) supprimé(s).`,
                "success"
            );
        }

        if (idsIntrouvables.length) {
            showToast(
                `${idsIntrouvables.length} client(s) n'ont pas été trouvés.`,
                "error"
            );
        }

    } catch (error) {
        console.error("Erreur suppression multiple Clients :", error);
        showToast(
            "Impossible de supprimer les clients sélectionnés.",
            "error"
        );
    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.classList.remove("is-loading");
        }
    }
}

function initialiserMenuColonnesClients() {
    const menu=document.getElementById("columns-clients-menu"), bouton=document.getElementById("columns-clients-btn"), liste=document.getElementById("columns-clients-dropdown");
    if(!menu||!bouton||!liste) return;
    liste.innerHTML = colonnesClients.map(c=>`<label class="column-option"><input type="checkbox" data-column-toggle="${c.id}" checked> <span>${c.label}</span></label>`).join("");
    bouton.addEventListener("click",function(e){ e.stopPropagation(); const ouvrir=liste.hidden; liste.hidden=!ouvrir; bouton.setAttribute("aria-expanded",String(ouvrir)); });
    liste.addEventListener("change",function(e){ const cb=e.target.closest("[data-column-toggle]"); if(!cb)return; const c=colonnesClients.find(x=>x.id===cb.dataset.columnToggle); if(c)c.visible=cb.checked; appliquerVisibiliteColonnes(); });
    document.addEventListener("click",function(e){ if(!menu.contains(e.target)){liste.hidden=true; bouton.setAttribute("aria-expanded","false");} });
}

function appliquerVisibiliteColonnes() {
    colonnesClients.forEach(function(c){
        document.querySelectorAll(`.clients-table tr`).forEach(function(tr){ const cell=tr.children[c.index]; if(cell) cell.hidden=!c.visible; });
    });
}

// Recherche et filtres sont maintenant exécutés côté serveur.

// L'initialisation principale a déjà été enregistrée : ajouter nos fonctions après le chargement du DOM.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialiserFonctionsAvanceesClients);
else initialiserFonctionsAvanceesClients();


/* ===========================================================
   CORRECTIONS CLIENTS — modèle Ventes / Commandes
=========================================================== */
let modeSelectionClients = false;

function definirModeSelectionClients(actif) {
    modeSelectionClients = Boolean(actif);
    document.body.classList.toggle("clients-selection-mode", modeSelectionClients);

    const bouton = document.getElementById("selection-clients-btn");
    const barre = document.getElementById("bulk-clients-bar");

    bouton?.setAttribute("aria-pressed", String(modeSelectionClients));
    if (barre) barre.hidden = !modeSelectionClients;

    if (!modeSelectionClients) {
        idsClientsSelectionnes.clear();
    }

    afficherClients(clientsAffiches);
}

function obtenirPorteeActionClients() {
    const selection = obtenirClientsSelectionnes();
    return selection.length ? selection : clientsAffiches;
}

function executerAvecPorteeClients(action) {
    const portee = obtenirPorteeActionClients();

    if (!Array.isArray(portee) || !portee.length) {
        showToast("Aucun client disponible pour cette action.", "error");
        return;
    }

    const sauvegarde = clientsAffiches;
    clientsAffiches = portee;

    try {
        action();
    } finally {
        clientsAffiches = sauvegarde;
    }
}

function initialiserToolbarClientsReference() {
    const boutonSelection = document.getElementById("selection-clients-btn");
    const declencheurActions = document.getElementById("clients-actions-trigger");
    const menuActions = document.getElementById("clients-actions-dropdown");

    boutonSelection?.addEventListener("click", () => {
        if (!modeSelectionClients) {
            if (menuActions) menuActions.hidden = true;
            declencheurActions?.setAttribute("aria-expanded", "false");
        }
        definirModeSelectionClients(!modeSelectionClients);
    });

    document.getElementById("close-clients-selection-btn")
        ?.addEventListener("click", () => definirModeSelectionClients(false));

    document.getElementById("select-visible-clients-btn")
        ?.addEventListener("click", () => {
            clientsPageCourante.forEach(client => {
                idsClientsSelectionnes.add(String(client.idClient));
            });
            afficherClients(clientsAffiches);
        });

    declencheurActions?.addEventListener("click", event => {
        event.stopPropagation();
        const ouvrir = Boolean(menuActions?.hidden);
        if (ouvrir && modeSelectionClients) {
            definirModeSelectionClients(false);
        }
        if (menuActions) menuActions.hidden = !ouvrir;
        declencheurActions.setAttribute("aria-expanded", String(ouvrir));
    });

    menuActions?.addEventListener("click", event => event.stopPropagation());

    document.addEventListener("click", event => {
        if (!event.target.closest(".clients-actions-menu")) {
            if (menuActions) menuActions.hidden = true;
            declencheurActions?.setAttribute("aria-expanded", "false");
        }
    });

    document.getElementById("clients-action-pdf")
        ?.addEventListener("click", () => executerAvecPorteeClients(exporterClientsPDF));

    document.getElementById("clients-action-xlsx")
        ?.addEventListener("click", () => executerAvecPorteeClients(exporterClientsExcel));

    document.getElementById("clients-action-csv")
        ?.addEventListener("click", () => executerAvecPorteeClients(exporterClientsCSV));

    document.getElementById("clients-action-print")
        ?.addEventListener("click", () => executerAvecPorteeClients(imprimerClients));

    document.getElementById("clients-action-refresh")
        ?.addEventListener("click", async () => {
            await chargerClients({ forcer: true, silencieux: false });
        });

    menuActions?.querySelectorAll("button").forEach(button => {
        button.addEventListener("click", () => {
            menuActions.hidden = true;
            declencheurActions?.setAttribute("aria-expanded", "false");
        });
    });
}

/* La barre de sélection reste visible dès que le mode Sélection est actif,
   même avant d'avoir coché une ligne. */
const mettreAJourSelectionClientsReference = mettreAJourSelectionClients;
mettreAJourSelectionClients = function () {
    mettreAJourSelectionClientsReference();

    const barre = document.getElementById("bulk-clients-bar");
    if (barre) {
        barre.hidden = !modeSelectionClients;
    }
};

/* Le bouton Colonnes est supprimé : aucun masquage dynamique de colonnes
   ne doit déplacer les données du tableau. */
appliquerVisibiliteColonnes = function () {};

/* Menus ⋮ de chaque ligne. */

function positionnerMenuActionsClient(menu, trigger) {
    if (!menu || !trigger) return;

    menu.classList.remove("open-up", "open-down");

    /*
     * Desktop/tablette large :
     * le menu devient FIXED afin de sortir complètement de
     * .clients-table-container / .table-responsive qui utilisent overflow.
     * Ainsi, même sur la dernière ligne, aucune partie n'est coupée.
     */
    if (window.innerWidth > 900) {
        const rectTrigger = trigger.getBoundingClientRect();
        const margeEcran = 12;
        const ecart = 7;

        menu.style.setProperty("position", "fixed", "important");
        menu.style.setProperty("right", "auto", "important");
        menu.style.setProperty("bottom", "auto", "important");
        menu.style.setProperty("z-index", "20000", "important");

        // Mesure réelle une fois visible.
        const rectMenu = menu.getBoundingClientRect();
        const largeurMenu = Math.max(rectMenu.width || 0, 210);
        const hauteurMenu = Math.max(rectMenu.height || 0, 145);

        // Alignement à droite du bouton, sans sortir de l'écran.
        let left = rectTrigger.right - largeurMenu;
        left = Math.max(
            margeEcran,
            Math.min(left, window.innerWidth - largeurMenu - margeEcran)
        );

        const espaceDessous =
            window.innerHeight - rectTrigger.bottom - margeEcran;

        const espaceDessus =
            rectTrigger.top - margeEcran;

        let top;

        if (
            espaceDessous < hauteurMenu + ecart &&
            espaceDessus >= hauteurMenu + ecart
        ) {
            // Dernières lignes : le menu monte juste au-dessus du bouton.
            top = rectTrigger.top - hauteurMenu - ecart;
            menu.classList.add("open-up");
        } else {
            // Cas normal : sous le bouton.
            top = rectTrigger.bottom + ecart;

            // Sécurité si l'écran est très bas.
            if (top + hauteurMenu > window.innerHeight - margeEcran) {
                top = Math.max(
                    margeEcran,
                    window.innerHeight - hauteurMenu - margeEcran
                );
            }

            menu.classList.add("open-down");
        }

        menu.style.setProperty("left", `${Math.round(left)}px`, "important");
        menu.style.setProperty("top", `${Math.round(top)}px`, "important");
        return;
    }

    /*
     * Mobile :
     * on conserve le panneau bas plein largeur déjà prévu par le CSS.
     */
    menu.style.removeProperty("position");
    menu.style.removeProperty("top");
    menu.style.removeProperty("left");
    menu.style.removeProperty("right");
    menu.style.removeProperty("bottom");
    menu.style.removeProperty("z-index");
}

function fermerMenusActionsClients() {
    document.querySelectorAll("[data-client-actions-menu]").forEach(menu => {
        menu.hidden = true;
        menu.classList.remove("open-up", "open-down");

        // Nettoyage complet du positionnement FIXED desktop.
        menu.style.removeProperty("position");
        menu.style.removeProperty("top");
        menu.style.removeProperty("left");
        menu.style.removeProperty("right");
        menu.style.removeProperty("bottom");
        menu.style.removeProperty("z-index");
    });
    document.querySelectorAll("[data-client-actions-toggle]").forEach(button => {
        button.setAttribute("aria-expanded", "false");
    });
}

document.getElementById("clients-table-body")?.addEventListener("click", event => {
    const trigger = event.target.closest("[data-client-actions-toggle]");

    if (trigger) {
        event.stopPropagation();

        const id = String(trigger.dataset.clientActionsToggle || "");
        const menu = document.querySelector(
            `[data-client-actions-menu="${CSS.escape(id)}"]`
        );

        const ouvrir = Boolean(menu?.hidden);
        fermerMenusActionsClients();

        if (menu && ouvrir) {
            // On l'affiche d'abord, puis on calcule immédiatement
            // s'il doit s'ouvrir vers le haut ou vers le bas.
            menu.hidden = false;
            positionnerMenuActionsClient(menu, trigger);
        } else if (menu) {
            menu.hidden = true;
            menu.classList.remove("open-up", "open-down");
        }

        trigger.setAttribute("aria-expanded", String(ouvrir));
        return;
    }

    if (event.target.closest(".client-row-menu-dropdown button")) {
        fermerMenusActionsClients();
    }
});

document.addEventListener("click", event => {
    if (!event.target.closest(".client-row-menu")) {
        fermerMenusActionsClients();
    }
});

/* Header global : géré exclusivement par header.js. */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initialiserToolbarClientsReference();
        definirModeSelectionClients(false);
    });
} else {
    initialiserToolbarClientsReference();
    definirModeSelectionClients(false);
}



// ============================================================
// PAGINATION SERVEUR CLIENTS
// 10 clients fixes par page + navigation sur toutes les pages.
// ============================================================


/*
 * Le serveur renvoie déjà uniquement les 10 clients de la page demandée.
 * On force ici le renderer historique à considérer cette liste comme
 * "une page complète", sans refaire un slice avec pageClientsCourante.
 */
function rendrePageClientsServeur_(clients) {
    const liste = Array.isArray(clients) ? clients.slice(0, 10) : [];

    clientsPageCourante = liste;

    /*
     * L'ancien afficherClientsOriginal peut encore contenir une pagination
     * locale. On lui présente donc temporairement la page comme page 1,
     * puis on restaure le vrai numéro de page serveur.
     */
    const vraiePage = pageClientsCourante;

    pageClientsCourante = 1;
    afficherClientsOriginal(liste);
    pageClientsCourante = vraiePage;

    restaurerSelectionDansTableau();
    appliquerVisibiliteColonnes();

    mettreAJourPagination(
        totalClientsFiltresServeur,
        totalPagesClientsServeur
    );

    mettreAJourIndicateursTri();
    mettreAJourSelectionClients();
}

afficherClients = function (clients) {
    rendrePageClientsServeur_(clients);
};

/*
 * Pagination construite exclusivement à partir des métadonnées serveur.
 * Avec 24 clients : totalPagesClientsServeur = 3.
 */
mettreAJourPagination = function (total, totalPages) {
    total = Number(total);
    totalPages = Number(totalPages);

    if (!Number.isFinite(total) || total < 0) {
        total = 0;
    }

    if (!Number.isFinite(totalPages) || totalPages < 1) {
        totalPages = Math.max(
            1,
            Math.ceil(total / 10)
        );
    }

    // Sécurité : si le backend donne le total mais pas totalPages correctement.
    const pagesCalculees = Math.max(
        1,
        Math.ceil(total / 10)
    );

    totalPages = Math.max(
        totalPages,
        pagesCalculees
    );

    totalClientsFiltresServeur = total;
    totalPagesClientsServeur = totalPages;

    if (pageClientsCourante > totalPages) {
        pageClientsCourante = totalPages;
    }

    if (pageClientsCourante < 1) {
        pageClientsCourante = 1;
    }

    const zone =
        document.getElementById("clients-page-buttons");

    if (zone) {
        zone.innerHTML = "";

        const pages = [];

        for (let p = 1; p <= totalPages; p++) {
            if (
                p === 1 ||
                p === totalPages ||
                Math.abs(p - pageClientsCourante) <= 1
            ) {
                pages.push(p);
            }
        }

        let precedente = 0;

        pages.forEach(function (p) {
            if (precedente && p - precedente > 1) {
                const dots =
                    document.createElement("span");

                dots.textContent = "…";
                zone.appendChild(dots);
            }

            const bouton =
                document.createElement("button");

            bouton.type = "button";
            bouton.className =
                "pagination-btn" +
                (p === pageClientsCourante ? " active" : "");

            bouton.textContent = String(p);

            bouton.addEventListener(
                "click",
                function () {
                    if (p === pageClientsCourante) {
                        return;
                    }

                    pageClientsCourante = p;

                    chargerClients({
                        forcer: true,
                        silencieux: true
                    });
                }
            );

            zone.appendChild(bouton);
            precedente = p;
        });
    }

    const debut =
        total > 0
            ? ((pageClientsCourante - 1) * 10) + 1
            : 0;

    const fin =
        total > 0
            ? Math.min(
                debut + clientsPageCourante.length - 1,
                total
            )
            : 0;

    const resume =
        document.getElementById(
            "clients-pagination-summary"
        );

    if (resume) {
        resume.textContent =
            `${debut}–${fin} sur ${total}`;
    }

    const precedent =
        document.getElementById("previous-page-btn");

    const suivant =
        document.getElementById("next-page-btn");

    if (precedent) {
        precedent.disabled =
            pageClientsCourante <= 1;
    }

    if (suivant) {
        suivant.disabled =
            pageClientsCourante >= totalPages;
    }
};



// ============================================================
// CACHE RAPIDE — PAGINATION + FILTRES CLIENTS
// ============================================================
// Stratégie hybride :
// - jusqu'à 200 clients : préchargement silencieux de toutes les pages,
//   puis pagination/recherche/filtres/tri instantanés côté navigateur ;
// - au-delà : pagination serveur conservée, avec cache des pages visitées
//   et préchargement de la page suivante/précédente.
//
// La synchronisation serveur toutes les 10 s reste l'autorité :
// lorsqu'une nouvelle signature est détectée, les caches rapides sont vidés.

const CLIENTS_PREFETCH_TOTAL_MAX = 200;

let snapshotClientsComplet_ = null;
let snapshotClientsSignature_ = null;
let prechargementSnapshotClients_ = null;
const cachePagesClientsRapide_ = new Map();

const chargerClientsServeurReference_ = chargerClients;

function viderCachesRapidesClients_() {
    snapshotClientsComplet_ = null;
    snapshotClientsSignature_ = null;
    cachePagesClientsRapide_.clear();
}

function cleEtatClientsRapide_(page = pageClientsCourante) {
    return JSON.stringify({
        page: Number(page) || 1,
        recherche: String(rechercheClients || ""),
        typeClient: String(filtresClients?.typeClient || ""),
        statut: String(filtresClients?.statut || ""),
        commune: String(filtresClients?.commune || ""),
        tri: String(triClients?.cle || ""),
        direction: String(triClients?.direction || "asc"),
        signature: String(signatureSyncClients || "")
    });
}

function enregistrerPageCouranteDansCacheRapide_() {
    cachePagesClientsRapide_.set(
        cleEtatClientsRapide_(pageClientsCourante),
        {
            clients: Array.isArray(clientsCharges)
                ? clientsCharges.slice()
                : [],
            page: pageClientsCourante,
            total: totalClientsFiltresServeur,
            totalPages: totalPagesClientsServeur,
            totalGlobal: totalClientsGlobalServeur,
            kpis: kpisClientsServeur,
            signature: signatureSyncClients
        }
    );
}

function appliquerResultatRapideClients_(resultat) {
    if (!resultat) return false;

    clientsCharges =
        Array.isArray(resultat.clients)
            ? resultat.clients.slice()
            : [];

    clientsAffiches = clientsCharges.slice();

    pageClientsCourante =
        Number(resultat.page) > 0
            ? Number(resultat.page)
            : 1;

    totalClientsFiltresServeur =
        Number(resultat.total) >= 0
            ? Number(resultat.total)
            : clientsCharges.length;

    totalPagesClientsServeur =
        Number(resultat.totalPages) > 0
            ? Number(resultat.totalPages)
            : Math.max(
                1,
                Math.ceil(totalClientsFiltresServeur / 10)
            );

    if (Number(resultat.totalGlobal) >= 0) {
        totalClientsGlobalServeur =
            Number(resultat.totalGlobal);
    }

    if (resultat.kpis) {
        kpisClientsServeur = resultat.kpis;
    }

    if (resultat.signature != null) {
        signatureSyncClients =
            String(resultat.signature);
    }

    clientsCharges.forEach(function(client) {
        if (client?.idClient != null) {
            cacheClientsSelectionnes.set(
                String(client.idClient),
                client
            );
        }
    });

    mettreAJourKPIsClients();
    afficherClients(clientsAffiches);
    mettreAJourCompteurClients(
        totalClientsFiltresServeur
    );
    mettreAJourEtatBoutonEffacer();
    sauvegarderCacheNavigationClients();

    return true;
}

function filtrerEtTrierSnapshotClients_() {
    if (!Array.isArray(snapshotClientsComplet_)) {
        return [];
    }

    const terme =
        normaliserValeurRecherche(
            rechercheClients
        );

    let liste =
        snapshotClientsComplet_.filter(function(client) {

            const correspondRecherche =
                !terme ||
                [
                    client.idClient,
                    client.nom,
                    client.prenom,
                    client.telephone,
                    client.email,
                    client.commune,
                    client.quartier,
                    client.typeClient,
                    client.statut
                ].some(function(valeur) {
                    return normaliserValeurRecherche(valeur)
                        .includes(terme);
                });

            const correspondType =
                !filtresClients.typeClient ||
                normaliserValeurRecherche(client.typeClient) ===
                normaliserValeurRecherche(
                    filtresClients.typeClient
                );

            const correspondStatut =
                !filtresClients.statut ||
                normaliserValeurRecherche(client.statut) ===
                normaliserValeurRecherche(
                    filtresClients.statut
                );

            const correspondCommune =
                !filtresClients.commune ||
                normaliserValeurRecherche(client.commune) ===
                normaliserValeurRecherche(
                    filtresClients.commune
                );

            return (
                correspondRecherche &&
                correspondType &&
                correspondStatut &&
                correspondCommune
            );
        });

    if (triClients?.cle) {
        liste = liste.slice().sort(function(a, b) {
            const valeur =
                comparerClients(
                    a,
                    b,
                    triClients.cle
                );

            return triClients.direction === "desc"
                ? -valeur
                : valeur;
        });
    }

    return liste;
}

function rendreDepuisSnapshotClients_() {
    if (
        !Array.isArray(snapshotClientsComplet_) ||
        snapshotClientsSignature_ !==
            String(signatureSyncClients || "")
    ) {
        return false;
    }

    const liste =
        filtrerEtTrierSnapshotClients_();

    const total = liste.length;
    const totalPages =
        Math.max(
            1,
            Math.ceil(total / 10)
        );

    pageClientsCourante =
        Math.min(
            Math.max(
                1,
                Number(pageClientsCourante) || 1
            ),
            totalPages
        );

    const debut =
        (pageClientsCourante - 1) * 10;

    const page =
        liste.slice(
            debut,
            debut + 10
        );

    appliquerResultatRapideClients_({
        clients: page,
        page: pageClientsCourante,
        total: total,
        totalPages: totalPages,
        totalGlobal: snapshotClientsComplet_.length,
        kpis: kpisClientsServeur,
        signature: signatureSyncClients
    });

    return true;
}

async function recupererPageClientsSilencieuse_(page, options = {}) {
    const resultat =
        await apiGet(
            "getClientsPage",
            {
                page: page,
                limite: 10,
                recherche: options.recherche ?? "",
                typeClient: options.typeClient ?? "",
                statut: options.statut ?? "",
                commune: options.commune ?? "",
                tri: options.tri ?? "",
                direction: options.direction ?? "asc",
                _ts: Date.now()
            }
        );

    if (
        !resultat ||
        resultat.success === false
    ) {
        return null;
    }

    return resultat;
}

async function prechargerSnapshotClientsComplet_() {
    if (
        prechargementSnapshotClients_ ||
        !Number.isFinite(
            Number(totalClientsGlobalServeur)
        ) ||
        Number(totalClientsGlobalServeur) <= 0 ||
        Number(totalClientsGlobalServeur) >
            CLIENTS_PREFETCH_TOTAL_MAX
    ) {
        return prechargementSnapshotClients_;
    }

    const signatureDepart =
        String(signatureSyncClients || "");

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                Number(totalClientsGlobalServeur) / 10
            )
        );

    prechargementSnapshotClients_ =
        (async function() {

            const appels = [];

            for (
                let page = 1;
                page <= totalPages;
                page++
            ) {
                appels.push(
                    recupererPageClientsSilencieuse_(
                        page,
                        {
                            recherche: "",
                            typeClient: "",
                            statut: "",
                            commune: "",
                            tri: "",
                            direction: "asc"
                        }
                    )
                );
            }

            const resultats =
                await Promise.all(appels);

            if (
                String(signatureSyncClients || "") !==
                signatureDepart
            ) {
                return false;
            }

            const parId = new Map();

            resultats.forEach(function(resultat) {
                if (!resultat) return;

                (resultat.clients || [])
                    .forEach(function(client) {
                        if (client?.idClient == null) {
                            return;
                        }

                        parId.set(
                            String(client.idClient),
                            client
                        );
                    });
            });

            if (
                parId.size !==
                Number(totalClientsGlobalServeur)
            ) {
                return false;
            }

            snapshotClientsComplet_ =
                [...parId.values()];

            snapshotClientsSignature_ =
                signatureDepart;

            return true;

        })()
        .catch(function(error) {
            console.warn(
                "Préchargement rapide Clients indisponible :",
                error
            );

            return false;
        })
        .finally(function() {
            prechargementSnapshotClients_ = null;
        });

    return prechargementSnapshotClients_;
}

async function prechargerPagesVoisinesClients_() {
    if (
        Array.isArray(snapshotClientsComplet_) &&
        snapshotClientsSignature_ ===
            String(signatureSyncClients || "")
    ) {
        return;
    }

    const pages = [
        pageClientsCourante - 1,
        pageClientsCourante + 1
    ].filter(function(page) {
        return (
            page >= 1 &&
            page <= totalPagesClientsServeur
        );
    });

    const options = {
        recherche: rechercheClients || "",
        typeClient: filtresClients.typeClient || "",
        statut: filtresClients.statut || "",
        commune: filtresClients.commune || "",
        tri: triClients?.cle || "",
        direction: triClients?.direction || "asc"
    };

    pages.forEach(async function(page) {
        const cle =
            cleEtatClientsRapide_(page);

        if (cachePagesClientsRapide_.has(cle)) {
            return;
        }

        try {
            const resultat =
                await recupererPageClientsSilencieuse_(
                    page,
                    options
                );

            if (!resultat) return;

            cachePagesClientsRapide_.set(
                cle,
                {
                    clients:
                        Array.isArray(resultat.clients)
                            ? resultat.clients.slice()
                            : [],
                    page:
                        Number(resultat.page) || page,
                    total:
                        Number(resultat.total) || 0,
                    totalPages:
                        Number(resultat.totalPages) || 1,
                    totalGlobal:
                        Number(resultat.totalGlobal) || 0,
                    kpis:
                        resultat.kpis || kpisClientsServeur,
                    signature:
                        resultat.signature ||
                        signatureSyncClients
                }
            );

        } catch (error) {
            // Le préchargement est facultatif.
        }
    });
}

/*
 * Nouvelle couche de chargement rapide.
 * Les appels de synchronisation (verifierSync:false) et Actualiser
 * restent toujours des appels serveur frais.
 */
chargerClients = async function(options = {}) {
    const silencieux =
        options?.silencieux === true;

    const verifierSync =
        options?.verifierSync !== false;

    const doitForcerServeur =
        verifierSync === false ||
        silencieux === false;

    if (doitForcerServeur) {
        viderCachesRapidesClients_();

        const resultat =
            await chargerClientsServeurReference_(
                options
            );

        enregistrerPageCouranteDansCacheRapide_();

        prechargerSnapshotClientsComplet_();
        prechargerPagesVoisinesClients_();

        return resultat;
    }

    /*
     * Petit jeu de données : filtres, tri et pagination instantanés.
     */
    if (rendreDepuisSnapshotClients_()) {
        return;
    }

    /*
     * Sinon, utiliser une page déjà visitée/préchargée.
     */
    const cle =
        cleEtatClientsRapide_(
            pageClientsCourante
        );

    const cache =
        cachePagesClientsRapide_.get(cle);

    if (
        cache &&
        String(cache.signature || "") ===
            String(signatureSyncClients || "")
    ) {
        appliquerResultatRapideClients_(cache);
        prechargerPagesVoisinesClients_();
        return;
    }

    /*
     * Premier accès à cette combinaison : serveur.
     */
    const resultat =
        await chargerClientsServeurReference_(
            options
        );

    enregistrerPageCouranteDansCacheRapide_();

    // Dès que la première page est affichée, préparer le reste en arrière-plan.
    prechargerSnapshotClientsComplet_();
    prechargerPagesVoisinesClients_();

    return resultat;
};

/*
 * Filtres/recherche :
 * - si le snapshot complet est prêt => réaction immédiate ;
 * - sinon délai réduit à 40 ms avant le serveur.
 */
programmerChargementClientsServeur = function(delai = 40) {
    if (timerRechercheClientsServeur) {
        window.clearTimeout(
            timerRechercheClientsServeur
        );
    }

    timerRechercheClientsServeur =
        window.setTimeout(function() {
            timerRechercheClientsServeur = null;

            if (rendreDepuisSnapshotClients_()) {
                return;
            }

            chargerClients({
                forcer: true,
                silencieux: true
            });

        }, delai);
};

appliquerRechercheEtFiltresClients = function() {
    pageClientsCourante = 1;
    mettreAJourEtatBoutonEffacer();

    if (rendreDepuisSnapshotClients_()) {
        return;
    }

    programmerChargementClientsServeur(40);
};

/*
 * Lancement du préchargement après l'initialisation.
 * Il est non bloquant et ne déclenche aucun loader.
 */
window.setTimeout(function() {
    enregistrerPageCouranteDansCacheRapide_();
    prechargerSnapshotClientsComplet_();
    prechargerPagesVoisinesClients_();
}, 250);
