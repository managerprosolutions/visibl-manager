/* ===========================================================
   VISIBL ERP — Module Ventes
   Interface connectée aux vraies données de l'API
=========================================================== */

let lignesVente = [];
let catalogueProduitsVente = [];
let catalogueClientsVente = [];
let catalogueLivreursVente = [];
let ventesChargees = [];
let ventesFiltrees = [];
let venteEnModificationId = null;
let ligneVenteEnModificationId = null;
let brouillonLivraisonVente = null;
let pageVentesActuelle = 1;
let taillePageVentes = 10;
let modeSelectionVentes = false;
const ventesSelectionnees = new Set();



/* ===========================================================
   INITIALISATION
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    if (
        typeof requireAuth === "function" &&
        !requireAuth()
    ) {
        return;
    }

    initialiserDateHeureVente();
    initialiserGestionClientsVente();
    initialiserProduitsVente();
    initialiserLivraisonVente();
    initialiserCalculsVente();
    initialiserEnregistrementVente();
    initialiserListeVentes();
    initialiserInteractionsHeaderVente();
    initialiserFactureDepuisVente();
});


/* ===========================================================
   PASSERELLE COMMANDE → VENTE
=========================================================== */

function initialiserPasserelleCommandeVersVente() {
    const cleConversion =
        "visibl_commande_a_convertir_en_vente";

    let payload = null;

    try {
        const brut =
            sessionStorage.getItem(
                cleConversion
            );

        if (brut) {
            payload =
                JSON.parse(brut);
        }
    } catch (error) {
        console.warn(
            "Données de conversion de commande illisibles :",
            error
        );
    }

    if (payload?.source === "commande") {
        /*
         * On retire immédiatement la donnée pour éviter qu'un simple
         * rafraîchissement ne rouvre indéfiniment le formulaire.
         */
        try {
            sessionStorage.removeItem(
                cleConversion
            );
        } catch (error) {}

        ouvrirVenteDepuisCommande(
            payload
        );
        return;
    }

    /*
     * Bonus UX : depuis une commande déjà convertie, le bouton "vente liée"
     * peut amener directement sur la vente correspondante.
     */
    let idVenteAOuvrir = "";

    try {
        idVenteAOuvrir =
            String(
                sessionStorage.getItem(
                    "visibl_vente_a_ouvrir"
                ) || ""
            ).trim();

        if (idVenteAOuvrir) {
            sessionStorage.removeItem(
                "visibl_vente_a_ouvrir"
            );
        }
    } catch (error) {}

    if (idVenteAOuvrir) {
        ouvrirVenteLieeApresChargement(
            idVenteAOuvrir
        );
    }
}


async function completerPayloadCommandePourVente(
    payload
) {
    const initial =
        payload &&
        typeof payload === "object"
            ? { ...payload }
            : {};

    const idCommande =
        String(
            initial.idCommande ||
            ""
        ).trim();

    if (
        !idCommande ||
        typeof apiGet !== "function"
    ) {
        return initial;
    }

    try {
        const resultat =
            await apiGet(
                "getCommandes"
            );

        if (!resultat?.success) {
            return initial;
        }

        const commandes =
            extraireListeVente(
                resultat,
                "commandes"
            );

        const commande =
            commandes.find(
                element =>
                    String(
                        element.idCommande ||
                        element["ID Commande"] ||
                        ""
                    ).trim() ===
                    idCommande
            );

        if (!commande) {
            return initial;
        }

        const lignesCommande =
            Array.isArray(
                commande.lignes
            )
                ? commande.lignes
                : Array.isArray(
                    commande.detailsCommande
                )
                    ? commande.detailsCommande
                    : [];

        /*
         * Pour les données logistiques, la commande enregistrée dans
         * Google Sheets est la source de vérité.
         */
        return {
            ...initial,

            numeroCommande:
                commande.numeroCommande ||
                initial.numeroCommande ||
                idCommande,

            idClient:
                commande.idClient ||
                initial.idClient ||
                "",

            idLivreur:
                commande.idLivreur ??
                initial.idLivreur ??
                "",

            zoneLivraison:
                commande.zoneLivraison ??
                initial.zoneLivraison ??
                "",

            communeLivraison:
                commande.communeLivraison ??
                initial.communeLivraison ??
                "",

            adresseLivraison:
                commande.adresseLivraison ??
                initial.adresseLivraison ??
                "",

            dateLivraisonPrevue:
                commande.dateLivraisonPrevue ??
                initial.dateLivraisonPrevue ??
                "",

            statutLivraison:
                commande.statutLivraison ||
                initial.statutLivraison ||
                "a-preparer",

            fraisLivraison:
                commande.fraisLivraison ??
                initial.fraisLivraison ??
                0,

            modePaiement:
                commande.modePaiementPrevu ||
                initial.modePaiement ||
                "",

            commentaire:
                commande.commentaire ??
                initial.commentaire ??
                "",

            lignes:
                lignesCommande.length
                    ? lignesCommande
                    : (
                        Array.isArray(
                            initial.lignes
                        )
                            ? initial.lignes
                            : []
                      )
        };

    } catch (error) {
        console.warn(
            "Impossible de recharger la commande complète avant conversion :",
            error
        );

        return initial;
    }
}


async function ouvrirVenteDepuisCommande(
    payload
) {
    const modale =
        document.getElementById(
            "sale-modal"
        );

    if (!modale) {
        return;
    }

    payload =
        await completerPayloadCommandePourVente(
            payload
        );

    reinitialiserFormulaireVente();

    definirValeurVente(
        "sale-order-id",
        payload.idCommande ||
        ""
    );

    /*
     * Une vente est datée au moment de sa conversion,
     * pas à la date historique de création de la commande.
     */
    initialiserDateHeureVente();

    modale.classList.add("active");
    modale.setAttribute(
        "aria-hidden",
        "false"
    );
    document.body.classList.add(
        "modal-open"
    );

    afficherMessageVente(
        `Commande ${payload.numeroCommande || payload.idCommande || ""} chargée. Vérifiez les informations puis enregistrez la vente.`,
        "info"
    );

    await Promise.allSettled([
        chargerClientsVente(
            payload.idClient ||
            ""
        ),
        chargerProduitsVente(),
        chargerLivreursVente()
    ]);

    definirValeurVente(
        "sale-client",
        payload.idClient ||
        ""
    );

    definirValeurVente(
        "sale-payment-method",
        payload.modePaiement ||
        ""
    );

    /*
     * Le statut est repris de la fiche LIV existante.
     * La vente ne le choisit jamais.
     */
    afficherStatutLivraisonVente(
        payload.statutLivraison ||
        "a-preparer"
    );

    definirValeurVente(
        "sale-delivery-mode",
        "livraison"
    );

    definirValeurVente(
        "sale-delivery-commune",
        payload.communeLivraison ||
        ""
    );

    definirValeurVente(
        "sale-delivery-zone",
        payload.zoneLivraison ||
        ""
    );

    definirValeurVente(
        "sale-delivery-address",
        payload.adresseLivraison ||
        ""
    );

    definirValeurVente(
        "sale-delivery-date",
        payload.dateLivraisonPrevue ||
        ""
    );

    mettreAJourAffichageLivraisonVente();
    afficherLivreursParCommuneVente(
        payload.idLivreur ||
        ""
    );

    /*
     * Les informations logistiques viennent de la commande,
     * mais l'utilisateur doit pouvoir les vérifier et les ajuster
     * rapidement avant l'enregistrement définitif de la vente.
     */
    const champsLogistiquesCommande = [
        "sale-delivery-mode",
        "sale-delivery-commune",
        "sale-delivery-zone",
        "sale-delivery-address",
        "sale-delivery-person",
        "sale-delivery-date"
    ];

    champsLogistiquesCommande.forEach(id => {
        const champ =
            document.getElementById(id);

        if (champ) {
            champ.disabled = false;
        }
    });

    definirValeurVente(
        "sale-delivery-fees",
        formaterNombreChampVente(
            payload.fraisLivraison
        )
    );

    definirValeurVente(
        "sale-global-discount",
        convertirNombreVente(
            payload.remiseGlobale
        )
            ? formaterNombreChampVente(
                payload.remiseGlobale
            )
            : ""
    );

    definirValeurVente(
        "sale-comment",
        payload.commentaire ||
        ""
    );

    const lignes =
        Array.isArray(payload.lignes)
            ? payload.lignes
            : [];

    lignesVente =
        lignes.map(
            ligne => ({
                idLigne:
                    genererIdLocalVente(),

                idProduit:
                    String(
                        ligne.idProduit ||
                        ""
                    ).trim(),

                designation:
                    obtenirNomProduitVenteParId(
                        ligne.idProduit
                    ) ||
                    String(
                        ligne.idProduit ||
                        ""
                    ),

                stockDisponible:
                    obtenirStockProduitVente(
                        obtenirProduitVenteParId(
                            ligne.idProduit
                        ) ||
                        {}
                    ),

                quantite:
                    convertirNombreVente(
                        ligne.quantite
                    ),

                quantiteVendue:
                    convertirNombreVente(
                        ligne.quantite
                    ),

                prixUnitaire:
                    convertirNombreVente(
                        ligne.prixUnitaire
                    ),

                prixVenteUnitaire:
                    convertirNombreVente(
                        ligne.prixUnitaire
                    ),

                remise:
                    convertirNombreVente(
                        ligne.remise
                    ),

                sousTotal:
                    convertirNombreVente(
                        ligne.sousTotal
                    ),

                commentaire: ""
            })
        );

    afficherLignesVente();
    recalculerTotauxVente();

    const titre =
        document.getElementById(
            "sale-modal-title"
        );

    if (titre) {
        titre.textContent =
            "Transformer la commande en vente";
    }

    const bouton =
        document.getElementById(
            "save-sale-btn"
        );

    if (bouton) {
        bouton.textContent =
            "Enregistrer la vente";
    }
}


async function ouvrirVenteLieeApresChargement(
    idVente
) {
    /*
     * chargerVentes() est déjà lancé à l'initialisation.
     * On attend brièvement que les données arrivent, sans bloquer l'interface.
     */
    for (let tentative = 0; tentative < 40; tentative++) {
        if (
            ventesChargees.some(
                vente =>
                    String(vente.idVente) ===
                    String(idVente)
            )
        ) {
            ouvrirModificationVente(
                idVente
            );
            return;
        }

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    100
                )
        );
    }

    afficherToastVente(
        "La vente liée n'a pas pu être ouverte automatiquement.",
        "info"
    );
}


/* ===========================================================
   MODALE VENTE
=========================================================== */

function initialiserModaleVente() {
    const boutonsOuvrir = [
        document.getElementById("new-sale-btn"),
        document.getElementById("new-sale-toolbar-btn")
    ].filter(Boolean);

    const modale = document.getElementById("sale-modal");

    if (!modale) {
        console.error("La modale #sale-modal est introuvable.");
        return;
    }

    const ouvrir = () => {
        if (!venteEnModificationId) {
            reinitialiserFormulaireVente();
        }

        initialiserDateHeureVente();

        modale.classList.add("active");
        modale.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");

        Promise.allSettled([
            chargerClientsVente(),
            chargerProduitsVente(),
            chargerLivreursVente()
        ]).catch(() => {});
    };

    boutonsOuvrir.forEach(
        bouton => bouton.addEventListener("click", ouvrir)
    );

    document
        .getElementById("close-sale-modal")
        ?.addEventListener("click", fermerModaleVente);

    document
        .getElementById("cancel-sale-btn")
        ?.addEventListener("click", fermerModaleVente);

    modale.addEventListener("click", event => {
        if (event.target === modale) {
            fermerModaleVente();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            modale.classList.contains("active")
        ) {
            fermerModaleVente();
        }
    });
}


function fermerModaleVente() {
    const modale =
        document.getElementById("sale-modal");

    modale?.classList.remove("active");
    modale?.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");
}


function initialiserDateHeureVente() {
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

    const champDate =
        document.getElementById("sale-date");

    const champHeure =
        document.getElementById("sale-time");

    if (champDate && !champDate.value) {
        champDate.value = date;
    }

    if (champHeure && !champHeure.value) {
        champHeure.value = heure;
    }
}


/* ===========================================================
   CLIENTS — VRAIES DONNÉES + CRÉATION RAPIDE
=========================================================== */

function initialiserGestionClientsVente() {
    document
        .getElementById("open-new-sale-client-modal-btn")
        ?.addEventListener("click", ouvrirModaleClientRapideVente);

    document
        .getElementById("refresh-sale-clients-btn")
        ?.addEventListener("click", () => {
            chargerClientsVente();
        });

    document
        .getElementById("close-quick-client-modal")
        ?.addEventListener("click", fermerModaleClientRapideVente);

    document
        .getElementById("cancel-quick-client-btn")
        ?.addEventListener("click", fermerModaleClientRapideVente);

    document
        .getElementById("quick-client-modal")
        ?.addEventListener("click", event => {
            if (event.target.id === "quick-client-modal") {
                fermerModaleClientRapideVente();
            }
        });

    document
        .getElementById("quick-client-form")
        ?.addEventListener("submit", enregistrerClientRapideVente);

    chargerClientsVente();
}


function ouvrirModaleClientRapideVente() {
    const modale =
        document.getElementById("quick-client-modal");

    const formulaire =
        document.getElementById("quick-client-form");

    if (!modale) {
        return;
    }

    formulaire?.reset();

    const statut =
        document.getElementById("quick-client-status");

    if (statut) {
        statut.value = "actif";
    }

    masquerMessageClientRapideVente();

    modale.classList.add("active");
    modale.setAttribute("aria-hidden", "false");

    /*
     * La modale Vente reste ouverte en arrière-plan.
     * On ne retire donc pas modal-open du body.
     */
    document.body.classList.add("modal-open");

    setTimeout(() => {
        document
            .getElementById("quick-client-lastname")
            ?.focus();
    }, 100);
}


function fermerModaleClientRapideVente() {
    const modale =
        document.getElementById("quick-client-modal");

    modale?.classList.remove("active");
    modale?.setAttribute("aria-hidden", "true");

    masquerMessageClientRapideVente();
}


async function enregistrerClientRapideVente(event) {
    event.preventDefault();

    const formulaire =
        document.getElementById("quick-client-form");

    const bouton =
        document.getElementById("save-quick-client-btn");

    if (!formulaire) {
        return;
    }

    if (!formulaire.checkValidity()) {
        formulaire.reportValidity();
        return;
    }

    const client = {
        typeClient:
            obtenirValeurVente("quick-client-type"),

        statut:
            obtenirValeurVente("quick-client-status") ||
            "actif",

        nom:
            obtenirValeurVente("quick-client-lastname"),

        prenom:
            obtenirValeurVente("quick-client-firstname"),

        telephone:
            obtenirValeurVente("quick-client-phone"),

        email:
            obtenirValeurVente("quick-client-email"),

        commune:
            obtenirValeurVente("quick-client-commune"),

        quartier:
            obtenirValeurVente("quick-client-neighborhood"),

        commentaire:
            obtenirValeurVente("quick-client-comment")
    };

    /*
     * On mémorise les clients présents avant la création.
     * Cela permet d'identifier le nouveau client même si createClient
     * ne renvoie pas directement son ID dans la réponse.
     */
    const idsAvantCreation =
        new Set(
            catalogueClientsVente
                .map(obtenirIdClientVente)
                .filter(Boolean)
        );

    try {
        definirBoutonChargementVente(
            bouton,
            true,
            "Enregistrement..."
        );

        afficherMessageClientRapideVente(
            "Enregistrement du client...",
            "info"
        );

        const resultat =
            await apiPost("createClient", client);

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le client."
            );
        }

        /*
         * Dès que le backend confirme le succès, la petite modale
         * se ferme immédiatement. Le modal Vente reste ouvert derrière.
         */
        fermerModaleClientRapideVente();

        const clientCree =
            resultat.data ||
            resultat.client ||
            {};

        let idClient =
            String(
                lireValeurObjetVente(
                    clientCree,
                    [
                        "ID Client",
                        "idClient",
                        "Identifiant",
                        "identifiant"
                    ]
                ) ||
                resultat.idClient ||
                ""
            ).trim();

        /*
         * Recharge la source officielle Google Sheets.
         */
        await chargerClientsVente();

        /*
         * Si l'API n'a pas retourné l'ID, on retrouve le nouveau client :
         * 1) ID apparu après la création ;
         * 2) téléphone/email ;
         * 3) nom + prénom.
         */
        if (!idClient) {
            const nouveauParId =
                catalogueClientsVente.find(
                    element => {
                        const id =
                            obtenirIdClientVente(element);

                        return (
                            id &&
                            !idsAvantCreation.has(id)
                        );
                    }
                );

            const normaliser = valeur =>
                normaliserTexteVente(
                    String(valeur || "")
                );

            const nouveauParCorrespondance =
                catalogueClientsVente.find(
                    element => {
                        const telephone =
                            lireValeurObjetVente(
                                element,
                                ["Téléphone", "Telephone", "telephone"]
                            );

                        const email =
                            lireValeurObjetVente(
                                element,
                                ["Email", "email"]
                            );

                        const nom =
                            lireValeurObjetVente(
                                element,
                                ["Nom", "nom"]
                            );

                        const prenom =
                            lireValeurObjetVente(
                                element,
                                ["Prénom", "Prenom", "prenom"]
                            );

                        if (
                            client.telephone &&
                            normaliser(telephone) ===
                                normaliser(client.telephone)
                        ) {
                            return true;
                        }

                        if (
                            client.email &&
                            normaliser(email) ===
                                normaliser(client.email)
                        ) {
                            return true;
                        }

                        return (
                            normaliser(nom) ===
                                normaliser(client.nom) &&
                            normaliser(prenom) ===
                                normaliser(client.prenom)
                        );
                    }
                );

            idClient =
                obtenirIdClientVente(
                    nouveauParId ||
                    nouveauParCorrespondance
                );
        }

        if (idClient) {
            const select =
                document.getElementById("sale-client");

            if (select) {
                select.value = idClient;

                /*
                 * Si la valeur n'existe pas encore pour une raison de timing,
                 * on ajoute l'option immédiatement puis on la sélectionne.
                 */
                if (select.value !== idClient) {
                    const clientTrouve =
                        catalogueClientsVente.find(
                            element =>
                                obtenirIdClientVente(element) ===
                                idClient
                        );

                    ajouterClientDansListeVente(
                        idClient,
                        obtenirNomClientVente(clientTrouve) ||
                        [client.nom, client.prenom]
                            .filter(Boolean)
                            .join(" ") ||
                        idClient
                    );
                }
            }
        }

        const nomClient =
            idClient
                ? (
                    obtenirNomClientVenteParId(idClient) ||
                    [client.nom, client.prenom]
                        .filter(Boolean)
                        .join(" ")
                  )
                : [client.nom, client.prenom]
                    .filter(Boolean)
                    .join(" ");

        afficherMessageVente(
            `Client ${nomClient || "créé"} enregistré et sélectionné.`,
            "success"
        );

        afficherToastVente(
            `Client ${nomClient || "créé"} enregistré.`,
            "success"
        );

    } catch (error) {
        console.error(
            "Erreur création rapide client depuis Ventes :",
            error
        );

        /*
         * Si la modale a déjà été fermée parce que le backend avait
         * confirmé la création, on affiche l'erreur dans le modal Vente.
         */
        const modaleClient =
            document.getElementById("quick-client-modal");

        if (modaleClient?.classList.contains("active")) {
            afficherMessageClientRapideVente(
                error.message ||
                "Une erreur est survenue.",
                "error"
            );
        } else {
            afficherMessageVente(
                error.message ||
                "Le client a été créé, mais la liste n'a pas pu être actualisée.",
                "error"
            );
        }

    } finally {
        definirBoutonChargementVente(
            bouton,
            false,
            "Enregistrer le client"
        );
    }
}

async function chargerClientsVente(
    idASelectionner = "",
    libelleSecours = ""
) {
    if (typeof apiGet !== "function") {
        return;
    }

    const select =
        document.getElementById("sale-client");

    const filtreClient =
        document.getElementById("sale-client-filter");

    const valeurActuelle =
        String(
            idASelectionner ||
            select?.value ||
            ""
        ).trim();

    if (select) {
        select.disabled = true;
        select.innerHTML =
            '<option value="">Chargement des clients...</option>';
    }

    try {
        const resultat =
            await apiGet("getClients");

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger les clients."
            );
        }

        const clients =
            extraireListeVente(
                resultat,
                "clients"
            );

        catalogueClientsVente =
            Array.isArray(clients)
                ? clients
                : [];

        const clientsActifs =
            catalogueClientsVente
                .filter(client => {
                    const statut =
                        normaliserTexteVente(
                            lireValeurObjetVente(
                                client,
                                ["Statut", "statut"]
                            )
                        );

                    return (
                        !statut ||
                        statut === "actif" ||
                        statut === "prospect"
                    );
                })
                .sort(
                    (a, b) =>
                        obtenirNomClientVente(a)
                            .localeCompare(
                                obtenirNomClientVente(b),
                                "fr",
                                { sensitivity: "base" }
                            )
                );

        if (select) {
            select.innerHTML =
                '<option value="">Sélectionner un client</option>';

            clientsActifs.forEach(client => {
                const id =
                    obtenirIdClientVente(client);

                if (!id) {
                    return;
                }

                const option =
                    document.createElement("option");

                option.value = id;
                option.textContent =
                    obtenirNomClientVente(client) ||
                    id;

                select.appendChild(option);
            });

            if (
                valeurActuelle &&
                !Array
                    .from(select.options)
                    .some(
                        option =>
                            option.value ===
                            valeurActuelle
                    )
            ) {
                const option =
                    document.createElement("option");

                option.value =
                    valeurActuelle;

                option.textContent =
                    libelleSecours ||
                    valeurActuelle;

                select.appendChild(option);
            }

            select.value =
                valeurActuelle;
        }

        /*
         * Filtre du tableau : on le construit avec les mêmes vraies données.
         */
        if (filtreClient) {
            const valeurFiltre =
                filtreClient.value;

            filtreClient.innerHTML =
                '<option value="">Tous les clients</option>';

            clientsActifs.forEach(client => {
                const id =
                    obtenirIdClientVente(client);

                if (!id) {
                    return;
                }

                const option =
                    document.createElement("option");

                option.value = id;
                option.textContent =
                    obtenirNomClientVente(client) ||
                    id;

                filtreClient.appendChild(option);
            });

            if (
                Array
                    .from(filtreClient.options)
                    .some(
                        option =>
                            option.value ===
                            valeurFiltre
                    )
            ) {
                filtreClient.value =
                    valeurFiltre;
            }
        }

        if (
            ventesChargees.length
        ) {
            appliquerFiltresVentes(true);
        }

    } catch (error) {
        console.error(
            "Erreur de chargement des clients :",
            error
        );

        if (select) {
            select.innerHTML =
                '<option value="">Impossible de charger les clients</option>';
        }

    } finally {
        if (select) {
            select.disabled = false;
        }
    }
}


function ajouterClientDansListeVente(
    idClient,
    nomClient
) {
    const select =
        document.getElementById("sale-client");

    const id =
        String(idClient || "").trim();

    if (!select || !id) {
        return;
    }

    let option =
        Array
            .from(select.options)
            .find(
                element =>
                    element.value === id
            );

    if (!option) {
        option =
            document.createElement("option");

        option.value = id;
        select.appendChild(option);
    }

    option.textContent =
        String(nomClient || id).trim();

    select.value = id;
}


function obtenirIdClientVente(client) {
    return String(
        lireValeurObjetVente(
            client,
            [
                "ID Client",
                "idClient",
                "Identifiant",
                "identifiant"
            ]
        ) || ""
    ).trim();
}


function obtenirNomClientVente(client) {
    if (!client) {
        return "";
    }

    const nom =
        lireValeurObjetVente(
            client,
            [
                "Nom",
                "nom",
                "Nom Client",
                "nomClient"
            ]
        );

    const prenom =
        lireValeurObjetVente(
            client,
            [
                "Prénom",
                "Prenom",
                "prenom",
                "Prénom Client"
            ]
        );

    const raisonSociale =
        lireValeurObjetVente(
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
            .map(
                valeur =>
                    String(valeur || "").trim()
            )
            .filter(Boolean)
            .join(" ")
        ||
        String(raisonSociale || "").trim()
    );
}


function obtenirNomClientVenteParId(idClient) {
    const id =
        String(idClient || "").trim();

    const client =
        catalogueClientsVente.find(
            element =>
                obtenirIdClientVente(element) ===
                id
        );

    return client
        ? obtenirNomClientVente(client)
        : "";
}


/* ===========================================================
   LIVRAISON — COMMUNE ET LIVREURS
=========================================================== */

function initialiserLivraisonVente() {
    document
        .getElementById("sale-delivery-mode")
        ?.addEventListener(
            "change",
            () => {
                const mode =
                    normaliserTexteVente(
                        obtenirValeurVente(
                            "sale-delivery-mode"
                        )
                    );

                if (mode === "retrait-boutique") {
                    memoriserBrouillonLivraisonVente();
                }

                mettreAJourAffichageLivraisonVente();

                if (mode === "livraison") {
                    restaurerBrouillonLivraisonVente();
                }
            }
        );

    document
        .getElementById("sale-delivery-commune")
        ?.addEventListener(
            "change",
            afficherLivreursParCommuneVente
        );

    chargerLivreursVente();
    mettreAJourAffichageLivraisonVente();
}


function libelleStatutLivraisonVente(
    statut
) {
    const valeur =
        normaliserTexteVente(
            statut ||
            ""
        );

    const libelles = {
        "retrait-boutique": "Retrait en boutique",
        "a-preparer": "À préparer",
        "prete-pour-depart": "Prête pour départ",
        "en-livraison": "En livraison",
        "livree": "Livrée",
        "annulee": "Annulée"
    };

    return (
        libelles[valeur] ||
        formaterLibelleVente(
            statut ||
            "—"
        )
    );
}


function afficherStatutLivraisonVente(
    statut
) {
    const cache =
        document.getElementById(
            "sale-delivery-status"
        );

    const affichage =
        document.getElementById(
            "sale-delivery-status-display"
        );

    if (cache) {
        cache.value =
            statut ||
            "retrait-boutique";
    }

    if (affichage) {
        affichage.value =
            libelleStatutLivraisonVente(
                statut ||
                "retrait-boutique"
            );
    }
}


function memoriserBrouillonLivraisonVente() {
    const lire = id => {
        const champ = document.getElementById(id);
        return champ ? String(champ.value || "") : "";
    };

    brouillonLivraisonVente = {
        commune: lire("sale-delivery-commune"),
        zone: lire("sale-delivery-zone"),
        adresse: lire("sale-delivery-address"),
        livreur: lire("sale-delivery-person"),
        date: lire("sale-delivery-date"),
        frais: lire("sale-delivery-fees")
    };
}


function restaurerBrouillonLivraisonVente() {
    if (!brouillonLivraisonVente) {
        return;
    }

    definirValeurVente("sale-delivery-commune", brouillonLivraisonVente.commune);
    definirValeurVente("sale-delivery-zone", brouillonLivraisonVente.zone);
    definirValeurVente("sale-delivery-address", brouillonLivraisonVente.adresse);
    definirValeurVente("sale-delivery-date", brouillonLivraisonVente.date);
    definirValeurVente("sale-delivery-fees", brouillonLivraisonVente.frais);

    afficherLivreursParCommuneVente(
        brouillonLivraisonVente.livreur
    );

    recalculerTotauxVente();
}


function mettreAJourAffichageLivraisonVente() {
    const mode =
        obtenirValeurVente(
            "sale-delivery-mode"
        ) ||
        "retrait-boutique";

    const details =
        document.getElementById(
            "sale-delivery-details"
        );

    const estLivraison =
        mode === "livraison";

    /*
     * Le formulaire ne pilote jamais le statut logistique.
     * Lors d'une nouvelle vente, le mode choisi fixe seulement
     * l'état initial. Ensuite, le statut est synchronisé depuis LIV.
     */
    const statutActuel =
        obtenirValeurVente(
            "sale-delivery-status"
        );

    if (!venteEnModificationId) {
        afficherStatutLivraisonVente(
            estLivraison
                ? "a-preparer"
                : "retrait-boutique"
        );
    } else if (
        !estLivraison
    ) {
        afficherStatutLivraisonVente(
            "retrait-boutique"
        );
    } else if (
        !statutActuel ||
        statutActuel === "retrait-boutique"
    ) {
        afficherStatutLivraisonVente(
            "a-preparer"
        );
    }

    if (details) {
        details.hidden =
            !estLivraison;

        details.style.display =
            estLivraison
                ? "grid"
                : "none";
    }

    /*
     * IMPORTANT :
     * En Retrait boutique, on ne détruit plus les dernières
     * informations de livraison. Elles sont simplement masquées
     * et ignorées dans le calcul/à l'enregistrement.
     * Ainsi, si le client repasse plus tard en Livraison,
     * VISIBL peut les reproposer.
     */
    recalculerTotauxVente();
}


async function chargerLivreursVente() {
    const select =
        document.getElementById(
            "sale-delivery-person"
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
            extraireListeVente(
                resultat,
                "livreurs"
            );

        catalogueLivreursVente =
            livreurs.filter(
                livreur => {
                    const statut =
                        normaliserTexteVente(
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

        afficherLivreursParCommuneVente(
            idActuel
        );

    } catch (error) {
        console.error(
            "Erreur de chargement des livreurs :",
            error
        );

        catalogueLivreursVente = [];
        select.innerHTML =
            '<option value="">Impossible de charger les livreurs</option>';

    } finally {
        /*
         * Le livreur reste modifiable, y compris lors d'une conversion
         * Commande → Vente. Seul le statut "Livrée" reste verrouillé.
         */
        select.disabled = false;
    }
}


function afficherLivreursParCommuneVente(
    idAConserver = ""
) {
    const select =
        document.getElementById(
            "sale-delivery-person"
        );

    const commune =
        obtenirValeurVente(
            "sale-delivery-commune"
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
        normaliserZoneLivreurVente(
            commune
        );

    const livreursCompatibles =
        catalogueLivreursVente
            .filter(
                livreur =>
                    obtenirZonesLivreurVente(
                        livreur
                    ).some(
                        zone => {
                            const normalisee =
                                normaliserZoneLivreurVente(
                                    zone
                                );

                            return (
                                normalisee ===
                                    communeNormalisee ||
                                normalisee ===
                                    "toutes-les-zones" ||
                                normalisee ===
                                    "toute-zone" ||
                                normalisee ===
                                    "toutes-zones"
                            );
                        }
                    )
            )
            .sort(
                (a, b) =>
                    obtenirNomLivreurVente(a)
                        .localeCompare(
                            obtenirNomLivreurVente(b),
                            "fr",
                            { sensitivity: "base" }
                        )
            );

    /*
     * Si la commande avait déjà un livreur affecté, on le conserve
     * dans la liste même si sa couverture a changé depuis.
     */
    const livreurAConserver =
        ancienneValeur
            ? catalogueLivreursVente.find(
                livreur =>
                    String(
                        livreur.idLivreur ||
                        livreur["ID Livreur"] ||
                        ""
                    ).trim() ===
                    ancienneValeur
              )
            : null;

    if (
        livreurAConserver &&
        !livreursCompatibles.some(
            livreur =>
                String(
                    livreur.idLivreur ||
                    livreur["ID Livreur"] ||
                    ""
                ).trim() ===
                ancienneValeur
        )
    ) {
        livreursCompatibles.unshift(
            livreurAConserver
        );
    }

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

        if (ancienneValeur) {
            const optionHistorique =
                document.createElement(
                    "option"
                );

            optionHistorique.value =
                ancienneValeur;
            optionHistorique.textContent =
                `Livreur affecté : ${ancienneValeur}`;

            select.appendChild(
                optionHistorique
            );

            select.value =
                ancienneValeur;
        } else {
            select.value = "";
        }

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
                construireLibelleLivreurVente(
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
    } else if (
        ancienneValeur
    ) {
        /*
         * Dernier filet de sécurité : l'affectation historique de la
         * commande ne doit jamais être perdue visuellement.
         */
        const optionHistorique =
            document.createElement(
                "option"
            );

        optionHistorique.value =
            ancienneValeur;
        optionHistorique.textContent =
            `Livreur affecté : ${ancienneValeur}`;

        select.appendChild(
            optionHistorique
        );

        select.value =
            ancienneValeur;
    } else {
        select.value = "";
    }
}


function obtenirZonesLivreurVente(
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
        .split(/[,;|]+/)
        .map(zone => zone.trim())
        .filter(Boolean);
}


function obtenirNomLivreurVente(
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


function construireLibelleLivreurVente(
    livreur
) {
    const nom =
        obtenirNomLivreurVente(
            livreur
        );

    const transport =
        String(
            livreur?.moyenTransport ||
            livreur?.["Moyen de Transport"] ||
            ""
        ).trim();

    return [
        nom,
        transport
    ]
        .filter(Boolean)
        .join(" • ");
}


function normaliserZoneLivreurVente(
    valeur
) {
    return String(
        valeur ??
        ""
    )
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/\s+/g, "-");
}


/* ===========================================================
   PRODUITS — VRAIES DONNÉES
=========================================================== */

function initialiserProduitsVente() {
    const select =
        document.getElementById("sale-product-select");

    select?.addEventListener(
        "change",
        afficherInformationsProduitVente
    );

    document
        .getElementById("add-sale-product-btn")
        ?.addEventListener(
            "click",
            ajouterProduitVente
        );

    document
        .getElementById("sale-lines-table-body")
        ?.addEventListener(
            "click",
            gererActionsLignesVente
        );

    [
        "sale-product-select",
        "sale-product-quantity",
        "sale-product-discount"
    ].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener(
            id === "sale-product-select" ? "change" : "input",
            mettreAJourTotalLigneProduitVente
        );
    });

    chargerProduitsVente();
}


async function chargerProduitsVente() {
    if (typeof apiGet !== "function") {
        return;
    }

    const select =
        document.getElementById("sale-product-select");

    if (!select) {
        return;
    }

    const valeurActuelle =
        String(select.value || "").trim();

    select.disabled = true;
    select.innerHTML =
        '<option value="">Chargement des produits...</option>';

    try {
        const [resultatProduits, resultatStock] =
            await Promise.all([
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
                "Impossible de charger le stock disponible."
            );
        }

        const produits =
            extraireListeVente(
                resultatProduits,
                "produits"
            );

        const stocks =
            Array.isArray(resultatStock?.data)
                ? resultatStock.data
                : Array.isArray(resultatStock?.data?.stock)
                    ? resultatStock.data.stock
                    : Array.isArray(resultatStock?.stock)
                        ? resultatStock.stock
                        : [];

        const stockParProduit = new Map();

        stocks.forEach(stock => {
            const idProduit =
                String(
                    lireValeurObjetVente(
                        stock,
                        [
                            "ID Produit",
                            "idProduit",
                            "ID",
                            "id"
                        ]
                    ) || ""
                ).trim();

            if (!idProduit) {
                return;
            }

            stockParProduit.set(
                idProduit,
                Math.max(
                    0,
                    convertirNombreVente(
                        lireValeurObjetVente(
                            stock,
                            [
                                "Stock Disponible",
                                "stockDisponible",
                                "Stock Actuel",
                                "stockActuel",
                                "Stock",
                                "stock"
                            ]
                        )
                    )
                )
            );
        });

        catalogueProduitsVente =
            (Array.isArray(produits) ? produits : []).map(produit => {
                const idProduit =
                    obtenirIdProduitVente(produit);

                return {
                    ...produit,
                    stockDisponible:
                        stockParProduit.has(idProduit)
                            ? stockParProduit.get(idProduit)
                            : 0
                };
            });

        select.innerHTML =
            '<option value="">Sélectionner un produit</option>';

        catalogueProduitsVente
            .slice()
            .sort(
                (a, b) =>
                    obtenirNomProduitVente(a)
                        .localeCompare(
                            obtenirNomProduitVente(b),
                            "fr",
                            { sensitivity: "base" }
                        )
            )
            .forEach(produit => {
                const idProduit =
                    obtenirIdProduitVente(produit);

                if (!idProduit) {
                    return;
                }

                const option =
                    document.createElement("option");

                option.value = idProduit;
                option.textContent =
                    obtenirNomProduitVente(produit) ||
                    idProduit;
                option.dataset.stock =
                    String(obtenirStockProduitVente(produit));

                select.appendChild(option);
            });

        if (
            valeurActuelle &&
            Array.from(select.options).some(
                option => option.value === valeurActuelle
            )
        ) {
            select.value = valeurActuelle;
        }

        afficherInformationsProduitVente();

    } catch (error) {
        console.error(
            "Erreur de chargement des produits / stock :",
            error
        );

        select.innerHTML =
            '<option value="">Impossible de charger les produits</option>';

        afficherStockProduitVente(
            null,
            "Impossible de charger le stock."
        );

    } finally {
        select.disabled = false;
    }
}

function obtenirIdProduitVente(produit) {
    return String(
        lireValeurObjetVente(
            produit,
            [
                "ID Produit",
                "idProduit",
                "ID",
                "id"
            ]
        ) || ""
    ).trim();
}


function obtenirNomProduitVente(produit) {
    return String(
        lireValeurObjetVente(
            produit,
            [
                "Nom Produit",
                "nomProduit",
                "Désignation",
                "Designation",
                "designation",
                "Nom",
                "nom"
            ]
        ) || ""
    ).trim();
}


function obtenirPrixVenteProduit(produit) {
    return convertirNombreVente(
        lireValeurObjetVente(
            produit,
            [
                "Prix de Vente",
                "Prix Vente",
                "Prix de Vente Unitaire",
                "prixVente",
                "prixVenteUnitaire",
                "Prix Unitaire",
                "prixUnitaire"
            ]
        )
    );
}


function obtenirStockProduitVente(produit) {
    if (!produit) {
        return 0;
    }

    return Math.max(
        0,
        convertirNombreVente(
            lireValeurObjetVente(
                produit,
                [
                    "stockDisponible",
                    "Stock Disponible",
                    "Quantité Disponible",
                    "Quantite Disponible",
                    "quantiteDisponible",
                    "Stock Actuel",
                    "stockActuel",
                    "Stock",
                    "stock"
                ]
            )
        )
    );
}


function obtenirProduitVenteParId(idProduit) {
    const id =
        String(idProduit || "").trim();

    return (
        catalogueProduitsVente.find(
            produit =>
                obtenirIdProduitVente(produit) ===
                id
        ) ||
        null
    );
}


function obtenirNomProduitVenteParId(idProduit) {
    const produit =
        obtenirProduitVenteParId(
            idProduit
        );

    return produit
        ? obtenirNomProduitVente(produit)
        : "";
}


function afficherInformationsProduitVente() {
    const idProduit =
        obtenirValeurVente(
            "sale-product-select"
        );

    const produit =
        obtenirProduitVenteParId(
            idProduit
        );

    if (!produit) {
        definirValeurVente(
            "sale-product-price",
            ""
        );

        afficherStockProduitVente(
            null
        );

        return;
    }

    const prix =
        obtenirPrixVenteProduit(
            produit
        );

    definirValeurVente(
        "sale-product-price",
        prix
            ? formaterNombreChampVente(prix)
            : "0"
    );

    afficherStockProduitVente(
        obtenirStockProduitVente(
            produit
        )
    );

    mettreAJourTotalLigneProduitVente();
}


function afficherStockProduitVente(
    stock,
    messagePersonnalise = ""
) {
    const zone =
        document.getElementById(
            "sale-product-stock"
        );

    if (!zone) {
        return;
    }

    zone.className =
        "product-stock-info stock-neutral";

    if (messagePersonnalise) {
        zone.textContent =
            messagePersonnalise;

        return;
    }

    if (stock === null || stock === undefined) {
        zone.textContent =
            "Stock disponible : —";

        return;
    }

    const quantite =
        Math.max(
            0,
            convertirNombreVente(stock)
        );

    zone.textContent =
        `Stock disponible : ${quantite}`;

    if (quantite <= 0) {
        zone.className =
            "product-stock-info stock-out";

        zone.textContent +=
            " — Rupture de stock";

    } else if (quantite <= 5) {
        zone.className =
            "product-stock-info stock-low";

        zone.textContent +=
            " — Stock faible";

    } else {
        zone.className =
            "product-stock-info stock-ok";
    }
}


function mettreAJourTotalLigneProduitVente() {
    const produit = obtenirProduitVenteParId(
        obtenirValeurVente("sale-product-select")
    );
    const quantite = Math.max(0, Math.trunc(
        convertirNombreVente(obtenirValeurVente("sale-product-quantity"))
    ));
    const remise = Math.max(0,
        convertirNombreVente(obtenirValeurVente("sale-product-discount"))
    );
    const prixUnitaire = produit ? obtenirPrixVenteProduit(produit) : 0;
    const totalLigne = Math.max(0, quantite * prixUnitaire - remise);
    definirValeurVente("sale-product-line-total", formaterNombreChampVente(totalLigne));
}


/* ===========================================================
   LIGNES DE VENTE
=========================================================== */

function ajouterProduitVente() {
    const idProduit =
        obtenirValeurVente(
            "sale-product-select"
        );

    const quantite =
        Math.trunc(
            convertirNombreVente(
                obtenirValeurVente(
                    "sale-product-quantity"
                )
            )
        );

    const remise =
        Math.max(
            0,
            convertirNombreVente(
                obtenirValeurVente(
                    "sale-product-discount"
                )
            )
        );

    const produit =
        obtenirProduitVenteParId(
            idProduit
        );

    if (!produit) {
        afficherMessageVente(
            "Sélectionnez un produit.",
            "error"
        );
        return;
    }

    if (quantite <= 0) {
        afficherMessageVente(
            "La quantité doit être supérieure à zéro.",
            "error"
        );
        return;
    }

    const ligneEnEdition =
        ligneVenteEnModificationId
            ? lignesVente.find(
                ligne =>
                    String(ligne.idLigne) ===
                    String(ligneVenteEnModificationId)
              )
            : null;

    const stockDisponible =
        obtenirStockProduitVente(
            produit
        );

    /*
     * En modification d'une ligne déjà vendue, sa quantité actuelle
     * est déjà sortie du stock. Si on conserve le même produit,
     * on la rajoute donc au maximum disponible pour éviter un faux
     * message de stock insuffisant.
     */
    const quantiteRestituable =
        (
            ligneEnEdition &&
            String(ligneEnEdition.idProduit) ===
            String(idProduit)
        )
            ? convertirNombreVente(
                ligneEnEdition.quantite
              )
            : 0;

    const quantiteAutresLignes =
        lignesVente
            .filter(
                ligne =>
                    String(ligne.idProduit) ===
                    String(idProduit) &&
                    (
                        !ligneEnEdition ||
                        String(ligne.idLigne) !==
                        String(ligneEnEdition.idLigne)
                    )
            )
            .reduce(
                (total, ligne) =>
                    total +
                    convertirNombreVente(
                        ligne.quantite
                    ),
                0
            );

    const maximumAutorise =
        Math.max(
            0,
            stockDisponible +
            quantiteRestituable -
            quantiteAutresLignes
        );

    if (
        quantite >
        maximumAutorise
    ) {
        afficherMessageVente(
            `Stock insuffisant. Quantité maximale autorisée : ${maximumAutorise}.`,
            "error"
        );
        return;
    }

    const prixSaisi =
        convertirNombreVente(
            obtenirValeurVente(
                "sale-product-price"
            )
        );

    const prixUnitaire =
        ligneEnEdition
            ? prixSaisi
            : obtenirPrixVenteProduit(
                produit
              );

    if (prixUnitaire < 0) {
        afficherMessageVente(
            "Le prix de vente du produit est invalide.",
            "error"
        );
        return;
    }

    const montantBrut =
        quantite *
        prixUnitaire;

    if (remise > montantBrut) {
        afficherMessageVente(
            "La remise ne peut pas dépasser le montant de la ligne.",
            "error"
        );
        return;
    }

    const lignePreparee = {
        idLigne:
            ligneEnEdition
                ? ligneEnEdition.idLigne
                : genererIdLocalVente(),

        idProduit:
            idProduit,

        designation:
            obtenirNomProduitVente(
                produit
            ) ||
            idProduit,

        stockDisponible:
            stockDisponible,

        quantite:
            quantite,

        quantiteVendue:
            quantite,

        prixUnitaire:
            prixUnitaire,

        prixVenteUnitaire:
            prixUnitaire,

        remise:
            remise,

        sousTotal:
            Math.max(
                0,
                montantBrut -
                remise
            ),

        commentaire:
            ligneEnEdition
                ? (
                    ligneEnEdition.commentaire ||
                    ""
                  )
                : ""
    };

    if (ligneEnEdition) {
        const index =
            lignesVente.findIndex(
                ligne =>
                    String(ligne.idLigne) ===
                    String(ligneEnEdition.idLigne)
            );

        lignesVente[index] =
            lignePreparee;

    } else {
        const ligneExistante =
            lignesVente.find(
                ligne =>
                    String(ligne.idProduit) ===
                    String(idProduit)
            );

        if (ligneExistante) {
            ligneExistante.quantite +=
                quantite;

            ligneExistante.remise +=
                remise;

            ligneExistante.sousTotal =
                Math.max(
                    0,
                    ligneExistante.quantite *
                    ligneExistante.prixUnitaire -
                    ligneExistante.remise
                );

        } else {
            lignesVente.push(
                lignePreparee
            );
        }
    }

    annulerEditionLigneVente();
    masquerMessageVente();
    afficherLignesVente();
    recalculerTotauxVente();
}

function gererActionsLignesVente(event) {
    const boutonModifier =
        event.target.closest(
            "[data-edit-sale-line]"
        );

    if (boutonModifier) {
        ouvrirEditionLigneVente(
            boutonModifier.dataset.editSaleLine
        );
        return;
    }

    const bouton =
        event.target.closest(
            "[data-delete-sale-line]"
        );

    if (!bouton) {
        return;
    }

    const idLigne =
        bouton.dataset.deleteSaleLine;

    lignesVente =
        lignesVente.filter(
            ligne =>
                String(ligne.idLigne) !==
                String(idLigne)
        );

    if (
        String(ligneVenteEnModificationId) ===
        String(idLigne)
    ) {
        annulerEditionLigneVente();
    }

    afficherLignesVente();
    recalculerTotauxVente();
}


function ouvrirEditionLigneVente(
    idLigne
) {
    const ligne =
        lignesVente.find(
            element =>
                String(element.idLigne) ===
                String(idLigne)
        );

    if (!ligne) {
        return;
    }

    ligneVenteEnModificationId =
        ligne.idLigne;

    definirValeurVente(
        "sale-product-select",
        ligne.idProduit
    );

    definirValeurVente(
        "sale-product-quantity",
        ligne.quantite
    );

    const champPrix =
        document.getElementById(
            "sale-product-price"
        );

    if (champPrix) {
        champPrix.readOnly = false;
        champPrix.value =
            formaterNombreChampVente(
                ligne.prixUnitaire
            );
    }

    definirValeurVente(
        "sale-product-discount",
        formaterNombreChampVente(
            ligne.remise
        )
    );

    definirValeurVente(
        "sale-product-line-total",
        formaterNombreChampVente(
            ligne.sousTotal
        )
    );

    const boutonAjouter =
        document.getElementById(
            "add-sale-product-btn"
        );

    if (boutonAjouter) {
        boutonAjouter.textContent =
            "💾 Mettre à jour la ligne";
    }

    const produit =
        obtenirProduitVenteParId(
            ligne.idProduit
        );

    afficherStockProduitVente(
        produit
    );

    document
        .getElementById(
            "sale-product-quantity"
        )
        ?.focus();
}


function annulerEditionLigneVente() {
    ligneVenteEnModificationId = null;

    definirValeurVente(
        "sale-product-select",
        ""
    );

    definirValeurVente(
        "sale-product-quantity",
        ""
    );

    definirValeurVente(
        "sale-product-price",
        ""
    );

    definirValeurVente(
        "sale-product-discount",
        ""
    );

    definirValeurVente(
        "sale-product-line-total",
        "0"
    );

    const champPrix =
        document.getElementById(
            "sale-product-price"
        );

    if (champPrix) {
        champPrix.readOnly =
            !venteEnModificationId;
    }

    const boutonAjouter =
        document.getElementById(
            "add-sale-product-btn"
        );

    if (boutonAjouter) {
        boutonAjouter.textContent =
            "➕ Ajouter le produit";
    }

    afficherStockProduitVente(null);
}


function afficherLignesVente() {
    const tbody =
        document.getElementById(
            "sale-lines-table-body"
        );

    if (!tbody) {
        return;
    }

    if (!lignesVente.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table">
                    Aucun produit ajouté.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML =
        lignesVente
            .map(
                ligne => `
                    <tr>
                        <td>
                            <strong>
                                ${echapperHTMLVente(
                                    ligne.designation ||
                                    ligne.idProduit
                                )}
                            </strong>
                        </td>

                        <td>
                            ${convertirNombreVente(
                                ligne.quantite
                            )}
                        </td>

                        <td>
                            ${formaterFCFAVente(
                                ligne.prixUnitaire
                            )}
                        </td>

                        <td>
                            ${formaterFCFAVente(
                                ligne.remise
                            )}
                        </td>

                        <td>
                            <strong>
                                ${formaterFCFAVente(
                                    ligne.sousTotal
                                )}
                            </strong>
                        </td>

                        <td>
                            <button
                                type="button"
                                class="table-action-btn edit-btn"
                                data-edit-sale-line="${echapperHTMLVente(
                                    ligne.idLigne
                                )}"
                                title="Modifier la ligne"
                            >
                                ✏️
                            </button>

                            <button
                                type="button"
                                class="table-action-btn delete-btn"
                                data-delete-sale-line="${echapperHTMLVente(
                                    ligne.idLigne
                                )}"
                                title="Retirer le produit"
                            >
                                🗑️
                            </button>
                        </td>
                    </tr>
                `
            )
            .join("");
}


/* ===========================================================
   CALCULS FINANCIERS
=========================================================== */

function initialiserCalculsVente() {
    [
        "sale-paid-amount",
        "sale-delivery-fees",
        "sale-global-discount"
    ].forEach(id => {
        const champ =
            document.getElementById(id);

        champ?.addEventListener(
            "input",
            () => {
                limiterSaisieMontantVente(
                    champ
                );

                recalculerTotauxVente();
            }
        );

        champ?.addEventListener(
            "focus",
            () => {
                champ.value =
                    nombreBrutChampVente(
                        champ.value
                    );
            }
        );

        champ?.addEventListener(
            "blur",
            () => {
                const valeur =
                    convertirNombreVente(
                        champ.value
                    );

                champ.value =
                    valeur
                        ? formaterNombreChampVente(
                            valeur
                        )
                        : "";

                recalculerTotauxVente();
            }
        );
    });

    [
        "sale-product-quantity",
        "sale-product-discount"
    ].forEach(id => {
        const champ =
            document.getElementById(id);

        champ?.addEventListener(
            "input",
            () => limiterSaisieMontantVente(
                champ
            )
        );
    });
}


function recalculerTotauxVente() {
    const montantTotal =
        lignesVente.reduce(
            (total, ligne) =>
                total +
                (
                    convertirNombreVente(ligne.quantite) *
                    convertirNombreVente(ligne.prixUnitaire)
                ),
            0
        );

    const remiseProduits =
        lignesVente.reduce(
            (total, ligne) =>
                total +
                convertirNombreVente(ligne.remise),
            0
        );

    const remiseGlobale =
        Math.max(
            0,
            convertirNombreVente(
                obtenirValeurVente("sale-global-discount")
            )
        );

    const maximumRemiseGlobale =
        Math.max(
            0,
            montantTotal - remiseProduits
        );

    const remiseGlobaleValidee =
        Math.min(
            remiseGlobale,
            maximumRemiseGlobale
        );

    const remiseTotale =
        remiseProduits +
        remiseGlobaleValidee;

    const fraisLivraisonSaisi =
        Math.max(
            0,
            convertirNombreVente(
                obtenirValeurVente("sale-delivery-fees")
            )
        );

    const fraisLivraison =
        normaliserTexteVente(
            obtenirValeurVente(
                "sale-delivery-mode"
            )
        ) === "livraison"
            ? fraisLivraisonSaisi
            : 0;

    const montantNet =
        Math.max(
            0,
            montantTotal -
            remiseTotale +
            fraisLivraison
        );

    let montantPaye =
        Math.max(
            0,
            convertirNombreVente(
                obtenirValeurVente(
                    "sale-paid-amount"
                )
            )
        );

    /*
     * Règle validée : un paiement ne peut pas dépasser le net.
     * Pendant la saisie on borne uniquement le calcul.
     */
    const montantPayePrisEnCompte =
        Math.min(
            montantPaye,
            montantNet
        );

    const resteAPayer =
        Math.max(
            0,
            montantNet -
            montantPayePrisEnCompte
        );

    const statutPaiement =
        calculerStatutPaiementVente(
            montantNet,
            montantPayePrisEnCompte
        );

    definirValeurVente(
        "sale-total",
        formaterNombreChampVente(
            montantTotal
        )
    );

    definirValeurVente(
        "sale-total-discount",
        formaterNombreChampVente(
            remiseTotale
        )
    );

    definirValeurVente(
        "sale-net-amount",
        formaterNombreChampVente(
            montantNet
        )
    );

    definirValeurVente(
        "sale-amount-due",
        formaterNombreChampVente(
            montantNet
        )
    );

    definirValeurVente(
        "sale-paid-summary",
        formaterNombreChampVente(
            montantPayePrisEnCompte
        )
    );

    definirValeurVente(
        "sale-balance",
        formaterNombreChampVente(
            resteAPayer
        )
    );

    definirValeurVente(
        "sale-payment-status",
        statutPaiement
    );

    return {
        montantTotal,
        remiseTotale,
        remiseGlobale:
            remiseGlobaleValidee,
        fraisLivraison,
        montantNet,
        montantPaye:
            montantPayePrisEnCompte,
        resteAPayer,
        statutPaiement
    };
}


function calculerStatutPaiementVente(
    montantNet,
    montantPaye
) {
    const net =
        Math.max(
            0,
            convertirNombreVente(
                montantNet
            )
        );

    const paye =
        Math.max(
            0,
            convertirNombreVente(
                montantPaye
            )
        );

    if (net <= 0 || paye >= net) {
        return "Payée";
    }

    if (paye > 0) {
        return "Partiellement payée";
    }

    return "Impayée";
}


/* ===========================================================
   ENREGISTREMENT VENTE
=========================================================== */

function initialiserEnregistrementVente() {
    document
        .getElementById("sale-form")
        ?.addEventListener(
            "submit",
            enregistrerVente
        );
}


function demanderTraitementTropPercuVente(montant) {
    return new Promise(resolve => {
        document.getElementById("sale-overpayment-modal-dynamic")?.remove();
        const overlay = document.createElement("div");
        overlay.id = "sale-overpayment-modal-dynamic";
        overlay.className = "modal-overlay active";
        overlay.setAttribute("aria-hidden", "false");
        overlay.innerHTML = `
            <div class="modal-container" style="max-width:520px">
                <div class="modal-header"><div><h3 style="margin:0">Trop-perçu à traiter</h3><p style="margin:.35rem 0 0">Le nouveau total est inférieur au montant déjà payé.</p></div></div>
                <div class="modal-body">
                    <div class="form-message info" style="display:block;margin-bottom:1rem">Trop-perçu client : <strong>${echapperHTMLVente(formaterFCFAVente(montant))}</strong></div>
                    <div class="form-group"><label for="sale-overpayment-treatment">Traitement</label><select id="sale-overpayment-treatment" class="form-control"><option value="">Sélectionner</option><option value="remboursement">Rembourser au client</option><option value="avoir">Créer un avoir client (facture d’avoir)</option></select></div>
                    <div id="sale-overpayment-refund-mode-wrap" class="form-group" style="display:none"><label for="sale-overpayment-refund-mode">Mode de remboursement</label><select id="sale-overpayment-refund-mode" class="form-control"><option value="">Sélectionner</option><option value="especes">Espèces</option><option value="mobile-money">Mobile Money</option><option value="virement">Virement</option><option value="carte">Carte</option><option value="autre">Autre</option></select></div>
                </div>
                <div class="modal-footer"><button type="button" class="btn btn-secondary" data-overpayment-cancel>Annuler</button><button type="button" class="btn btn-primary" data-overpayment-confirm>Valider</button></div>
            </div>`;
        document.body.appendChild(overlay);
        document.body.classList.add("modal-open");
        const traitement=overlay.querySelector("#sale-overpayment-treatment"), bloc=overlay.querySelector("#sale-overpayment-refund-mode-wrap"), mode=overlay.querySelector("#sale-overpayment-refund-mode");
        const fermer=resultat=>{ overlay.remove(); resolve(resultat); };
        traitement.addEventListener("change",()=>{ bloc.style.display=traitement.value==="remboursement"?"block":"none"; });
        overlay.querySelector("[data-overpayment-cancel]").addEventListener("click",()=>fermer(null));
        overlay.querySelector("[data-overpayment-confirm]").addEventListener("click",()=>{
            if(!traitement.value){ traitement.focus(); return; }
            const modeRemboursement=traitement.value==="remboursement"?mode.value:"";
            if(traitement.value==="remboursement"&&!modeRemboursement){ mode.focus(); return; }
            fermer({traitement:traitement.value,modeRemboursement});
        });
    });
}


async function enregistrerVente(event) {
    event.preventDefault();

    const formulaire =
        document.getElementById("sale-form");

    const bouton =
        document.getElementById("save-sale-btn");

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

    if (!lignesVente.length) {
        afficherMessageVente(
            "Ajoutez au moins un produit à la vente.",
            "error"
        );
        return;
    }

    const modeRemise =
        obtenirValeurVente(
            "sale-delivery-mode"
        ) ||
        "retrait-boutique";

    if (modeRemise === "livraison") {
        if (!obtenirValeurVente("sale-delivery-commune")) {
            afficherMessageVente(
                "Sélectionnez la commune de livraison.",
                "error"
            );
            return;
        }

        if (!obtenirValeurVente("sale-delivery-address")) {
            afficherMessageVente(
                "Renseignez l'adresse précise de livraison.",
                "error"
            );
            return;
        }
    }

    const totaux =
        recalculerTotauxVente();

    const montantPayeSaisi =
        Math.max(
            0,
            convertirNombreVente(
                obtenirValeurVente(
                    "sale-paid-amount"
                )
            )
        );

    if (
        !venteEnModificationId &&
        montantPayeSaisi >
        totaux.montantNet
    ) {
        afficherMessageVente(
            "Le montant payé ne peut pas dépasser le montant net.",
            "error"
        );
        return;
    }

    /*
     * Nouvelle vérification locale du stock au moment de valider.
     * Le backend devra refaire la même vérification avant écriture.
     */
    for (const ligne of lignesVente) {
        const produit =
            obtenirProduitVenteParId(
                ligne.idProduit
            );

        if (!produit) {
            afficherMessageVente(
                `Le produit ${ligne.idProduit} est introuvable.`,
                "error"
            );
            return;
        }

        const stock =
            obtenirStockProduitVente(
                produit
            );

        if (
            convertirNombreVente(
                ligne.quantite
            ) >
            stock
        ) {
            afficherMessageVente(
                `Stock insuffisant pour ${ligne.designation}. Disponible : ${stock}.`,
                "error"
            );
            return;
        }
    }

    formulaire.dataset.processing =
        "true";

    const utilisateur =
        typeof getCurrentUser ===
        "function"
            ? getCurrentUser()
            : null;

    const donnees = {
        idVente:
            venteEnModificationId ||
            "",

        idCommande:
            obtenirValeurVente(
                "sale-order-id"
            ),

        idClient:
            obtenirValeurVente(
                "sale-client"
            ),

        dateVente:
            obtenirValeurVente(
                "sale-date"
            ),

        heureVente:
            obtenirValeurVente(
                "sale-time"
            ),

        montantTotal:
            totaux.montantTotal,

        remiseTotale:
            totaux.remiseTotale,

        remiseGlobale:
            totaux.remiseGlobale,

        fraisLivraison:
            totaux.fraisLivraison,

        montantNet:
            totaux.montantNet,

        montantPaye:
            totaux.montantPaye,

        resteAPayer:
            totaux.resteAPayer,

        modePaiement:
            obtenirValeurVente(
                "sale-payment-method"
            ),

        statutPaiement:
            totaux.statutPaiement,

        statutLivraison:
            obtenirValeurVente(
                "sale-delivery-status"
            ) ||
            "retrait-boutique",

        modeRemise:
            obtenirValeurVente(
                "sale-delivery-mode"
            ) ||
            "retrait-boutique",

        idLivreur:
            obtenirValeurVente(
                "sale-delivery-person"
            ),

        zoneLivraison:
            obtenirValeurVente(
                "sale-delivery-zone"
            ),

        communeLivraison:
            obtenirValeurVente(
                "sale-delivery-commune"
            ),

        adresseLivraison:
            obtenirValeurVente(
                "sale-delivery-address"
            ),

        dateLivraisonPrevue:
            obtenirValeurVente(
                "sale-delivery-date"
            ),

        idUtilisateur:
            String(
                utilisateur?.idUtilisateur ||
                utilisateur?.["ID Utilisateur"] ||
                utilisateur?.id ||
                ""
            ).trim(),

        commentaire:
            obtenirValeurVente(
                "sale-comment"
            ),

        lignes:
            lignesVente.map(
                ligne => ({
                    idProduit:
                        ligne.idProduit,

                    quantite:
                        convertirNombreVente(
                            ligne.quantite
                        ),

                    quantiteVendue:
                        convertirNombreVente(
                            ligne.quantite
                        ),

                    prixUnitaire:
                        convertirNombreVente(
                            ligne.prixUnitaire
                        ),

                    prixVenteUnitaire:
                        convertirNombreVente(
                            ligne.prixUnitaire
                        ),

                    remise:
                        convertirNombreVente(
                            ligne.remise
                        ),

                    sousTotal:
                        convertirNombreVente(
                            ligne.sousTotal
                        ),

                    commentaire:
                        ligne.commentaire ||
                        ""
                })
            )
    };

    if (venteEnModificationId) {
        const venteAvantModification = ventesChargees.find(vente => String(vente.idVente) === String(venteEnModificationId));
        const montantDejaPaye = convertirNombreVente(venteAvantModification?.montantPaye);
        const tropPercu = Math.max(0, montantDejaPaye - convertirNombreVente(donnees.montantNet));
        if (tropPercu > 0) {
            const decision = await demanderTraitementTropPercuVente(tropPercu);
            if (!decision) { formulaire.dataset.processing = "false"; return; }
            donnees.traitementTropPercu = decision.traitement;
            donnees.modeRemboursementTropPercu = decision.modeRemboursement;
            donnees.montantTropPercu = tropPercu;
            donnees.montantPaye = Math.min(montantDejaPaye, convertirNombreVente(donnees.montantNet));
            donnees.resteAPayer = Math.max(0, convertirNombreVente(donnees.montantNet) - donnees.montantPaye);
        }
    }

    try {
        definirBoutonChargementVente(
            bouton,
            true,
            venteEnModificationId
                ? "Modification..."
                : "Enregistrement..."
        );

        afficherMessageVente(
            venteEnModificationId
                ? "Modification de la vente..."
                : "Enregistrement de la vente...",
            "info"
        );

        const action =
            venteEnModificationId
                ? "updateVente"
                : "createVente";

        const resultat =
            await apiPost(
                action,
                donnees
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer la vente."
            );
        }

        afficherToastVente(
            resultat.message ||
            (
                venteEnModificationId
                    ? "Vente modifiée avec succès."
                    : "Vente enregistrée avec succès."
            ),
            "success"
        );

        fermerModaleVente();
        reinitialiserFormulaireVente();

        /*
         * On recharge les données officielles : ventes + produits,
         * car une vente validée peut modifier le stock.
         */
        await Promise.allSettled([
            chargerVentes({ silencieux: true, conserverPage: true }),
            chargerProduitsVente()
        ]);

    } catch (error) {
        console.error(
            "Erreur d'enregistrement de la vente :",
            error
        );

        afficherMessageVente(
            error.message ||
            "Une erreur est survenue.",
            "error"
        );

    } finally {
        formulaire.dataset.processing =
            "false";

        definirBoutonChargementVente(
            bouton,
            false,
            venteEnModificationId
                ? "Enregistrer les modifications"
                : "Enregistrer la vente"
        );
    }
}


/* ===========================================================
   LISTE DES VENTES — VRAIES DONNÉES
=========================================================== */

function initialiserListeVentes() {
    document
        .querySelector(".header .search-input")
        ?.addEventListener(
            "input",
            appliquerFiltresVentes
        );

    initialiserMenuActionsVentes();
    initialiserModeSelectionVentes();

    [
        "sale-payment-status-filter",
        "sale-delivery-status-filter",
        "sale-payment-method-filter",
        "sale-client-filter"
    ].forEach(id => {
        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                appliquerFiltresVentes
            );
    });

    document
        .getElementById("reset-sale-filters")
        ?.addEventListener(
            "click",
            reinitialiserFiltresVentes
        );

    document
        .getElementById("refresh-sales-btn")
        ?.addEventListener(
            "click",
            chargerVentes
        );

    document
        .getElementById("sales-per-page")
        ?.addEventListener(
            "change",
            event => {
                taillePageVentes =
                    Math.max(
                        1,
                        Number(
                            event.target.value
                        ) ||
                        10
                    );

                pageVentesActuelle = 1;
                afficherTableauVentes();
            }
        );

    document
        .getElementById("previous-sale-page-btn")
        ?.addEventListener(
            "click",
            () => {
                if (
                    pageVentesActuelle >
                    1
                ) {
                    pageVentesActuelle--;
                    afficherTableauVentes();
                }
            }
        );

    document
        .getElementById("next-sale-page-btn")
        ?.addEventListener(
            "click",
            () => {
                const totalPages =
                    Math.max(
                        1,
                        Math.ceil(
                            ventesFiltrees.length /
                            taillePageVentes
                        )
                    );

                if (
                    pageVentesActuelle <
                    totalPages
                ) {
                    pageVentesActuelle++;
                    afficherTableauVentes();
                }
            }
        );

    document
        .getElementById("sales-table-body")
        ?.addEventListener(
            "click",
            gererActionsTableauVentes
        );

    document
        .getElementById("close-view-sale-modal")
        ?.addEventListener(
            "click",
            fermerModaleVoirVente
        );

    document
        .getElementById("close-view-sale-footer")
        ?.addEventListener(
            "click",
            fermerModaleVoirVente
        );

    document
        .getElementById("view-sale-modal")
        ?.addEventListener(
            "click",
            event => {
                if (
                    event.target.id ===
                    "view-sale-modal"
                ) {
                    fermerModaleVoirVente();
                }
            }
        );

    document
        .getElementById("print-sales-btn")
        ?.addEventListener(
            "click",
            () => window.print()
        );

    initialiserModaleRetourVente();
    initialiserHistoriqueRetoursVente();
    initialiserEncaissementPaiementVente();
    initialiserConfirmationSuppressionVente();

    chargerVentes();
}


async function chargerVentes(options = {}) {
    const { silencieux = false, conserverPage = false } = options;

    const tbody =
        document.getElementById(
            "sales-table-body"
        );

    /*
     * Lors d'une actualisation déclenchée après une création, une modification
     * ou une suppression, on conserve le tableau actuel à l'écran jusqu'à ce
     * que les nouvelles données soient prêtes. Cela évite le clignotement et
     * la disparition temporaire de la liste des ventes.
     *
     * Le chargement visible reste utilisé au premier affichage et lorsque
     * l'utilisateur clique volontairement sur le bouton Actualiser.
     */
    if (tbody && !silencieux) {
        document.body.classList.add(
            "sales-data-loading"
        );

        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="empty-table sales-loading-cell">
                    <span class="sales-loader" aria-hidden="true"></span>
                    <span>Chargement des ventes...</span>
                </td>
            </tr>
        `;
    }

    try {
        const resultat =
            await apiGet("getVentes");

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger les ventes."
            );
        }

        ventesChargees =
            extraireListeVente(
                resultat,
                "ventes"
            );

        mettreAJourKPIVentes();
        appliquerFiltresVentes(conserverPage);

    } catch (error) {
        console.error(
            "Erreur de chargement des ventes :",
            error
        );

        /*
         * En mode silencieux, on garde les anciennes données affichées en cas
         * d'échec du rafraîchissement. Une erreur réseau ne doit donc pas faire
         * disparaître un tableau qui était déjà utilisable.
         */
        if (!silencieux) {
            ventesChargees = [];
            ventesFiltrees = [];

            afficherTableauVentes();
            mettreAJourKPIVentes();
        }

        /*
         * Tant que VentesService.gs n'est pas encore branché,
         * aucune donnée fictive n'est affichée.
         */
        afficherToastVente(
            error.message ||
            "Impossible de charger les ventes.",
            "error"
        );
    } finally {
        document.body.classList.remove(
            "sales-data-loading"
        );

        [
            "total-sales-value",
            "sales-revenue-value",
            "sales-paid-value",
            "sales-balance-value"
        ].forEach(id => {
            document
                .getElementById(id)
                ?.classList.remove(
                    "is-loading"
                );
        });
    }
}


function appliquerFiltresVentes(
    conserverPage = false
) {
    const recherche =
        normaliserTexteVente(
            document
                .querySelector(".header .search-input")
                ?.value ||
            ""
        );

    const statutPaiement =
        normaliserTexteVente(
            obtenirValeurVente(
                "sale-payment-status-filter"
            )
        );

    const statutLivraison =
        normaliserTexteVente(
            obtenirValeurVente(
                "sale-delivery-status-filter"
            )
        );

    const modePaiement =
        normaliserTexteVente(
            obtenirValeurVente(
                "sale-payment-method-filter"
            )
        );

    const idClient =
        obtenirValeurVente(
            "sale-client-filter"
        );

    ventesFiltrees =
        ventesChargees.filter(
            vente => {
                const texte =
                    normaliserTexteVente(
                        [
                            vente.numeroVente,
                            vente.idVente,
                            vente.numeroCommande,
                            vente.idCommande,
                            vente.idClient,
                            obtenirNomClientVenteParId(
                                vente.idClient
                            ),
                            vente.dateVente,
                            vente.heureVente,
                            vente.modePaiement,
                            vente.statutPaiement,
                            vente.statutLivraison
                        ].join(" ")
                    );

                const correspondRecherche =
                    !recherche ||
                    texte.includes(
                        recherche
                    );

                const correspondPaiement =
                    !statutPaiement ||
                    normaliserTexteVente(
                        vente.statutPaiement
                    ) ===
                    statutPaiement;

                const correspondLivraison =
                    !statutLivraison ||
                    normaliserTexteVente(
                        vente.statutLivraison
                    ) ===
                    statutLivraison;

                const correspondMode =
                    !modePaiement ||
                    normaliserTexteVente(
                        vente.modePaiement
                    ) ===
                    modePaiement;

                const correspondClient =
                    !idClient ||
                    String(
                        vente.idClient ||
                        ""
                    ) ===
                    String(idClient);

                return (
                    correspondRecherche &&
                    correspondPaiement &&
                    correspondLivraison &&
                    correspondMode &&
                    correspondClient
                );
            }
        );

    if (!conserverPage) {
        pageVentesActuelle = 1;
    }

    afficherTableauVentes();
}


function reinitialiserFiltresVentes() {
    [
        "sale-payment-status-filter",
        "sale-delivery-status-filter",
        "sale-payment-method-filter",
        "sale-client-filter"
    ].forEach(
        id => definirValeurVente(
            id,
            ""
        )
    );

    const rechercheHeader =
        document.querySelector(
            ".header .search-input"
        );

    if (rechercheHeader) {
        rechercheHeader.value = "";
    }

    appliquerFiltresVentes();
}


function afficherTableauVentes() {
    const tbody =
        document.getElementById(
            "sales-table-body"
        );

    if (!tbody) {
        return;
    }

    const total =
        ventesFiltrees.length;

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total /
                taillePageVentes
            )
        );

    pageVentesActuelle =
        Math.min(
            pageVentesActuelle,
            totalPages
        );

    const debut =
        (
            pageVentesActuelle -
            1
        ) *
        taillePageVentes;

    const fin =
        debut +
        taillePageVentes;

    const page =
        ventesFiltrees.slice(
            debut,
            fin
        );

    if (!page.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="empty-table">
                    Aucune vente enregistrée.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML =
            page
                .map(
                    creerLigneVenteHTML
                )
                .join("");
    }

    const compteur =
        document.getElementById(
            "filtered-sale-count"
        );

    if (compteur) {
        compteur.textContent =
            String(total);
    }

    afficherPaginationVentes(
        totalPages,
        total,
        debut,
        Math.min(
            fin,
            total
        )
    );

    if (modeSelectionVentes) {
        synchroniserSelectionVentes();
    }
}


function estVenteAnnuleeApresEchecLivraison(
    vente
) {
    if (!vente) {
        return false;
    }

    const statut =
        normaliserTexteVente(
            vente.statutLivraison ||
            ""
        );

    const commentaire =
        String(
            vente.commentaire ||
            ""
        );

    return (
        statut === "annulee" &&
        commentaire.includes(
            "[Échec définitif livraison "
        )
    );
}


function creerLigneVenteHTML(vente) {
    const venteVerrouillee =
        estVenteAnnuleeApresEchecLivraison(
            vente
        );

    const client =
        obtenirNomClientVenteParId(
            vente.idClient
        ) ||
        vente.nomClient ||
        vente.idClient ||
        "—";

    const numeroCommande =
        vente.numeroCommande ||
        vente.idCommande ||
        "—";

    return `
        <tr>
            <td class="sale-selection-column">
                <input
                    type="checkbox"
                    class="sale-select-checkbox"
                    data-select-sale="${echapperHTMLVente(
                        vente.idVente
                    )}"
                    aria-label="Sélectionner la vente"
                    ${ventesSelectionnees.has(String(vente.idVente)) ? "checked" : ""}
                >
            </td>

            <td>
                <strong>
                    ${echapperHTMLVente(
                        vente.numeroVente ||
                        vente.idVente ||
                        "—"
                    )}
                </strong>
            </td>

            <td>
                ${echapperHTMLVente(
                    numeroCommande
                )}
            </td>

            <td>
                ${echapperHTMLVente(
                    client
                )}
            </td>

            <td>
                ${echapperHTMLVente(
                    [
                        vente.dateVente,
                        vente.heureVente
                    ]
                        .filter(Boolean)
                        .join(" ")
                )}
            </td>

            <td>
                <strong>
                    ${formaterFCFAVente(
                        vente.montantNet
                    )}
                </strong>
            </td>

            <td>
                ${formaterFCFAVente(
                    vente.montantPaye
                )}
            </td>

            <td>
                ${formaterFCFAVente(
                    vente.resteAPayer
                )}
            </td>

            <td>
                ${echapperHTMLVente(
                    formaterLibelleVente(
                        vente.modePaiement
                    )
                )}
            </td>

            <td>
                <span class="status-badge">
                    ${echapperHTMLVente(
                        formaterLibelleVente(
                            vente.statutPaiement
                        )
                    )}
                </span>
            </td>

            <td>
                <span class="status-badge">
                    ${echapperHTMLVente(
                        formaterLibelleVente(
                            vente.statutLivraison
                        )
                    )}
                </span>
            </td>

            <td>
                <span class="status-badge">
                    ${echapperHTMLVente(
                        formaterLibelleRetourVente(
                            vente.statutRetour ||
                            "aucun-retour"
                        )
                    )}
                </span>
            </td>

            <td class="sale-actions-cell">
                <div class="sale-row-menu">
                    <button
                        type="button"
                        class="sale-row-menu-trigger"
                        data-sale-actions-toggle="${echapperHTMLVente(
                            vente.idVente
                        )}"
                        aria-label="Afficher les actions de la vente"
                        aria-expanded="false"
                    >
                        ⋮
                    </button>

                    <div
                        class="sale-row-menu-dropdown"
                        data-sale-actions-menu="${echapperHTMLVente(
                            vente.idVente
                        )}"
                        hidden
                    >
                        <button
                            type="button"
                            data-view-sale="${echapperHTMLVente(
                                vente.idVente
                            )}"
                        >
                            <span aria-hidden="true">👁</span>
                            <span>Voir la vente</span>
                        </button>
${
                        !venteVerrouillee &&
                        normaliserTexteVente(
                            vente.statutRetour ||
                            ""
                        ) !== "retour-total"
                            ? `
                                <button
                                    type="button"
                                    data-return-sale="${echapperHTMLVente(
                                        vente.idVente
                                    )}"
                                >
                                    <span aria-hidden="true">↩️</span>
                                    <span>Enregistrer un retour</span>
                                </button>
                              `
                            : (
                                venteVerrouillee
                                    ? ""
                                    : `
                                        <button type="button" disabled>
                                            <span aria-hidden="true">↩️</span>
                                            <span>Retour complet</span>
                                        </button>
                                      `
                              )
                    }

                    ${
                        Array.isArray(vente.retours) && vente.retours.length
                            ? `
                                <button
                                    type="button"
                                    data-return-history-sale="${echapperHTMLVente(vente.idVente)}"
                                >
                                    <span aria-hidden="true">🕘</span>
                                    <span>Historique des retours</span>
                                </button>
                              `
                            : ""
                    }

                    ${
                        normaliserTexteVente(vente.statutPaiement) === "partiellement payee"
                            ? `
                                <button
                                    type="button"
                                    data-payment-sale="${echapperHTMLVente(vente.idVente)}"
                                >
                                    <span aria-hidden="true">💳</span>
                                    <span>Encaisser un paiement</span>
                                </button>
                              `
                            : ""
                    }

                        <button
                            type="button"
                            data-invoice-sale="${echapperHTMLVente(
                                vente.idVente
                            )}"
                        >
                            <span aria-hidden="true">🧾</span>
                            <span>Facture</span>
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    `;
}


function gererActionsTableauVentes(event) {
    const boutonMenu =
        event.target.closest(
            "[data-sale-actions-toggle]"
        );

    if (boutonMenu) {
        basculerMenuActionsLigneVente(
            boutonMenu
        );
        return;
    }

    fermerMenusActionsLigneVente();

    const boutonVoir =
        event.target.closest(
            "[data-view-sale]"
        );

    if (boutonVoir) {
        voirVente(
            boutonVoir.dataset.viewSale
        );
        return;
    }

    const boutonModifier =
        event.target.closest(
            "[data-edit-sale]"
        );

    if (boutonModifier) {
        ouvrirModificationVente(
            boutonModifier.dataset.editSale
        );
        return;
    }

    const boutonRetour =
        event.target.closest(
            "[data-return-sale]"
        );

    if (boutonRetour) {
        ouvrirModaleRetourVente(
            boutonRetour.dataset.returnSale
        );
        return;
    }

    const boutonHistoriqueRetour =
        event.target.closest(
            "[data-return-history-sale]"
        );

    if (boutonHistoriqueRetour) {
        ouvrirHistoriqueRetoursVente(
            boutonHistoriqueRetour.dataset.returnHistorySale
        );
        return;
    }

    const boutonPaiement =
        event.target.closest(
            "[data-payment-sale]"
        );

    if (boutonPaiement) {
        ouvrirModaleEncaissementPaiementVente(
            boutonPaiement.dataset.paymentSale
        );
        return;
    }

    const boutonFacture =
        event.target.closest(
            "[data-invoice-sale]"
        );

    if (boutonFacture) {
        ouvrirFactureDepuisVente(boutonFacture.dataset.invoiceSale);
        return;
    }

    const boutonSupprimer =
        event.target.closest(
            "[data-delete-sale]"
        );

    if (boutonSupprimer) {
        supprimerVenteFrontend(
            boutonSupprimer.dataset.deleteSale
        );
    }
}




let factureVenteSelectionnee = null;
let facturesVenteCache = null;
let promesseFacturesVente = null;

function initialiserFactureDepuisVente(){
  ["close-sale-invoice-modal","close-sale-invoice-footer-btn"].forEach(id=>document.getElementById(id)?.addEventListener("click",fermerFactureDepuisVente));
  document.getElementById("sale-invoice-modal")?.addEventListener("click",e=>{if(e.target.id==="sale-invoice-modal")fermerFactureDepuisVente();});
  document.getElementById("download-sale-invoice-btn")?.addEventListener("click",()=>factureVenteSelectionnee&&telechargerFactureDepuisVente(factureVenteSelectionnee));
  document.getElementById("print-sale-invoice-btn")?.addEventListener("click",()=>factureVenteSelectionnee&&imprimerFactureDepuisVente(factureVenteSelectionnee));

  /*
   * Préchargement discret des factures après l'ouverture de la page.
   * Le clic sur "Facture" n'a ainsi généralement plus besoin d'attendre
   * un aller-retour complet vers Google Apps Script.
   */
  setTimeout(()=>{
    chargerFacturesVenteCache().catch(()=>{});
  },300);
}

async function chargerFacturesVenteCache(force=false){
  if(!force && Array.isArray(facturesVenteCache)){
    return facturesVenteCache;
  }

  if(!force && promesseFacturesVente){
    return promesseFacturesVente;
  }

  if(typeof apiGet!=="function"){
    throw new Error("Service de facturation indisponible.");
  }

  promesseFacturesVente=(async()=>{
    const r=await apiGet("getFactures");

    if(!r?.success){
      throw new Error(r?.message||"Impossible de charger les factures.");
    }

    facturesVenteCache=
      Array.isArray(r.factures)
        ? r.factures
        : (Array.isArray(r.data)?r.data:[]);

    return facturesVenteCache;
  })();

  try{
    return await promesseFacturesVente;
  }finally{
    promesseFacturesVente=null;
  }
}

async function ouvrirFactureDepuisVente(idVente){
  const id=String(idVente||"").trim(), modal=document.getElementById("sale-invoice-modal"), loading=document.getElementById("sale-invoice-loading"), doc=document.getElementById("sale-invoice-document");
  if(!id||!modal)return;
  modal.classList.add("active"); modal.setAttribute("aria-hidden","false"); document.body.classList.add("modal-open");
  if(loading)loading.hidden=false;if(doc)doc.hidden=true;
  try{
    /*
     * On charge uniquement la source réellement nécessaire à l'affichage
     * de la facture. Les informations de règlement (paiement, avoir,
     * total réglé, reste) sont déjà présentes dans ventesChargees.
     */
    const list=await chargerFacturesVenteCache();

    const f=list.find(x=>String(x.idVente||"").trim()===id && normaliserTexteVente(x.typeFacture||"facture")!=="avoir");
    if(!f)throw new Error("Aucune facture n’est encore disponible pour cette vente.");

    const venteActuelle =
      ventesChargees.find(v=>String(v.idVente||"").trim()===id) || null;

    const avoir=convertirNombreVente(venteActuelle?.montantAvoirUtilise);
    const encaisse=convertirNombreVente(venteActuelle?.montantPaye ?? f.montantPaye);
    const totalRegle=convertirNombreVente(
      venteActuelle?.montantRegle ??
      (encaisse+avoir)
    );
    const reste=convertirNombreVente(
      venteActuelle?.resteAPayer ?? f.resteAPayer
    );

    factureVenteSelectionnee={
      ...f,
      montantPaye:encaisse,
      montantAvoirUtilise:avoir,
      montantRegle:totalRegle,
      resteAPayer:reste
    };
    afficherFactureDepuisVente(factureVenteSelectionnee);
  }catch(e){factureVenteSelectionnee=null;fermerFactureDepuisVente();afficherToastVente(e.message||"Impossible d’afficher la facture.","error");}
  finally{if(loading)loading.hidden=true;if(doc&&factureVenteSelectionnee)doc.hidden=false;}
}

function afficherFactureDepuisVente(f){
  texteFactureVente("sale-invoice-modal-subtitle",f.numeroFacture||f.idFacture||"");
  texteFactureVente("sale-invoice-number",f.numeroFacture||"—");
  texteFactureVente("sale-invoice-client",f.clientNom||f.idClient||"Client");
  texteFactureVente("sale-invoice-contact",[f.clientTelephone,f.clientEmail].filter(Boolean).join(" · ")||f.idClient||"—");
  texteFactureVente("sale-invoice-date",[f.dateEmission,f.heureEmission].filter(Boolean).join(" ")||"—");
  texteFactureVente("sale-invoice-sale",f.idVente||"—");
  const body=document.getElementById("sale-invoice-lines-body"),d=Array.isArray(f.details)?f.details:[];
  if(body)body.innerHTML=d.length?d.map(l=>`<tr><td>${echapperHTMLVente(l.designation||l.idProduit||"Article")}</td><td>${echapperHTMLVente(nombreFactureVente(l.quantite))}</td><td>${echapperHTMLVente(montantFactureVente(l.prixUnitaireTTC))}</td><td>${echapperHTMLVente(montantFactureVente(l.remise))}</td><td>${echapperHTMLVente(montantFactureVente(l.sousTotalTTC))}</td></tr>`).join(""):'<tr><td colspan="5" class="empty-table">Aucun détail produit.</td></tr>';
  const avoir=convertirNombreVente(f.montantAvoirUtilise);
  const regle=convertirNombreVente(f.montantRegle ?? (convertirNombreVente(f.montantPaye)+avoir));
  texteFactureVente("sale-invoice-status",f.statut||"—");
  texteFactureVente("sale-invoice-total",montantFactureVente(f.montantTTC));
  texteFactureVente("sale-invoice-paid",montantFactureVente(f.montantPaye));
  texteFactureVente("sale-invoice-credit",montantFactureVente(avoir));
  texteFactureVente("sale-invoice-settled",montantFactureVente(regle));
  texteFactureVente("sale-invoice-balance",montantFactureVente(f.resteAPayer));
  const ligneAvoir=document.getElementById("sale-invoice-credit-row");
  if(ligneAvoir){
    const afficherAvoir=avoir>0;
    ligneAvoir.hidden=!afficherAvoir;
    ligneAvoir.style.display=afficherAvoir?"":"none";
  }
  const c=String(f.commentaire||"").trim(),box=document.getElementById("sale-invoice-comment-box");if(box)box.hidden=!c;texteFactureVente("sale-invoice-comment",c);
}
function fermerFactureDepuisVente(){const m=document.getElementById("sale-invoice-modal");m?.classList.remove("active");m?.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");}
function telechargerFactureDepuisVente(f){
  try{
    const JSPDF=window.jspdf?.jsPDF;
    if(!JSPDF)throw new Error("Le générateur PDF n’est pas disponible.");
    const pdf=new JSPDF({unit:"mm",format:"a4"});
    const numero=String(f.numeroFacture||f.idFacture||"Facture");
    const client=String(f.clientNom||f.idClient||"Client");
    const contact=[f.clientTelephone,f.clientEmail].filter(Boolean).join(" · ");
    pdf.setFont("helvetica","bold");pdf.setFontSize(18);pdf.text("VISIBL",14,18);
    pdf.setFontSize(16);pdf.text("FACTURE",196,18,{align:"right"});
    pdf.setFontSize(11);pdf.text(numero,196,25,{align:"right"});
    pdf.setDrawColor(30);pdf.line(14,30,196,30);
    pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.text("CLIENT",14,40);pdf.text("INFORMATIONS",112,40);
    pdf.setFont("helvetica","normal");pdf.setFontSize(10);pdf.text(client,14,47);if(contact)pdf.text(contact,14,53,{maxWidth:85});
    pdf.text(`Date : ${[f.dateEmission,f.heureEmission].filter(Boolean).join(" ")||"—"}`,112,47);pdf.text(`Vente : ${f.idVente||"—"}`,112,53);
    const details=Array.isArray(f.details)?f.details:[];
    const body=details.map(l=>[String(l.designation||l.idProduit||"Article"),nombreFactureVente(l.quantite),montantFactureVente(l.prixUnitaireTTC),montantFactureVente(l.remise),montantFactureVente(l.sousTotalTTC)]);
    if(typeof pdf.autoTable==="function"){
      pdf.autoTable({startY:62,head:[["Produit","Qté","Prix unitaire TTC","Remise","Sous-total TTC"]],body:body.length?body:[["Aucun détail produit.","","","",""]],styles:{fontSize:8,cellPadding:2.5},headStyles:{fontStyle:"bold"},columnStyles:{1:{halign:"right"},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"}}});
    }
    const y=(pdf.lastAutoTable?.finalY||70)+10;
    const avoir=convertirNombreVente(f.montantAvoirUtilise);
    const regle=convertirNombreVente(f.montantRegle ?? (convertirNombreVente(f.montantPaye)+avoir));
    let yy=y;
    pdf.setFontSize(10);pdf.setFont("helvetica","normal");pdf.text("Montant TTC",120,yy);pdf.text(montantFactureVente(f.montantTTC),196,yy,{align:"right"});yy+=7;
    pdf.text("Paiement encaissé",120,yy);pdf.text(montantFactureVente(f.montantPaye),196,yy,{align:"right"});yy+=7;
    if(avoir>0){pdf.text("Avoir client utilisé",120,yy);pdf.text(montantFactureVente(avoir),196,yy,{align:"right"});yy+=7;}
    pdf.setFont("helvetica","bold");pdf.text("Total réglé",120,yy);pdf.text(montantFactureVente(regle),196,yy,{align:"right"});yy+=7;
    pdf.text("Reste à payer",120,yy);pdf.text(montantFactureVente(f.resteAPayer),196,yy,{align:"right"});
    pdf.setFont("helvetica","normal");pdf.text(`Statut : ${f.statut||"—"}`,14,yy);
    const safe=numero.replace(/[^a-zA-Z0-9_-]+/g,"-");
    pdf.save(`${safe||"facture"}.pdf`);
    afficherToastVente("Facture PDF téléchargée.","success");
  }catch(e){console.error(e);afficherToastVente(e.message||"Impossible de télécharger la facture.","error");}
}
function imprimerFactureDepuisVente(f){
 const d=Array.isArray(f.details)?f.details:[],rows=d.length?d.map(l=>`<tr><td>${echapperHTMLVente(l.designation||l.idProduit||"Article")}</td><td>${echapperHTMLVente(nombreFactureVente(l.quantite))}</td><td>${echapperHTMLVente(montantFactureVente(l.prixUnitaireTTC))}</td><td>${echapperHTMLVente(montantFactureVente(l.remise))}</td><td>${echapperHTMLVente(montantFactureVente(l.sousTotalTTC))}</td></tr>`).join(""):'<tr><td colspan="5">Aucun détail produit.</td></tr>';
 const w=window.open("","_blank","width=900,height=850");if(!w)return afficherToastVente("Autorisez les pop-ups pour imprimer ou enregistrer en PDF.","error");
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${echapperHTMLVente(f.numeroFacture||"Facture")}</title><style>body{font-family:Arial;color:#172033;padding:30px}.doc{max-width:850px;margin:auto}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:18px}.title{text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0}.box{padding:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px}table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:12px}th{background:#f8fafc;font-size:10px}th:not(:first-child),td:not(:first-child){text-align:right}.tot{margin:20px 0 0 auto;width:330px;max-width:100%}.tot div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #cbd5e1}@media(max-width:600px){body{padding:15px}.grid{grid-template-columns:1fr}}@media print{body{padding:0}}</style></head><body><div class="doc"><div class="head"><div><h2>VISIBL</h2><small>Document commercial</small></div><div class="title"><b>FACTURE</b><h3>${echapperHTMLVente(f.numeroFacture||"—")}</h3></div></div><div class="grid"><div class="box"><small>CLIENT</small><h3>${echapperHTMLVente(f.clientNom||f.idClient||"Client")}</h3><div>${echapperHTMLVente([f.clientTelephone,f.clientEmail].filter(Boolean).join(" · "))}</div></div><div class="box"><div><b>Date :</b> ${echapperHTMLVente([f.dateEmission,f.heureEmission].filter(Boolean).join(" "))}</div><div><b>Vente :</b> ${echapperHTMLVente(f.idVente||"—")}</div></div></div><table><thead><tr><th>Produit</th><th>Qté</th><th>Prix unitaire TTC</th><th>Remise</th><th>Sous-total TTC</th></tr></thead><tbody>${rows}</tbody></table><div class="tot"><div><span>Montant TTC</span><b>${echapperHTMLVente(montantFactureVente(f.montantTTC))}</b></div><div><span>Paiement encaissé</span><b>${echapperHTMLVente(montantFactureVente(f.montantPaye))}</b></div>${convertirNombreVente(f.montantAvoirUtilise)>0?`<div><span>Avoir client utilisé</span><b>${echapperHTMLVente(montantFactureVente(f.montantAvoirUtilise))}</b></div>`:""}<div><span>Total réglé</span><b>${echapperHTMLVente(montantFactureVente(f.montantRegle ?? (convertirNombreVente(f.montantPaye)+convertirNombreVente(f.montantAvoirUtilise))))}</b></div><div><span>Reste à payer</span><b>${echapperHTMLVente(montantFactureVente(f.resteAPayer))}</b></div><div><span>Statut</span><b>${echapperHTMLVente(f.statut||"—")}</b></div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);w.document.close();
}
function texteFactureVente(id,x){const e=document.getElementById(id);if(e)e.textContent=x==null?"":String(x)}
function nombreFactureVente(x){return convertirNombreVente(x).toLocaleString("fr-FR",{maximumFractionDigits:2})}
function montantFactureVente(x){return convertirNombreVente(x).toLocaleString("fr-FR",{maximumFractionDigits:0})+" FCFA"}

/* ===========================================================
   RETOUR D'UNE VENTE — ÉTAPE 3
   Sélection + quantité + motif + enregistrement
   Aucun mouvement de stock / aucun remboursement à ce stade.
=========================================================== */

function initialiserModaleRetourVente() {
    ["close-return-sale-modal", "cancel-return-sale-btn"].forEach(id => {
        document
            .getElementById(id)
            ?.addEventListener("click", fermerModaleRetourVente);
    });

    document
        .getElementById("return-sale-modal")
        ?.addEventListener("click", event => {
            if (event.target.id === "return-sale-modal") {
                fermerModaleRetourVente();
            }
        });

    document
        .getElementById("return-sale-lines-body")
        ?.addEventListener("change", gererChangementLigneRetourVente);

    document
        .getElementById("return-sale-lines-body")
        ?.addEventListener("input", gererChangementLigneRetourVente);

    document
        .getElementById("return-sale-reason")
        ?.addEventListener("input", validerFormulaireRetourVente);

    document
        .getElementById("return-sale-resolution")
        ?.addEventListener("change", () => {
            mettreAJourResolutionRetourVente();
            validerFormulaireRetourVente();
        });

    [
        "return-refund-amount",
        "return-refund-method",
        "return-exchange-product",
        "return-exchange-quantity",
        "return-exchange-negative-treatment",
        "return-no-compensation-reason"
    ].forEach(id => {
        const champ = document.getElementById(id);
        champ?.addEventListener("input", () => {
            mettreAJourCalculsResolutionRetourVente();
            validerFormulaireRetourVente();
        });
        champ?.addEventListener("change", () => {
            mettreAJourCalculsResolutionRetourVente();
            validerFormulaireRetourVente();
        });
    });

    document
        .getElementById("continue-return-sale-btn")
        ?.addEventListener("click", enregistrerRetourVente);
}


function ouvrirModaleRetourVente(idVente) {
    const vente =
        ventesChargees.find(
            element =>
                String(element.idVente) ===
                String(idVente)
        );

    if (!vente) {
        afficherToastVente(
            "Vente introuvable.",
            "error"
        );
        return;
    }

    if (
        normaliserTexteVente(
            vente.statutRetour ||
            ""
        ) === "retour-total"
    ) {
        afficherToastVente(
            "Tous les produits de cette vente ont déjà été retournés.",
            "info"
        );
        return;
    }

    const modal =
        document.getElementById(
            "return-sale-modal"
        );

    if (!modal) {
        return;
    }

    definirValeurVente(
        "return-sale-id",
        vente.idVente
    );

    definirValeurVente("return-sale-reason", "");
    definirValeurVente("return-sale-resolution", "");
    definirValeurVente("return-refund-amount", "");
    definirValeurVente("return-refund-method", "");
    definirValeurVente("return-exchange-product", "");
    definirValeurVente("return-exchange-quantity", "1");
    definirValeurVente("return-exchange-negative-treatment", "");
    definirValeurVente("return-exchange-refund-method", "");
    definirValeurVente("return-no-compensation-reason", "");
    remplirProduitsEchangeRetourVente();
    mettreAJourResolutionRetourVente();

    const numero =
        vente.numeroVente ||
        vente.idVente ||
        "Vente";

    definirTexteVente(
        "return-sale-modal-title",
        `Retour — ${numero}`
    );

    definirTexteVente(
        "return-sale-modal-subtitle",
        "Sélectionnez les produits concernés par le retour."
    );

    const lignes =
        Array.isArray(vente.lignes)
            ? vente.lignes
            : Array.isArray(vente.detailsVente)
                ? vente.detailsVente
                : Array.isArray(vente.details)
                    ? vente.details
                    : [];

    const dejaRetournees =
        vente.quantitesRetournees &&
        typeof vente.quantitesRetournees === "object"
            ? vente.quantitesRetournees
            : {};

    const tbody =
        document.getElementById(
            "return-sale-lines-body"
        );

    if (tbody) {
        const lignesDisponibles =
            lignes.filter(ligne => {
                const vendue =
                    Math.max(
                        0,
                        Math.trunc(
                            convertirNombreVente(
                                ligne.quantite ??
                                ligne.quantiteVendue
                            )
                        )
                    );

                const deja =
                    Math.max(
                        0,
                        Math.trunc(
                            convertirNombreVente(
                                dejaRetournees[
                                    String(ligne.idProduit || "").trim()
                                ] || 0
                            )
                        )
                    );

                return vendue - deja > 0;
            });

        if (!lignesDisponibles.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-table">
                        Aucun produit ne peut encore être retourné pour cette vente.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML =
                lignesDisponibles
                    .map(ligne => {
                        const idProduit =
                            String(
                                ligne.idProduit ||
                                ""
                            ).trim();

                        const designation =
                            obtenirNomProduitVenteParId(
                                idProduit
                            ) ||
                            ligne.designation ||
                            idProduit ||
                            "Produit";

                        const quantiteVendue =
                            Math.max(
                                0,
                                Math.trunc(
                                    convertirNombreVente(
                                        ligne.quantite ??
                                        ligne.quantiteVendue
                                    )
                                )
                            );

                        const quantiteDejaRetournee =
                            Math.max(
                                0,
                                Math.trunc(
                                    convertirNombreVente(
                                        dejaRetournees[idProduit] ||
                                        0
                                    )
                                )
                            );

                        const quantiteDisponible =
                            Math.max(
                                0,
                                quantiteVendue -
                                quantiteDejaRetournee
                            );

                        const prix =
                            convertirNombreVente(
                                ligne.prixUnitaire ??
                                ligne.prixVenteUnitaire
                            );

                        const sousTotal =
                            convertirNombreVente(
                                ligne.sousTotal
                            );

                        const valeurUnitaireNette =
                            quantiteVendue > 0
                                ? (
                                    sousTotal > 0
                                        ? sousTotal / quantiteVendue
                                        : Math.max(
                                            0,
                                            prix -
                                            (
                                                convertirNombreVente(ligne.remise) /
                                                quantiteVendue
                                            )
                                        )
                                  )
                                : prix;

                        return `
                            <tr
                                data-return-product-row="${echapperHTMLVente(idProduit)}"
                                data-return-unit-net="${valeurUnitaireNette}"
                            >
                                <td>
                                    <input
                                        type="checkbox"
                                        data-return-product-check="${echapperHTMLVente(idProduit)}"
                                        aria-label="Retourner ${echapperHTMLVente(designation)}"
                                    >
                                </td>
                                <td>
                                    <strong>${echapperHTMLVente(designation)}</strong>
                                </td>
                                <td>${quantiteVendue}</td>
                                <td>${quantiteDejaRetournee}</td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max="${quantiteDisponible}"
                                        value="1"
                                        data-return-product-quantity="${echapperHTMLVente(idProduit)}"
                                        disabled
                                        style="max-width:110px;"
                                    >
                                    <small class="form-help">
                                        Max. ${quantiteDisponible}
                                    </small>
                                </td>
                                <td>
                                    <select
                                        class="return-state-select"
                                        data-return-product-state="${echapperHTMLVente(idProduit)}"
                                        disabled
                                    >
                                        <option value="">Sélectionner</option>
                                        <option value="revendable">Revendable</option>
                                        <option value="non-revendable">Non revendable</option>
                                        <option value="a-controler">À contrôler</option>
                                    </select>
                                </td>
                                <td>${formaterFCFAVente(prix)}</td>
                            </tr>
                        `;
                    })
                    .join("");
        }
    }

    afficherMessageRetourVente(
        "Sélectionnez au moins un produit, indiquez la quantité et renseignez le motif.",
        "info"
    );

    validerFormulaireRetourVente();

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}


function gererChangementLigneRetourVente(event) {
    const checkbox =
        event.target.closest(
            "[data-return-product-check]"
        );

    if (checkbox) {
        const idProduit =
            checkbox.dataset.returnProductCheck;

        const quantite =
            document.querySelector(
                `[data-return-product-quantity="${CSS.escape(idProduit)}"]`
            );

        const etat =
            document.querySelector(
                `[data-return-product-state="${CSS.escape(idProduit)}"]`
            );

        if (quantite) {
            quantite.disabled = !checkbox.checked;
        }

        if (etat) {
            etat.disabled = !checkbox.checked;
            if (!checkbox.checked) {
                etat.value = "";
            }
        }

        if (checkbox.checked) {
            quantite?.focus();
        }
    }

    mettreAJourCalculsResolutionRetourVente();
    validerFormulaireRetourVente();
}


function obtenirLignesRetourVenteSelectionnees() {
    return Array
        .from(
            document.querySelectorAll(
                "[data-return-product-check]:checked"
            )
        )
        .map(checkbox => {
            const idProduit =
                String(
                    checkbox.dataset.returnProductCheck ||
                    ""
                ).trim();

            const champQuantite =
                document.querySelector(
                    `[data-return-product-quantity="${CSS.escape(idProduit)}"]`
                );

            const quantite =
                Math.max(
                    0,
                    Math.trunc(
                        convertirNombreVente(
                            champQuantite?.value
                        )
                    )
                );

            const maximum =
                Math.max(
                    0,
                    Math.trunc(
                        convertirNombreVente(
                            champQuantite?.max
                        )
                    )
                );

            const champEtat =
                document.querySelector(
                    `[data-return-product-state="${CSS.escape(idProduit)}"]`
                );

            const ligneTable =
                checkbox.closest(
                    "[data-return-product-row]"
                );

            const valeurUnitaireNette =
                convertirNombreVente(
                    ligneTable?.dataset.returnUnitNet
                );

            return {
                idProduit,
                quantite,
                maximum,
                etatProduit:
                    String(champEtat?.value || "").trim(),
                valeurUnitaireNette
            };
        });
}


function remplirProduitsEchangeRetourVente() {
    const select =
        document.getElementById(
            "return-exchange-product"
        );

    if (!select) {
        return;
    }

    const valeurActuelle =
        select.value;

    select.innerHTML =
        '<option value="">Sélectionner un produit</option>';

    catalogueProduitsVente
        .slice()
        .sort(
            (a, b) =>
                obtenirNomProduitVente(a)
                    .localeCompare(
                        obtenirNomProduitVente(b),
                        "fr",
                        { sensitivity: "base" }
                    )
        )
        .forEach(produit => {
            const id =
                obtenirIdProduitVente(produit);

            if (!id) {
                return;
            }

            const option =
                document.createElement("option");

            option.value = id;
            option.textContent =
                obtenirNomProduitVente(produit) ||
                id;

            select.appendChild(option);
        });

    if (
        valeurActuelle &&
        Array.from(select.options)
            .some(option => option.value === valeurActuelle)
    ) {
        select.value = valeurActuelle;
    }
}


function obtenirResumeFinancierRetourVente() {
    const idVente =
        obtenirValeurVente(
            "return-sale-id"
        );

    const vente =
        ventesChargees.find(
            element =>
                String(element.idVente) ===
                String(idVente)
        ) ||
        {};

    const lignes =
        obtenirLignesRetourVenteSelectionnees();

    const valeurRetour =
        lignes.reduce(
            (total, ligne) =>
                total +
                (
                    convertirNombreVente(
                        ligne.valeurUnitaireNette
                    ) *
                    convertirNombreVente(
                        ligne.quantite
                    )
                ),
            0
        );

    const reductionDejaAppliquee =
        Math.max(
            0,
            convertirNombreVente(
                vente.reductionCreanceRetours
            )
        );

    const resteInitial =
        Math.max(
            0,
            convertirNombreVente(
                vente.resteAPayer
            )
        );

    const resteEncoreReducible =
        Math.max(
            0,
            resteInitial -
            reductionDejaAppliquee
        );

    const reductionCreance =
        Math.min(
            resteEncoreReducible,
            valeurRetour
        );

    const compensationDisponible =
        Math.max(
            0,
            valeurRetour -
            reductionCreance
        );

    return {
        valeurRetour,
        reductionCreance,
        compensationDisponible
    };
}


function mettreAJourResolutionRetourVente() {
    const resolution =
        obtenirValeurVente(
            "return-sale-resolution"
        );

    const correspondance = {
        remboursement: "return-resolution-refund",
        avoir: "return-resolution-credit",
        echange: "return-resolution-exchange",
        "aucune-compensation": "return-resolution-none"
    };

    Object.values(correspondance)
        .forEach(id => {
            const bloc =
                document.getElementById(id);

            if (bloc) {
                bloc.hidden =
                    correspondance[resolution] !== id;
            }
        });

    remplirProduitsEchangeRetourVente();
    mettreAJourCalculsResolutionRetourVente();
}


function mettreAJourCalculsResolutionRetourVente() {
    const resume =
        obtenirResumeFinancierRetourVente();

    definirTexteVente(
        "return-sale-value",
        formaterFCFAVente(
            resume.valeurRetour
        )
    );

    definirTexteVente(
        "return-sale-debt-reduction",
        formaterFCFAVente(
            resume.reductionCreance
        )
    );

    definirTexteVente(
        "return-sale-compensation-available",
        formaterFCFAVente(
            resume.compensationDisponible
        )
    );

    definirTexteVente(
        "return-credit-amount",
        formaterFCFAVente(
            resume.compensationDisponible
        )
    );

    const resolution =
        obtenirValeurVente(
            "return-sale-resolution"
        );

    const champRemboursement =
        document.getElementById(
            "return-refund-amount"
        );

    if (
        champRemboursement &&
        resolution === "remboursement"
    ) {
        champRemboursement.max =
            String(
                Math.round(
                    resume.compensationDisponible
                )
            );

        if (
            !champRemboursement.dataset.touched ||
            convertirNombreVente(
                champRemboursement.value
            ) >
            resume.compensationDisponible
        ) {
            champRemboursement.value =
                String(
                    Math.round(
                        resume.compensationDisponible
                    )
                );
        }

        champRemboursement.oninput = () => {
            champRemboursement.dataset.touched = "true";
        };
    }

    const idProduitEchange =
        obtenirValeurVente(
            "return-exchange-product"
        );

    const quantiteEchange =
        Math.max(
            0,
            Math.trunc(
                convertirNombreVente(
                    obtenirValeurVente(
                        "return-exchange-quantity"
                    )
                )
            )
        );

    const produitEchange =
        obtenirProduitVenteParId(
            idProduitEchange
        );

    const prixEchange =
        produitEchange
            ? obtenirPrixVenteProduit(
                produitEchange
            )
            : 0;

    const montantEchange =
        Math.max(
            0,
            prixEchange *
            quantiteEchange
        );

    const difference =
        montantEchange -
        resume.compensationDisponible;

    definirTexteVente(
        "return-exchange-value",
        formaterFCFAVente(
            montantEchange
        )
    );

    const zoneDifference =
        document.getElementById(
            "return-exchange-difference"
        );

    if (zoneDifference) {
        zoneDifference.textContent =
            formaterFCFAVente(
                Math.abs(difference)
            );

        zoneDifference.classList.toggle(
            "is-positive",
            difference > 0
        );

        zoneDifference.classList.toggle(
            "is-negative",
            difference < 0
        );
    }

    const aide =
        document.getElementById(
            "return-exchange-difference-help"
        );

    if (aide) {
        aide.textContent =
            difference > 0
                ? `Le client devra compléter ${formaterFCFAVente(difference)}.`
                : difference < 0
                    ? `VISIBL devra traiter ${formaterFCFAVente(Math.abs(difference))} en remboursement ou en avoir.`
                    : "Aucune différence.";
    }

    const blocTraitement =
        document.getElementById(
            "return-exchange-negative-treatment-wrap"
        );

    if (blocTraitement) {
        blocTraitement.hidden =
            !(resolution === "echange" && difference < 0);
    }

    /*
     * Si la différence d'échange doit être remboursée, on demande aussi
     * le mode de remboursement sans modifier le HTML existant.
     */
    const traitementDifference =
        obtenirValeurVente(
            "return-exchange-negative-treatment"
        );

    let blocModeEchange =
        document.getElementById(
            "return-exchange-refund-method-wrap"
        );

    if (
        blocTraitement &&
        !blocModeEchange
    ) {
        blocModeEchange =
            document.createElement(
                "div"
            );

        blocModeEchange.id =
            "return-exchange-refund-method-wrap";

        blocModeEchange.className =
            "form-group";

        blocModeEchange.innerHTML =
            '<label for="return-exchange-refund-method">Mode de remboursement *</label>' +
            '<select id="return-exchange-refund-method">' +
            '<option value="">Sélectionner</option>' +
            '<option value="especes">Espèces</option>' +
            '<option value="wave">Wave</option>' +
            '<option value="orange-money">Orange Money</option>' +
            '<option value="mtn-money">MTN Money</option>' +
            '<option value="moov-money">Moov Money</option>' +
            '<option value="virement">Virement</option>' +
            '<option value="carte">Carte</option>' +
            '<option value="autre">Autre</option>' +
            '</select>';

        blocTraitement.appendChild(
            blocModeEchange
        );

        blocModeEchange
            .querySelector(
                "#return-exchange-refund-method"
            )
            ?.addEventListener(
                "change",
                validerFormulaireRetourVente
            );
    }

    if (blocModeEchange) {
        blocModeEchange.hidden =
            !(
                resolution === "echange" &&
                difference < 0 &&
                traitementDifference ===
                    "remboursement"
            );
    }
}


function validerFormulaireRetourVente() {
    const bouton =
        document.getElementById(
            "continue-return-sale-btn"
        );

    if (!bouton) {
        return false;
    }

    const lignes =
        obtenirLignesRetourVenteSelectionnees();

    const motif =
        obtenirValeurVente(
            "return-sale-reason"
        );

    const resolution =
        obtenirValeurVente(
            "return-sale-resolution"
        );

    const quantitesEtEtatsValides =
        lignes.length > 0 &&
        lignes.every(
            ligne =>
                ligne.idProduit &&
                ligne.quantite >= 1 &&
                ligne.quantite <= ligne.maximum &&
                [
                    "revendable",
                    "non-revendable",
                    "a-controler"
                ].includes(
                    ligne.etatProduit
                )
        );

    let resolutionValide =
        Boolean(resolution);

    const resume =
        obtenirResumeFinancierRetourVente();

    if (
        resolution === "remboursement" &&
        resume.compensationDisponible > 0
    ) {
        const montant =
            Math.max(
                0,
                convertirNombreVente(
                    obtenirValeurVente(
                        "return-refund-amount"
                    )
                )
            );

        resolutionValide =
            montant <= resume.compensationDisponible &&
            Boolean(
                obtenirValeurVente(
                    "return-refund-method"
                )
            );
    }

    if (resolution === "echange") {
        const produit =
            obtenirValeurVente(
                "return-exchange-product"
            );

        const quantite =
            Math.max(
                0,
                Math.trunc(
                    convertirNombreVente(
                        obtenirValeurVente(
                            "return-exchange-quantity"
                        )
                    )
                )
            );

        const produitObjet =
            obtenirProduitVenteParId(
                produit
            );

        const montantEchange =
            produitObjet
                ? obtenirPrixVenteProduit(
                    produitObjet
                ) * quantite
                : 0;

        const difference =
            montantEchange -
            resume.compensationDisponible;

        const traitementDifference =
            obtenirValeurVente(
                "return-exchange-negative-treatment"
            );

        resolutionValide =
            Boolean(produit) &&
            quantite >= 1 &&
            (
                difference >= 0 ||
                Boolean(
                    traitementDifference
                )
            ) &&
            (
                !(
                    difference < 0 &&
                    traitementDifference ===
                        "remboursement"
                ) ||
                Boolean(
                    obtenirValeurVente(
                        "return-exchange-refund-method"
                    )
                )
            );
    }

    if (
        resolution ===
        "aucune-compensation"
    ) {
        resolutionValide =
            Boolean(
                obtenirValeurVente(
                    "return-no-compensation-reason"
                )
            );
    }

    const valide =
        quantitesEtEtatsValides &&
        Boolean(motif) &&
        resolutionValide;

    bouton.disabled =
        !valide;

    return valide;
}

async function enregistrerRetourVente() {
    if (!validerFormulaireRetourVente()) {
        afficherMessageRetourVente(
            "Sélectionnez au moins un produit avec une quantité valide et renseignez le motif.",
            "error"
        );
        return;
    }

    const idVente =
        obtenirValeurVente(
            "return-sale-id"
        );

    const motif =
        obtenirValeurVente(
            "return-sale-reason"
        );

    const lignesSelectionnees =
        obtenirLignesRetourVenteSelectionnees();

    const lignes =
        lignesSelectionnees
            .map(ligne => ({
                idProduit:
                    ligne.idProduit,
                quantiteRetournee:
                    ligne.quantite,
                etatProduit:
                    ligne.etatProduit
            }));

    const resolution =
        obtenirValeurVente(
            "return-sale-resolution"
        );

    const resumeFinancier =
        obtenirResumeFinancierRetourVente();

    const idProduitEchange =
        obtenirValeurVente(
            "return-exchange-product"
        );

    const quantiteEchange =
        Math.max(
            0,
            Math.trunc(
                convertirNombreVente(
                    obtenirValeurVente(
                        "return-exchange-quantity"
                    )
                )
            )
        );

    const produitEchange =
        obtenirProduitVenteParId(
            idProduitEchange
        );

    const prixUnitaireEchange =
        produitEchange
            ? obtenirPrixVenteProduit(
                produitEchange
            )
            : 0;

    const utilisateur =
        typeof getCurrentUser === "function"
            ? getCurrentUser()
            : null;

    const bouton =
        document.getElementById(
            "continue-return-sale-btn"
        );

    try {
        definirBoutonChargementVente(
            bouton,
            true,
            "Enregistrement..."
        );

        afficherMessageRetourVente(
            "Enregistrement du retour...",
            "info"
        );

        const resultat =
            await apiPost(
                "createRetourVente",
                {
                    idVente,
                    motif,
                    resolution,
                    montantRemboursement:
                        convertirNombreVente(
                            obtenirValeurVente(
                                "return-refund-amount"
                            )
                        ),
                    modeRemboursement:
                        resolution === "echange"
                            ? obtenirValeurVente(
                                "return-exchange-refund-method"
                              )
                            : obtenirValeurVente(
                                "return-refund-method"
                              ),
                    idProduitEchange,
                    quantiteEchange,
                    prixUnitaireEchange,
                    traitementDifference:
                        obtenirValeurVente(
                            "return-exchange-negative-treatment"
                        ),
                    justification:
                        obtenirValeurVente(
                            "return-no-compensation-reason"
                        ),
                    valeurRetourEstimee:
                        resumeFinancier.valeurRetour,
                    idUtilisateur:
                        String(
                            utilisateur?.idUtilisateur ||
                            utilisateur?.["ID Utilisateur"] ||
                            utilisateur?.id ||
                            ""
                        ).trim(),
                    lignes
                }
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le retour."
            );
        }

        fermerModaleRetourVente();

        afficherToastVente(
            resultat.message ||
            "Retour enregistré avec succès.",
            "success"
        );

        await chargerVentes({
            silencieux: true,
            conserverPage: true
        });

    } catch (error) {
        console.error(
            "Erreur enregistrement retour vente :",
            error
        );

        afficherMessageRetourVente(
            error.message ||
            "Impossible d'enregistrer le retour.",
            "error"
        );

    } finally {
        definirBoutonChargementVente(
            bouton,
            false,
            "Enregistrer le retour"
        );

        validerFormulaireRetourVente();
    }
}


function afficherMessageRetourVente(
    message,
    type = "info"
) {
    const zone =
        document.getElementById(
            "return-sale-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent =
        message || "";

    zone.className =
        "form-message " + type;

    zone.style.display =
        message ? "block" : "none";
}


function fermerModaleRetourVente() {
    const modal =
        document.getElementById(
            "return-sale-modal"
        );

    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");

    definirValeurVente(
        "return-sale-id",
        ""
    );

    definirValeurVente(
        "return-sale-reason",
        ""
    );

    const tbody =
        document.getElementById(
            "return-sale-lines-body"
        );

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table">
                    Aucun produit.
                </td>
            </tr>
        `;
    }

    if (
        !document.querySelector(
            ".modal-overlay.active"
        )
    ) {
        document.body.classList.remove(
            "modal-open"
        );
    }
}



let venteHistoriqueRetourId = null;

function initialiserHistoriqueRetoursVente() {
    ["close-return-history-modal", "close-return-history-footer"]
        .forEach(id => {
            document.getElementById(id)
                ?.addEventListener("click", fermerHistoriqueRetoursVente);
        });

    document.getElementById("return-history-modal")
        ?.addEventListener("click", event => {
            if (event.target.id === "return-history-modal") {
                fermerHistoriqueRetoursVente();
            }
        });

    document.getElementById("return-history-list")
        ?.addEventListener("click", event => {
            const bouton = event.target.closest("[data-cancel-return-id]");
            if (!bouton) return;
            ouvrirAnnulationRetourVente(
                bouton.dataset.cancelReturnSale,
                bouton.dataset.cancelReturnId
            );
        });

    ["close-cancel-return-modal", "cancel-return-back-btn"]
        .forEach(id => {
            document.getElementById(id)
                ?.addEventListener("click", fermerAnnulationRetourVente);
        });

    document.getElementById("cancel-return-modal")
        ?.addEventListener("click", event => {
            if (event.target.id === "cancel-return-modal") {
                fermerAnnulationRetourVente();
            }
        });

    document.getElementById("cancel-return-reason")
        ?.addEventListener("input", validerAnnulationRetourVente);

    document.getElementById("confirm-cancel-return-btn")
        ?.addEventListener("click", confirmerAnnulationRetourVente);
}

function ouvrirHistoriqueRetoursVente(idVente) {
    const vente = ventesChargees.find(v => String(v.idVente) === String(idVente));
    if (!vente) {
        afficherToastVente("Vente introuvable.", "error");
        return;
    }
    venteHistoriqueRetourId = vente.idVente;
    definirTexteVente("return-history-modal-title", `Historique des retours — ${vente.numeroVente || vente.idVente}`);
    afficherHistoriqueRetoursVente(vente);
    const modal = document.getElementById("return-history-modal");
    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function afficherHistoriqueRetoursVente(vente) {
    const zone = document.getElementById("return-history-list");
    if (!zone) return;
    const retours = Array.isArray(vente.retours) ? vente.retours : [];
    if (!retours.length) {
        zone.innerHTML = '<div class="empty-table">Aucun retour enregistré.</div>';
        return;
    }
    zone.innerHTML = retours
        .slice()
        .reverse()
        .map(retour => {
            const annule = normaliserTexteVente(retour.etatEnregistrement || "actif") === "annule";
            const produits = Array.isArray(retour.lignes) ? retour.lignes : [];
            const produitsHtml = produits.length
                ? produits.map(ligne => {
                    const controle = ligne.resultatControle
                        ? ` → Contrôle : ${echapperHTMLVente(formaterLibelleVente(ligne.resultatControle))}`
                        : "";
                    return `<li>${echapperHTMLVente(obtenirNomProduitVenteParId(ligne.idProduit) || ligne.idProduit || "Produit")} — Qté ${convertirNombreVente(ligne.quantiteRetournee)} — ${echapperHTMLVente(formaterLibelleVente(ligne.etatProduit || ""))}${controle}</li>`;
                }).join("")
                : '<li>Aucun détail produit.</li>';
            const controleEnAttente =
                !annule &&
                produits.some(ligne =>
                    normaliserTexteVente(ligne.etatProduit || "") === "a-controler" &&
                    !String(ligne.resultatControle || "").trim()
                );
            return `
                <article class="return-history-card ${annule ? "is-cancelled" : ""}">
                    <div class="return-history-card-head">
                        <div class="return-history-card-title">
                            <strong>${echapperHTMLVente(retour.idRetour || "Retour")}</strong>
                            <small>${echapperHTMLVente([retour.dateRetour, retour.heureRetour].filter(Boolean).join(" • "))}</small>
                        </div>
                        <div class="return-history-badges">
                            <span class="return-history-badge">${echapperHTMLVente(formaterLibelleVente(retour.resolution || "—"))}</span>
                            <span class="return-history-badge ${annule ? "cancelled" : ""}">${annule ? "Annulé" : "Actif"}</span>
                        </div>
                    </div>
                    <div class="return-history-grid">
                        <div class="return-history-info"><span>Motif du retour</span><strong>${echapperHTMLVente(retour.motif || "—")}</strong></div>
                        <div class="return-history-info"><span>Compensation</span><strong>${formaterFCFAVente(retour.montantCompensation || 0)}</strong></div>
                        <div class="return-history-info"><span>Statut compensation</span><strong>${echapperHTMLVente(formaterLibelleVente(retour.statutCompensation || "—"))}</strong></div>
                    </div>
                    <ul class="return-history-products">${produitsHtml}</ul>
                    ${retour.resultatControle ? `
                        <div class="return-history-info">
                            <span>Contrôle</span>
                            <strong>${echapperHTMLVente(formaterLibelleVente(retour.resultatControle))}${retour.dateControle ? ` • ${echapperHTMLVente(retour.dateControle)}${retour.heureControle ? ` à ${echapperHTMLVente(retour.heureControle)}` : ""}` : ""}</strong>
                            ${retour.observationControle ? `<small>Observation : ${echapperHTMLVente(retour.observationControle)}</small>` : ""}
                        </div>
                    ` : ""}
                    ${annule ? `
                        <div class="return-history-info">
                            <span>Annulation</span>
                            <strong>${echapperHTMLVente(retour.motifAnnulation || "—")} ${retour.dateAnnulation ? `• ${echapperHTMLVente(retour.dateAnnulation)}${retour.heureAnnulation ? ` à ${echapperHTMLVente(retour.heureAnnulation)}` : ""}` : ""}</strong>
                        </div>
                    ` : `
                        <div class="return-history-actions">
                            ${controleEnAttente ? `<button type="button" class="btn-secondary return-control-btn" data-control-return-sale="${echapperHTMLVente(vente.idVente)}" data-control-return-id="${echapperHTMLVente(retour.idRetour)}">Effectuer le contrôle</button>` : ""}
                            <button type="button" class="btn-secondary return-cancel-btn" data-cancel-return-sale="${echapperHTMLVente(vente.idVente)}" data-cancel-return-id="${echapperHTMLVente(retour.idRetour)}">Annuler le retour</button>
                        </div>
                    `}
                </article>`;
        }).join("");

    zone
        .querySelectorAll(
            "[data-control-return-sale]"
        )
        .forEach(bouton => {
            bouton.addEventListener(
                "click",
                () => {
                    effectuerControleRetourVente(
                        bouton.dataset.controlReturnSale,
                        bouton.dataset.controlReturnId
                    );
                }
            );
        });

    zone
        .querySelectorAll(
            "[data-cancel-return-sale]"
        )
        .forEach(bouton => {
            bouton.addEventListener(
                "click",
                () => {
                    ouvrirAnnulationRetourVente(
                        bouton.dataset.cancelReturnSale,
                        bouton.dataset.cancelReturnId
                    );
                }
            );
        });
}

function fermerHistoriqueRetoursVente() {
    const modal = document.getElementById("return-history-modal");
    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");
    venteHistoriqueRetourId = null;
    if (!document.querySelector(".modal-overlay.active")) document.body.classList.remove("modal-open");
}

async function effectuerControleRetourVente(idVente, idRetour) {
    const choix = window.prompt(
        "Résultat du contrôle : saisissez Revendable ou Non revendable."
    );

    if (choix === null) return;

    const resultatControle =
        normaliserTexteVente(choix);

    if (
        resultatControle !== "revendable" &&
        resultatControle !== "non revendable"
    ) {
        afficherToastVente(
            "Le résultat doit être « Revendable » ou « Non revendable ».",
            "error"
        );
        return;
    }

    const observation = window.prompt(
        "Observation du contrôle (facultatif) :"
    );

    if (observation === null) return;

    const utilisateur =
        typeof getCurrentUser === "function"
            ? getCurrentUser()
            : null;

    try {
        const resultat = await apiPost(
            "createRetourVente",
            {
                operation: "controler",
                idVente,
                idRetour,
                resultatControle,
                observationControle:
                    String(observation || "").trim(),
                idUtilisateur:
                    String(
                        utilisateur?.idUtilisateur ||
                        utilisateur?.["ID Utilisateur"] ||
                        utilisateur?.id ||
                        ""
                    ).trim()
            }
        );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le contrôle."
            );
        }

        afficherToastVente(
            resultat.message ||
            "Contrôle enregistré.",
            "success"
        );

        await chargerVentes({
            silencieux: true,
            conserverPage: true
        });

        const vente =
            ventesChargees.find(
                v =>
                    String(v.idVente) ===
                    String(idVente)
            );

        if (vente) {
            afficherHistoriqueRetoursVente(vente);
        }

    } catch (error) {
        afficherToastVente(
            error.message ||
            "Impossible d'enregistrer le contrôle.",
            "error"
        );
    }
}


function ouvrirAnnulationRetourVente(idVente, idRetour) {
    definirValeurVente("cancel-return-sale-id", idVente);
    definirValeurVente("cancel-return-id", idRetour);
    definirValeurVente("cancel-return-reason", "");
    definirTexteVente("cancel-return-number", idRetour || "—");
    const msg = document.getElementById("cancel-return-message");
    if (msg) { msg.textContent = ""; msg.className = "form-message"; }
    validerAnnulationRetourVente();
    const modal = document.getElementById("cancel-return-modal");
    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function fermerAnnulationRetourVente() {
    const modal = document.getElementById("cancel-return-modal");
    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal-overlay.active")) document.body.classList.remove("modal-open");
}

function validerAnnulationRetourVente() {
    const motif = obtenirValeurVente("cancel-return-reason");
    const bouton = document.getElementById("confirm-cancel-return-btn");
    if (bouton) bouton.disabled = !motif;
    return Boolean(motif);
}

async function confirmerAnnulationRetourVente() {
    if (!validerAnnulationRetourVente()) return;
    const idVente = obtenirValeurVente("cancel-return-sale-id");
    const idRetour = obtenirValeurVente("cancel-return-id");
    const motifAnnulation = obtenirValeurVente("cancel-return-reason");
    const utilisateur = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    const bouton = document.getElementById("confirm-cancel-return-btn");
    try {
        definirBoutonChargementVente(bouton, true, "Annulation...");
        const resultat = await apiPost("createRetourVente", {
            operation: "annuler",
            idVente,
            idRetour,
            motifAnnulation,
            idUtilisateur: String(utilisateur?.idUtilisateur || utilisateur?.["ID Utilisateur"] || utilisateur?.id || "").trim()
        });
        if (!resultat?.success) throw new Error(resultat?.message || "Impossible d'annuler le retour.");
        fermerAnnulationRetourVente();
        afficherToastVente(resultat.message || "Retour annulé avec succès.", "success");
        await chargerVentes({ silencieux: true, conserverPage: true });
        const vente = ventesChargees.find(v => String(v.idVente) === String(idVente));
        if (vente) afficherHistoriqueRetoursVente(vente);
    } catch (error) {
        const zone = document.getElementById("cancel-return-message");
        if (zone) { zone.textContent = error.message || "Impossible d'annuler le retour."; zone.className = "form-message error"; }
    } finally {
        definirBoutonChargementVente(bouton, false, "Annuler le retour");
        validerAnnulationRetourVente();
    }
}

function formaterLibelleRetourVente(
    statut
) {
    const valeur =
        normaliserTexteVente(
            statut
        );

    if (
        valeur === "retour-partiel" ||
        valeur === "partiel"
    ) {
        return "Retour partiel";
    }

    if (
        valeur === "retour-total" ||
        valeur === "total"
    ) {
        return "Retour total";
    }

    return "Aucun retour";
}


/* ===========================================================
   VOIR UNE VENTE
=========================================================== */

function voirVente(idVente) {
    /*
     * La liste des ventes est déjà chargée par chargerVentes().
     * On utilise donc directement l'objet en mémoire pour ouvrir la fiche
     * sans refaire un appel API bloquant au moment du clic.
     */
    const vente =
        ventesChargees.find(
            element =>
                String(element.idVente) ===
                String(idVente)
        );

    if (!vente) {
        afficherToastVente(
            "Vente introuvable.",
            "error"
        );
        return;
    }

    const modal =
        document.getElementById(
            "view-sale-modal"
        );

    if (!modal) {
        return;
    }

    const client =
        obtenirNomClientVenteParId(
            vente.idClient
        ) ||
        vente.nomClient ||
        vente.idClient ||
        "—";

    definirTexteVente(
        "view-sale-modal-title",
        vente.numeroVente ||
        vente.idVente ||
        "Détails de la vente"
    );

    definirTexteVente(
        "view-sale-modal-subtitle",
        `Vente du ${
            vente.dateVente ||
            "—"
        } à ${
            vente.heureVente ||
            "—"
        }`
    );

    definirTexteVente(
        "view-sale-date-summary",
        formaterDateHeureVente(
            vente.dateVente,
            vente.heureVente
        )
    );

    definirTexteVente(
        "view-sale-net-summary",
        formaterFCFAVente(
            vente.montantNet
        )
    );

    definirTexteVente(
        "view-sale-payment-summary",
        formaterLibelleVente(
            vente.statutPaiement
        )
    );

    definirTexteVente(
        "view-sale-delivery-summary",
        formaterLibelleVente(
            vente.statutLivraison
        )
    );

    const zoneGenerale =
        document.getElementById(
            "view-sale-general-details"
        );

    if (zoneGenerale) {
        const details = [
            [
                "fa-hashtag",
                "ID Vente",
                vente.idVente
            ],
            [
                "fa-file-lines",
                "Commande liée",
                vente.numeroCommande ||
                vente.idCommande ||
                "—"
            ],
            [
                "fa-user",
                "Client",
                client
            ],
            [
                "fa-credit-card",
                "Mode de paiement",
                formaterLibelleVente(
                    vente.modePaiement
                )
            ],
            [
                "fa-circle-check",
                "Statut paiement",
                formaterLibelleVente(
                    vente.statutPaiement
                )
            ],
            [
                "fa-truck",
                "Statut livraison",
                formaterLibelleVente(
                    vente.statutLivraison
                )
            ],
            [
                "fa-message",
                "Commentaire",
                vente.commentaire ||
                "—"
            ]
        ];

        zoneGenerale.innerHTML =
            details
                .map(
                    ([icone, libelle, valeur]) => `
                        <div class="order-info-row">
                            <span class="order-info-row-icon">
                                <i class="fa-solid ${icone}"></i>
                            </span>

                            <span class="order-info-row-label">
                                ${echapperHTMLVente(
                                    libelle
                                )}
                            </span>

                            <strong class="order-info-row-value">
                                ${echapperHTMLVente(
                                    valeur ||
                                    "—"
                                )}
                            </strong>
                        </div>
                    `
                )
                .join("");
    }

    const zoneFinanciere =
        document.getElementById(
            "view-sale-financial-details"
        );

    if (zoneFinanciere) {
        const financiers = [
            [
                "Montant total",
                formaterFCFAVente(
                    vente.montantTotal
                ),
                ""
            ],
            [
                "Remise totale",
                formaterFCFAVente(
                    vente.remiseTotale
                ),
                "is-discount"
            ],
            [
                "Frais de livraison",
                formaterFCFAVente(
                    vente.fraisLivraison
                ),
                ""
            ],
            [
                "Montant net",
                formaterFCFAVente(
                    vente.montantNet
                ),
                "is-total"
            ],
            [
                "Paiement encaissé",
                formaterFCFAVente(
                    vente.montantPaye
                ),
                ""
            ],
            ...(
                convertirNombreVente(
                    vente.montantAvoirUtilise
                ) > 0
                    ? [[
                        "Avoir client utilisé",
                        formaterFCFAVente(
                            vente.montantAvoirUtilise
                        ),
                        "is-credit"
                    ]]
                    : []
            ),
            [
                "Total réglé",
                formaterFCFAVente(
                    vente.montantRegle ??
                    (
                        convertirNombreVente(
                            vente.montantPaye
                        ) +
                        convertirNombreVente(
                            vente.montantAvoirUtilise
                        )
                    )
                ),
                "is-settled"
            ],
            [
                "Reste à payer",
                formaterFCFAVente(
                    vente.resteAPayer
                ),
                ""
            ]
        ];

        zoneFinanciere.innerHTML =
            financiers
                .map(
                    ([libelle, valeur, classe]) => `
                        <div class="order-financial-row ${classe}">
                            <span>
                                ${echapperHTMLVente(
                                    libelle
                                )}
                            </span>

                            <strong>
                                ${echapperHTMLVente(
                                    valeur
                                )}
                            </strong>
                        </div>
                    `
                )
                .join("");

        const encaissements = Array.isArray(vente.encaissements)
            ? vente.encaissements
            : [];

        if (encaissements.length) {
            zoneFinanciere.innerHTML += `
                <div class="sale-payment-history">
                    <div class="sale-payment-history-title">
                        <strong>Historique des encaissements complémentaires</strong>
                    </div>
                    ${encaissements.map(encaissement => `
                        <div class="sale-payment-history-row">
                            <span>
                                ${echapperHTMLVente(
                                    formaterDateHeureVente(
                                        encaissement.dateEncaissement,
                                        encaissement.heureEncaissement
                                    )
                                )}
                                · ${echapperHTMLVente(formaterLibelleVente(encaissement.modePaiement))}
                            </span>
                            <strong>${echapperHTMLVente(formaterFCFAVente(encaissement.montant))}</strong>
                        </div>
                    `).join("")}
                </div>
            `;
        }
    }

    const lignes =
        Array.isArray(
            vente.lignes
        )
            ? vente.lignes
            : Array.isArray(
                vente.detailsVente
            )
                ? vente.detailsVente
                : Array.isArray(
                    vente.details
                )
                    ? vente.details
                    : [];

    const tbody =
        document.getElementById(
            "view-sale-lines-body"
        );

    if (tbody) {
        if (!lignes.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-table">
                        Aucun produit.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML =
                lignes
                    .map(
                        (ligne, index) => {
                            const designation =
                                obtenirNomProduitVenteParId(
                                    ligne.idProduit
                                ) ||
                                ligne.designation ||
                                ligne.idProduit ||
                                "Produit";

                            return `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>
                                        <strong>
                                            ${echapperHTMLVente(
                                                designation
                                            )}
                                        </strong>
                                    </td>
                                    <td>
                                        ${convertirNombreVente(
                                            ligne.quantite ??
                                            ligne.quantiteVendue
                                        )}
                                    </td>
                                    <td>
                                        ${formaterFCFAVente(
                                            ligne.prixUnitaire ??
                                            ligne.prixVenteUnitaire
                                        )}
                                    </td>
                                    <td>
                                        ${formaterFCFAVente(
                                            ligne.remise
                                        )}
                                    </td>
                                    <td>
                                        <strong>
                                            ${formaterFCFAVente(
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
    }

    const nombreArticles =
        lignes.reduce(
            (total, ligne) =>
                total +
                convertirNombreVente(
                    ligne.quantite ??
                    ligne.quantiteVendue
                ),
            0
        );

    definirTexteVente(
        "view-sale-products-count",
        `${nombreArticles} article${
            nombreArticles > 1
                ? "s"
                : ""
        }`
    );

    const boutonEncaisserVue =
        document.getElementById("view-sale-payment-btn");

    if (boutonEncaisserVue) {
        const paiementPartiel =
            normaliserTexteVente(vente.statutPaiement) === "partiellement payee";

        boutonEncaisserVue.hidden = !paiementPartiel;
        boutonEncaisserVue.dataset.paymentSale = paiementPartiel
            ? String(vente.idVente || "")
            : "";
    }

    modal.classList.add("active");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function fermerModaleVoirVente() {
    const modal =
        document.getElementById(
            "view-sale-modal"
        );

    modal?.classList.remove("active");
    modal?.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );
}


/* ===========================================================
   MODIFIER UNE VENTE
=========================================================== */

function ouvrirModificationVente(
    idVente
) {
    const vente =
        ventesChargees.find(
            element =>
                String(element.idVente) ===
                String(idVente)
        );

    if (!vente) {
        afficherToastVente(
            "Vente introuvable.",
            "error"
        );
        return;
    }

    if (
        estVenteAnnuleeApresEchecLivraison(
            vente
        )
    ) {
        afficherToastVente(
            "Cette vente est annulée après un échec définitif de livraison et ne peut plus être modifiée.",
            "error"
        );
        return;
    }

    const statutLivraisonModification =
        normaliserTexteVente(
            vente.statutLivraison ||
            ""
        );

    if (
        [
            "en-livraison",
            "livree",
            "annulee",
            "cloturee"
        ].includes(
            statutLivraisonModification
        )
    ) {
        afficherToastVente(
            statutLivraisonModification === "en-livraison"
                ? "Cette vente ne peut plus être modifiée car la livraison est déjà en cours."
                : "Cette vente ne peut plus être modifiée car son processus de livraison est terminé ou verrouillé.",
            "error"
        );
        return;
    }

    venteEnModificationId =
        vente.idVente;

    /*
     * UX : on remplit d'abord avec les données déjà chargées,
     * puis on ouvre immédiatement la modale.
     */
    definirValeurVente(
        "sale-id",
        vente.idVente
    );

    definirValeurVente(
        "sale-order-id",
        vente.idCommande ||
        ""
    );

    definirValeurVente(
        "sale-number",
        vente.numeroVente ||
        vente.idVente ||
        ""
    );

    definirValeurVente(
        "sale-client",
        vente.idClient
    );

    definirValeurVente(
        "sale-date",
        vente.dateVente
    );

    definirValeurVente(
        "sale-time",
        vente.heureVente
    );

    definirValeurVente(
        "sale-payment-method",
        vente.modePaiement
    );

    definirValeurVente(
        "sale-paid-amount",
        formaterNombreChampVente(
            vente.montantPaye
        )
    );

    definirValeurVente(
        "sale-delivery-fees",
        formaterNombreChampVente(
            normaliserTexteVente(
                vente.modeReception ||
                ""
            ) === "livraison"
                ? vente.fraisLivraison
                : (
                    vente.derniersFraisLivraison ??
                    vente.fraisLivraison
                )
        )
    );

    const venteIssueCommande =
        normaliserTexteVente(
            vente.origineCommande || ""
        ) === "commande";

    afficherStatutLivraisonVente(
        vente.statutLivraison ||
        (
            vente.modeReception === "livraison"
                ? "a-preparer"
                : "retrait-boutique"
        )
    );

    const modeReceptionVente =
        normaliserTexteVente(
            vente.modeReception ||
            ""
        );

    definirValeurVente(
        "sale-delivery-mode",
        modeReceptionVente === "livraison"
            ? "livraison"
            : "retrait-boutique"
    );

    definirValeurVente(
        "sale-delivery-commune",
        vente.communeLivraison ||
        ""
    );

    definirValeurVente(
        "sale-delivery-zone",
        vente.zoneLivraison ||
        ""
    );

    definirValeurVente(
        "sale-delivery-address",
        vente.adresseLivraison ||
        ""
    );

    definirValeurVente(
        "sale-delivery-date",
        vente.dateLivraisonPrevue ||
        ""
    );

    mettreAJourAffichageLivraisonVente();

    definirValeurVente(
        "sale-comment",
        vente.commentaire
    );

    const lignes =
        Array.isArray(
            vente.lignes
        )
            ? vente.lignes
            : Array.isArray(
                vente.detailsVente
            )
                ? vente.detailsVente
                : Array.isArray(
                    vente.details
                )
                    ? vente.details
                    : [];

    lignesVente =
        lignes.map(
            ligne => ({
                idLigne:
                    ligne.idDetailVente ||
                    genererIdLocalVente(),

                idProduit:
                    ligne.idProduit,

                designation:
                    obtenirNomProduitVenteParId(
                        ligne.idProduit
                    ) ||
                    ligne.designation ||
                    ligne.idProduit,

                stockDisponible:
                    obtenirStockProduitVente(
                        obtenirProduitVenteParId(
                            ligne.idProduit
                        ) ||
                        {}
                    ),

                quantite:
                    convertirNombreVente(
                        ligne.quantite ??
                        ligne.quantiteVendue
                    ),

                quantiteVendue:
                    convertirNombreVente(
                        ligne.quantite ??
                        ligne.quantiteVendue
                    ),

                prixUnitaire:
                    convertirNombreVente(
                        ligne.prixUnitaire ??
                        ligne.prixVenteUnitaire
                    ),

                prixVenteUnitaire:
                    convertirNombreVente(
                        ligne.prixUnitaire ??
                        ligne.prixVenteUnitaire
                    ),

                remise:
                    convertirNombreVente(
                        ligne.remise
                    ),

                sousTotal:
                    convertirNombreVente(
                        ligne.sousTotal
                    ),

                commentaire:
                    ligne.commentaire ||
                    ""
            })
        );

    const remiseProduitsExistante =
        lignesVente.reduce(
            (total, ligne) =>
                total +
                convertirNombreVente(ligne.remise),
            0
        );

    const remiseGlobaleExistante =
        Math.max(
            0,
            convertirNombreVente(vente.remiseTotale) -
            remiseProduitsExistante
        );

    definirValeurVente(
        "sale-global-discount",
        remiseGlobaleExistante
            ? formaterNombreChampVente(remiseGlobaleExistante)
            : ""
    );

    afficherLignesVente();
    recalculerTotauxVente();

    const titre =
        document.getElementById(
            "sale-modal-title"
        );

    if (titre) {
        titre.textContent =
            "Modifier la vente";
    }

    const bouton =
        document.getElementById(
            "save-sale-btn"
        );

    if (bouton) {
        bouton.textContent =
            "Enregistrer les modifications";
    }

    const modal =
        document.getElementById(
            "sale-modal"
        );

    modal?.classList.add("active");
    modal?.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

    /*
     * Les catalogues sont rafraîchis après l'ouverture.
     * Cela supprime la latence ressentie au clic.
     */
    Promise.allSettled([
        chargerClientsVente(
            vente.idClient
        ),
        chargerProduitsVente(),
        chargerLivreursVente()
    ]).then(() => {
        afficherLivreursParCommuneVente(
            vente.idLivreur ||
            ""
        );

        const statutLivraisonActuel =
            normaliserTexteVente(
                vente.statutLivraison ||
                ""
            );

        const modificationLogistiqueAutorisee =
            ![
                "en-livraison",
                "livree",
                "annulee",
                "cloturee"
            ].includes(
                statutLivraisonActuel
            );

        const champsLogistiques = [
            "sale-delivery-mode",
            "sale-delivery-commune",
            "sale-delivery-zone",
            "sale-delivery-address",
            "sale-delivery-person",
            "sale-delivery-date"
        ];

        champsLogistiques.forEach(id => {
            const champ =
                document.getElementById(id);

            if (champ) {
                champ.disabled =
                    !modificationLogistiqueAutorisee;
            }
        });

        definirValeurVente(
            "sale-client",
            vente.idClient
        );

        const champClient =
            document.getElementById(
                "sale-client"
            );

        if (champClient) {
            champClient.disabled = true;
            champClient.title =
                "Le client d'une vente enregistrée ne peut plus être changé.";
        }

        const champPrix =
            document.getElementById(
                "sale-product-price"
            );

        if (champPrix) {
            champPrix.readOnly = false;
        }

        /* Met à jour les noms/stock des lignes avec les catalogues frais. */
        lignesVente =
            lignesVente.map(
                ligne => ({
                    ...ligne,
                    designation:
                        obtenirNomProduitVenteParId(
                            ligne.idProduit
                        ) ||
                        ligne.designation ||
                        ligne.idProduit,
                    stockDisponible:
                        obtenirStockProduitVente(
                            obtenirProduitVenteParId(
                                ligne.idProduit
                            ) ||
                            {}
                        )
                })
            );

        afficherLignesVente();
        recalculerTotauxVente();
    }).catch(() => {
        // Les chargeurs affichent déjà leurs erreurs individuellement.
    });
}

/* ===========================================================
   SUPPRIMER UNE VENTE
=========================================================== */

let venteASupprimerId = null;

function initialiserConfirmationSuppressionVente() {
    document.getElementById("cancel-delete-sale-btn")?.addEventListener("click", fermerConfirmationSuppressionVente);
    document.getElementById("confirm-delete-sale-btn")?.addEventListener("click", confirmerSuppressionVente);
    document.getElementById("delete-sale-modal")?.addEventListener("click", event => {
        if (event.target.id === "delete-sale-modal") fermerConfirmationSuppressionVente();
    });
}

function supprimerVenteFrontend(idVente) {
    const vente = ventesChargees.find(element => String(element.idVente) === String(idVente));
    if (!vente) {
        afficherToastVente("Vente introuvable.", "error");
        return;
    }

    if (
        estVenteAnnuleeApresEchecLivraison(
            vente
        )
    ) {
        afficherToastVente(
            "Cette vente annulée doit rester dans l'historique et ne peut pas être supprimée.",
            "error"
        );
        return;
    }

    venteASupprimerId = vente.idVente;
    definirTexteVente("delete-sale-number", vente.numeroVente || vente.idVente || "—");
    const erreur = document.getElementById("delete-sale-error");
    if (erreur) {
        erreur.textContent = "";
        erreur.className = "form-message";
        erreur.style.display = "none";
    }
    const modal = document.getElementById("delete-sale-modal");
    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function fermerConfirmationSuppressionVente() {
    if (document.getElementById("confirm-delete-sale-btn")?.disabled) return;
    venteASupprimerId = null;
    const modal = document.getElementById("delete-sale-modal");
    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

async function confirmerSuppressionVente() {
    const idVente = venteASupprimerId;
    if (!idVente) return;
    const bouton = document.getElementById("confirm-delete-sale-btn");
    try {
        definirBoutonChargementVente(bouton, true, "Suppression...");
        const resultat = await apiPost("deleteVente", { idVente });
        if (!resultat?.success) throw new Error(resultat?.message || "Impossible de supprimer la vente.");
        const modal = document.getElementById("delete-sale-modal");
        modal?.classList.remove("active");
        modal?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        venteASupprimerId = null;
        afficherToastVente(resultat.message || "Vente supprimée avec succès.", "success");
        await Promise.allSettled([
            chargerVentes({ silencieux: true, conserverPage: true }),
            chargerProduitsVente()
        ]);
    } catch (error) {
        console.error("Erreur de suppression de la vente :", error);
        const zone = document.getElementById("delete-sale-error");
        if (zone) {
            zone.textContent = error.message || "Impossible de supprimer la vente.";
            zone.className = "form-message error";
            zone.style.display = "block";
        }
    } finally {
        definirBoutonChargementVente(bouton, false, "Supprimer la vente");
    }
}


/* ===========================================================
   KPI VENTES
=========================================================== */

function mettreAJourKPIVentes() {
    const total =
        ventesChargees.length;

    const maintenant =
        new Date();

    const nouvellesCeMois =
        ventesChargees.filter(
            vente => {
                const date =
                    convertirDateVente(
                        vente.dateVente
                    );

                return (
                    date &&
                    date.getFullYear() ===
                        maintenant.getFullYear() &&
                    date.getMonth() ===
                        maintenant.getMonth()
                );
            }
        ).length;

    const chiffreAffaires =
        ventesChargees.reduce(
            (somme, vente) =>
                somme +
                convertirNombreVente(
                    vente.montantNet
                ),
            0
        );

    const montantEncaisse =
        ventesChargees.reduce(
            (somme, vente) =>
                somme +
                convertirNombreVente(
                    vente.montantPaye
                ),
            0
        );

    const creances =
        ventesChargees.reduce(
            (somme, vente) =>
                somme +
                convertirNombreVente(
                    vente.resteAPayer
                ),
            0
        );

    const ventesNonSoldees =
        ventesChargees.filter(
            vente =>
                convertirNombreVente(
                    vente.resteAPayer
                ) >
                0
        ).length;

    const tauxEncaissement =
        chiffreAffaires > 0
            ? Math.round(
                (
                    montantEncaisse /
                    chiffreAffaires
                ) *
                100
            )
            : 0;

    const correspondances = {
        "total-sales-value":
            total,

        "total-sales-description":
            `${nouvellesCeMois} nouvelle${
                nouvellesCeMois > 1
                    ? "s"
                    : ""
            } vente${
                nouvellesCeMois > 1
                    ? "s"
                    : ""
            } ce mois`,

        "sales-revenue-value":
            formaterFCFAVente(
                chiffreAffaires
            ),

        "sales-paid-value":
            formaterFCFAVente(
                montantEncaisse
            ),

        "sales-paid-description":
            `${tauxEncaissement} % du chiffre d'affaires`,

        "sales-balance-value":
            formaterFCFAVente(
                creances
            ),

        "sales-balance-description":
            `${ventesNonSoldees} vente${
                ventesNonSoldees > 1
                    ? "s"
                    : ""
            } non soldée${
                ventesNonSoldees > 1
                    ? "s"
                    : ""
            }`
    };

    Object.entries(
        correspondances
    ).forEach(
        ([id, valeur]) => {
            const element =
                document.getElementById(id);

            if (element) {
                element.textContent =
                    valeur;
            }
        }
    );
}


/* ===========================================================
   PAGINATION
=========================================================== */

function afficherPaginationVentes(
    totalPages,
    total,
    debut,
    fin
) {
    const precedent =
        document.getElementById(
            "previous-sale-page-btn"
        );

    const suivant =
        document.getElementById(
            "next-sale-page-btn"
        );

    const boutons =
        document.getElementById(
            "sales-page-buttons"
        );

    if (precedent) {
        precedent.disabled =
            pageVentesActuelle <= 1;
    }

    if (suivant) {
        suivant.disabled =
            pageVentesActuelle >=
            totalPages;
    }

    if (boutons) {
        boutons.innerHTML = "";

        const debutPage =
            Math.max(
                1,
                pageVentesActuelle -
                2
            );

        const finPage =
            Math.min(
                totalPages,
                debutPage +
                4
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

            bouton.type =
                "button";

            bouton.className =
                "pagination-btn";

            bouton.textContent =
                String(page);

            if (
                page ===
                pageVentesActuelle
            ) {
                bouton.classList.add(
                    "active"
                );
            }

            bouton.addEventListener(
                "click",
                () => {
                    pageVentesActuelle =
                        page;

                    afficherTableauVentes();
                }
            );

            boutons.appendChild(
                bouton
            );
        }
    }

    const resume =
        document.getElementById(
            "sales-pagination-summary"
        );

    if (resume) {
        resume.textContent =
            total
                ? `${debut + 1}-${fin} sur ${total}`
                : "0 résultat";
    }
}


/* ===========================================================
   RESET FORMULAIRE
=========================================================== */

function reinitialiserFormulaireVente() {
    [
        "sale-delivery-mode",
        "sale-delivery-commune",
        "sale-delivery-zone",
        "sale-delivery-address",
        "sale-delivery-person",
        "sale-delivery-date"
    ].forEach(id => {
        const champ = document.getElementById(id);
        if (champ) {
            champ.disabled = false;
        }
    });
    const formulaire =
        document.getElementById(
            "sale-form"
        );

    formulaire?.reset();

    venteEnModificationId = null;
    ligneVenteEnModificationId = null;
    brouillonLivraisonVente = null;
    lignesVente = [];

    const champClient =
        document.getElementById(
            "sale-client"
        );

    if (champClient) {
        champClient.disabled = false;
        champClient.title = "";
    }

    const champPrix =
        document.getElementById(
            "sale-product-price"
        );

    if (champPrix) {
        champPrix.readOnly = true;
    }

    const boutonAjouterProduit =
        document.getElementById(
            "add-sale-product-btn"
        );

    if (boutonAjouterProduit) {
        boutonAjouterProduit.textContent =
            "➕ Ajouter le produit";
    }

    definirValeurVente(
        "sale-id",
        ""
    );

    definirValeurVente(
        "sale-order-id",
        ""
    );

    definirValeurVente(
        "sale-number",
        "Génération automatique..."
    );

    definirValeurVente(
        "sale-payment-status",
        "Impayée"
    );

    definirValeurVente(
        "sale-delivery-mode",
        "retrait-boutique"
    );

    afficherStatutLivraisonVente(
        "retrait-boutique"
    );

    mettreAJourAffichageLivraisonVente();

    definirValeurVente(
        "sale-global-discount",
        ""
    );

    [
        "sale-total",
        "sale-total-discount",
        "sale-net-amount",
        "sale-amount-due",
        "sale-paid-summary",
        "sale-balance",
        "sale-product-line-total"
    ].forEach(
        id => definirValeurVente(
            id,
            "0"
        )
    );

    afficherLignesVente();
    afficherStockProduitVente(null);
    masquerMessageVente();

    initialiserDateHeureVente();

    const titre =
        document.getElementById(
            "sale-modal-title"
        );

    if (titre) {
        titre.textContent =
            "Nouvelle vente";
    }

    const bouton =
        document.getElementById(
            "save-sale-btn"
        );

    if (bouton) {
        bouton.textContent =
            "Enregistrer la vente";
    }
}


/* ===========================================================
   MESSAGES
=========================================================== */

function afficherMessageVente(
    message,
    type = "info"
) {
    const zone =
        document.getElementById(
            "sale-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent =
        message;

    zone.className =
        "form-message " +
        type;

    zone.style.display =
        "block";
}


function masquerMessageVente() {
    const zone =
        document.getElementById(
            "sale-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent = "";
    zone.className =
        "form-message";

    zone.style.display =
        "none";
}


function afficherMessageClientRapideVente(
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

    zone.textContent =
        message;

    zone.className =
        "form-message " +
        type;

    zone.style.display =
        "block";
}


function masquerMessageClientRapideVente() {
    const zone =
        document.getElementById(
            "quick-client-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent = "";
    zone.className =
        "form-message";

    zone.style.display =
        "none";
}


function afficherToastVente(
    message,
    type = "info"
) {
    if (
        typeof showToast ===
        "function"
    ) {
        showToast(
            message,
            type
        );
        return;
    }

    /*
     * Secours discret si le composant global n'est pas chargé.
     */
    console[
        type === "error"
            ? "error"
            : "log"
    ](message);
}


/* ===========================================================
   OUTILS GÉNÉRAUX
=========================================================== */

function obtenirValeurVente(id) {
    const champ =
        document.getElementById(id);

    return champ
        ? String(
            champ.value ||
            ""
        ).trim()
        : "";
}


function definirValeurVente(
    id,
    valeur
) {
    const champ =
        document.getElementById(id);

    if (!champ) {
        return;
    }

    champ.value =
        valeur ??
        "";
}


function definirTexteVente(
    id,
    valeur
) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            valeur ||
            "—";
    }
}


function extraireListeVente(
    resultat,
    cle
) {
    if (
        Array.isArray(
            resultat
        )
    ) {
        return resultat;
    }

    if (
        Array.isArray(
            resultat?.data
        )
    ) {
        return resultat.data;
    }

    if (
        Array.isArray(
            resultat?.data?.[cle]
        )
    ) {
        return resultat.data[cle];
    }

    if (
        Array.isArray(
            resultat?.[cle]
        )
    ) {
        return resultat[cle];
    }

    return [];
}


function lireValeurObjetVente(
    objet,
    cles
) {
    if (
        !objet ||
        !Array.isArray(cles)
    ) {
        return "";
    }

    for (const cle of cles) {
        if (
            Object.prototype.hasOwnProperty.call(
                objet,
                cle
            ) &&
            objet[cle] !== null &&
            objet[cle] !== undefined &&
            objet[cle] !== ""
        ) {
            return objet[cle];
        }
    }

    return "";
}


function convertirNombreVente(valeur) {
    const texte =
        String(
            valeur ??
            ""
        )
            .replace(
                /[\s\u00A0\u202F]/g,
                ""
            )
            .replace(
                /FCFA/gi,
                ""
            )
            .replace(
                ",",
                "."
            );

    const nombre =
        Number(texte);

    return Number.isFinite(nombre)
        ? nombre
        : 0;
}


function nombreBrutChampVente(valeur) {
    const nombre =
        convertirNombreVente(
            valeur
        );

    return nombre
        ? String(
            Math.trunc(nombre)
        )
        : "";
}


function formaterNombreChampVente(valeur) {
    const nombre =
        Math.max(
            0,
            convertirNombreVente(
                valeur
            )
        );

    return new Intl.NumberFormat(
        "fr-FR",
        {
            maximumFractionDigits:
                0
        }
    ).format(nombre);
}


function formaterFCFAVente(valeur) {
    return (
        formaterNombreChampVente(
            valeur
        ) +
        " FCFA"
    );
}


function limiterSaisieMontantVente(champ) {
    if (!champ) {
        return;
    }

    champ.value =
        String(
            champ.value ||
            ""
        ).replace(
            /[^\d]/g,
            ""
        );
}


function normaliserTexteVente(valeur) {
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
        .toLowerCase();
}


function formaterLibelleVente(valeur) {
    const texte =
        String(
            valeur ||
            "—"
        )
            .replaceAll(
                "-",
                " "
            )
            .trim();

    if (!texte) {
        return "—";
    }

    return (
        texte.charAt(0).toUpperCase() +
        texte.slice(1)
    );
}


function convertirDateVente(valeur) {
    if (!valeur) {
        return null;
    }

    const texte =
        String(valeur).trim();

    const date =
        /^\d{4}-\d{2}-\d{2}$/.test(
            texte
        )
            ? new Date(
                `${texte}T00:00:00`
            )
            : new Date(texte);

    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;
}


function formaterDateHeureVente(
    date,
    heure
) {
    const objetDate =
        convertirDateVente(
            date
        );

    const dateFormatee =
        objetDate
            ? new Intl.DateTimeFormat(
                "fr-FR",
                {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                }
            ).format(objetDate)
            : (
                date ||
                "—"
            );

    return heure
        ? `${dateFormatee} à ${heure}`
        : dateFormatee;
}


function genererIdLocalVente() {
    if (
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID ===
        "function"
    ) {
        return globalThis.crypto.randomUUID();
    }

    return (
        "LOCAL-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2)
    );
}


function definirBoutonChargementVente(
    bouton,
    actif,
    texte
) {
    if (!bouton) {
        return;
    }

    bouton.disabled =
        Boolean(actif);

    bouton.classList.toggle(
        "is-loading",
        Boolean(actif)
    );

    bouton.textContent =
        texte;
}


function echapperHTMLVente(valeur) {
    return String(
        valeur ??
        ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}



/* ===========================================================
   PEAUFINAGE UI VENTES — SANS MODIFIER LA LOGIQUE MÉTIER
=========================================================== */

function initialiserInteractionsHeaderVente() {
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
            }
        }
    );
}




function exporterVentesFiltreesCSV() {
    if (!Array.isArray(ventesFiltrees) || !ventesFiltrees.length) {
        afficherToastVente(
            "Aucune vente à exporter.",
            "info"
        );
        return;
    }

    const lignes = ventesFiltrees.map(vente => ({
        "N° vente": vente.numeroVente || vente.idVente || "",
        "Commande": vente.numeroCommande || vente.idCommande || "",
        "Client": obtenirNomClientVenteParId(vente.idClient) || vente.nomClient || vente.idClient || "",
        "Date": [vente.dateVente, vente.heureVente].filter(Boolean).join(" "),
        "Montant net": convertirNombreVente(vente.montantNet),
        "Montant payé": convertirNombreVente(vente.montantPaye),
        "Reste à payer": convertirNombreVente(vente.resteAPayer),
        "Mode de paiement": formaterLibelleVente(vente.modePaiement),
        "Statut paiement": formaterLibelleVente(vente.statutPaiement),
        "Statut livraison": formaterLibelleVente(vente.statutLivraison),
        "Statut retour": formaterLibelleRetourVente(vente.statutRetour || "aucun-retour")
    }));

    const colonnes = Object.keys(lignes[0]);
    const echapperCSV = valeur => {
        const texte = String(valeur ?? "");
        return `"${texte.replace(/"/g, '""')}"`;
    };

    const contenu = [
        colonnes.map(echapperCSV).join(";"),
        ...lignes.map(ligne =>
            colonnes.map(colonne => echapperCSV(ligne[colonne])).join(";")
        )
    ].join("\r\n");

    const blob = new Blob(
        ["\uFEFF", contenu],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `ventes-${new Date().toISOString().slice(0, 10)}.csv`;
    lien.style.display = "none";
    document.body.appendChild(lien);
    lien.click();
    lien.remove();

    setTimeout(
        () => URL.revokeObjectURL(url),
        1000
    );
}




function activerBoutonVenteMobile(element, action) {
    if (!element) return;

    let dernierDeclenchement = 0;

    const executer = event => {
        const maintenant = Date.now();

        if (maintenant - dernierDeclenchement < 450) {
            event.preventDefault();
            return;
        }

        dernierDeclenchement = maintenant;
        event.preventDefault();
        event.stopPropagation();
        action();
    };

    if (window.PointerEvent) {
        element.addEventListener("pointerup", executer);
    } else {
        element.addEventListener("touchend", executer, { passive: false });
    }
}


function initialiserMenuActionsVentes() {
    const declencheur =
        document.getElementById(
            "sales-actions-trigger"
        );

    const menu =
        document.getElementById(
            "sales-actions-dropdown"
        );

    document
        .getElementById(
            "export-sales-btn"
        )
        ?.addEventListener(
            "click",
            exporterVentesFiltreesCSV
        );

    if (
        !declencheur ||
        !menu
    ) {
        return;
    }

    const basculerActions = () => {
        const vaOuvrir =
            menu.hidden;

        fermerMenusActionsLigneVente();

        if (
            vaOuvrir &&
            modeSelectionVentes
        ) {
            definirModeSelectionVentes(
                false
            );
        }

        menu.hidden =
            !vaOuvrir;

        declencheur.setAttribute(
            "aria-expanded",
            String(
                vaOuvrir
            )
        );
    };

    if (
        window.matchMedia(
            "(max-width: 900px)"
        ).matches
    ) {
        activerBoutonVenteMobile(
            declencheur,
            basculerActions
        );
    } else {
        declencheur.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                basculerActions();
            }
        );
    }

    menu.addEventListener(
        "click",
        event => {
            if (
                event.target.closest(
                    "button"
                )
            ) {
                menu.hidden = true;

                declencheur.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (
                !event.target.closest(
                    ".sales-actions-menu"
                )
            ) {
                menu.hidden = true;

                declencheur.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );
}


function initialiserModeSelectionVentes() {
    const bouton =
        document.getElementById(
            "selection-sales-btn"
        );

    const toutSelectionner =
        document.getElementById(
            "select-all-sales"
        );

    const basculerSelection = () => {
        if (!modeSelectionVentes) {
            const menuActions = document.getElementById("sales-actions-dropdown");
            const triggerActions = document.getElementById("sales-actions-trigger");
            if (menuActions) menuActions.hidden = true;
            triggerActions?.setAttribute("aria-expanded", "false");
        }

        definirModeSelectionVentes(
            !modeSelectionVentes
        );
    };

    if (
        bouton &&
        window.matchMedia(
            "(max-width: 900px)"
        ).matches
    ) {
        activerBoutonVenteMobile(
            bouton,
            basculerSelection
        );
    } else {
        bouton?.addEventListener(
            "click",
            basculerSelection
        );
    }

    document
        .getElementById(
            "close-sales-selection-btn"
        )
        ?.addEventListener(
            "click",
            () => {
                definirModeSelectionVentes(
                    false
                );
            }
        );

    document
        .getElementById(
            "clear-sales-selection-btn"
        )
        ?.addEventListener(
            "click",
            () => {
                ventesSelectionnees.clear();
                synchroniserSelectionVentes();
            }
        );

    document
        .getElementById(
            "delete-sales-selection-btn"
        )
        ?.addEventListener(
            "click",
            supprimerSelectionVentes
        );

    document
        .getElementById(
            "select-visible-sales-btn"
        )
        ?.addEventListener(
            "click",
            () => {
                ventesFiltrees.forEach(
                    vente => {
                        ventesSelectionnees.add(
                            String(
                                vente.idVente
                            )
                        );
                    }
                );

                synchroniserSelectionVentes();
            }
        );

    toutSelectionner?.addEventListener(
        "change",
        event => {
            const debut =
                (
                    pageVentesActuelle -
                    1
                ) *
                taillePageVentes;

            const page =
                ventesFiltrees.slice(
                    debut,
                    debut +
                    taillePageVentes
                );

            page.forEach(
                vente => {
                    const id =
                        String(
                            vente.idVente
                        );

                    if (
                        event.target.checked
                    ) {
                        ventesSelectionnees.add(
                            id
                        );
                    } else {
                        ventesSelectionnees.delete(
                            id
                        );
                    }
                }
            );

            synchroniserSelectionVentes();
        }
    );

    document
        .getElementById(
            "sales-table-body"
        )
        ?.addEventListener(
            "change",
            event => {
                const checkbox =
                    event.target.closest(
                        "[data-select-sale]"
                    );

                if (!checkbox) {
                    return;
                }

                const id =
                    String(
                        checkbox.dataset.selectSale ||
                        ""
                    );

                if (
                    checkbox.checked
                ) {
                    ventesSelectionnees.add(
                        id
                    );
                } else {
                    ventesSelectionnees.delete(
                        id
                    );
                }

                synchroniserSelectionVentes(
                    false
                );
            }
        );
}



async function supprimerSelectionVentes() {
    /*
     * Traçabilité VISIBL :
     * aucune vente enregistrée ne peut être supprimée depuis cette page.
     */
    afficherToastVente(
        "La suppression des ventes est désactivée afin de préserver la traçabilité.",
        "info"
    );
}

function definirModeSelectionVentes(
    actif
) {
    modeSelectionVentes =
        Boolean(
            actif
        );

    document.body.classList.toggle(
        "sales-selection-mode",
        modeSelectionVentes
    );

    const bouton =
        document.getElementById(
            "selection-sales-btn"
        );

    bouton?.setAttribute(
        "aria-pressed",
        String(
            modeSelectionVentes
        )
    );

    const barre =
        document.getElementById(
            "sales-selection-bar"
        );

    if (barre) {
        barre.hidden =
            !modeSelectionVentes;
    }

    if (
        !modeSelectionVentes
    ) {
        ventesSelectionnees.clear();
    }

    synchroniserSelectionVentes();
}


function synchroniserSelectionVentes(
    rafraichirCases = true
) {
    if (rafraichirCases) {
        document
            .querySelectorAll(
                "[data-select-sale]"
            )
            .forEach(
                checkbox => {
                    checkbox.checked =
                        ventesSelectionnees.has(
                            String(
                                checkbox.dataset.selectSale ||
                                ""
                            )
                        );
                }
            );
    }

    definirTexteVente(
        "selected-sales-count",
        String(
            ventesSelectionnees.size
        )
    );

    const toutSelectionner =
        document.getElementById(
            "select-all-sales"
        );

    if (toutSelectionner) {
        const visibles =
            Array.from(
                document.querySelectorAll(
                    "[data-select-sale]"
                )
            );

        const nombreCochees =
            visibles.filter(
                checkbox =>
                    checkbox.checked
            ).length;

        toutSelectionner.checked =
            visibles.length > 0 &&
            nombreCochees ===
                visibles.length;

        toutSelectionner.indeterminate =
            nombreCochees > 0 &&
            nombreCochees <
                visibles.length;
    }
}


function fermerMenusActionsLigneVente() {
    document
        .querySelectorAll(
            "[data-sale-actions-menu]"
        )
        .forEach(
            menu => {
                menu.hidden = true;
            }
        );

    document
        .querySelectorAll(
            "[data-sale-actions-toggle]"
        )
        .forEach(
            bouton => {
                bouton.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        );
}


function basculerMenuActionsLigneVente(
    bouton
) {
    const id =
        String(
            bouton?.dataset
                ?.saleActionsToggle ||
            ""
        );

    const menu =
        document.querySelector(
            `[data-sale-actions-menu="${CSS.escape(id)}"]`
        );

    if (!menu) {
        return;
    }

    const ouvrir =
        menu.hidden;

    fermerMenusActionsLigneVente();

    menu.hidden =
        !ouvrir;

    bouton.setAttribute(
        "aria-expanded",
        String(
            ouvrir
        )
    );
}


document.addEventListener(
    "click",
    event => {
        if (
            !event.target.closest(
                ".sale-row-menu"
            )
        ) {
            fermerMenusActionsLigneVente();
        }
    }
);


/* VENTE STRICTE : verrouillage visuel des actions de création/modification/suppression. */
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("#new-sale-btn,#new-sale-toolbar-btn").forEach(el=>el.remove());
  const observer=new MutationObserver(()=>{
    document.querySelectorAll('[data-action="edit-sale"],[data-action="delete-sale"],.edit-sale-btn,.delete-sale-btn').forEach(el=>el.remove());
  });
  observer.observe(document.body,{childList:true,subtree:true});
});


/* ===========================================================
   ENCAISSEMENT COMPLÉMENTAIRE D'UNE VENTE
=========================================================== */

function initialiserEncaissementPaiementVente() {
    document
        .getElementById("close-sale-payment-modal")
        ?.addEventListener("click", fermerModaleEncaissementPaiementVente);

    document
        .getElementById("cancel-sale-payment-btn")
        ?.addEventListener("click", fermerModaleEncaissementPaiementVente);

    document
        .getElementById("confirm-sale-payment-btn")
        ?.addEventListener("click", enregistrerEncaissementPaiementVente);

    document
        .getElementById("view-sale-payment-btn")
        ?.addEventListener("click", event => {
            const idVente = event.currentTarget.dataset.paymentSale || "";
            fermerModaleVoirVente();
            ouvrirModaleEncaissementPaiementVente(idVente);
        });

    const modal = document.getElementById("sale-payment-modal");
    modal?.addEventListener("click", event => {
        if (event.target === modal) {
            fermerModaleEncaissementPaiementVente();
        }
    });
}

function ouvrirModaleEncaissementPaiementVente(idVente) {
    const vente = ventesChargees.find(
        element => String(element.idVente) === String(idVente)
    );

    if (!vente) {
        afficherToastVente("Vente introuvable.", "error");
        return;
    }

    if (normaliserTexteVente(vente.statutPaiement) !== "partiellement payee") {
        afficherToastVente(
            "L'encaissement complémentaire est disponible uniquement pour une vente partiellement payée.",
            "info"
        );
        return;
    }

    const reste = Math.max(0, convertirNombreVente(vente.resteAPayer));
    if (reste <= 0) {
        afficherToastVente("Cette vente est déjà soldée.", "info");
        return;
    }

    definirValeurVente("sale-payment-sale-id", vente.idVente);
    definirValeurVente("sale-payment-amount", "");
    definirValeurVente("sale-payment-method-extra", vente.modePaiement || "");
    definirTexteVente("sale-payment-balance-display", formaterFCFAVente(reste));
    definirTexteVente(
        "sale-payment-modal-subtitle",
        `${vente.numeroVente || vente.idVente} · Reste à payer : ${formaterFCFAVente(reste)}`
    );

    const message = document.getElementById("sale-payment-message");
    if (message) {
        message.textContent = "";
        message.className = "form-message";
    }

    const champMontant = document.getElementById("sale-payment-amount");
    if (champMontant) {
        champMontant.dataset.maxPayment = String(reste);
    }

    const modal = document.getElementById("sale-payment-modal");
    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(() => champMontant?.focus(), 50);
}

function fermerModaleEncaissementPaiementVente() {
    const modal = document.getElementById("sale-payment-modal");
    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

async function enregistrerEncaissementPaiementVente() {
    const idVente = obtenirValeurVente("sale-payment-sale-id");
    const montant = convertirNombreVente(obtenirValeurVente("sale-payment-amount"));
    const modePaiement = obtenirValeurVente("sale-payment-method-extra");
    const vente = ventesChargees.find(
        element => String(element.idVente) === String(idVente)
    );
    const reste = Math.max(0, convertirNombreVente(vente?.resteAPayer));
    const zone = document.getElementById("sale-payment-message");
    const bouton = document.getElementById("confirm-sale-payment-btn");

    const erreur = message => {
        if (zone) {
            zone.textContent = message;
            zone.className = "form-message error";
        }
    };

    if (!vente) return erreur("Vente introuvable.");
    if (montant <= 0) return erreur("Saisissez un montant encaissé supérieur à 0.");
    if (montant > reste) return erreur(`Le montant ne peut pas dépasser le reste à payer (${formaterFCFAVente(reste)}).`);
    if (!modePaiement) return erreur("Sélectionnez le moyen de paiement utilisé.");

    const utilisateur = typeof getCurrentUser === "function"
        ? getCurrentUser()
        : null;

    try {
        definirBoutonChargementVente(bouton, true, "Encaissement...");

        const resultat = await apiPost("encaisserPaiementVente", {
            idVente,
            montant,
            modePaiement,
            idUtilisateur: String(
                utilisateur?.idUtilisateur ||
                utilisateur?.["ID Utilisateur"] ||
                utilisateur?.id ||
                ""
            ).trim()
        });

        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible d'enregistrer l'encaissement.");
        }

        fermerModaleEncaissementPaiementVente();
        afficherToastVente(resultat.message || "Paiement encaissé avec succès.", "success");
        await chargerVentes({ silencieux: true, conserverPage: true });

        const venteActualisee = ventesChargees.find(
            element => String(element.idVente) === String(idVente)
        );
        if (venteActualisee) {
            voirVente(idVente);
        }
    } catch (error) {
        erreur(error.message || "Impossible d'enregistrer l'encaissement.");
    } finally {
        definirBoutonChargementVente(bouton, false, "Encaisser");
    }
}