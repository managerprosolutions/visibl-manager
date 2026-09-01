/* ===========================================================
   VISIBL ERP — caisse.js
   Frontend Caisse connecté au backend réel
   Actions API :
   - GET  getOperationsCaisse
   - POST createOperationCaisse
=========================================================== */

let operationsCaisseChargees = [];
let operationsCaisseAffichees = [];
let rechercheCaisse = "";
let operationCaisseSelectionnee = null;
let menuActionCaisseActif = null;
let parametresFinanceCaisse = {formatMontant:"nombre-devise",nombreDecimales:0,libelleDevise:"FCFA",modeEspeces:true,modeMobileMoney:true,modeVirement:true,modeCheque:true,modeCarteBancaire:true};


/* ===========================================================
   CLOUDINARY — JUSTIFICATIFS CAISSE
   Même compte / preset que le module Produits.
=========================================================== */

const CLOUDINARY_CAISSE_CONFIG = {
    cloudName: "yqfbfg84",
    uploadPreset: "visibl_upload",
    dossier: "visibl/caisse/justificatifs"
};

const TAILLE_MAX_JUSTIFICATIF_CAISSE =
    20 * 1024 * 1024;

const TYPES_JUSTIFICATIF_CAISSE_AUTORISES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf"
];

const EXTENSIONS_JUSTIFICATIF_CAISSE_AUTORISEES = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "heic",
    "heif",
    "pdf"
];

let justificatifCaisseSelectionne = null;
let promesseUploadJustificatifCaisse = null;
let urlJustificatifCaisseTeleversee = "";
let versionUploadJustificatifCaisse = 0;


const CATEGORIES_CAISSE = {
    entree: [
        { value: "apport", label: "Apport" },
        { value: "pret-recu", label: "Prêt reçu" },
        { value: "remboursement-recu", label: "Remboursement reçu" },
        { value: "autres", label: "Autres" }
    ],
    sortie: [
        { value: "salaire", label: "Salaire" },
        { value: "loyer", label: "Loyer" },
        { value: "electricite", label: "Électricité" },
        { value: "eau", label: "Eau" },
        { value: "internet", label: "Internet" },
        { value: "publicite", label: "Publicité" },
        { value: "autres", label: "Autres" }
    ],
    ajustement: [
        { value: "ecart-caisse", label: "Écart de caisse" },
        { value: "correction-solde", label: "Correction de solde" },
        { value: "erreur-saisie", label: "Erreur de saisie" },
        { value: "autres", label: "Autres" }
    ],
    transfert: [
        { value: "reequilibrage", label: "Rééquilibrage de trésorerie" },
        { value: "depot-banque", label: "Dépôt vers Banque" },
        { value: "transfert-mobile-money", label: "Transfert vers Mobile Money" },
        { value: "retrait-mobile-money", label: "Retrait depuis Mobile Money" },
        { value: "autres", label: "Autres" }
    ]
};

const ETAT_CAISSE = {
    soldesParCompte: {
        "Caisse principale": 0,
        "Banque": 0,
        "Wave Business": 0,
        "Orange Money Business": 0
    },
    soldeGlobal: 0,
    resumeMois: null
};


/* ===========================================================
   INITIALISATION
=========================================================== */

function initialiserCaisse() {
    if (
        typeof requireAuth === "function" &&
        !requireAuth()
    ) {
        return;
    }

    initialiserFormulaireCaisse();
    initialiserUploadJustificatifCaisse();
    initialiserRechercheFiltresCaisse();
    initialiserActionsCaisse();

    chargerParametresFinanceCaisse().finally(chargerOperationsCaisse);
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserCaisse
    );
} else {
    initialiserCaisse();
}


/* ===========================================================
   FORMULAIRE
=========================================================== */

function initialiserFormulaireCaisse() {
    const modal =
        document.getElementById("cash-operation-modal");

    const formulaire =
        document.getElementById("cash-operation-form");

    const type =
        document.getElementById("cash-operation-type");

    const categorie =
        document.getElementById("cash-operation-reason");

    const compteSource =
        document.getElementById("cash-operation-account");

    const compteDestination =
        document.getElementById("cash-destination-account");

    document
        .getElementById("new-cash-operation-btn")
        ?.addEventListener(
            "click",
            ouvrirModalCaisse
        );

    document
        .getElementById("close-cash-operation-modal")
        ?.addEventListener(
            "click",
            fermerModalCaisse
        );

    document
        .getElementById("cancel-cash-operation-btn")
        ?.addEventListener(
            "click",
            fermerModalCaisse
        );

    modal?.addEventListener(
        "click",
        function(event) {
            if (event.target === modal) {
                fermerModalCaisse();
            }
        }
    );

    document.addEventListener(
        "keydown",
        function(event) {
            if (
                event.key === "Escape" &&
                modal?.classList.contains("active")
            ) {
                fermerModalCaisse();
            }
        }
    );

    type?.addEventListener(
        "change",
        mettreAJourFormulaireSelonTypeCaisse
    );

    categorie?.addEventListener(
        "change",
        mettreAJourFormulaireSelonCategorieCaisse
    );

    compteDestination?.addEventListener(
        "change",
        function() {
            if (
                compteSource?.value &&
                compteDestination.value ===
                    compteSource.value
            ) {
                afficherToastCaisse(
                    "Le compte destination doit être différent du compte source.",
                    "error"
                );

                compteDestination.value = "";
            }
        }
    );

    formulaire?.addEventListener(
        "submit",
        enregistrerOperationCaisse
    );

    reinitialiserAffichageConditionnelCaisse();
}


function ouvrirModalCaisse() {
    const modal =
        document.getElementById("cash-operation-modal");

    const formulaire =
        document.getElementById("cash-operation-form");

    formulaire?.reset();
    reinitialiserJustificatifCaisse();
    reinitialiserAffichageConditionnelCaisse();

    modal?.classList.add("active");
    modal?.setAttribute(
        "aria-hidden",
        "false"
    );

    document
        .getElementById("cash-operation-type")
        ?.focus();
}


function fermerModalCaisse() {
    const modal =
        document.getElementById("cash-operation-modal");

    modal?.classList.remove("active");
    modal?.setAttribute(
        "aria-hidden",
        "true"
    );
}


function reinitialiserAffichageConditionnelCaisse() {
    masquerSectionCaisse(
        "cash-adjustment-section",
        true
    );

    masquerSectionCaisse(
        "cash-transfer-section",
        true
    );

    masquerSectionCaisse(
        "salary-details-section",
        true
    );

    masquerSectionCaisse(
        "cash-proof-section",
        true
    );

    masquerSectionCaisse(
        "cash-other-reason-group",
        true
    );

    masquerSectionCaisse(
        "cash-category-section",
        false
    );

    masquerSectionCaisse(
        "cash-payment-method-group",
        false
    );

    definirChampRequisCaisse(
        "cash-operation-method",
        false
    );

    definirChampRequisCaisse(
        "cash-operation-reason",
        false
    );

    definirChampRequisCaisse(
        "cash-operation-other-reason",
        false
    );

    definirChampRequisCaisse(
        "cash-adjustment-direction",
        false
    );

    definirChampRequisCaisse(
        "cash-adjustment-reason",
        false
    );

    definirChampRequisCaisse(
        "cash-destination-account",
        false
    );

    definirChampRequisCaisse(
        "salary-employee-name",
        false
    );

    definirChampRequisCaisse(
        "salary-period",
        false
    );

    definirChampRequisCaisse(
        "cash-proof-file",
        false
    );
}


function mettreAJourFormulaireSelonTypeCaisse() {
    reinitialiserAffichageConditionnelCaisse();

    const type = normaliserTexteCaisseFront(
        document.getElementById("cash-operation-type")?.value
    );

    const mouvementSimple = type === "entree" || type === "sortie";
    const ajustement = type === "ajustement";
    const transfert = type === "transfert";

    masquerSectionCaisse("cash-category-section", !type);
    definirChampRequisCaisse("cash-operation-reason", Boolean(type));
    remplirCategoriesCaisse(type);

    masquerSectionCaisse("cash-payment-method-group", !mouvementSimple);
    definirChampRequisCaisse("cash-operation-method", mouvementSimple);

    const labelMode = document.getElementById("cash-operation-method-label");
    if (labelMode) {
        labelMode.innerHTML =
            type === "entree"
                ? 'Moyen de réception <span class="required">*</span>'
                : 'Moyen de paiement <span class="required">*</span>';
    }

    masquerSectionCaisse("cash-adjustment-section", !ajustement);
    definirChampRequisCaisse("cash-adjustment-direction", ajustement);
    definirChampRequisCaisse("cash-adjustment-reason", false);

    masquerSectionCaisse("cash-transfer-section", !transfert);
    definirChampRequisCaisse("cash-destination-account", transfert);

    mettreAJourFormulaireSelonCategorieCaisse();
}


function mettreAJourFormulaireSelonCategorieCaisse() {
    const type = normaliserTexteCaisseFront(
        document.getElementById("cash-operation-type")?.value
    );

    const categorie = normaliserTexteCaisseFront(
        document.getElementById("cash-operation-reason")?.value
    );

    const autres = categorie === "autres";
    const salaire = type === "sortie" && categorie === "salaire";
    const justificatifObligatoire =
        type === "sortie" &&
        ["loyer", "eau", "electricite"].includes(categorie);

    masquerSectionCaisse("cash-other-reason-group", !autres);
    definirChampRequisCaisse("cash-operation-other-reason", autres);

    masquerSectionCaisse("salary-details-section", !salaire);
    definirChampRequisCaisse("salary-employee-name", salaire);
    definirChampRequisCaisse("salary-period", salaire);

    masquerSectionCaisse("cash-proof-section", !justificatifObligatoire);
    definirChampRequisCaisse("cash-proof-file", justificatifObligatoire);

    if (!justificatifObligatoire) {
        reinitialiserJustificatifCaisse();
    }
}



function remplirCategoriesCaisse(type) {
    const select = document.getElementById("cash-operation-reason");
    if (!select) return;

    const options = CATEGORIES_CAISSE[type] || [];
    select.innerHTML =
        '<option value="">Sélectionner</option>' +
        options.map(option =>
            `<option value="${option.value}">${option.label}</option>`
        ).join("");

    const titre = document.getElementById("cash-category-title");
    const description = document.getElementById("cash-category-description");

    if (titre) {
        titre.textContent =
            type === "entree" ? "Motif de l’entrée" :
            type === "sortie" ? "Motif de la sortie" :
            type === "ajustement" ? "Motif de l’ajustement" :
            type === "transfert" ? "Motif du transfert" :
            "Catégorie et motif";
    }

    if (description) {
        description.textContent =
            type === "entree" ? "Indiquez l’origine de cette entrée manuelle." :
            type === "sortie" ? "Indiquez la nature de cette dépense." :
            type === "ajustement" ? "Indiquez la raison de la correction." :
            type === "transfert" ? "Indiquez la raison du déplacement de trésorerie." :
            "Choisissez la raison de l’opération.";
    }
}

function masquerSectionCaisse(
    id,
    masquer
) {
    const element =
        document.getElementById(id);

    if (element) {
        element.hidden =
            Boolean(masquer);
    }
}


function definirChampRequisCaisse(
    id,
    requis
) {
    const element =
        document.getElementById(id);

    if (element) {
        element.required =
            Boolean(requis);
    }
}



/* ===========================================================
   JUSTIFICATIF — CLOUDINARY
=========================================================== */

function initialiserUploadJustificatifCaisse() {
    const champFichier =
        document.getElementById(
            "cash-proof-file"
        );

    if (!champFichier) {
        return;
    }

    champFichier.addEventListener(
        "change",
        function() {
            const fichier =
                champFichier.files?.[0] ||
                null;

            if (!fichier) {
                reinitialiserJustificatifCaisse(
                    false
                );
                return;
            }

            traiterJustificatifCaisse(
                fichier
            );
        }
    );
}


function traiterJustificatifCaisse(fichier) {
    if (
        !fichier ||
        !estJustificatifCaisseAutorise(
            fichier
        )
    ) {
        afficherEtatUploadJustificatifCaisse(
            "Format non autorisé. Utilisez JPG, JPEG, PNG, WEBP, HEIC, HEIF ou PDF.",
            "error"
        );

        viderChampFichierJustificatifCaisse();

        return;
    }

    if (
        fichier.size >
        TAILLE_MAX_JUSTIFICATIF_CAISSE
    ) {
        afficherEtatUploadJustificatifCaisse(
            "Le justificatif dépasse la taille maximale de 20 Mo.",
            "error"
        );

        viderChampFichierJustificatifCaisse();

        return;
    }

    justificatifCaisseSelectionne =
        fichier;

    afficherApercuJustificatifCaisse(
        fichier
    );

    /*
     * Le fichier reste local jusqu'à la création de l'opération.
     * L'upload Cloudinary démarre ensuite en arrière-plan.
     */
    afficherEtatUploadJustificatifCaisse(
        "Justificatif sélectionné. Il sera envoyé automatiquement après l’enregistrement.",
        "info"
    );
}


function estJustificatifCaisseAutorise(
    fichier
) {
    const type =
        String(
            fichier?.type ||
            ""
        )
            .trim()
            .toLowerCase();

    if (
        TYPES_JUSTIFICATIF_CAISSE_AUTORISES.includes(
            type
        )
    ) {
        return true;
    }

    const nom =
        String(
            fichier?.name ||
            ""
        );

    const extension =
        nom.includes(".")
            ? nom
                .split(".")
                .pop()
                .toLowerCase()
            : "";

    return (
        EXTENSIONS_JUSTIFICATIF_CAISSE_AUTORISEES.includes(
            extension
        )
    );
}


function configurationCloudinaryCaisseValide() {
    return Boolean(
        CLOUDINARY_CAISSE_CONFIG.cloudName &&
        CLOUDINARY_CAISSE_CONFIG.uploadPreset
    );
}


async function lancerUploadJustificatifCaisseEnArrierePlan(
    fichier
) {
    const versionCourante =
        ++versionUploadJustificatifCaisse;

    urlJustificatifCaisseTeleversee =
        "";

    const champURL =
        document.getElementById(
            "cash-proof-url"
        );

    if (champURL) {
        champURL.value = "";
    }

    afficherEtatUploadJustificatifCaisse(
        "Envoi du justificatif vers Cloudinary...",
        "info"
    );

    promesseUploadJustificatifCaisse =
        (async () => {
            try {
                const url =
                    await envoyerJustificatifCaisseVersCloudinary(
                        fichier
                    );

                if (
                    versionCourante !==
                    versionUploadJustificatifCaisse
                ) {
                    return {
                        success: true,
                        url: url,
                        obsolete: true
                    };
                }

                urlJustificatifCaisseTeleversee =
                    url;

                if (champURL) {
                    champURL.value =
                        url;
                }

                mettreAJourLienJustificatifCaisse(
                    fichier,
                    url
                );

                afficherEtatUploadJustificatifCaisse(
                    "Justificatif prêt. Vous pouvez enregistrer l’opération.",
                    "success"
                );

                return {
                    success: true,
                    url: url
                };

            } catch (error) {
                if (
                    versionCourante !==
                    versionUploadJustificatifCaisse
                ) {
                    return {
                        success: false,
                        obsolete: true
                    };
                }

                console.error(
                    "Erreur upload justificatif Cloudinary :",
                    error
                );

                urlJustificatifCaisseTeleversee =
                    "";

                if (champURL) {
                    champURL.value =
                        "";
                }

                afficherEtatUploadJustificatifCaisse(
                    error.message ||
                    "Impossible d’envoyer le justificatif vers Cloudinary.",
                    "error"
                );

                return {
                    success: false,
                    error: error
                };
            }
        })();

    return promesseUploadJustificatifCaisse;
}


async function envoyerJustificatifCaisseVersCloudinary(
    fichier
) {
    if (!fichier) {
        return "";
    }

    if (
        !configurationCloudinaryCaisseValide()
    ) {
        throw new Error(
            "Cloudinary n’est pas configuré pour la Caisse."
        );
    }

    const donnees =
        new FormData();

    donnees.append(
        "file",
        fichier
    );

    donnees.append(
        "upload_preset",
        CLOUDINARY_CAISSE_CONFIG.uploadPreset
    );

    if (
        CLOUDINARY_CAISSE_CONFIG.dossier
    ) {
        donnees.append(
            "folder",
            CLOUDINARY_CAISSE_CONFIG.dossier
        );
    }

    /*
     * resource_type=auto permet à Cloudinary de détecter
     * automatiquement une image ou un PDF.
     */
    const url =
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(
            CLOUDINARY_CAISSE_CONFIG.cloudName
        )}/image/upload`;

    const controleur =
        typeof AbortController !==
        "undefined"
            ? new AbortController()
            : null;

    const delaiMaximum =
        setTimeout(
            function() {
                controleur?.abort();
            },
            90000
        );

    try {
        const reponse =
            await fetch(
                url,
                {
                    method: "POST",
                    body: donnees,
                    signal:
                        controleur?.signal
                }
            );

        const resultat =
            await reponse.json();

        if (
            !reponse.ok ||
            !resultat?.secure_url
        ) {
            throw new Error(
                resultat?.error?.message ||
                "Échec de l’envoi du justificatif vers Cloudinary."
            );
        }

        return resultat.secure_url;

    } catch (error) {
        if (
            error?.name ===
            "AbortError"
        ) {
            throw new Error(
                "L’envoi du justificatif a pris trop de temps. Vérifiez votre connexion puis réessayez."
            );
        }

        throw error;

    } finally {
        clearTimeout(
            delaiMaximum
        );
    }
}


function afficherApercuJustificatifCaisse(
    fichier
) {
    const preview =
        document.getElementById(
            "cash-proof-preview"
        );

    const nom =
        document.getElementById(
            "cash-proof-file-name"
        );

    const lien =
        document.getElementById(
            "cash-proof-preview-link"
        );

    if (nom) {
        nom.textContent =
            fichier?.name ||
            "Justificatif";
    }

    if (lien) {
        lien.removeAttribute(
            "href"
        );

        lien.style.pointerEvents =
            "none";

        lien.setAttribute(
            "aria-disabled",
            "true"
        );

        lien.textContent =
            "Prêt à envoyer";
    }

    if (preview) {
        preview.hidden = false;
    }
}


function mettreAJourLienJustificatifCaisse(
    fichier,
    url
) {
    const preview =
        document.getElementById(
            "cash-proof-preview"
        );

    const nom =
        document.getElementById(
            "cash-proof-file-name"
        );

    const lien =
        document.getElementById(
            "cash-proof-preview-link"
        );

    if (nom) {
        nom.textContent =
            fichier?.name ||
            "Justificatif";
    }

    if (lien) {
        lien.href =
            url;

        lien.style.pointerEvents =
            "";

        lien.removeAttribute(
            "aria-disabled"
        );

        lien.textContent =
            "Voir le justificatif";
    }

    if (preview) {
        preview.hidden = false;
    }
}


function afficherEtatUploadJustificatifCaisse(
    message,
    type = "info"
) {
    const zone =
        document.getElementById(
            "cash-proof-upload-status"
        );

    if (!zone) {
        return;
    }

    zone.hidden = false;
    zone.textContent =
        message;

    zone.dataset.status =
        type;
}


function reinitialiserJustificatifCaisse(
    viderChamp = true
) {
    justificatifCaisseSelectionne =
        null;

    versionUploadJustificatifCaisse++;

    promesseUploadJustificatifCaisse =
        null;

    urlJustificatifCaisseTeleversee =
        "";

    if (viderChamp) {
        viderChampFichierJustificatifCaisse();
    }

    const champURL =
        document.getElementById(
            "cash-proof-url"
        );

    const zoneEtat =
        document.getElementById(
            "cash-proof-upload-status"
        );

    const preview =
        document.getElementById(
            "cash-proof-preview"
        );

    const nom =
        document.getElementById(
            "cash-proof-file-name"
        );

    const lien =
        document.getElementById(
            "cash-proof-preview-link"
        );

    if (champURL) {
        champURL.value = "";
    }

    if (zoneEtat) {
        zoneEtat.hidden = true;
        zoneEtat.textContent = "";
        delete zoneEtat.dataset.status;
    }

    if (preview) {
        preview.hidden = true;
    }

    if (nom) {
        nom.textContent = "";
    }

    if (lien) {
        lien.href = "#";
        lien.textContent =
            "Voir le justificatif";
        lien.style.pointerEvents =
            "";
        lien.removeAttribute(
            "aria-disabled"
        );
    }
}


function viderChampFichierJustificatifCaisse() {
    const champ =
        document.getElementById(
            "cash-proof-file"
        );

    if (champ) {
        champ.value = "";
    }
}


async function obtenirURLJustificatifCaisse(
    fichier
) {
    const urlExistante =
        urlJustificatifCaisseTeleversee ||
        document
            .getElementById(
                "cash-proof-url"
            )
            ?.value
            ?.trim() ||
        "";

    if (urlExistante) {
        return urlExistante;
    }

    if (!fichier) {
        return "";
    }

    if (
        !promesseUploadJustificatifCaisse
    ) {
        lancerUploadJustificatifCaisseEnArrierePlan(
            fichier
        );
    }

    const resultat =
        await promesseUploadJustificatifCaisse;

    if (
        !resultat?.success ||
        !resultat?.url
    ) {
        throw (
            resultat?.error ||
            new Error(
                "Le justificatif n’a pas pu être envoyé vers Cloudinary."
            )
        );
    }

    return resultat.url;
}


/* ===========================================================
   ENREGISTREMENT
=========================================================== */

async function enregistrerOperationCaisse(
    event
) {
    event.preventDefault();

    const formulaire =
        document.getElementById(
            "cash-operation-form"
        );

    const bouton =
        document.getElementById(
            "save-cash-operation-btn"
        );

    if (
        !formulaire ||
        formulaire.dataset.processing === "true"
    ) {
        return;
    }

    const typeMouvement =
        normaliserTexteCaisseFront(
            document
                .getElementById("cash-operation-type")
                ?.value
        );

    const compteCaisse =
        document
            .getElementById("cash-operation-account")
            ?.value ||
        "";

    const montant =
        convertirMontantCaisseFront(
            document
                .getElementById("cash-operation-amount")
                ?.value
        );

    const categorieValeur =
        document
            .getElementById("cash-operation-reason")
            ?.value ||
        "";

    const modeValeur =
        document
            .getElementById("cash-operation-method")
            ?.value ||
        "";

    const compteDestination =
        document
            .getElementById("cash-destination-account")
            ?.value ||
        "";

    const directionAjustement =
        document
            .getElementById("cash-adjustment-direction")
            ?.value ||
        "";

    const motifAutre =
        document
            .getElementById("cash-operation-other-reason")
            ?.value
            ?.trim() ||
        "";

    const motifAjustement =
        obtenirLibelleCategorieCaisse(
            typeMouvement,
            categorieValeur,
            motifAutre
        );

    const nomEmploye =
        document
            .getElementById("salary-employee-name")
            ?.value
            ?.trim() ||
        "";

    const periodeSalaire =
        document
            .getElementById("salary-period")
            ?.value ||
        "";

    const commentaire =
        document
            .getElementById("cash-operation-note")
            ?.value
            ?.trim() ||
        "";

    const fichierJustificatif =
        document
            .getElementById("cash-proof-file")
            ?.files?.[0] ||
        null;

    const justificatifObligatoire =
        typeMouvement === "sortie" &&
        [
            "loyer",
            "eau",
            "electricite"
        ].includes(
            normaliserTexteCaisseFront(
                categorieValeur
            )
        );

    if (
        !typeMouvement ||
        !compteCaisse ||
        montant <= 0
    ) {
        afficherToastCaisse(
            "Complétez le type, le compte et le montant.",
            "error"
        );
        return;
    }

    if (!categorieValeur) {
        afficherToastCaisse(
            "Sélectionnez le motif de l’opération.",
            "error"
        );
        return;
    }

    if (
        normaliserTexteCaisseFront(categorieValeur) === "autres" &&
        !motifAutre
    ) {
        afficherToastCaisse(
            "Précisez le motif dans le champ Autres.",
            "error"
        );
        return;
    }

    if (
        justificatifObligatoire &&
        !fichierJustificatif &&
        !urlJustificatifCaisseTeleversee
    ) {
        afficherToastCaisse(
            "Ajoutez un justificatif avant d’enregistrer cette dépense.",
            "error"
        );

        return;
    }

    if (
        typeMouvement === "transfert" &&
        compteCaisse === compteDestination
    ) {
        afficherToastCaisse(
            "Le compte source et le compte destination doivent être différents.",
            "error"
        );
        return;
    }

    const categorie =
        obtenirCategorieBackendCaisse(
            categorieValeur,
            typeMouvement
        );

    const modePaiement =
        obtenirModePaiementBackendCaisse(
            modeValeur
        );

    /*
     * L'opération financière est créée avant l'upload.
     * Si un fichier est présent, le backend reçoit PENDING.
     */
    let urlJustificatif =
        fichierJustificatif ? "PENDING" : "";

    formulaire.dataset.processing =
        "true";

    if (bouton) {
        bouton.disabled = true;
        bouton.classList.add(
            "is-loading"
        );
    }

    try {
        const data = {
            typeMouvement:
                typeMouvement,

            compteCaisse:
                compteCaisse,

            montant:
                montant,

            categorie:
                categorie,

            modePaiement:
                modePaiement,

            motifAutre:
                motifAutre,

            directionAjustement:
                directionAjustement,

            motifAjustement:
                motifAjustement,

            compteDestination:
                compteDestination,

            nomEmploye:
                nomEmploye,

            periodeSalaire:
                periodeSalaire,

            commentaire:
                commentaire,

            origine:
                "Caisse",

            idOrigine:
                "",

            idUtilisateur:
                obtenirIdUtilisateurCaisse(),

            /*
             * L'URL Cloudinary est maintenant enregistrée
             * dans la colonne Justificatif du backend.
             */
            justificatifUrl:
                urlJustificatif,

            justificatif:
                urlJustificatif,

            nomJustificatif:
                fichierJustificatif
                    ? fichierJustificatif.name
                    : "",

            typeJustificatif:
                fichierJustificatif
                    ? fichierJustificatif.type
                    : ""
        };

        const resultat =
            await apiPost(
                "createOperationCaisse",
                data
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer l'opération."
            );
        }

        const operationCreee =
            resultat.operation ||
            resultat.data ||
            {};

        const idMouvementCree =
            operationCreee.idMouvement ||
            resultat.idMouvement ||
            "";

        afficherToastCaisse(
            resultat.message ||
            "Opération enregistrée avec succès.",
            "success"
        );

        /*
         * On conserve une référence vers le File avant de réinitialiser
         * le formulaire. L'upload continue sans bloquer l'utilisateur.
         */
        if (fichierJustificatif && idMouvementCree) {
            envoyerEtRattacherJustificatifCaisseEnArrierePlan(
                idMouvementCree,
                fichierJustificatif
            );
        }

        fermerModalCaisse();
        formulaire.reset();
        reinitialiserJustificatifCaisse();

        await chargerOperationsCaisse();

    } catch (error) {
        console.error(
            "Erreur enregistrement caisse :",
            error
        );

        afficherToastCaisse(
            error.message ||
            "Impossible d'enregistrer l'opération.",
            "error"
        );

    } finally {
        formulaire.dataset.processing =
            "false";

        if (bouton) {
            bouton.disabled = false;
            bouton.classList.remove(
                "is-loading"
            );
        }
    }
}



/* ===========================================================
   JUSTIFICATIF — RATTACHEMENT ASYNCHRONE
=========================================================== */

const fichiersJustificatifsCaisseAReessayer = new Map();

async function envoyerEtRattacherJustificatifCaisseEnArrierePlan(
    idMouvement,
    fichier
) {
    const id = String(idMouvement || "").trim();
    if (!id || !fichier) return;

    fichiersJustificatifsCaisseAReessayer.set(id, fichier);

    try {
        const url = await envoyerJustificatifCaisseVersCloudinary(fichier);

        const resultat = await apiPost(
            "updateJustificatifCaisse",
            {
                idMouvement: id,
                justificatifUrl: url,
                justificatif: url,
                statutJustificatif: "SUCCESS"
            }
        );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de rattacher le justificatif à l’opération."
            );
        }

        fichiersJustificatifsCaisseAReessayer.delete(id);

        const operationLocale = operationCaisseParId(id);
        if (operationLocale) {
            operationLocale.justificatif = url;
        }

        afficherTableauCaisse();

    } catch (error) {
        console.error(
            "Erreur upload/rattachement justificatif :",
            error
        );

        try {
            await apiPost(
                "updateJustificatifCaisse",
                {
                    idMouvement: id,
                    justificatif: "ERROR",
                    statutJustificatif: "ERROR"
                }
            );
        } catch (erreurStatut) {
            console.error(
                "Impossible de marquer le justificatif en échec :",
                erreurStatut
            );
        }

        const operationLocale = operationCaisseParId(id);
        if (operationLocale) {
            operationLocale.justificatif = "ERROR";
        }

        afficherTableauCaisse();

        afficherToastCaisse(
            "L’opération est enregistrée, mais le justificatif n’a pas pu être envoyé. Vous pouvez réessayer depuis Actions.",
            "error"
        );
    }
}

async function reessayerEnvoiJustificatifCaisse(operation) {
    const id = String(operation?.idMouvement || "").trim();
    const fichier = fichiersJustificatifsCaisseAReessayer.get(id);

    if (!fichier) {
        afficherToastCaisse(
            "Le fichier original n’est plus disponible dans ce navigateur. Ouvrez le détail de l’opération pour rattacher un nouveau justificatif ultérieurement.",
            "error"
        );
        return;
    }

    operation.justificatif = "PENDING";
    afficherTableauCaisse();

    envoyerEtRattacherJustificatifCaisseEnArrierePlan(
        id,
        fichier
    );
}

function estJustificatifCaisseEnAttente(valeur) {
    return normaliserTexteCaisseFront(valeur) === "pending";
}

function estJustificatifCaisseEnErreur(valeur) {
    return ["error", "failed", "echec"].includes(
        normaliserTexteCaisseFront(valeur)
    );
}

/* ===========================================================
   CHARGEMENT API
=========================================================== */

async function chargerOperationsCaisse() {
    try {
        const resultat =
            await apiGet(
                "getOperationsCaisse"
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger la caisse."
            );
        }

        operationsCaisseChargees =
            Array.isArray(
                resultat.operations
            )
                ? resultat.operations
                : (
                    Array.isArray(
                        resultat.data
                    )
                        ? resultat.data
                        : []
                );

        ETAT_CAISSE.soldesParCompte =
            resultat.soldesParCompte ||
            ETAT_CAISSE.soldesParCompte;

        ETAT_CAISSE.soldeGlobal =
            convertirMontantCaisseFront(
                resultat.soldeGlobal
            );

        ETAT_CAISSE.resumeMois =
            resultat.resumeMois ||
            null;

        mettreAJourKpisCaisse();
        appliquerFiltresCaisse();

    } catch (error) {
        console.error(
            "Erreur chargement caisse :",
            error
        );

        operationsCaisseChargees = [];
        operationsCaisseAffichees = [];

        afficherTableauCaisse();

        afficherToastCaisse(
            error.message ||
            "Impossible de charger les opérations de caisse.",
            "error"
        );
    }
}


/* ===========================================================
   KPI — DONNÉES BACKEND
=========================================================== */

function mettreAJourKpisCaisse() {
    const resume =
        ETAT_CAISSE.resumeMois ||
        {};

    const soldes =
        ETAT_CAISSE.soldesParCompte ||
        {};

    definirTexteCaisse(
        "cash-balance-value",
        formaterMontantCaisseFront(
            ETAT_CAISSE.soldeGlobal
        )
    );

    definirTexteCaisse(
        "cash-income-value",
        formaterMontantCaisseFront(
            resume.entrees || 0
        )
    );

    definirTexteCaisse(
        "cash-expense-value",
        formaterMontantCaisseFront(
            resume.sorties || 0
        )
    );

    definirTexteCaisse(
        "cash-operations-value",
        String(
            resume.operations || 0
        )
    );

    definirTexteCaisse(
        "cash-account-main-value",
        formaterMontantCaisseFront(
            soldes["Caisse principale"] || 0
        )
    );

    definirTexteCaisse(
        "cash-account-bank-value",
        formaterMontantCaisseFront(
            soldes["Banque"] || 0
        )
    );

    definirTexteCaisse(
        "cash-account-wave-value",
        formaterMontantCaisseFront(
            soldes["Wave Business"] || 0
        )
    );

    definirTexteCaisse(
        "cash-account-orange-value",
        formaterMontantCaisseFront(
            soldes["Orange Money Business"] || 0
        )
    );
}


/* ===========================================================
   RECHERCHE / FILTRES
=========================================================== */

function initialiserRechercheFiltresCaisse() {
    const recherchePage =
        document.getElementById(
            "cash-search-input"
        );

    const rechercheHeader =
        document.querySelector(
            ".header .search-input"
        );

    const boutonRechercheHeader =
        document.querySelector(
            ".header .search-btn"
        );

    function synchroniserRecherche(
        valeur,
        source
    ) {
        rechercheCaisse =
            String(
                valeur ?? ""
            );

        if (
            recherchePage &&
            source !== recherchePage
        ) {
            recherchePage.value =
                rechercheCaisse;
        }

        if (
            rechercheHeader &&
            source !== rechercheHeader
        ) {
            rechercheHeader.value =
                rechercheCaisse;
        }

        appliquerFiltresCaisse();
    }

    recherchePage?.addEventListener(
        "input",
        function() {
            synchroniserRecherche(
                recherchePage.value,
                recherchePage
            );
        }
    );

    rechercheHeader?.addEventListener(
        "input",
        function() {
            synchroniserRecherche(
                rechercheHeader.value,
                rechercheHeader
            );
        }
    );

    boutonRechercheHeader?.addEventListener(
        "click",
        function(event) {
            event.preventDefault();

            synchroniserRecherche(
                rechercheHeader?.value || "",
                rechercheHeader
            );
        }
    );

    [
        "cash-type-filter",
        "cash-origin-filter",
        "cash-method-filter"
    ].forEach(
        function(id) {
            document
                .getElementById(id)
                ?.addEventListener(
                    "change",
                    appliquerFiltresCaisse
                );
        }
    );

    document
        .getElementById("reset-cash-filters")
        ?.addEventListener(
            "click",
            reinitialiserFiltresCaisse
        );
}


function appliquerFiltresCaisse() {
    const terme =
        normaliserTexteCaisseFront(
            rechercheCaisse
        );

    const filtreType =
        normaliserTexteCaisseFront(
            document
                .getElementById("cash-type-filter")
                ?.value
        );

    const filtreOrigine =
        normaliserTexteCaisseFront(
            document
                .getElementById("cash-origin-filter")
                ?.value
        );

    const filtreMode =
        normaliserTexteCaisseFront(
            document
                .getElementById("cash-method-filter")
                ?.value
        );

    operationsCaisseAffichees =
        operationsCaisseChargees.filter(
            function(operation) {
                const recherche =
                    normaliserTexteCaisseFront(
                        [
                            operation.idMouvement,
                            operation.reference,
                            operation.compteCaisse,
                            operation.typeMouvement,
                            operation.categorie,
                            operation.origine,
                            operation.idOrigine,
                            operation.modePaiement,
                            operation.commentaire,
                            operation.idUtilisateur,
                            operation.compteDestination
                        ].join(" ")
                    );

                const type =
                    normaliserTexteCaisseFront(
                        operation.typeMouvement ||
                        operation.type
                    );

                const origine =
                    normaliserTexteCaisseFront(
                        operation.origine
                    );

                const mode =
                    normaliserTexteCaisseFront(
                        operation.modePaiement
                    );

                return (
                    (!terme ||
                        recherche.includes(
                            terme
                        )) &&
                    (!filtreType ||
                        type === filtreType) &&
                    (!filtreOrigine ||
                        origine === filtreOrigine) &&
                    (!filtreMode ||
                        mode === filtreMode)
                );
            }
        );

    afficherTableauCaisse();

    definirTexteCaisse(
        "filtered-cash-count",
        String(
            operationsCaisseAffichees.length
        )
    );
}


function reinitialiserFiltresCaisse() {
    rechercheCaisse = "";

    const recherchePage =
        document.getElementById(
            "cash-search-input"
        );

    const rechercheHeader =
        document.querySelector(
            ".header .search-input"
        );

    if (recherchePage) {
        recherchePage.value = "";
    }

    if (rechercheHeader) {
        rechercheHeader.value = "";
    }

    [
        "cash-type-filter",
        "cash-origin-filter",
        "cash-method-filter"
    ].forEach(
        function(id) {
            const element =
                document.getElementById(id);

            if (element) {
                element.value = "";
            }
        }
    );

    appliquerFiltresCaisse();
}


/* ===========================================================
   TABLEAU
=========================================================== */

function afficherTableauCaisse() {
    const tbody =
        document.getElementById(
            "cash-table-body"
        );

    if (!tbody) {
        return;
    }

    if (
        !operationsCaisseAffichees.length
    ) {
        tbody.innerHTML = `
            <tr>
                <td
                    colspan="13"
                    class="empty-table"
                >
                    Aucune opération de caisse.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML =
        operationsCaisseAffichees
            .map(
                construireLigneCaisse
            )
            .join("");
}


function construireLigneCaisse(operation) {
    const type = normaliserTexteCaisseFront(
        operation.typeMouvement || operation.type
    );

    const categorie = normaliserTexteCaisseFront(
        operation.categorie
    );

    const estEntree =
        type === "entree" ||
        (
            type === "transfert" &&
            (
                categorie === "transfert entrant" ||
                categorie === "annulation transfert entrant"
            )
        );

    const estSortie =
        type === "sortie" ||
        (
            type === "transfert" &&
            (
                categorie === "transfert sortant" ||
                categorie === "annulation transfert sortant"
            )
        );

    const annulee =
        estOperationCaisseAnnulee(operation);

    const estContreOperation =
        normaliserTexteCaisseFront(operation.origine) ===
        "annulation caisse";

    let justificatif = "—";
    const valeurJustificatif =
        String(operation.justificatif || "").trim();

    if (valeurJustificatif.startsWith("RECU-SALAIRE:")) {
        justificatif = "Reçu interne";
    } else if (estJustificatifCaisseEnAttente(valeurJustificatif)) {
        justificatif =
            '<span class="cash-proof-state cash-proof-pending">En attente</span>';
    } else if (estJustificatifCaisseEnErreur(valeurJustificatif)) {
        justificatif =
            '<span class="cash-proof-state cash-proof-error">Échec d’envoi</span>';
    } else if (/^https?:\/\//i.test(valeurJustificatif)) {
        justificatif =
            `<button type="button" class="cash-proof-view-btn" data-cash-action="proof" data-cash-id="${echapperHTMLCaisse(operation.idMouvement || "")}">Voir</button>`;
    } else if (valeurJustificatif) {
        justificatif =
            echapperHTMLCaisse(valeurJustificatif);
    }

    const badge =
        annulee
            ? '<span class="cash-status-badge">Annulée</span>'
            : estContreOperation
                ? '<span class="cash-status-badge">Contre-opération</span>'
                : "";

    return `
        <tr data-cash-id="${echapperHTMLCaisse(operation.idMouvement || "")}">
            <td>${echapperHTMLCaisse(formaterDateHeureCaisse(operation.date, operation.heure))}</td>
            <td>${echapperHTMLCaisse(operation.reference || operation.idMouvement || "—")}${badge}</td>
            <td>${echapperHTMLCaisse(operation.compteCaisse || "—")}</td>
            <td>${echapperHTMLCaisse(operation.typeMouvement || operation.type || "—")}</td>
            <td>${echapperHTMLCaisse(operation.categorie || "—")}</td>
            <td>${echapperHTMLCaisse(operation.origine || "—")}</td>
            <td>${echapperHTMLCaisse(operation.modePaiement || "—")}</td>
            <td>${estEntree ? formaterMontantCaisseFront(operation.montant) : "—"}</td>
            <td>${estSortie ? formaterMontantCaisseFront(operation.montant) : "—"}</td>
            <td>${formaterMontantCaisseFront(operation.soldeApres)}</td>
            <td>${justificatif}</td>
            <td>${echapperHTMLCaisse(operation.idUtilisateur || "—")}</td>
            <td>${construireActionsCaisse(operation)}</td>
        </tr>
    `;
}



function construireActionsCaisse(operation) {
    const id =
        echapperHTMLCaisse(
            operation.idMouvement || ""
        );

    const justificatif =
        String(
            operation.justificatif || ""
        ).trim();

    const peutVoirJustificatif =
        Boolean(justificatif) &&
        !estJustificatifCaisseEnAttente(justificatif) &&
        !estJustificatifCaisseEnErreur(justificatif);

    const peutReessayerJustificatif =
        estJustificatifCaisseEnErreur(justificatif);

    const peutAnnuler =
        operationCaissePeutEtreAnnulee(
            operation
        );

    const libelleImpression =
        justificatif.startsWith("RECU-SALAIRE:")
            ? "Imprimer le reçu"
            : "Imprimer la fiche";

    return `
        <div class="cash-actions">
            <button
                type="button"
                class="cash-action-trigger"
                data-cash-menu-trigger="${id}"
                aria-label="Actions"
                aria-expanded="false"
            >⋯</button>

            <div class="cash-action-menu" data-cash-menu="${id}">
                <button type="button" data-cash-action="detail" data-cash-id="${id}">👁️ Voir les détails</button>
                <button type="button" data-cash-action="print" data-cash-id="${id}">🖨️ ${libelleImpression}</button>
                <button type="button" data-cash-action="copy" data-cash-id="${id}">📋 Copier la référence</button>
                ${
                    peutVoirJustificatif
                        ? `<button type="button" data-cash-action="proof" data-cash-id="${id}">📎 Voir le justificatif</button>`
                        : ""
                }
                ${
                    peutReessayerJustificatif
                        ? `<button type="button" data-cash-action="retry-proof" data-cash-id="${id}">🔄 Réessayer l’envoi du justificatif</button>`
                        : ""
                }
                <div class="cash-action-separator"></div>
                <button
                    type="button"
                    class="danger"
                    data-cash-action="cancel"
                    data-cash-id="${id}"
                    ${peutAnnuler ? "" : "disabled"}
                >↩ Annuler l'opération</button>
            </div>
        </div>
    `;
}


function operationCaisseParId(idMouvement) {
    return operationsCaisseChargees.find(
        operation =>
            String(
                operation.idMouvement || ""
            ) ===
            String(
                idMouvement || ""
            )
    ) || null;
}


function obtenirIdsOperationsCaisseAnnulees() {
    return new Set(
        operationsCaisseChargees
            .filter(
                operation =>
                    normaliserTexteCaisseFront(
                        operation.origine
                    ) ===
                    "annulation caisse" &&
                    operation.idOrigine
            )
            .map(
                operation =>
                    String(
                        operation.idOrigine
                    )
            )
    );
}


function obtenirReferencesTransfertsAnnules() {
    const idsAnnules =
        obtenirIdsOperationsCaisseAnnulees();

    const references =
        new Set();

    operationsCaisseChargees.forEach(
        operation => {
            if (
                idsAnnules.has(
                    String(
                        operation.idMouvement ||
                        ""
                    )
                ) &&
                normaliserTexteCaisseFront(
                    operation.typeMouvement ||
                    operation.type
                ) === "transfert"
            ) {
                references.add(
                    String(
                        operation.reference ||
                        ""
                    )
                );
            }
        }
    );

    return references;
}


function estOperationCaisseAnnulee(operation) {
    const idsAnnules =
        obtenirIdsOperationsCaisseAnnulees();

    if (
        idsAnnules.has(
            String(
                operation.idMouvement ||
                ""
            )
        )
    ) {
        return true;
    }

    if (
        normaliserTexteCaisseFront(
            operation.typeMouvement ||
            operation.type
        ) === "transfert" &&
        obtenirReferencesTransfertsAnnules()
            .has(
                String(
                    operation.reference ||
                    ""
                )
            )
    ) {
        return true;
    }

    return false;
}


function operationCaissePeutEtreAnnulee(operation) {
    if (!operation) {
        return false;
    }

    if (
        normaliserTexteCaisseFront(
            operation.origine
        ) ===
        "annulation caisse"
    ) {
        return false;
    }

    if (
        estOperationCaisseAnnulee(
            operation
        )
    ) {
        return false;
    }

    const type =
        normaliserTexteCaisseFront(
            operation.typeMouvement ||
            operation.type
        );

    const categorie =
        normaliserTexteCaisseFront(
            operation.categorie
        );

    /*
     * Pour un transfert, une seule des deux lignes porte l'action
     * d'annulation afin d'éviter une double contre-opération.
     */
    if (
        type === "transfert" &&
        categorie !== "transfert sortant"
    ) {
        return false;
    }

    return true;
}


function initialiserActionsLignesCaisse() {
    const tbody =
        document.getElementById(
            "cash-table-body"
        );

    tbody?.addEventListener(
        "click",
        async function(event) {
            const trigger =
                event.target.closest(
                    "[data-cash-menu-trigger]"
                );

            if (trigger) {
                event.stopPropagation();

                ouvrirMenuActionCaisse(
                    trigger
                );

                return;
            }

            const bouton =
                event.target.closest(
                    "[data-cash-action]"
                );

            if (!bouton) {
                return;
            }

            event.stopPropagation();

            fermerMenusActionCaisse();

            const operation =
                operationCaisseParId(
                    bouton.dataset.cashId
                );

            if (!operation) {
                afficherToastCaisse(
                    "Opération introuvable.",
                    "error"
                );
                return;
            }

            const action =
                bouton.dataset.cashAction;

            if (action === "detail") {
                ouvrirDetailCaisse(
                    operation
                );
            }

            if (action === "print") {
                imprimerOperationCaisse(
                    operation
                );
            }

            if (action === "copy") {
                await copierReferenceCaisse(
                    operation
                );
            }

            if (action === "proof") {
                voirJustificatifCaisse(
                    operation
                );
            }

            if (action === "retry-proof") {
                await reessayerEnvoiJustificatifCaisse(
                    operation
                );
            }

            if (action === "cancel") {
                ouvrirAnnulationCaisse(
                    operation
                );
            }
        }
    );

    document.addEventListener(
        "click",
        function(event) {
            if (
                !event.target.closest(
                    ".cash-actions"
                )
            ) {
                fermerMenusActionCaisse();
            }
        }
    );

    window.addEventListener(
        "scroll",
        fermerMenusActionCaisse,
        true
    );

    window.addEventListener(
        "resize",
        fermerMenusActionCaisse
    );
}


function ouvrirMenuActionCaisse(trigger) {
    const id =
        trigger.dataset.cashMenuTrigger;

    const menu =
        document.querySelector(
            `[data-cash-menu="${CSS.escape(id)}"]`
        );

    if (!menu) {
        return;
    }

    const dejaOuvert =
        menu.classList.contains(
            "open"
        );

    fermerMenusActionCaisse();

    if (dejaOuvert) {
        return;
    }

    const rect =
        trigger.getBoundingClientRect();

    menu.classList.add("open");

    const largeur =
        menu.offsetWidth;

    const hauteur =
        menu.offsetHeight;

    let left =
        rect.right -
        largeur;

    let top =
        rect.bottom +
        6;

    if (left < 8) {
        left = 8;
    }

    if (
        top + hauteur >
        window.innerHeight - 8
    ) {
        top =
            rect.top -
            hauteur -
            6;
    }

    menu.style.left =
        `${left}px`;

    menu.style.top =
        `${Math.max(8, top)}px`;

    trigger.setAttribute(
        "aria-expanded",
        "true"
    );

    menuActionCaisseActif =
        menu;
}


function fermerMenusActionCaisse() {
    document
        .querySelectorAll(
            ".cash-action-menu.open"
        )
        .forEach(
            menu => {
                menu.classList.remove(
                    "open"
                );
            }
        );

    document
        .querySelectorAll(
            "[data-cash-menu-trigger]"
        )
        .forEach(
            trigger =>
                trigger.setAttribute(
                    "aria-expanded",
                    "false"
                )
        );

    menuActionCaisseActif =
        null;
}


function initialiserModalesActionsCaisse() {
    document
        .getElementById(
            "close-cash-detail-modal"
        )
        ?.addEventListener(
            "click",
            fermerDetailCaisse
        );

    document
        .getElementById(
            "cash-detail-modal"
        )
        ?.addEventListener(
            "click",
            event => {
                if (
                    event.target.id ===
                    "cash-detail-modal"
                ) {
                    fermerDetailCaisse();
                }
            }
        );

    document
        .getElementById(
            "copy-cash-reference-btn"
        )
        ?.addEventListener(
            "click",
            () =>
                operationCaisseSelectionnee &&
                copierReferenceCaisse(
                    operationCaisseSelectionnee
                )
        );

    document
        .getElementById(
            "view-cash-proof-btn"
        )
        ?.addEventListener(
            "click",
            () =>
                operationCaisseSelectionnee &&
                voirJustificatifCaisse(
                    operationCaisseSelectionnee
                )
        );

    document
        .getElementById(
            "print-cash-operation-btn"
        )
        ?.addEventListener(
            "click",
            () =>
                operationCaisseSelectionnee &&
                imprimerOperationCaisse(
                    operationCaisseSelectionnee
                )
        );

    document
        .getElementById(
            "cancel-cash-operation-detail-btn"
        )
        ?.addEventListener(
            "click",
            () => {
                if (
                    operationCaisseSelectionnee
                ) {
                    fermerDetailCaisse();
                    ouvrirAnnulationCaisse(
                        operationCaisseSelectionnee
                    );
                }
            }
        );

    document
        .getElementById(
            "close-cash-cancel-modal"
        )
        ?.addEventListener(
            "click",
            fermerAnnulationCaisse
        );

    document
        .getElementById(
            "abort-cash-cancel-btn"
        )
        ?.addEventListener(
            "click",
            fermerAnnulationCaisse
        );

    document
        .getElementById(
            "cash-cancel-modal"
        )
        ?.addEventListener(
            "click",
            event => {
                if (
                    event.target.id ===
                    "cash-cancel-modal"
                ) {
                    fermerAnnulationCaisse();
                }
            }
        );

    document
        .getElementById(
            "cash-cancel-form"
        )
        ?.addEventListener(
            "submit",
            confirmerAnnulationCaisse
        );
}


function ouvrirDetailCaisse(operation) {
    operationCaisseSelectionnee =
        operation;

    const annulee =
        estOperationCaisseAnnulee(
            operation
        );

    definirTexteCaisse(
        "detail-cash-id",
        operation.idMouvement || "—"
    );

    definirTexteCaisse(
        "detail-cash-reference",
        operation.reference || "—"
    );

    definirTexteCaisse(
        "detail-cash-date",
        formaterDateHeureCaisse(
            operation.date,
            operation.heure
        )
    );

    definirTexteCaisse(
        "detail-cash-account",
        operation.compteCaisse || "—"
    );

    definirTexteCaisse(
        "detail-cash-type",
        operation.typeMouvement ||
        operation.type ||
        "—"
    );

    definirTexteCaisse(
        "detail-cash-category",
        operation.categorie || "—"
    );

    definirTexteCaisse(
        "detail-cash-amount",
        formaterMontantCaisseFront(
            operation.montant
        )
    );

    definirTexteCaisse(
        "detail-cash-method",
        operation.modePaiement || "—"
    );

    definirTexteCaisse(
        "detail-cash-before",
        formaterMontantCaisseFront(
            operation.soldeAvant
        )
    );

    definirTexteCaisse(
        "detail-cash-after",
        formaterMontantCaisseFront(
            operation.soldeApres
        )
    );

    definirTexteCaisse(
        "detail-cash-origin",
        operation.origine || "—"
    );

    definirTexteCaisse(
        "detail-cash-origin-id",
        operation.idOrigine || "—"
    );

    definirTexteCaisse(
        "detail-cash-destination",
        operation.compteDestination || "—"
    );

    definirTexteCaisse(
        "detail-cash-user",
        operation.idUtilisateur || "—"
    );

    definirTexteCaisse(
        "detail-cash-proof",
        operation.justificatif || "—"
    );

    definirTexteCaisse(
        "detail-cash-comment",
        operation.commentaire || "—"
    );

    const statut =
        document.getElementById(
            "cash-detail-status"
        );

    if (statut) {
        statut.innerHTML =
            annulee
                ? '<span class="status-cancelled">Opération annulée</span>'
                : '<span class="status-ok">Opération active</span>';
    }

    const proofBtn =
        document.getElementById(
            "view-cash-proof-btn"
        );

    if (proofBtn) {
        proofBtn.hidden =
            !String(
                operation.justificatif ||
                ""
            ).trim();
    }

    const cancelBtn =
        document.getElementById(
            "cancel-cash-operation-detail-btn"
        );

    if (cancelBtn) {
        cancelBtn.hidden =
            !operationCaissePeutEtreAnnulee(
                operation
            );
    }

    const modal =
        document.getElementById(
            "cash-detail-modal"
        );

    modal?.classList.add(
        "active"
    );

    modal?.setAttribute(
        "aria-hidden",
        "false"
    );
}


function fermerDetailCaisse() {
    document
        .getElementById(
            "cash-detail-modal"
        )
        ?.classList.remove(
            "active"
        );

    document
        .getElementById(
            "cash-detail-modal"
        )
        ?.setAttribute(
            "aria-hidden",
            "true"
        );
}


async function copierReferenceCaisse(operation) {
    const reference =
        String(
            operation.reference ||
            operation.idMouvement ||
            ""
        );

    if (!reference) {
        afficherToastCaisse(
            "Aucune référence à copier.",
            "error"
        );

        return;
    }

    try {
        await navigator.clipboard.writeText(
            reference
        );

        afficherToastCaisse(
            "Référence copiée.",
            "success"
        );
    } catch (error) {
        console.error(
            "Copie référence :",
            error
        );

        afficherToastCaisse(
            "Impossible de copier la référence.",
            "error"
        );
    }
}


function voirJustificatifCaisse(operation) {
    const justificatif =
        String(operation?.justificatif || "").trim();

    if (!justificatif) {
        afficherToastCaisse(
            "Aucun justificatif pour cette opération.",
            "error"
        );
        return;
    }

    if (justificatif.startsWith("RECU-SALAIRE:")) {
        imprimerOperationCaisse(operation, true);
        return;
    }

    if (estJustificatifCaisseEnAttente(justificatif)) {
        afficherToastCaisse(
            "Le justificatif est encore en cours d’envoi.",
            "info"
        );
        return;
    }

    if (estJustificatifCaisseEnErreur(justificatif)) {
        afficherToastCaisse(
            "L’envoi du justificatif a échoué. Utilisez Réessayer dans Actions.",
            "error"
        );
        return;
    }

    if (!/^https?:\/\//i.test(justificatif)) {
        afficherToastCaisse(
            `Justificatif référencé : ${justificatif}`,
            "success"
        );
        return;
    }

    ouvrirVisualiseurJustificatifCaisse(
        justificatif,
        operation
    );
}

function ouvrirVisualiseurJustificatifCaisse(url, operation) {
    const modal = document.getElementById("cash-proof-viewer-modal");
    const titre = document.getElementById("cash-proof-viewer-title");
    const contenu = document.getElementById("cash-proof-viewer-content");
    const externe = document.getElementById("cash-proof-open-external");

    if (!modal || !contenu) return;

    if (titre) {
        titre.textContent =
            `Justificatif — ${operation?.reference || operation?.idMouvement || "Opération"}`;
    }

    const urlMin = String(url).toLowerCase();
    const estPdf =
        urlMin.includes(".pdf") ||
        urlMin.includes("/raw/upload/") ||
        urlMin.includes("format=pdf");

    contenu.innerHTML = estPdf
        ? `<iframe class="cash-proof-document" src="${echapperHTMLCaisse(url)}" title="Justificatif PDF"></iframe>`
        : `<img class="cash-proof-image" src="${echapperHTMLCaisse(url)}" alt="Justificatif de l’opération">`;

    if (externe) {
        externe.href = url;
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
}

function fermerVisualiseurJustificatifCaisse() {
    const modal = document.getElementById("cash-proof-viewer-modal");
    const contenu = document.getElementById("cash-proof-viewer-content");

    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");

    if (contenu) {
        contenu.innerHTML = "";
    }
}


function imprimerOperationCaisse(
    operation,
    recuSalaire = false
) {
    const fenetre =
        window.open(
            "",
            "_blank",
            "width=860,height=760"
        );

    if (!fenetre) {
        afficherToastCaisse(
            "Autorisez les fenêtres contextuelles pour imprimer.",
            "error"
        );

        return;
    }

    const estSalaire =
        recuSalaire ||
        normaliserTexteCaisseFront(
            operation.categorie
        ) === "salaire";

    const titre =
        estSalaire
            ? "Reçu de paiement de salaire"
            : "Fiche de mouvement de caisse";

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>${echapperHTMLCaisse(titre)}</title>
            <style>
                body{font-family:Arial,sans-serif;color:#0f172a;padding:32px}
                .head{border-bottom:2px solid #2563eb;padding-bottom:14px;margin-bottom:22px}
                h1{font-size:22px;margin:0 0 5px}
                .muted{color:#64748b;font-size:12px}
                .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
                .item{border:1px solid #e2e8f0;border-radius:8px;padding:10px}
                .item span{display:block;color:#64748b;font-size:10px;text-transform:uppercase;margin-bottom:4px}
                .item strong{font-size:13px}
                .wide{grid-column:1/-1}
                .signature{margin-top:50px;display:flex;justify-content:space-between;gap:40px}
                .signature div{width:42%;border-top:1px solid #94a3b8;padding-top:7px;text-align:center;font-size:11px}
                @media print{body{padding:12px}}
            </style>
        </head>
        <body>
            <div class="head">
                <h1>VISIBL — ${echapperHTMLCaisse(titre)}</h1>
                <div class="muted">Référence : ${echapperHTMLCaisse(operation.reference || "—")}</div>
            </div>
            <div class="grid">
                <div class="item"><span>ID Mouvement</span><strong>${echapperHTMLCaisse(operation.idMouvement || "—")}</strong></div>
                <div class="item"><span>Date / Heure</span><strong>${echapperHTMLCaisse(formaterDateHeureCaisse(operation.date, operation.heure))}</strong></div>
                <div class="item"><span>Compte</span><strong>${echapperHTMLCaisse(operation.compteCaisse || "—")}</strong></div>
                <div class="item"><span>Type</span><strong>${echapperHTMLCaisse(operation.typeMouvement || operation.type || "—")}</strong></div>
                <div class="item"><span>Catégorie</span><strong>${echapperHTMLCaisse(operation.categorie || "—")}</strong></div>
                <div class="item"><span>Montant</span><strong>${echapperHTMLCaisse(formaterMontantCaisseFront(operation.montant))}</strong></div>
                <div class="item"><span>Mode</span><strong>${echapperHTMLCaisse(operation.modePaiement || "—")}</strong></div>
                <div class="item"><span>Utilisateur</span><strong>${echapperHTMLCaisse(operation.idUtilisateur || "—")}</strong></div>
                <div class="item wide"><span>Commentaire</span><strong>${echapperHTMLCaisse(operation.commentaire || "—")}</strong></div>
            </div>
            ${
                estSalaire
                    ? `<div class="signature"><div>Bénéficiaire</div><div>Responsable</div></div>`
                    : ""
            }
        </body>
        </html>
    `);

    fenetre.document.close();

    fenetre.onload =
        () => {
            fenetre.focus();
            fenetre.print();
        };
}


function ouvrirAnnulationCaisse(operation) {
    if (
        !operationCaissePeutEtreAnnulee(
            operation
        )
    ) {
        afficherToastCaisse(
            "Cette opération ne peut pas être annulée.",
            "error"
        );

        return;
    }

    operationCaisseSelectionnee =
        operation;

    const summary =
        document.getElementById(
            "cash-cancel-summary"
        );

    if (summary) {
        summary.innerHTML = `
            <strong>${echapperHTMLCaisse(operation.reference || operation.idMouvement || "Opération")}</strong><br>
            ${echapperHTMLCaisse(operation.typeMouvement || operation.type || "")}
            · ${echapperHTMLCaisse(operation.categorie || "")}
            · ${echapperHTMLCaisse(operation.compteCaisse || "")}
            · ${echapperHTMLCaisse(formaterMontantCaisseFront(operation.montant))}
        `;
    }

    const raison =
        document.getElementById(
            "cash-cancel-reason"
        );

    if (raison) {
        raison.value = "";
    }

    const modal =
        document.getElementById(
            "cash-cancel-modal"
        );

    modal?.classList.add(
        "active"
    );

    modal?.setAttribute(
        "aria-hidden",
        "false"
    );

    raison?.focus();
}


function fermerAnnulationCaisse() {
    document
        .getElementById(
            "cash-cancel-modal"
        )
        ?.classList.remove(
            "active"
        );

    document
        .getElementById(
            "cash-cancel-modal"
        )
        ?.setAttribute(
            "aria-hidden",
            "true"
        );
}


async function confirmerAnnulationCaisse(event) {
    event.preventDefault();

    const operation =
        operationCaisseSelectionnee;

    if (!operation) {
        afficherToastCaisse(
            "Aucune opération sélectionnée.",
            "error"
        );

        return;
    }

    const motif =
        document
            .getElementById(
                "cash-cancel-reason"
            )
            ?.value
            ?.trim() ||
        "";

    if (!motif) {
        afficherToastCaisse(
            "Le motif de l'annulation est obligatoire.",
            "error"
        );

        return;
    }

    const bouton =
        document.getElementById(
            "confirm-cash-cancel-btn"
        );

    if (bouton) {
        bouton.disabled = true;
    }

    try {
        const resultat =
            await apiPost(
                "annulerOperationCaisse",
                {
                    idMouvement:
                        operation.idMouvement,
                    motifAnnulation:
                        motif,
                    idUtilisateur:
                        obtenirIdUtilisateurCaisse()
                }
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'annuler l'opération."
            );
        }

        afficherToastCaisse(
            resultat.message ||
            "Opération annulée.",
            "success"
        );

        fermerAnnulationCaisse();

        await chargerOperationsCaisse();

    } catch (error) {
        console.error(
            "Erreur annulation caisse :",
            error
        );

        afficherToastCaisse(
            error.message ||
            "Impossible d'annuler l'opération.",
            "error"
        );

    } finally {
        if (bouton) {
            bouton.disabled = false;
        }
    }
}


/* ===========================================================
   ACTIONS PAGE
=========================================================== */

function initialiserActionsCaisse() {
    initialiserActionsLignesCaisse();
    initialiserModalesActionsCaisse();

    document
        .getElementById("refresh-cash-btn")
        ?.addEventListener(
            "click",
            async function(event) {
                const bouton =
                    event.currentTarget;

                if (bouton.disabled) {
                    return;
                }

                bouton.disabled = true;
                bouton.classList.add(
                    "is-loading"
                );

                try {
                    await chargerOperationsCaisse();

                    afficherToastCaisse(
                        "Caisse actualisée.",
                        "success"
                    );
                } finally {
                    bouton.disabled = false;
                    bouton.classList.remove(
                        "is-loading"
                    );
                }
            }
        );

    document
        .getElementById("print-cash-btn")
        ?.addEventListener(
            "click",
            function() {
                window.print();
            }
        );

    document
        .getElementById("export-cash-btn")
        ?.addEventListener(
            "click",
            exporterCaisseCSV
        );

    document
        .getElementById("close-cash-proof-viewer-modal")
        ?.addEventListener("click", fermerVisualiseurJustificatifCaisse);

    document
        .getElementById("cash-proof-viewer-modal")
        ?.addEventListener("click", function(event) {
            if (event.target.id === "cash-proof-viewer-modal") {
                fermerVisualiseurJustificatifCaisse();
            }
        });
}


function exporterCaisseCSV() {
    if (
        !operationsCaisseAffichees.length
    ) {
        afficherToastCaisse(
            "Aucune opération à exporter.",
            "error"
        );
        return;
    }

    const donnees =
        operationsCaisseAffichees.map(
            function(operation) {
                return {
                    "ID Mouvement":
                        operation.idMouvement || "",
                    "Date":
                        operation.date || "",
                    "Heure":
                        operation.heure || "",
                    "Compte de Caisse":
                        operation.compteCaisse || "",
                    "Type de Mouvement":
                        operation.typeMouvement || "",
                    "Catégorie":
                        operation.categorie || "",
                    "Montant":
                        convertirMontantCaisseFront(
                            operation.montant
                        ),
                    "Mode de Paiement":
                        operation.modePaiement || "",
                    "Référence":
                        operation.reference || "",
                    "Solde Avant":
                        convertirMontantCaisseFront(
                            operation.soldeAvant
                        ),
                    "Solde Après":
                        convertirMontantCaisseFront(
                            operation.soldeApres
                        ),
                    "ID Utilisateur":
                        operation.idUtilisateur || "",
                    "Commentaire":
                        operation.commentaire || "",
                    "Origine":
                        operation.origine || "",
                    "ID Origine":
                        operation.idOrigine || "",
                    "Justificatif":
                        operation.justificatif || "",
                    "Compte Destination":
                        operation.compteDestination || ""
                };
            }
        );

    const colonnes =
        Object.keys(
            donnees[0]
        );

    const proteger =
        function(valeur) {
            return (
                '"' +
                String(
                    valeur ?? ""
                ).replace(
                    /"/g,
                    '""'
                ) +
                '"'
            );
        };

    const lignes = [
        colonnes
            .map(proteger)
            .join(";"),

        ...donnees.map(
            function(ligne) {
                return colonnes
                    .map(
                        colonne =>
                            proteger(
                                ligne[colonne]
                            )
                    )
                    .join(";");
            }
        )
    ];

    const blob =
        new Blob(
            [
                "\ufeff" +
                lignes.join(
                    "\r\n"
                )
            ],
            {
                type:
                    "text/csv;charset=utf-8;"
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
        "VISIBL_caisse_" +
        new Date()
            .toISOString()
            .slice(
                0,
                10
            ) +
        ".csv";

    document.body.appendChild(
        lien
    );

    lien.click();
    lien.remove();

    window.setTimeout(
        function() {
            URL.revokeObjectURL(
                url
            );
        },
        1000
    );

    afficherToastCaisse(
        operationsCaisseAffichees.length +
        " mouvement(s) exporté(s).",
        "success"
    );
}


/* ===========================================================
   MAPPINGS BACKEND
=========================================================== */

function obtenirCategorieBackendCaisse(valeur, typeMouvement) {
    const type = normaliserTexteCaisseFront(typeMouvement);
    const key = normaliserTexteCaisseFront(valeur);

    const categories = {
        entree: {
            "apport": "Apport",
            "pret-recu": "Prêt reçu",
            "remboursement-recu": "Remboursement reçu",
            "autres": "Autres"
        },
        sortie: {
            "salaire": "Salaire",
            "loyer": "Loyer",
            "electricite": "Électricité",
            "eau": "Eau",
            "internet": "Internet",
            "publicite": "Publicité",
            "autres": "Autres"
        },
        ajustement: {
            "ecart-caisse": "Écart de caisse",
            "correction-solde": "Correction de solde",
            "erreur-saisie": "Erreur de saisie",
            "autres": "Autres"
        },
        transfert: {
            "reequilibrage": "Rééquilibrage de trésorerie",
            "depot-banque": "Dépôt vers Banque",
            "transfert-mobile-money": "Transfert vers Mobile Money",
            "retrait-mobile-money": "Retrait depuis Mobile Money",
            "autres": "Autres"
        }
    };

    return categories[type]?.[key] || "";
}



function obtenirLibelleCategorieCaisse(typeMouvement, valeur, motifAutre) {
    const categorie = obtenirCategorieBackendCaisse(
        valeur,
        typeMouvement
    );

    return normaliserTexteCaisseFront(valeur) === "autres"
        ? (motifAutre || "Autres")
        : categorie;
}

function obtenirModePaiementBackendCaisse(
    valeur
) {
    const modes = {
        "especes":
            "Espèces",

        "mobile-money":
            "Mobile Money",

        "virement":
            "Virement bancaire",

        "cheque":
            "Chèque"
    };

    return (
        modes[
            normaliserTexteCaisseFront(
                valeur
            )
        ] ||
        ""
    );
}


/* ===========================================================
   UTILITAIRES
=========================================================== */

function obtenirIdUtilisateurCaisse() {
    if (
        typeof getCurrentUser !==
        "function"
    ) {
        return "";
    }

    const utilisateur =
        getCurrentUser() ||
        {};

    return String(
        utilisateur.idUtilisateur ??
        utilisateur["ID Utilisateur"] ??
        utilisateur.id ??
        ""
    ).trim();
}


function convertirMontantCaisseFront(
    valeur
) {
    if (
        typeof valeur ===
        "number"
    ) {
        return Number.isFinite(
            valeur
        )
            ? valeur
            : 0;
    }

    const nettoyee =
        String(
            valeur ?? ""
        )
            .replace(
                /\s/g,
                ""
            )
            .replace(
                /FCFA/gi,
                ""
            )
            .replace(
                /[^0-9,.-]/g,
                ""
            )
            .replace(
                /,/g,
                "."
            );

    const nombre =
        Number(
            nettoyee
        );

    return Number.isFinite(
        nombre
    )
        ? nombre
        : 0;
}


function formaterMontantCaisseFront(
    valeur
) {
    const p = parametresFinanceCaisse || {};
    const decimales = Number(p.nombreDecimales) === 2 ? 2 : 0;
    const montant = convertirMontantCaisseFront(valeur).toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    const devise = String(p.libelleDevise || "FCFA").trim() || "FCFA";
    return p.formatMontant === "devise-nombre" ? devise + " " + montant : montant + " " + devise;
}


function formaterDateHeureCaisse(
    date,
    heure
) {
    const dateTexte =
        String(
            date ?? ""
        ).trim() ||
        "—";

    const heureTexte =
        String(
            heure ?? ""
        ).trim();

    return heureTexte
        ? dateTexte +
            " " +
            heureTexte
        : dateTexte;
}


function normaliserTexteCaisseFront(
    valeur
) {
    return String(
        valeur ?? ""
    )
        .trim()
        .toLowerCase()
        .normalize(
            "NFD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        );
}


function echapperHTMLCaisse(
    valeur
) {
    return String(
        valeur ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function definirTexteCaisse(
    id,
    valeur
) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            String(
                valeur ?? ""
            );
    }
}


function afficherToastCaisse(
    message,
    type
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

    console[
        type === "error"
            ? "error"
            : "log"
    ](
        message
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

  /* Transforme la zone d'actions existante en Actions uniquement, sans casser les handlers. */
  const content=q("section.content");
  if(content){
    const actionButtons=[
      document.getElementById("export-cash-btn"),
      document.getElementById("print-cash-btn"),
      document.getElementById("refresh-cash-btn")
    ].filter(Boolean);
    if(actionButtons.length){
      let host=actionButtons[0].closest(".toolbar-right,.actions,.toolbar-actions,.clients-toolbar,.sales-toolbar,.toolbar")||actionButtons[0].parentElement;
      if(host && !q(".visibl-common-toolbar-actions",host)){
        const wrap=document.createElement("div");wrap.className="visibl-common-toolbar-actions";
        const menuWrap=document.createElement("div");menuWrap.className="visibl-common-actions";
        const trigger=document.createElement("button");trigger.type="button";trigger.className="btn-secondary";trigger.textContent="Actions ⌄";trigger.setAttribute("aria-expanded","false");
        const menu=document.createElement("div");menu.className="visibl-common-actions-menu";menu.hidden=true;
        actionButtons.forEach(old=>{
          const clone=document.createElement("button");clone.type="button";clone.innerHTML=old.innerHTML||old.textContent;
          clone.addEventListener("click",async()=>{
            menu.hidden=true;
            trigger.setAttribute("aria-expanded","false");

            if(old.id==="refresh-cash-btn"){
              if(clone.disabled) return;
              clone.disabled=true;
              clone.classList.add("is-loading");
              try{
                await chargerOperationsCaisse();
                afficherToastCaisse("Caisse actualisée.","success");
              }catch(error){
                console.error("Erreur actualisation caisse :",error);
                afficherToastCaisse(error?.message||"Impossible d’actualiser la caisse.","error");
              }finally{
                clone.disabled=false;
                clone.classList.remove("is-loading");
              }
              return;
            }

            old.click();
          });
          menu.appendChild(clone); old.style.display="none";
        });
        trigger.addEventListener("click",e=>{e.stopPropagation();menu.hidden=!menu.hidden;trigger.setAttribute("aria-expanded",String(!menu.hidden))});
        menuWrap.append(trigger,menu);wrap.append(menuWrap);host.appendChild(wrap);
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


/* ===========================================================
   PARAMÈTRES > FINANCE — CAISSE
=========================================================== */
async function chargerParametresFinanceCaisse(){try{const r=await apiGet("getParametresFinance");if(r?.success)parametresFinanceCaisse={...parametresFinanceCaisse,...(r.data||r.parametres||{})};}catch(e){console.warn("Paramètres finance indisponibles dans Caisse :",e)}appliquerModesPaiementFinanceCaisse();}
function groupeModeFinanceCaisse(mode){const t=String(mode??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/_/g,"-").replace(/\s+/g,"-");if(["especes","espece","cash"].includes(t))return"especes";if(t.includes("mobile")||t.includes("wave")||t.includes("orange")||t.includes("mtn")||t.includes("moov"))return"mobile-money";if(t.includes("virement")||t.includes("transfer"))return"virement";if(t.includes("cheque"))return"cheque";if(t.includes("carte")||t.includes("card"))return"carte-bancaire";return t;}
function modeFinanceCaisseActif(mode){const g=groupeModeFinanceCaisse(mode),p=parametresFinanceCaisse||{};if(!g)return true;if(g==="especes")return p.modeEspeces!==false;if(g==="mobile-money")return p.modeMobileMoney!==false;if(g==="virement")return p.modeVirement!==false;if(g==="cheque")return p.modeCheque!==false;if(g==="carte-bancaire")return p.modeCarteBancaire!==false;return false;}
function appliquerModesPaiementFinanceCaisse(){const s=document.getElementById("cash-operation-method");if(!s)return;if(!Array.from(s.options).some(o=>o.value==="carte-bancaire")){const o=document.createElement("option");o.value="carte-bancaire";o.textContent="Carte bancaire";s.appendChild(o);}Array.from(s.options).forEach(o=>{if(!o.value)return;const a=modeFinanceCaisseActif(o.value);o.hidden=!a;o.disabled=!a;if(!a&&s.value===o.value)s.value=""});}


/* ===========================================================
   FINANCE DYNAMIQUE — COMPTES + MODES
=========================================================== */
function comptesFinanceCaisseActifs(){const a=Array.isArray(parametresFinanceCaisse?.comptesFinanciers)?parametresFinanceCaisse.comptesFinanciers:[];return a.filter(c=>c&&c.actif!==false);}
function modesFinanceCaisseActifs(){const a=Array.isArray(parametresFinanceCaisse?.modesPaiement)?parametresFinanceCaisse.modesPaiement:[];return a.filter(m=>m&&m.actif!==false && !["credit","avoir"].includes(String(m.id||"")));}
function remplirSelectFinanceCaisse(id,liste,placeholder){const s=document.getElementById(id);if(!s)return;const courant=s.value;s.innerHTML=`<option value="">${placeholder||"Sélectionner"}</option>`+liste.map(x=>`<option value="${echapperHTMLCaisse(x.value)}">${echapperHTMLCaisse(x.label)}</option>`).join("");if(Array.from(s.options).some(o=>o.value===courant))s.value=courant;}
function rendreComptesFinanceCaisse(){const comptes=comptesFinanceCaisseActifs();const grid=document.querySelector(".cash-accounts-grid");if(grid){const soldes=ETAT_CAISSE.soldesParCompte||{};grid.innerHTML=comptes.map(c=>`<article class="cash-account-card"><div class="cash-account-icon">${c.type==="especes"?"💵":c.type==="banque"?"🏦":c.type==="mobile-money"?"📱":"💰"}</div><div class="cash-account-content"><span class="cash-account-name">${echapperHTMLCaisse(c.libelle)}</span><strong>${echapperHTMLCaisse(formaterMontantCaisseFront(soldes[c.libelle]||0))}</strong></div></article>`).join("")||'<div class="empty-table">Aucun compte financier actif.</div>';}
const opts=comptes.map(c=>({value:c.libelle,label:c.libelle}));remplirSelectFinanceCaisse("cash-operation-account",opts,"Sélectionner");remplirSelectFinanceCaisse("cash-destination-account",opts,"Sélectionner");}
function appliquerModesPaiementFinanceCaisse(){const comptes=comptesFinanceCaisseActifs();if(comptes.length)rendreComptesFinanceCaisse();const modes=modesFinanceCaisseActifs();if(modes.length){const opts=modes.map(m=>({value:m.id,label:m.libelle||m.id}));remplirSelectFinanceCaisse("cash-operation-method",opts,"Sélectionner");remplirSelectFinanceCaisse("cash-method-filter",opts,"Tous les modes");return;}const s=document.getElementById("cash-operation-method");if(!s)return;Array.from(s.options).forEach(o=>{if(!o.value)return;const a=modeFinanceCaisseActif(o.value);o.hidden=!a;o.disabled=!a;});}
function mettreAJourKpisCaisse(){const resume=ETAT_CAISSE.resumeMois||{};definirTexteCaisse("cash-balance-value",formaterMontantCaisseFront(ETAT_CAISSE.soldeGlobal));definirTexteCaisse("cash-income-value",formaterMontantCaisseFront(resume.entrees||0));definirTexteCaisse("cash-expense-value",formaterMontantCaisseFront(resume.sorties||0));definirTexteCaisse("cash-operations-value",String(resume.operations||0));rendreComptesFinanceCaisse();}
