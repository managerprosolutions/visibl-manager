/* ===========================================================
   VISIBL ERP — MODULE LIVREURS
=========================================================== */

let livreursCharges = [];
let livreursFiltres = [];
let livreurEnModificationId = null;
let livreurASupprimer = null;

let pageLivreursActuelle = 1;
let taillePageLivreurs = 10;


/* ===========================================================
   INITIALISATION
=========================================================== */

function initialiserLivreurs() {
    if (
        typeof requireAuth === "function" &&
        !requireAuth()
    ) {
        return;
    }

    initialiserDeconnexionLivreurs();
    initialiserModalesLivreurs();
    initialiserFormulaireLivreur();
    initialiserFiltresLivreurs();
    initialiserPaginationLivreurs();
    initialiserActionsLivreurs();
    initialiserCapaciteTransport();
    chargerLivreurs();
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserLivreurs
    );
} else {
    initialiserLivreurs();
}


/* ===========================================================
   DÉCONNEXION
=========================================================== */

function initialiserDeconnexionLivreurs() {
    const bouton =
        document.getElementById(
            "logout-button"
        );

    if (!bouton) {
        return;
    }

    if (
        bouton.dataset.logoutInitialized ===
        "true"
    ) {
        return;
    }

    bouton.dataset.logoutInitialized =
        "true";

    bouton.addEventListener(
        "click",
        event => {
            event.preventDefault();

            if (
                typeof logoutUser ===
                "function"
            ) {
                logoutUser();
            }
        }
    );
}


/* ===========================================================
   MODALES
=========================================================== */

function initialiserModalesLivreurs() {
    const boutonsOuvrir = [
        document.getElementById(
            "new-driver-btn"
        ),
        document.getElementById(
            "new-driver-toolbar-btn"
        )
    ].filter(Boolean);

    boutonsOuvrir.forEach(
        bouton => {
            bouton.addEventListener(
                "click",
                ouvrirNouveauLivreur
            );
        }
    );

    document
        .getElementById(
            "close-driver-modal"
        )
        ?.addEventListener(
            "click",
            fermerModaleLivreur
        );

    document
        .getElementById(
            "cancel-driver-btn"
        )
        ?.addEventListener(
            "click",
            fermerModaleLivreur
        );

    document
        .getElementById(
            "close-view-driver-modal"
        )
        ?.addEventListener(
            "click",
            fermerModaleVoirLivreur
        );

    document
        .getElementById(
            "close-view-driver-footer"
        )
        ?.addEventListener(
            "click",
            fermerModaleVoirLivreur
        );

    document
        .getElementById(
            "cancel-delete-driver-btn"
        )
        ?.addEventListener(
            "click",
            fermerModaleSuppressionLivreur
        );

    document
        .getElementById(
            "confirm-delete-driver-btn"
        )
        ?.addEventListener(
            "click",
            confirmerSuppressionLivreur
        );

    [
        "driver-modal",
        "view-driver-modal",
        "delete-driver-modal"
    ].forEach(id => {
        document
            .getElementById(id)
            ?.addEventListener(
                "click",
                event => {
                    if (
                        event.target.id !== id
                    ) {
                        return;
                    }

                    if (
                        id ===
                        "driver-modal"
                    ) {
                        fermerModaleLivreur();
                    }

                    if (
                        id ===
                        "view-driver-modal"
                    ) {
                        fermerModaleVoirLivreur();
                    }

                    if (
                        id ===
                        "delete-driver-modal"
                    ) {
                        fermerModaleSuppressionLivreur();
                    }
                }
            );
    });

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            fermerModaleLivreur();
            fermerModaleVoirLivreur();
            fermerModaleSuppressionLivreur();
        }
    );
}


function ouvrirModaleLivreur() {
    const modal =
        document.getElementById(
            "driver-modal"
        );

    if (!modal) {
        return;
    }

    modal.classList.add("active");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

    setTimeout(() => {
        document
            .getElementById(
                "driver-lastname"
            )
            ?.focus();
    }, 50);
}


function fermerModaleLivreur() {
    const modal =
        document.getElementById(
            "driver-modal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );

    masquerMessageFormulaireLivreur();
}


function ouvrirModaleVoirLivreur() {
    const modal =
        document.getElementById(
            "view-driver-modal"
        );

    if (!modal) {
        return;
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


function fermerModaleVoirLivreur() {
    const modal =
        document.getElementById(
            "view-driver-modal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );
}


function ouvrirModaleSuppressionLivreur(
    livreur
) {
    livreurASupprimer =
        livreur;

    const modal =
        document.getElementById(
            "delete-driver-modal"
        );

    const nom =
        document.getElementById(
            "delete-driver-name"
        );

    if (
        !modal ||
        !nom
    ) {
        return;
    }

    nom.textContent =
        obtenirNomCompletLivreur(
            livreur
        ) ||
        livreur.idLivreur ||
        "ce livreur";

    modal.classList.add("active");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function fermerModaleSuppressionLivreur() {
    const modal =
        document.getElementById(
            "delete-driver-modal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );

    livreurASupprimer = null;
}


/* ===========================================================
   FORMULAIRE
=========================================================== */

function initialiserFormulaireLivreur() {
    document
        .getElementById(
            "driver-form"
        )
        ?.addEventListener(
            "submit",
            enregistrerLivreur
        );
}


function ouvrirNouveauLivreur() {
    livreurEnModificationId = null;

    const formulaire =
        document.getElementById(
            "driver-form"
        );

    formulaire?.reset();

    decocherToutesZonesLivreur();

    definirValeurLivreur(
        "driver-status",
        "Actif"
    );

    definirValeurLivreur(
        "driver-capacity",
        ""
    );

    const titre =
        document.getElementById(
            "driver-modal-title"
        );

    const bouton =
        document.getElementById(
            "save-driver-btn"
        );

    if (titre) {
        titre.textContent =
            "Nouveau livreur";
    }

    if (bouton) {
        bouton.textContent =
            "Enregistrer le livreur";
    }

    masquerMessageFormulaireLivreur();
    ouvrirModaleLivreur();
}


function remplirFormulaireLivreur(
    livreur
) {
    definirValeurLivreur(
        "driver-id",
        livreur.idLivreur
    );

    definirValeurLivreur(
        "driver-lastname",
        livreur.nom
    );

    definirValeurLivreur(
        "driver-firstname",
        livreur.prenom
    );

    definirValeurLivreur(
        "driver-phone",
        livreur.telephone
    );

    definirValeurLivreur(
        "driver-secondary-phone",
        livreur.telephoneSecondaire
    );

    definirValeurLivreur(
        "driver-email",
        livreur.email
    );

    definirValeurLivreur(
        "driver-address",
        livreur.adresse
    );

    definirValeurLivreur(
        "driver-type",
        livreur.typeLivreur
    );

    definirValeurLivreur(
        "driver-transport",
        livreur.moyenTransport
    );

    definirValeurLivreur(
        "driver-capacity",
        livreur.capaciteMaximale
    );

    definirValeurLivreur(
        "driver-registration",
        livreur.immatriculation
    );

    definirValeurLivreur(
        "driver-id-type",
        livreur.typePiece
    );

    definirValeurLivreur(
        "driver-id-number",
        livreur.numeroPiece
    );

    definirValeurLivreur(
        "driver-start-date",
        livreur.dateDebut
    );

    definirValeurLivreur(
        "driver-status",
        livreur.statut ||
        "Actif"
    );

    definirValeurLivreur(
        "driver-comment",
        livreur.commentaire
    );

    cocherZonesLivreur(
        livreur.zonesLivraison ||
        livreur.zoneLivraison
    );
}


async function enregistrerLivreur(
    event
) {
    event.preventDefault();

    const formulaire =
        document.getElementById(
            "driver-form"
        );

    const bouton =
        document.getElementById(
            "save-driver-btn"
        );

    if (!formulaire) {
        return;
    }

    if (
        !formulaire.checkValidity()
    ) {
        formulaire.reportValidity();
        return;
    }

    const zones =
        obtenirZonesSelectionneesLivreur();

    if (!zones.length) {
        afficherMessageFormulaireLivreur(
            "Sélectionnez au moins une zone de livraison.",
            "error"
        );
        return;
    }

    const donnees = {
        idLivreur:
            livreurEnModificationId ||
            "",

        nom:
            obtenirValeurLivreur(
                "driver-lastname"
            ),

        prenom:
            obtenirValeurLivreur(
                "driver-firstname"
            ),

        telephone:
            obtenirValeurLivreur(
                "driver-phone"
            ),

        telephoneSecondaire:
            obtenirValeurLivreur(
                "driver-secondary-phone"
            ),

        email:
            obtenirValeurLivreur(
                "driver-email"
            ),

        adresse:
            obtenirValeurLivreur(
                "driver-address"
            ),

        zonesLivraison:
            zones,

        zoneLivraison:
            zones.join(", "),

        typeLivreur:
            obtenirValeurLivreur(
                "driver-type"
            ),

        moyenTransport:
            obtenirValeurLivreur(
                "driver-transport"
            ),

        capaciteMaximale:
            obtenirValeurLivreur(
                "driver-capacity"
            ),

        immatriculation:
            obtenirValeurLivreur(
                "driver-registration"
            ),

        typePiece:
            obtenirValeurLivreur(
                "driver-id-type"
            ),

        numeroPiece:
            obtenirValeurLivreur(
                "driver-id-number"
            ),

        dateDebut:
            obtenirValeurLivreur(
                "driver-start-date"
            ),

        statut:
            obtenirValeurLivreur(
                "driver-status"
            ),

        commentaire:
            obtenirValeurLivreur(
                "driver-comment"
            )
    };

    const action =
        livreurEnModificationId
            ? "updateLivreur"
            : "createLivreur";

    try {
        if (bouton) {
            bouton.disabled = true;
            bouton.textContent =
                livreurEnModificationId
                    ? "Modification..."
                    : "Enregistrement...";
        }

        afficherMessageFormulaireLivreur(
            "Traitement en cours...",
            "info"
        );

        const resultat =
            await apiPost(
                action,
                donnees
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le livreur."
            );
        }

        if (
            typeof showToast ===
            "function"
        ) {
            showToast(
                resultat.message,
                "success"
            );
        }

        await chargerLivreurs();
        fermerModaleLivreur();

    } catch (error) {
        console.error(
            "Erreur enregistrement livreur :",
            error
        );

        afficherMessageFormulaireLivreur(
            error.message ||
            "Une erreur est survenue.",
            "error"
        );

    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.textContent =
                livreurEnModificationId
                    ? "Enregistrer les modifications"
                    : "Enregistrer le livreur";
        }
    }
}


/* ===========================================================
   CAPACITÉ PAR TRANSPORT
=========================================================== */

function initialiserCapaciteTransport() {
    document
        .getElementById(
            "driver-transport"
        )
        ?.addEventListener(
            "change",
            event => {
                const capacites = {
                    "À pied": 5,
                    "Vélo": 10,
                    "Moto": 20,
                    "Tricycle": 35,
                    "Voiture": 40,
                    "Camionnette": 80
                };

                const valeur =
                    capacites[
                        event.target.value
                    ];

                if (
                    valeur !==
                    undefined
                ) {
                    definirValeurLivreur(
                        "driver-capacity",
                        valeur
                    );
                }
            }
        );
}


/* ===========================================================
   CHARGEMENT
=========================================================== */

async function chargerLivreurs() {
    const tbody =
        document.getElementById(
            "drivers-table-body"
        );

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-table">
                    Chargement des livreurs...
                </td>
            </tr>
        `;
    }

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

        livreursCharges =
            Array.isArray(
                resultat.data
            )
                ? resultat.data
                : Array.isArray(
                    resultat.livreurs
                )
                    ? resultat.livreurs
                    : [];

        mettreAJourKPILivreurs();
        appliquerFiltresLivreurs();

    } catch (error) {
        console.error(
            "Erreur chargement livreurs :",
            error
        );

        livreursCharges = [];
        livreursFiltres = [];

        afficherTableauLivreurs();

        if (
            typeof showToast ===
            "function"
        ) {
            showToast(
                error.message ||
                "Impossible de charger les livreurs.",
                "error"
            );
        }
    }
}


/* ===========================================================
   FILTRES ET RECHERCHE
=========================================================== */

function initialiserFiltresLivreurs() {
    document
        .getElementById(
            "drivers-search-input"
        )
        ?.addEventListener(
            "input",
            appliquerFiltresLivreurs
        );

    document
        .getElementById(
            "header-drivers-search-input"
        )
        ?.addEventListener(
            "input",
            synchroniserRechercheLivreurs
        );

    document
        .getElementById(
            "header-drivers-search-btn"
        )
        ?.addEventListener(
            "click",
            appliquerFiltresLivreurs
        );

    [
        "driver-status-filter",
        "driver-type-filter",
        "driver-transport-filter"
    ].forEach(id => {
        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                appliquerFiltresLivreurs
            );
    });

    document
        .getElementById(
            "reset-driver-filters"
        )
        ?.addEventListener(
            "click",
            reinitialiserFiltresLivreurs
        );
}


function synchroniserRechercheLivreurs(
    event
) {
    const champ =
        document.getElementById(
            "drivers-search-input"
        );

    if (champ) {
        champ.value =
            event.target.value;
    }

    appliquerFiltresLivreurs();
}


function appliquerFiltresLivreurs() {
    const recherche =
        normaliserTexteLivreurFrontend(
            obtenirValeurLivreur(
                "drivers-search-input"
            )
        );

    const statut =
        normaliserTexteLivreurFrontend(
            obtenirValeurLivreur(
                "driver-status-filter"
            )
        );

    const type =
        normaliserTexteLivreurFrontend(
            obtenirValeurLivreur(
                "driver-type-filter"
            )
        );

    const transport =
        normaliserTexteLivreurFrontend(
            obtenirValeurLivreur(
                "driver-transport-filter"
            )
        );

    livreursFiltres =
        livreursCharges.filter(
            livreur => {
                const texte = [
                    livreur.idLivreur,
                    livreur.nom,
                    livreur.prenom,
                    livreur.telephone,
                    livreur.telephoneSecondaire,
                    livreur.email,
                    livreur.adresse,
                    livreur.zoneLivraison,
                    livreur.typeLivreur,
                    livreur.moyenTransport,
                    livreur.immatriculation,
                    livreur.numeroPiece,
                    livreur.statut
                ]
                    .map(
                        normaliserTexteLivreurFrontend
                    )
                    .join(" ");

                const correspondRecherche =
                    !recherche ||
                    texte.includes(
                        recherche
                    );

                const correspondStatut =
                    !statut ||
                    normaliserTexteLivreurFrontend(
                        livreur.statut
                    ) === statut;

                const correspondType =
                    !type ||
                    normaliserTexteLivreurFrontend(
                        livreur.typeLivreur
                    ) === type;

                const correspondTransport =
                    !transport ||
                    normaliserTexteLivreurFrontend(
                        livreur.moyenTransport
                    ) === transport;

                return (
                    correspondRecherche &&
                    correspondStatut &&
                    correspondType &&
                    correspondTransport
                );
            }
        );

    pageLivreursActuelle = 1;
    afficherTableauLivreurs();
}


function reinitialiserFiltresLivreurs() {
    [
        "drivers-search-input",
        "header-drivers-search-input",
        "driver-status-filter",
        "driver-type-filter",
        "driver-transport-filter"
    ].forEach(id => {
        definirValeurLivreur(
            id,
            ""
        );
    });

    appliquerFiltresLivreurs();
}


/* ===========================================================
   TABLEAU
=========================================================== */

function afficherTableauLivreurs() {
    const tbody =
        document.getElementById(
            "drivers-table-body"
        );

    if (!tbody) {
        return;
    }

    const total =
        livreursFiltres.length;

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total /
                taillePageLivreurs
            )
        );

    pageLivreursActuelle =
        Math.min(
            pageLivreursActuelle,
            totalPages
        );

    const debut =
        (
            pageLivreursActuelle -
            1
        ) *
        taillePageLivreurs;

    const fin =
        debut +
        taillePageLivreurs;

    const page =
        livreursFiltres.slice(
            debut,
            fin
        );

    if (!page.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-table">
                    Aucun livreur ne correspond aux critères.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML =
            page
                .map(
                    creerLigneLivreurHTML
                )
                .join("");
    }

    definirTexteLivreur(
        "filtered-driver-count",
        total
    );

    afficherPaginationLivreurs(
        totalPages,
        total,
        debut,
        Math.min(
            fin,
            total
        )
    );
}


function creerLigneLivreurHTML(
    livreur
) {
    const nomComplet =
        obtenirNomCompletLivreur(
            livreur
        );

    const initiales =
        obtenirInitialesLivreur(
            livreur
        );

    const zones =
        obtenirZonesLivreur(
            livreur
        );

    const statutClasse =
        obtenirClasseStatutLivreur(
            livreur.statut
        );

    return `
        <tr>
            <td>
                <strong>
                    ${echapperHTMLLivreur(livreur.idLivreur)}
                </strong>
            </td>

            <td>
                <div class="driver-identity">

                    <span class="driver-avatar">
                        ${echapperHTMLLivreur(initiales)}
                    </span>

                    <div class="driver-name-block">

                        <strong>
                            ${echapperHTMLLivreur(nomComplet)}
                        </strong>

                        <span>
                            ${echapperHTMLLivreur(livreur.email || "Sans email")}
                        </span>

                    </div>

                </div>
            </td>

            <td>
                ${echapperHTMLLivreur(livreur.telephone || "—")}
            </td>

            <td>
                <div class="zone-tags">
                    ${
                        zones.length
                            ? zones
                                .slice(0, 3)
                                .map(zone => `
                                    <span class="zone-tag">
                                        ${echapperHTMLLivreur(zone)}
                                    </span>
                                `)
                                .join("")
                            : "—"
                    }
                    ${
                        zones.length > 3
                            ? `
                                <span class="zone-tag">
                                    +${zones.length - 3}
                                </span>
                            `
                            : ""
                    }
                </div>
            </td>

            <td>
                <span class="type-badge">
                    ${echapperHTMLLivreur(livreur.typeLivreur || "—")}
                </span>
            </td>

            <td>
                ${echapperHTMLLivreur(livreur.moyenTransport || "—")}
            </td>

            <td>
                <span class="capacity-badge">
                    ${formaterNombreLivreur(livreur.capaciteMaximale)}
                </span>
            </td>

            <td>
                ${formaterNombreLivreur(livreur.nombreLivraisons)}
            </td>

            <td>
                ${formaterMontantLivreur(livreur.montantTotalEncaisse)}
            </td>

            <td>
                <span class="status-badge ${statutClasse}">
                    ${echapperHTMLLivreur(livreur.statut || "—")}
                </span>
            </td>

            <td>
                <div class="table-actions">

                    <button
                        class="action-btn view-btn"
                        type="button"
                        title="Voir"
                        data-view-driver="${echapperAttributLivreur(livreur.idLivreur)}"
                    >
                        👁
                    </button>

                    <button
                        class="action-btn edit-btn"
                        type="button"
                        title="Modifier"
                        data-edit-driver="${echapperAttributLivreur(livreur.idLivreur)}"
                    >
                        ✏️
                    </button>

                    <button
                        class="action-btn delete-btn"
                        type="button"
                        title="Supprimer"
                        data-delete-driver="${echapperAttributLivreur(livreur.idLivreur)}"
                    >
                        🗑️
                    </button>

                </div>
            </td>
        </tr>
    `;
}


/* ===========================================================
   ACTIONS TABLEAU
=========================================================== */

function initialiserActionsLivreurs() {
    document
        .getElementById(
            "drivers-table-body"
        )
        ?.addEventListener(
            "click",
            event => {
                const boutonVoir =
                    event.target.closest(
                        "[data-view-driver]"
                    );

                if (boutonVoir) {
                    voirLivreur(
                        boutonVoir.dataset
                            .viewDriver
                    );
                    return;
                }

                const boutonModifier =
                    event.target.closest(
                        "[data-edit-driver]"
                    );

                if (boutonModifier) {
                    modifierLivreur(
                        boutonModifier.dataset
                            .editDriver
                    );
                    return;
                }

                const boutonSupprimer =
                    event.target.closest(
                        "[data-delete-driver]"
                    );

                if (boutonSupprimer) {
                    supprimerLivreur(
                        boutonSupprimer.dataset
                            .deleteDriver
                    );
                }
            }
        );

    document
        .getElementById(
            "refresh-drivers-btn"
        )
        ?.addEventListener(
            "click",
            chargerLivreurs
        );

    document
        .getElementById(
            "print-drivers-btn"
        )
        ?.addEventListener(
            "click",
            () => window.print()
        );

    document
        .getElementById(
            "export-drivers-btn"
        )
        ?.addEventListener(
            "click",
            exporterLivreursCSV
        );
}


function trouverLivreurParId(
    idLivreur
) {
    return (
        livreursCharges.find(
            livreur =>
                String(
                    livreur.idLivreur
                ) ===
                String(
                    idLivreur
                )
        ) ||
        null
    );
}


function voirLivreur(
    idLivreur
) {
    const livreur =
        trouverLivreurParId(
            idLivreur
        );

    if (!livreur) {
        return;
    }

    const contenu =
        document.getElementById(
            "driver-details-content"
        );

    if (!contenu) {
        return;
    }

    const zones =
        obtenirZonesLivreur(
            livreur
        ).join(", ");

    const details = [
        ["ID Livreur", livreur.idLivreur],
        ["Nom complet", obtenirNomCompletLivreur(livreur)],
        ["Téléphone", livreur.telephone],
        ["Téléphone secondaire", livreur.telephoneSecondaire],
        ["Email", livreur.email],
        ["Adresse", livreur.adresse],
        ["Zones de livraison", zones],
        ["Type de livreur", livreur.typeLivreur],
        ["Moyen de transport", livreur.moyenTransport],
        ["Capacité maximale", formaterNombreLivreur(livreur.capaciteMaximale)],
        ["Immatriculation", livreur.immatriculation],
        ["Type de pièce", livreur.typePiece],
        ["Numéro de pièce", livreur.numeroPiece],
        ["Nombre de livraisons", formaterNombreLivreur(livreur.nombreLivraisons)],
        ["Montant total encaissé", formaterMontantLivreur(livreur.montantTotalEncaisse)],
        ["Écart total", formaterMontantLivreur(livreur.ecartTotal)],
        ["Date de début", formaterDateAffichageLivreur(livreur.dateDebut)],
        ["Date d’ajout", formaterDateAffichageLivreur(livreur.dateAjout)],
        ["Dernière livraison", formaterDateAffichageLivreur(livreur.derniereLivraison)],
        ["Statut", livreur.statut],
        ["Commentaire", livreur.commentaire]
    ];

    contenu.innerHTML =
        details
            .map(
                ([libelle, valeur], index) => `
                    <div class="driver-detail-card ${
                        index === details.length - 1
                            ? "driver-detail-card-full"
                            : ""
                    }">
                        <span>
                            ${echapperHTMLLivreur(libelle)}
                        </span>
                        <strong>
                            ${echapperHTMLLivreur(valeur || "—")}
                        </strong>
                    </div>
                `
            )
            .join("");

    ouvrirModaleVoirLivreur();
}


function modifierLivreur(
    idLivreur
) {
    const livreur =
        trouverLivreurParId(
            idLivreur
        );

    if (!livreur) {
        return;
    }

    livreurEnModificationId =
        livreur.idLivreur;

    remplirFormulaireLivreur(
        livreur
    );

    const titre =
        document.getElementById(
            "driver-modal-title"
        );

    const bouton =
        document.getElementById(
            "save-driver-btn"
        );

    if (titre) {
        titre.textContent =
            "Modifier le livreur";
    }

    if (bouton) {
        bouton.textContent =
            "Enregistrer les modifications";
    }

    masquerMessageFormulaireLivreur();
    ouvrirModaleLivreur();
}


function supprimerLivreur(
    idLivreur
) {
    const livreur =
        trouverLivreurParId(
            idLivreur
        );

    if (!livreur) {
        return;
    }

    ouvrirModaleSuppressionLivreur(
        livreur
    );
}


async function confirmerSuppressionLivreur() {
    if (!livreurASupprimer) {
        return;
    }

    const bouton =
        document.getElementById(
            "confirm-delete-driver-btn"
        );

    try {
        if (bouton) {
            bouton.disabled = true;
            bouton.textContent =
                "Suppression...";
        }

        const resultat =
            await apiPost(
                "deleteLivreur",
                {
                    idLivreur:
                        livreurASupprimer
                            .idLivreur
                }
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de supprimer le livreur."
            );
        }

        if (
            typeof showToast ===
            "function"
        ) {
            showToast(
                resultat.message,
                "success"
            );
        }

        fermerModaleSuppressionLivreur();
        await chargerLivreurs();

    } catch (error) {
        console.error(
            "Erreur suppression livreur :",
            error
        );

        if (
            typeof showToast ===
            "function"
        ) {
            showToast(
                error.message ||
                "Impossible de supprimer le livreur.",
                "error"
            );
        }

    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.textContent =
                "Supprimer";
        }
    }
}


/* ===========================================================
   KPI
=========================================================== */

function mettreAJourKPILivreurs() {
    const total =
        livreursCharges.length;

    const actifs =
        livreursCharges.filter(
            livreur =>
                normaliserTexteLivreurFrontend(
                    livreur.statut
                ) ===
                "actif"
        ).length;

    const livraisons =
        livreursCharges.reduce(
            (total, livreur) =>
                total +
                convertirNombreLivreurFrontend(
                    livreur.nombreLivraisons
                ),
            0
        );

    const montant =
        livreursCharges.reduce(
            (total, livreur) =>
                total +
                convertirNombreLivreurFrontend(
                    livreur.montantTotalEncaisse
                ),
            0
        );

    definirTexteLivreur(
        "total-drivers-value",
        formaterNombreLivreur(total)
    );

    definirTexteLivreur(
        "active-drivers-value",
        formaterNombreLivreur(actifs)
    );

    definirTexteLivreur(
        "active-drivers-description",
        total
            ? `${Math.round(
                actifs /
                total *
                100
            )} % des livreurs`
            : "0 % des livreurs"
    );

    definirTexteLivreur(
        "total-deliveries-value",
        formaterNombreLivreur(
            livraisons
        )
    );

    definirTexteLivreur(
        "total-collected-value",
        formaterMontantLivreur(
            montant
        )
    );
}


/* ===========================================================
   PAGINATION
=========================================================== */

function initialiserPaginationLivreurs() {
    document
        .getElementById(
            "drivers-per-page"
        )
        ?.addEventListener(
            "change",
            event => {
                taillePageLivreurs =
                    Math.max(
                        1,
                        Number(
                            event.target.value
                        ) ||
                        10
                    );

                pageLivreursActuelle = 1;
                afficherTableauLivreurs();
            }
        );

    document
        .getElementById(
            "previous-driver-page-btn"
        )
        ?.addEventListener(
            "click",
            () => {
                if (
                    pageLivreursActuelle >
                    1
                ) {
                    pageLivreursActuelle--;
                    afficherTableauLivreurs();
                }
            }
        );

    document
        .getElementById(
            "next-driver-page-btn"
        )
        ?.addEventListener(
            "click",
            () => {
                const totalPages =
                    Math.max(
                        1,
                        Math.ceil(
                            livreursFiltres.length /
                            taillePageLivreurs
                        )
                    );

                if (
                    pageLivreursActuelle <
                    totalPages
                ) {
                    pageLivreursActuelle++;
                    afficherTableauLivreurs();
                }
            }
        );
}


function afficherPaginationLivreurs(
    totalPages,
    total,
    debut,
    fin
) {
    const precedent =
        document.getElementById(
            "previous-driver-page-btn"
        );

    const suivant =
        document.getElementById(
            "next-driver-page-btn"
        );

    const boutons =
        document.getElementById(
            "drivers-page-buttons"
        );

    if (precedent) {
        precedent.disabled =
            pageLivreursActuelle <=
            1;
    }

    if (suivant) {
        suivant.disabled =
            pageLivreursActuelle >=
            totalPages;
    }

    if (boutons) {
        boutons.innerHTML = "";

        const pages =
            calculerPagesVisiblesLivreurs(
                totalPages,
                pageLivreursActuelle
            );

        pages.forEach(page => {
            const bouton =
                document.createElement(
                    "button"
                );

            bouton.type =
                "button";

            bouton.className =
                "pagination-btn";

            bouton.textContent =
                page;

            if (
                page ===
                pageLivreursActuelle
            ) {
                bouton.classList.add(
                    "active"
                );
            }

            bouton.addEventListener(
                "click",
                () => {
                    pageLivreursActuelle =
                        page;

                    afficherTableauLivreurs();
                }
            );

            boutons.appendChild(
                bouton
            );
        });
    }

    definirTexteLivreur(
        "drivers-pagination-summary",
        total
            ? `${debut + 1}-${fin} sur ${total}`
            : "0 résultat"
    );
}


function calculerPagesVisiblesLivreurs(
    totalPages,
    pageActuelle
) {
    const pages = [];

    const debut =
        Math.max(
            1,
            pageActuelle - 2
        );

    const fin =
        Math.min(
            totalPages,
            debut + 4
        );

    for (
        let page = debut;
        page <= fin;
        page++
    ) {
        pages.push(page);
    }

    return pages;
}


/* ===========================================================
   EXPORT CSV
=========================================================== */

function exporterLivreursCSV() {
    if (!livreursFiltres.length) {
        if (
            typeof showToast ===
            "function"
        ) {
            showToast(
                "Aucun livreur à exporter.",
                "error"
            );
        }

        return;
    }

    const entetes = [
        "ID Livreur",
        "Nom",
        "Prénom",
        "Téléphone",
        "Téléphone Secondaire",
        "Email",
        "Adresse",
        "Zone de Livraison",
        "Type de Livreur",
        "Moyen de Transport",
        "Capacité Maximale",
        "Immatriculation",
        "Type de Pièce",
        "Numéro de Pièce",
        "Nombre de Livraisons",
        "Montant Total Encaissé",
        "Écart Total",
        "Date de Début",
        "Date d’Ajout",
        "Dernière Livraison",
        "Statut",
        "Commentaire"
    ];

    const lignes =
        livreursFiltres.map(
            livreur => [
                livreur.idLivreur,
                livreur.nom,
                livreur.prenom,
                livreur.telephone,
                livreur.telephoneSecondaire,
                livreur.email,
                livreur.adresse,
                livreur.zoneLivraison,
                livreur.typeLivreur,
                livreur.moyenTransport,
                livreur.capaciteMaximale,
                livreur.immatriculation,
                livreur.typePiece,
                livreur.numeroPiece,
                livreur.nombreLivraisons,
                livreur.montantTotalEncaisse,
                livreur.ecartTotal,
                livreur.dateDebut,
                livreur.dateAjout,
                livreur.derniereLivraison,
                livreur.statut,
                livreur.commentaire
            ]
        );

    const csv = [
        entetes,
        ...lignes
    ]
        .map(
            ligne =>
                ligne
                    .map(
                        cellule =>
                            `"${String(
                                cellule ??
                                ""
                            )
                                .replaceAll(
                                    '"',
                                    '""'
                                )}"`
                    )
                    .join(";")
        )
        .join("\n");

    const blob =
        new Blob(
            [
                "\uFEFF" +
                csv
            ],
            {
                type:
                    "text/csv;charset=utf-8"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const lien =
        document.createElement(
            "a"
        );

    lien.href = url;
    lien.download =
        `livreurs_${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;

    document.body.appendChild(
        lien
    );

    lien.click();
    lien.remove();

    URL.revokeObjectURL(
        url
    );
}


/* ===========================================================
   ZONES
=========================================================== */

function obtenirZonesSelectionneesLivreur() {
    return Array
        .from(
            document.querySelectorAll(
                '#driver-zones-group input[type="checkbox"]:checked'
            )
        )
        .map(
            caseZone =>
                caseZone.value
                    .trim()
        )
        .filter(Boolean);
}


function decocherToutesZonesLivreur() {
    document
        .querySelectorAll(
            '#driver-zones-group input[type="checkbox"]'
        )
        .forEach(
            caseZone => {
                caseZone.checked = false;
            }
        );
}


function cocherZonesLivreur(
    zones
) {
    decocherToutesZonesLivreur();

    const liste =
        Array.isArray(zones)
            ? zones
            : String(
                zones ||
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

    const normalisees =
        liste.map(
            normaliserTexteLivreurFrontend
        );

    document
        .querySelectorAll(
            '#driver-zones-group input[type="checkbox"]'
        )
        .forEach(
            caseZone => {
                caseZone.checked =
                    normalisees.includes(
                        normaliserTexteLivreurFrontend(
                            caseZone.value
                        )
                    );
            }
        );
}


function obtenirZonesLivreur(
    livreur
) {
    if (
        Array.isArray(
            livreur.zonesLivraison
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
        livreur.zoneLivraison ||
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


/* ===========================================================
   MESSAGES
=========================================================== */

function afficherMessageFormulaireLivreur(
    message,
    type = "info"
) {
    const zone =
        document.getElementById(
            "driver-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent =
        message;

    zone.className =
        `form-message ${type} show`;
}


function masquerMessageFormulaireLivreur() {
    const zone =
        document.getElementById(
            "driver-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent = "";
    zone.className =
        "form-message";
}


/* ===========================================================
   OUTILS
=========================================================== */

function obtenirNomCompletLivreur(
    livreur
) {
    return [
        livreur?.nom,
        livreur?.prenom
    ]
        .map(
            valeur =>
                String(
                    valeur ||
                    ""
                ).trim()
        )
        .filter(Boolean)
        .join(" ");
}


function obtenirInitialesLivreur(
    livreur
) {
    return [
        livreur?.nom,
        livreur?.prenom
    ]
        .map(
            valeur =>
                String(
                    valeur ||
                    ""
                )
                    .trim()
                    .charAt(0)
                    .toUpperCase()
        )
        .filter(Boolean)
        .join("")
        .slice(0, 2) ||
        "LV";
}


function obtenirClasseStatutLivreur(
    statut
) {
    const valeur =
        normaliserTexteLivreurFrontend(
            statut
        );

    if (
        valeur ===
        "actif"
    ) {
        return "status-active";
    }

    if (
        valeur ===
        "suspendu"
    ) {
        return "status-suspended";
    }

    if (
        valeur ===
        "archive"
    ) {
        return "status-archived";
    }

    return "status-inactive";
}


function obtenirValeurLivreur(
    id
) {
    const champ =
        document.getElementById(
            id
        );

    return champ
        ? String(
            champ.value ||
            ""
        ).trim()
        : "";
}


function definirValeurLivreur(
    id,
    valeur
) {
    const champ =
        document.getElementById(
            id
        );

    if (champ) {
        champ.value =
            valeur ??
            "";
    }
}


function definirTexteLivreur(
    id,
    valeur
) {
    const element =
        document.getElementById(
            id
        );

    if (element) {
        element.textContent =
            valeur ??
            "";
    }
}


function normaliserTexteLivreurFrontend(
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


function convertirNombreLivreurFrontend(
    valeur
) {
    const nombre =
        Number(
            String(
                valeur ??
                ""
            )
                .replace(
                    /\s/g,
                    ""
                )
                .replace(
                    ",",
                    "."
                )
        );

    return Number.isFinite(
        nombre
    )
        ? nombre
        : 0;
}


function formaterNombreLivreur(
    valeur
) {
    return Math.trunc(
        convertirNombreLivreurFrontend(
            valeur
        )
    ).toLocaleString(
        "fr-FR"
    );
}


function formaterMontantLivreur(
    valeur
) {
    return new Intl
        .NumberFormat(
            "fr-FR",
            {
                style:
                    "currency",
                currency:
                    "XOF",
                maximumFractionDigits:
                    0
            }
        )
        .format(
            convertirNombreLivreurFrontend(
                valeur
            )
        );
}


function formaterDateAffichageLivreur(
    valeur
) {
    if (!valeur) {
        return "—";
    }

    const date =
        new Date(
            valeur
        );

    if (
        isNaN(
            date.getTime()
        )
    ) {
        return String(
            valeur
        );
    }

    return new Intl
        .DateTimeFormat(
            "fr-FR"
        )
        .format(
            date
        );
}


function echapperHTMLLivreur(
    valeur
) {
    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        valeur ??
        "";

    return div.innerHTML;
}


function echapperAttributLivreur(
    valeur
) {
    return echapperHTMLLivreur(
        String(
            valeur ??
            ""
        )
    )
        .replaceAll(
            '"',
            "&quot;"
        );
}
