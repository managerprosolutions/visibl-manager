/* ===========================================================
   VISIBL ERP — Module Transitaires
   Frontend : chargement, CRUD, recherche, filtres, pagination,
   consultation, export, impression et déconnexion
=========================================================== */


/* ===========================================================
   ÉTAT GLOBAL
=========================================================== */

let transitairesCharges = [];
let transitairesFiltres = [];
let transitaireEnModificationId = null;
let transitaireASupprimer = null;

let rechercheTransitaires = "";

let filtresTransitaires = {
    statut: "",
    typeTransport: "",
    pays: ""
};

let pageTransitairesCourante = 1;
let transitairesParPage = 10;

let triTransitaires = {
    cle: "",
    direction: "asc"
};


/* ===========================================================
   INITIALISATION
=========================================================== */

function initialiserTransitaires() {
    if (typeof requireAuth === "function") {
        requireAuth();
    }

    initialiserDeconnexionTransitaires();
    initialiserModalesTransitaires();
    initialiserFormulaireTransitaire();
    initialiserActionsTableauTransitaires();
    initialiserRechercheEtFiltresTransitaires();
    initialiserPaginationTransitaires();
    initialiserImpressionTransitaires();
    initialiserExportTransitaires();

    chargerTransitaires();
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserTransitaires
    );
} else {
    initialiserTransitaires();
}


/* ===========================================================
   DÉCONNEXION
=========================================================== */

function initialiserDeconnexionTransitaires() {
    const bouton =
        document.getElementById(
            "logout-button"
        );

    bouton?.addEventListener(
        "click",
        function (event) {
            event.preventDefault();

            if (typeof logoutUser === "function") {
                logoutUser();
                return;
            }

            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "connexion.html";
        }
    );
}


/* ===========================================================
   MODALES
=========================================================== */

function initialiserModalesTransitaires() {
    const ouvrirPrincipal =
        document.getElementById(
            "new-transitaire-btn"
        );

    const ouvrirToolbar =
        document.getElementById(
            "new-transitaire-toolbar-btn"
        );

    const ouvrirEtatVide =
        document.getElementById(
            "empty-new-transitaire-btn"
        );

    const fermerCreation =
        document.getElementById(
            "close-transitaire-modal"
        );

    const annulerCreation =
        document.getElementById(
            "cancel-transitaire-btn"
        );

    const fermerVoir =
        document.getElementById(
            "close-view-transitaire-modal"
        );

    const fermerVoirFooter =
        document.getElementById(
            "close-view-transitaire-footer"
        );

    const annulerSuppression =
        document.getElementById(
            "cancel-delete-transitaire-btn"
        );

    const confirmerSuppression =
        document.getElementById(
            "confirm-delete-transitaire-btn"
        );

    ouvrirPrincipal?.addEventListener(
        "click",
        ouvrirNouveauTransitaire
    );

    ouvrirToolbar?.addEventListener(
        "click",
        ouvrirNouveauTransitaire
    );

    ouvrirEtatVide?.addEventListener(
        "click",
        ouvrirNouveauTransitaire
    );

    fermerCreation?.addEventListener(
        "click",
        fermerModalTransitaire
    );

    annulerCreation?.addEventListener(
        "click",
        fermerModalTransitaire
    );

    fermerVoir?.addEventListener(
        "click",
        fermerModalVoirTransitaire
    );

    fermerVoirFooter?.addEventListener(
        "click",
        fermerModalVoirTransitaire
    );

    annulerSuppression?.addEventListener(
        "click",
        fermerModalSuppressionTransitaire
    );

    confirmerSuppression?.addEventListener(
        "click",
        confirmerSuppressionTransitaire
    );

    [
        "transitaire-modal",
        "view-transitaire-modal",
        "delete-transitaire-modal"
    ].forEach(
        id => {
            document
                .getElementById(id)
                ?.addEventListener(
                    "click",
                    function (event) {
                        if (event.target !== event.currentTarget) {
                            return;
                        }

                        if (id === "transitaire-modal") {
                            fermerModalTransitaire();
                        }

                        if (id === "view-transitaire-modal") {
                            fermerModalVoirTransitaire();
                        }

                        if (id === "delete-transitaire-modal") {
                            fermerModalSuppressionTransitaire();
                        }
                    }
                );
        }
    );

    document.addEventListener(
        "keydown",
        function (event) {
            if (event.key !== "Escape") {
                return;
            }

            fermerModalTransitaire();
            fermerModalVoirTransitaire();
            fermerModalSuppressionTransitaire();
        }
    );
}


function ouvrirNouveauTransitaire() {
    transitaireEnModificationId = null;

    const formulaire =
        document.getElementById(
            "transitaire-form"
        );

    formulaire?.reset();

    definirValeurTransitaire(
        "transitaire-id",
        ""
    );

    definirValeurTransitaire(
        "transitaire-status",
        "Actif"
    );

    const titre =
        document.getElementById(
            "transitaire-modal-title"
        );

    const bouton =
        document.getElementById(
            "save-transitaire-btn"
        );

    if (titre) {
        titre.textContent =
            "Nouveau transitaire";
    }

    if (bouton) {
        bouton.textContent =
            "Enregistrer le transitaire";
    }

    afficherMessageFormulaireTransitaire(
        "",
        ""
    );

    ouvrirModal(
        "transitaire-modal"
    );
}


function ouvrirModificationTransitaire(
    transitaire
) {
    transitaireEnModificationId =
        transitaire.idTransitaire;

    definirValeurTransitaire(
        "transitaire-id",
        transitaire.idTransitaire
    );

    definirValeurTransitaire(
        "transitaire-name",
        transitaire.nomTransitaire
    );

    definirValeurTransitaire(
        "transitaire-contact-name",
        transitaire.nomContact
    );

    definirValeurTransitaire(
        "transitaire-phone",
        transitaire.telephone
    );

    definirValeurTransitaire(
        "transitaire-whatsapp",
        transitaire.whatsapp
    );

    definirValeurTransitaire(
        "transitaire-email",
        transitaire.email
    );

    definirValeurTransitaire(
        "transitaire-country",
        transitaire.pays
    );

    definirValeurTransitaire(
        "transitaire-city",
        transitaire.ville
    );

    definirValeurTransitaire(
        "transitaire-address",
        transitaire.adresse
    );

    definirValeurTransitaire(
        "transitaire-transport-type",
        transitaire.typeTransport
    );

    definirValeurTransitaire(
        "transitaire-average-delay",
        transitaire.delaiMoyen
    );

    definirValeurTransitaire(
        "transitaire-currency",
        transitaire.devise
    );

    definirValeurTransitaire(
        "transitaire-status",
        transitaire.statut || "Actif"
    );

    definirValeurTransitaire(
        "transitaire-comment",
        transitaire.commentaire
    );

    const titre =
        document.getElementById(
            "transitaire-modal-title"
        );

    const bouton =
        document.getElementById(
            "save-transitaire-btn"
        );

    if (titre) {
        titre.textContent =
            "Modifier le transitaire";
    }

    if (bouton) {
        bouton.textContent =
            "Enregistrer les modifications";
    }

    afficherMessageFormulaireTransitaire(
        "",
        ""
    );

    ouvrirModal(
        "transitaire-modal"
    );
}


function fermerModalTransitaire() {
    fermerModal(
        "transitaire-modal"
    );
}


function ouvrirModalVoirTransitaire(
    transitaire
) {
    afficherDetailsTransitaire(
        transitaire
    );

    ouvrirModal(
        "view-transitaire-modal"
    );
}


function fermerModalVoirTransitaire() {
    fermerModal(
        "view-transitaire-modal"
    );
}


function ouvrirModalSuppressionTransitaire(
    transitaire
) {
    transitaireASupprimer =
        transitaire;

    definirTexteTransitaire(
        "delete-transitaire-name",
        transitaire.nomTransitaire ||
        transitaire.idTransitaire ||
        "ce transitaire"
    );

    ouvrirModal(
        "delete-transitaire-modal"
    );
}


function fermerModalSuppressionTransitaire() {
    const bouton =
        document.getElementById(
            "confirm-delete-transitaire-btn"
        );

    if (bouton?.disabled) {
        return;
    }

    transitaireASupprimer = null;

    fermerModal(
        "delete-transitaire-modal"
    );
}


function ouvrirModal(id) {
    const modal =
        document.getElementById(id);

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


function fermerModal(id) {
    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );

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


/* ===========================================================
   FORMULAIRE — CRÉATION ET MODIFICATION
=========================================================== */

function initialiserFormulaireTransitaire() {
    document
        .getElementById(
            "transitaire-form"
        )
        ?.addEventListener(
            "submit",
            enregistrerTransitaire
        );
}


async function enregistrerTransitaire(event) {
    event.preventDefault();

    const formulaire =
        document.getElementById(
            "transitaire-form"
        );

    const bouton =
        document.getElementById(
            "save-transitaire-btn"
        );

    if (
        !formulaire ||
        formulaire.dataset.processing === "true"
    ) {
        return;
    }

    if (!formulaire.checkValidity()) {
        formulaire.reportValidity();
        return;
    }

    const data = {
        nomTransitaire:
            obtenirValeurTransitaire(
                "transitaire-name"
            ),

        nomContact:
            obtenirValeurTransitaire(
                "transitaire-contact-name"
            ),

        telephone:
            obtenirValeurTransitaire(
                "transitaire-phone"
            ),

        whatsapp:
            obtenirValeurTransitaire(
                "transitaire-whatsapp"
            ),

        email:
            obtenirValeurTransitaire(
                "transitaire-email"
            ),

        pays:
            obtenirValeurTransitaire(
                "transitaire-country"
            ),

        ville:
            obtenirValeurTransitaire(
                "transitaire-city"
            ),

        adresse:
            obtenirValeurTransitaire(
                "transitaire-address"
            ),

        typeTransport:
            obtenirValeurTransitaire(
                "transitaire-transport-type"
            ),

        delaiMoyen:
            obtenirValeurTransitaire(
                "transitaire-average-delay"
            ),

        devise:
            obtenirValeurTransitaire(
                "transitaire-currency"
            ),

        statut:
            obtenirValeurTransitaire(
                "transitaire-status"
            ),

        commentaire:
            obtenirValeurTransitaire(
                "transitaire-comment"
            )
    };

    if (transitaireEnModificationId) {
        data.idTransitaire =
            transitaireEnModificationId;
    }

    formulaire.dataset.processing =
        "true";

    if (bouton) {
        bouton.disabled = true;
        bouton.textContent =
            transitaireEnModificationId
                ? "Modification..."
                : "Enregistrement...";
    }

    afficherMessageFormulaireTransitaire(
        transitaireEnModificationId
            ? "Modification en cours..."
            : "Enregistrement en cours...",
        "info"
    );

    try {
        const action =
            transitaireEnModificationId
                ? "updateTransitaire"
                : "createTransitaire";

        const resultat =
            await apiPost(
                action,
                data
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le transitaire."
            );
        }

        const transitaireSauvegarde =
            normaliserTransitaire(
                resultat.data || {
                    ...data,
                    idTransitaire:
                        data.idTransitaire ||
                        resultat.idTransitaire ||
                        ""
                }
            );

        mettreAJourTransitaireLocal(
            transitaireSauvegarde
        );

        afficherToastTransitaire(
            resultat.message ||
            "Transitaire enregistré avec succès.",
            "success"
        );

        formulaire.reset();
        transitaireEnModificationId = null;
        fermerModalTransitaire();

    } catch (error) {
        console.error(
            "Erreur enregistrement transitaire :",
            error
        );

        afficherMessageFormulaireTransitaire(
            error.message ||
            "Impossible d'enregistrer le transitaire.",
            "error"
        );

    } finally {
        formulaire.dataset.processing =
            "false";

        if (bouton) {
            bouton.disabled = false;
            bouton.textContent =
                transitaireEnModificationId
                    ? "Enregistrer les modifications"
                    : "Enregistrer le transitaire";
        }
    }
}


/* ===========================================================
   SUPPRESSION
=========================================================== */

async function confirmerSuppressionTransitaire() {
    if (!transitaireASupprimer) {
        return;
    }

    const bouton =
        document.getElementById(
            "confirm-delete-transitaire-btn"
        );

    if (bouton?.disabled) {
        return;
    }

    if (bouton) {
        bouton.disabled = true;
        bouton.classList.add(
            "is-loading"
        );
    }

    try {
        const resultat =
            await apiPost(
                "deleteTransitaire",
                {
                    idTransitaire:
                        transitaireASupprimer
                            .idTransitaire
                }
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de supprimer le transitaire."
            );
        }

        retirerTransitaireLocal(
            transitaireASupprimer
                .idTransitaire
        );

        afficherToastTransitaire(
            resultat.message ||
            "Transitaire supprimé avec succès.",
            "success"
        );

        transitaireASupprimer = null;
        fermerModal(
            "delete-transitaire-modal"
        );

    } catch (error) {
        console.error(
            "Erreur suppression transitaire :",
            error
        );

        afficherToastTransitaire(
            error.message ||
            "Impossible de supprimer le transitaire.",
            "error"
        );

    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.classList.remove(
                "is-loading"
            );
        }
    }
}


/* ===========================================================
   CHARGEMENT
=========================================================== */

async function chargerTransitaires() {
    afficherEtatChargementTransitaires();

    try {
        const resultat =
            await apiGet(
                "getTransitaires"
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger les transitaires."
            );
        }

        const liste =
            Array.isArray(resultat.transitaires)
                ? resultat.transitaires
                : Array.isArray(resultat.data)
                    ? resultat.data
                    : [];

        transitairesCharges =
            liste.map(
                normaliserTransitaire
            );

        actualiserFiltrePaysTransitaires();
        mettreAJourKPITransitaires();
        appliquerRechercheEtFiltresTransitaires();

    } catch (error) {
        console.error(
            "Erreur chargement transitaires :",
            error
        );

        transitairesCharges = [];
        transitairesFiltres = [];

        afficherTransitaires([]);

        afficherToastTransitaire(
            error.message ||
            "Impossible de charger les transitaires.",
            "error"
        );
    }
}


function afficherEtatChargementTransitaires() {
    const tbody =
        document.getElementById(
            "transitaires-table-body"
        );

    if (!tbody) {
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="empty-table">
                Chargement des transitaires...
            </td>
        </tr>
    `;
}


/* ===========================================================
   MISE À JOUR LOCALE RAPIDE
=========================================================== */

function mettreAJourTransitaireLocal(
    transitaire
) {
    const index =
        transitairesCharges.findIndex(
            element =>
                String(element.idTransitaire) ===
                String(transitaire.idTransitaire)
        );

    if (index >= 0) {
        transitairesCharges[index] = {
            ...transitairesCharges[index],
            ...transitaire
        };
    } else {
        transitairesCharges.unshift(
            transitaire
        );
    }

    actualiserFiltrePaysTransitaires();
    mettreAJourKPITransitaires();
    appliquerRechercheEtFiltresTransitaires(
        true
    );
}


function retirerTransitaireLocal(
    idTransitaire
) {
    transitairesCharges =
        transitairesCharges.filter(
            transitaire =>
                String(
                    transitaire.idTransitaire
                ) !==
                String(idTransitaire)
        );

    actualiserFiltrePaysTransitaires();
    mettreAJourKPITransitaires();
    appliquerRechercheEtFiltresTransitaires(
        true
    );
}


/* ===========================================================
   ACTIONS DU TABLEAU
=========================================================== */

function initialiserActionsTableauTransitaires() {
    document
        .getElementById(
            "transitaires-table-body"
        )
        ?.addEventListener(
            "click",
            function (event) {
                const boutonVoir =
                    event.target.closest(
                        ".view-btn"
                    );

                if (boutonVoir) {
                    const transitaire =
                        trouverTransitaireParId(
                            boutonVoir.dataset
                                .transitaireId
                        );

                    if (transitaire) {
                        ouvrirModalVoirTransitaire(
                            transitaire
                        );
                    }

                    return;
                }

                const boutonModifier =
                    event.target.closest(
                        ".edit-btn"
                    );

                if (boutonModifier) {
                    const transitaire =
                        trouverTransitaireParId(
                            boutonModifier.dataset
                                .transitaireId
                        );

                    if (transitaire) {
                        ouvrirModificationTransitaire(
                            transitaire
                        );
                    }

                    return;
                }

                const boutonSupprimer =
                    event.target.closest(
                        ".delete-btn"
                    );

                if (boutonSupprimer) {
                    const transitaire =
                        trouverTransitaireParId(
                            boutonSupprimer.dataset
                                .transitaireId
                        );

                    if (transitaire) {
                        ouvrirModalSuppressionTransitaire(
                            transitaire
                        );
                    }
                }
            }
        );
}


function trouverTransitaireParId(
    idTransitaire
) {
    const transitaire =
        transitairesCharges.find(
            element =>
                String(
                    element.idTransitaire
                ) ===
                String(idTransitaire)
        );

    if (!transitaire) {
        afficherToastTransitaire(
            "Impossible de retrouver ce transitaire.",
            "error"
        );
    }

    return transitaire;
}


/* ===========================================================
   RECHERCHE ET FILTRES
=========================================================== */

function initialiserRechercheEtFiltresTransitaires() {
    const recherchePage =
        document.getElementById(
            "transitaires-search-input"
        );

    const rechercheHeader =
        document.getElementById(
            "header-transitaires-search-input"
        );

    const boutonRechercheHeader =
        document.getElementById(
            "header-transitaires-search-btn"
        );

    const filtreStatut =
        document.getElementById(
            "transitaire-status-filter"
        );

    const filtreTransport =
        document.getElementById(
            "transitaire-transport-filter"
        );

    const filtrePays =
        document.getElementById(
            "transitaire-country-filter"
        );

    const boutonEffacer =
        document.getElementById(
            "reset-transitaire-filters"
        );

    const boutonActualiser =
        document.getElementById(
            "refresh-transitaires-btn"
        );

    const synchroniserRecherche =
        function (valeur, source) {
            rechercheTransitaires =
                String(valeur || "");

            if (
                recherchePage &&
                source !== recherchePage
            ) {
                recherchePage.value =
                    rechercheTransitaires;
            }

            if (
                rechercheHeader &&
                source !== rechercheHeader
            ) {
                rechercheHeader.value =
                    rechercheTransitaires;
            }

            appliquerRechercheEtFiltresTransitaires();
        };

    recherchePage?.addEventListener(
        "input",
        function () {
            synchroniserRecherche(
                recherchePage.value,
                recherchePage
            );
        }
    );

    rechercheHeader?.addEventListener(
        "input",
        function () {
            synchroniserRecherche(
                rechercheHeader.value,
                rechercheHeader
            );
        }
    );

    boutonRechercheHeader?.addEventListener(
        "click",
        function (event) {
            event.preventDefault();

            synchroniserRecherche(
                rechercheHeader?.value || "",
                rechercheHeader
            );
        }
    );

    rechercheHeader?.addEventListener(
        "keydown",
        function (event) {
            if (event.key !== "Enter") {
                return;
            }

            event.preventDefault();

            synchroniserRecherche(
                rechercheHeader.value,
                rechercheHeader
            );
        }
    );

    filtreStatut?.addEventListener(
        "change",
        function () {
            filtresTransitaires.statut =
                filtreStatut.value;

            appliquerRechercheEtFiltresTransitaires();
        }
    );

    filtreTransport?.addEventListener(
        "change",
        function () {
            filtresTransitaires.typeTransport =
                filtreTransport.value;

            appliquerRechercheEtFiltresTransitaires();
        }
    );

    filtrePays?.addEventListener(
        "change",
        function () {
            filtresTransitaires.pays =
                filtrePays.value;

            appliquerRechercheEtFiltresTransitaires();
        }
    );

    boutonEffacer?.addEventListener(
        "click",
        function () {
            rechercheTransitaires = "";

            filtresTransitaires = {
                statut: "",
                typeTransport: "",
                pays: ""
            };

            if (recherchePage) {
                recherchePage.value = "";
            }

            if (rechercheHeader) {
                rechercheHeader.value = "";
            }

            if (filtreStatut) {
                filtreStatut.value = "";
            }

            if (filtreTransport) {
                filtreTransport.value = "";
            }

            if (filtrePays) {
                filtrePays.value = "";
            }

            appliquerRechercheEtFiltresTransitaires();
        }
    );

    boutonActualiser?.addEventListener(
        "click",
        async function () {
            if (boutonActualiser.disabled) {
                return;
            }

            boutonActualiser.disabled = true;
            boutonActualiser.classList.add(
                "is-loading"
            );

            try {
                await chargerTransitaires();

                afficherToastTransitaire(
                    "Liste des transitaires actualisée.",
                    "success"
                );

            } finally {
                boutonActualiser.disabled = false;
                boutonActualiser.classList.remove(
                    "is-loading"
                );
            }
        }
    );
}


function appliquerRechercheEtFiltresTransitaires(
    conserverPage = false
) {
    const terme =
        normaliserTexteTransitaire(
            rechercheTransitaires
        );

    transitairesFiltres =
        transitairesCharges.filter(
            transitaire => {
                const correspondRecherche =
                    !terme ||
                    [
                        transitaire.idTransitaire,
                        transitaire.nomTransitaire,
                        transitaire.nomContact,
                        transitaire.telephone,
                        transitaire.whatsapp,
                        transitaire.email,
                        transitaire.pays,
                        transitaire.ville,
                        transitaire.adresse,
                        transitaire.typeTransport,
                        transitaire.delaiMoyen,
                        transitaire.devise,
                        transitaire.statut,
                        transitaire.commentaire
                    ].some(
                        valeur =>
                            normaliserTexteTransitaire(
                                valeur
                            ).includes(
                                terme
                            )
                    );

                const correspondStatut =
                    !filtresTransitaires.statut ||
                    normaliserTexteTransitaire(
                        transitaire.statut
                    ) ===
                    normaliserTexteTransitaire(
                        filtresTransitaires.statut
                    );

                const correspondTransport =
                    !filtresTransitaires.typeTransport ||
                    normaliserTexteTransitaire(
                        transitaire.typeTransport
                    ) ===
                    normaliserTexteTransitaire(
                        filtresTransitaires.typeTransport
                    );

                const correspondPays =
                    !filtresTransitaires.pays ||
                    normaliserTexteTransitaire(
                        transitaire.pays
                    ) ===
                    normaliserTexteTransitaire(
                        filtresTransitaires.pays
                    );

                return (
                    correspondRecherche &&
                    correspondStatut &&
                    correspondTransport &&
                    correspondPays
                );
            }
        );

    if (!conserverPage) {
        pageTransitairesCourante = 1;
    }

    afficherTransitaires(
        transitairesFiltres
    );

    mettreAJourCompteurTransitaires();
    mettreAJourEtatBoutonFiltres();
}


function actualiserFiltrePaysTransitaires() {
    const select =
        document.getElementById(
            "transitaire-country-filter"
        );

    if (!select) {
        return;
    }

    const valeurActuelle =
        select.value;

    const pays =
        Array.from(
            new Set(
                transitairesCharges
                    .map(
                        transitaire =>
                            String(
                                transitaire.pays ||
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
        '<option value="">Tous les pays</option>';

    pays.forEach(
        nomPays => {
            const option =
                document.createElement(
                    "option"
                );

            option.value = nomPays;
            option.textContent = nomPays;

            select.appendChild(
                option
            );
        }
    );

    if (
        valeurActuelle &&
        pays.some(
            paysEnregistre =>
                normaliserTexteTransitaire(
                    paysEnregistre
                ) ===
                normaliserTexteTransitaire(
                    valeurActuelle
                )
        )
    ) {
        select.value =
            valeurActuelle;
    }
}


function mettreAJourEtatBoutonFiltres() {
    const bouton =
        document.getElementById(
            "reset-transitaire-filters"
        );

    if (!bouton) {
        return;
    }

    const actif =
        Boolean(
            rechercheTransitaires.trim() ||
            filtresTransitaires.statut ||
            filtresTransitaires.typeTransport ||
            filtresTransitaires.pays
        );

    bouton.disabled = !actif;
    bouton.setAttribute(
        "aria-disabled",
        actif ? "false" : "true"
    );
}


/* ===========================================================
   KPI
=========================================================== */

function mettreAJourKPITransitaires() {
    const total =
        transitairesCharges.length;

    const actifs =
        transitairesCharges.filter(
            transitaire =>
                normaliserTexteTransitaire(
                    transitaire.statut
                ) === "actif"
        ).length;

    const pays =
        new Set(
            transitairesCharges
                .map(
                    transitaire =>
                        normaliserTexteTransitaire(
                            transitaire.pays
                        )
                )
                .filter(Boolean)
        ).size;

    const transports =
        new Set(
            transitairesCharges
                .map(
                    transitaire =>
                        normaliserTexteTransitaire(
                            transitaire.typeTransport
                        )
                )
                .filter(Boolean)
        ).size;

    const pourcentage =
        total > 0
            ? Math.round(
                actifs / total * 100
            )
            : 0;

    definirTexteTransitaire(
        "total-transitaires-value",
        total.toLocaleString("fr-FR")
    );

    definirTexteTransitaire(
        "active-transitaires-value",
        actifs.toLocaleString("fr-FR")
    );

    definirTexteTransitaire(
        "active-transitaires-description",
        `${pourcentage} % des transitaires`
    );

    definirTexteTransitaire(
        "countries-covered-value",
        pays.toLocaleString("fr-FR")
    );

    definirTexteTransitaire(
        "transport-types-value",
        transports.toLocaleString("fr-FR")
    );
}


/* ===========================================================
   AFFICHAGE DU TABLEAU
=========================================================== */

function afficherTransitaires(
    transitaires
) {
    const tbody =
        document.getElementById(
            "transitaires-table-body"
        );

    const etatVide =
        document.getElementById(
            "transitaires-empty-state"
        );

    if (!tbody) {
        return;
    }

    const liste =
        Array.isArray(transitaires)
            ? transitaires.slice()
            : [];

    if (triTransitaires.cle) {
        liste.sort(
            function (a, b) {
                const comparaison =
                    comparerTransitaires(
                        a,
                        b,
                        triTransitaires.cle
                    );

                return triTransitaires.direction === "asc"
                    ? comparaison
                    : -comparaison;
            }
        );
    }

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                liste.length /
                transitairesParPage
            )
        );

    pageTransitairesCourante =
        Math.min(
            Math.max(
                1,
                pageTransitairesCourante
            ),
            totalPages
        );

    const debut =
        (pageTransitairesCourante - 1) *
        transitairesParPage;

    const page =
        liste.slice(
            debut,
            debut + transitairesParPage
        );

    tbody.innerHTML = "";

    if (!page.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-table">
                    Aucun transitaire enregistré.
                </td>
            </tr>
        `;

        if (etatVide) {
            etatVide.hidden = false;
        }

        mettreAJourPaginationTransitaires(
            liste.length,
            totalPages
        );

        return;
    }

    if (etatVide) {
        etatVide.hidden = true;
    }

    page.forEach(
        transitaire => {
            const ligne =
                document.createElement(
                    "tr"
                );

            ligne.innerHTML = `
                <td>
                    <strong>
                        ${echapperHTMLTransitaire(
                            transitaire.idTransitaire
                        )}
                    </strong>
                </td>

                <td>
                    <div class="transitaire-identity">
                        <span class="transitaire-avatar">
                            ${echapperHTMLTransitaire(
                                obtenirInitialesTransitaire(
                                    transitaire.nomTransitaire
                                )
                            )}
                        </span>

                        <div class="transitaire-name-block">
                            <strong>
                                ${echapperHTMLTransitaire(
                                    transitaire.nomTransitaire
                                )}
                            </strong>

                            <span>
                                ${echapperHTMLTransitaire(
                                    transitaire.email || "Aucun email"
                                )}
                            </span>
                        </div>
                    </div>
                </td>

                <td>
                    ${echapperHTMLTransitaire(
                        transitaire.nomContact || "—"
                    )}
                </td>

                <td>
                    <div class="transitaire-contact">
                        <span>
                            <i class="fa-solid fa-phone"></i>
                            ${echapperHTMLTransitaire(
                                formaterTelephoneTransitaire(
                                    transitaire.telephone
                                )
                            )}
                        </span>

                        <span>
                            <i class="fa-brands fa-whatsapp"></i>
                            ${echapperHTMLTransitaire(
                                formaterTelephoneTransitaire(
                                    transitaire.whatsapp
                                ) || "—"
                            )}
                        </span>
                    </div>
                </td>

                <td>
                    <strong>
                        ${echapperHTMLTransitaire(
                            transitaire.pays || "—"
                        )}
                    </strong>

                    <br>

                    <small>
                        ${echapperHTMLTransitaire(
                            transitaire.ville || "—"
                        )}
                    </small>
                </td>

                <td>
                    <span class="type-badge">
                        ${echapperHTMLTransitaire(
                            transitaire.typeTransport || "—"
                        )}
                    </span>
                </td>

                <td>
                    <span class="delay-badge">
                        ${echapperHTMLTransitaire(
                            transitaire.delaiMoyen || "—"
                        )}
                    </span>
                </td>

                <td>
                    <span class="currency-badge">
                        ${echapperHTMLTransitaire(
                            transitaire.devise || "—"
                        )}
                    </span>
                </td>

                <td>
                    <span class="
                        status-badge
                        status-${obtenirClasseStatutTransitaire(
                            transitaire.statut
                        )}
                    ">
                        ${echapperHTMLTransitaire(
                            transitaire.statut || "—"
                        )}
                    </span>
                </td>

                <td>
                    <div class="table-actions">
                        <button
                            type="button"
                            class="table-action-btn view-btn"
                            data-transitaire-id="${echapperHTMLTransitaire(
                                transitaire.idTransitaire
                            )}"
                            title="Voir"
                            aria-label="Voir le transitaire"
                        >
                            <i class="fa-solid fa-eye"></i>
                        </button>

                        <button
                            type="button"
                            class="table-action-btn edit-btn"
                            data-transitaire-id="${echapperHTMLTransitaire(
                                transitaire.idTransitaire
                            )}"
                            title="Modifier"
                            aria-label="Modifier le transitaire"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="table-action-btn delete-btn"
                            data-transitaire-id="${echapperHTMLTransitaire(
                                transitaire.idTransitaire
                            )}"
                            title="Supprimer"
                            aria-label="Supprimer le transitaire"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(
                ligne
            );
        }
    );

    mettreAJourPaginationTransitaires(
        liste.length,
        totalPages
    );
}


function mettreAJourCompteurTransitaires() {
    definirTexteTransitaire(
        "filtered-transitaire-count",
        transitairesFiltres.length
    );
}


/* ===========================================================
   PAGINATION ET TRI
=========================================================== */

function initialiserPaginationTransitaires() {
    const select =
        document.getElementById(
            "transitaires-per-page"
        );

    transitairesParPage =
        Number(select?.value) || 10;

    select?.addEventListener(
        "change",
        function () {
            transitairesParPage =
                Number(select.value) || 10;

            pageTransitairesCourante = 1;

            afficherTransitaires(
                transitairesFiltres
            );
        }
    );

    document
        .getElementById(
            "previous-transitaire-page-btn"
        )
        ?.addEventListener(
            "click",
            function () {
                if (pageTransitairesCourante <= 1) {
                    return;
                }

                pageTransitairesCourante--;

                afficherTransitaires(
                    transitairesFiltres
                );
            }
        );

    document
        .getElementById(
            "next-transitaire-page-btn"
        )
        ?.addEventListener(
            "click",
            function () {
                const totalPages =
                    Math.max(
                        1,
                        Math.ceil(
                            transitairesFiltres.length /
                            transitairesParPage
                        )
                    );

                if (
                    pageTransitairesCourante >=
                    totalPages
                ) {
                    return;
                }

                pageTransitairesCourante++;

                afficherTransitaires(
                    transitairesFiltres
                );
            }
        );

    document
        .querySelector(
            ".transitaires-table thead"
        )
        ?.addEventListener(
            "click",
            function (event) {
                const th =
                    event.target.closest(
                        "th[data-sort-key]"
                    );

                if (!th) {
                    return;
                }

                const cle =
                    th.dataset.sortKey;

                triTransitaires.direction =
                    triTransitaires.cle === cle &&
                    triTransitaires.direction === "asc"
                        ? "desc"
                        : "asc";

                triTransitaires.cle =
                    cle;

                pageTransitairesCourante =
                    1;

                afficherTransitaires(
                    transitairesFiltres
                );
            }
        );
}


function mettreAJourPaginationTransitaires(
    total,
    totalPages
) {
    const zone =
        document.getElementById(
            "transitaires-page-buttons"
        );

    if (zone) {
        zone.innerHTML = "";

        const pages = [];

        for (
            let page = 1;
            page <= totalPages;
            page++
        ) {
            if (
                page === 1 ||
                page === totalPages ||
                Math.abs(
                    page - pageTransitairesCourante
                ) <= 1
            ) {
                pages.push(page);
            }
        }

        let precedente = 0;

        pages.forEach(
            page => {
                if (
                    precedente &&
                    page - precedente > 1
                ) {
                    const points =
                        document.createElement(
                            "span"
                        );

                    points.textContent = "…";
                    zone.appendChild(points);
                }

                const bouton =
                    document.createElement(
                        "button"
                    );

                bouton.type = "button";
                bouton.className =
                    "pagination-btn" +
                    (
                        page === pageTransitairesCourante
                            ? " active"
                            : ""
                    );

                bouton.textContent =
                    String(page);

                bouton.addEventListener(
                    "click",
                    function () {
                        pageTransitairesCourante =
                            page;

                        afficherTransitaires(
                            transitairesFiltres
                        );
                    }
                );

                zone.appendChild(
                    bouton
                );

                precedente = page;
            }
        );
    }

    const debut =
        total
            ? (
                pageTransitairesCourante - 1
            ) * transitairesParPage + 1
            : 0;

    const fin =
        Math.min(
            pageTransitairesCourante *
            transitairesParPage,
            total
        );

    definirTexteTransitaire(
        "transitaires-pagination-summary",
        `${debut}–${fin} sur ${total}`
    );

    const precedent =
        document.getElementById(
            "previous-transitaire-page-btn"
        );

    const suivant =
        document.getElementById(
            "next-transitaire-page-btn"
        );

    if (precedent) {
        precedent.disabled =
            pageTransitairesCourante <= 1;
    }

    if (suivant) {
        suivant.disabled =
            pageTransitairesCourante >=
            totalPages;
    }
}


function comparerTransitaires(
    a,
    b,
    cle
) {
    return normaliserTexteTransitaire(
        a[cle]
    ).localeCompare(
        normaliserTexteTransitaire(
            b[cle]
        ),
        "fr",
        {
            numeric: true
        }
    );
}


/* ===========================================================
   FICHE DÉTAILLÉE
=========================================================== */

function afficherDetailsTransitaire(
    transitaire
) {
    definirTexteTransitaire(
        "view-transitaire-id",
        transitaire.idTransitaire
    );

    definirTexteTransitaire(
        "view-transitaire-name",
        transitaire.nomTransitaire
    );

    definirTexteTransitaire(
        "view-transitaire-contact-name",
        transitaire.nomContact
    );

    definirTexteTransitaire(
        "view-transitaire-phone",
        formaterTelephoneTransitaire(
            transitaire.telephone
        )
    );

    definirTexteTransitaire(
        "view-transitaire-whatsapp",
        formaterTelephoneTransitaire(
            transitaire.whatsapp
        )
    );

    definirTexteTransitaire(
        "view-transitaire-email",
        transitaire.email
    );

    definirTexteTransitaire(
        "view-transitaire-country",
        transitaire.pays
    );

    definirTexteTransitaire(
        "view-transitaire-city",
        transitaire.ville
    );

    definirTexteTransitaire(
        "view-transitaire-address",
        transitaire.adresse
    );

    definirTexteTransitaire(
        "view-transitaire-transport",
        transitaire.typeTransport
    );

    definirTexteTransitaire(
        "view-transitaire-transport-type",
        transitaire.typeTransport
    );

    definirTexteTransitaire(
        "view-transitaire-average-delay",
        transitaire.delaiMoyen
    );

    definirTexteTransitaire(
        "view-transitaire-currency",
        transitaire.devise
    );

    definirTexteTransitaire(
        "view-transitaire-currency-detail",
        transitaire.devise
    );

    definirTexteTransitaire(
        "view-transitaire-comment",
        transitaire.commentaire
    );

    definirTexteTransitaire(
        "view-transitaire-status",
        transitaire.statut
    );

    definirTexteTransitaire(
        "view-transitaire-avatar",
        obtenirInitialesTransitaire(
            transitaire.nomTransitaire
        )
    );

    const statut =
        document.getElementById(
            "view-transitaire-status"
        );

    if (statut) {
        statut.className =
            "view-transitaire-status " +
            "status-" +
            obtenirClasseStatutTransitaire(
                transitaire.statut
            );
    }
}


/* ===========================================================
   IMPRESSION
=========================================================== */

function initialiserImpressionTransitaires() {
    document
        .getElementById(
            "print-transitaires-btn"
        )
        ?.addEventListener(
            "click",
            imprimerTransitaires
        );
}


function imprimerTransitaires() {
    if (!transitairesFiltres.length) {
        afficherToastTransitaire(
            "Aucun transitaire à imprimer.",
            "error"
        );
        return;
    }

    const fenetre =
        window.open(
            "",
            "_blank",
            "width=1200,height=800"
        );

    if (!fenetre) {
        afficherToastTransitaire(
            "Autorisez les fenêtres contextuelles pour imprimer.",
            "error"
        );
        return;
    }

    const lignes =
        transitairesFiltres
            .map(
                (transitaire, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${echapperHTMLTransitaire(transitaire.idTransitaire)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.nomTransitaire)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.nomContact)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.telephone)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.whatsapp)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.pays)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.ville)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.typeTransport)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.delaiMoyen)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.devise)}</td>
                        <td>${echapperHTMLTransitaire(transitaire.statut)}</td>
                    </tr>
                `
            )
            .join("");

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>VISIBL — Transitaires</title>
            <style>
                @page { size: landscape; margin: 10mm; }
                body { font-family: Arial, sans-serif; color: #0f172a; }
                h1 { margin-bottom: 5px; }
                p { color: #64748b; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; }
                th, td {
                    padding: 6px;
                    font-size: 9px;
                    border: 1px solid #cbd5e1;
                    text-align: left;
                }
                th { background: #e2e8f0; }
                tbody tr:nth-child(even) { background: #f8fafc; }
            </style>
        </head>
        <body>
            <h1>VISIBL — Liste des transitaires</h1>
            <p>
                Imprimé le ${new Date().toLocaleString("fr-FR")}
                • ${transitairesFiltres.length} transitaire(s)
            </p>

            <table>
                <thead>
                    <tr>
                        <th>N°</th>
                        <th>ID</th>
                        <th>Transitaire</th>
                        <th>Contact</th>
                        <th>Téléphone</th>
                        <th>WhatsApp</th>
                        <th>Pays</th>
                        <th>Ville</th>
                        <th>Transport</th>
                        <th>Délai</th>
                        <th>Devise</th>
                        <th>Statut</th>
                    </tr>
                </thead>

                <tbody>
                    ${lignes}
                </tbody>
            </table>
        </body>
        </html>
    `);

    fenetre.document.close();

    fenetre.onload =
        function () {
            fenetre.focus();
            fenetre.print();
        };
}


/* ===========================================================
   EXPORT CSV
=========================================================== */

function initialiserExportTransitaires() {
    document
        .getElementById(
            "export-transitaires-btn"
        )
        ?.addEventListener(
            "click",
            exporterTransitairesCSV
        );
}


function exporterTransitairesCSV() {
    if (!transitairesFiltres.length) {
        afficherToastTransitaire(
            "Aucun transitaire à exporter.",
            "error"
        );
        return;
    }

    const colonnes = [
        "ID Transitaire",
        "Nom du Transitaire",
        "Nom du Contact",
        "Téléphone",
        "WhatsApp",
        "Email",
        "Pays",
        "Ville",
        "Adresse",
        "Type de Transport",
        "Délai Moyen",
        "Devise",
        "Statut",
        "Commentaire"
    ];

    const lignes =
        transitairesFiltres.map(
            transitaire => [
                transitaire.idTransitaire,
                transitaire.nomTransitaire,
                transitaire.nomContact,
                transitaire.telephone,
                transitaire.whatsapp,
                transitaire.email,
                transitaire.pays,
                transitaire.ville,
                transitaire.adresse,
                transitaire.typeTransport,
                transitaire.delaiMoyen,
                transitaire.devise,
                transitaire.statut,
                transitaire.commentaire
            ]
        );

    const proteger =
        valeur =>
            `"${String(valeur || "")
                .replaceAll('"', '""')}"`;

    const csv = [
        colonnes.map(proteger).join(";"),
        ...lignes.map(
            ligne =>
                ligne.map(proteger).join(";")
        )
    ].join("\r\n");

    const blob =
        new Blob(
            ["\ufeff" + csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const lien =
        document.createElement("a");

    lien.href = url;
    lien.download =
        `VISIBL_transitaires_${
            new Date()
                .toISOString()
                .slice(0, 10)
        }.csv`;

    document.body.appendChild(lien);
    lien.click();
    lien.remove();

    URL.revokeObjectURL(url);

    afficherToastTransitaire(
        `${transitairesFiltres.length} transitaire(s) exporté(s).`,
        "success"
    );
}


/* ===========================================================
   NORMALISATION ET OUTILS
=========================================================== */

function normaliserTransitaire(
    transitaire
) {
    return {
        idTransitaire:
            lireValeurTransitaire(
                transitaire,
                [
                    "idTransitaire",
                    "ID Transitaire"
                ]
            ),

        nomTransitaire:
            lireValeurTransitaire(
                transitaire,
                [
                    "nomTransitaire",
                    "Nom du Transitaire"
                ]
            ),

        nomContact:
            lireValeurTransitaire(
                transitaire,
                [
                    "nomContact",
                    "Nom du Contact"
                ]
            ),

        telephone:
            lireValeurTransitaire(
                transitaire,
                [
                    "telephone",
                    "Téléphone"
                ]
            ),

        whatsapp:
            lireValeurTransitaire(
                transitaire,
                [
                    "whatsapp",
                    "WhatsApp"
                ]
            ),

        email:
            lireValeurTransitaire(
                transitaire,
                [
                    "email",
                    "Email"
                ]
            ),

        pays:
            lireValeurTransitaire(
                transitaire,
                [
                    "pays",
                    "Pays"
                ]
            ),

        ville:
            lireValeurTransitaire(
                transitaire,
                [
                    "ville",
                    "Ville"
                ]
            ),

        adresse:
            lireValeurTransitaire(
                transitaire,
                [
                    "adresse",
                    "Adresse"
                ]
            ),

        typeTransport:
            lireValeurTransitaire(
                transitaire,
                [
                    "typeTransport",
                    "Type de Transport"
                ]
            ),

        delaiMoyen:
            lireValeurTransitaire(
                transitaire,
                [
                    "delaiMoyen",
                    "Délai Moyen"
                ]
            ),

        devise:
            lireValeurTransitaire(
                transitaire,
                [
                    "devise",
                    "Devise"
                ]
            ),

        statut:
            lireValeurTransitaire(
                transitaire,
                [
                    "statut",
                    "Statut"
                ]
            ),

        commentaire:
            lireValeurTransitaire(
                transitaire,
                [
                    "commentaire",
                    "Commentaire"
                ]
            )
    };
}


function lireValeurTransitaire(
    objet,
    cles
) {
    for (const cle of cles) {
        if (
            objet &&
            objet[cle] !== undefined &&
            objet[cle] !== null
        ) {
            return String(
                objet[cle]
            ).trim();
        }
    }

    return "";
}


function obtenirValeurTransitaire(id) {
    return String(
        document.getElementById(id)?.value ||
        ""
    ).trim();
}


function definirValeurTransitaire(
    id,
    valeur
) {
    const element =
        document.getElementById(id);

    if (element) {
        element.value =
            valeur ?? "";
    }
}


function definirTexteTransitaire(
    id,
    valeur
) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            String(
                valeur ?? ""
            ).trim() || "—";
    }
}


function afficherMessageFormulaireTransitaire(
    message,
    type
) {
    const zone =
        document.getElementById(
            "transitaire-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent =
        message || "";

    zone.className =
        "form-message" +
        (
            type
                ? ` ${type}`
                : ""
        );
}


function afficherToastTransitaire(
    message,
    type
) {
    if (typeof showToast === "function") {
        showToast(message, type);
        return;
    }

    const conteneur =
        document.getElementById(
            "toast-container"
        );

    if (!conteneur) {
        alert(message);
        return;
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast ${type || "info"}`;

    toast.textContent =
        message;

    conteneur.appendChild(
        toast
    );

    window.setTimeout(
        () => toast.remove(),
        3500
    );
}


function normaliserTexteTransitaire(
    valeur
) {
    return String(
        valeur ?? ""
    )
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9@.+-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        );
}


function obtenirClasseStatutTransitaire(
    statut
) {
    const valeur =
        normaliserTexteTransitaire(
            statut
        ).replaceAll(" ", "-");

    const classes = {
        actif: "actif",
        inactif: "inactif",
        suspendu: "suspendu",
        archive: "archive",
        "archivee": "archive"
    };

    return classes[valeur] ||
        "inconnu";
}


function obtenirInitialesTransitaire(
    nom
) {
    return String(
        nom || "TR"
    )
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(
            mot =>
                mot.charAt(0)
                    .toUpperCase()
        )
        .join("") ||
        "TR";
}


function formaterTelephoneTransitaire(
    telephone
) {
    const numero =
        String(
            telephone || ""
        )
            .replace(/\s+/g, "");

    if (!numero) {
        return "";
    }

    if (
        numero.startsWith("+225") &&
        numero.length === 14
    ) {
        return "+225 " +
            numero
                .slice(4)
                .match(/.{1,2}/g)
                .join(" ");
    }

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


function echapperHTMLTransitaire(
    valeur
) {
    return String(
        valeur ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
