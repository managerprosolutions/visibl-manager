/* ===========================================================
   VISIBL ERP — MODULE LIVREURS
=========================================================== */

let livreursCharges = [];
let livreursFiltres = [];
let livreurEnModificationId = null;
let livreurASupprimer = null;

let pageLivreursActuelle = 1;
let taillePageLivreurs = 10;
let modeSelectionLivreurs = false;
const livreursSelectionnes = new Set();


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

    document.documentElement.classList.remove("visibl-auth-pending");
    initialiserDeconnexionLivreurs();
    initialiserModalesLivreurs();
    initialiserFormulaireLivreur();
    initialiserFiltresLivreurs();
    initialiserPaginationLivreurs();
    initialiserActionsLivreurs();
    initialiserSelectionLivreurs();
    initialiserMenuActionsLivreurs();
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
        formulaire.dataset.processing ===
        "true"
    ) {
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

    /*
     * Le verrou est activé uniquement après
     * toutes les validations. Ainsi, une erreur
     * de formulaire ne bloque pas les clics suivants.
     */
    formulaire.dataset.processing =
        "true";

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

        const livreurSauvegarde =
            resultat.data ||
            {
                ...donnees,
                idLivreur:
                    donnees.idLivreur ||
                    resultat.idLivreur ||
                    "",
                nombreLivraisons: 0,
                montantTotalEncaisse: 0,
                ecartTotal: 0,
                dateAjout:
                    new Date()
                        .toISOString()
                        .slice(0, 10),
                derniereLivraison: ""
            };

        mettreAJourLivreurLocal(
            livreurSauvegarde,
            Boolean(
                livreurEnModificationId
            )
        );

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
        formulaire.dataset.processing =
            "false";

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
                <td colspan="12" class="empty-table">
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

        actualiserFiltreZonesLivreurs();
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
        "driver-zone-filter"
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


function appliquerFiltresLivreurs(
    conserverPage = false
) {
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

    const zone =
        normaliserTexteLivreurFrontend(
            obtenirValeurLivreur(
                "driver-zone-filter"
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

                const zonesLivreur =
                    obtenirZonesLivreur(
                        livreur
                    ).map(
                        normaliserTexteLivreurFrontend
                    );

                const correspondZone =
                    !zone ||
                    zonesLivreur.includes(zone) ||
                    zonesLivreur.includes("toutes-les-zones") ||
                    zonesLivreur.includes("toutes-zones") ||
                    zonesLivreur.includes("toute-zone");

                return (
                    correspondRecherche &&
                    correspondStatut &&
                    correspondType &&
                    correspondZone
                );
            }
        );

    if (!conserverPage) {
        pageLivreursActuelle = 1;
    }

    afficherTableauLivreurs();
}



function actualiserFiltreZonesLivreurs() {
    const select =
        document.getElementById(
            "driver-zone-filter"
        );

    if (!select) {
        return;
    }

    const valeurActuelle =
        String(select.value || "").trim();

    const zones =
        Array.from(
            new Set(
                livreursCharges
                    .flatMap(
                        livreur =>
                            obtenirZonesLivreur(
                                livreur
                            )
                    )
                    .map(
                        zone =>
                            String(zone || "").trim()
                    )
                    .filter(Boolean)
            )
        )
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        "fr",
                        { sensitivity: "base" }
                    )
            );

    select.innerHTML =
        '<option value="">Toutes les zones</option>';

    zones.forEach(
        zone => {
            const option =
                document.createElement(
                    "option"
                );

            option.value = zone;
            option.textContent = zone;
            select.appendChild(option);
        }
    );

    if (
        valeurActuelle &&
        zones.some(
            zone =>
                normaliserTexteLivreurFrontend(zone) ===
                normaliserTexteLivreurFrontend(valeurActuelle)
        )
    ) {
        select.value = valeurActuelle;
    } else {
        select.value = "";
    }
}


function reinitialiserFiltresLivreurs() {
    [
        "drivers-search-input",
        "header-drivers-search-input",
        "driver-status-filter",
        "driver-type-filter",
        "driver-zone-filter"
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
                <td colspan="12" class="empty-table">
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


function creerLigneLivreurHTML(livreur) {
    const nomComplet=obtenirNomCompletLivreur(livreur);
    const initiales=obtenirInitialesLivreur(livreur);
    const zones=obtenirZonesLivreur(livreur);
    const statutClasse=obtenirClasseStatutLivreur(livreur.statut);
    const id=String(livreur.idLivreur||"");
    const checked=livreursSelectionnes.has(id)?"checked":"";
    const zonesHtml=zones.length
      ? `<div class="driver-row-menu zone-row-menu">
           <button class="driver-row-menu-trigger zone-row-menu-trigger" type="button" data-driver-zones-toggle="${echapperAttributLivreur(id)}" aria-expanded="false" title="Voir les zones">⋮ <span>${zones.length} zone${zones.length>1?"s":""}</span></button>
           <div class="driver-row-menu-dropdown zone-row-menu-dropdown" data-driver-zones-menu="${echapperAttributLivreur(id)}" hidden>
             ${zones.map(z=>`<span class="zone-menu-item">${echapperHTMLLivreur(z)}</span>`).join("")}
           </div>
         </div>`
      : "—";
    return `
      <tr class="${livreursSelectionnes.has(id)?"is-selected":""}">
        <td class="driver-selection-column"><input type="checkbox" data-select-driver="${echapperAttributLivreur(id)}" ${checked} aria-label="Sélectionner ${echapperAttributLivreur(nomComplet)}"></td>
        <td><strong>${echapperHTMLLivreur(id)}</strong></td>
        <td><div class="driver-identity"><span class="driver-avatar">${echapperHTMLLivreur(initiales)}</span><div class="driver-name-block"><strong>${echapperHTMLLivreur(nomComplet)}</strong></div></div></td>
        <td>${echapperHTMLLivreur(livreur.telephone||"—")}</td>
        <td>${zonesHtml}</td>
        <td><span class="type-badge">${echapperHTMLLivreur(livreur.typeLivreur||"—")}</span></td>
        <td>${echapperHTMLLivreur(livreur.moyenTransport||"—")}</td>
        <td><span class="capacity-badge">${formaterNombreLivreur(livreur.capaciteMaximale)}</span></td>
        <td>${formaterNombreLivreur(livreur.nombreLivraisons)}</td>
        <td>${formaterMontantLivreur(livreur.montantTotalEncaisse)}</td>
        <td><span class="status-badge ${statutClasse}">${echapperHTMLLivreur(livreur.statut||"—")}</span></td>
        <td>
          <div class="driver-row-menu">
            <button class="driver-row-menu-trigger" type="button" data-driver-actions-toggle="${echapperAttributLivreur(id)}" aria-expanded="false" aria-label="Afficher les actions du livreur">⋮</button>
            <div class="driver-row-menu-dropdown" data-driver-actions-menu="${echapperAttributLivreur(id)}" hidden>
              <button type="button" data-view-driver="${echapperAttributLivreur(id)}">👁 <span>Voir le livreur</span></button>
              <button type="button" data-edit-driver="${echapperAttributLivreur(id)}">✏️ <span>Modifier</span></button>
              <button type="button" class="danger" data-delete-driver="${echapperAttributLivreur(id)}">🗑️ <span>Supprimer</span></button>
            </div>
          </div>
        </td>
      </tr>`;
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
                const checkbox=event.target.closest("[data-select-driver]");
                if(checkbox){
                    const id=String(checkbox.dataset.selectDriver||"");
                    if(checkbox.checked)livreursSelectionnes.add(id);else livreursSelectionnes.delete(id);
                    checkbox.closest("tr")?.classList.toggle("is-selected",checkbox.checked);
                    synchroniserSelectionLivreurs(false);
                    return;
                }
                const zonesToggle=event.target.closest("[data-driver-zones-toggle]");
                if(zonesToggle){basculerMenuLivreur(zonesToggle,"zones");return;}
                const actionsToggle=event.target.closest("[data-driver-actions-toggle]");
                if(actionsToggle){basculerMenuLivreur(actionsToggle,"actions");return;}
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



function fermerMenusLigneLivreur(){
 document.querySelectorAll("[data-driver-actions-menu],[data-driver-zones-menu]").forEach(m=>m.hidden=true);
 document.querySelectorAll("[data-driver-actions-toggle],[data-driver-zones-toggle]").forEach(b=>b.setAttribute("aria-expanded","false"));
}
function basculerMenuLivreur(bouton,type){
 const id=String(type==="zones"?bouton.dataset.driverZonesToggle:bouton.dataset.driverActionsToggle||"");
 const attr=type==="zones"?"data-driver-zones-menu":"data-driver-actions-menu";
 const menu=document.querySelector(`[${attr}="${CSS.escape(id)}"]`);if(!menu)return;
 const ouvrir=menu.hidden;fermerMenusLigneLivreur();menu.hidden=!ouvrir;bouton.setAttribute("aria-expanded",String(ouvrir));
}
document.addEventListener("click",e=>{if(!e.target.closest(".driver-row-menu"))fermerMenusLigneLivreur();});

function activerBoutonLivreurMobile(element, action) {
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
   element.addEventListener("touchend", executer, { passive:false });
 }
}

function fermerMenuActionsLivreurs(){
 const trigger=document.getElementById("drivers-actions-trigger");
 const menu=document.getElementById("drivers-actions-dropdown");
 if(menu)menu.hidden=true;
 trigger?.setAttribute("aria-expanded","false");
}

function initialiserMenuActionsLivreurs(){
 const trigger=document.getElementById("drivers-actions-trigger");
 const menu=document.getElementById("drivers-actions-dropdown");
 if(!trigger||!menu)return;

 const basculerActions=()=>{
   const vaOuvrir=menu.hidden;

   fermerMenusLigneLivreur();

   if(vaOuvrir && modeSelectionLivreurs){
     definirModeSelectionLivreurs(false);
   }

   menu.hidden=!vaOuvrir;
   trigger.setAttribute("aria-expanded",String(vaOuvrir));
 };

 if(window.matchMedia("(max-width: 900px)").matches){
   activerBoutonLivreurMobile(trigger,basculerActions);
 }else{
   trigger.addEventListener("click",event=>{
     event.stopPropagation();
     basculerActions();
   });
 }

 menu.addEventListener("click",event=>{
   if(event.target.closest("button")){
     fermerMenuActionsLivreurs();
   }
 });

 document.addEventListener("click",event=>{
   if(!event.target.closest(".drivers-actions-menu")){
     fermerMenuActionsLivreurs();
   }
 });
}

function initialiserSelectionLivreurs(){
 const bouton=document.getElementById("selection-drivers-btn");

 const basculerSelection=()=>{
   if(!modeSelectionLivreurs){
     fermerMenuActionsLivreurs();
     fermerMenusLigneLivreur();
   }
   definirModeSelectionLivreurs(!modeSelectionLivreurs);
 };

 if(bouton && window.matchMedia("(max-width: 900px)").matches){
   activerBoutonLivreurMobile(bouton,basculerSelection);
 }else{
   bouton?.addEventListener("click",basculerSelection);
 }

 document.getElementById("close-drivers-selection-btn")?.addEventListener("click",()=>definirModeSelectionLivreurs(false));
 document.getElementById("clear-drivers-selection-btn")?.addEventListener("click",()=>{livreursSelectionnes.clear();synchroniserSelectionLivreurs();});
 document.getElementById("select-visible-drivers-btn")?.addEventListener("click",()=>{
   document.querySelectorAll("[data-select-driver]").forEach(c=>livreursSelectionnes.add(String(c.dataset.selectDriver||"")));
   synchroniserSelectionLivreurs();
 });
 document.getElementById("select-all-drivers")?.addEventListener("change",e=>{
   document.querySelectorAll("[data-select-driver]").forEach(c=>{const id=String(c.dataset.selectDriver||"");if(e.target.checked)livreursSelectionnes.add(id);else livreursSelectionnes.delete(id);});
   synchroniserSelectionLivreurs();
 });
 document.getElementById("delete-drivers-selection-btn")?.addEventListener("click",async()=>{
   if(!livreursSelectionnes.size){afficherToastLivreur?.("Aucun livreur sélectionné.","info");return;}
   if(!confirm(`Supprimer ${livreursSelectionnes.size} livreur(s) sélectionné(s) ?`))return;
   const ids=Array.from(livreursSelectionnes);
   for(const id of ids){
     const l=trouverLivreurParId(id);if(!l)continue;
     try{const r=await apiPost("deleteLivreur",{idLivreur:id});if(!r?.success)throw new Error(r?.message||"Suppression impossible");}
     catch(e){console.error(e);}
   }
   livreursSelectionnes.clear();definirModeSelectionLivreurs(false);await chargerLivreurs();
 });
}
function definirModeSelectionLivreurs(actif){
 modeSelectionLivreurs=Boolean(actif);
 if(modeSelectionLivreurs)fermerMenuActionsLivreurs();
 document.body.classList.toggle("drivers-selection-mode",modeSelectionLivreurs);
 document.getElementById("selection-drivers-btn")?.setAttribute("aria-pressed",String(modeSelectionLivreurs));
 const bar=document.getElementById("drivers-selection-bar");if(bar)bar.hidden=!modeSelectionLivreurs;
 if(!modeSelectionLivreurs)livreursSelectionnes.clear();synchroniserSelectionLivreurs();
}
function synchroniserSelectionLivreurs(rafraichir=true){
 if(rafraichir)document.querySelectorAll("[data-select-driver]").forEach(c=>{c.checked=livreursSelectionnes.has(String(c.dataset.selectDriver||""));c.closest("tr")?.classList.toggle("is-selected",c.checked);});
 const n=document.getElementById("selected-drivers-count");if(n)n.textContent=String(livreursSelectionnes.size);
 const all=document.getElementById("select-all-drivers");
 if(all){const cs=Array.from(document.querySelectorAll("[data-select-driver]"));const k=cs.filter(c=>c.checked).length;all.checked=cs.length>0&&k===cs.length;all.indeterminate=k>0&&k<cs.length;}
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


function voirLivreur(idLivreur) {
 const livreur=trouverLivreurParId(idLivreur);if(!livreur)return;
 const contenu=document.getElementById("driver-details-content");if(!contenu)return;
 const nom=obtenirNomCompletLivreur(livreur),zones=obtenirZonesLivreur(livreur),initiales=obtenirInitialesLivreur(livreur),statutClasse=obtenirClasseStatutLivreur(livreur.statut);
 contenu.innerHTML=`
 <section class="driver-profile-hero">
   <div class="driver-profile-avatar">${echapperHTMLLivreur(initiales)}</div>
   <div class="driver-profile-main"><h3>${echapperHTMLLivreur(nom||"Livreur")}</h3><p>${echapperHTMLLivreur(livreur.telephone||"—")}</p><span class="status-badge ${statutClasse}">${echapperHTMLLivreur(livreur.statut||"—")}</span></div>
   <div class="driver-profile-id">${echapperHTMLLivreur(livreur.idLivreur||"—")}</div>
 </section>
 <section class="driver-performance-grid">
   <article><span>📦</span><small>Livraisons réussies</small><strong>${formaterNombreLivreur(livreur.nombreLivraisons)}</strong></article>
   <article><span>🛵</span><small>Missions effectuées</small><strong>${formaterNombreLivreur(livreur.missionsEffectuees)}</strong></article>
   <article><span>💰</span><small>Montant encaissé par le livreur</small><strong>${formaterMontantLivreur(livreur.montantTotalEncaisse)}</strong></article>
   <article><span>🧾</span><small>Frais générés — réussies</small><strong>${formaterMontantLivreur(livreur.fraisLivraisonEffectues)}</strong></article>
   <article><span>↩️</span><small>Échecs définitifs</small><strong>${formaterNombreLivreur(livreur.livraisonsEchouees)}</strong></article>
   <article><span>🗓️</span><small>Missions reportées</small><strong>${formaterNombreLivreur(livreur.missionsReportees)}</strong></article>
   <article><span>🏢</span><small>Frais à charge entreprise</small><strong>${formaterMontantLivreur(livreur.fraisPrisEnChargeEntreprise)}</strong></article>
   <article><span>🎯</span><small>Taux de réussite</small><strong>${formaterNombreLivreur(livreur.tauxReussite)} %</strong></article>
  </section>
 <section class="driver-info-panels">
   <article class="driver-info-panel"><h4>👤 Coordonnées</h4>
     <dl><div><dt>Téléphone</dt><dd>${echapperHTMLLivreur(livreur.telephone||"—")}</dd></div><div><dt>Téléphone secondaire</dt><dd>${echapperHTMLLivreur(livreur.telephoneSecondaire||"—")}</dd></div><div><dt>Email</dt><dd>${echapperHTMLLivreur(livreur.email||"—")}</dd></div><div><dt>Adresse</dt><dd>${echapperHTMLLivreur(livreur.adresse||"—")}</dd></div></dl>
   </article>
   <article class="driver-info-panel"><h4>🛵 Informations professionnelles</h4>
     <dl><div><dt>Type</dt><dd>${echapperHTMLLivreur(livreur.typeLivreur||"—")}</dd></div><div><dt>Transport</dt><dd>${echapperHTMLLivreur(livreur.moyenTransport||"—")}</dd></div><div><dt>Immatriculation</dt><dd>${echapperHTMLLivreur(livreur.immatriculation||"—")}</dd></div><div><dt>Pièce</dt><dd>${echapperHTMLLivreur([livreur.typePiece,livreur.numeroPiece].filter(Boolean).join(" · ")||"—")}</dd></div></dl>
   </article>
   <article class="driver-info-panel driver-info-panel-full"><h4>📍 Zones couvertes</h4><div class="driver-profile-zones">${zones.length?zones.map(z=>`<span>${echapperHTMLLivreur(z)}</span>`).join(""):"—"}</div></article>
 </section>`;
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

        const idSupprime =
            livreurASupprimer
                .idLivreur;

        retirerLivreurLocal(
            idSupprime
        );

        fermerModaleSuppressionLivreur();

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
   MISE À JOUR LOCALE RAPIDE
=========================================================== */

function mettreAJourLivreurLocal(
    livreur,
    estModification = false
) {
    if (
        !livreur ||
        !livreur.idLivreur
    ) {
        return;
    }

    const index =
        livreursCharges.findIndex(
            element =>
                String(
                    element.idLivreur
                ) ===
                String(
                    livreur.idLivreur
                )
        );

    if (index >= 0) {
        livreursCharges[index] = {
            ...livreursCharges[index],
            ...livreur
        };
    } else {
        livreursCharges.unshift(
            livreur
        );
    }

    actualiserFiltreZonesLivreurs();
    mettreAJourKPILivreurs();
    appliquerFiltresLivreurs(true);
}


function retirerLivreurLocal(
    idLivreur
) {
    livreursCharges =
        livreursCharges.filter(
            livreur =>
                String(
                    livreur.idLivreur
                ) !==
                String(
                    idLivreur
                )
        );

    actualiserFiltreZonesLivreurs();
    mettreAJourKPILivreurs();
    appliquerFiltresLivreurs(true);
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


/* ===== VISIBL COMMON HARMONISATION — référence Ventes/Commandes ===== */
document.addEventListener("DOMContentLoaded",()=>{
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const searchBox=q(".header .search-box"), search=q(".header .search-container");
  const mobileSearch=q("#mobile-search-btn");
  const notifBtn=q("#notification-button"), notif=q("#notification-panel");

  const closeSearch=()=>search?.classList.remove("active");
  const closeNotif=()=>{if(notif)notif.hidden=true;notifBtn?.setAttribute("aria-expanded","false")};

  mobileSearch?.addEventListener("click",e=>{
    e.stopPropagation(); const open=!search?.classList.contains("active");
    closeNotif(); if(search)search.classList.toggle("active",open);
    if(open)setTimeout(()=>q("input",search)?.focus(),40);
  },true);
  notifBtn?.addEventListener("click",e=>{
    e.stopPropagation(); const open=!!notif?.hidden;
    closeSearch(); if(notif)notif.hidden=!open;
    notifBtn.setAttribute("aria-expanded",String(open));
  },true);
  document.addEventListener("click",e=>{
    if(!e.target.closest(".header .search-box")&&!e.target.closest(".header .notification-menu")){
      closeSearch();closeNotif();
    }
  });

  /* Déconnexion robuste et redirection directe. */
  q("#logout-button")?.addEventListener("click",e=>{
    e.preventDefault();e.stopImmediatePropagation();
    try{ if(typeof logoutUser==="function") logoutUser(); }catch(_){}
    try{
      sessionStorage.clear();
      ["visibl_user","user","utilisateur","currentUser","authUser","isAuthenticated","token","authToken"]
        .forEach(k=>localStorage.removeItem(k));
    }catch(_){}
    location.replace("connexion.html");
  },true);

  /* Supprime les notifications de démonstration, conserve une cloche vide. */
  if(notif){
    qa(".notification-item",notif).forEach(x=>x.remove());
    if(!q(".notification-empty-state",notif)){
      const d=document.createElement("div"); d.className="notification-empty-state";
      d.innerHTML='<span aria-hidden="true">🔔</span><p>Aucune notification pour le moment.</p>';
      notif.appendChild(d);
    }
  }
  qa(".notification-badge").forEach(b=>{b.hidden=true;b.textContent="0"});

  /* Une seule recherche : celle du header pilote l'ancien champ filtre caché. */
  const headerInput=q(".header .search-container input");
  const filterSearch=qa('section.content input[type="search"],section.content input[type="text"]')
    .find(el=>/search|recher/i.test(el.id||"") && el!==headerInput);
  if(filterSearch){
    const holder=filterSearch.closest(".sales-search,.clients-search,.search-field,.filter-search,.search-box")||filterSearch.parentElement;
    if(holder) holder.style.display="none";
    const sync=()=>{
      filterSearch.value=headerInput?.value||"";
      filterSearch.dispatchEvent(new Event("input",{bubbles:true}));
      filterSearch.dispatchEvent(new Event("change",{bubbles:true}));
    };
    headerInput?.addEventListener("input",sync);
    q(".header .search-btn")?.addEventListener("click",sync);
  }

  /* Transforme la zone d'actions existante en Sélection + Actions sans casser les handlers. */
  const content=q("section.content");
  if(false && content){
    const actionButtons=qa("button",content).filter(b=>/export|imprim|actual|refresh|télécharg|telecharg/i.test((b.id||"")+" "+b.textContent));
    if(actionButtons.length){
      let host=actionButtons[0].closest(".toolbar-right,.actions,.toolbar-actions,.clients-toolbar,.sales-toolbar,.toolbar")||actionButtons[0].parentElement;
      if(host && !q(".visibl-common-toolbar-actions",host)){
        const wrap=document.createElement("div");wrap.className="visibl-common-toolbar-actions";
        const sel=document.createElement("button");sel.type="button";sel.className="btn-secondary";sel.textContent="☑️ Sélection";
        const menuWrap=document.createElement("div");menuWrap.className="visibl-common-actions";
        const trigger=document.createElement("button");trigger.type="button";trigger.className="btn-secondary";trigger.textContent="Actions ⌄";trigger.setAttribute("aria-expanded","false");
        const menu=document.createElement("div");menu.className="visibl-common-actions-menu";menu.hidden=true;
        actionButtons.forEach(old=>{
          const clone=document.createElement("button");clone.type="button";clone.innerHTML=old.innerHTML||old.textContent;
          clone.addEventListener("click",()=>{old.click();menu.hidden=true;trigger.setAttribute("aria-expanded","false")});
          menu.appendChild(clone); old.style.display="none";
        });
        trigger.addEventListener("click",e=>{e.stopPropagation();menu.hidden=!menu.hidden;trigger.setAttribute("aria-expanded",String(!menu.hidden))});
        sel.addEventListener("click",()=>{
          const on=!document.body.classList.contains("visibl-selection-mode");
          document.body.classList.toggle("visibl-selection-mode",on);sel.setAttribute("aria-pressed",String(on));
        });
        menuWrap.append(trigger,menu);wrap.append(sel,menuWrap);host.appendChild(wrap);
        document.addEventListener("click",e=>{if(!e.target.closest(".visibl-common-actions")){menu.hidden=true;trigger.setAttribute("aria-expanded","false")}});
      }
    }

    /* Retire uniquement les boutons d'ajout en doublon dans les toolbars; celui du haut reste. */
    const topAdd=qa(".welcome-section button,.welcome-section a",content).find(x=>/nouveau|nouvelle|ajouter/i.test(x.textContent));
    if(topAdd){
      qa(".toolbar button,.toolbar a,.clients-toolbar button,.clients-toolbar a,.sales-toolbar button,.sales-toolbar a",content)
        .filter(x=>x!==topAdd && /nouveau|nouvelle|ajouter/i.test(x.textContent))
        .forEach(x=>x.style.display="none");
    }
  }
});
