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

document.addEventListener("DOMContentLoaded", () => {
    initialiserModaleCommande();
    initialiserDateHeureCommande();
    initialiserGestionClientsCommande();
    initialiserProduitsCommande();
    initialiserLivreursCommande();
    initialiserCalculsCommande();
    initialiserEnregistrementCommande();
    initialiserListeCommandes();
});


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
        .getElementById("orders-search-input")
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

        origineCommande:
            obtenirValeurCommande("order-origin") ||
            "Saisie manuelle",

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
                <td colspan="10" class="empty-table">
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
            obtenirValeurCommande("orders-search-input")
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
                            commande.modePaiementPrevu
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
        "orders-search-input",
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
                <td colspan="10" class="empty-table">
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

    afficherPaginationCommandes(
        totalPages,
        total,
        debut,
        Math.min(fin, total)
    );
}


function creerLigneCommandeHTML(commande) {
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

    const lieu =
        [
            commande.communeLivraison,
            commande.zoneLivraison
        ]
            .filter(Boolean)
            .join(" • ") ||
        "—";

    return `
        <tr>
            <td>
                <input
                    type="checkbox"
                    aria-label="Sélectionner la commande"
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
                        commande.statut ||
                        "—"
                    )}
                </span>
            </td>

            <td>
                <div class="table-actions">
                    <button
                        type="button"
                        class="table-action-btn edit-btn"
                        data-edit-order="${echapperHTMLCommande(
                            commande.idCommande
                        )}"
                        title="Modifier"
                    >
                        ✏️
                    </button>

                    <button
                        type="button"
                        class="table-action-btn delete-btn"
                        data-delete-order="${echapperHTMLCommande(
                            commande.idCommande
                        )}"
                        title="Supprimer"
                    >
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `;
}


function gererActionsTableauCommandes(event) {
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

    commandeEnModificationId =
        commande.idCommande;

    definirValeurCommande(
        "order-id",
        commande.idCommande
    );

    definirValeurCommande(
        "order-number",
        commande.numeroCommande
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
        "order-comment",
        commande.commentaire
    );

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


function mettreAJourKPICommandes() {
    const total =
        commandesChargees.length;

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
                    statut === "terminee" ||
                    statut === "livree"
                );
            }
        ).length;

    const correspondances = {
        "total-orders-value": total,
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
                element.textContent =
                    valeur;
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
    const formulaire =
        document.getElementById(
            "order-form"
        );

    formulaire?.reset();

    commandeEnModificationId = null;
    lignesCommande = [];

    definirValeurCommande(
        "order-id",
        ""
    );

    definirValeurCommande(
        "order-number",
        "Génération automatique..."
    );

    definirValeurCommande(
        "order-status",
        "en-attente"
    );

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
                    stockDisponible:
                        stockParProduit.has(id)
                            ? stockParProduit.get(id)
                            : 0
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

    champQuantite.max = String(stock);

    if (stock <= 0) return false;

    if (quantite > stock) {
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
        champQuantite.max = String(stock);
    }
    if (boutonAjouter) boutonAjouter.disabled = stock <= 0;

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

    if (stockDisponible <= 0) {
        afficherMessageCommande(
            "Ce produit est en rupture de stock.",
            "error"
        );
        return;
    }

    /*
     * Si le produit existe déjà dans la commande,
     * on tient compte de la quantité déjà ajoutée.
     */
    const indexExistant =
        lignesCommande.findIndex(
            ligne =>
                String(
                    ligne.idProduit
                ) === idProduit
        );

    const quantiteDejaAjoutee =
        indexExistant >= 0
            ? Math.max(
                0,
                Math.trunc(
                    convertirNombre(
                        lignesCommande[
                            indexExistant
                        ].quantite
                    )
                )
            )
            : 0;

    const nouvelleQuantite =
        quantiteDejaAjoutee +
        quantite;

    if (
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
            indexExistant >= 0
                ? lignesCommande[
                    indexExistant
                ].idLigne
                : (
                    crypto.randomUUID?.() ||
                    String(Date.now())
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

    afficherMessageCommande(
        indexExistant >= 0
            ? "La quantité du produit a été mise à jour."
            : "Produit ajouté à la commande.",
        "success"
    );
}


function supprimerLigneCommande(idLigne) {
    lignesCommande = lignesCommande.filter(ligne => String(ligne.idLigne) !== String(idLigne));
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
                <button type="button" class="table-action-btn delete-btn" data-remove-order-line="${echapperHTMLCommande(ligne.idLigne)}" aria-label="Retirer le produit">🗑️</button>
            </td>
        </tr>
    `).join("");
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
    const fraisLivraison = convertirNombre(document.getElementById("order-delivery-fees")?.value);
    const totalAPayer = Math.max(0, totalCommande - remiseTotale + fraisLivraison);

    definirValeurCommande("order-total", totalCommande || "");
    definirValeurCommande("order-total-payable", totalAPayer || "");
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
    return Math.round(convertirNombre(valeur)).toLocaleString("fr-FR") + " FCFA";
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
