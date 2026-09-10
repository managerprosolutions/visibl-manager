/* ===========================================================
   VISIBL ERP — Module Commandes
=========================================================== */

let lignesCommande = [];
let catalogueProduitsCommande = [];
let catalogueLivreursCommande = [];
let catalogueClientsCommande = [];

/*
 * Préparation des libellés au chargement initial.
 * Le tableau Commandes attend ces catalogues avant son premier affichage
 * afin de montrer directement les noms plutôt que les ID.
 */
let chargementClientsCommandePromise = null;
let chargementClientsCommandeCompletPromise = null;
let clientsCommandeCompletsCharges = false;
let chargementProduitsCommandePromise = null;
let chargementLivreursCommandePromise = null;
let commandesChargees = [];
let commandesFiltrees = [];
let commandeEnModificationId = null;
let pageCommandesActuelle = 1;
let taillePageCommandes = 10;

// Pagination serveur Commandes : aucune donnée métier dans localStorage.
const pagesCommandesServeur = new Map();
let totalCommandesServeur = 0;
let totalPagesCommandesServeur = 1;
let prechargementCommandesPromise = null;
let generationChargementCommandes = 0;


// Cache de navigation Commandes, limité à l'onglet courant.
// Évite de retélécharger les pages déjà chargées lorsqu'on quitte Commandes
// puis qu'on y revient. La synchronisation serveur reste la source de vérité.
const COMMANDES_NAV_CACHE_KEY = "visibl:commandes:nav-cache:v3-source-serveur";
const COMMANDES_NAV_CACHE_SCHEMA = 3;
try { sessionStorage.removeItem("visibl:commandes:nav-cache:v2-10lignes"); } catch (error) {}

function sauvegarderCacheNavigationCommandes() {
    try {
        if (!pagesCommandesServeur.size) return;

        sessionStorage.setItem(
            COMMANDES_NAV_CACHE_KEY,
            JSON.stringify({
                schema: COMMANDES_NAV_CACHE_SCHEMA,
                pages: Array.from(pagesCommandesServeur.entries()),
                total: totalCommandesServeur,
                totalPages: totalPagesCommandesServeur,
                pageActuelle: pageCommandesActuelle,
                // Conserve aussi les correspondances ID -> noms pour qu’un retour
                // sur Commandes puisse être rendu immédiatement, sans flash d’ID
                // et sans attendre un nouvel appel réseau.
                clients: catalogueClientsCommande,
                livreurs: catalogueLivreursCommande,
                savedAt: Date.now()
            })
        );
    } catch (error) {
        console.warn("Cache navigation Commandes indisponible :", error);
    }
}

function restaurerCacheNavigationCommandes() {
    try {
        const brut = sessionStorage.getItem(COMMANDES_NAV_CACHE_KEY);
        if (!brut) return false;

        const cache = JSON.parse(brut);

        if (Number(cache?.schema) !== COMMANDES_NAV_CACHE_SCHEMA) {
            sessionStorage.removeItem(COMMANDES_NAV_CACHE_KEY);
            return false;
        }

        if (!Array.isArray(cache?.pages) || !cache.pages.length) return false;

        const pages = new Map(cache.pages);
        if (!pages.has(1)) return false;

        // Un ancien cache qui ne contient pas encore les catalogues de noms
        // n’est pas restauré : on effectue alors un vrai chargement initial.
        // Après ce premier chargement, les catalogues sont sauvegardés avec le
        // tableau et les retours suivants sont instantanés.
        if (!Array.isArray(cache.clients) || !Array.isArray(cache.livreurs)) {
            return false;
        }

        catalogueClientsCommande = cache.clients;
        catalogueLivreursCommande = cache.livreurs;

        pagesCommandesServeur.clear();
        pages.forEach((valeur, cle) => {
            pagesCommandesServeur.set(Number(cle), valeur);
        });

        totalCommandesServeur = Math.max(0, Number(cache.total) || 0);
        totalPagesCommandesServeur = Math.max(
            1,
            Number(cache.totalPages) ||
                Math.ceil(totalCommandesServeur / taillePageCommandes) ||
                1
        );
        pageCommandesActuelle = Math.max(
            1,
            Math.min(Number(cache.pageActuelle) || 1, totalPagesCommandesServeur)
        );

        reconstruireCommandesDepuisPagesServeur();
        actualiserFiltreCommunesCommandes();

        const page1 = pagesCommandesServeur.get(1);
        if (page1?.kpi) {
            afficherKPICommandesServeur(page1.kpi);
        } else {
            const totalKpi = document.getElementById("total-orders-value");
            if (totalKpi) {
                totalKpi.textContent = String(totalCommandesServeur);
                totalKpi.classList.remove("is-loading");
            }
        }

        afficherTableauCommandes();
        return true;
    } catch (error) {
        console.warn("Restauration cache navigation Commandes impossible :", error);
        return false;
    }
}

/*
 * Synchronisation légère multi-appareils.
 * Vérifie les nouveautés sans recharger toute la page.
 */
const INTERVALLE_SYNC_COMMANDES_MS = 10000;
let timerSyncCommandes = null;
let syncCommandesEnCours = false;
let reservationCommandeEnModification = new Map();
let ligneCommandeEnModificationId = null;
let creditDisponibleClientCommande = 0;
let modeSelectionCommandes = false;
let autoriserCommandeStockInsuffisant = false;
let parametresFinanceCommande = {
    formatMontant: "nombre-devise",
    nombreDecimales: 0,
    libelleDevise: "FCFA",
    modeEspeces: true,
    modeMobileMoney: true,
    modeVirement: true,
    modeCheque: true,
    modeCarteBancaire: true,
    autoriserPaiementsPartiels: true,
    autoriserVentesCredit: true
};
const commandesSelectionnees = new Set();

/* ===========================================================
   LOADER GLOBAL VISIBL — COMMANDES
   Utilise visibl-loading.css + visibl-loading.js.
   Aucun changement de mise en page : le loader remplace
   temporairement les valeurs KPI et les lignes du tableau.
=========================================================== */

function preparerLoaderCommandes() {
    const zonePage = document.querySelector(".content");

    if (zonePage) {
        zonePage.setAttribute("data-visibl-page", "");
        zonePage.classList.add("visibl-loading-scope");

        const ancre =
            zonePage.querySelector(".welcome-section");

        if (ancre) {
            ancre.setAttribute("data-loading-anchor", "");
        }
    }

    [
        "total-orders-value",
        "orders-revenue-value",
        "pending-orders-value",
        "completed-orders-value"
    ].forEach(id => {
        document
            .getElementById(id)
            ?.setAttribute("data-kpi-value", "");
    });

    document
        .getElementById("orders-table-body")
        ?.setAttribute("data-loading-table-body", "");
}


function demarrerLoaderCommandes(
    message = "Chargement des commandes…"
) {
    preparerLoaderCommandes();

    if (
        window.VisiblLoading &&
        typeof window.VisiblLoading.start === "function"
    ) {
        window.VisiblLoading.start({
            scope: ".content",
            tableBody: "#orders-table-body",
            rows: taillePageCommandes,
            message: message
        });
    }
}


function terminerLoaderCommandes() {
    if (
        window.VisiblLoading &&
        typeof window.VisiblLoading.stop === "function"
    ) {
        window.VisiblLoading.stop({
            scope: ".content",
            tableBody: "#orders-table-body"
        });
    }
}


document.addEventListener("DOMContentLoaded", () => {
    if (
        typeof requireAuth === "function" &&
        !requireAuth()
    ) {
        return;
    }

    chargerParametresStockCommande();
    chargerParametresFinanceCommande();
    initialiserModaleCommande();
    initialiserDateHeureCommande();
    initialiserGestionClientsCommande();
    initialiserProduitsCommande();
    initialiserLivreursCommande();
    initialiserModeReceptionCommande();
    initialiserCalculsCommande();
    initialiserPaiementCommande();
    initialiserEnregistrementCommande();
    initialiserListeCommandes();
    initialiserSynchronisationCommandes();
    initialiserInteractionsHeaderCommande();
    initialiserSelectionCommandes();
    initialiserMenuActionsCommandes();
    initialiserVenteLieeCommande();
});


async function chargerParametresStockCommande() {
    try {
        const resultat = await apiGet("getParametresStock");
        autoriserCommandeStockInsuffisant = resultat?.success === true && resultat?.data?.autoriserCommandeStockInsuffisant === true;
    } catch (error) {
        console.warn("Paramètres stock indisponibles dans Commandes :", error);
        autoriserCommandeStockInsuffisant = false;
    }
}


function initialiserModaleCommande() {
    const boutonsOuvrir = [
        document.getElementById("new-order-btn"),
        document.getElementById("new-order-toolbar-btn")
    ].filter(Boolean);

    const modale = document.getElementById("order-modal");
    const boutonFermer = document.getElementById("close-order-modal");
    const boutonAnnuler = document.getElementById("cancel-order-btn");

    if (!modale) {
        console.error("La modale #order-modal est introuvable.");
        return;
    }

    const ouvrir = () => {
        if (!commandeEnModificationId) {
            reinitialiserFormulaireCommande();
        }

        initialiserDateHeureCommande();

        /*
         * Actualise le stock avant chaque nouvelle commande.
         */
        chargerProduitsCommande();

        /*
         * Actualise aussi la liste des livreurs actifs.
         * Le filtrage visible dépendra de la commune choisie.
         */
        chargerLivreursCommande();

        // Les crédits/avoirs viennent de getClients() complet. On le charge
        // en arrière-plan pour préserver toute la logique métier du formulaire.
        chargerClientsCommandeCompletsEnArrierePlan();

        modale.classList.add("active");
        modale.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    };

    const fermer = () => {
        fermerModaleCommande();
    };

    boutonsOuvrir.forEach(bouton => bouton.addEventListener("click", ouvrir));
    boutonFermer?.addEventListener("click", fermer);
    boutonAnnuler?.addEventListener("click", fermer);

    /*
     * La modale ne se ferme plus sur un clic extérieur.
     * Fermeture volontaire uniquement via la croix ou le bouton Annuler.
     */

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modale.classList.contains("active")) {
            fermer();
        }
    });
}


function initialiserDateHeureCommande() {
    const maintenant = new Date();
    const date = [
        maintenant.getFullYear(),
        String(maintenant.getMonth() + 1).padStart(2, "0"),
        String(maintenant.getDate()).padStart(2, "0")
    ].join("-");

    const heure = [
        String(maintenant.getHours()).padStart(2, "0"),
        String(maintenant.getMinutes()).padStart(2, "0")
    ].join(":");

    const champDate = document.getElementById("order-date");
    const champHeure = document.getElementById("order-time");

    if (champDate) champDate.value = date;
    if (champHeure) champHeure.value = heure;
}


function initialiserGestionClientsCommande() {
    document
        .getElementById("open-new-client-modal-btn")
        ?.addEventListener("click", ouvrirModaleClientRapide);

    document
        .getElementById("order-client")
        ?.addEventListener(
            "change",
            actualiserCreditClientCommande
        );

    document
        .getElementById("use-max-credit-btn")
        ?.addEventListener(
            "click",
            () => {
                const total =
                    convertirNombre(
                        document.getElementById(
                            "order-total-payable"
                        )?.value
                    );

                const maximum =
                    Math.max(
                        0,
                        Math.min(
                            creditDisponibleClientCommande,
                            total
                        )
                    );

                definirValeurCommande(
                    "order-credit-used",
                    maximum
                );

                recalculerPaiementCommande();
            }
        );

    document
    .getElementById("refresh-order-clients-btn")
    ?.addEventListener("click", () => {
        chargerClientsCommande();
    });

    document
        .getElementById("close-quick-client-modal")
        ?.addEventListener("click", fermerModaleClientRapide);

    document
        .getElementById("cancel-quick-client-btn")
        ?.addEventListener("click", fermerModaleClientRapide);

    document
        .getElementById("quick-client-modal")
        ?.addEventListener("click", event => {
            if (event.target.id === "quick-client-modal") {
                fermerModaleClientRapide();
            }
        });

    document
        .getElementById("quick-client-form")
        ?.addEventListener("submit", enregistrerClientRapide);

    chargementClientsCommandePromise = chargerClientsCommande();
}



function ouvrirModaleClientRapide() {
    const modale = document.getElementById("quick-client-modal");
    const formulaire = document.getElementById("quick-client-form");

    if (!modale) {
        return;
    }

    formulaire?.reset();

    const statut = document.getElementById("quick-client-status");
    if (statut) {
        statut.value = "actif";
    }

    masquerMessageClientRapide();

    modale.classList.add("active");
    modale.setAttribute("aria-hidden", "false");

    setTimeout(() => {
        document.getElementById("quick-client-lastname")?.focus();
    }, 100);
}


function fermerModaleClientRapide() {
    const modale = document.getElementById("quick-client-modal");

    if (!modale) {
        return;
    }

    modale.classList.remove("active");
    modale.setAttribute("aria-hidden", "true");
    masquerMessageClientRapide();
}


async function enregistrerClientRapide(event) {
    event.preventDefault();

    const formulaire = document.getElementById("quick-client-form");
    const bouton = document.getElementById("save-quick-client-btn");

    if (!formulaire) {
        return;
    }

    if (!formulaire.checkValidity()) {
        formulaire.reportValidity();
        return;
    }

    const client = {
        typeClient: obtenirValeurCommande("quick-client-type"),
        statut: obtenirValeurCommande("quick-client-status") || "actif",
        nom: obtenirValeurCommande("quick-client-lastname"),
        prenom: obtenirValeurCommande("quick-client-firstname"),
        telephone: obtenirValeurCommande("quick-client-phone"),
        email: obtenirValeurCommande("quick-client-email"),
        commune: obtenirValeurCommande("quick-client-commune"),
        quartier: obtenirValeurCommande("quick-client-neighborhood"),
        commentaire: obtenirValeurCommande("quick-client-comment")
    };

    try {
        if (bouton) {
            bouton.disabled = true;
            bouton.textContent = "Enregistrement...";
        }

        afficherMessageClientRapide(
            "Enregistrement du client...",
            "info"
        );

        const resultat =
            await apiPost("createClient", client);

       console.log("Réponse createClient :", resultat);

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le client."
            );
        }

        const clientCree = resultat.data || {};

        const idClient = String(
            clientCree["ID Client"] ||
            clientCree.idClient ||
            ""
        ).trim();

        const nomClient =
            obtenirNomClient(clientCree) ||
            [client.nom, client.prenom]
                .filter(Boolean)
                .join(" ")
                .trim() ||
            idClient;

        /*
           Recharge la liste depuis Google Sheets pour que le nouveau
           client fasse immédiatement partie des données officielles.
        */
        ajouterClientDansListeCommande(
            idClient,
            nomClient
        );

        fermerModaleClientRapide();

        afficherMessageCommande(
            `Client ${nomClient} enregistré et sélectionné.`,
            "success"
        );

        chargerClientsCommande(
            idClient,
            nomClient
        ).catch(error => {
            console.warn(
                "Actualisation différée des clients impossible :",
                error
            );
        });

    } catch (error) {
        console.error(
            "Erreur d'enregistrement rapide du client :",
            error
        );

        afficherMessageClientRapide(
            error.message ||
            "Une erreur est survenue.",
            "error"
        );

    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.textContent = "Enregistrer le client";
        }
    }
}


function obtenirValeurCommande(id) {
    const champ = document.getElementById(id);

    return champ
        ? String(champ.value || "").trim()
        : "";
}


function afficherMessageClientRapide(
    message,
    type = "info"
) {
    const zone =
        document.getElementById(
            "quick-client-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent = message;
    zone.className = "form-message " + type;
    zone.style.display = "block";
}


function masquerMessageClientRapide() {
    const zone =
        document.getElementById(
            "quick-client-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent = "";
    zone.className = "form-message";
    zone.style.display = "none";
}


function ajouterClientDansListeCommande(
    idClient,
    nomClient
) {
    const select =
        document.getElementById("order-client");

    const id =
        String(idClient || "").trim();

    const nom =
        String(nomClient || id).trim();

    if (!select || !id) {
        return;
    }

    let option = Array
        .from(select.options)
        .find(element => element.value === id);

    if (!option) {
        option =
            document.createElement("option");

        option.value = id;
        select.appendChild(option);
    }

    option.textContent = nom;
    select.value = id;
}


async function chargerClientsCommande(idASelectionner = "", libelleSecours = "") {
    const select = document.getElementById("order-client");
    if (!select || typeof apiGet !== "function") return;

    const valeurActuelle = String(idASelectionner || select.value || "").trim();
    select.disabled = true;
    select.innerHTML = '<option value="">Chargement des clients...</option>';

    try {
        // OPT4 : au chargement initial de Commandes, on demande uniquement
        // les informations nécessaires à l'affichage des noms. Les statistiques
        // lourdes de getClients() ne bloquent plus les 20 premières lignes.
        const resultat = await apiGet("getClientsLegersCommandes", { _ts: Date.now() });
        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible de charger les clients.");
        }

        /*
           Accepte les différents formats possibles renvoyés par l'API :
           - { success: true, data: [...] }
           - { success: true, data: { clients: [...] } }
           - { success: true, clients: [...] }
        */
        const clients = Array.isArray(resultat.data)
            ? resultat.data
            : Array.isArray(resultat.data?.clients)
                ? resultat.data.clients
                : Array.isArray(resultat.clients)
                    ? resultat.clients
                    : [];

        catalogueClientsCommande = clients;

        select.innerHTML = '<option value="">Sélectionner un client</option>';

        clients
            .filter(client => {
                const statut = String(
                    lireValeurClientCommande(
                        client,
                        ["Statut", "statut"]
                    ) || ""
                )
                    .trim()
                    .toLowerCase();

                return (
                    !statut ||
                    statut === "actif" ||
                    statut === "prospect"
                );
            })
            .sort((a, b) =>
                obtenirNomClient(a).localeCompare(
                    obtenirNomClient(b),
                    "fr",
                    { sensitivity: "base" }
                )
            )
            .forEach(client => {
                const id = String(
                    lireValeurClientCommande(
                        client,
                        [
                            "ID Client",
                            "idClient",
                            "Identifiant",
                            "identifiant"
                        ]
                    ) || ""
                ).trim();

                if (!id) {
                    console.warn(
                        "Client ignoré car aucun identifiant reconnu :",
                        client
                    );
                    return;
                }

                const option = document.createElement("option");
                option.value = id;
                option.textContent =
                    obtenirNomClient(client) || id;

                select.appendChild(option);
            });

        console.log(
            `${clients.length} client(s) reçus, ${select.options.length - 1} affiché(s) dans la liste.`
        );

        if (
            valeurActuelle &&
            !Array.from(select.options).some(
                option => option.value === valeurActuelle
            )
        ) {
            const option = document.createElement("option");
            option.value = valeurActuelle;
            option.textContent = libelleSecours || valeurActuelle;
            select.appendChild(option);
        }

        select.value = valeurActuelle;

        actualiserCreditClientCommande();

        /*
         * Les commandes et les clients peuvent finir de charger
         * dans un ordre différent au démarrage.
         * Dès que le catalogue clients est disponible,
         * on réaffiche le tableau pour remplacer les ID clients
         * par leurs noms sans toucher aux données enregistrées.
         */
        if (
            Array.isArray(commandesChargees) &&
            commandesChargees.length
        ) {
            appliquerFiltresCommandes(true);
        }

    } catch (error) {
        console.error("Erreur de chargement des clients :", error);
        select.innerHTML = '<option value="">Impossible de charger les clients</option>';
    } finally {
        select.disabled = false;
    }
}


function obtenirNomClient(client) {
    const nom = lireValeurClientCommande(
        client,
        ["Nom", "nom", "Nom Client", "nomClient"]
    );

    const prenom = lireValeurClientCommande(
        client,
        ["Prénom", "Prenom", "prenom", "Prénom Client"]
    );

    const raisonSociale = lireValeurClientCommande(
        client,
        [
            "Raison Sociale",
            "raisonSociale",
            "Nom Entreprise",
            "nomEntreprise"
        ]
    );

    return (
        [nom, prenom]
            .map(valeur => String(valeur || "").trim())
            .filter(Boolean)
            .join(" ")
        ||
        String(raisonSociale || "").trim()
    );
}


function lireValeurClientCommande(client, cles) {
    if (!client || !Array.isArray(cles)) {
        return "";
    }

    for (const cle of cles) {
        if (
            Object.prototype.hasOwnProperty.call(client, cle) &&
            client[cle] !== null &&
            client[cle] !== undefined &&
            client[cle] !== ""
        ) {
            return client[cle];
        }
    }

    return "";
}





/* ===========================================================
   CLIENTS COMPLETS — CHARGEMENT DIFFÉRÉ POUR LA MODALE
   Le premier tableau n'attend pas cet appel. Il conserve cependant
   toutes les données métier (crédit/avoir) dès que l'utilisateur
   travaille dans le formulaire de commande.
=========================================================== */
async function chargerClientsCommandeCompletsEnArrierePlan() {
    if (clientsCommandeCompletsCharges) return catalogueClientsCommande;
    if (chargementClientsCommandeCompletPromise) {
        return chargementClientsCommandeCompletPromise;
    }

    chargementClientsCommandeCompletPromise = (async () => {
        try {
            const resultat = await apiGet("getClients", { _ts: Date.now() });
            if (!resultat?.success) {
                throw new Error(resultat?.message || "Impossible de charger les données complètes des clients.");
            }

            const clients = Array.isArray(resultat.data)
                ? resultat.data
                : Array.isArray(resultat.data?.clients)
                    ? resultat.data.clients
                    : Array.isArray(resultat.clients)
                        ? resultat.clients
                        : [];

            catalogueClientsCommande = clients;
            clientsCommandeCompletsCharges = true;

            // Met à jour les informations de crédit/avoir si un client est déjà sélectionné.
            actualiserCreditClientCommande();
            sauvegarderCacheNavigationCommandes();
            return clients;
        } catch (error) {
            console.warn("Chargement différé des clients complets indisponible :", error);
            return catalogueClientsCommande;
        } finally {
            chargementClientsCommandeCompletPromise = null;
        }
    })();

    return chargementClientsCommandeCompletPromise;
}

function planifierClientsCommandeComplets() {
    const lancer = () => {
        chargerClientsCommandeCompletsEnArrierePlan();
    };

    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(lancer, { timeout: 1500 });
    } else {
        setTimeout(lancer, 250);
    }
}


/* ===========================================================
   CRÉDIT CLIENT / AVOIRS
=========================================================== */

function obtenirClientCommandeSelectionne() {
    const idClient =
        obtenirValeurCommande(
            "order-client"
        );

    if (!idClient) {
        return null;
    }

    return (
        catalogueClientsCommande.find(
            client =>
                String(
                    lireValeurClientCommande(
                        client,
                        [
                            "ID Client",
                            "idClient"
                        ]
                    ) || ""
                ).trim() ===
                String(idClient).trim()
        ) ||
        null
    );
}


function obtenirAvoirDejaReserveCommande() {
    if (!commandeEnModificationId) {
        return 0;
    }

    const commande =
        commandesChargees.find(
            element =>
                String(
                    element.idCommande
                ) ===
                String(
                    commandeEnModificationId
                )
        );

    if (!commande) {
        return 0;
    }

    const idClientSelectionne =
        obtenirValeurCommande(
            "order-client"
        );

    if (
        String(
            commande.idClient ||
            ""
        ).trim() !==
        String(
            idClientSelectionne ||
            ""
        ).trim()
    ) {
        return 0;
    }

    return Math.max(
        0,
        convertirNombre(
            commande.montantAvoirUtilise
        )
    );
}


function actualiserCreditClientCommande() {
    const client =
        obtenirClientCommandeSelectionne();

    const panel =
        document.getElementById(
            "order-credit-panel"
        );

    const zeroNote =
        document.getElementById(
            "order-credit-zero-note"
        );

    const champ =
        document.getElementById(
            "order-credit-used"
        );

    if (!client) {
        creditDisponibleClientCommande = 0;

        panel?.classList.remove(
            "is-visible"
        );

        zeroNote?.classList.remove(
            "is-visible"
        );

        if (champ) {
            champ.value = 0;
            champ.max = "0";
        }

        recalculerPaiementCommande();
        return;
    }

    const creditLibre =
        Math.max(
            0,
            convertirNombre(
                lireValeurClientCommande(
                    client,
                    [
                        "creditClient",
                        "soldeAvoir",
                        "Crédit client",
                        "Credit client"
                    ]
                )
            )
        );

    /*
     * En modification, le crédit déjà réservé par cette commande
     * a déjà été retiré du solde libre du client. On le rajoute
     * uniquement pour permettre de conserver ou diminuer ce choix.
     */
    creditDisponibleClientCommande =
        creditLibre +
        obtenirAvoirDejaReserveCommande();

    const total =
        convertirNombre(
            document.getElementById(
                "order-total-payable"
            )?.value
        );

    const maximum =
        Math.max(
            0,
            Math.min(
                creditDisponibleClientCommande,
                total || creditDisponibleClientCommande
            )
        );

    if (champ) {
        champ.max =
            String(
                Math.max(
                    0,
                    maximum
                )
            );

        let utilise =
            convertirNombre(
                champ.value
            );

        utilise =
            Math.max(
                0,
                Math.min(
                    utilise,
                    maximum
                )
            );

        champ.value =
            utilise;
    }

    const display =
        document.getElementById(
            "order-credit-available-display"
        );

    if (display) {
        display.textContent =
            formaterFCFA(
                creditDisponibleClientCommande
            );
    }

    const disponible =
        creditDisponibleClientCommande >
        0;

    panel?.classList.toggle(
        "is-visible",
        disponible
    );

    zeroNote?.classList.toggle(
        "is-visible",
        !disponible
    );

    recalculerPaiementCommande();
}



/* ===========================================================
   LOADER SOFT — ENREGISTREMENT / MODIFICATION COMMANDE
   Le même emplacement affiche ensuite la confirmation de succès.
=========================================================== */

function obtenirLoaderEnregistrementCommande() {
    const formulaire =
        document.getElementById("order-form");

    if (!formulaire) {
        return null;
    }

    let loader =
        formulaire.querySelector(
            ".order-save-soft-loader"
        );

    if (loader) {
        return loader;
    }

    loader =
        document.createElement("div");

    loader.className =
        "order-save-soft-loader";

    loader.setAttribute(
        "aria-hidden",
        "true"
    );

    loader.innerHTML = `
        <div
            class="order-save-soft-loader-card"
            role="status"
            aria-live="polite"
        >
            <div class="order-save-loading-view">
                <span
                    class="order-save-soft-spinner"
                    aria-hidden="true"
                ></span>

                <div class="order-save-soft-loader-copy">
                    <strong class="order-save-soft-loader-title">
                        Enregistrement de la commande…
                    </strong>
                    <span class="order-save-soft-loader-text">
                        Quelques secondes, s’il vous plaît.
                    </span>
                </div>
            </div>

            <div
                class="order-save-success-view"
                aria-hidden="true"
            >
                <div
                    class="order-save-success-icon"
                    aria-hidden="true"
                >
                    ✓
                </div>

                <div
                    class="order-save-success-confetti"
                    aria-hidden="true"
                >
                    <span>◆</span>
                    <span>●</span>
                    <span>◆</span>
                    <span>●</span>
                    <span>◆</span>
                    <span>●</span>
                </div>

                <strong class="order-save-success-title">
                    Commande enregistrée !
                </strong>

                <span class="order-save-success-text">
                    La commande a été enregistrée avec succès.
                </span>

                <div
                    class="order-save-success-reference"
                    hidden
                >
                    <span class="order-save-success-reference-label">
                        N° de commande
                    </span>
                    <strong class="order-save-success-reference-value"></strong>
                </div>

                <button
                    type="button"
                    class="order-save-success-btn"
                >
                    ✓ Parfait !
                </button>
            </div>
        </div>
    `;

    formulaire.appendChild(loader);

    return loader;
}


function demarrerLoaderEnregistrementCommande(
    modification = false
) {
    const loader =
        obtenirLoaderEnregistrementCommande();

    if (!loader) {
        return;
    }

    loader.classList.remove("is-success");

    const loadingView =
        loader.querySelector(
            ".order-save-loading-view"
        );

    const successView =
        loader.querySelector(
            ".order-save-success-view"
        );

    loadingView?.removeAttribute("aria-hidden");
    successView?.setAttribute("aria-hidden", "true");

    const titre =
        loader.querySelector(
            ".order-save-soft-loader-title"
        );

    if (titre) {
        titre.textContent =
            modification
                ? "Modification de la commande…"
                : "Enregistrement de la commande…";
    }

    loader.classList.add("is-visible");
    loader.setAttribute(
        "aria-hidden",
        "false"
    );
}


function afficherSuccesEnregistrementCommande(
    commande,
    modification = false
) {
    return new Promise(resolve => {
        const loader =
            obtenirLoaderEnregistrementCommande();

        if (!loader) {
            resolve();
            return;
        }

        const loadingView =
            loader.querySelector(
                ".order-save-loading-view"
            );

        const successView =
            loader.querySelector(
                ".order-save-success-view"
            );

        const titre =
            loader.querySelector(
                ".order-save-success-title"
            );

        const texte =
            loader.querySelector(
                ".order-save-success-text"
            );

        const blocReference =
            loader.querySelector(
                ".order-save-success-reference"
            );

        const valeurReference =
            loader.querySelector(
                ".order-save-success-reference-value"
            );

        const bouton =
            loader.querySelector(
                ".order-save-success-btn"
            );

        loadingView?.setAttribute(
            "aria-hidden",
            "true"
        );

        successView?.removeAttribute(
            "aria-hidden"
        );

        if (titre) {
            titre.textContent =
                modification
                    ? "Commande modifiée !"
                    : "Commande enregistrée !";
        }

        if (texte) {
            texte.textContent =
                modification
                    ? "Les modifications ont été enregistrées avec succès."
                    : "La commande a été enregistrée avec succès.";
        }

        const numeroCommande =
            String(
                commande?.numeroCommande ||
                commande?.["Numéro Commande"] ||
                commande?.idCommande ||
                ""
            ).trim();

        if (
            blocReference &&
            valeurReference &&
            numeroCommande
        ) {
            valeurReference.textContent =
                numeroCommande;

            blocReference.hidden = false;
        } else if (blocReference) {
            blocReference.hidden = true;
        }

        loader.classList.add(
            "is-success"
        );

        const terminer = () => {
            if (bouton) {
                bouton.removeEventListener(
                    "click",
                    terminer
                );
            }

            resolve();
        };

        if (bouton) {
            bouton.addEventListener(
                "click",
                terminer,
                { once: true }
            );

            setTimeout(() => {
                bouton.focus();
            }, 80);
        } else {
            resolve();
        }
    });
}


function terminerLoaderEnregistrementCommande() {
    const loader =
        document
            .getElementById("order-form")
            ?.querySelector(
                ".order-save-soft-loader"
            );

    if (!loader) {
        return;
    }

    loader.classList.remove(
        "is-visible",
        "is-success"
    );

    loader.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* ===========================================================
   ENREGISTREMENT ET LISTE DES COMMANDES
=========================================================== */

function initialiserEnregistrementCommande() {
    document
        .getElementById("order-form")
        ?.addEventListener(
            "submit",
            enregistrerCommande
        );
}


function initialiserListeCommandes() {
    document
        .getElementById("orders-header-search-input")
        ?.addEventListener(
            "input",
            appliquerFiltresCommandes
        );

    [
        "order-status-filter",
        "order-payment-status-filter",
        "order-commune-filter"
    ].forEach(id => {
        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                appliquerFiltresCommandes
            );
    });

    document
        .getElementById("reset-order-filters")
        ?.addEventListener(
            "click",
            reinitialiserFiltresCommandes
        );

    document
        .getElementById("refresh-orders-btn")
        ?.addEventListener(
            "click",
            chargerCommandes
        );

    document
        .getElementById("export-orders-btn")
        ?.addEventListener(
            "click",
            exporterCommandesFiltreesCSV
        );

    document
        .getElementById("previous-order-page-btn")
        ?.addEventListener(
            "click",
            () => {
                if (pageCommandesActuelle > 1) {
                    allerPageCommandes(pageCommandesActuelle - 1);
                }
            }
        );

    document
        .getElementById("next-order-page-btn")
        ?.addEventListener(
            "click",
            () => {
                if (pageCommandesActuelle < totalPagesCommandesServeur) {
                    allerPageCommandes(pageCommandesActuelle + 1);
                }
            }
        );

    document
        .getElementById("orders-table-body")
        ?.addEventListener(
            "click",
            gererActionsTableauCommandes
        );

    document
        .getElementById("close-view-order-modal")
        ?.addEventListener(
            "click",
            fermerModaleVoirCommande
        );

    document
        .getElementById("close-view-order-footer")
        ?.addEventListener(
            "click",
            fermerModaleVoirCommande
        );

    document
        .getElementById("view-order-modal")
        ?.addEventListener(
            "click",
            event => {
                if (
                    event.target.id ===
                    "view-order-modal"
                ) {
                    fermerModaleVoirCommande();
                }
            }
        );

    document
        .getElementById("print-orders-btn")
        ?.addEventListener(
            "click",
            () => window.print()
        );

    chargerCommandes();
}


async function enregistrerCommande(event) {
    event.preventDefault();

    const formulaire =
        document.getElementById("order-form");

    const bouton =
        document.getElementById("save-order-btn");

    if (!formulaire) {
        return;
    }

    if (
        formulaire.dataset.processing ===
        "true"
    ) {
        return;
    }

    if (!formulaire.checkValidity()) {
        formulaire.reportValidity();
        return;
    }

    if (!lignesCommande.length) {
        afficherMessageCommande(
            "Ajoutez au moins un produit à la commande.",
            "error"
        );
        return;
    }

    formulaire.dataset.processing = "true";

    const utilisateur =
        typeof getCurrentUser === "function"
            ? getCurrentUser()
            : null;

    const donnees = {
        idCommande:
            commandeEnModificationId || "",

        idClient:
            obtenirValeurCommande("order-client"),

        dateCommande:
            obtenirValeurCommande("order-date"),

        heureCommande:
            obtenirValeurCommande("order-time"),

        /*
         * Champ transmis uniquement pour compatibilité.
         * Le backend reste autoritaire sur le statut métier.
         */
        statut:
            obtenirValeurCommande("order-status") ||
            "en-attente",

        totalCommande:
            convertirNombre(
                obtenirValeurCommande("order-total")
            ),

        remiseTotale:
            convertirNombre(
                obtenirValeurCommande("order-discount")
            ),

        fraisLivraison:
            convertirNombre(
                obtenirValeurCommande("order-delivery-fees")
            ),

        totalAPayer:
            convertirNombre(
                obtenirValeurCommande("order-total-payable")
            ),

        modeReception:
            obtenirValeurCommande("order-reception-mode") ||
            "livraison",

        idLivreur:
            obtenirValeurCommande("order-delivery-person"),

        zoneLivraison:
            obtenirValeurCommande("order-delivery-zone"),

        communeLivraison:
            obtenirValeurCommande("order-delivery-commune"),

        adresseLivraison:
            obtenirValeurCommande("order-delivery-address"),

        dateLivraisonPrevue:
            obtenirValeurCommande("order-delivery-date"),

        modePaiementPrevu:
            obtenirValeurCommande("order-payment-method"),

        modePaiement:
            obtenirValeurCommande("order-payment-method-real") ||
            obtenirValeurCommande("order-payment-method"),

        montantPaye:
            convertirNombre(
                obtenirValeurCommande("order-paid-amount")
            ),

        montantAvoirUtilise:
            convertirNombre(
                obtenirValeurCommande("order-credit-used")
            ),

        origine:
            obtenirValeurCommande("order-origin") ||
            "Commande",

        origineCommande:
            obtenirValeurCommande("order-origin") ||
            "Commande",

        idVente:
            obtenirValeurCommande("order-sale-id"),

        commentaire:
            obtenirValeurCommande("order-comment"),

        idUtilisateur:
            String(
                utilisateur?.idUtilisateur ||
                utilisateur?.["ID Utilisateur"] ||
                utilisateur?.id ||
                ""
            ).trim(),

        lignes:
            lignesCommande.map(
                ligne => ({
                    idProduit: ligne.idProduit,
                    quantite: ligne.quantite,
                    prixUnitaire: ligne.prixUnitaire,
                    remise: ligne.remise,
                    sousTotal: ligne.sousTotal
                })
            )
    };

    if (!validerReglesFinanceCommandeFront(donnees)) {
        return;
    }

    try {
        demarrerLoaderEnregistrementCommande(
            Boolean(commandeEnModificationId)
        );

        if (bouton) {
            bouton.disabled = true;
            bouton.textContent =
                commandeEnModificationId
                    ? "Modification..."
                    : "Enregistrement...";
        }

        afficherMessageCommande(
            commandeEnModificationId
                ? "Modification de la commande..."
                : "Enregistrement de la commande...",
            "info"
        );

        const action =
            commandeEnModificationId
                ? "updateCommande"
                : "createCommande";

        const debutEnregistrementNavigateur = performance.now();

        const resultat =
            await apiPost(
                action,
                donnees
            );

        const tempsEnregistrementNavigateur =
            Math.round(
                performance.now() -
                debutEnregistrementNavigateur
            );

        console.group(
            commandeEnModificationId
                ? "VISIBL — DIAGNOSTIC MODIFICATION COMMANDE"
                : "VISIBL — DIAGNOSTIC CRÉATION COMMANDE"
        );
        console.log(
            "Temps navigateur apiPost :",
            tempsEnregistrementNavigateur,
            "ms"
        );
        console.log(
            "Diagnostic backend Commandes :",
            resultat?.diagnosticTemps || null
        );
        console.log(
            "Diagnostic doPost global :",
            resultat?.diagnosticDoPost || null
        );
        if (
            resultat?.diagnosticDoPost &&
            Number(resultat.diagnosticDoPost.totalDoPostMs) >= 0
        ) {
            console.log(
                "Surcoût réseau / redirection Apps Script estimé :",
                Math.max(
                    0,
                    tempsEnregistrementNavigateur -
                    Number(resultat.diagnosticDoPost.totalDoPostMs || 0)
                ),
                "ms"
            );
        }
        if (resultat?.diagnosticTemps) console.table(resultat.diagnosticTemps);
        if (resultat?.diagnosticDoPost) console.table(resultat.diagnosticDoPost);
        console.groupEnd();

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer la commande."
            );
        }

        const commandeSauvegardee =
            resultat.data || {
                ...donnees,
                idCommande:
                    donnees.idCommande ||
                    resultat.idCommande ||
                    "",
                numeroCommande:
                    resultat.numeroCommande ||
                    ""
            };

        mettreAJourCommandeLocale(
            commandeSauvegardee
        );

        /*
         * Le loader devient maintenant la carte de confirmation.
         * On conserve la fenêtre de commande derrière et on attend
         * le clic sur "Parfait !" avant de fermer / réinitialiser.
         */
        await afficherSuccesEnregistrementCommande(
            commandeSauvegardee,
            Boolean(commandeEnModificationId)
        );

        fermerModaleCommande();
        reinitialiserFormulaireCommande();

        /*
         * Actualise le stock en arrière-plan sans bloquer
         * l'interface après la création.
         */
        chargerProduitsCommande()
            .catch(error => {
                console.warn(
                    "Actualisation différée du stock impossible :",
                    error
                );
            });

    } catch (error) {
        console.error(
            "Erreur d'enregistrement de la commande :",
            error
        );

        afficherMessageCommande(
            error.message ||
            "Une erreur est survenue.",
            "error"
        );

    } finally {
        terminerLoaderEnregistrementCommande();

        formulaire.dataset.processing = "false";

        if (bouton) {
            bouton.disabled = false;
            bouton.textContent =
                commandeEnModificationId
                    ? "Enregistrer les modifications"
                    : "Enregistrer la commande";
        }
    }
}


/* ===========================================================
   SYNCHRONISATION COMMANDES — MULTI-APPAREILS
=========================================================== */

function initialiserSynchronisationCommandes() {
    if (timerSyncCommandes) {
        clearInterval(timerSyncCommandes);
    }

    /*
     * Première vérification rapide après ouverture du module.
     * Elle rattrape notamment un cache de navigation contenant encore
     * un ancien statut ("En attente" alors que le serveur est "Confirmée").
     */
    setTimeout(
        () => {
            synchroniserCommandesMultiAppareils();
        },
        2500
    );

    timerSyncCommandes =
        setInterval(
            () => {
                /*
                 * Aucun appel lorsque l'onglet n'est pas visible.
                 */
                if (
                    document.visibilityState !==
                    "visible"
                ) {
                    return;
                }

                synchroniserCommandesMultiAppareils();
            },
            INTERVALLE_SYNC_COMMANDES_MS
        );

    /*
     * Au retour sur l'onglet, vérifie immédiatement
     * s'il y a eu de nouvelles commandes.
     */
    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                document.visibilityState ===
                "visible"
            ) {
                synchroniserCommandesMultiAppareils();
            }
        }
    );
}


function obtenirDernierIdCommandeAffichee() {
    const page1 =
        pagesCommandesServeur.get(1);

    const commandes =
        Array.isArray(
            page1?.commandes
        )
            ? page1.commandes
            : [];

    return String(
        commandes[0]?.idCommande ||
        ""
    ).trim();
}


async function synchroniserCommandesMultiAppareils() {
    if (
        syncCommandesEnCours ||
        typeof apiGet !== "function"
    ) {
        return;
    }

    /*
     * Attend que le chargement initial de la page 1
     * soit terminé avant de commencer la surveillance.
     */
    if (
        !pagesCommandesServeur.has(1)
    ) {
        return;
    }

    syncCommandesEnCours = true;

    try {
        /*
         * État léger :
         * - total ;
         * - dernière commande ;
         * - ID + statut uniquement.
         *
         * Aucun détail produit / avoir / livraison n'est chargé ici.
         */
        const etat =
            await apiGet(
                "getEtatSyncCommandes",
                {
                    _ts: Date.now()
                }
            );

        if (!etat?.success) {
            return;
        }

        const totalDistant =
            Math.max(
                0,
                Number(etat.total) || 0
            );

        const dernierIdDistant =
            String(
                etat.dernierIdCommande ||
                ""
            ).trim();

        const dernierIdLocal =
            obtenirDernierIdCommandeAffichee();

        /*
         * FIX SYNCHRO STATUTS
         *
         * On compare désormais le statut serveur avec les commandes
         * déjà chargées en mémoire. Une confirmation faite sur un autre
         * appareil est donc détectée même si :
         * - le nombre total ne change pas ;
         * - la dernière commande ne change pas.
         */
        const statutsDistants =
            new Map(
                (
                    Array.isArray(
                        etat.statutsCommandes
                    )
                        ? etat.statutsCommandes
                        : []
                )
                    .map(element => [
                        String(
                            element?.idCommande ||
                            ""
                        ).trim(),
                        normaliserTexteCommande(
                            element?.statut ||
                            ""
                        )
                    ])
                    .filter(
                        element =>
                            Boolean(
                                element[0]
                            )
                    )
            );

        let nombreStatutsCorriges = 0;

        pagesCommandesServeur.forEach(
            pageData => {
                const commandes =
                    Array.isArray(
                        pageData?.commandes
                    )
                        ? pageData.commandes
                        : [];

                commandes.forEach(
                    commande => {
                        const id =
                            String(
                                commande?.idCommande ||
                                ""
                            ).trim();

                        if (
                            !id ||
                            !statutsDistants.has(id)
                        ) {
                            return;
                        }

                        const statutDistant =
                            statutsDistants.get(id);

                        const statutLocal =
                            normaliserTexteCommande(
                                commande.statut ||
                                ""
                            );

                        if (
                            statutDistant &&
                            statutDistant !==
                                statutLocal
                        ) {
                            commande.statut =
                                statutDistant;

                            nombreStatutsCorriges++;
                        }
                    }
                );
            }
        );

        /*
         * Si un statut a été corrigé en mémoire, on reconstruit
         * immédiatement la liste avant le rafraîchissement léger.
         */
        if (nombreStatutsCorriges > 0) {
            reconstruireCommandesDepuisPagesServeur();
            afficherTableauCommandes();

            console.log(
                "Synchronisation statuts Commandes :",
                nombreStatutsCorriges,
                "statut(s) corrigé(s)."
            );
        }

        /*
         * Même total + même dernière commande + aucun statut différent :
         * rien à faire.
         */
        if (
            totalDistant ===
                totalCommandesServeur &&
            dernierIdDistant ===
                dernierIdLocal &&
            nombreStatutsCorriges === 0
        ) {
            return;
        }

        /*
         * Le rafraîchissement de la page 1 remet aussi les KPI serveur
         * à jour et conserve la logique existante de pagination/cache.
         */
        await rafraichirCommandesApresSynchronisation(
            etat
        );

    } catch (error) {
        /*
         * La synchronisation ne doit jamais bloquer
         * l'utilisation normale du module.
         */
        console.warn(
            "Synchronisation automatique des commandes indisponible :",
            error
        );

    } finally {
        syncCommandesEnCours = false;
    }
}

async function rafraichirCommandesApresSynchronisation(
    etat
) {
    const ancienTotal =
        totalCommandesServeur;

    const cacheEtaitComplet =
        toutesPagesCommandesChargees();

    const anciennesCommandes =
        [...commandesChargees];

    /*
     * Recharge uniquement la page 1.
     * On appelle directement l'API pour éviter
     * de récupérer la page 1 depuis le cache local.
     */
    const resultat =
        await apiGet(
            "getCommandesPage",
            {
                page: 1,
                limite: taillePageCommandes,
                _ts: Date.now()
            }
        );

    if (!resultat?.success) {
        throw new Error(
            resultat?.message ||
            "Impossible de synchroniser les nouvelles commandes."
        );
    }

    const nouvellesPage1 =
        extraireListeCommande(
            resultat,
            "commandes"
        );

    const pagination =
        resultat.pagination ||
        {};

    const nouveauTotal =
        Math.max(
            0,
            Number(
                pagination.total ??
                etat?.total
            ) || 0
        );

    const nouveauNombrePages =
        Math.max(
            1,
            Number(
                pagination.totalPages ??
                etat?.totalPages
            ) ||
            Math.ceil(
                nouveauTotal /
                taillePageCommandes
            ) ||
            1
        );

    const nombreNouvellesCommandes =
        Math.max(
            0,
            nouveauTotal - ancienTotal
        );

    /*
     * Cas optimal :
     * toutes les anciennes pages étaient déjà en RAM
     * et au maximum 20 nouvelles commandes sont arrivées
     * depuis le dernier contrôle.
     *
     * On reconstruit alors toute la pagination en mémoire,
     * sans rappeler les pages 2, 3, 4...
     */
    if (
        cacheEtaitComplet &&
        nouveauTotal >= ancienTotal &&
        nombreNouvellesCommandes <=
            taillePageCommandes
    ) {
        const idsPage1 =
            new Set(
                nouvellesPage1.map(
                    commande =>
                        String(
                            commande.idCommande
                        )
                )
            );

        const fusion =
            [
                ...nouvellesPage1,
                ...anciennesCommandes.filter(
                    commande =>
                        !idsPage1.has(
                            String(
                                commande.idCommande
                            )
                        )
                )
            ]
                .slice(
                    0,
                    nouveauTotal
                );

        pagesCommandesServeur.clear();

        for (
            let page = 1;
            page <= nouveauNombrePages;
            page++
        ) {
            const debut =
                (page - 1) *
                taillePageCommandes;

            const fin =
                debut +
                taillePageCommandes;

            pagesCommandesServeur.set(
                page,
                {
                    commandes:
                        fusion.slice(
                            debut,
                            fin
                        ),

                    pagination: {
                        page: page,
                        limite:
                            taillePageCommandes,
                        total:
                            nouveauTotal,
                        totalPages:
                            nouveauNombrePages,
                        hasNext:
                            page <
                            nouveauNombrePages,
                        hasPrevious:
                            page > 1
                    },

                    kpi:
                        page === 1
                            ? (
                                resultat.kpi ||
                                null
                              )
                            : null
                }
            );
        }

        totalCommandesServeur =
            nouveauTotal;

        totalPagesCommandesServeur =
            nouveauNombrePages;

        reconstruireCommandesDepuisPagesServeur();

        /*
         * Conserve exactement la page consultée par
         * l'utilisateur, mais rafraîchit son contenu.
         */
        pageCommandesActuelle =
            Math.min(
                pageCommandesActuelle,
                totalPagesCommandesServeur
            );

        afficherTableauCommandes();

    } else {
        /*
         * Cache incomplet, suppression parallèle
         * ou trop de nouveautés :
         * on garde la page 1 fraîche et on recharge
         * les autres pages discrètement en arrière-plan.
         */
        pagesCommandesServeur.clear();

        pagesCommandesServeur.set(
            1,
            {
                commandes:
                    nouvellesPage1,
                pagination:
                    pagination,
                kpi:
                    resultat.kpi ||
                    null
            }
        );

        totalCommandesServeur =
            nouveauTotal;

        totalPagesCommandesServeur =
            nouveauNombrePages;

        reconstruireCommandesDepuisPagesServeur();

        if (
            pageCommandesActuelle === 1
        ) {
            afficherTableauCommandes();
        }

        if (
            nouveauNombrePages > 1
        ) {
            prechargementCommandesPromise =
                prechargerPagesCommandesEnCascade(
                    2,
                    generationChargementCommandes
                );
        }
    }

    if (resultat.kpi) {
        afficherKPICommandesServeur(
            resultat.kpi
        );
    }

    actualiserFiltreCommunesCommandes();

    console.log(
        "Synchronisation Commandes :",
        ancienTotal,
        "→",
        nouveauTotal,
        "commande(s)."
    );

    sauvegarderCacheNavigationCommandes();
}

async function revaliderCommandesDepuisServeurApresCache() {
    try {
        const resultat = await apiGet(
            "getCommandesPage",
            {
                page: 1,
                limite: taillePageCommandes,
                _ts: Date.now()
            }
        );

        if (!resultat?.success) return;

        pagesCommandesServeur.set(1, {
            commandes: extraireListeCommande(resultat, "commandes"),
            pagination: resultat.pagination || {},
            kpi: resultat.kpi || null
        });

        const pagination = resultat.pagination || {};

        totalCommandesServeur = Math.max(
            0,
            Number(pagination.total) || 0
        );

        totalPagesCommandesServeur = Math.max(
            1,
            Number(pagination.totalPages) ||
                Math.ceil(totalCommandesServeur / taillePageCommandes) ||
                1
        );

        pageCommandesActuelle = Math.min(
            Math.max(1, pageCommandesActuelle),
            totalPagesCommandesServeur
        );

        reconstruireCommandesDepuisPagesServeur();

        if (resultat.kpi) {
            afficherKPICommandesServeur(resultat.kpi);
        } else {
            const totalKpi = document.getElementById("total-orders-value");
            if (totalKpi) {
                totalKpi.textContent = String(totalCommandesServeur);
                totalKpi.classList.remove("is-loading");
            }
        }

        actualiserFiltreCommunesCommandes();
        afficherTableauCommandes();
        sauvegarderCacheNavigationCommandes();

    } catch (error) {
        console.warn("Revalidation serveur Commandes impossible :", error);
    }
}


async function chargerCommandes() {
    const tbody = document.getElementById("orders-table-body");

    // Si les Commandes ont déjà été chargées dans cet onglet, on les réaffiche
    // immédiatement. Aucun gros rechargement n’est lancé tant que la vérification
    // légère ne détecte pas une modification côté serveur.
    if (restaurerCacheNavigationCommandes()) {
        // Le cache s'affiche tout de suite, mais la source de vérité
        // est relue immédiatement depuis le serveur.
        revaliderCommandesDepuisServeurApresCache();

        if (!toutesPagesCommandesChargees()) {
            const premierePageManquante = Array.from(
                { length: totalPagesCommandesServeur },
                (_, index) => index + 1
            ).find(page => !pagesCommandesServeur.has(page));

            if (premierePageManquante) {
                // Optimisation 1 : ne relance pas immédiatement toutes les pages
                // au retour sur Commandes. Le cache est affiché d'abord, puis le
                // complément arrive uniquement quand le navigateur est disponible.
                planifierPrechargementCommandesEnArrierePlan(
                    premierePageManquante,
                    generationChargementCommandes
                );
            }
        }
        // Le tableau est déjà affiché depuis le cache : on peut maintenant
        // compléter discrètement les données clients pour le formulaire.
        planifierClientsCommandeComplets();
        return;
    }

    // Le loader apparaît uniquement lorsqu'un vrai chargement réseau est nécessaire.
    demarrerLoaderCommandes("Chargement des commandes…");

    const generation = ++generationChargementCommandes;

    pagesCommandesServeur.clear();
    totalCommandesServeur = 0;
    totalPagesCommandesServeur = 1;
    prechargementCommandesPromise = null;
    pageCommandesActuelle = 1;
    commandesChargees = [];
    commandesFiltrees = [];

    try {
        /*
         * La page 1 et les catalogues sont chargés en parallèle.
         * On attend simplement que les correspondances ID -> nom soient prêtes
         * avant le tout premier rendu du tableau : aucun flash d'ID.
         */
        const [
            resultat,
            _catalogues
        ] = await Promise.all([
            chargerPageCommandesServeur(1),
            Promise.allSettled([
                // Optimisation 2 : le tableau n'utilise que les noms Client/Livreur.
                // Le catalogue Produits continue de charger en parallèle pour la modale,
                // mais ne bloque plus l'affichage des 20 commandes.
                chargementClientsCommandePromise || Promise.resolve(),
                chargementLivreursCommandePromise || Promise.resolve()
            ])
        ]);

        if (generation !== generationChargementCommandes) return;

        appliquerPageCommandesServeur(resultat);
        pageCommandesActuelle = 1;
        afficherTableauCommandes();

        // OPT4 : le chrono du premier affichage est terminé ici.
        // Les données clients complètes (crédit/avoir) arrivent ensuite en tâche de fond.
        planifierClientsCommandeComplets();

        // Optimisation 1 : la page 1 reste prioritaire. Les pages suivantes ne
        // commencent plus immédiatement après le rendu : elles sont planifiées en
        // arrière-plan lorsque le navigateur est disponible. Cela évite de remettre
        // tout de suite Apps Script / Google Sheets sous charge après le 1er affichage.
        planifierPrechargementCommandesEnArrierePlan(2, generation);
    } catch (error) {
        console.error("Erreur de chargement des commandes :", error);
        commandesChargees = [];
        commandesFiltrees = [];
        afficherTableauCommandes();
        if (typeof showToast === "function") {
            showToast(error.message || "Impossible de charger les commandes.", "error");
        }
    } finally {
        /*
         * Le loader disparaît seulement après que le code a préparé
         * KPI + tableau + pagination. visibl-loading.js attend ensuite
         * deux frames de rendu avant de révéler les vraies données.
         */
        terminerLoaderCommandes();
    }
}

async function chargerPageCommandesServeur(page) {
    const numero = Math.max(1, Number(page) || 1);
    if (pagesCommandesServeur.has(numero)) {
        return pagesCommandesServeur.get(numero);
    }

    const resultat = await apiGet("getCommandesPage", { page: numero, limite: taillePageCommandes, _ts: Date.now() });
    if (!resultat?.success) {
        throw new Error(resultat?.message || "Impossible de charger cette page de commandes.");
    }

    const objet = {
        commandes: extraireListeCommande(resultat, "commandes"),
        pagination: resultat.pagination || {},
        kpi: resultat.kpi || null
    };
    pagesCommandesServeur.set(numero, objet);
    return objet;
}

function reconstruireCommandesDepuisPagesServeur() {
    const toutes = [];
    Array.from(pagesCommandesServeur.keys())
        .sort((a, b) => a - b)
        .forEach(numero => {
            const page = pagesCommandesServeur.get(numero);
            if (Array.isArray(page?.commandes)) toutes.push(...page.commandes);
        });
    commandesChargees = toutes;
    commandesFiltrees = [...toutes];
}

function appliquerPageCommandesServeur(resultat) {
    const pagination = resultat?.pagination || {};
    totalCommandesServeur = Math.max(0, Number(pagination.total) || totalCommandesServeur || 0);
    totalPagesCommandesServeur = Math.max(1, Number(pagination.totalPages) || Math.ceil(totalCommandesServeur / taillePageCommandes) || 1);
    reconstruireCommandesDepuisPagesServeur();

    if (resultat?.kpi) {
        afficherKPICommandesServeur(resultat.kpi);
    } else {
        const totalKpi = document.getElementById("total-orders-value");
        if (totalKpi) {
            totalKpi.textContent = String(totalCommandesServeur);
            totalKpi.classList.remove("is-loading");
        }
    }

    actualiserFiltreCommunesCommandes();
    sauvegarderCacheNavigationCommandes();
}


function afficherKPICommandesServeur(kpi) {
    if (!kpi || typeof kpi !== "object") {
        return;
    }

    const total =
        Math.max(
            0,
            Number(kpi.total) || 0
        );

    const chiffreAffaires =
        Math.max(
            0,
            Number(kpi.chiffreAffaires) || 0
        );

    const enAttente =
        Math.max(
            0,
            Number(kpi.enAttente) || 0
        );

    const terminees =
        Math.max(
            0,
            Number(kpi.terminees) || 0
        );

    const nouvellesCeMois =
        Math.max(
            0,
            Number(kpi.nouvellesCeMois) || 0
        );

    const descriptionNouvellesCommandes =
        `${nouvellesCeMois} nouvelle${
            nouvellesCeMois > 1 ? "s" : ""
        } commande${
            nouvellesCeMois > 1 ? "s" : ""
        } ce mois`;

    const correspondances = {
        "total-orders-value": total,
        "total-orders-description":
            descriptionNouvellesCommandes,
        "orders-revenue-value":
            formaterFCFA(chiffreAffaires),
        "pending-orders-value":
            enAttente,
        "completed-orders-value":
            terminees
    };

    Object.entries(correspondances)
        .forEach(
            ([id, valeur]) => {
                const element =
                    document.getElementById(id);

                if (element) {
                    element.textContent = valeur;
                    element.classList.remove("is-loading");
                }
            }
        );
}

function planifierPrechargementCommandesEnArrierePlan(debutPage, generation) {
    const lancer = () => {
        if (generation !== generationChargementCommandes) return;
        if (document.hidden) {
            // Si l'utilisateur a déjà quitté l'onglet, inutile de solliciter le
            // backend immédiatement. On réessaie plus tard sans bloquer la navigation.
            window.setTimeout(lancer, 1500);
            return;
        }

        prechargementCommandesPromise =
            prechargerPagesCommandesEnCascade(debutPage, generation);
    };

    if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(lancer, { timeout: 1800 });
    } else {
        window.setTimeout(lancer, 1200);
    }
}


async function prechargerPagesCommandesEnCascade(debutPage, generation) {
    for (let page = debutPage; page <= totalPagesCommandesServeur; page++) {
        if (generation !== generationChargementCommandes) return;
        try {
            const resultat = await chargerPageCommandesServeur(page);
            if (generation !== generationChargementCommandes) return;
            appliquerPageCommandesServeur(resultat);

            // Si l'utilisateur se trouve sur cette page, elle apparaît dès son arrivée.
            if (pageCommandesActuelle === page) afficherTableauCommandes();
        } catch (error) {
            console.warn("Préchargement Commandes page " + page + " interrompu :", error);
            return;
        }
    }

    if (generation === generationChargementCommandes) {
        reconstruireCommandesDepuisPagesServeur();
        actualiserFiltreCommunesCommandes();
    }
}

function toutesPagesCommandesChargees() {
    return pagesCommandesServeur.size >= totalPagesCommandesServeur;
}

async function allerPageCommandes(page) {
    const cible = Math.max(
        1,
        Math.min(
            Number(page) || 1,
            totalPagesCommandesServeur
        )
    );

    pageCommandesActuelle = cible;

    if (!pagesCommandesServeur.has(cible)) {
        demarrerLoaderCommandes(
            `Chargement de la page ${cible}…`
        );

        try {
            const resultat =
                await chargerPageCommandesServeur(
                    cible
                );

            appliquerPageCommandesServeur(
                resultat
            );

            afficherTableauCommandes();
            sauvegarderCacheNavigationCommandes();

        } catch (error) {
            console.error(
                "Chargement page Commandes :",
                error
            );

            if (
                typeof showToast === "function"
            ) {
                showToast(
                    error.message ||
                    "Impossible de charger cette page.",
                    "error"
                );
            }

            return;

        } finally {
            terminerLoaderCommandes();
        }

        return;
    }

    afficherTableauCommandes();
    sauvegarderCacheNavigationCommandes();
}


function mettreAJourCommandeLocale(commande) {
    if (
        !commande ||
        !commande.idCommande
    ) {
        return;
    }

    const index =
        commandesChargees.findIndex(
            element =>
                String(element.idCommande) ===
                String(commande.idCommande)
        );

    if (index >= 0) {
        commandesChargees[index] = {
            ...commandesChargees[index],
            ...commande
        };
    } else {
        commandesChargees.unshift(
            commande
        );
    }

    if (pagesCommandesServeur.has(1)) {
        const p1 = pagesCommandesServeur.get(1);
        const liste = Array.isArray(p1.commandes) ? p1.commandes.filter(x => String(x.idCommande) !== String(commande.idCommande)) : [];
        liste.unshift(commande);
        p1.commandes = liste.slice(0, taillePageCommandes);
    }
    totalCommandesServeur = Math.max(totalCommandesServeur, commandesChargees.length);
    totalPagesCommandesServeur = Math.max(1, Math.ceil(totalCommandesServeur / taillePageCommandes));

    actualiserFiltreCommunesCommandes();
    if (toutesPagesCommandesChargees()) mettreAJourKPICommandes();
    appliquerFiltresCommandes(true);
    sauvegarderCacheNavigationCommandes();
}


function retirerCommandeLocale(idCommande) {
    commandesChargees =
        commandesChargees.filter(
            commande =>
                String(commande.idCommande) !==
                String(idCommande)
        );

    actualiserFiltreCommunesCommandes();
    mettreAJourKPICommandes();
    appliquerFiltresCommandes(true);
}


function normaliserStatutPaiementCommandeFiltre(valeur) {
    const statut =
        normaliserTexteCommande(
            valeur || ""
        );

    const alias = {
        "non-paye": "non-paye",
        "non-payee": "non-paye",
        "non-payé": "non-paye",
        "non-regle": "non-paye",
        "impaye": "non-paye",
        "partiel": "partiel",
        "partielle": "partiel",
        "partiellement-paye": "partiel",
        "partiellement-payee": "partiel",
        "paiement-partiel": "partiel",
        "paye": "paye",
        "payee": "paye",
        "regle": "paye",
        "reglee": "paye",
        "solde": "paye",
        "soldee": "paye"
    };

    return alias[statut] || statut;
}


function appliquerFiltresCommandes(
    conserverPage = false
) {
    const rechercheDemandee =
        normaliserTexteCommande(
            obtenirValeurCommande(
                "orders-header-search-input"
            )
        );

    const statutDemande =
        normaliserTexteCommande(
            obtenirValeurCommande(
                "order-status-filter"
            )
        );

    const paiementDemande =
        normaliserStatutPaiementCommandeFiltre(
            obtenirValeurCommande(
                "order-payment-status-filter"
            )
        );

    const communeDemandee =
        normaliserTexteCommande(
            obtenirValeurCommande(
                "order-commune-filter"
            )
        );

    if (
        (
            rechercheDemandee ||
            statutDemande ||
            paiementDemande ||
            communeDemandee
        ) &&
        !toutesPagesCommandesChargees()
    ) {
        if (prechargementCommandesPromise) {
            prechargementCommandesPromise.then(
                () =>
                    appliquerFiltresCommandes(
                        conserverPage
                    )
            );
        }
        return;
    }

    const recherche =
        rechercheDemandee;

    const statut =
        statutDemande;

    const paiement =
        paiementDemande;

    const commune =
        communeDemandee;

    commandesFiltrees =
        commandesChargees.filter(
            commande => {
                const texte =
                    normaliserTexteCommande(
                        [
                            commande.numeroCommande,
                            commande.idCommande,
                            commande.idClient,
                            obtenirNomClientCommandeParId(
                                commande.idClient
                            ),
                            commande.idLivreur,
                            obtenirNomLivreurCommandeParId(
                                commande.idLivreur
                            ),
                            commande.communeLivraison,
                            commande.zoneLivraison,
                            commande.statut,
                            commande.statutPaiement,
                            commande.modePaiementPrevu,
                            commande.modePaiement,
                            commande.origine ||
                            commande.origineCommande,
                            commande.idVente
                        ].join(" ")
                    );

                const correspondRecherche =
                    !recherche ||
                    texte.includes(
                        recherche
                    );

                const correspondStatut =
                    !statut ||
                    normaliserTexteCommande(
                        commande.statut
                    ) === statut;

                const correspondPaiement =
                    !paiement ||
                    normaliserStatutPaiementCommandeFiltre(
                        commande.statutPaiement
                    ) === paiement;

                const correspondCommune =
                    !commune ||
                    normaliserTexteCommande(
                        commande.communeLivraison
                    ) === commune;

                return (
                    correspondRecherche &&
                    correspondStatut &&
                    correspondPaiement &&
                    correspondCommune
                );
            }
        );

    if (!conserverPage) {
        pageCommandesActuelle = 1;
    }

    afficherTableauCommandes();
}


function actualiserFiltreCommunesCommandes() {
    const select =
        document.getElementById(
            "order-commune-filter"
        );

    if (!select) {
        return;
    }

    const valeurActuelle =
        String(
            select.value ||
            ""
        ).trim();

    const communes =
        Array.from(
            new Set(
                commandesChargees
                    .map(
                        commande =>
                            String(
                                commande.communeLivraison ||
                                ""
                            ).trim()
                    )
                    .filter(Boolean)
            )
        )
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        "fr",
                        {
                            sensitivity:
                                "base"
                        }
                    )
            );

    select.innerHTML =
        '<option value="">Toutes les communes</option>';

    communes.forEach(
        commune => {
            const option =
                document.createElement(
                    "option"
                );

            option.value =
                commune;

            option.textContent =
                commune;

            select.appendChild(
                option
            );
        }
    );

    if (
        valeurActuelle &&
        communes.some(
            commune =>
                normaliserTexteCommande(
                    commune
                ) ===
                normaliserTexteCommande(
                    valeurActuelle
                )
        )
    ) {
        select.value =
            valeurActuelle;
    } else {
        select.value = "";
    }
}


function reinitialiserFiltresCommandes() {
    [
        "orders-header-search-input",
        "order-status-filter",
        "order-payment-status-filter",
        "order-commune-filter"
    ].forEach(
        id => definirValeurCommande(id, "")
    );

    appliquerFiltresCommandes();
}


function afficherTableauCommandes() {
    const tbody = document.getElementById("orders-table-body");
    if (!tbody) return;

    const recherche = normaliserTexteCommande(obtenirValeurCommande("orders-header-search-input"));
    const statut = normaliserTexteCommande(obtenirValeurCommande("order-status-filter"));
    const paiement = normaliserStatutPaiementCommandeFiltre(obtenirValeurCommande("order-payment-status-filter"));
    const commune = normaliserTexteCommande(obtenirValeurCommande("order-commune-filter"));
    const filtresActifs = !!(recherche || statut || paiement || commune);

    // Sans filtre : vraie pagination serveur, une page = exactement les 20 lignes demandées.
    if (!filtresActifs && pagesCommandesServeur.size) {
        const paquet = pagesCommandesServeur.get(pageCommandesActuelle);
        const page = Array.isArray(paquet?.commandes) ? paquet.commandes : [];

        tbody.innerHTML = page.length
            ? page.map(creerLigneCommandeHTML).join("")
            : `<tr><td colspan="13" class="empty-table">Chargement de cette page...</td></tr>`;

        const compteur = document.getElementById("filtered-order-count");
        if (compteur) compteur.textContent = String(totalCommandesServeur);

        synchroniserSelectionCommandes();
        const debut = (pageCommandesActuelle - 1) * taillePageCommandes;
        afficherPaginationCommandes(
            totalPagesCommandesServeur,
            totalCommandesServeur,
            debut,
            Math.min(debut + page.length, totalCommandesServeur)
        );
        return;
    }

    // Avec filtre : dès que toutes les pages sont en RAM, comportement historique intact.
    const total = commandesFiltrees.length;
    const totalPages = Math.max(1, Math.ceil(total / taillePageCommandes));
    pageCommandesActuelle = Math.min(pageCommandesActuelle, totalPages);
    const debut = (pageCommandesActuelle - 1) * taillePageCommandes;
    const fin = debut + taillePageCommandes;
    const page = commandesFiltrees.slice(debut, fin);

    tbody.innerHTML = page.length
        ? page.map(creerLigneCommandeHTML).join("")
        : `<tr><td colspan="13" class="empty-table">Aucune commande enregistrée.</td></tr>`;

    const compteur = document.getElementById("filtered-order-count");
    if (compteur) compteur.textContent = String(total);
    synchroniserSelectionCommandes();
    afficherPaginationCommandes(totalPages, total, debut, Math.min(fin, total));
}


function formaterLibelleStatutCommande(
    statut
) {
    const valeur =
        normaliserTexteCommande(
            statut ||
            ""
        );

    const libelles = {
        "en-attente": "En attente",
        "confirmee": "Confirmée",
        "convertie-en-vente": "Convertie en vente",
        "annulee": "Annulée"
    };

    return (
        libelles[valeur] ||
        statut ||
        "—"
    );
}


function afficherStatutCommandeFormulaire(
    statut
) {
    const valeur =
        normaliserTexteCommande(
            statut ||
            "en-attente"
        ) ||
        "en-attente";

    const cache =
        document.getElementById(
            "order-status"
        );

    const affichage =
        document.getElementById(
            "order-status-display"
        );

    if (cache) {
        cache.value = valeur;
    }

    if (affichage) {
        affichage.value =
            formaterLibelleStatutCommande(
                valeur
            );
    }
}


function formaterLibelleStatutLivraisonCommande(
    statut
) {
    const valeur =
        normaliserTexteCommande(
            statut ||
            ""
        );

    const libelles = {
        "retrait-boutique": "Retrait boutique",
        "a-preparer": "À préparer",
        "prete-pour-depart": "Prête pour départ",
        "en-livraison": "En livraison",
        "livree": "Livrée",
        "annulee": "Annulée"
    };

    return (
        libelles[valeur] ||
        statut ||
        "—"
    );
}


function creerLigneCommandeHTML(commande) {
    const client =
        obtenirNomClientCommandeParId(
            commande.idClient
        ) ||
        commande.idClient ||
        "—";

    const estLivraison =
        normaliserTexteCommande(
            commande.modeReception ||
            "livraison"
        ) === "livraison";

    const livreur =
        estLivraison
            ? (
                obtenirNomLivreurCommandeParId(
                    commande.idLivreur
                ) ||
                (
                    commande.idLivreur
                        ? commande.idLivreur
                        : "Non affecté"
                )
            )
            : "Retrait boutique";

    const lieu =
        estLivraison
            ? (
                [
                    commande.communeLivraison,
                    commande.zoneLivraison
                ]
                    .filter(Boolean)
                    .join(" • ") ||
                "—"
            )
            : "Retrait en boutique";

    return `
        <tr>
            <td class="order-selection-column">
                <input
                    type="checkbox"
                    class="order-selection-checkbox"
                    data-select-order="${echapperHTMLCommande(commande.idCommande)}"
                    aria-label="Sélectionner la commande"
                    ${commandesSelectionnees.has(String(commande.idCommande)) ? "checked" : ""}
                >
            </td>

            <td>
                <strong>
                    ${echapperHTMLCommande(
                        commande.numeroCommande ||
                        commande.idCommande ||
                        "—"
                    )}
                </strong>
            </td>

            <td>
                ${echapperHTMLCommande(
                    commande.origine ||
                    commande.origineCommande ||
                    "Commande"
                )}
            </td>

            <td>
                ${echapperHTMLCommande(
                    commande.idVente ||
                    "—"
                )}
            </td>

            <td>
                ${echapperHTMLCommande(client)}
            </td>

            <td>
                ${echapperHTMLCommande(
                    [
                        commande.dateCommande,
                        commande.heureCommande
                    ]
                        .filter(Boolean)
                        .join(" ")
                )}
            </td>

            <td>
                <strong>
                    ${formaterFCFA(
                        commande.totalAPayer
                    )}
                </strong>
            </td>

            <td>
                ${echapperHTMLCommande(livreur)}
            </td>

            <td>
                ${echapperHTMLCommande(lieu)}
            </td>

            <td>
                ${echapperHTMLCommande(
                    commande.modePaiementPrevu ||
                    "—"
                )}
            </td>

            <td>
                <span class="status-badge">
                    ${echapperHTMLCommande(
                        formaterLibelleStatutLivraisonCommande(
                            commande.statutLivraison ||
                            (
                                estLivraison
                                    ? "a-preparer"
                                    : "retrait-boutique"
                            )
                        )
                    )}
                </span>
            </td>

            <td>
                <span class="status-badge">
                    ${echapperHTMLCommande(
                        formaterLibelleStatutCommande(
                            commande.statut ||
                            "—"
                        )
                    )}
                </span>
            </td>

            <td>
                <div class="order-row-actions">
                    <button
                        type="button"
                        class="order-row-actions-trigger"
                        data-order-menu-trigger="${echapperHTMLCommande(commande.idCommande)}"
                        aria-label="Actions de la commande"
                        aria-expanded="false"
                    >⋮</button>
                    <div
                        class="order-row-actions-dropdown"
                        data-order-menu="${echapperHTMLCommande(commande.idCommande)}"
                        hidden
                    >
                        <button type="button" data-view-order="${echapperHTMLCommande(commande.idCommande)}">👁️ <span>Voir la commande</span></button>

                        ${commandeDejaConvertieEnVente(commande) ? `
                            <button type="button" data-open-linked-sale="${echapperHTMLCommande(commande.idVente)}">🧾 <span>Voir la vente liée</span></button>
                        ` : `
                            ${commandeEstEnAttente(commande) ? `
                                <button type="button" data-confirm-order="${echapperHTMLCommande(commande.idCommande)}">✅ <span>Confirmer la commande</span></button>
                            ` : ""}

                            ${commandePeutEtreModifiee(commande) ? `
                                <button type="button" data-edit-order="${echapperHTMLCommande(commande.idCommande)}">✏️ <span>Modifier</span></button>
                            ` : ""}

                            ${commandeEstConfirmee(commande) &&
                              normaliserTexteCommande(commande.modeReception || "") === "retrait-boutique" ? `
                                <button type="button" data-finalize-pickup-order="${echapperHTMLCommande(commande.idCommande)}">🛍️ <span>Confirmer la remise</span></button>
                            ` : ""}

                            ${commandePeutEtreAnnulee(commande) ? `
                                <button type="button" data-cancel-order="${echapperHTMLCommande(commande.idCommande)}">❌ <span>Annuler la commande</span></button>
                            ` : ""}

                            ${commandePeutEtreSupprimee(commande) ? `
                                <button type="button" class="danger-action" data-delete-order="${echapperHTMLCommande(commande.idCommande)}">🗑️ <span>Supprimer</span></button>
                            ` : ""}
                        `}
                    </div>
                </div>
            </td>
        </tr>
    `;
}


function gererActionsTableauCommandes(event) {
    const declencheurMenu = event.target.closest("[data-order-menu-trigger]");

    if (declencheurMenu) {
        event.stopPropagation();
        basculerMenuActionLigneCommande(declencheurMenu);
        return;
    }

    if (event.target.closest(".order-row-actions-dropdown button")) {
        fermerMenusActionsLigneCommande();
    }

    const boutonVoir =
        event.target.closest(
            "[data-view-order]"
        );

    if (boutonVoir) {
        voirCommande(
            boutonVoir.dataset.viewOrder
        );
        return;
    }

    const boutonConfirmer =
        event.target.closest(
            "[data-confirm-order]"
        );

    if (boutonConfirmer) {
        changerStatutCommandeFrontend(
            boutonConfirmer.dataset.confirmOrder,
            "confirmer"
        );
        return;
    }

    const boutonRetrait =
        event.target.closest(
            "[data-finalize-pickup-order]"
        );

    if (boutonRetrait) {
        changerStatutCommandeFrontend(
            boutonRetrait.dataset.finalizePickupOrder,
            "finaliser-retrait"
        );
        return;
    }

    const boutonAnnuler =
        event.target.closest(
            "[data-cancel-order]"
        );

    if (boutonAnnuler) {
        changerStatutCommandeFrontend(
            boutonAnnuler.dataset.cancelOrder,
            "annuler"
        );
        return;
    }

    const boutonConvertir =
        event.target.closest(
            "[data-convert-order]"
        );

    if (boutonConvertir) {
        preparerConversionCommandeEnVente(
            boutonConvertir.dataset.convertOrder
        );
        return;
    }

    const boutonVenteLiee =
        event.target.closest(
            "[data-open-linked-sale]"
        );

    if (boutonVenteLiee) {
        ouvrirVenteLieeDepuisCommande(
            boutonVenteLiee.dataset.openLinkedSale
        );
        return;
    }

    const boutonModifier =
        event.target.closest(
            "[data-edit-order]"
        );

    if (boutonModifier) {
        ouvrirModificationCommande(
            boutonModifier.dataset.editOrder
        );
        return;
    }

    const boutonSupprimer =
        event.target.closest(
            "[data-delete-order]"
        );

    if (boutonSupprimer) {
        supprimerCommandeFrontend(
            boutonSupprimer.dataset.deleteOrder
        );
    }
}



function commandeEstEnAttente(commande) {
    return Boolean(
        commande &&
        normaliserTexteCommande(
            commande.statut
        ) === "en-attente"
    );
}


function commandeEstConfirmee(commande) {
    return Boolean(
        commande &&
        normaliserTexteCommande(
            commande.statut
        ) === "confirmee"
    );
}


function commandePeutEtreModifiee(commande) {
    if (!commande) {
        return false;
    }

    return [
        "en-attente",
        "confirmee"
    ].includes(
        normaliserTexteCommande(
            commande.statut
        )
    );
}


function commandePeutEtreAnnulee(commande) {
    return commandePeutEtreModifiee(
        commande
    );
}


function commandePeutEtreSupprimee(commande) {
    return commandeEstEnAttente(
        commande
    );
}


function commandeDejaConvertieEnVente(commande) {
    if (!commande) {
        return false;
    }

    const statut =
        normaliserTexteCommande(
            commande.statut
        );

    return Boolean(
        String(
            commande.idVente ||
            ""
        ).trim()
    ) ||
    statut === "convertie-en-vente" ||
    statut === "terminee";
}


function preparerConversionCommandeEnVente(
    idCommande
) {
    const commande =
        commandesChargees.find(
            element =>
                String(element.idCommande) ===
                String(idCommande)
        );

    if (!commande) {
        afficherMessageCommande(
            "Commande introuvable.",
            "error"
        );

        if (typeof showToast === "function") {
            showToast(
                "Commande introuvable.",
                "error"
            );
        }

        return;
    }

    if (commandeDejaConvertieEnVente(commande)) {
        if (typeof showToast === "function") {
            showToast(
                "Cette commande est déjà convertie en vente.",
                "info"
            );
        }

        return;
    }

    if (!commandeEstConfirmee(commande)) {
        const message =
            "Seule une commande Confirmée peut être transformée en vente.";

        afficherMessageCommande(
            message,
            "error"
        );

        if (typeof showToast === "function") {
            showToast(
                message,
                "error"
            );
        }

        return;
    }

    const lignes =
        Array.isArray(commande.lignes)
            ? commande.lignes
            : Array.isArray(commande.detailsCommande)
                ? commande.detailsCommande
                : [];

    if (!lignes.length) {
        if (typeof showToast === "function") {
            showToast(
                "Cette commande ne contient aucun produit.",
                "error"
            );
        }

        return;
    }

    const payload = {
        version: 1,
        source: "commande",
        idCommande:
            commande.idCommande,
        numeroCommande:
            commande.numeroCommande ||
            commande.idCommande,
        idClient:
            commande.idClient,
        remiseGlobale:
            convertirNombre(
                commande.remiseTotale
            ),
        fraisLivraison:
            convertirNombre(
                commande.fraisLivraison
            ),
        modePaiement:
            commande.modePaiementPrevu ||
            "",
        commentaire:
            commande.commentaire ||
            "",
        lignes:
            lignes.map(
                ligne => ({
                    idProduit:
                        ligne.idProduit,
                    quantite:
                        convertirNombre(
                            ligne.quantite
                        ),
                    prixUnitaire:
                        convertirNombre(
                            ligne.prixUnitaire
                        ),
                    remise:
                        convertirNombre(
                            ligne.remise
                        ),
                    sousTotal:
                        convertirNombre(
                            ligne.sousTotal
                        )
                })
            )
    };

    try {
        sessionStorage.setItem(
            "visibl_commande_a_convertir_en_vente",
            JSON.stringify(payload)
        );

        window.location.href =
            "ventes.html?fromOrder=" +
            encodeURIComponent(
                commande.idCommande
            );

    } catch (error) {
        console.error(
            "Impossible de préparer la conversion de la commande :",
            error
        );

        if (typeof showToast === "function") {
            showToast(
                "Impossible d'ouvrir le formulaire de vente.",
                "error"
            );
        }
    }
}


async function ouvrirVenteLieeDepuisCommande(idVente) {
    const id = String(idVente || "").trim();
    if (!id) return;

    const modal = document.getElementById("linked-sale-modal");
    const loading = document.getElementById("linked-sale-loading");
    const content = document.getElementById("linked-sale-content");
    if (!modal) return;

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    if (loading) loading.hidden = false;
    if (content) content.hidden = true;

    try {
        if (typeof apiGet !== "function") {
            throw new Error("Service des ventes indisponible.");
        }

        const resultat = await apiGet("getVentes");
        const ventes = Array.isArray(resultat?.data)
            ? resultat.data
            : Array.isArray(resultat?.data?.ventes)
                ? resultat.data.ventes
                : Array.isArray(resultat?.ventes)
                    ? resultat.ventes
                    : [];

        const vente = ventes.find(element =>
            String(element.idVente || element["ID Vente"] || "").trim() === id
        );

        if (!vente) {
            throw new Error("La vente liée n’a pas été trouvée.");
        }

        afficherVenteLieeCommande(vente);
        if (content) content.hidden = false;
    } catch (error) {
        fermerVenteLieeCommande();
        if (typeof showToast === "function") {
            showToast(error.message || "Impossible d’afficher la vente liée.", "error");
        }
    } finally {
        if (loading) loading.hidden = true;
    }
}


async function voirCommande(idCommande) {
    const commande =
        commandesChargees.find(
            element =>
                String(element.idCommande) ===
                String(idCommande)
        );

    if (!commande) {
        if (typeof showToast === "function") {
            showToast(
                "Commande introuvable.",
                "error"
            );
        }
        return;
    }

    const titre =
        document.getElementById(
            "view-order-modal-title"
        );

    const sousTitre =
        document.getElementById(
            "view-order-modal-subtitle"
        );

    const zoneGenerale =
        document.getElementById(
            "view-order-general-details"
        );

    const zoneFinanciere =
        document.getElementById(
            "view-order-financial-details"
        );

    const tbody =
        document.getElementById(
            "view-order-lines-body"
        );

    const modal =
        document.getElementById(
            "view-order-modal"
        );

    if (
        !zoneGenerale ||
        !zoneFinanciere ||
        !tbody ||
        !modal
    ) {
        return;
    }

    /*
     * Ouvre la fenêtre immédiatement, quel que soit le statut.
     * Les éventuelles données complémentaires de la vente liée sont
     * récupérées ensuite sans bloquer l'affichage de la commande.
     */
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    const client =
        obtenirNomClientCommandeParId(
            commande.idClient
        ) ||
        commande.idClient ||
        "—";

    const livreur =
        obtenirNomLivreurCommandeParId(
            commande.idLivreur
        ) ||
        (
            commande.idLivreur
                ? commande.idLivreur
                : "Non affecté"
        );

    if (titre) {
        titre.textContent =
            commande.numeroCommande ||
            commande.idCommande ||
            "Détails de la commande";
    }

    if (sousTitre) {
        sousTitre.textContent =
            `Commande du ${
                commande.dateCommande || "—"
            } à ${
                commande.heureCommande || "—"
            }`;
    }

    const detailsGeneraux = [
        ["fa-hashtag", "ID Commande", commande.idCommande],
        ["fa-user", "Client", client],
        [
            "fa-store",
            "Mode de réception",
            normaliserTexteCommande(
                commande.modeReception ||
                "livraison"
            ) === "livraison"
                ? "Livraison"
                : "Retrait en boutique"
        ],
        [
            "fa-truck-fast",
            "Statut livraison",
            formaterLibelleStatutLivraisonCommande(
                commande.statutLivraison ||
                (
                    normaliserTexteCommande(
                        commande.modeReception ||
                        "livraison"
                    ) === "livraison"
                        ? "a-preparer"
                        : "retrait-boutique"
                )
            )
        ],
        ["fa-motorcycle", "Livreur", livreur],
        ["fa-location-dot", "Commune", commande.communeLivraison],
        ["fa-map", "Zone / quartier", commande.zoneLivraison],
        ["fa-map-pin", "Adresse de livraison", commande.adresseLivraison],
        [
            "fa-bullseye",
            "Origine de la commande",
            commande.origine ||
            commande.origineCommande ||
            "Commande"
        ],
        [
            "fa-receipt",
            "ID Vente liée",
            commande.idVente || "—"
        ],
        ["fa-credit-card", "Mode de paiement prévu", commande.modePaiementPrevu],
        ["fa-message", "Commentaire", commande.commentaire]
    ];

    zoneGenerale.innerHTML =
        detailsGeneraux
            .map(
                ([icone, libelle, valeur]) => `
                    <div class="order-info-row">
                        <span class="order-info-row-icon">
                            <i class="fa-solid ${icone}"></i>
                        </span>

                        <span class="order-info-row-label">
                            ${echapperHTMLCommande(libelle)}
                        </span>

                        <strong class="order-info-row-value">
                            ${echapperHTMLCommande(valeur || "—")}
                        </strong>
                    </div>
                `
            )
            .join("");

    const lignes =
        Array.isArray(commande.lignes)
            ? commande.lignes
            : Array.isArray(commande.detailsCommande)
                ? commande.detailsCommande
                : [];

    if (!lignes.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table">
                    Aucun produit enregistré pour cette commande.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML =
            lignes
                .map(
                    (ligne, index) => {
                        const designation =
                            obtenirNomProduitCommandeParId(
                                ligne.idProduit
                            ) ||
                            ligne.designation ||
                            ligne.idProduit ||
                            "Produit";

                        return `
                            <tr>
                                <td>${index + 1}</td>
                                <td>
                                    <div class="order-product-cell">
                                        <span class="order-product-thumb">
                                            <i class="fa-solid fa-box"></i>
                                        </span>

                                        <div>
                                            <strong>
                                                ${echapperHTMLCommande(designation)}
                                            </strong>

                                            <small>
                                                ${echapperHTMLCommande(
                                                    ligne.idProduit || ""
                                                )}
                                            </small>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    ${convertirNombre(
                                        ligne.quantite
                                    )}
                                </td>
                                <td>
                                    ${formaterFCFA(
                                        ligne.prixUnitaire
                                    )}
                                </td>
                                <td>
                                    ${formaterFCFA(
                                        ligne.remise
                                    )}
                                </td>
                                <td>
                                    <strong>
                                        ${formaterFCFA(
                                            ligne.sousTotal
                                        )}
                                    </strong>
                                </td>
                            </tr>
                        `;
                    }
                )
                .join("");
    }

    const compteurProduits =
        document.getElementById(
            "view-order-products-count"
        );

    if (compteurProduits) {
        const nombreArticles =
            lignes.reduce(
                (total, ligne) =>
                    total +
                    convertirNombre(
                        ligne.quantite
                    ),
                0
            );

        compteurProduits.textContent =
            `${nombreArticles} article${
                nombreArticles > 1 ? "s" : ""
            } commandé${
                nombreArticles > 1 ? "s" : ""
            }`;
    }

    /*
     * "Voir la commande" utilise uniquement les données financières
     * de la commande affichée.
     *
     * Important :
     * - aucune relecture de toutes les ventes ici ;
     * - pas de mélange Commande / Vente liée dans le même récapitulatif ;
     * - le backend synchronise déjà les paiements de la vente vers la commande.
     */
    const totalAPayerAffiche =
        Math.max(
            0,
            convertirNombre(
                commande.totalAPayer
            )
        );

    const montantPayeAffiche =
        Math.max(
            0,
            convertirNombre(
                commande.montantPaye
            )
        );

    const montantAvoirAffiche =
        Math.max(
            0,
            convertirNombre(
                commande.montantAvoirUtilise
            )
        );

    const montantRegleCalcule =
        Math.min(
            totalAPayerAffiche,
            montantPayeAffiche +
            montantAvoirAffiche
        );

    const montantRegleAffiche =
        commande.montantRegle !== undefined &&
        commande.montantRegle !== null &&
        commande.montantRegle !== ""
            ? Math.max(
                0,
                Math.min(
                    totalAPayerAffiche,
                    convertirNombre(
                        commande.montantRegle
                    )
                )
              )
            : montantRegleCalcule;

    const resteAPayerAffiche =
        commande.resteAPayer !== undefined &&
        commande.resteAPayer !== null &&
        commande.resteAPayer !== ""
            ? Math.max(
                0,
                convertirNombre(
                    commande.resteAPayer
                )
              )
            : Math.max(
                0,
                totalAPayerAffiche -
                montantRegleAffiche
              );

    const statutPaiementAffiche =
        commande.statutPaiement ||
        (
            montantRegleAffiche <= 0
                ? "Impayée"
                : (
                    resteAPayerAffiche > 0
                        ? "Partiellement payée"
                        : "Payée"
                  )
        );

    const detailsFinanciers = [
        ["Sous-total", formaterFCFA(commande.totalCommande), ""],
        ["Remise totale", formaterFCFA(commande.remiseTotale), "is-discount"],
        ["Frais de livraison", formaterFCFA(commande.fraisLivraison), ""],
        ["Total à payer", formaterFCFA(totalAPayerAffiche), "is-total"],
        ["Paiement encaissé", formaterFCFA(montantPayeAffiche), "is-paid"],
        ...(montantAvoirAffiche > 0
            ? [["Avoir client utilisé", formaterFCFA(montantAvoirAffiche), "is-credit"]]
            : []),
        ["Total réglé", formaterFCFA(montantRegleAffiche), "is-settled"],
        ["Reste à payer", formaterFCFA(resteAPayerAffiche), "is-balance"],
        [
            "Statut paiement",
            String(statutPaiementAffiche || "—")
                .replaceAll("-", " ")
                .replace(/^./, caractere => caractere.toUpperCase()),
            "is-payment-status"
        ]
    ];

    zoneFinanciere.innerHTML =
        detailsFinanciers
            .map(
                ([libelle, valeur, classe]) => `
                    <div class="order-financial-row ${classe}">
                        <span>
                            ${echapperHTMLCommande(libelle)}
                        </span>

                        <strong>
                            ${echapperHTMLCommande(valeur)}
                        </strong>
                    </div>
                `
            )
            .join("");

    definirTexteVueCommande(
        "view-order-origin-summary",
        commande.origine ||
        commande.origineCommande ||
        "Commande"
    );

    definirTexteVueCommande(
        "view-order-sale-id-summary",
        commande.idVente ||
        "Aucune vente liée"
    );

    definirTexteVueCommande(
        "view-order-date-summary",
        formaterDateHeureVueCommande(
            commande.dateCommande,
            commande.heureCommande
        )
    );

    definirTexteVueCommande(
        "view-order-delivery-summary",
        formaterDateVueCommande(
            commande.dateLivraisonPrevue
        )
    );

    definirTexteVueCommande(
        "view-order-payment-summary",
        commande.modePaiementPrevu || "Non défini"
    );

    const statutVue =
        document.getElementById(
            "view-order-status-summary"
        );

    if (statutVue) {
        statutVue.textContent =
            formaterStatutVueCommande(
                commande.statut
            );

        statutVue.className =
            "order-view-status " +
            obtenirClasseStatutVueCommande(
                commande.statut
            );
    }

    /* La modale est déjà ouverte depuis le début de la fonction. */
}



function definirTexteVueCommande(id, valeur) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            valeur || "—";
    }
}


function formaterDateVueCommande(valeur) {
    if (!valeur) {
        return "Non définie";
    }

    const date =
        new Date(
            `${valeur}T00:00:00`
        );

    if (isNaN(date.getTime())) {
        return valeur;
    }

    return new Intl.DateTimeFormat(
        "fr-FR",
        {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }
    ).format(date);
}


function formaterDateHeureVueCommande(date, heure) {
    const dateFormatee =
        formaterDateVueCommande(date);

    return heure
        ? `${dateFormatee} à ${heure}`
        : dateFormatee;
}


function formaterStatutVueCommande(statut) {
    return String(
        statut || "Non défini"
    )
        .replaceAll("-", " ")
        .toUpperCase();
}


function obtenirClasseStatutVueCommande(statut) {
    const valeur =
        normaliserTexteCommande(statut);

    if (
        valeur === "terminee" ||
        valeur === "livree" ||
        valeur === "convertie-en-vente"
    ) {
        return "status-success";
    }

    if (
        valeur === "annulee"
    ) {
        return "status-danger";
    }

    if (
        valeur === "en-preparation" ||
        valeur === "confirmee" ||
        valeur === "prete"
    ) {
        return "status-warning";
    }

    return "status-neutral";
}


function fermerModaleVoirCommande() {
    const modal =
        document.getElementById(
            "view-order-modal"
        );

    modal?.classList.remove(
        "active"
    );

    modal?.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );
}


async function ouvrirModificationCommande(
    idCommande
) {
    const debutOuvertureModification =
        performance.now();

    const commande =
        commandesChargees.find(
            element =>
                String(element.idCommande) ===
                String(idCommande)
        );

    if (!commande) {
        return;
    }

    if (commandeDejaConvertieEnVente(commande)) {
        if (typeof showToast === "function") {
            showToast(
                "Une commande convertie en vente ne peut plus être modifiée ici.",
                "info"
            );
        }
        return;
    }

    commandeEnModificationId =
        commande.idCommande;

    reservationCommandeEnModification = new Map();

    if (normaliserTexteCommande(commande.statut) === "confirmee") {
        (Array.isArray(commande.lignes) ? commande.lignes : [])
            .forEach(ligne => {
                const id = String(ligne.idProduit || "").trim();
                const quantite = Math.max(
                    0,
                    Math.trunc(convertirNombre(ligne.quantite))
                );

                if (id && quantite > 0) {
                    reservationCommandeEnModification.set(
                        id,
                        (reservationCommandeEnModification.get(id) || 0) + quantite
                    );
                }
            });
    }

    /*
     * OUVERTURE RAPIDE DE LA MODIFICATION
     *
     * Les données de la commande sont déjà présentes dans commandesChargees
     * et le catalogue Produits est déjà chargé pour le module Commandes.
     * On ne bloque donc plus l'ouverture de la fenêtre avec un nouvel appel réseau.
     *
     * Le stock est rafraîchi discrètement après l'ouverture.
     */
    const idCommandeModificationEnCours =
        String(commande.idCommande || "");

    definirValeurCommande(
        "order-id",
        commande.idCommande
    );

    definirValeurCommande(
        "order-number",
        commande.numeroCommande
    );

    definirValeurCommande(
        "order-origin",
        commande.origine ||
        commande.origineCommande ||
        "Commande"
    );

    definirValeurCommande(
        "order-sale-id",
        commande.idVente ||
        ""
    );

    definirValeurCommande(
        "order-client",
        commande.idClient
    );

    definirValeurCommande(
        "order-date",
        commande.dateCommande
    );

    definirValeurCommande(
        "order-time",
        commande.heureCommande
    );

    definirValeurCommande(
        "order-status",
        commande.statut
    );

    definirValeurCommande(
        "order-discount",
        commande.remiseTotale
    );

    definirValeurCommande(
        "order-reception-mode",
        commande.modeReception ||
        "livraison"
    );

    definirValeurCommande(
        "order-delivery-fees",
        commande.fraisLivraison
    );

    definirValeurCommande(
        "order-delivery-zone",
        commande.zoneLivraison
    );

    definirValeurCommande(
        "order-delivery-commune",
        commande.communeLivraison
    );

    definirValeurCommande(
        "order-delivery-address",
        commande.adresseLivraison
    );

    definirValeurCommande(
        "order-delivery-date",
        commande.dateLivraisonPrevue
    );

    /*
     * PAIEMENT EN MODIFICATION
     *
     * IMPORTANT :
     * on ne remplit plus l'encaissement avant de reconstruire les lignes
     * et le Total à payer. Sinon actualiserCreditClientCommande() appelle
     * recalculerPaiementCommande() avec un total encore à 0 et écrase
     * l'encaissement existant.
     */
    definirValeurCommande(
        "order-payment-method",
        commande.modePaiementPrevu
    );

    definirValeurCommande(
        "order-payment-method-real",
        commande.modePaiement || commande.modePaiementPrevu || ""
    );

    definirValeurCommande(
        "order-comment",
        commande.commentaire
    );

    appliquerModeReceptionCommande();

    lignesCommande =
        Array.isArray(commande.lignes)
            ? commande.lignes.map(
                ligne => ({
                    idLigne:
                        ligne.idDetailCommande ||
                        crypto.randomUUID?.() ||
                        String(Date.now()),
                    idProduit:
                        ligne.idProduit,
                    designation:
                        obtenirNomProduitCommandeParId(
                            ligne.idProduit
                        ) ||
                        ligne.idProduit,
                    stockDisponible:
                        obtenirStockProduit(
                            catalogueProduitsCommande.find(
                                produit =>
                                    obtenirIdProduitCommande(
                                        produit
                                    ) ===
                                    String(ligne.idProduit)
                            ) || {}
                        ),
                    quantite:
                        ligne.quantite,
                    prixUnitaire:
                        ligne.prixUnitaire,
                    remise:
                        ligne.remise,
                    sousTotal:
                        ligne.sousTotal
                })
            )
            : [];

    afficherLignesCommande();
    recalculerTotauxCommande();

    /*
     * Le total est maintenant disponible : on peut restaurer
     * l'encaissement déjà enregistré sans qu'il soit remis à zéro.
     */
    definirValeurCommande(
        "order-paid-amount",
        commande.montantPaye || 0
    );

    definirValeurCommande(
        "order-credit-used",
        commande.montantAvoirUtilise || 0
    );

    actualiserCreditClientCommande();
    recalculerPaiementCommande();

    afficherLivreursParCommuneCommande(
        commande.idLivreur || ""
    );

    const titre =
        document.getElementById(
            "order-modal-title"
        );

    const bouton =
        document.getElementById(
            "save-order-btn"
        );

    if (titre) {
        titre.textContent =
            "Modifier la commande";
    }

    if (bouton) {
        bouton.textContent =
            "Enregistrer les modifications";
    }

    const modal =
        document.getElementById(
            "order-modal"
        );

    modal?.classList.add("active");
    modal?.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

    console.log(
        "VISIBL — ouverture modification commande :",
        Math.round(
            performance.now() -
            debutOuvertureModification
        ),
        "ms"
    );

    /*
     * Actualisation du stock en arrière-plan :
     * elle ne bloque plus le clic sur « Modifier ».
     * Si l'utilisateur est toujours sur la même commande lorsque
     * la réponse revient, on met uniquement à jour les stocks en mémoire.
     */
    chargerProduitsCommande()
        .then(() => {
            if (
                String(commandeEnModificationId || "") !==
                idCommandeModificationEnCours
            ) {
                return;
            }

            lignesCommande =
                lignesCommande.map(ligne => ({
                    ...ligne,
                    designation:
                        obtenirNomProduitCommandeParId(
                            ligne.idProduit
                        ) ||
                        ligne.designation ||
                        ligne.idProduit,
                    stockDisponible:
                        obtenirStockProduit(
                            catalogueProduitsCommande.find(
                                produit =>
                                    obtenirIdProduitCommande(
                                        produit
                                    ) ===
                                    String(ligne.idProduit)
                            ) || {}
                        )
                }));

            afficherLignesCommande();
        })
        .catch(error => {
            console.warn(
                "Actualisation différée du stock en modification impossible :",
                error
            );
        });
}



/* ===========================================================
   FEEDBACK SOFT — CONFIRMATION COMMANDE
   Loader central puis succès au même endroit.
=========================================================== */

function obtenirFeedbackConfirmationCommande() {
    let overlay =
        document.getElementById(
            "order-confirm-soft-feedback"
        );

    if (overlay) {
        return overlay;
    }

    const styleId =
        "order-confirm-soft-feedback-style";

    if (!document.getElementById(styleId)) {
        const style =
            document.createElement("style");

        style.id = styleId;

        style.textContent = `
            #order-confirm-soft-feedback {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: rgba(15, 23, 42, 0.18);
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition:
                    opacity .18s ease,
                    visibility .18s ease;
            }

            #order-confirm-soft-feedback.is-visible {
                opacity: 1;
                visibility: visible;
                pointer-events: all;
            }

            #order-confirm-soft-feedback .confirm-soft-card {
                position: relative;
                width: min(390px, 100%);
                padding: 22px 24px;
                border: 1px solid rgba(148, 163, 184, .24);
                border-radius: 16px;
                background: rgba(255, 255, 255, .98);
                box-shadow: 0 18px 48px rgba(15, 23, 42, .18);
                text-align: center;
                overflow: hidden;
            }

            #order-confirm-soft-feedback .confirm-loading-view {
                display: flex;
                align-items: center;
                gap: 14px;
                text-align: left;
            }

            #order-confirm-soft-feedback .confirm-spinner {
                width: 30px;
                height: 30px;
                flex: 0 0 30px;
                border: 3px solid rgba(37, 99, 235, .16);
                border-top-color: #2563eb;
                border-radius: 50%;
                animation: visibl-confirm-spin .75s linear infinite;
            }

            #order-confirm-soft-feedback .confirm-copy {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            #order-confirm-soft-feedback .confirm-title {
                color: #0f172a;
                font-size: 15px;
                line-height: 1.35;
            }

            #order-confirm-soft-feedback .confirm-text {
                color: #64748b;
                font-size: 12px;
                line-height: 1.45;
            }

            #order-confirm-soft-feedback .confirm-success-view {
                display: none;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }

            #order-confirm-soft-feedback.is-success
            .confirm-loading-view {
                display: none;
            }

            #order-confirm-soft-feedback.is-success
            .confirm-success-view {
                display: flex;
            }

            #order-confirm-soft-feedback .confirm-success-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 64px;
                height: 64px;
                margin-bottom: 3px;
                border-radius: 50%;
                background: #10b981;
                color: #fff;
                font-size: 35px;
                font-weight: 800;
                box-shadow:
                    0 0 0 9px rgba(16, 185, 129, .08),
                    0 10px 24px rgba(16, 185, 129, .22);
                animation: visibl-confirm-pop .32s ease-out both;
            }

            #order-confirm-soft-feedback .confirm-success-title {
                margin-top: 5px;
                color: #059669;
                font-size: 20px;
                line-height: 1.25;
            }

            #order-confirm-soft-feedback .confirm-success-text {
                color: #64748b;
                font-size: 13px;
                line-height: 1.5;
            }

            #order-confirm-soft-feedback .confirm-success-ref {
                width: 100%;
                margin-top: 7px;
                padding: 10px 12px;
                border: 1px solid #dbeafe;
                border-radius: 10px;
                background: #f8fbff;
            }

            #order-confirm-soft-feedback .confirm-success-ref span {
                display: block;
                margin-bottom: 2px;
                color: #64748b;
                font-size: 11px;
            }

            #order-confirm-soft-feedback .confirm-success-ref strong {
                color: #0f172a;
                font-size: 14px;
            }

            #order-confirm-soft-feedback .confirm-success-btn {
                min-width: 165px;
                margin-top: 8px;
                padding: 10px 18px;
                border: 0;
                border-radius: 9px;
                background: #10b981;
                color: #fff;
                font-size: 13px;
                font-weight: 800;
                cursor: pointer;
                box-shadow: 0 8px 18px rgba(16, 185, 129, .20);
            }

            @keyframes visibl-confirm-spin {
                to {
                    transform: rotate(360deg);
                }
            }

            @keyframes visibl-confirm-pop {
                0% {
                    transform: scale(.72);
                    opacity: 0;
                }

                72% {
                    transform: scale(1.07);
                    opacity: 1;
                }

                100% {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            @media (max-width: 640px) {
                #order-confirm-soft-feedback {
                    padding: 16px;
                }

                #order-confirm-soft-feedback .confirm-soft-card {
                    padding: 20px 18px;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                #order-confirm-soft-feedback .confirm-spinner,
                #order-confirm-soft-feedback .confirm-success-icon {
                    animation: none;
                }
            }
        `;

        document.head.appendChild(style);
    }

    overlay =
        document.createElement("div");

    overlay.id =
        "order-confirm-soft-feedback";

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

    overlay.innerHTML = `
        <div
            class="confirm-soft-card"
            role="status"
            aria-live="polite"
        >
            <div class="confirm-loading-view">
                <span
                    class="confirm-spinner"
                    aria-hidden="true"
                ></span>

                <div class="confirm-copy">
                    <strong class="confirm-title">
                        Confirmation de la commande…
                    </strong>

                    <span class="confirm-text">
                        Vérification et réservation du stock en cours.
                    </span>
                </div>
            </div>

            <div class="confirm-success-view">
                <div
                    class="confirm-success-icon"
                    aria-hidden="true"
                >
                    ✓
                </div>

                <strong class="confirm-success-title">
                    Commande confirmée !
                </strong>

                <span class="confirm-success-text">
                    La commande a été confirmée avec succès.
                </span>

                <div class="confirm-success-ref">
                    <span>N° de commande</span>
                    <strong class="confirm-success-ref-value"></strong>
                </div>

                <button
                    type="button"
                    class="confirm-success-btn"
                >
                    ✓ Parfait !
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(
        overlay
    );

    return overlay;
}


function demarrerFeedbackConfirmationCommande() {
    const overlay =
        obtenirFeedbackConfirmationCommande();

    overlay.classList.remove(
        "is-success"
    );

    overlay.classList.add(
        "is-visible"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );
}


function afficherSuccesConfirmationCommande(
    commande
) {
    return new Promise(resolve => {
        const overlay =
            obtenirFeedbackConfirmationCommande();

        const reference =
            overlay.querySelector(
                ".confirm-success-ref-value"
            );

        if (reference) {
            reference.textContent =
                String(
                    commande?.numeroCommande ||
                    commande?.idCommande ||
                    ""
                );
        }

        overlay.classList.add(
            "is-success"
        );

        const bouton =
            overlay.querySelector(
                ".confirm-success-btn"
            );

        const terminer = () => {
            bouton?.removeEventListener(
                "click",
                terminer
            );

            resolve();
        };

        bouton?.addEventListener(
            "click",
            terminer,
            { once: true }
        );

        setTimeout(
            () => bouton?.focus(),
            80
        );
    });
}


function terminerFeedbackConfirmationCommande() {
    const overlay =
        document.getElementById(
            "order-confirm-soft-feedback"
        );

    if (!overlay) {
        return;
    }

    overlay.classList.remove(
        "is-visible",
        "is-success"
    );

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );
}


async function changerStatutCommandeFrontend(
    idCommande,
    action
) {
    const commande =
        commandesChargees.find(
            element =>
                String(element.idCommande) ===
                String(idCommande)
        );

    if (!commande) {
        return;
    }

    if (
        action === "finaliser-retrait"
    ) {
        const montantPaye =
            convertirNombre(
                commande.montantPaye
            );

        const montantAvoir =
            convertirNombre(
                commande.montantAvoirUtilise
            );

        if (
            montantPaye +
            montantAvoir <=
            0
        ) {
            if (
                typeof showToast ===
                "function"
            ) {
                showToast(
                    "Enregistrez d'abord un règlement ou utilisez un avoir client.",
                    "error"
                );
            } else {
                window.alert(
                    "Enregistrez d'abord un règlement ou utilisez un avoir client."
                );
            }
            return;
        }

        const confirmeRetrait =
            window.confirm(
                `Confirmer la remise au client de la commande ${
                    commande.numeroCommande ||
                    commande.idCommande
                } ? Le stock sera sorti et la vente sera créée automatiquement.`
            );

        if (!confirmeRetrait) {
            return;
        }
    }

    if (
        action === "annuler"
    ) {
        const confirme =
            window.confirm(
                `Annuler la commande ${
                    commande.numeroCommande ||
                    commande.idCommande
                } ?`
            );

        if (!confirme) {
            return;
        }
    }

    try {
        if (action === "confirmer") {
            demarrerFeedbackConfirmationCommande();
        }

        const debutActionStatutNavigateur =
            performance.now();

        const debutApiStatut =
            performance.now();

        const resultat =
            await apiPost(
                "changerStatutCommande",
                {
                    idCommande:
                        commande.idCommande,
                    operation:
                        action
                }
            );

        const tempsApiStatut =
            Math.round(
                performance.now() -
                debutApiStatut
            );

        console.group(
            `VISIBL — DIAGNOSTIC STATUT COMMANDE — ${action}`
        );
        console.log(
            "Temps navigateur apiPost :",
            tempsApiStatut,
            "ms"
        );
        console.log(
            "Diagnostic backend statut :",
            resultat?.diagnosticTemps || null
        );
        console.log(
            "Diagnostic doPost global :",
            resultat?.diagnosticDoPost || null
        );

        console.log(
            "Diagnostic routeur statut :",
            resultat?.diagnosticRouteurStatut || null
        );

        console.log(
            "Diagnostic notifications :",
            resultat?.diagnosticNotifications || null
        );
        if (resultat?.diagnosticTemps) {
            console.table(
                resultat.diagnosticTemps
            );
        }
        if (resultat?.diagnosticDoPost) {
            console.table(
                resultat.diagnosticDoPost
            );
        }

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de modifier le statut de la commande."
            );
        }

        const miseAJour =
            resultat.data ||
            resultat.commande ||
            {
                ...commande,
                statut:
                    resultat.statut ||
                    commande.statut
            };

        mettreAJourCommandeLocale(
            {
                ...commande,
                ...miseAJour
            }
        );

        chargerProduitsCommande()
            .catch(error => {
                console.warn(
                    "Actualisation du stock après changement de statut impossible :",
                    error
                );
            });

        if (
            typeof showToast === "function"
        ) {
            showToast(
                resultat.message,
                "success"
            );
        }

        const debutRechargementApresStatut =
            performance.now();

        await chargerCommandes();

        const tempsRechargementApresStatut =
            Math.round(
                performance.now() -
                debutRechargementApresStatut
            );

        console.log(
            "Rechargement Commandes après statut :",
            tempsRechargementApresStatut,
            "ms"
        );
        console.log(
            "Temps total clic → fin traitement :",
            Math.round(
                performance.now() -
                debutActionStatutNavigateur
            ),
            "ms"
        );
        console.groupEnd();

        if (action === "confirmer") {
            await afficherSuccesConfirmationCommande(
                {
                    ...commande,
                    ...miseAJour
                }
            );

            terminerFeedbackConfirmationCommande();
        }

    } catch (error) {
        if (action === "confirmer") {
            terminerFeedbackConfirmationCommande();
        }

        console.error(
            "Erreur changement statut commande :",
            error
        );

        try {
            console.groupEnd();
        } catch (e) {}

        if (
            typeof showToast === "function"
        ) {
            showToast(
                error.message ||
                "Impossible de modifier le statut de la commande.",
                "error"
            );
        }
    }
}


async function supprimerCommandeFrontend(
    idCommande
) {
    const commande =
        commandesChargees.find(
            element =>
                String(element.idCommande) ===
                String(idCommande)
        );

    if (!commande) {
        return;
    }

    const confirme =
        window.confirm(
            `Supprimer définitivement la commande ${
                commande.numeroCommande ||
                commande.idCommande
            } ?`
        );

    if (!confirme) {
        return;
    }

    try {
        const resultat =
            await apiPost(
                "deleteCommande",
                {
                    idCommande:
                        commande.idCommande
                }
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de supprimer la commande."
            );
        }

        retirerCommandeLocale(
            commande.idCommande
        );

        if (typeof showToast === "function") {
            showToast(
                resultat.message,
                "success"
            );
        }

    } catch (error) {
        console.error(
            "Erreur de suppression de la commande :",
            error
        );

        if (typeof showToast === "function") {
            showToast(
                error.message ||
                "Impossible de supprimer la commande.",
                "error"
            );
        }
    }
}



function initialiserInteractionsHeaderCommande() {
    const boutonRecherche =
        document.getElementById(
            "mobile-search-btn"
        );

    const conteneurRecherche =
        document.querySelector(
            ".header .search-container"
        );

    const boutonNotification =
        document.getElementById(
            "notification-button"
        );

    const panneauNotification =
        document.getElementById(
            "notification-panel"
        );

    const fermerRecherche = () => {
        conteneurRecherche?.classList.remove(
            "active"
        );
    };

    const fermerNotifications = () => {
        if (panneauNotification) {
            panneauNotification.hidden = true;
        }

        boutonNotification?.setAttribute(
            "aria-expanded",
            "false"
        );
    };

    /*
     * app.js gère déjà l'ouverture/fermeture de ces deux panneaux.
     * Ici on ne fait que rendre les deux interactions exclusives,
     * exactement comme dans le module Ventes.
     */
    boutonRecherche?.addEventListener(
        "click",
        () => {
            fermerNotifications();
        }
    );

    boutonNotification?.addEventListener(
        "click",
        () => {
            fermerRecherche();
        }
    );

    document.addEventListener(
        "click",
        event => {
            const dansRecherche =
                event.target.closest(
                    ".header .search-box"
                );

            const dansNotifications =
                event.target.closest(
                    ".header .notification-menu"
                );

            if (
                !dansRecherche &&
                !dansNotifications
            ) {
                fermerRecherche();
                fermerNotifications();
                fermerMenuActionsCommandes();
                fermerMenusActionsLigneCommande();
            }
        }
    );
}

function initialiserMenuActionsCommandes() {
    const trigger = document.getElementById("orders-actions-trigger");
    const menu = document.getElementById("orders-actions-dropdown");
    trigger?.addEventListener("click", event => {
        event.stopPropagation();
        const ouvrir = Boolean(menu?.hidden);
        fermerMenusActionsLigneCommande();
        if (ouvrir && modeSelectionCommandes) {
            definirModeSelectionCommandes(false);
        }
        if (menu) menu.hidden = !ouvrir;
        trigger.setAttribute("aria-expanded", ouvrir ? "true" : "false");
    });
    menu?.addEventListener("click", event => event.stopPropagation());
}

function fermerMenuActionsCommandes() {
    const trigger = document.getElementById("orders-actions-trigger");
    const menu = document.getElementById("orders-actions-dropdown");
    if (menu) menu.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
}

function initialiserSelectionCommandes() {
    const bouton = document.getElementById("selection-orders-btn");
    const tout = document.getElementById("select-all-orders");

    bouton?.addEventListener("click", () => {
        if (!modeSelectionCommandes) {
            fermerMenuActionsCommandes();
        }
        definirModeSelectionCommandes(!modeSelectionCommandes);
    });
    document.getElementById("close-orders-selection-btn")?.addEventListener("click", () => definirModeSelectionCommandes(false));
    document.getElementById("select-visible-orders-btn")?.addEventListener("click", selectionnerCommandesVisibles);
    document.getElementById("clear-orders-selection-btn")?.addEventListener("click", () => {
        commandesSelectionnees.clear();
        synchroniserSelectionCommandes();
    });
    document.getElementById("delete-orders-selection-btn")
        ?.addEventListener("click", supprimerSelectionCommandes);

    tout?.addEventListener("change", event => {
        const visibles = obtenirCommandesPageCourante();
        visibles.forEach(c => {
            const id = String(c.idCommande || "");
            if (!id) return;
            if (event.target.checked) commandesSelectionnees.add(id);
            else commandesSelectionnees.delete(id);
        });
        synchroniserSelectionCommandes();
    });

    document.getElementById("orders-table-body")?.addEventListener("change", event => {
        const checkbox = event.target.closest("[data-select-order]");
        if (!checkbox) return;
        const id = String(checkbox.dataset.selectOrder || "");
        if (checkbox.checked) commandesSelectionnees.add(id);
        else commandesSelectionnees.delete(id);
        synchroniserSelectionCommandes(false);
    });

    definirModeSelectionCommandes(false);
}

function definirModeSelectionCommandes(actif) {
    modeSelectionCommandes = Boolean(actif);
    document.body.classList.toggle("orders-selection-mode", modeSelectionCommandes);
    const bar = document.getElementById("orders-selection-bar");
    const bouton = document.getElementById("selection-orders-btn");
    if (bar) bar.hidden = !modeSelectionCommandes;
    bouton?.setAttribute("aria-pressed", String(modeSelectionCommandes));
    if (!modeSelectionCommandes) {
        commandesSelectionnees.clear();
    }
    synchroniserSelectionCommandes();
}


async function supprimerSelectionCommandes() {
    const ids = Array.from(commandesSelectionnees);
    if (!ids.length) {
        showToast?.("Sélectionnez au moins une commande.", "error");
        return;
    }

    if (!window.confirm(`Supprimer définitivement ${ids.length} commande(s) sélectionnée(s) ?`)) {
        return;
    }

    const bouton = document.getElementById("delete-orders-selection-btn");
    if (bouton) bouton.disabled = true;

    let supprimees = 0;
    let echecs = 0;

    try {
        for (const idCommande of ids) {
            try {
                const resultat = await apiPost("deleteCommande", { idCommande });
                if (!resultat?.success) throw new Error(resultat?.message || "Échec");
                retirerCommandeLocale(idCommande);
                commandesSelectionnees.delete(String(idCommande));
                supprimees++;
            } catch (error) {
                console.error("Suppression groupée commande :", idCommande, error);
                echecs++;
            }
        }

        synchroniserSelectionCommandes();
        if (!commandesSelectionnees.size) definirModeSelectionCommandes(false);

        if (supprimees) showToast?.(`${supprimees} commande(s) supprimée(s).`, "success");
        if (echecs) showToast?.(`${echecs} suppression(s) ont échoué.`, "error");
    } finally {
        if (bouton) bouton.disabled = false;
    }
}

function obtenirCommandesPageCourante() {
    const debut = (pageCommandesActuelle - 1) * taillePageCommandes;
    return commandesFiltrees.slice(debut, debut + taillePageCommandes);
}

function selectionnerCommandesVisibles() {
    obtenirCommandesPageCourante().forEach(c => {
        const id = String(c.idCommande || "");
        if (id) commandesSelectionnees.add(id);
    });
    synchroniserSelectionCommandes();
}

function synchroniserSelectionCommandes(rafraichir = true) {
    const compteur = document.getElementById("selected-orders-count");
    if (compteur) compteur.textContent = commandesSelectionnees.size;

    const visibles = obtenirCommandesPageCourante();
    const toutes = visibles.length > 0 && visibles.every(c => commandesSelectionnees.has(String(c.idCommande || "")));
    const selectAll = document.getElementById("select-all-orders");
    if (selectAll) {
        selectAll.checked = toutes;
        selectAll.indeterminate = !toutes && visibles.some(c => commandesSelectionnees.has(String(c.idCommande || "")));
    }

    if (rafraichir) {
        document.querySelectorAll("[data-select-order]").forEach(cb => {
            cb.checked = commandesSelectionnees.has(String(cb.dataset.selectOrder || ""));
        });
    }
}

function basculerMenuActionLigneCommande(trigger) {
    const id = String(trigger.dataset.orderMenuTrigger || "");
    const menu = document.querySelector(`[data-order-menu="${CSS.escape(id)}"]`);
    const ouvrir = Boolean(menu?.hidden);

    fermerMenusActionsLigneCommande();
    fermerMenuActionsCommandes();

    if (!menu || !ouvrir) {
        trigger.setAttribute("aria-expanded", "false");
        return;
    }

    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");

    /*
     * Menu adaptatif VISIBL :
     * - mobile/tablette <= 900px : le CSS l'affiche comme panneau bas ;
     * - desktop : le menu devient flottant dans le viewport et choisit
     *   automatiquement le haut ou le bas selon l'espace disponible.
     *
     * Cela évite qu'un menu de la dernière ligne soit coupé par le tableau
     * ou oblige l'utilisateur à faire défiler la page.
     */
    positionnerMenuContextuelVisibl(menu, trigger);
}


function positionnerMenuContextuelVisibl(menu, trigger) {
    if (!menu || !trigger) return;

    menu.classList.remove("opens-up", "visibl-floating-menu");
    menu.style.removeProperty("--visibl-menu-top");
    menu.style.removeProperty("--visibl-menu-left");
    menu.style.removeProperty("--visibl-menu-max-height");

    if (window.matchMedia("(max-width: 900px)").matches) {
        return;
    }

    const marge = 12;
    const ecart = 6;
    const rectTrigger = trigger.getBoundingClientRect();

    menu.classList.add("visibl-floating-menu");

    /*
     * Le menu doit être mesurable une fois visible et en position fixed.
     */
    const rectMenu = menu.getBoundingClientRect();
    const largeurMenu = Math.max(rectMenu.width, 220);
    const hauteurMenu = rectMenu.height;

    const espaceBas = window.innerHeight - rectTrigger.bottom - marge;
    const espaceHaut = rectTrigger.top - marge;
    const ouvrirVersHaut =
        hauteurMenu > espaceBas &&
        espaceHaut > espaceBas;

    const hauteurDisponible =
        Math.max(
            120,
            ouvrirVersHaut
                ? espaceHaut - ecart
                : espaceBas - ecart
        );

    const top =
        ouvrirVersHaut
            ? Math.max(
                marge,
                rectTrigger.top -
                Math.min(hauteurMenu, hauteurDisponible) -
                ecart
              )
            : Math.min(
                window.innerHeight - marge,
                rectTrigger.bottom + ecart
              );

    const left =
        Math.max(
            marge,
            Math.min(
                rectTrigger.right - largeurMenu,
                window.innerWidth - largeurMenu - marge
            )
        );

    if (ouvrirVersHaut) {
        menu.classList.add("opens-up");
    }

    menu.style.setProperty("--visibl-menu-top", `${Math.round(top)}px`);
    menu.style.setProperty("--visibl-menu-left", `${Math.round(left)}px`);
    menu.style.setProperty(
        "--visibl-menu-max-height",
        `${Math.floor(hauteurDisponible)}px`
    );
}


function fermerMenusActionsLigneCommande() {
    document.querySelectorAll(".order-row-actions-dropdown").forEach(menu => {
        menu.hidden = true;
        menu.classList.remove("opens-up", "visibl-floating-menu");
        menu.style.removeProperty("--visibl-menu-top");
        menu.style.removeProperty("--visibl-menu-left");
        menu.style.removeProperty("--visibl-menu-max-height");
    });

    document
        .querySelectorAll("[data-order-menu-trigger]")
        .forEach(btn =>
            btn.setAttribute("aria-expanded", "false")
        );
}

/*
 * Si la page ou le viewport bouge, on ferme les menus flottants.
 * Au prochain clic, leur position sera recalculée avec les nouvelles dimensions.
 */
window.addEventListener("resize", fermerMenusActionsLigneCommande);
window.addEventListener("scroll", fermerMenusActionsLigneCommande, true);


function exporterCommandesFiltreesCSV() {
    if (!Array.isArray(commandesFiltrees) || !commandesFiltrees.length) {
        if (typeof showToast === "function") showToast("Aucune commande à exporter.", "info");
        return;
    }

    const colonnes = ["N° Commande","Origine","Vente liée","Client","Date","Montant","Mode paiement","Statut livraison","Statut commande"];
    const lignes = commandesFiltrees.map(c => [
        c.numeroCommande || c.idCommande || "",
        c.origine || c.origineCommande || "",
        c.idVente || "",
        obtenirNomClientCommandeParId(c.idClient) || c.idClient || "",
        [c.dateCommande,c.heureCommande].filter(Boolean).join(" "),
        convertirNombre(c.totalAPayer),
        c.modePaiementPrevu || "",
        c.statutLivraison || "",
        c.statut || ""
    ]);

    const q = valeur => `"${String(valeur ?? "").replace(/"/g, '""')}"`;
    const csv = "\ufeff" + [colonnes, ...lignes].map(l => l.map(q).join(";")).join("\r\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commandes-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initialiserVenteLieeCommande() {
    ["close-linked-sale-modal","close-linked-sale-footer-btn"].forEach(id =>
        document.getElementById(id)?.addEventListener("click", fermerVenteLieeCommande)
    );
    document.getElementById("linked-sale-modal")?.addEventListener("click", e => {
        if (e.target.id === "linked-sale-modal") fermerVenteLieeCommande();
    });
}

function fermerVenteLieeCommande() {
    const modal = document.getElementById("linked-sale-modal");
    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden","true");
    document.body.classList.remove("modal-open");
}

function afficherVenteLieeCommande(vente) {
    const t = (id, valeur) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valeur == null ? "" : String(valeur);
    };

    const client = obtenirNomClientCommandeParId(vente.idClient) || vente.nomClient || vente.idClient || "—";
    t("linked-sale-number", vente.numeroVente || vente.idVente || "—");
    t("linked-sale-order", vente.numeroCommande || vente.idCommande || "—");
    t("linked-sale-client", client);
    t("linked-sale-date", [vente.dateVente, vente.heureVente].filter(Boolean).join(" ") || "—");
    t("linked-sale-total", formaterFCFA(vente.montantNet));
    const montantAvoirVenteLiee =
        convertirNombre(
            vente.montantAvoirUtilise
        );
    const montantRegleVenteLiee =
        convertirNombre(
            vente.montantRegle
        ) ||
        (
            convertirNombre(
                vente.montantPaye
            ) +
            montantAvoirVenteLiee
        );

    t(
        "linked-sale-paid",
        montantAvoirVenteLiee > 0
            ? `${formaterFCFA(vente.montantPaye)} encaissés + ${formaterFCFA(montantAvoirVenteLiee)} d’avoir = ${formaterFCFA(montantRegleVenteLiee)} réglés`
            : formaterFCFA(vente.montantPaye)
    );
    t("linked-sale-balance", formaterFCFA(vente.resteAPayer));
    t("linked-sale-payment-method", vente.modePaiement || "—");
    t("linked-sale-payment-status", vente.statutPaiement || "—");
    t("linked-sale-delivery-status", vente.statutLivraison || "—");
    t("linked-sale-modal-subtitle", vente.numeroVente || vente.idVente || "Détails de la vente");

    const body = document.getElementById("linked-sale-lines-body");
    const details = Array.isArray(vente.lignes) ? vente.lignes : Array.isArray(vente.detailsVente) ? vente.detailsVente : [];
    if (body) {
        body.innerHTML = details.length ? details.map(l => `
            <tr>
                <td>${echapperHTMLCommande(l.designation || l.nomProduit || l.idProduit || "Article")}</td>
                <td>${echapperHTMLCommande(String(convertirNombre(l.quantite)))}</td>
                <td>${echapperHTMLCommande(formaterFCFA(l.prixUnitaireTTC ?? l.prixUnitaire ?? l.prixVenteUnitaire))}</td>
                <td>${echapperHTMLCommande(formaterFCFA(l.remise))}</td>
                <td>${echapperHTMLCommande(formaterFCFA(l.sousTotalTTC ?? l.sousTotal))}</td>
            </tr>
        `).join("") : '<tr><td colspan="5" class="empty-table">Aucun détail produit.</td></tr>';
    }
}

function mettreAJourKPICommandes() {
    const total =
        commandesChargees.length;

    const maintenant =
        new Date();

    const nouvellesCeMois =
        commandesChargees.filter(
            commande => {
                const dateTexte =
                    String(
                        commande.dateCommande ||
                        ""
                    ).trim();

                if (!dateTexte) {
                    return false;
                }

                const dateCommande =
                    new Date(
                        `${dateTexte}T00:00:00`
                    );

                if (
                    Number.isNaN(
                        dateCommande.getTime()
                    )
                ) {
                    return false;
                }

                return (
                    dateCommande.getFullYear() ===
                        maintenant.getFullYear() &&
                    dateCommande.getMonth() ===
                        maintenant.getMonth()
                );
            }
        ).length;

    const revenu =
        commandesChargees.reduce(
            (somme, commande) =>
                somme +
                convertirNombre(
                    commande.totalAPayer
                ),
            0
        );

    const enAttente =
        commandesChargees.filter(
            commande =>
                normaliserTexteCommande(
                    commande.statut
                ) ===
                "en-attente"
        ).length;

    const terminees =
        commandesChargees.filter(
            commande => {
                const statut =
                    normaliserTexteCommande(
                        commande.statut
                    );

                return (
                    statut === "annulee" ||
                    statut === "convertie-en-vente"
                );
            }
        ).length;

    const descriptionNouvellesCommandes =
        `${nouvellesCeMois} nouvelle${
            nouvellesCeMois > 1 ? "s" : ""
        } commande${
            nouvellesCeMois > 1 ? "s" : ""
        } ce mois`;

    const correspondances = {
        "total-orders-value": total,
        "total-orders-description":
            descriptionNouvellesCommandes,
        "orders-revenue-value":
            formaterFCFA(revenu),
        "pending-orders-value":
            enAttente,
        "completed-orders-value":
            terminees
    };

    Object.entries(
        correspondances
    ).forEach(
        ([id, valeur]) => {
            const element =
                document.getElementById(id);

            if (element) {
                element.textContent = valeur;
                element.classList.remove("is-loading");
            }
        }
    );
}


function afficherPaginationCommandes(
    totalPages,
    total,
    debut,
    fin
) {
    const precedent =
        document.getElementById(
            "previous-order-page-btn"
        );

    const suivant =
        document.getElementById(
            "next-order-page-btn"
        );

    const boutons =
        document.getElementById(
            "orders-page-buttons"
        );

    if (precedent) {
        precedent.disabled =
            pageCommandesActuelle <= 1;
    }

    if (suivant) {
        suivant.disabled =
            pageCommandesActuelle >= totalPages;
    }

    if (boutons) {
        boutons.innerHTML = "";

        const debutPage =
            Math.max(
                1,
                pageCommandesActuelle - 2
            );

        const finPage =
            Math.min(
                totalPages,
                debutPage + 4
            );

        for (
            let page = debutPage;
            page <= finPage;
            page++
        ) {
            const bouton =
                document.createElement(
                    "button"
                );

            bouton.type = "button";
            bouton.className =
                "pagination-btn";
            bouton.textContent =
                String(page);

            if (
                page ===
                pageCommandesActuelle
            ) {
                bouton.classList.add(
                    "active"
                );
            }

            bouton.addEventListener(
                "click",
                () => allerPageCommandes(page)
            );

            boutons.appendChild(
                bouton
            );
        }
    }

    const resume =
        document.getElementById(
            "orders-pagination-summary"
        );

    if (resume) {
        resume.textContent =
            total
                ? `${debut + 1}-${fin} sur ${total}`
                : "0 résultat";
    }
}


function fermerModaleCommande() {
    const modale =
        document.getElementById(
            "order-modal"
        );

    modale?.classList.remove(
        "active"
    );

    modale?.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );
}


function reinitialiserFormulaireCommande() {
    reservationCommandeEnModification = new Map();
    const formulaire =
        document.getElementById(
            "order-form"
        );

    formulaire?.reset();

    commandeEnModificationId = null;
    lignesCommande = [];
    creditDisponibleClientCommande = 0;

    definirValeurCommande(
        "order-credit-used",
        0
    );

    document
        .getElementById(
            "order-credit-panel"
        )
        ?.classList
        .remove(
            "is-visible"
        );

    document
        .getElementById(
            "order-credit-zero-note"
        )
        ?.classList
        .remove(
            "is-visible"
        );

    definirValeurCommande(
        "order-id",
        ""
    );

    definirValeurCommande(
        "order-number",
        "Génération automatique..."
    );

    definirValeurCommande(
        "order-origin",
        "Commande"
    );

    definirValeurCommande(
        "order-sale-id",
        ""
    );

    afficherStatutCommandeFormulaire(
        "en-attente"
    );

    definirValeurCommande(
        "order-reception-mode",
        "livraison"
    );

    appliquerModeReceptionCommande();

    afficherLignesCommande();
    recalculerTotauxCommande();
    initialiserDateHeureCommande();
    afficherStockProduitCommande(
        0,
        false
    );

    const titre =
        document.getElementById(
            "order-modal-title"
        );

    const bouton =
        document.getElementById(
            "save-order-btn"
        );

    if (titre) {
        titre.textContent =
            "Nouvelle commande";
    }

    if (bouton) {
        bouton.textContent =
            "Enregistrer la commande";
    }

    afficherLivreursParCommuneCommande();
}


function obtenirNomClientCommandeParId(
    idClient
) {
    const client =
        catalogueClientsCommande.find(
            element => {
                const id =
                    String(
                        lireValeurClientCommande(
                            element,
                            [
                                "ID Client",
                                "idClient",
                                "Identifiant",
                                "identifiant"
                            ]
                        ) || ""
                    ).trim();

                return (
                    id ===
                    String(idClient || "")
                );
            }
        );

    return client
        ? obtenirNomClient(client)
        : "";
}


function obtenirNomLivreurCommandeParId(
    idLivreur
) {
    const livreur =
        catalogueLivreursCommande.find(
            element =>
                String(
                    element.idLivreur ||
                    element["ID Livreur"] ||
                    ""
                ) ===
                String(idLivreur || "")
        );

    return livreur
        ? obtenirNomLivreurCommande(livreur)
        : "";
}


function obtenirNomProduitCommandeParId(
    idProduit
) {
    const produit =
        catalogueProduitsCommande.find(
            element =>
                obtenirIdProduitCommande(
                    element
                ) ===
                String(idProduit || "")
        );

    return produit
        ? obtenirNomProduit(produit)
        : "";
}


/* ===========================================================
   LIVREURS ET COMMUNE DE LIVRAISON
=========================================================== */

function initialiserLivreursCommande() {
    document
        .getElementById(
            "order-delivery-commune"
        )
        ?.addEventListener(
            "change",
            afficherLivreursParCommuneCommande
        );

    /*
     * Charge une première fois les livreurs.
     * Aucun livreur n'est affiché tant qu'une commune
     * n'a pas été sélectionnée.
     */
    chargementLivreursCommandePromise = chargerLivreursCommande();
}


async function chargerLivreursCommande() {
    const select =
        document.getElementById(
            "order-delivery-person"
        );

    if (
        !select ||
        typeof apiGet !== "function"
    ) {
        return;
    }

    const idActuel =
        String(
            select.value ||
            ""
        ).trim();

    select.disabled = true;
    select.innerHTML =
        '<option value="">Chargement des livreurs...</option>';

    try {
        const resultat =
            await apiGet(
                "getLivreurs"
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger les livreurs."
            );
        }

        const livreurs =
            extraireListeCommande(
                resultat,
                "livreurs"
            );

        catalogueLivreursCommande =
            livreurs.filter(
                livreur => {
                    const statut =
                        normaliserTexteCommande(
                            livreur.statut ||
                            livreur["Statut"] ||
                            ""
                        );

                    return (
                        !statut ||
                        statut === "actif"
                    );
                }
            );

        afficherLivreursParCommuneCommande(
            idActuel
        );

    } catch (error) {
        console.error(
            "Erreur de chargement des livreurs :",
            error
        );

        catalogueLivreursCommande = [];

        select.innerHTML =
            '<option value="">Impossible de charger les livreurs</option>';

        afficherMessageCommande(
            error.message ||
            "Impossible de charger les livreurs.",
            "error"
        );

    } finally {
        select.disabled = false;
    }
}


function afficherLivreursParCommuneCommande(
    idAConserver = ""
) {
    const select =
        document.getElementById(
            "order-delivery-person"
        );

    const commune =
        obtenirValeurCommande(
            "order-delivery-commune"
        );

    if (!select) {
        return;
    }

    const ancienneValeur =
        typeof idAConserver === "string"
            ? idAConserver
            : String(
                select.value ||
                ""
            ).trim();

    select.innerHTML = "";

    const optionVide =
        document.createElement(
            "option"
        );

    optionVide.value = "";

    if (!commune) {
        optionVide.textContent =
            "Sélectionnez d'abord une commune";

        select.appendChild(
            optionVide
        );

        select.value = "";
        return;
    }

    optionVide.textContent =
        "Aucun livreur affecté";

    select.appendChild(
        optionVide
    );

    const communeNormalisee =
        normaliserTexteCommande(
            commune
        );

    const livreursCompatibles =
        catalogueLivreursCommande
            .filter(
                livreur => {
                    const zones =
                        obtenirZonesLivreurCommande(
                            livreur
                        );

                    return zones.some(
                        zone => {
                            const zoneNormalisee =
                                normaliserTexteCommande(
                                    zone
                                );

                            return (
                                zoneNormalisee ===
                                    communeNormalisee ||
                                zoneNormalisee ===
                                    "toutes-les-zones" ||
                                zoneNormalisee ===
                                    "toute-zone" ||
                                zoneNormalisee ===
                                    "toutes-zones"
                            );
                        }
                    );
                }
            )
            .sort(
                (a, b) =>
                    obtenirNomLivreurCommande(a)
                        .localeCompare(
                            obtenirNomLivreurCommande(b),
                            "fr",
                            {
                                sensitivity:
                                    "base"
                            }
                        )
            );

    if (!livreursCompatibles.length) {
        const optionAucun =
            document.createElement(
                "option"
            );

        optionAucun.value = "";
        optionAucun.disabled = true;
        optionAucun.textContent =
            `Aucun livreur actif ne couvre ${commune}`;

        select.appendChild(
            optionAucun
        );

        select.value = "";
        return;
    }

    livreursCompatibles.forEach(
        livreur => {
            const id =
                String(
                    livreur.idLivreur ||
                    livreur["ID Livreur"] ||
                    ""
                ).trim();

            if (!id) {
                return;
            }

            const option =
                document.createElement(
                    "option"
                );

            option.value = id;
            option.textContent =
                construireLibelleLivreurCommande(
                    livreur
                );

            select.appendChild(
                option
            );
        }
    );

    if (
        ancienneValeur &&
        Array.from(
            select.options
        ).some(
            option =>
                option.value ===
                ancienneValeur
        )
    ) {
        select.value =
            ancienneValeur;
    } else {
        select.value = "";
    }
}


function obtenirZonesLivreurCommande(
    livreur
) {
    if (
        Array.isArray(
            livreur?.zonesLivraison
        )
    ) {
        return livreur
            .zonesLivraison
            .map(
                zone =>
                    String(
                        zone ||
                        ""
                    ).trim()
            )
            .filter(Boolean);
    }

    return String(
        livreur?.zoneLivraison ||
        livreur?.["Zone de Livraison"] ||
        ""
    )
        .split(
            /[,;|]+/
        )
        .map(
            zone =>
                zone.trim()
        )
        .filter(Boolean);
}


function obtenirNomLivreurCommande(
    livreur
) {
    const nom =
        String(
            livreur?.nom ||
            livreur?.["Nom"] ||
            ""
        ).trim();

    const prenom =
        String(
            livreur?.prenom ||
            livreur?.["Prénom"] ||
            livreur?.["Prenom"] ||
            ""
        ).trim();

    return (
        [nom, prenom]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        String(
            livreur?.idLivreur ||
            livreur?.["ID Livreur"] ||
            ""
        ).trim()
    );
}


function construireLibelleLivreurCommande(
    livreur
) {
    const nom =
        obtenirNomLivreurCommande(
            livreur
        );

    const transport =
        String(
            livreur?.moyenTransport ||
            livreur?.["Moyen de Transport"] ||
            ""
        ).trim();

    const capacite =
        Math.max(
            0,
            Math.trunc(
                convertirNombre(
                    livreur?.capaciteMaximale ??
                    livreur?.["Capacité Maximale"] ??
                    0
                )
            )
        );

    return [
        nom,
        transport,
        capacite > 0
            ? `Capacité ${capacite}`
            : ""
    ]
        .filter(Boolean)
        .join(" • ");
}


function normaliserTexteCommande(
    valeur
) {
    return String(
        valeur ??
        ""
    )
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .trim()
        .toLowerCase()
        .replace(
            /['’]/g,
            ""
        )
        .replace(
            /\s+/g,
            "-"
        );
}


function initialiserProduitsCommande() {
    const boutonAjouter =
        document.getElementById(
            "add-order-product-btn"
        );

    if (
        boutonAjouter &&
        boutonAjouter.dataset.initialized !==
            "true"
    ) {
        boutonAjouter.dataset.initialized =
            "true";

        boutonAjouter.addEventListener(
            "click",
            ajouterProduitCommande
        );
    }

    document
        .getElementById(
            "order-product-select"
        )
        ?.addEventListener(
            "change",
            mettreAJourPrixProduitSelectionne
        );

    document
        .getElementById(
            "order-product-quantity"
        )
        ?.addEventListener(
            "input",
            verifierQuantiteProduitSelectionne
        );

    document
        .getElementById(
            "order-lines-table-body"
        )
        ?.addEventListener(
            "click",
            event => {
                const boutonModifier =
                    event.target.closest(
                        "[data-edit-order-line]"
                    );

                if (boutonModifier) {
                    ouvrirEditionLigneCommande(
                        boutonModifier.dataset
                            .editOrderLine
                    );
                    return;
                }

                const bouton =
                    event.target.closest(
                        "[data-remove-order-line]"
                    );

                if (!bouton) {
                    return;
                }

                supprimerLigneCommande(
                    bouton.dataset
                        .removeOrderLine
                );
            }
        );

    chargementProduitsCommandePromise = chargerProduitsCommande();
}


async function chargerProduitsCommande() {
    const select =
        document.getElementById(
            "order-product-select"
        );

    if (
        !select ||
        typeof apiGet !== "function"
    ) {
        return;
    }

    const valeurActuelle =
        String(select.value || "").trim();

    select.disabled = true;
    select.innerHTML =
        '<option value="">Chargement des produits et du stock...</option>';

    afficherStockProduitCommande(0, false);

    try {
        /*
         * Les informations commerciales viennent de getProduits
         * et le stock officiel vient exclusivement de getStock.
         */
        const [
            resultatProduits,
            resultatStock
        ] = await Promise.all([
            apiGet("getProduits"),
            apiGet("getStock")
        ]);

        if (!resultatProduits?.success) {
            throw new Error(
                resultatProduits?.message ||
                "Impossible de charger les produits."
            );
        }

        if (!resultatStock?.success) {
            throw new Error(
                resultatStock?.message ||
                "Impossible de charger le stock actuel."
            );
        }

        const produits =
            extraireListeCommande(
                resultatProduits,
                "produits"
            );

        const stocks =
            extraireListeCommande(
                resultatStock,
                "produits"
            );

        const stockParProduit = new Map();

        stocks.forEach(element => {
            const id = obtenirIdProduitCommande(
                element
            );

            if (!id) {
                return;
            }

            stockParProduit.set(
                id,
                obtenirStockProduit(element)
            );
        });

        catalogueProduitsCommande =
            produits.map(produit => {
                const id =
                    obtenirIdProduitCommande(
                        produit
                    );

                return {
                    ...produit,

                    /*
                     * Cette propriété écrase toute ancienne
                     * quantité présente dans la feuille Produits.
                     */
                    stockVendable:
                        (stockParProduit.has(id)
                            ? stockParProduit.get(id)
                            : 0) +
                        (reservationCommandeEnModification.get(id) || 0),

                    stockDisponible:
                        (stockParProduit.has(id)
                            ? stockParProduit.get(id)
                            : 0) +
                        (reservationCommandeEnModification.get(id) || 0)
                };
            });

        select.innerHTML =
            '<option value="">Sélectionner un produit</option>';

        catalogueProduitsCommande
            .filter(produit => {
                const statut = String(
                    produit["Statut"] ||
                    produit.statut ||
                    ""
                )
                    .trim()
                    .toLowerCase();

                return (
                    !statut ||
                    statut === "actif"
                );
            })
            .sort((a, b) =>
                obtenirNomProduit(a)
                    .localeCompare(
                        obtenirNomProduit(b),
                        "fr",
                        { sensitivity: "base" }
                    )
            )
            .forEach(produit => {
                const id =
                    obtenirIdProduitCommande(
                        produit
                    );

                if (!id) {
                    return;
                }

                const stock =
                    obtenirStockProduit(
                        produit
                    );

                const option =
                    document.createElement(
                        "option"
                    );

                option.value = id;
                option.textContent =
                    obtenirNomProduit(produit) ||
                    id;

                option.dataset.stock =
                    String(stock);

                select.appendChild(option);
            });

        if (
            valeurActuelle &&
            Array.from(select.options).some(
                option =>
                    option.value ===
                    valeurActuelle
            )
        ) {
            select.value =
                valeurActuelle;

            mettreAJourPrixProduitSelectionne();
        }

    } catch (error) {
        console.error(
            "Erreur de chargement des produits et du stock :",
            error
        );

        catalogueProduitsCommande = [];

        select.innerHTML =
            '<option value="">Impossible de charger les produits</option>';

        afficherStockProduitCommande(
            0,
            false
        );

        afficherMessageCommande(
            error.message ||
            "Impossible de charger le stock actuel.",
            "error"
        );

    } finally {
        select.disabled = false;
    }
}


function extraireListeCommande(
    resultat,
    nomCollection = ""
) {
    if (Array.isArray(resultat?.data)) {
        return resultat.data;
    }

    if (
        nomCollection &&
        Array.isArray(
            resultat?.data?.[nomCollection]
        )
    ) {
        return resultat.data[nomCollection];
    }

    if (
        nomCollection &&
        Array.isArray(
            resultat?.[nomCollection]
        )
    ) {
        return resultat[nomCollection];
    }

    return [];
}


function obtenirIdProduitCommande(
    produit
) {
    return String(
        produit?.["ID Produit"] ||
        produit?.idProduit ||
        produit?.["Identifiant"] ||
        produit?.identifiant ||
        ""
    ).trim();
}


function obtenirNomProduit(produit) {
    return String(
        produit["Désignation"] ||
        produit.designation ||
        produit["Nom Produit"] ||
        produit.nomProduit ||
        produit["Produit"] ||
        produit.produit ||
        produit["Nom"] ||
        produit.nom ||
        produit.idProduit ||
        ""
    ).trim();
}


function obtenirPrixProduit(produit) {
    return convertirNombre(
        produit["Prix de Vente"] ??
        produit.prixVente ??
        0
    );
}

function obtenirStockProduit(produit) {
    return Math.max(
        0,
        Math.trunc(
            convertirNombre(
                produit?.stockVendable ??
                produit?.["Stock Vendable"] ??
                produit?.stockDisponible ??
                produit?.["Stock Disponible"] ??
                produit?.stockActuel ??
                produit?.["Stock Actuel"] ??
                produit?.["Quantité en Stock"] ??
                produit?.["Quantite en Stock"] ??
                produit?.quantiteStock ??
                produit?.stock ??
                0
            )
        )
    );
}

function obtenirProduitSelectionneCommande() {
    const idProduit =
        document
            .getElementById(
                "order-product-select"
            )
            ?.value || "";

    return (
        catalogueProduitsCommande.find(
            item =>
                obtenirIdProduitCommande(
                    item
                ) === String(idProduit)
        ) ||
        null
    );
}

function afficherStockProduitCommande(stock, produitSelectionne = true) {
    const zone = document.getElementById("order-product-stock");
    if (!zone) return;

    zone.classList.remove("stock-neutral", "stock-ok", "stock-low", "stock-out");

    if (!produitSelectionne) {
        zone.textContent = "Stock disponible : —";
        zone.classList.add("stock-neutral");
        return;
    }

    if (stock <= 0) {
        zone.textContent = "Rupture de stock";
        zone.classList.add("stock-out");
        return;
    }

    zone.textContent = `Stock disponible : ${stock.toLocaleString("fr-FR")} unité${stock > 1 ? "s" : ""}`;
    zone.classList.add(stock <= 5 ? "stock-low" : "stock-ok");
}

function verifierQuantiteProduitSelectionne() {
    const produit = obtenirProduitSelectionneCommande();
    const champQuantite = document.getElementById("order-product-quantity");

    if (!produit || !champQuantite) return true;

    const stock = obtenirStockProduit(produit);
    const quantite = Math.max(1, Math.trunc(convertirNombre(champQuantite.value)));

    if (autoriserCommandeStockInsuffisant) champQuantite.removeAttribute("max");
    else champQuantite.max = String(stock);

    if (!autoriserCommandeStockInsuffisant && stock <= 0) return false;

    if (!autoriserCommandeStockInsuffisant && quantite > stock) {
        afficherMessageCommande(
            `La quantité demandée (${quantite}) dépasse le stock disponible (${stock}).`,
            "error"
        );
        return false;
    }

    return true;
}


function mettreAJourPrixProduitSelectionne() {
    const produit = obtenirProduitSelectionneCommande();
    const champPrix = document.getElementById("order-product-price");
    const champQuantite = document.getElementById("order-product-quantity");
    const boutonAjouter = document.getElementById("add-order-product-btn");

    if (!produit) {
        if (champPrix) champPrix.value = "";
        if (champQuantite) {
            champQuantite.value = 1;
            champQuantite.removeAttribute("max");
        }
        if (boutonAjouter) boutonAjouter.disabled = false;
        afficherStockProduitCommande(0, false);
        return;
    }

    const stock = obtenirStockProduit(produit);

    if (champPrix) champPrix.value = obtenirPrixProduit(produit);
    if (champQuantite) {
        champQuantite.value = 1;
        if (autoriserCommandeStockInsuffisant) champQuantite.removeAttribute("max");
        else champQuantite.max = String(stock);
    }
    if (boutonAjouter) boutonAjouter.disabled = !autoriserCommandeStockInsuffisant && stock <= 0;

    afficherStockProduitCommande(stock, true);
}


function ajouterProduitCommande(event) {
    event?.preventDefault();

    const select =
        document.getElementById(
            "order-product-select"
        );

    const champQuantite =
        document.getElementById(
            "order-product-quantity"
        );

    const champPrix =
        document.getElementById(
            "order-product-price"
        );

    const champRemise =
        document.getElementById(
            "order-product-discount"
        );

    const idProduit =
        String(select?.value || "").trim();

    if (!idProduit) {
        afficherMessageCommande(
            "Sélectionnez un produit.",
            "error"
        );
        select?.focus();
        return;
    }

    const produit =
        catalogueProduitsCommande.find(
            item =>
                obtenirIdProduitCommande(
                    item
                ) === idProduit
        );

    if (!produit) {
        afficherMessageCommande(
            "Le produit sélectionné est introuvable.",
            "error"
        );
        return;
    }

    const option =
        select?.selectedOptions?.[0];

    /*
     * Le stock affiché dans l'option provient directement
     * de getStock. Il devient la source prioritaire ici.
     */
    const stockDisponible =
        option?.dataset?.stock !==
            undefined
            ? Math.max(
                0,
                Math.trunc(
                    convertirNombre(
                        option.dataset.stock
                    )
                )
            )
            : obtenirStockProduit(
                produit
            );

    const quantite =
        Math.max(
            1,
            Math.trunc(
                convertirNombre(
                    champQuantite?.value
                )
            )
        );

    const prixUnitaire =
        convertirNombre(
            champPrix?.value
        );

    const remise =
        Math.max(
            0,
            convertirNombre(
                champRemise?.value
            )
        );

    if (!autoriserCommandeStockInsuffisant && stockDisponible <= 0) {
        afficherMessageCommande(
            "Ce produit est en rupture de stock.",
            "error"
        );
        return;
    }

    /*
     * En édition, la quantité saisie REMPLACE la quantité de la ligne.
     * En ajout normal, si le produit existe déjà, on conserve le
     * comportement pratique d'addition des quantités.
     */
    const indexEdition =
        ligneCommandeEnModificationId
            ? lignesCommande.findIndex(
                ligne =>
                    String(ligne.idLigne) ===
                    String(ligneCommandeEnModificationId)
              )
            : -1;

    const indexMemeProduit =
        lignesCommande.findIndex(
            ligne =>
                String(ligne.idProduit) === idProduit &&
                String(ligne.idLigne) !==
                    String(ligneCommandeEnModificationId || "")
        );

    if (
        indexEdition >= 0 &&
        indexMemeProduit >= 0
    ) {
        afficherMessageCommande(
            "Ce produit existe déjà dans une autre ligne. Modifiez directement cette ligne ou supprimez l'une des deux.",
            "error"
        );
        return;
    }

    const indexExistant =
        indexEdition >= 0
            ? indexEdition
            : indexMemeProduit;

    const quantiteDejaAjoutee =
        indexEdition >= 0
            ? 0
            : (
                indexExistant >= 0
                    ? Math.max(
                        0,
                        Math.trunc(
                            convertirNombre(
                                lignesCommande[indexExistant].quantite
                            )
                        )
                      )
                    : 0
              );

    const nouvelleQuantite =
        indexEdition >= 0
            ? quantite
            : quantiteDejaAjoutee + quantite;

    if (
        !autoriserCommandeStockInsuffisant &&
        nouvelleQuantite >
        stockDisponible
    ) {
        const manque =
            nouvelleQuantite -
            stockDisponible;

        afficherMessageCommande(
            `Stock insuffisant : ${stockDisponible} unité${stockDisponible > 1 ? "s" : ""} disponible${stockDisponible > 1 ? "s" : ""}. Quantité totale demandée : ${nouvelleQuantite}. Il manque ${manque} unité${manque > 1 ? "s" : ""}.`,
            "error"
        );

        champQuantite?.focus();
        return;
    }

    const sousTotal =
        Math.max(
            0,
            nouvelleQuantite *
                prixUnitaire -
                remise
        );

    const ligne = {
        idLigne:
            indexEdition >= 0
                ? lignesCommande[indexEdition].idLigne
                : (
                    indexExistant >= 0
                        ? lignesCommande[indexExistant].idLigne
                        : (
                            crypto.randomUUID?.() ||
                            String(Date.now())
                          )
                  ),

        idProduit,
        designation:
            obtenirNomProduit(
                produit
            ),

        stockDisponible,
        quantite:
            nouvelleQuantite,
        prixUnitaire,
        remise,
        sousTotal
    };

    if (indexExistant >= 0) {
        lignesCommande[
            indexExistant
        ] = ligne;
    } else {
        lignesCommande.push(
            ligne
        );
    }

    afficherLignesCommande();
    recalculerTotauxCommande();

    if (select) {
        select.value = "";
    }

    if (champQuantite) {
        champQuantite.value = 1;
        champQuantite.removeAttribute(
            "max"
        );
    }

    if (champPrix) {
        champPrix.value = "";
    }

    if (champRemise) {
        champRemise.value = "";
    }

    const boutonAjouter =
        document.getElementById(
            "add-order-product-btn"
        );

    if (boutonAjouter) {
        boutonAjouter.disabled = false;
    }

    afficherStockProduitCommande(
        0,
        false
    );

    const etaitEnEdition =
        indexEdition >= 0;

    ligneCommandeEnModificationId = null;

    const boutonAjouterFinal =
        document.getElementById(
            "add-order-product-btn"
        );

    if (boutonAjouterFinal) {
        boutonAjouterFinal.textContent =
            "Ajouter le produit";
    }

    afficherMessageCommande(
        etaitEnEdition
            ? "La ligne produit a été modifiée."
            : (
                indexExistant >= 0
                    ? "La quantité du produit a été mise à jour."
                    : "Produit ajouté à la commande."
              ),
        "success"
    );
}



function ouvrirEditionLigneCommande(idLigne) {
    const ligne =
        lignesCommande.find(
            element =>
                String(element.idLigne) ===
                String(idLigne)
        );

    if (!ligne) {
        afficherMessageCommande(
            "La ligne produit est introuvable.",
            "error"
        );
        return;
    }

    ligneCommandeEnModificationId =
        ligne.idLigne;

    const select =
        document.getElementById(
            "order-product-select"
        );

    const quantite =
        document.getElementById(
            "order-product-quantity"
        );

    const prix =
        document.getElementById(
            "order-product-price"
        );

    const remise =
        document.getElementById(
            "order-product-discount"
        );

    if (select) {
        select.value =
            String(ligne.idProduit || "");

        /*
         * Actualise prix / stock du produit sélectionné.
         * On remet ensuite les valeurs de la ligne existante.
         */
        select.dispatchEvent(
            new Event("change")
        );
    }

    if (quantite) {
        quantite.value =
            Math.max(
                1,
                Math.trunc(
                    convertirNombre(
                        ligne.quantite
                    )
                )
            );
    }

    if (prix) {
        prix.value =
            convertirNombre(
                ligne.prixUnitaire
            );
    }

    if (remise) {
        remise.value =
            convertirNombre(
                ligne.remise
            );
    }

    const boutonAjouter =
        document.getElementById(
            "add-order-product-btn"
        );

    if (boutonAjouter) {
        boutonAjouter.disabled = false;
        boutonAjouter.textContent =
            "Mettre à jour le produit";
    }

    quantite?.focus();

    afficherMessageCommande(
        "Modifiez le produit, la quantité ou la remise puis cliquez sur « Mettre à jour le produit ».",
        "info"
    );
}


function supprimerLigneCommande(idLigne) {
    lignesCommande = lignesCommande.filter(
        ligne =>
            String(ligne.idLigne) !==
            String(idLigne)
    );

    if (
        String(ligneCommandeEnModificationId || "") ===
        String(idLigne)
    ) {
        ligneCommandeEnModificationId = null;

        const boutonAjouter =
            document.getElementById(
                "add-order-product-btn"
            );

        if (boutonAjouter) {
            boutonAjouter.textContent =
                "Ajouter le produit";
        }
    }

    afficherLignesCommande();
    recalculerTotauxCommande();
}


function afficherLignesCommande() {
    const tbody = document.getElementById("order-lines-table-body");
    if (!tbody) return;

    if (!lignesCommande.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-table">Aucun produit ajouté.</td></tr>';
        return;
    }

    tbody.innerHTML = lignesCommande.map(ligne => `
        <tr>
            <td>${echapperHTMLCommande(ligne.designation)}</td>
            <td>${ligne.quantite}</td>
            <td>${formaterFCFA(ligne.prixUnitaire)}</td>
            <td>${formaterFCFA(ligne.remise)}</td>
            <td><strong>${formaterFCFA(ligne.sousTotal)}</strong></td>
            <td>
                <div class="table-actions">
                    <button
                        type="button"
                        class="table-action-btn edit-btn"
                        data-edit-order-line="${echapperHTMLCommande(ligne.idLigne)}"
                        title="Modifier le produit ou la quantité"
                        aria-label="Modifier le produit ou la quantité"
                    >✏️</button>
                    <button
                        type="button"
                        class="table-action-btn delete-btn"
                        data-remove-order-line="${echapperHTMLCommande(ligne.idLigne)}"
                        title="Retirer le produit"
                        aria-label="Retirer le produit"
                    >🗑️</button>
                </div>
            </td>
        </tr>
    `).join("");
}



/* ===========================================================
   MODE DE RÉCEPTION
=========================================================== */

function initialiserModeReceptionCommande() {
    const select =
        document.getElementById("order-reception-mode");

    if (!select) {
        return;
    }

    select.addEventListener(
        "change",
        appliquerModeReceptionCommande
    );

    appliquerModeReceptionCommande();
}


function appliquerModeReceptionCommande() {
    const mode =
        normaliserTexteCommande(
            obtenirValeurCommande("order-reception-mode") ||
            "livraison"
        );

    const estLivraison =
        mode === "livraison";

    document
        .querySelectorAll(".delivery-only-field")
        .forEach(element => {
            element.hidden = !estLivraison;
        });

    const commune =
        document.getElementById(
            "order-delivery-commune"
        );

    const adresse =
        document.getElementById(
            "order-delivery-address"
        );

    if (commune) {
        commune.required = estLivraison;
    }

    if (adresse) {
        adresse.required = estLivraison;
    }

    if (!estLivraison) {
        /*
         * Le retrait boutique ne doit générer aucun frais
         * ni aucune donnée logistique de livraison.
         */
        definirValeurCommande(
            "order-delivery-fees",
            0
        );

        definirValeurCommande(
            "order-delivery-person",
            ""
        );

        recalculerTotauxCommande();
    } else {
        afficherLivreursParCommuneCommande(
            obtenirValeurCommande(
                "order-delivery-person"
            )
        );
    }
}


function commandeEstEnLivraison() {
    return (
        normaliserTexteCommande(
            obtenirValeurCommande(
                "order-reception-mode"
            ) || "livraison"
        ) === "livraison"
    );
}


function initialiserCalculsCommande() {
    ["order-discount", "order-delivery-fees"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", recalculerTotauxCommande);
    });

    recalculerTotauxCommande();
}


function recalculerTotauxCommande() {
    const totalCommande = lignesCommande.reduce((total, ligne) => total + convertirNombre(ligne.sousTotal), 0);
    const remiseTotale = convertirNombre(document.getElementById("order-discount")?.value);
    const fraisLivraison =
        commandeEstEnLivraison()
            ? convertirNombre(
                document.getElementById(
                    "order-delivery-fees"
                )?.value
            )
            : 0;

    const totalAPayer =
        Math.max(
            0,
            totalCommande -
            remiseTotale +
            fraisLivraison
        );

    definirValeurCommande("order-total", totalCommande || "");
    definirValeurCommande("order-total-payable", totalAPayer || "");

    if (
        typeof actualiserCreditClientCommande ===
        "function"
    ) {
        actualiserCreditClientCommande();
    } else if (
        typeof recalculerPaiementCommande ===
        "function"
    ) {
        recalculerPaiementCommande();
    }
}


function definirValeurCommande(id, valeur) {
    const champ = document.getElementById(id);
    if (champ) champ.value = valeur;
}


function convertirNombre(valeur) {
    const nombre = Number(String(valeur ?? "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(nombre) ? nombre : 0;
}


function formaterFCFA(valeur) {
    const p = parametresFinanceCommande || {};
    const decimales = Number(p.nombreDecimales) === 2 ? 2 : 0;
    const montant = convertirNombre(valeur).toLocaleString("fr-FR", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
    const devise = String(p.libelleDevise || "FCFA").trim() || "FCFA";
    return p.formatMontant === "devise-nombre"
        ? `${devise} ${montant}`
        : `${montant} ${devise}`;
}


function afficherMessageCommande(message, type = "info") {
    const zone = document.getElementById("order-form-message");
    if (!zone) return;

    zone.textContent = message;
    zone.className = "form-message " + type;
    zone.style.display = "block";

    clearTimeout(afficherMessageCommande.timer);
    afficherMessageCommande.timer = setTimeout(() => {
        zone.style.display = "none";
    }, 3000);
}


function echapperHTMLCommande(valeur) {
    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ===== PAIEMENT RÉEL — COMMANDE MAÎTRESSE ===== */
function initialiserPaiementCommande(){
  document
    .getElementById("order-paid-amount")
    ?.addEventListener(
      "input",
      recalculerPaiementCommande
    );

  document
    .getElementById("order-credit-used")
    ?.addEventListener(
      "input",
      () => {
        actualiserCreditClientCommande();
      }
    );

  document
    .getElementById("order-payment-method")
    ?.addEventListener(
      "change",
      () => {
        const a =
          document.getElementById(
            "order-payment-method"
          );

        const b =
          document.getElementById(
            "order-payment-method-real"
          );

        if (
          b &&
          !b.value &&
          a?.value
        ) {
          b.value = a.value;
        }
      }
    );

  recalculerPaiementCommande();
}


function recalculerPaiementCommande(){
  const total =
    Math.max(
      0,
      convertirNombre(
        document.getElementById(
          "order-total-payable"
        )?.value
      )
    );

  const champAvoir =
    document.getElementById(
      "order-credit-used"
    );

  let avoir =
    convertirNombre(
      champAvoir?.value
    );

  avoir =
    Math.max(
      0,
      Math.min(
        avoir,
        creditDisponibleClientCommande,
        total
      )
    );

  if (
    champAvoir &&
    convertirNombre(
      champAvoir.value
    ) !== avoir
  ) {
    champAvoir.value =
      avoir;
  }

  const maximumEspeces =
    Math.max(
      0,
      total -
      avoir
    );

  const champPaye =
    document.getElementById(
      "order-paid-amount"
    );

  let paye =
    convertirNombre(
      champPaye?.value
    );

  paye =
    Math.max(
      0,
      Math.min(
        paye,
        maximumEspeces
      )
    );

  if (
    champPaye &&
    convertirNombre(
      champPaye.value
    ) !== paye
  ) {
    champPaye.value =
      paye;
  }

  const regle =
    avoir +
    paye;

  const reste =
    Math.max(
      0,
      total -
      regle
    );

  definirValeurCommande(
    "order-amount-due",
    total || 0
  );

  definirValeurCommande(
    "order-balance",
    reste
  );

  definirValeurCommande(
    "order-payment-status",
    regle <= 0
      ? "Impayée"
      : reste > 0
        ? "Partiellement payée"
        : "Payée"
  );
}


/* ===========================================================
   PARAMÈTRES > FINANCE — COMMANDES
=========================================================== */
async function chargerParametresFinanceCommande() {
    try {
        const resultat = await apiGet("getParametresFinance");
        if (!resultat?.success) throw new Error(resultat?.message || "Paramètres finance indisponibles.");
        parametresFinanceCommande = {
            ...parametresFinanceCommande,
            ...(resultat.data || resultat.parametres || {})
        };
        appliquerModesPaiementFinanceCommande();
        recalculerPaiementCommande();
    } catch (error) {
        console.warn("Paramètres finance indisponibles dans Commandes :", error);
    }
}

function normaliserGroupeModeFinanceCommande(mode) {
    const texte = String(mode ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
    if (["especes", "espece", "cash"].includes(texte)) return "especes";
    if (texte.includes("mobile") || texte.includes("wave") || texte.includes("orange") || texte.includes("mtn") || texte.includes("moov")) return "mobile-money";
    if (texte.includes("virement") || texte.includes("transfer")) return "virement";
    if (texte.includes("cheque")) return "cheque";
    if (texte.includes("carte") || texte.includes("card")) return "carte-bancaire";
    if (texte === "credit") return "credit";
    if (texte === "avoir") return "avoir";
    return texte;
}

function modeFinanceCommandeActif(mode) {
    const groupe = normaliserGroupeModeFinanceCommande(mode);
    const p = parametresFinanceCommande || {};
    if (!groupe || groupe === "avoir") return true;
    if (groupe === "credit") return p.autoriserVentesCredit === true;
    if (groupe === "especes") return p.modeEspeces !== false;
    if (groupe === "mobile-money") return p.modeMobileMoney !== false;
    if (groupe === "virement") return p.modeVirement !== false;
    if (groupe === "cheque") return p.modeCheque !== false;
    if (groupe === "carte-bancaire") return p.modeCarteBancaire !== false;
    return false;
}

function appliquerModesPaiementFinanceCommande() {
    ["order-payment-method", "order-payment-method-real"].forEach((id) => {
        const select = document.getElementById(id);
        if (!select) return;
        Array.from(select.options).forEach((option) => {
            if (!option.value) return;
            const actif = modeFinanceCommandeActif(option.value);
            option.hidden = !actif;
            option.disabled = !actif;
            if (!actif && select.value === option.value) select.value = "";
        });
    });
}

function validerReglesFinanceCommandeFront(data) {
    const p = parametresFinanceCommande || {};
    const total = Math.max(0, convertirNombre(data?.totalAPayer));
    const avoir = Math.max(0, Math.min(total, convertirNombre(data?.montantAvoirUtilise)));
    const paye = Math.max(0, Math.min(total - avoir, convertirNombre(data?.montantPaye)));
    const regle = paye + avoir;
    const reste = Math.max(0, total - regle);
    const modePrevu = data?.modePaiementPrevu || "";
    const modeReel = data?.modePaiement || modePrevu || "";

    if (modePrevu && !modeFinanceCommandeActif(modePrevu)) {
        afficherMessageCommande("Ce mode de paiement est désactivé dans Paramètres > Finance.", "error");
        return false;
    }

    if (paye > 0 && (!modeReel || !modeFinanceCommandeActif(modeReel))) {
        afficherMessageCommande("Sélectionnez un mode de paiement actif pour l'encaissement.", "error");
        return false;
    }

    if (p.autoriserPaiementsPartiels === false && regle > 0 && reste > 0) {
        afficherMessageCommande(
            "Les paiements partiels sont désactivés. Réglez la totalité ou laissez le règlement à 0.",
            "error"
        );
        return false;
    }
    return true;
}


/* ===== FINANCE DYNAMIQUE — COMMANDES ===== */
function appliquerModesPaiementFinanceCommande(){const modes=Array.isArray(parametresFinanceCommande?.modesPaiement)?parametresFinanceCommande.modesPaiement.filter(m=>m&&m.actif!==false):[];["order-payment-method","order-payment-method-real"].forEach(id=>{const select=document.getElementById(id);if(!select)return;const courant=select.value;let liste=modes.map(m=>({value:m.id,label:m.libelle||m.id}));if(parametresFinanceCommande?.autoriserVentesCredit===true)liste.push({value:"credit",label:"Crédit"});select.innerHTML='<option value="">Sélectionner</option>'+liste.map(x=>`<option value="${String(x.value).replace(/"/g,"&quot;")}">${String(x.label)}</option>`).join("");if(Array.from(select.options).some(o=>o.value===courant))select.value=courant;});}
