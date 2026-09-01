/* ===========================================================
   VISIBL ERP — Module Commandes
=========================================================== */

let lignesCommande = [];
let catalogueProduitsCommande = [];
let catalogueLivreursCommande = [];
let catalogueClientsCommande = [];
let commandesChargees = [];
let commandesFiltrees = [];
let commandeEnModificationId = null;
let pageCommandesActuelle = 1;
let taillePageCommandes = 10;
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

    modale.addEventListener("click", event => {
        if (event.target === modale) fermer();
    });

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

    chargerClientsCommande();
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
        const resultat = await apiGet("getClients");
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
        .getElementById("orders-per-page")
        ?.addEventListener(
            "change",
            event => {
                taillePageCommandes =
                    Math.max(
                        1,
                        Number(event.target.value) || 10
                    );

                pageCommandesActuelle = 1;
                afficherTableauCommandes();
            }
        );

    document
        .getElementById("previous-order-page-btn")
        ?.addEventListener(
            "click",
            () => {
                if (pageCommandesActuelle > 1) {
                    pageCommandesActuelle--;
                    afficherTableauCommandes();
                }
            }
        );

    document
        .getElementById("next-order-page-btn")
        ?.addEventListener(
            "click",
            () => {
                const totalPages =
                    Math.max(
                        1,
                        Math.ceil(
                            commandesFiltrees.length /
                            taillePageCommandes
                        )
                    );

                if (pageCommandesActuelle < totalPages) {
                    pageCommandesActuelle++;
                    afficherTableauCommandes();
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

        const resultat =
            await apiPost(
                action,
                donnees
            );

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

        if (typeof showToast === "function") {
            showToast(
                resultat.message ||
                "Commande enregistrée avec succès.",
                "success"
            );
        }

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


async function chargerCommandes() {
    const tbody =
        document.getElementById("orders-table-body");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="empty-table">
                    Chargement des commandes...
                </td>
            </tr>
        `;
    }

    try {
        const resultat =
            await apiGet("getCommandes");

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger les commandes."
            );
        }

        commandesChargees =
            extraireListeCommande(
                resultat,
                "commandes"
            );

        actualiserFiltreCommunesCommandes();
        mettreAJourKPICommandes();
        appliquerFiltresCommandes();

    } catch (error) {
        console.error(
            "Erreur de chargement des commandes :",
            error
        );

        commandesChargees = [];
        commandesFiltrees = [];
        afficherTableauCommandes();

        if (typeof showToast === "function") {
            showToast(
                error.message ||
                "Impossible de charger les commandes.",
                "error"
            );
        }
    }
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

    actualiserFiltreCommunesCommandes();
    mettreAJourKPICommandes();
    appliquerFiltresCommandes(true);
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


function appliquerFiltresCommandes(
    conserverPage = false
) {
    const recherche =
        normaliserTexteCommande(
            obtenirValeurCommande("orders-header-search-input")
        );

    const statut =
        normaliserTexteCommande(
            obtenirValeurCommande("order-status-filter")
        );

    const commune =
        normaliserTexteCommande(
            obtenirValeurCommande("order-commune-filter")
        );

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
                            commande.modePaiementPrevu,
                            commande.origine ||
                            commande.origineCommande,
                            commande.idVente
                        ].join(" ")
                    );

                const correspondRecherche =
                    !recherche ||
                    texte.includes(recherche);

                const correspondStatut =
                    !statut ||
                    normaliserTexteCommande(
                        commande.statut
                    ) === statut;

                const correspondCommune =
                    !commune ||
                    normaliserTexteCommande(
                        commande.communeLivraison
                    ) === commune;

                return (
                    correspondRecherche &&
                    correspondStatut &&
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
    const tbody =
        document.getElementById("orders-table-body");

    if (!tbody) {
        return;
    }

    const total =
        commandesFiltrees.length;

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total /
                taillePageCommandes
            )
        );

    pageCommandesActuelle =
        Math.min(
            pageCommandesActuelle,
            totalPages
        );

    const debut =
        (pageCommandesActuelle - 1) *
        taillePageCommandes;

    const fin =
        debut +
        taillePageCommandes;

    const page =
        commandesFiltrees.slice(
            debut,
            fin
        );

    if (!page.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="empty-table">
                    Aucune commande enregistrée.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML =
            page
                .map(
                    creerLigneCommandeHTML
                )
                .join("");
    }

    const compteur =
        document.getElementById(
            "filtered-order-count"
        );

    if (compteur) {
        compteur.textContent =
            String(total);
    }

    synchroniserSelectionCommandes();

    afficherPaginationCommandes(
        totalPages,
        total,
        debut,
        Math.min(fin, total)
    );
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

    let montantPayeAffiche =
        convertirNombre(
            commande.montantPaye
        );

    let montantAvoirAffiche =
        convertirNombre(
            commande.montantAvoirUtilise
        );

    let montantRegleAffiche =
        convertirNombre(
            commande.montantRegle
        ) ||
        (
            montantPayeAffiche +
            montantAvoirAffiche
        );

    let resteAPayerAffiche =
        commande.resteAPayer !== undefined &&
        commande.resteAPayer !== null &&
        commande.resteAPayer !== ""
            ? convertirNombre(
                commande.resteAPayer
              )
            : Math.max(
                0,
                convertirNombre(
                    commande.totalAPayer
                ) - montantPayeAffiche
              );

    let statutPaiementAffiche =
        commande.statutPaiement ||
        (
            montantPayeAffiche <= 0
                ? "Impayée"
                : (
                    resteAPayerAffiche > 0
                        ? "Partiellement payée"
                        : "Payée"
                  )
        );

    /*
     * Après livraison, la Vente liée contient le paiement réconcilié
     * avec les encaissements de Livraison. On l'utilise pour afficher
     * le vrai état financier dans "Voir la commande".
     */
    if (
        commande.idVente &&
        typeof apiGet === "function"
    ) {
        try {
            const resultatVentes =
                await apiGet(
                    "getVentes"
                );

            const ventes =
                Array.isArray(resultatVentes?.data)
                    ? resultatVentes.data
                    : Array.isArray(resultatVentes?.data?.ventes)
                        ? resultatVentes.data.ventes
                        : Array.isArray(resultatVentes?.ventes)
                            ? resultatVentes.ventes
                            : [];

            const venteLiee =
                ventes.find(
                    vente =>
                        String(
                            vente.idVente ||
                            vente["ID Vente"] ||
                            ""
                        ).trim() ===
                        String(
                            commande.idVente
                        ).trim()
                );

            if (venteLiee) {
                montantPayeAffiche =
                    convertirNombre(
                        venteLiee.montantPaye ??
                        venteLiee["Montant Payé"]
                    );

                montantAvoirAffiche =
                    convertirNombre(
                        venteLiee.montantAvoirUtilise ??
                        venteLiee["Montant Avoir Utilisé"] ??
                        commande.montantAvoirUtilise
                    );

                montantRegleAffiche =
                    convertirNombre(
                        venteLiee.montantRegle ??
                        venteLiee["Montant Réglé"]
                    ) ||
                    (
                        montantPayeAffiche +
                        montantAvoirAffiche
                    );

                resteAPayerAffiche =
                    convertirNombre(
                        venteLiee.resteAPayer ??
                        venteLiee["Reste à Payer"]
                    );

                statutPaiementAffiche =
                    venteLiee.statutPaiement ||
                    venteLiee["Statut Paiement"] ||
                    statutPaiementAffiche;
            }
        } catch (error) {
            console.warn(
                "Impossible de récupérer le paiement de la vente liée :",
                error
            );
        }
    }

    const detailsFinanciers = [
        ["Sous-total", formaterFCFA(commande.totalCommande), ""],
        ["Remise totale", formaterFCFA(commande.remiseTotale), "is-discount"],
        ["Frais de livraison", formaterFCFA(commande.fraisLivraison), ""],
        ["Total à payer", formaterFCFA(commande.totalAPayer), "is-total"],
        ["Paiement encaissé", formaterFCFA(montantPayeAffiche), "is-paid"],
        ...(montantAvoirAffiche > 0
            ? [["Avoir client utilisé", formaterFCFA(montantAvoirAffiche), "is-credit"]]
            : []),
        ["Total réglé", formaterFCFA(montantRegleAffiche), "is-settled"],
        ["Reste à payer", formaterFCFA(resteAPayerAffiche), "is-balance"],
        ["Statut paiement", formaterLibelleStatutCommande(statutPaiementAffiche), "is-payment-status"]
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

    /* Recharge le stock pour inclure la réservation propre à la commande. */
    await chargerProduitsCommande();

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

    definirValeurCommande(
        "order-payment-method",
        commande.modePaiementPrevu
    );

    definirValeurCommande(
        "order-payment-method-real",
        commande.modePaiement || commande.modePaiementPrevu || ""
    );

    definirValeurCommande(
        "order-paid-amount",
        commande.montantPaye || 0
    );

    definirValeurCommande(
        "order-credit-used",
        commande.montantAvoirUtilise || 0
    );

    actualiserCreditClientCommande();

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

        await chargerCommandes();

    } catch (error) {
        console.error(
            "Erreur changement statut commande :",
            error
        );

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
    if (menu) menu.hidden = !ouvrir;
    trigger.setAttribute("aria-expanded", ouvrir ? "true" : "false");
}

function fermerMenusActionsLigneCommande() {
    document.querySelectorAll(".order-row-actions-dropdown").forEach(menu => menu.hidden = true);
    document.querySelectorAll("[data-order-menu-trigger]").forEach(btn => btn.setAttribute("aria-expanded", "false"));
}

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
                () => {
                    pageCommandesActuelle =
                        page;

                    afficherTableauCommandes();
                }
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
    chargerLivreursCommande();
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

    chargerProduitsCommande();
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
