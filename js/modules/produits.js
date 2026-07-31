/* ===========================================================
   VISIBL ERP
   Module : Produits
   Fichier : produits.js
=========================================================== */

const TVA = 18;

/*
   CONFIGURATION CLOUDINARY
   Remplacez les deux valeurs ci-dessous par celles de votre compte.
   Utilisez obligatoirement un Upload Preset non signé (Unsigned).
*/
const CLOUDINARY_CONFIG = {
    cloudName: "yqfbfg84",
    uploadPreset: "visibl_upload",
    dossier: "visibl/produits"
};

const TAILLE_MAX_IMAGE = 20 * 1024 * 1024;
const TYPES_IMAGE_AUTORISES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif"
];

const EXTENSIONS_IMAGE_AUTORISEES = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "heic",
    "heif"
];

const TAILLE_CIBLE_COMPRESSION = 800 * 1024;
const DIMENSION_MAX_IMAGE = 1280;
const QUALITE_JPEG_MOBILE = 0.72;

let produits = [];
let imageProduitSelectionnee = null;
let promesseUploadImageProduit = null;
let urlImageProduitTeleversee = "";
let versionImageProduit = 0;
let idProduitEnModification = "";


/* ===========================================================
   INITIALISATION
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    console.log("Module Produits chargé.");

    initProduits();
    initialiserModaleProduit();
    initialiserCalculsProduit();
    initialiserFormulaireProduit();
    initialiserUploadImageProduit();
    initialiserConsultationProduit();
    initialiserModificationProduit();
    initialiserSuppressionProduit();
    initialiserFiltresProduits();
    initialiserHeaderProduits();

    const refreshButton =
        document.getElementById("refresh-products-btn");

    if (refreshButton) {

        refreshButton.addEventListener("click", () => {

            chargerProduitsDepuisAPI();

        });

    }

});


/* ===========================================================
   INITIALISATION DU MODULE
=========================================================== */

function initProduits() {

    mettreAJourKPIs();

    chargerProduitsDepuisAPI();

}


/* ===========================================================
   MODALE PRODUIT
=========================================================== */

function initialiserModaleProduit() {

    const boutonNouveauProduit =
        document.getElementById("new-product-btn");

    const boutonFermer =
        document.getElementById("close-product-modal");

    const boutonAnnuler =
        document.getElementById("cancel-product-btn");

    const modale =
        document.getElementById("product-modal");

    if (!modale) {

        console.error(
            "La modale #product-modal est introuvable."
        );

        return;

    }

    if (boutonNouveauProduit) {

        boutonNouveauProduit.addEventListener(
            "click",
            ouvrirModaleProduit
        );

    }

    if (boutonFermer) {

        boutonFermer.addEventListener(
            "click",
            fermerModaleProduit
        );

    }

    if (boutonAnnuler) {

        boutonAnnuler.addEventListener(
            "click",
            fermerModaleProduit
        );

    }

    modale.addEventListener("click", event => {

        if (event.target === modale) {

            fermerModaleProduit();

        }

    });

    document.addEventListener("keydown", event => {

        if (
            event.key === "Escape" &&
            modale.classList.contains("active")
        ) {

            fermerModaleProduit();

        }

    });

}


function ouvrirModaleProduit() {

    const modale =
        document.getElementById("product-modal");

    const formulaire =
        document.getElementById("product-form");

    if (!modale) {

        return;

    }

    idProduitEnModification = "";
    configurerModaleProduit("creation");

    if (formulaire) {

        formulaire.reset();

    }

    remettreValeursParDefautProduit();
    genererReferenceProduit();
    reinitialiserImageProduit();
    masquerMessageFormulaireProduit();

    modale.classList.add("active");
    modale.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    const designationProduit =
        document.getElementById("product-name");

    if (designationProduit) {

        setTimeout(() => {

            designationProduit.focus();

        }, 100);

    }

}


function configurerModaleProduit(mode = "creation") {

    const titre = document.getElementById("product-modal-title");
    const description = document.querySelector(
        "#product-modal .modal-header p"
    );
    const boutonEnregistrer =
        document.getElementById("save-product-btn");

    const modification = mode === "modification";

    if (titre) {
        titre.textContent = modification
            ? "Modifier le produit"
            : "Nouveau produit";
    }

    if (description) {
        description.textContent = modification
            ? "Modifiez les informations du produit sélectionné."
            : "Enregistrez un nouveau produit dans le catalogue.";
    }

    if (boutonEnregistrer) {
        boutonEnregistrer.textContent = modification
            ? "Enregistrer la modification"
            : "Enregistrer le produit";
    }
}


function fermerModaleProduit() {

    const modale =
        document.getElementById("product-modal");

    if (!modale) {

        return;

    }

    modale.classList.remove("active");
    modale.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");

    masquerMessageFormulaireProduit();

}



/* ===========================================================
   RÉFÉRENCE AUTOMATIQUE
=========================================================== */

function genererReferenceProduit() {

    const champReference =
        document.getElementById("product-reference");

    if (!champReference) {

        return "";

    }

    let plusGrandNumero = 0;

    produits.forEach(produit => {

        const reference = String(
            produit["Référence Produit"] ||
            produit.referenceProduit ||
            ""
        ).trim();

        const correspondance =
            reference.match(/^PRO(\d+)$/i);

        if (correspondance) {

            plusGrandNumero = Math.max(
                plusGrandNumero,
                Number(correspondance[1]) || 0
            );

        }

    });

    const nouvelleReference =
        "PRO" +
        String(plusGrandNumero + 1).padStart(6, "0");

    champReference.value = nouvelleReference;

    return nouvelleReference;

}


/* ===========================================================
   IMAGE PRODUIT
=========================================================== */

function initialiserUploadImageProduit() {

    const zone =
        document.getElementById("product-image-drop-zone");

    const champFichier =
        document.getElementById("product-image-file");

    const boutonRetirer =
        document.getElementById("remove-product-image-btn");

    if (!zone || !champFichier) {

        return;

    }

    zone.addEventListener("click", event => {

        if (
            event.target.closest("#remove-product-image-btn")
        ) {

            return;

        }

        champFichier.click();

    });

    zone.addEventListener("keydown", event => {

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            event.preventDefault();
            champFichier.click();

        }

    });

    champFichier.addEventListener("change", () => {

        const fichier = champFichier.files?.[0];

        if (fichier) {

            traiterImageProduit(fichier);

        }

    });

    ["dragenter", "dragover"].forEach(type => {

        zone.addEventListener(type, event => {

            event.preventDefault();
            zone.classList.add("dragover");

        });

    });

    ["dragleave", "drop"].forEach(type => {

        zone.addEventListener(type, event => {

            event.preventDefault();
            zone.classList.remove("dragover");

        });

    });

    zone.addEventListener("drop", event => {

        const fichier =
            event.dataTransfer?.files?.[0];

        if (fichier) {

            traiterImageProduit(fichier);

        }

    });

    if (boutonRetirer) {

        boutonRetirer.addEventListener(
            "click",
            event => {

                event.stopPropagation();
                reinitialiserImageProduit();

            }
        );

    }

}


function traiterImageProduit(fichier) {

    if (!fichier || !estImageProduitAutorisee(fichier)) {

        afficherMessageFormulaireProduit(
            "Format d’image non autorisé. Utilisez JPG, PNG, WEBP, HEIC ou HEIF.",
            "error"
        );

        return;

    }

    if (fichier.size > TAILLE_MAX_IMAGE) {

        afficherMessageFormulaireProduit(
            "L’image dépasse la taille maximale de 20 Mo.",
            "error"
        );

        return;

    }

    imageProduitSelectionnee = fichier;

    /*
       Sur certains navigateurs mobiles, DataTransfer n'existe pas.
       Le fichier est déjà conservé dans imageProduitSelectionnee :
       il n'est donc pas nécessaire de forcer à nouveau champFichier.files.
    */
    const champFichier =
        document.getElementById("product-image-file");

    if (
        champFichier &&
        (!champFichier.files || champFichier.files[0] !== fichier) &&
        typeof DataTransfer !== "undefined"
    ) {

        try {

            const transfert = new DataTransfer();
            transfert.items.add(fichier);
            champFichier.files = transfert.files;

        } catch (error) {

            console.warn(
                "Impossible de réaffecter le fichier sur ce navigateur mobile.",
                error
            );

        }

    }

    afficherApercuImageProduit(fichier);

    /*
       L'image commence à être optimisée et envoyée dès sa sélection.
       Pendant que l'utilisateur termine le formulaire, le téléversement
       avance déjà en arrière-plan. Au clic sur Enregistrer, le code
       réutilise le résultat au lieu de recommencer l'envoi.
    */
    lancerUploadImageProduitEnArrierePlan(fichier);

}


async function lancerUploadImageProduitEnArrierePlan(fichier) {

    const versionCourante = ++versionImageProduit;

    urlImageProduitTeleversee = "";

    const champURL =
        document.getElementById("product-image-url");

    if (champURL) {
        champURL.value = "";
    }

    afficherMessageFormulaireProduit(
        "Optimisation et envoi de l’image en arrière-plan...",
        "info"
    );

    promesseUploadImageProduit = (async () => {

        try {

            const url =
                await envoyerImageVersCloudinary(fichier);

            if (versionCourante !== versionImageProduit) {
                /*
                   La modale a pu être fermée ou réutilisée entre-temps.
                   L'URL reste néanmoins exploitable par la synchronisation
                   détachée du produit déjà créé.
                */
                return { success: true, url, obsolete: true };
            }

            urlImageProduitTeleversee = url;

            if (champURL) {
                champURL.value = url;
            }

            afficherMessageFormulaireProduit(
                "Image prête. Vous pouvez enregistrer le produit.",
                "success"
            );

            return { success: true, url };

        } catch (error) {

            if (versionCourante !== versionImageProduit) {
                return { success: false, obsolete: true };
            }

            console.error(
                "Erreur d’envoi anticipé de l’image :",
                error
            );

            afficherMessageFormulaireProduit(
                error.message ||
                "Impossible d’envoyer l’image. Réessayez avec une autre photo.",
                "error"
            );

            return { success: false, error };

        }

    })();

    return promesseUploadImageProduit;

}


function estImageProduitAutorisee(fichier) {

    const type = String(fichier?.type || "")
        .trim()
        .toLowerCase();

    if (TYPES_IMAGE_AUTORISES.includes(type)) {

        return true;

    }

    const nom = String(fichier?.name || "");
    const extension = nom.includes(".")
        ? nom.split(".").pop().toLowerCase()
        : "";

    return EXTENSIONS_IMAGE_AUTORISEES.includes(extension);

}


function afficherApercuImageProduit(fichier) {

    const placeholder =
        document.getElementById("product-image-placeholder");

    const wrapper =
        document.getElementById("product-image-preview-wrapper");

    const image =
        document.getElementById("product-image-preview");

    const nom =
        document.getElementById("product-image-name");

    const taille =
        document.getElementById("product-image-size");

    if (!wrapper || !image) {

        return;

    }

    const lecteur = new FileReader();

    lecteur.onload = event => {

        image.src = event.target.result;

    };

    lecteur.readAsDataURL(fichier);

    if (placeholder) {

        placeholder.hidden = true;

    }

    wrapper.hidden = false;

    if (nom) {

        nom.textContent = fichier.name;

    }

    if (taille) {

        taille.textContent =
            formaterTailleFichier(fichier.size);

    }

}


function reinitialiserImageProduit() {

    imageProduitSelectionnee = null;
    versionImageProduit++;
    promesseUploadImageProduit = null;
    urlImageProduitTeleversee = "";

    const champFichier =
        document.getElementById("product-image-file");

    const champURL =
        document.getElementById("product-image-url");

    const placeholder =
        document.getElementById("product-image-placeholder");

    const wrapper =
        document.getElementById("product-image-preview-wrapper");

    const image =
        document.getElementById("product-image-preview");

    if (champFichier) {

        champFichier.value = "";

    }

    if (champURL) {

        champURL.value = "";

    }

    if (image) {

        image.removeAttribute("src");

    }

    if (placeholder) {

        placeholder.hidden = false;

    }

    if (wrapper) {

        wrapper.hidden = true;

    }

}


function formaterTailleFichier(octets) {

    if (octets < 1024) {

        return octets + " octets";

    }

    if (octets < 1024 * 1024) {

        return (octets / 1024).toFixed(1) + " Ko";

    }

    return (octets / (1024 * 1024)).toFixed(1) + " Mo";

}


function configurationCloudinaryValide() {

    return (
        CLOUDINARY_CONFIG.cloudName &&
        CLOUDINARY_CONFIG.uploadPreset &&
        !CLOUDINARY_CONFIG.cloudName.startsWith("VOTRE_") &&
        !CLOUDINARY_CONFIG.uploadPreset.startsWith("VOTRE_")
    );

}


async function envoyerImageVersCloudinary(fichier) {

    if (!fichier) {

        return "";

    }

    if (!configurationCloudinaryValide()) {

        throw new Error(
            "Cloudinary n’est pas encore configuré. Renseignez cloudName et uploadPreset dans produits.js."
        );

    }

    const fichierAEnvoyer =
        await preparerImageProduitPourUpload(fichier);

    const donnees = new FormData();

    donnees.append("file", fichierAEnvoyer);
    donnees.append(
        "upload_preset",
        CLOUDINARY_CONFIG.uploadPreset
    );

    if (CLOUDINARY_CONFIG.dossier) {

        donnees.append(
            "folder",
            CLOUDINARY_CONFIG.dossier
        );

    }

    const url =
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(
            CLOUDINARY_CONFIG.cloudName
        )}/image/upload`;

    const controleur =
        typeof AbortController !== "undefined"
            ? new AbortController()
            : null;

    const delaiMaximum = setTimeout(() => {

        if (controleur) {
            controleur.abort();
        }

    }, 90000);

    try {

        const reponse = await fetch(url, {
            method: "POST",
            body: donnees,
            signal: controleur?.signal
        });

        const resultat = await reponse.json();

        if (!reponse.ok || !resultat.secure_url) {

            throw new Error(
                resultat?.error?.message ||
                "Échec de l’envoi de l’image vers Cloudinary."
            );

        }

        return resultat.secure_url;

    } catch (error) {

        if (error?.name === "AbortError") {

            throw new Error(
                "L’envoi de l’image a pris trop de temps. Vérifiez votre connexion puis réessayez."
            );

        }

        throw error;

    } finally {

        clearTimeout(delaiMaximum);

    }

}


async function preparerImageProduitPourUpload(fichier) {

    const type = String(fichier?.type || "").toLowerCase();
    const nom = String(fichier?.name || "").toLowerCase();

    const estHEIC =
        type === "image/heic" ||
        type === "image/heif" ||
        nom.endsWith(".heic") ||
        nom.endsWith(".heif");

    /*
       Les navigateurs ne savent pas tous décoder HEIC/HEIF dans un canvas.
       Cloudinary peut recevoir le fichier original et effectuer le traitement.
    */
    if (estHEIC) {

        return fichier;

    }

    const typeCompressible = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ].includes(type);

    if (!typeCompressible) {

        return fichier;

    }

    try {

        const dimensions =
            await lireDimensionsImageProduit(fichier);

        const doitCompresser =
            fichier.size > TAILLE_CIBLE_COMPRESSION ||
            dimensions.largeur > DIMENSION_MAX_IMAGE ||
            dimensions.hauteur > DIMENSION_MAX_IMAGE;

        if (!doitCompresser) {

            return fichier;

        }

        return await compresserImageProduitEnJPEG(
            fichier,
            dimensions
        );

    } catch (error) {

        console.warn(
            "Compression mobile impossible, envoi du fichier original.",
            error
        );

        return fichier;

    }

}


function lireDimensionsImageProduit(fichier) {

    return new Promise((resolve, reject) => {

        const urlLocale = URL.createObjectURL(fichier);
        const image = new Image();

        image.onload = () => {

            const largeur =
                image.naturalWidth || image.width;

            const hauteur =
                image.naturalHeight || image.height;

            URL.revokeObjectURL(urlLocale);

            resolve({
                largeur,
                hauteur,
                image
            });

        };

        image.onerror = () => {

            URL.revokeObjectURL(urlLocale);
            reject(new Error("Impossible de lire l’image sélectionnée."));

        };

        image.src = urlLocale;

    });

}


function compresserImageProduitEnJPEG(fichier, dimensions) {

    return new Promise((resolve, reject) => {

        const urlLocale = URL.createObjectURL(fichier);
        const image = new Image();

        image.onload = () => {

            try {

                const ratio = Math.min(
                    1,
                    DIMENSION_MAX_IMAGE / image.naturalWidth,
                    DIMENSION_MAX_IMAGE / image.naturalHeight
                );

                const largeur = Math.max(
                    1,
                    Math.round(image.naturalWidth * ratio)
                );

                const hauteur = Math.max(
                    1,
                    Math.round(image.naturalHeight * ratio)
                );

                const canvas = document.createElement("canvas");
                canvas.width = largeur;
                canvas.height = hauteur;

                const contexte = canvas.getContext("2d");

                if (!contexte) {
                    throw new Error("Canvas indisponible sur ce navigateur.");
                }

                contexte.drawImage(
                    image,
                    0,
                    0,
                    largeur,
                    hauteur
                );

                canvas.toBlob(blob => {

                    URL.revokeObjectURL(urlLocale);

                    if (!blob) {

                        reject(
                            new Error("La compression de l’image a échoué.")
                        );
                        return;

                    }

                    const nomSansExtension =
                        String(fichier.name || "produit")
                            .replace(/\.[^.]+$/, "");

                    resolve(
                        new File(
                            [blob],
                            nomSansExtension + ".jpg",
                            {
                                type: "image/jpeg",
                                lastModified: Date.now()
                            }
                        )
                    );

                }, "image/jpeg", QUALITE_JPEG_MOBILE);

            } catch (error) {

                URL.revokeObjectURL(urlLocale);
                reject(error);

            }

        };

        image.onerror = () => {

            URL.revokeObjectURL(urlLocale);
            reject(new Error("Impossible de compresser cette image."));

        };

        image.src = urlLocale;

    });

}


/* ===========================================================
   CALCULS DU PRODUIT
=========================================================== */

function initialiserCalculsProduit() {

    const champsCalcul = [
        "product-purchase-price",
        "product-vat-rate",
        "product-transport-cost",
        "product-customs-cost",
        "product-other-costs",
        "product-sale-price"
    ];

    champsCalcul.forEach(id => {

        const champ =
            document.getElementById(id);

        if (champ) {

            champ.addEventListener(
                "input",
                calculerValeursProduit
            );

        }

    });

    calculerValeursProduit();

}


function calculerValeursProduit() {

    const prixAchat =
        obtenirValeurNombre("product-purchase-price");

    const tauxTVA =
        obtenirValeurNombre("product-vat-rate");

    const fraisTransport =
        obtenirValeurNombre("product-transport-cost");

    const fraisDouane =
        obtenirValeurNombre("product-customs-cost");

    const autresFrais =
        obtenirValeurNombre("product-other-costs");

    const prixVente =
        obtenirValeurNombre("product-sale-price");

    const montantTVA =
        prixAchat * tauxTVA / 100;

    const prixRevient =
        prixAchat +
        montantTVA +
        fraisTransport +
        fraisDouane +
        autresFrais;

    const margeFCFA =
        prixVente - prixRevient;

    const tauxMarge =
        prixRevient > 0
            ? margeFCFA / prixRevient * 100
            : 0;

    definirValeurChamp(
        "product-vat-amount",
        arrondirNombre(montantTVA)
    );

    definirValeurChamp(
        "product-cost-price",
        arrondirNombre(prixRevient)
    );

    definirValeurChamp(
        "product-margin-amount",
        arrondirNombre(margeFCFA)
    );

    definirValeurChamp(
        "product-margin-rate",
        arrondirNombre(tauxMarge, 2)
    );

}


function obtenirValeurNombre(id) {

    const champ =
        document.getElementById(id);

    if (!champ) {

        return 0;

    }

    return convertirNombre(champ.value);

}


function definirValeurChamp(id, valeur) {

    const champ =
        document.getElementById(id);

    if (champ) {

        champ.value = valeur;

    }

}


function arrondirNombre(nombre, decimales = 0) {

    const facteur =
        Math.pow(10, decimales);

    return Math.round(nombre * facteur) / facteur;

}


/* ===========================================================
   FORMULAIRE PRODUIT
=========================================================== */

function initialiserFormulaireProduit() {

    const formulaire =
        document.getElementById("product-form");

    if (!formulaire) {

        console.error(
            "Le formulaire #product-form est introuvable."
        );

        return;

    }

    formulaire.addEventListener(
        "submit",
        enregistrerProduit
    );

}


async function enregistrerProduit(event) {

    event.preventDefault();

    const formulaire =
        document.getElementById("product-form");

    const boutonEnregistrer =
        document.getElementById("save-product-btn");

    if (!formulaire) {
        return;
    }

    const referenceChamp =
        document.getElementById("product-reference");

    const designationChamp =
        document.getElementById("product-name");

    const referenceProduit =
        referenceChamp
            ? referenceChamp.value.trim()
            : "";

    const designation =
        designationChamp
            ? designationChamp.value.trim()
            : "";

    if (!referenceProduit || !designation) {

        afficherMessageFormulaireProduit(
            "La référence automatique et la désignation sont obligatoires.",
            "error"
        );

        return;
    }

    if (!formulaire.checkValidity()) {
        formulaire.reportValidity();
        return;
    }

    calculerValeursProduit();

    /*
       On capture l'état de l'image avant de fermer/réinitialiser la modale.
       - Si l'URL Cloudinary est déjà prête, elle est enregistrée directement.
       - Sinon, le produit est créé sans image et la promesse continue en fond.
    */
    const imageURLDejaPrete =
        urlImageProduitTeleversee ||
        obtenirValeurTexte("product-image-url");

    const imageAEnvoyer = imageProduitSelectionnee;

    if (imageAEnvoyer && !imageURLDejaPrete && !promesseUploadImageProduit) {
        lancerUploadImageProduitEnArrierePlan(imageAEnvoyer);
    }

    const promesseImageAPoursuivre =
        imageAEnvoyer && !imageURLDejaPrete
            ? promesseUploadImageProduit
            : null;

    const produit = {
        idProduit: idProduitEnModification || "",
        "ID Produit": idProduitEnModification || "",
        referenceProduit: referenceProduit,
        reference: referenceProduit,
        designation,

        description:
            obtenirValeurTexte("product-description"),

        prixAchat:
            obtenirValeurNombre("product-purchase-price"),

        tauxTVA:
            obtenirValeurNombre("product-vat-rate"),

        montantTVA:
            obtenirValeurNombre("product-vat-amount"),

        fraisTransport:
            obtenirValeurNombre("product-transport-cost"),

        fraisDouane:
            obtenirValeurNombre("product-customs-cost"),

        autresFrais:
            obtenirValeurNombre("product-other-costs"),

        prixRevient:
            obtenirValeurNombre("product-cost-price"),

        prixVente:
            obtenirValeurNombre("product-sale-price"),

        prixMinimumVente:
            obtenirValeurNombre("product-minimum-price"),

        margeFCFA:
            obtenirValeurNombre("product-margin-amount"),

        tauxMarge:
            obtenirValeurNombre("product-margin-rate"),

        stockInitial:
            obtenirValeurNombre("product-initial-stock"),

        seuilAlerte:
            obtenirValeurNombre("product-alert-threshold"),

        idFournisseurPrincipal:
            obtenirValeurTexte("product-main-supplier"),

        garantieMois:
            obtenirValeurNombre("product-warranty"),

        /* Ne bloque jamais la création pour attendre l'image. */
        imageURL: imageURLDejaPrete || "",

        statut:
            obtenirValeurTexte("product-status") || "Actif",

        commentaire:
            obtenirValeurTexte("product-comment")
    };

    try {

        if (boutonEnregistrer) {
            boutonEnregistrer.disabled = true;
            boutonEnregistrer.textContent = "Enregistrement...";
        }

        const estModification = Boolean(idProduitEnModification);

        afficherMessageFormulaireProduit(
            estModification
                ? "Enregistrement des modifications..."
                : "Enregistrement du produit...",
            "info"
        );

        const resultat =
            await apiPost(
                estModification
                    ? "updateProduit"
                    : "createProduit",
                produit
            );

        if (!resultat || !resultat.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le produit."
            );
        }

        const produitCree = resultat.data || {};

        if (promesseImageAPoursuivre) {
            produitCree._imageSyncPending = true;
        }

        /*
           Affichage immédiat : aucune nouvelle lecture complète de Sheets
           n'est nécessaire avant de fermer la fenêtre.
        */
        produits = estModification
            ? produits.map(produitExistant =>
                String(
                    produitExistant["ID Produit"] ||
                    produitExistant.idProduit ||
                    ""
                ) === String(
                    produitCree["ID Produit"] ||
                    produitCree.idProduit ||
                    idProduitEnModification
                )
                    ? produitCree
                    : produitExistant
            )
            : [
                produitCree,
                ...produits.filter(produitExistant =>
                    String(produitExistant["ID Produit"] || "") !==
                    String(produitCree["ID Produit"] || "")
                )
            ];

        mettreAJourKPIs();
        appliquerFiltresProduits();

        fermerModaleProduit();

        idProduitEnModification = "";
        configurerModaleProduit("creation");
        formulaire.reset();
        remettreValeursParDefautProduit();
        reinitialiserImageProduit();
        genererReferenceProduit();

        /*
           La synchronisation Cloudinary → Google Sheets continue après
           la fermeture. On ne met volontairement pas "await" ici.
        */
        if (promesseImageAPoursuivre) {
            synchroniserImageProduitEnArrierePlan(
                produitCree,
                promesseImageAPoursuivre
            );
        }

    } catch (error) {

        console.error(
            "Erreur d'enregistrement du produit :",
            error
        );

        afficherMessageFormulaireProduit(
            error.message ||
            "Une erreur est survenue.",
            "error"
        );

    } finally {

        if (boutonEnregistrer) {
            boutonEnregistrer.disabled = false;
            boutonEnregistrer.textContent =
                idProduitEnModification
                    ? "Enregistrer la modification"
                    : "Enregistrer le produit";
        }
    }
}


async function synchroniserImageProduitEnArrierePlan(
    produitCree,
    promesseUpload
) {

    const idProduit = String(
        produitCree?.["ID Produit"] ||
        produitCree?.idProduit ||
        ""
    ).trim();

    if (!idProduit || !promesseUpload) {
        return;
    }

    try {

        const resultatUpload = await promesseUpload;

        if (!resultatUpload?.success || !resultatUpload.url) {
            throw resultatUpload?.error || new Error(
                "L'image n'a pas pu être envoyée vers Cloudinary."
            );
        }

        const resultatMiseAJour = await apiPost(
            "updateProduitImage",
            {
                idProduit,
                imageURL: resultatUpload.url
            }
        );

        if (!resultatMiseAJour || !resultatMiseAJour.success) {
            throw new Error(
                resultatMiseAJour?.message ||
                "L'image n'a pas pu être rattachée au produit."
            );
        }

        const produitMisAJour =
            resultatMiseAJour.data || {};

        produits = produits.map(produit => {

            if (
                String(produit["ID Produit"] || "") !== idProduit
            ) {
                return produit;
            }

            return {
                ...produit,
                ...produitMisAJour,
                "Image URL":
                    lireValeurProduit(produitMisAJour, ["Image (Url)", "Image URL", "imageURL"]) ||
                    resultatUpload.url,
                _imageSyncPending: false,
                _imageSyncError: false
            };
        });

        appliquerFiltresProduits();

        console.log(
            "Image du produit synchronisée : " + idProduit
        );

    } catch (error) {

        console.error(
            "Erreur de synchronisation de l'image du produit :",
            error
        );

        produits = produits.map(produit => {

            if (
                String(produit["ID Produit"] || "") !== idProduit
            ) {
                return produit;
            }

            return {
                ...produit,
                _imageSyncPending: false,
                _imageSyncError: true
            };
        });

        appliquerFiltresProduits();
    }
}


function obtenirValeurTexte(id) {

    const champ =
        document.getElementById(id);

    return champ
        ? String(champ.value || "").trim()
        : "";

}


function afficherMessageFormulaireProduit(
    message,
    type = "info"
) {

    const zoneMessage =
        document.getElementById(
            "product-form-message"
        );

    if (!zoneMessage) {

        return;

    }

    zoneMessage.textContent = message;
    zoneMessage.className =
        "form-message " + type;
    zoneMessage.style.display = "block";

}


function masquerMessageFormulaireProduit() {

    const zoneMessage =
        document.getElementById(
            "product-form-message"
        );

    if (!zoneMessage) {

        return;

    }

    zoneMessage.textContent = "";
    zoneMessage.className = "form-message";
    zoneMessage.style.display = "none";

}


function remettreValeursParDefautProduit() {

    definirValeurChamp("product-purchase-price", "");
    definirValeurChamp("product-vat-rate", 18);
    definirValeurChamp("product-vat-amount", 0);
    definirValeurChamp("product-transport-cost", "");
    definirValeurChamp("product-customs-cost", "");
    definirValeurChamp("product-other-costs", "");
    definirValeurChamp("product-cost-price", 0);
    definirValeurChamp("product-sale-price", "");
    definirValeurChamp("product-minimum-price", "");
    definirValeurChamp("product-margin-amount", 0);
    definirValeurChamp("product-margin-rate", 0);
    definirValeurChamp("product-initial-stock", "");
    definirValeurChamp("product-alert-threshold", "");
    definirValeurChamp("product-warranty", "");
    definirValeurChamp("product-main-supplier", "");

    const statut =
        document.getElementById("product-status");

    if (statut) {

        statut.value = "Actif";

    }

    calculerValeursProduit();

}


/* ===========================================================
   CHARGEMENT DEPUIS L'API
=========================================================== */

async function chargerProduitsDepuisAPI() {

    try {

        afficherEtatChargement();

        const resultat =
            await apiGet("getProduits");

        if (!resultat.success) {

            throw new Error(
                resultat.message ||
                "Impossible de récupérer les produits."
            );

        }

        chargerProduits(resultat.data);

        console.log(
            produits.length +
            " produit(s) chargé(s) depuis Google Sheets."
        );

    } catch (error) {

        console.error(
            "Erreur lors du chargement des produits :",
            error
        );

        afficherErreurChargement(
            error.message
        );

    }

}


/* ===========================================================
   CHARGEMENT DES PRODUITS
=========================================================== */

function chargerProduits(data) {

    produits = Array.isArray(data)
        ? data
        : [];

    mettreAJourKPIs();

    /*
        Ces fonctions seront activées dès que nous ajouterons
        l'affichage du tableau et les filtres.
    */

    if (typeof afficherProduits === "function") {

        appliquerFiltresProduits();

    } else {

        afficherMessageTableauVide();

    }

    if (typeof remplirFiltres === "function") {

        remplirFiltres();

    }

    if (typeof pagination === "function") {

        pagination();

    }

}


/* ===========================================================
   AFFICHAGE DÉTAILLÉ DES PRODUITS
=========================================================== */

function afficherProduits(listeProduits) {

    const tableBody = obtenirCorpsTableauProduits();

    if (!tableBody) {
        console.error(
            "Le corps du tableau des produits est introuvable."
        );
        return;
    }

    const liste = Array.isArray(listeProduits)
        ? listeProduits
        : [];

    if (liste.length === 0) {
        afficherMessageTableauVide();
        return;
    }

    tableBody.innerHTML = liste.map(produit => {

        const idProduitBrut = String(
            lireValeurProduit(
                produit,
                ["ID Produit", "idProduit"]
            ) || ""
        ).trim();

        const idProduit = echapperHTML(idProduitBrut);

        const reference = echapperHTML(
            lireValeurProduit(
                produit,
                ["Référence Produit", "referenceProduit", "reference"]
            ) || "—"
        );

        const designation = echapperHTML(
            lireValeurProduit(
                produit,
                ["Désignation", "designation"]
            ) || "—"
        );

        const description = echapperHTML(
            lireValeurProduit(
                produit,
                ["Description", "description"]
            ) || ""
        );

        const prixRevient = formaterMontantProduit(
            lireValeurProduit(
                produit,
                ["Prix de Revient", "prixRevient"]
            )
        );

        const prixVente = formaterMontantProduit(
            lireValeurProduit(
                produit,
                ["Prix de Vente", "prixVente"]
            )
        );

        const margeFCFA = formaterMontantProduit(
            lireValeurProduit(
                produit,
                ["Marge (FCFA)", "margeFCFA"]
            )
        );

        const tauxMarge = formaterPourcentageProduit(
            lireValeurProduit(
                produit,
                ["Taux de Marge", "Taux de Marge (%)", "tauxMarge"]
            )
        );

        const fournisseur = echapperHTML(
            lireValeurProduit(
                produit,
                [
                    "Nom Fournisseur",
                    "Fournisseur",
                    "ID Fournisseur",
                    "ID Fournisseur Principal",
                    "idFournisseurPrincipal"
                ]
            ) || "—"
        );

        const statut = String(
            lireValeurProduit(
                produit,
                ["Statut", "statut"]
            ) || ""
        ).trim();

        const statutNormalise = statut.toLowerCase();

        const classeStatut =
            statutNormalise === "actif"
                ? "status-active"
                : statutNormalise === "archivé" ||
                  statutNormalise === "archive"
                    ? "status-archived"
                    : "status-inactive";

        return `
            <tr data-product-id="${idProduit}">

                <td>
                    <strong>${reference}</strong>
                </td>

                <td>
                    <div class="product-table-name">
                        <strong>${designation}</strong>

                        ${
                            description
                                ? `<small>${description}</small>`
                                : ""
                        }
                    </div>
                </td>

                <td>
                    ${prixRevient}
                </td>

                <td>
                    ${prixVente}
                </td>

                <td>
                    <div class="product-table-margin">
                        <strong>${margeFCFA}</strong>
                        <small>${tauxMarge}</small>
                    </div>
                </td>

                <td>
                    ${fournisseur}
                </td>

                <td>
                    <span class="product-status ${classeStatut}">
                        ${echapperHTML(statut || "—")}
                    </span>
                </td>

                <td>
                    <div class="table-actions product-actions-cell">

                    <button
                        type="button"
                        class="table-action-btn view-btn view-product-btn"
                        data-product-id="${idProduit}"
                        title="Voir le produit"
                        aria-label="Voir le produit"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"
                            ></path>
                            <circle
                                cx="12"
                                cy="12"
                                r="3"
                            ></circle>
                        </svg>
                    </button>

                    <button
                        type="button"
                        class="table-action-btn edit-btn edit-product-btn"
                        data-product-id="${idProduit}"
                        title="Modifier le produit"
                        aria-label="Modifier le produit"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path d="M12 20h9"></path>
                            <path
                                d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
                            ></path>
                        </svg>
                    </button>

                    <button
                        type="button"
                        class="table-action-btn delete-btn delete-product-btn"
                        data-product-id="${idProduit}"
                        title="Supprimer le produit"
                        aria-label="Supprimer le produit"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path d="M3 6h18"></path>
                            <path d="M8 6V4h8v2"></path>
                            <path d="M19 6l-1 14H6L5 6"></path>
                            <path d="M10 11v6"></path>
                            <path d="M14 11v6"></path>
                        </svg>
                    </button>

                    </div>
                </td>

            </tr>
        `;

    }).join("");
}


function formaterMontantProduit(valeur) {

    const montant = convertirNombre(valeur);

    if (!Number.isFinite(montant)) {
        return "—";
    }

    return montant.toLocaleString("fr-FR", {
        maximumFractionDigits: 0
    }) + " FCFA";
}


function formaterPourcentageProduit(valeur) {

    const taux = convertirNombre(valeur);

    if (!Number.isFinite(taux)) {
        return "—";
    }

    /*
       Dans Google Sheets, 2,0562 représente 205,62 %.
    */
    return (taux * 100).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " %";
}

function lireValeurProduit(produit, cles) {

    if (!produit || !Array.isArray(cles)) {
        return "";
    }

    for (const cle of cles) {

        if (
            Object.prototype.hasOwnProperty.call(produit, cle) &&
            produit[cle] !== null &&
            produit[cle] !== undefined &&
            produit[cle] !== ""
        ) {
            return produit[cle];
        }
    }

    return "";
}


function formaterDateProduit(valeur) {

    if (!valeur) {
        return "—";
    }

    const date = new Date(valeur);

    if (Number.isNaN(date.getTime())) {
        return echapperHTML(valeur);
    }

    return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}



/* ===========================================================
   MODIFICATION D'UN PRODUIT
=========================================================== */

function initialiserModificationProduit() {

    const tableBody = obtenirCorpsTableauProduits();

    if (!tableBody) {
        return;
    }

    tableBody.addEventListener("click", event => {

        const boutonModifier =
            event.target.closest(".edit-product-btn");

        if (!boutonModifier) {
            return;
        }

        const idProduit = String(
            boutonModifier.dataset.productId || ""
        ).trim();

        ouvrirModificationProduit(idProduit);
    });
}


function ouvrirModificationProduit(idProduit) {

    const produit = produits.find(element => {

        const id = String(
            lireValeurProduit(
                element,
                ["ID Produit", "idProduit"]
            ) || ""
        ).trim();

        return id === String(idProduit).trim();
    });

    if (!produit) {
        console.error("Produit introuvable :", idProduit);
        return;
    }

    const modale = document.getElementById("product-modal");
    const formulaire = document.getElementById("product-form");

    if (!modale || !formulaire) {
        return;
    }

    idProduitEnModification = String(idProduit).trim();
    configurerModaleProduit("modification");
    formulaire.reset();
    reinitialiserImageProduit();
    masquerMessageFormulaireProduit();

    definirValeurChamp(
        "product-reference",
        lireValeurProduit(
            produit,
            ["Référence Produit", "referenceProduit", "reference"]
        )
    );
    definirValeurChamp(
        "product-name",
        lireValeurProduit(produit, ["Désignation", "designation"])
    );
    definirValeurChamp(
        "product-description",
        lireValeurProduit(produit, ["Description", "description"])
    );
    definirValeurChamp(
        "product-purchase-price",
        lireValeurProduit(
            produit,
            [
                "Prix d’Achat",
                "Prix d'Achat",
                "Prix Achat",
                "prixAchat"
            ]
        )
    );
    definirValeurChamp("product-vat-rate", 18);
    definirValeurChamp(
        "product-transport-cost",
        lireValeurProduit(
            produit,
            ["Frais de Transport", "fraisTransport"]
        )
    );
    definirValeurChamp(
        "product-customs-cost",
        lireValeurProduit(
            produit,
            ["Frais de Douane", "fraisDouane"]
        )
    );
    definirValeurChamp(
        "product-other-costs",
        lireValeurProduit(produit, ["Autres Frais", "autresFrais"])
    );
    definirValeurChamp(
        "product-sale-price",
        lireValeurProduit(produit, ["Prix de Vente", "prixVente"])
    );
    definirValeurChamp(
        "product-minimum-price",
        lireValeurProduit(
            produit,
            ["Prix Minimum de Vente", "prixMinimumVente"]
        )
    );
    definirValeurChamp(
        "product-initial-stock",
        lireValeurProduit(produit, ["Stock Initial", "stockInitial"])
    );
    definirValeurChamp(
        "product-alert-threshold",
        lireValeurProduit(produit, ["Seuil d'Alerte", "seuilAlerte"])
    );
    definirValeurChamp(
        "product-warranty",
        lireValeurProduit(produit, ["Garantie (Mois)", "garantieMois"])
    );
    definirValeurChamp(
        "product-status",
        lireValeurProduit(produit, ["Statut", "statut"]) || "Actif"
    );
    definirValeurChamp(
        "product-comment",
        lireValeurProduit(produit, ["Commentaire", "commentaire"])
    );

    selectionnerFournisseurProduit(
        lireValeurProduit(
            produit,
            ["ID Fournisseur Principal", "idFournisseurPrincipal"]
        )
    );

    afficherImageExistanteFormulaireProduit(
        lireValeurProduit(produit, ["Image URL", "imageURL"])
    );

    calculerValeursProduit();

    modale.classList.add("active");
    modale.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    const designation = document.getElementById("product-name");
    if (designation) {
        setTimeout(() => designation.focus(), 100);
    }
}


function selectionnerFournisseurProduit(valeur) {

    const select = document.getElementById("product-main-supplier");
    const idFournisseur = String(valeur || "").trim();

    if (!select) {
        return;
    }

    if (
        idFournisseur &&
        !Array.from(select.options).some(
            option => option.value === idFournisseur
        )
    ) {
        const option = document.createElement("option");
        option.value = idFournisseur;
        option.textContent = idFournisseur;
        option.dataset.temporary = "true";
        select.appendChild(option);
    }

    select.value = idFournisseur;
}


function afficherImageExistanteFormulaireProduit(url) {

    const imageURL = String(url || "").trim();
    const champURL = document.getElementById("product-image-url");
    const placeholder = document.getElementById("product-image-placeholder");
    const wrapper = document.getElementById("product-image-preview-wrapper");
    const image = document.getElementById("product-image-preview");
    const nom = document.getElementById("product-image-name");
    const taille = document.getElementById("product-image-size");

    urlImageProduitTeleversee = imageURL;

    if (champURL) {
        champURL.value = imageURL;
    }

    if (!imageURL || !wrapper || !image) {
        return;
    }

    image.src = imageURL;
    wrapper.hidden = false;

    if (placeholder) {
        placeholder.hidden = true;
    }

    if (nom) {
        nom.textContent = "Image actuelle du produit";
    }

    if (taille) {
        taille.textContent = "Conservée si aucune nouvelle image n'est choisie";
    }
}


/* ===========================================================
   CONSULTATION D'UN PRODUIT
=========================================================== */

function initialiserConsultationProduit() {

    const tableBody = obtenirCorpsTableauProduits();
    const boutonFermer = document.getElementById("close-product-view-modal");
    const boutonFermerFooter =
        document.getElementById("close-product-view-modal-footer");

    if (tableBody) {

        tableBody.addEventListener("click", event => {

            const boutonVoir = event.target.closest(".view-product-btn");

            if (!boutonVoir) {
                return;
            }

            const idProduit = String(
                boutonVoir.dataset.productId || ""
            ).trim();

            ouvrirConsultationProduit(idProduit);
        });
    }

    /*
       La fenêtre de consultation ne se ferme volontairement que :
       - avec la croix en haut à droite ;
       - avec le bouton Fermer en bas.

       Un clic sur le fond de la modale ou la touche Échap ne la ferment pas.
    */
    [boutonFermer, boutonFermerFooter].forEach(bouton => {

        if (bouton) {
            bouton.addEventListener("click", fermerConsultationProduit);
        }
    });
}


function ouvrirConsultationProduit(idProduit) {

    const produit = produits.find(element => {

        const id = String(
            lireValeurProduit(element, ["ID Produit", "idProduit"]) || ""
        ).trim();

        return id === idProduit;
    });

    if (!produit) {
        console.error("Produit introuvable :", idProduit);
        return;
    }

    definirTexteElement(
        "view-product-id",
        lireValeurProduit(produit, ["ID Produit", "idProduit"]) || "—"
    );

    definirTexteElement(
        "view-product-reference",
        lireValeurProduit(
            produit,
            ["Référence Produit", "referenceProduit", "reference"]
        ) || "—"
    );

    definirTexteElement(
        "view-product-name",
        lireValeurProduit(produit, ["Désignation", "designation"]) || "—"
    );

    definirTexteElement(
        "view-product-description",
        lireValeurProduit(produit, ["Description", "description"]) || "—"
    );

    definirTexteElement(
        "view-product-purchase-price",
        formatMoney(
            lireValeurProduit(
                produit,
                ["Prix d’Achat", "Prix d'Achat", "prixAchat"]
            )
        )
    );

    definirTexteElement(
        "view-product-vat-rate",
        formatNumber(
            lireValeurProduit(produit, ["TVA", "Taux TVA (%)", "tauxTVA"])
        ) + " %"
    );

    definirTexteElement(
        "view-product-vat-amount",
        formatMoney(
            lireValeurProduit(produit, ["Montant TVA", "montantTVA"])
        )
    );

    definirTexteElement(
        "view-product-transport-cost",
        formatMoney(
            lireValeurProduit(
                produit,
                ["Frais de Transport", "fraisTransport"]
            )
        )
    );

    definirTexteElement(
        "view-product-customs-cost",
        formatMoney(
            lireValeurProduit(
                produit,
                ["Frais de Douane", "fraisDouane"]
            )
        )
    );

    definirTexteElement(
        "view-product-other-costs",
        formatMoney(
            lireValeurProduit(produit, ["Autres Frais", "autresFrais"])
        )
    );

    definirTexteElement(
        "view-product-cost-price",
        formatMoney(
            lireValeurProduit(produit, ["Prix de Revient", "prixRevient"])
        )
    );

    definirTexteElement(
        "view-product-summary-cost-price",
        formatMoney(
            lireValeurProduit(produit, ["Prix de Revient", "prixRevient"])
        )
    );

    definirTexteElement(
        "view-product-minimum-price",
        formatMoney(
            lireValeurProduit(
                produit,
                ["Prix Minimum de Vente", "prixMinimumVente"]
            )
        )
    );

    definirTexteElement(
        "view-product-sale-price",
        formatMoney(
            lireValeurProduit(produit, ["Prix de Vente", "prixVente"])
        )
    );

    definirTexteElement(
        "view-product-margin-amount",
        formatMoney(
            lireValeurProduit(produit, ["Marge (FCFA)", "margeFCFA"])
        )
    );

    definirTexteElement(
        "view-product-margin-rate",
        formatNumber(
            lireValeurProduit(
                produit,
                ["Taux de Marge", "Taux de Marge (%)", "tauxMarge"]
            )
        ) + " %"
    );

    definirTexteElement(
        "view-product-summary-margin-amount",
        formatMoney(
            lireValeurProduit(produit, ["Marge (FCFA)", "margeFCFA"])
        )
    );

    definirTexteElement(
        "view-product-summary-margin-rate",
        "(" +
        formatNumber(
            lireValeurProduit(
                produit,
                ["Taux de Marge", "Taux de Marge (%)", "tauxMarge"]
            )
        ) +
        " %)"
    );

    definirTexteElement(
        "view-product-stock",
        formatNumber(
            lireValeurProduit(produit, ["Stock Initial", "stockInitial"])
        )
    );

    definirTexteElement(
        "view-product-alert-threshold",
        formatNumber(
            lireValeurProduit(
                produit,
                ["Seuil d'Alerte", "Seuil d’alerte", "seuilAlerte"]
            )
        )
    );

    definirTexteElement(
        "view-product-supplier",
        lireValeurProduit(
            produit,
            [
                "ID Fournisseur",
                "ID Fournisseur Principal",
                "idFournisseurPrincipal"
            ]
        ) || "—"
    );

    definirTexteElement(
        "view-product-warranty",
        formatNumber(
            lireValeurProduit(
                produit,
                ["Garantie", "Garantie (mois)", "garantieMois"]
            )
        ) + " mois"
    );

    definirTexteElement(
        "view-product-created-at",
        formaterDateProduit(
            lireValeurProduit(
                produit,
                ["Date d'ajout", "Date d'Ajout", "dateAjout"]
            )
        )
    );

    definirTexteElement(
        "view-product-updated-at",
        formaterDateProduit(
            lireValeurProduit(
                produit,
                ["Date de modification", "Date de Modification", "dateModification"]
            )
        )
    );

    definirTexteElement(
        "view-product-status",
        lireValeurProduit(produit, ["Statut", "statut"]) || "—"
    );

    mettreAJourBadgeStatutProduit(
        lireValeurProduit(produit, ["Statut", "statut"]) || "—"
    );

    definirTexteElement(
        "view-product-comment",
        lireValeurProduit(produit, ["Commentaire", "commentaire"]) || "—"
    );

    afficherImageConsultationProduit(
        lireValeurProduit(
            produit,
            ["Image (Url)", "Image URL", "imageURL"]
        )
    );

    const modal = document.getElementById("product-view-modal");

    if (!modal) {
        return;
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}



function mettreAJourBadgeStatutProduit(statut) {

    const badge = document.getElementById("product-view-status-badge");

    if (!badge) {
        return;
    }

    const valeur = String(statut || "").trim().toLowerCase();

    badge.classList.remove("is-active", "is-inactive", "is-warning");

    if (
        valeur.includes("actif") &&
        !valeur.includes("inactif")
    ) {
        badge.classList.add("is-active");
        return;
    }

    if (
        valeur.includes("inactif") ||
        valeur.includes("désactiv") ||
        valeur.includes("desactiv")
    ) {
        badge.classList.add("is-inactive");
        return;
    }

    if (
        valeur.includes("rupture") ||
        valeur.includes("alerte") ||
        valeur.includes("attente")
    ) {
        badge.classList.add("is-warning");
    }
}

function fermerConsultationProduit() {

    const modal = document.getElementById("product-view-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}


function afficherImageConsultationProduit(urlImage) {

    const image = document.getElementById("product-view-image");
    const placeholder =
        document.getElementById("product-view-image-placeholder");

    if (!image || !placeholder) {
        return;
    }

    const url = String(urlImage || "").trim();

    image.onerror = null;
    image.removeAttribute("src");
    image.hidden = true;
    placeholder.hidden = false;

    if (!url) {
        return;
    }

    /* Masquer immédiatement le placeholder lorsqu’une image est disponible. */
    placeholder.hidden = true;

    image.onload = () => {
        image.hidden = false;
        placeholder.hidden = true;
    };

    image.onerror = () => {
        image.hidden = true;
        placeholder.hidden = false;
    };

    image.src = url;
}


/* ===========================================================
   ÉTAT DE CHARGEMENT DU TABLEAU
=========================================================== */

function afficherEtatChargement() {

    const tableBody =
        obtenirCorpsTableauProduits();

    if (!tableBody) {

        return;

    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="table-message">
                Chargement des produits...
            </td>
        </tr>
    `;

}


/* ===========================================================
   MESSAGE TABLEAU VIDE
=========================================================== */

function afficherMessageTableauVide() {

    const tableBody =
        obtenirCorpsTableauProduits();

    if (!tableBody) {

        return;

    }

    if (produits.length > 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="table-message">
                    ${produits.length} produit(s) récupéré(s).
                    L'affichage détaillé du tableau sera ajouté
                    à l'étape suivante.
                </td>
            </tr>
        `;

        return;

    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="table-message">
                Aucun produit enregistré.
            </td>
        </tr>
    `;

}


/* ===========================================================
   ERREUR DE CHARGEMENT
=========================================================== */

function afficherErreurChargement(message) {

    const tableBody =
        obtenirCorpsTableauProduits();

    if (!tableBody) {

        return;

    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="table-message table-error">
                Impossible de charger les produits.
                ${echapperHTML(message)}
            </td>
        </tr>
    `;

}


/* ===========================================================
   RÉCUPÉRER LE CORPS DU TABLEAU
=========================================================== */

function obtenirCorpsTableauProduits() {

    return (
        document.getElementById("products-table-body") ||
        document.getElementById("produits-table-body") ||
        document.querySelector(".sales-table tbody") ||
        document.querySelector("table tbody")
    );

}


/* ===========================================================
   KPI
=========================================================== */

function mettreAJourKPIs() {

    const totalProduits =
        produits.length;

    const produitsActifs =
        produits.filter(produit => {

            return String(produit.Statut || "")
                .trim()
                .toLowerCase() === "actif";

        }).length;

    let valeurStock = 0;
    let sommeMarges = 0;
    let nbMarges = 0;
    let ajoutesCeMois = 0;

    let sommeMargesMoisActuel = 0;
    let nbMargesMoisActuel = 0;
    let sommeMargesMoisPrecedent = 0;
    let nbMargesMoisPrecedent = 0;

    const maintenant = new Date();
    const debutMoisActuel = new Date(
        maintenant.getFullYear(),
        maintenant.getMonth(),
        1
    );
    const debutMoisSuivant = new Date(
        maintenant.getFullYear(),
        maintenant.getMonth() + 1,
        1
    );
    const debutMoisPrecedent = new Date(
        maintenant.getFullYear(),
        maintenant.getMonth() - 1,
        1
    );

    produits.forEach(produit => {

        const prixRevient =
            convertirNombre(
                lireValeurProduit(
                    produit,
                    ["Prix de Revient", "prixRevient"]
                )
            );

        const stockInitial =
            convertirNombre(
                lireValeurProduit(
                    produit,
                    ["Stock Initial", "stockInitial"]
                )
            );

        valeurStock += prixRevient * stockInitial;

        const marge =
            convertirNombre(
                lireValeurProduit(
                    produit,
                    [
                        "Taux de Marge",
                        "Taux de Marge (%)",
                        "tauxMarge"
                    ]
                )
            );

        if (Number.isFinite(marge)) {
            sommeMarges += marge;
            nbMarges++;
        }

        const dateAjoutBrute =
            lireValeurProduit(
                produit,
                [
                    "Date d'ajout",
                    "Date d’Ajout",
                    "Date d'Ajout",
                    "dateAjout"
                ]
            );

        if (!dateAjoutBrute) {
            return;
        }

        const dateAjout = new Date(dateAjoutBrute);

        if (Number.isNaN(dateAjout.getTime())) {
            return;
        }

        if (
            dateAjout >= debutMoisActuel &&
            dateAjout < debutMoisSuivant
        ) {
            ajoutesCeMois++;

            if (Number.isFinite(marge)) {
                sommeMargesMoisActuel += marge;
                nbMargesMoisActuel++;
            }
        } else if (
            dateAjout >= debutMoisPrecedent &&
            dateAjout < debutMoisActuel
        ) {
            if (Number.isFinite(marge)) {
                sommeMargesMoisPrecedent += marge;
                nbMargesMoisPrecedent++;
            }
        }

    });

    const margeMoyenne =
        nbMarges > 0
            ? sommeMarges / nbMarges
            : 0;

    const margeMoyenneMoisActuel =
        nbMargesMoisActuel > 0
            ? sommeMargesMoisActuel / nbMargesMoisActuel
            : 0;

    const margeMoyenneMoisPrecedent =
        nbMargesMoisPrecedent > 0
            ? sommeMargesMoisPrecedent / nbMargesMoisPrecedent
            : 0;

    definirTexteElement(
        "kpi-total-products",
        totalProduits
    );

    definirTexteElement(
        "kpi-products-month",
        "+" + ajoutesCeMois + " ce mois"
    );

    definirTexteElement(
        "kpi-stock-value",
        formatMoney(valeurStock)
    );

    definirTexteElement(
        "kpi-average-margin",
        formatNumber(margeMoyenne) + " %"
    );

    mettreAJourTendanceMargeMoyenne(
        margeMoyenneMoisActuel,
        margeMoyenneMoisPrecedent,
        nbMargesMoisActuel,
        nbMargesMoisPrecedent
    );

    definirTexteElement(
        "kpi-active-products",
        produitsActifs
    );

    const pourcentageProduitsActifs =
        totalProduits === 0
            ? 0
            : Math.round(
                produitsActifs /
                totalProduits *
                100
            );

    definirTexteElement(
        "kpi-active-percent",
        pourcentageProduitsActifs +
        " % du catalogue"
    );

}


function mettreAJourTendanceMargeMoyenne(
    margeActuelle,
    margePrecedente,
    nombreActuel,
    nombrePrecedent
) {

    const element =
        document.getElementById(
            "kpi-average-margin-fcfa"
        );

    if (!element) {
        return;
    }

    element.style.fontWeight = "600";

    if (nombreActuel === 0) {
        element.textContent =
            "Aucun produit ajouté ce mois";
        element.style.color = "#64748b";
        return;
    }

    if (
        nombrePrecedent === 0 ||
        margePrecedente === 0
    ) {
        element.textContent =
            "→ Aucune comparaison disponible";
        element.style.color = "#64748b";
        return;
    }

    const tendance =
        ((margeActuelle - margePrecedente) /
        Math.abs(margePrecedente)) * 100;

    const valeurFormatee =
        Math.abs(tendance).toLocaleString(
            "fr-FR",
            {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }
        );

    if (tendance > 0.05) {
        element.textContent =
            `↑ ${valeurFormatee} % par rapport au mois dernier`;
        element.style.color = "#16a34a";
        return;
    }

    if (tendance < -0.05) {
        element.textContent =
            `↓ ${valeurFormatee} % par rapport au mois dernier`;
        element.style.color = "#dc2626";
        return;
    }

    element.textContent =
        "→ Stable par rapport au mois dernier";
    element.style.color = "#64748b";

}

/* ===========================================================
   MODIFIER LE TEXTE D'UN ÉLÉMENT
=========================================================== */

function definirTexteElement(id, valeur) {

    const element =
        document.getElementById(id);

    if (!element) {

        console.warn(
            "Élément HTML introuvable : #" + id
        );

        return;

    }

    element.textContent =
        valeur;

}


/* ===========================================================
   CONVERSION EN NOMBRE
=========================================================== */

function convertirNombre(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }

    const nombre =
        Number(
            String(value)
                .replace(/\s/g, "")
                .replace(",", ".")
        );

    return Number.isFinite(nombre)
        ? nombre
        : 0;

}


/* ===========================================================
   FORMAT DES NOMBRES
=========================================================== */

function formatNumber(value) {

    return convertirNombre(value)
        .toLocaleString(
            "fr-FR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1
            }
        );

}


/* ===========================================================
   FORMAT FCFA
=========================================================== */

function formatMoney(value) {

    return convertirNombre(value)
        .toLocaleString(
            "fr-FR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        ) + " FCFA";

}


/* ===========================================================
   SÉCURISATION HTML
=========================================================== */

function echapperHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}

/* ===========================================================
   LISTE DÉROULANTE DES FOURNISSEURS
   Cette fonction pourra recevoir les fournisseurs chargés
   depuis le futur module Fournisseurs.
=========================================================== */

function remplirListeFournisseursProduits(listeFournisseurs = []) {

    const select =
        document.getElementById("product-main-supplier");

    if (!select) {
        return;
    }

    const valeurSelectionnee = select.value;

    select.innerHTML = `
        <option value="">
            Sélectionner un fournisseur
        </option>
    `;

    listeFournisseurs.forEach(fournisseur => {

        const id =
            fournisseur.idFournisseur ||
            fournisseur.IDFournisseur ||
            fournisseur.id ||
            fournisseur.ID ||
            "";

        const nom =
            fournisseur.nomFournisseur ||
            fournisseur.raisonSociale ||
            fournisseur.nom ||
            fournisseur.designation ||
            id;

        if (!id) {
            return;
        }

        const option = document.createElement("option");
        option.value = String(id);
        option.textContent =
            nom && String(nom) !== String(id)
                ? `${nom} — ${id}`
                : String(id);

        select.appendChild(option);

    });

    if (
        valeurSelectionnee &&
        Array.from(select.options).some(
            option => option.value === valeurSelectionnee
        )
    ) {
        select.value = valeurSelectionnee;
    }

}


/*
   Le futur module Fournisseurs pourra envoyer sa liste ainsi :

   window.dispatchEvent(
       new CustomEvent("fournisseurs:charges", {
           detail: listeFournisseurs
       })
   );
*/

window.addEventListener(
    "fournisseurs:charges",
    event => {
        remplirListeFournisseursProduits(
            Array.isArray(event.detail)
                ? event.detail
                : []
        );
    }
);

/* ===========================================================
   TVA FIXE À 18 %
=========================================================== */

function verrouillerTVAProduit() {
    const champTVA = document.getElementById("product-vat-rate");

    if (!champTVA) {
        return;
    }

    champTVA.value = "18";
    champTVA.readOnly = true;
    champTVA.setAttribute("aria-readonly", "true");
}

document.addEventListener("DOMContentLoaded", verrouillerTVAProduit);

document.addEventListener("input", event => {
    if (event.target?.id === "product-vat-rate") {
        event.target.value = "18";
    }
});

/* ===========================================================
   ANNULATION DU FORMULAIRE PRODUIT
   Le même bouton ferme le formulaire en création comme en
   modification, sans enregistrer les changements.
=========================================================== */

function initialiserAnnulationFormulaireProduit() {
    const boutonAnnuler = document.getElementById("cancel-product-btn");

    if (!boutonAnnuler || boutonAnnuler.dataset.initialise === "true") {
        return;
    }

    boutonAnnuler.dataset.initialise = "true";

    boutonAnnuler.addEventListener("click", () => {
        fermerModaleProduit();
        idProduitEnModification = "";
        configurerModaleProduit("creation");

        const formulaire = document.getElementById("product-form");

        if (formulaire) {
            formulaire.reset();
        }

        remettreValeursParDefautProduit();
        reinitialiserImageProduit();
        masquerMessageFormulaireProduit();
    });
}

document.addEventListener(
    "DOMContentLoaded",
    initialiserAnnulationFormulaireProduit
);

/* ===========================================================
   SUPPRESSION D'UN PRODUIT
=========================================================== */

let idProduitASupprimer = "";


function initialiserSuppressionProduit() {

    const tableBody = obtenirCorpsTableauProduits();
    const boutonAnnuler =
        document.getElementById("cancel-delete-product-btn");
    const boutonConfirmer =
        document.getElementById("confirm-delete-product-btn");

    if (tableBody && tableBody.dataset.deleteInitialise !== "true") {

        tableBody.dataset.deleteInitialise = "true";

        tableBody.addEventListener("click", event => {

            const boutonSupprimer =
                event.target.closest(".delete-product-btn");

            if (!boutonSupprimer) {
                return;
            }

            const idProduit = String(
                boutonSupprimer.dataset.productId || ""
            ).trim();

            ouvrirConfirmationSuppressionProduit(idProduit);
        });
    }

    if (
        boutonAnnuler &&
        boutonAnnuler.dataset.initialise !== "true"
    ) {
        boutonAnnuler.dataset.initialise = "true";
        boutonAnnuler.addEventListener(
            "click",
            fermerConfirmationSuppressionProduit
        );
    }

    if (
        boutonConfirmer &&
        boutonConfirmer.dataset.initialise !== "true"
    ) {
        boutonConfirmer.dataset.initialise = "true";
        boutonConfirmer.addEventListener(
            "click",
            confirmerSuppressionProduit
        );
    }
}


function ouvrirConfirmationSuppressionProduit(idProduit) {

    const produit = produits.find(element => {

        const id = String(
            lireValeurProduit(
                element,
                ["ID Produit", "idProduit"]
            ) || ""
        ).trim();

        return id === String(idProduit).trim();
    });

    if (!produit) {
        console.error("Produit introuvable :", idProduit);
        return;
    }

    const modal =
        document.getElementById("delete-product-modal");

    if (!modal) {
        return;
    }

    idProduitASupprimer = String(idProduit).trim();

    definirTexteElement(
        "delete-product-reference",
        lireValeurProduit(
            produit,
            ["Référence Produit", "referenceProduit", "reference"]
        ) || "Sans référence"
    );

    definirTexteElement(
        "delete-product-name",
        lireValeurProduit(
            produit,
            ["Désignation", "designation"]
        ) || "Produit sans désignation"
    );

    afficherImageSuppressionProduit(
        lireValeurProduit(
            produit,
            [
                "Image (Url)",
                "Image URL",
                "Image",
                "imageURL",
                "imageUrl",
                "urlImage"
            ]
        )
    );

    afficherMessageSuppressionProduit("", "info");

    const boutonConfirmer =
        document.getElementById("confirm-delete-product-btn");

    if (boutonConfirmer) {
        boutonConfirmer.disabled = false;
        boutonConfirmer.textContent = "Supprimer le produit";
    }

    modal.hidden = false;

    requestAnimationFrame(() => {
        modal.classList.add("active");
        document.body.classList.add("modal-open");
        boutonConfirmer?.focus();
    });
}


function afficherImageSuppressionProduit(urlImage) {

    const image =
        document.getElementById("delete-product-image");
    const placeholder =
        document.getElementById(
            "delete-product-image-placeholder"
        );

    if (!image || !placeholder) {
        return;
    }

    const url = String(urlImage || "").trim();

    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
    image.hidden = true;
    placeholder.hidden = false;

    if (!url) {
        return;
    }

    placeholder.hidden = true;

    image.onload = () => {
        image.hidden = false;
        placeholder.hidden = true;
    };

    image.onerror = () => {
        image.hidden = true;
        image.removeAttribute("src");
        placeholder.hidden = false;
    };

    image.src = url;
}


function fermerConfirmationSuppressionProduit() {

    const modal =
        document.getElementById("delete-product-modal");

    if (modal) {
        modal.classList.remove("active", "show");
        modal.hidden = true;
    }

    idProduitASupprimer = "";
    document.body.classList.remove("modal-open");
    afficherMessageSuppressionProduit("", "info");
    afficherImageSuppressionProduit("");
}


async function confirmerSuppressionProduit() {

    if (!idProduitASupprimer) {
        return;
    }

    const boutonConfirmer =
        document.getElementById("confirm-delete-product-btn");
    const boutonAnnuler =
        document.getElementById("cancel-delete-product-btn");

    const idProduit = idProduitASupprimer;

    try {

        if (boutonConfirmer) {
            boutonConfirmer.disabled = true;
            boutonConfirmer.textContent = "Suppression...";
        }

        if (boutonAnnuler) {
            boutonAnnuler.disabled = true;
        }

        const resultat = await apiPost(
            "deleteProduit",
            { idProduit }
        );

        if (!resultat || !resultat.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de supprimer le produit."
            );
        }

        produits = produits.filter(produit => {

            const id = String(
                lireValeurProduit(
                    produit,
                    ["ID Produit", "idProduit"]
                ) || ""
            ).trim();

            return id !== idProduit;
        });

        mettreAJourKPIs();
        appliquerFiltresProduits();
        fermerConfirmationSuppressionProduit();

    } catch (error) {

        console.error(
            "Erreur de suppression du produit :",
            error
        );

        afficherMessageSuppressionProduit(
            error.message ||
            "Une erreur est survenue pendant la suppression.",
            "error"
        );

    } finally {

        if (boutonConfirmer) {
            boutonConfirmer.disabled = false;
            boutonConfirmer.textContent = "Supprimer le produit";
        }

        if (boutonAnnuler) {
            boutonAnnuler.disabled = false;
        }
    }
}


function afficherMessageSuppressionProduit(
    message,
    type = "info"
) {

    const zone =
        document.getElementById("delete-product-message");

    if (!zone) {
        return;
    }

    if (!message) {
        zone.hidden = true;
        zone.textContent = "";
        zone.className = "delete-product-message";
        return;
    }

    zone.hidden = false;
    zone.textContent = message;
    zone.className =
        `delete-product-message delete-product-message-${type}`;
}

/* ===========================================================
   RECHERCHE ET FILTRE PAR STATUT
=========================================================== */

function initialiserFiltresProduits() {

    const recherche =
        document.getElementById("products-search-input");

    const filtreStatut =
        document.getElementById("product-status-filter");

    if (
        recherche &&
        recherche.dataset.initialise !== "true"
    ) {
        recherche.dataset.initialise = "true";

        recherche.addEventListener(
            "input",
            appliquerFiltresProduits
        );
    }

    if (
        filtreStatut &&
        filtreStatut.dataset.initialise !== "true"
    ) {
        filtreStatut.dataset.initialise = "true";

        filtreStatut.addEventListener(
            "change",
            appliquerFiltresProduits
        );
    }
}


function appliquerFiltresProduits() {

    const recherche = normaliserTexteFiltreProduit(
        document.getElementById("products-search-input")?.value
    );

    const statutRecherche = normaliserStatutFiltreProduit(
        document.getElementById("product-status-filter")?.value
    );

    const listeFiltree = produits.filter(produit => {

        const reference = lireValeurProduit(
            produit,
            [
                "Référence Produit",
                "referenceProduit",
                "reference"
            ]
        );

        const designation = lireValeurProduit(
            produit,
            ["Désignation", "designation"]
        );

        const description = lireValeurProduit(
            produit,
            ["Description", "description"]
        );

        const fournisseur = lireValeurProduit(
            produit,
            [
                "Nom Fournisseur",
                "Fournisseur",
                "ID Fournisseur",
                "ID Fournisseur Principal",
                "idFournisseurPrincipal"
            ]
        );

        const texteRecherche = normaliserTexteFiltreProduit(
            [
                reference,
                designation,
                description,
                fournisseur
            ].join(" ")
        );

        const statutProduit = normaliserStatutFiltreProduit(
            lireValeurProduit(
                produit,
                ["Statut", "statut"]
            )
        );

        const correspondRecherche =
            !recherche ||
            texteRecherche.includes(recherche);

        const correspondStatut =
            !statutRecherche ||
            statutProduit === statutRecherche;

        return correspondRecherche && correspondStatut;
    });

    if (
        listeFiltree.length === 0 &&
        produits.length > 0 &&
        (recherche || statutRecherche)
    ) {
        afficherAucunResultatFiltreProduit();
        return;
    }

    afficherProduits(listeFiltree);
}


function normaliserTexteFiltreProduit(valeur) {

    return String(valeur || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


function normaliserStatutFiltreProduit(valeur) {

    const statut = normaliserTexteFiltreProduit(valeur);

    if (statut === "archive" || statut === "archivee") {
        return "archive";
    }

    return statut;
}


function afficherAucunResultatFiltreProduit() {

    const tableBody = obtenirCorpsTableauProduits();

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="table-message">
                Aucun produit ne correspond à votre recherche.
            </td>
        </tr>
    `;
}

/* ===========================================================
   HEADER PRODUITS
   Recherche synchronisée, notifications, profil et déconnexion.
=========================================================== */

function initialiserHeaderProduits() {

    initialiserRechercheHeaderProduits();
    initialiserNotificationsProduits();
    initialiserMenuProfilProduits();
    initialiserDeconnexionProduits();
}


function initialiserRechercheHeaderProduits() {

    const rechercheHeader =
        document.getElementById("header-products-search-input");

    const boutonRecherche =
        document.getElementById("header-products-search-btn");

    const rechercheModule =
        document.getElementById("products-search-input");

    const synchroniserRecherche = valeur => {

        const texte = String(valeur || "");

        if (rechercheHeader && rechercheHeader.value !== texte) {
            rechercheHeader.value = texte;
        }

        if (rechercheModule && rechercheModule.value !== texte) {
            rechercheModule.value = texte;
        }

        appliquerFiltresProduits();
    };

    rechercheHeader?.addEventListener("input", () => {
        synchroniserRecherche(rechercheHeader.value);
    });

    boutonRecherche?.addEventListener("click", event => {
        event.preventDefault();
        synchroniserRecherche(rechercheHeader?.value || "");
    });

    rechercheHeader?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            synchroniserRecherche(rechercheHeader.value);
        }
    });

    rechercheModule?.addEventListener("input", () => {
        if (
            rechercheHeader &&
            rechercheHeader.value !== rechercheModule.value
        ) {
            rechercheHeader.value = rechercheModule.value;
        }
    });
}


function initialiserNotificationsProduits() {

    const bouton =
        document.getElementById("notification-button");

    const panneau =
        document.getElementById("notification-panel");

    if (!bouton || !panneau) {
        return;
    }

    bouton.addEventListener("click", event => {

        event.stopPropagation();

        const ouvrir = panneau.hidden;

        fermerMenusHeaderProduits();

        panneau.hidden = !ouvrir;
        bouton.setAttribute(
            "aria-expanded",
            ouvrir ? "true" : "false"
        );
    });

    panneau.addEventListener("click", event => {
        event.stopPropagation();
    });
}


function initialiserMenuProfilProduits() {

    const bouton =
        document.getElementById("profile-menu-button");

    const menu =
        document.getElementById("profile-dropdown");

    if (!bouton || !menu) {
        return;
    }

    bouton.addEventListener("click", event => {

        event.stopPropagation();

        const ouvrir = menu.hidden;

        fermerMenusHeaderProduits();

        menu.hidden = !ouvrir;
        bouton.setAttribute(
            "aria-expanded",
            ouvrir ? "true" : "false"
        );
    });

    menu.addEventListener("click", event => {
        event.stopPropagation();
    });

    document.addEventListener(
        "click",
        fermerMenusHeaderProduits
    );

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            fermerMenusHeaderProduits();
        }
    });
}


function fermerMenusHeaderProduits() {

    const panneau =
        document.getElementById("notification-panel");

    const boutonNotification =
        document.getElementById("notification-button");

    const menuProfil =
        document.getElementById("profile-dropdown");

    const boutonProfil =
        document.getElementById("profile-menu-button");

    if (panneau) {
        panneau.hidden = true;
    }

    if (menuProfil) {
        menuProfil.hidden = true;
    }

    boutonNotification?.setAttribute(
        "aria-expanded",
        "false"
    );

    boutonProfil?.setAttribute(
        "aria-expanded",
        "false"
    );
}


function initialiserDeconnexionProduits() {

    const bouton =
        document.getElementById("logout-button");

    if (!bouton) {
        return;
    }

    bouton.addEventListener("click", event => {

        event.preventDefault();

        fermerMenusHeaderProduits();

        try {
            if (typeof logoutUser === "function") {
                logoutUser();
            } else {
                sessionStorage.clear();

                [
                    "user",
                    "utilisateur",
                    "currentUser",
                    "authUser",
                    "isAuthenticated",
                    "token",
                    "authToken"
                ].forEach(cle => localStorage.removeItem(cle));
            }
        } catch (error) {
            console.warn("Erreur pendant la déconnexion :", error);
        }

        window.setTimeout(() => {
            window.location.replace("connexion.html");
        }, 50);
    });
}

/* ===========================================================
   NOTIFICATIONS DU HEADER
=========================================================== */

function initialiserNotificationsProduits() {
    const boutonNotification =
        document.getElementById("notification-button");

    const panneauNotification =
        document.getElementById("notification-panel");

    if (!boutonNotification || !panneauNotification) {
        return;
    }

    boutonNotification.addEventListener("click", function (event) {
        event.stopPropagation();

        const estFerme = panneauNotification.hidden;

        panneauNotification.hidden = !estFerme;

        boutonNotification.setAttribute(
            "aria-expanded",
            estFerme ? "true" : "false"
        );
    });

    panneauNotification.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    document.addEventListener("click", function () {
        panneauNotification.hidden = true;

        boutonNotification.setAttribute(
            "aria-expanded",
            "false"
        );
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            panneauNotification.hidden = true;

            boutonNotification.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    });
}

document.addEventListener(
    "DOMContentLoaded",
    initialiserNotificationsProduits
);
