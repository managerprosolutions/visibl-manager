/* ===========================================================
   VISIBL ERP — MODULE LIVREURS
=========================================================== */

let livreursCharges = [];
let livreursFiltres = [];
let tousLivreursLocaux = []; // Point 35 — source locale complète pour recherche instantanée

// POINT 14 — préchargement silencieux des fiches détaillées
const cacheDetailsLivreurs = new Map();
let generationPrechargementDetailsLivreurs = 0;
let livreurEnModificationId = null;
let livreurASupprimer = null;

let pageLivreursActuelle = 1;
let taillePageLivreurs = 10;
let modeSelectionLivreurs = false;
const livreursSelectionnes = new Set();

// Modèle de navigation / synchronisation validé sur Clients.
const LIVREURS_NAV_CACHE_KEY = "visibl:livreurs:nav-cache:v2";
const LIVREURS_NAV_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const LIVREURS_SYNC_INTERVAL_MS = 10000;
const LIVREURS_SYNC_COOLDOWN_MS = 5000; // Point 9 : anti-appels rapprochés
let derniereVerificationSyncLivreursAt = 0;
let signatureSyncLivreurs = null;
let intervalleSyncLivreurs = null;
let synchronisationAutoLivreursInitialisee = false;
let verificationSyncLivreursEnCours = null;
let generationChargementLivreurs = 0;
let totalLivreursFiltresServeur = 0;
let totalPagesLivreursServeur = 1;
let kpisLivreursServeur = null;
let zonesLivreursServeur = [];
let idsPrechargementLivreursServeur = [];
let timerFiltresLivreursServeur = null;
const cachePagesLivreursServeur = new Map();
const chargementsPagesLivreursServeur = new Map();

function sauvegarderCacheNavigationLivreurs() {
    try {
        sessionStorage.setItem(LIVREURS_NAV_CACHE_KEY, JSON.stringify({
            livreurs: Array.isArray(livreursCharges) ? livreursCharges : [],
            tousLivreurs: Array.isArray(tousLivreursLocaux) ? tousLivreursLocaux : [],
            signature: signatureSyncLivreurs,
            page: pageLivreursActuelle,
            taille: 10,
            total: totalLivreursFiltresServeur,
            totalPages: totalPagesLivreursServeur,
            kpis: kpisLivreursServeur,
            zones: zonesLivreursServeur,
            idsPrechargement: idsPrechargementLivreursServeur,
            savedAt: Date.now()
        }));
    } catch (error) {
        console.warn("Cache navigation Livreurs indisponible :", error);
    }
}

function cacheNavigationLivreursEstAncien() {
    try {
        const brut = sessionStorage.getItem(LIVREURS_NAV_CACHE_KEY);
        if (!brut) return true;

        const cache = JSON.parse(brut);
        const savedAt = Number(cache?.savedAt);

        if (!Number.isFinite(savedAt) || savedAt <= 0) return true;

        return (Date.now() - savedAt) >= LIVREURS_NAV_CACHE_MAX_AGE_MS;
    } catch (error) {
        console.warn("Âge du cache Livreurs impossible à déterminer :", error);
        return true;
    }
}

function restaurerCacheNavigationLivreurs() {
    try {
        const brut = sessionStorage.getItem(LIVREURS_NAV_CACHE_KEY);
        if (!brut) return false;
        const cache = JSON.parse(brut);
        if (!Array.isArray(cache?.livreurs)) return false;
        livreursCharges = cache.livreurs;
        tousLivreursLocaux = Array.isArray(cache.tousLivreurs) && cache.tousLivreurs.length ? cache.tousLivreurs : cache.livreurs.slice();
        livreursFiltres = cache.livreurs.slice();
        signatureSyncLivreurs = cache.signature != null ? String(cache.signature) : null;
        pageLivreursActuelle = Number(cache.page) > 0 ? Number(cache.page) : 1;
        taillePageLivreurs = 10;
        totalLivreursFiltresServeur=Number(cache.total)>=0?Number(cache.total):livreursCharges.length;
        totalPagesLivreursServeur=Number(cache.totalPages)>0?Number(cache.totalPages):1;
        kpisLivreursServeur=cache.kpis&&typeof cache.kpis==="object"?cache.kpis:null;
        zonesLivreursServeur=Array.isArray(cache.zones)?cache.zones:[];
        idsPrechargementLivreursServeur=Array.isArray(cache.idsPrechargement)?cache.idsPrechargement:[];
        actualiserFiltreZonesLivreurs();
        mettreAJourKPILivreurs();
        livreursFiltres=livreursCharges.slice();
        afficherTableauLivreurs();
        lancerPrechargementDetailsLivreurs();
        definirEtatChargementKPILivreurs(false);
        return true;
    } catch (error) {
        console.warn("Restauration cache Livreurs impossible :", error);
        return false;
    }
}

async function obtenirSignatureSyncLivreurs() {
    try {
        const resultat = await apiGet("getEtatSyncLivreurs", { _ts: Date.now() });
        if (!resultat || resultat.success !== true || resultat.signature == null) return null;
        return String(resultat.signature);
    } catch (error) {
        console.warn("Vérification légère Livreurs indisponible :", error);
        return null;
    }
}

async function verifierSynchronisationLivreurs() {
    // Point 9 — évite les appels déclenchés presque simultanément
    // par focus + visibilitychange + intervalle, sans modifier la synchro 10 s.
    const maintenantSyncLivreurs = Date.now();
    if (
        derniereVerificationSyncLivreursAt > 0 &&
        (maintenantSyncLivreurs - derniereVerificationSyncLivreursAt) < LIVREURS_SYNC_COOLDOWN_MS
    ) {
        return false;
    }
    derniereVerificationSyncLivreursAt = maintenantSyncLivreurs;

    if (verificationSyncLivreursEnCours) return verificationSyncLivreursEnCours;
    verificationSyncLivreursEnCours = (async function () {
        const serveur = await obtenirSignatureSyncLivreurs();
        if (serveur == null) return false;
        if (signatureSyncLivreurs != null && String(signatureSyncLivreurs) === serveur) return false;
        await chargerLivreurs({ forcer:true, silencieux:true, verifierSync:false });
        return true;
    })().finally(function(){ verificationSyncLivreursEnCours = null; });
    return verificationSyncLivreursEnCours;
}

function initialiserSynchronisationAutomatiqueLivreurs() {
    if (synchronisationAutoLivreursInitialisee) return;
    synchronisationAutoLivreursInitialisee = true;
    intervalleSyncLivreurs = window.setInterval(function(){
        if (document.visibilityState !== "hidden") verifierSynchronisationLivreurs();
    }, LIVREURS_SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", function(){
        if (document.visibilityState === "visible") verifierSynchronisationLivreurs();
    });
    window.addEventListener("focus", verifierSynchronisationLivreurs);
    window.addEventListener("pagehide", function(){
        if (intervalleSyncLivreurs) window.clearInterval(intervalleSyncLivreurs);
        intervalleSyncLivreurs = null;
    }, { once:true });
}

function preparerLoaderLivreurs() {
    const zone = document.querySelector(".content");
    if (zone) {
        zone.setAttribute("data-visibl-page", "");
        zone.classList.add("visibl-loading-scope");
        zone.querySelector(".welcome-section")?.setAttribute("data-loading-anchor", "");
    }
    ["total-drivers-value","active-drivers-value","total-deliveries-value","total-collected-value"].forEach(function(id){
        document.getElementById(id)?.setAttribute("data-kpi-value", "");
    });
    document.getElementById("drivers-table-body")?.setAttribute("data-loading-table-body", "");
}

function demarrerLoaderLivreurs(message = "Chargement des livreurs…") {
    preparerLoaderLivreurs();

    const texteLoader = message || "Chargement des livreurs…";

    if (window.VisiblLoading?.start) {
        window.VisiblLoading.start({
            scope: ".content",
            tableBody: "#drivers-table-body",
            rows: 10,
            message: texteLoader
        });
    }

    // Sécurité locale Livreurs : même si le composant global a déjà été
    // initialisé avec son texte par défaut, on force le libellé de ce module.
}
function terminerLoaderLivreurs() {
    if (window.VisiblLoading?.stop) window.VisiblLoading.stop({ scope:".content", tableBody:"#drivers-table-body" });
}
function definirEtatChargementKPILivreurs(actif) {
    ["total-drivers-value","active-drivers-value","total-deliveries-value","total-collected-value"].forEach(function(id){
        const el=document.getElementById(id); el?.classList.toggle("is-loading", Boolean(actif)); el?.setAttribute("aria-busy", String(Boolean(actif)));
    });
}




/* ===========================================================
   POINT 10 — PERMISSIONS LIVREURS (VERSION SÛRE)
=========================================================== */

function livreursAutorise(action) {
    return typeof hasPermission === "function" &&
           hasPermission("livreurs", action);
}

function appliquerPermissionsUILivreurs() {
    const creer = livreursAutorise("creer");
    const supprimer = livreursAutorise("supprimer");

    ["new-driver-btn", "new-driver-toolbar-btn"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = creer ? "" : "none";
    });

    const selection = document.getElementById("selection-drivers-btn");
    if (selection) selection.style.display = supprimer ? "" : "none";

    const suppressionMultiple =
        document.getElementById("delete-drivers-selection-btn");
    if (suppressionMultiple) {
        suppressionMultiple.style.display =
            supprimer ? "" : "none";
    }
}

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
    appliquerPermissionsUILivreurs();

    window.addEventListener(
        "visibl:permissions-ready",
        appliquerPermissionsUILivreurs
    );

    initialiserModalesLivreurs();
    initialiserFormulaireLivreur();
    initialiserFiltresLivreurs();
    initialiserPaginationLivreurs();
    initialiserActionsLivreurs();
    initialiserSelectionLivreurs();
    initialiserMenuActionsLivreurs();
    initialiserCapaciteTransport();
    preparerLoaderLivreurs();
    Promise.resolve(chargerLivreurs()).finally(function(){
        initialiserSynchronisationAutomatiqueLivreurs();
    });
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
   FEEDBACK CENTRÉ — MODÈLE CLIENTS
=========================================================== */
function titreErreurLivreur(message) {
    const texte=String(message||"").toLowerCase();
    if (texte.includes("connexion impossible") || texte.includes("failed to fetch") || texte.includes("network")) return "Connexion impossible";
    if (texte.includes("téléphone") || texte.includes("telephone")) return texte.includes("déjà") || texte.includes("deja") ? "Numéro déjà utilisé" : "Numéro de téléphone invalide";
    if (texte.includes("email")) return texte.includes("déjà") || texte.includes("deja") ? "Email déjà utilisé" : "Email invalide";
    if (texte.includes("historique") || texte.includes("livraison") || texte.includes("supprim")) return "Suppression impossible";
    if (texte.includes("pièce") || texte.includes("piece")) return "Numéro de pièce déjà utilisé";
    return "Action impossible";
}

function afficherFeedbackLivreur(options={}) {
    return new Promise(function(resolve){
        let overlay=document.getElementById("driver-feedback-overlay");
        if(!overlay){
            overlay=document.createElement("div");
            overlay.id="driver-feedback-overlay";
            overlay.className="driver-feedback-overlay";
            overlay.innerHTML=`<div class="driver-feedback-card" role="alertdialog" aria-modal="true"><div class="driver-feedback-icon"></div><strong class="driver-feedback-title"></strong><span class="driver-feedback-text"></span><div class="driver-feedback-reference" hidden><strong></strong></div><button type="button" class="driver-feedback-btn"></button></div>`;
            document.body.appendChild(overlay);
        }
        const succes=options.type==="success";
        overlay.classList.remove("is-success","is-error");
        overlay.classList.add(succes?"is-success":"is-error");
        overlay.querySelector(".driver-feedback-icon").textContent=succes?"✓":"!";
        overlay.querySelector(".driver-feedback-title").textContent=options.titre || (succes?"Opération réussie !":titreErreurLivreur(options.message));
        overlay.querySelector(".driver-feedback-text").textContent=options.message || "Une erreur est survenue.";
        const ref=overlay.querySelector(".driver-feedback-reference");
        if(options.reference){ ref.hidden=false; ref.querySelector("strong").textContent=options.reference; } else ref.hidden=true;
        const bouton=overlay.querySelector(".driver-feedback-btn");
        bouton.textContent=succes?"✓ Parfait !":"Compris";
        overlay.classList.add("is-visible"); overlay.setAttribute("aria-hidden","false");
        const fermer=function(){ overlay.classList.remove("is-visible"); overlay.setAttribute("aria-hidden","true"); resolve(); };
        bouton.addEventListener("click",fermer,{once:true}); setTimeout(()=>bouton.focus(),80);
    });
}

function obtenirLoaderSauvegardeLivreur() {
    const form=document.getElementById("driver-form"); if(!form)return null;
    let overlay=form.querySelector(".driver-save-overlay"); if(overlay)return overlay;
    overlay=document.createElement("div"); overlay.className="driver-save-overlay"; overlay.setAttribute("aria-hidden","true");
    overlay.innerHTML=`<div class="driver-save-card" role="status" aria-live="polite"><span class="driver-save-spinner" aria-hidden="true"></span><div><strong class="driver-save-title">Enregistrement du livreur…</strong><div>Quelques secondes, s’il vous plaît.</div></div></div>`;
    form.appendChild(overlay); return overlay;
}
function demarrerLoaderSauvegardeLivreur(modification){ const o=obtenirLoaderSauvegardeLivreur(); if(!o)return; const t=o.querySelector(".driver-save-title"); if(t)t.textContent=modification?"Modification du livreur…":"Enregistrement du livreur…"; o.classList.add("is-visible"); o.setAttribute("aria-hidden","false"); }
function terminerLoaderSauvegardeLivreur(){ const o=document.querySelector("#driver-form .driver-save-overlay"); if(!o)return; o.classList.remove("is-visible"); o.setAttribute("aria-hidden","true"); }

function messageErreurLivreur(error) {
    const brut=String(error?.message||error||"").trim(); const n=brut.toLowerCase();
    if(navigator.onLine===false || n.includes("failed to fetch") || n.includes("networkerror") || n.includes("network error") || n.includes("load failed")) return "Connexion impossible. Vérifiez votre connexion Internet puis réessayez.";
    return brut || "Impossible d'effectuer l'action. Veuillez réessayer.";
}

function formaterTelephoneLivreurAffichage(valeur) {
    let numero=String(valeur??"").trim(); if(!numero)return "";
    let chiffres=numero.replace(/\D/g,"");
    if(chiffres.length===13 && chiffres.startsWith("225")) chiffres=chiffres.slice(3);
    if(chiffres.length===9) chiffres="0"+chiffres;
    if(chiffres.length===10) return chiffres.replace(/(\d{2})(?=\d)/g,"$1 ").trim();
    return numero;
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
    if (!livreursAutorise("creer")) return;
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


async function enregistrerLivreur(event) {
    event.preventDefault();

    if (
        livreurEnModificationId
            ? !livreursAutorise("modifier")
            : !livreursAutorise("creer")
    ) {
        return;
    }

    const formulaire=document.getElementById("driver-form");
    const bouton=document.getElementById("save-driver-btn");
    if(!formulaire || formulaire.dataset.processing==="true") return;
    if(!formulaire.checkValidity()){ formulaire.reportValidity(); return; }
    const zones=obtenirZonesSelectionneesLivreur();
    if(!zones.length){ await afficherFeedbackLivreur({type:"error",message:"Sélectionnez au moins une zone de livraison."}); return; }
    if(navigator.onLine===false){ await afficherFeedbackLivreur({type:"error",message:"Connexion impossible. Vérifiez votre connexion Internet puis réessayez."}); return; }
    const estModification=Boolean(livreurEnModificationId);
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
    const action=estModification?"updateLivreur":"createLivreur";
    formulaire.dataset.processing="true";
    try {
        demarrerLoaderSauvegardeLivreur(estModification);
        if(bouton){ bouton.disabled=true; bouton.classList.add("is-processing"); bouton.dataset.originalText=bouton.textContent.trim(); bouton.textContent=estModification?"Modification...":"Enregistrement..."; }
        const resultat=await apiPost(action,donnees);
        if(!resultat?.success) throw new Error(resultat?.message || (estModification?"Impossible de modifier le livreur.":"Impossible d'enregistrer le livreur."));
        if(resultat.signature!=null) signatureSyncLivreurs=String(resultat.signature);
        const livreurSauvegarde=resultat.data || {...donnees,idLivreur:donnees.idLivreur||resultat.idLivreur||"",nombreLivraisons:0,montantTotalEncaisse:0,ecartTotal:0,dateAjout:new Date().toISOString().slice(0,10),derniereLivraison:""};
        mettreAJourLivreurLocal(livreurSauvegarde,estModification);
        cachePagesLivreursServeur.clear();
        await chargerLivreurs({forcer:true,silencieux:true,verifierSync:false});
        sauvegarderCacheNavigationLivreurs();
        terminerLoaderSauvegardeLivreur();
        const nom=[livreurSauvegarde.nom,livreurSauvegarde.prenom].filter(Boolean).join(" ").trim();
        await afficherFeedbackLivreur({type:"success",titre:estModification?"Livreur modifié !":"Livreur enregistré !",message:estModification?"Les modifications ont été enregistrées avec succès.":"Le livreur a été enregistré avec succès.",reference:nom});
        formulaire.reset(); livreurEnModificationId=null; fermerModaleLivreur();
    } catch(error) {
        console.error("Erreur enregistrement livreur :",error);
        terminerLoaderSauvegardeLivreur();
        await afficherFeedbackLivreur({type:"error",message:messageErreurLivreur(error)});
    } finally {
        terminerLoaderSauvegardeLivreur(); formulaire.dataset.processing="false";
        if(bouton){ bouton.disabled=false; bouton.classList.remove("is-processing"); bouton.textContent=livreurEnModificationId?"Enregistrer les modifications":"Enregistrer le livreur"; }
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


function clePageLivreursServeur(page) {
    return JSON.stringify({
        page:Number(page)||1,
        recherche:obtenirValeurLivreur("drivers-search-input")||"",
        statut:obtenirValeurLivreur("driver-status-filter")||"",
        typeLivreur:obtenirValeurLivreur("driver-type-filter")||"",
        zone:obtenirValeurLivreur("driver-zone-filter")||""
    });
}

function paramsPageLivreursServeur(page) {
    return {
        page:Number(page)||1,
        limite:10,
        recherche:obtenirValeurLivreur("drivers-search-input")||"",
        statut:obtenirValeurLivreur("driver-status-filter")||"",
        typeLivreur:obtenirValeurLivreur("driver-type-filter")||"",
        zone:obtenirValeurLivreur("driver-zone-filter")||"",
        _ts:Date.now()
    };
}

async function obtenirPageLivreursServeur(page,{forcer=false}={}) {
    const cle=clePageLivreursServeur(page);
    if(!forcer && cachePagesLivreursServeur.has(cle)){
        return cachePagesLivreursServeur.get(cle);
    }
    if(!forcer && chargementsPagesLivreursServeur.has(cle)){
        return chargementsPagesLivreursServeur.get(cle);
    }
    const promesse=apiGet("getLivreursPage",paramsPageLivreursServeur(page))
        .then(function(resultat){
            if(resultat?.success)cachePagesLivreursServeur.set(cle,resultat);
            return resultat;
        })
        .finally(function(){chargementsPagesLivreursServeur.delete(cle);});
    chargementsPagesLivreursServeur.set(cle,promesse);
    return promesse;
}

function appliquerPageLivreursServeur(resultat) {
    if(Array.isArray(resultat.tousLivreurs) && resultat.tousLivreurs.length){
        tousLivreursLocaux=resultat.tousLivreurs.slice();
    }
    livreursCharges=Array.isArray(resultat.data)?resultat.data:[];
    livreursFiltres=livreursCharges.slice();
    pageLivreursActuelle=Number(resultat.page)>0?Number(resultat.page):1;
    totalLivreursFiltresServeur=Number(resultat.total)>=0?Number(resultat.total):livreursCharges.length;
    totalPagesLivreursServeur=Number(resultat.totalPages)>0?Number(resultat.totalPages):1;
    kpisLivreursServeur=resultat.kpis&&typeof resultat.kpis==="object"?resultat.kpis:null;
    zonesLivreursServeur=Array.isArray(resultat.zones)?resultat.zones:[];
    idsPrechargementLivreursServeur=Array.isArray(resultat.idsPrechargement)?resultat.idsPrechargement:[];
    if(resultat.signature!=null)signatureSyncLivreurs=String(resultat.signature);
    actualiserFiltreZonesLivreurs();
    mettreAJourKPILivreurs();
    afficherTableauLivreurs();
    sauvegarderCacheNavigationLivreurs();
}

function prechargerPagesVoisinesLivreurs() {
    const pages=[];
    if(pageLivreursActuelle<totalPagesLivreursServeur)pages.push(pageLivreursActuelle+1);
    if(pageLivreursActuelle>1)pages.push(pageLivreursActuelle-1);
    pages.forEach(function(page){
        const lancer=()=>obtenirPageLivreursServeur(page).catch(()=>null);
        if("requestIdleCallback" in window)requestIdleCallback(lancer,{timeout:800});
        else setTimeout(lancer,80);
    });
}

async function allerPageLivreurs(page) {
    // Point 35 — dès que la liste complète est en mémoire, la pagination est 100 % locale.
    if(Array.isArray(tousLivreursLocaux) && tousLivreursLocaux.length){
        page=Math.max(1,Math.min(Number(page)||1,totalPagesLivreursServeur));
        pageLivreursActuelle=page;
        appliquerFiltresLivreursLocaux(true);
        return;
    }

    page=Math.max(1,Math.min(Number(page)||1,totalPagesLivreursServeur));
    if(page===pageLivreursActuelle)return;
    const anciennePage=pageLivreursActuelle;
    try{
        const resultat=await obtenirPageLivreursServeur(page);
        if(!resultat?.success)throw new Error(resultat?.message||"Impossible de charger cette page.");
        appliquerPageLivreursServeur(resultat);
    }catch(error){
        pageLivreursActuelle=anciennePage;
        console.error("Erreur pagination Livreurs :",error);
        if(typeof showToast==="function")showToast(messageErreurLivreur(error),"error");
    }
}

async function chargerLivreurs(options={}) {
    const forcer=options?.forcer===true;
    const silencieux=options?.silencieux===true;
    const verifierSync=options?.verifierSync!==false;

    if(!forcer){
        const cacheAncien=cacheNavigationLivreursEstAncien();
        if(restaurerCacheNavigationLivreurs()){
            if(verifierSync){
                if(cacheAncien){
                    chargerLivreurs({forcer:true,silencieux:true,verifierSync:false}).catch(function(error){
                        console.warn("Revalidation cache Livreurs ancien impossible :",error);
                    });
                }else{
                    verifierSynchronisationLivreurs();
                }
            }
            return true;
        }
    }

    if(navigator.onLine===false){
        const message="Connexion impossible. Vérifiez votre connexion Internet puis réessayez.";
        if(!silencieux && typeof showToast==="function")showToast(message,"error");
        return false;
    }

    const generation=++generationChargementLivreurs;
    if(!silencieux){demarrerLoaderLivreurs("Chargement des livreurs…");definirEtatChargementKPILivreurs(true);}

    try{
        const resultat=await Promise.race([
            obtenirPageLivreursServeur(pageLivreursActuelle,{forcer:forcer}),
            new Promise((_,reject)=>window.setTimeout(
                ()=>reject(new Error("Connexion impossible. Le serveur ne répond pas. Vérifiez votre connexion Internet puis réessayez.")),
                8000
            ))
        ]);

        if(generation!==generationChargementLivreurs)return false;
        if(!resultat?.success)throw new Error(resultat?.message||"Impossible de charger les livreurs.");

        appliquerPageLivreursServeur(resultat);
        lancerPrechargementDetailsLivreurs();
        prechargerPagesVoisinesLivreurs();
        return true;
    }catch(error){
        if(generation!==generationChargementLivreurs)return false;
        console.error("Erreur chargement livreurs :",error);
        if(!silencieux&&typeof showToast==="function")showToast(messageErreurLivreur(error),"error");
        return false;
    }finally{
        if(generation===generationChargementLivreurs){
            definirEtatChargementKPILivreurs(false);
            if(!silencieux)terminerLoaderLivreurs();
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
            planifierRechercheLivreurs
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


function synchroniserRechercheLivreurs(event) {
    const champ=document.getElementById("drivers-search-input");
    if(champ) champ.value=event.target.value;
    appliquerFiltresLivreurs();
}

function planifierRechercheLivreurs() {
    // Point 35 — plus de temporisation ni d'appel backend pendant la frappe.
    appliquerFiltresLivreurs();
}

function appliquerFiltresLivreursLocaux(conserverPage=false) {
    const source=Array.isArray(tousLivreursLocaux) && tousLivreursLocaux.length
        ? tousLivreursLocaux
        : livreursCharges;

    const recherche=normaliserTexteLivreurFrontend(obtenirValeurLivreur("drivers-search-input")||"");
    const statut=normaliserTexteLivreurFrontend(obtenirValeurLivreur("driver-status-filter")||"");
    const typeLivreur=normaliserTexteLivreurFrontend(obtenirValeurLivreur("driver-type-filter")||"");
    const zone=normaliserTexteLivreurFrontend(obtenirValeurLivreur("driver-zone-filter")||"");

    const filtres=source.filter(function(l){
        const texte=[
            l.idLivreur,l.nom,l.prenom,l.telephone,l.telephoneSecondaire,l.email,
            l.adresse,l.zoneLivraison,l.typeLivreur,l.moyenTransport,
            l.immatriculation,l.numeroPiece,l.statut
        ].map(normaliserTexteLivreurFrontend).join(" ");
        const zones=obtenirZonesLivreur(l).map(normaliserTexteLivreurFrontend);
        return (!recherche || texte.includes(recherche)) &&
               (!statut || normaliserTexteLivreurFrontend(l.statut)===statut) &&
               (!typeLivreur || normaliserTexteLivreurFrontend(l.typeLivreur)===typeLivreur) &&
               (!zone || zones.includes(zone) || zones.includes("toutes-les-zones") || zones.includes("toutes-zones") || zones.includes("toute-zone"));
    });

    totalLivreursFiltresServeur=filtres.length;
    totalPagesLivreursServeur=Math.max(1,Math.ceil(filtres.length/taillePageLivreurs));
    if(!conserverPage) pageLivreursActuelle=1;
    pageLivreursActuelle=Math.max(1,Math.min(pageLivreursActuelle,totalPagesLivreursServeur));
    const debut=(pageLivreursActuelle-1)*taillePageLivreurs;
    livreursCharges=filtres.slice(debut,debut+taillePageLivreurs);
    livreursFiltres=livreursCharges.slice();
    afficherTableauLivreurs();
    sauvegarderCacheNavigationLivreurs();
    return true;
}

function appliquerFiltresLivreurs(conserverPage=false) {
    if(timerFiltresLivreursServeur){
        window.clearTimeout(timerFiltresLivreursServeur);
        timerFiltresLivreursServeur=null;
    }
    // Si la liste complète a déjà été reçue au chargement, aucun appel réseau.
    if(Array.isArray(tousLivreursLocaux) && tousLivreursLocaux.length){
        return appliquerFiltresLivreursLocaux(conserverPage);
    }
    if(!conserverPage)pageLivreursActuelle=1;
    cachePagesLivreursServeur.clear();
    return chargerLivreurs({forcer:true,silencieux:true,verifierSync:false});
}


function actualiserFiltreZonesLivreurs() {
    const select=document.getElementById("driver-zone-filter");
    if(!select)return;
    const valeurActuelle=String(select.value||"").trim();
    const zones=(Array.isArray(zonesLivreursServeur)&&zonesLivreursServeur.length)
        ? zonesLivreursServeur.slice()
        : Array.from(new Set((tousLivreursLocaux.length?tousLivreursLocaux:livreursCharges).flatMap(l=>obtenirZonesLivreur(l)).filter(Boolean)));
    select.innerHTML='<option value="">Toutes les zones</option>';
    zones.forEach(function(zone){
        const option=document.createElement("option");
        option.value=zone;option.textContent=zone;select.appendChild(option);
    });
    if(valeurActuelle && zones.some(z=>normaliserTexteLivreurFrontend(z)===normaliserTexteLivreurFrontend(valeurActuelle))){
        select.value=valeurActuelle;
    }else if(!valeurActuelle){
        select.value="";
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

    const total = totalLivreursFiltresServeur;
    const totalPages = Math.max(1,totalPagesLivreursServeur);
    pageLivreursActuelle=Math.min(pageLivreursActuelle,totalPages);
    const debut=(pageLivreursActuelle-1)*taillePageLivreurs;
    const fin=Math.min(debut+livreursFiltres.length,total);
    const page=livreursFiltres.slice();

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
        <td>${echapperHTMLLivreur(formaterTelephoneLivreurAffichage(livreur.telephone)||"—")}</td>
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
              ${livreursAutorise("modifier") ? `<button type="button" data-edit-driver="${echapperAttributLivreur(id)}">✏️ <span>Modifier</span></button>` : ""}
              ${livreursAutorise("supprimer") ? `<button type="button" class="danger" data-delete-driver="${echapperAttributLivreur(id)}">🗑️ <span>Supprimer</span></button>` : ""}
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

    const boutonActualiserLivreurs =
        document.getElementById(
            "refresh-drivers-btn"
        );

    boutonActualiserLivreurs
        ?.addEventListener(
            "click",
            async function () {

                if (boutonActualiserLivreurs.disabled) {
                    return;
                }

                if (navigator.onLine === false) {
                    await afficherFeedbackLivreur({
                        type: "error",
                        titre: "Connexion impossible",
                        message:
                            "Vérifiez votre connexion Internet puis réessayez."
                    });
                    return;
                }

                boutonActualiserLivreurs.disabled = true;
                boutonActualiserLivreurs.classList.add("is-loading");

                /*
                 * Correctif Actualiser : on capture l'état réellement visible
                 * des filtres AVANT le chargement. Certains navigateurs peuvent
                 * restaurer une valeur fantôme pendant le loader/rendu.
                 */
                const filtresAvantActualisation = {
                    recherche: obtenirValeurLivreur("drivers-search-input"),
                    rechercheEntete: obtenirValeurLivreur("header-drivers-search-input"),
                    statut: obtenirValeurLivreur("driver-status-filter"),
                    type: obtenirValeurLivreur("driver-type-filter"),
                    zone: obtenirValeurLivreur("driver-zone-filter")
                };

                try {
                    /*
                     * Même logique que Clients :
                     * on ignore le cache local et on force un chargement
                     * frais depuis le serveur avec le loader visible.
                     */
                    const actualisationReussie =
                        await chargerLivreurs({
                            forcer: true,
                            silencieux: false,
                            verifierSync: false
                        });

                    if (!actualisationReussie) {
                        throw new Error(
                            "Impossible d’actualiser la liste des livreurs."
                        );
                    }

                    // Restaure exactement les filtres présents avant le clic,
                    // puis recalcule le tableau avec les données fraîches.
                    definirValeurLivreur(
                        "drivers-search-input",
                        filtresAvantActualisation.recherche
                    );
                    definirValeurLivreur(
                        "header-drivers-search-input",
                        filtresAvantActualisation.rechercheEntete
                    );
                    definirValeurLivreur(
                        "driver-status-filter",
                        filtresAvantActualisation.statut
                    );
                    definirValeurLivreur(
                        "driver-type-filter",
                        filtresAvantActualisation.type
                    );
                    definirValeurLivreur(
                        "driver-zone-filter",
                        filtresAvantActualisation.zone
                    );
                    appliquerFiltresLivreurs(true);
                    sauvegarderCacheNavigationLivreurs();

                    if (typeof showToast === "function") {
                        showToast(
                            "Liste des livreurs actualisée.",
                            "success"
                        );
                    }

                } catch (error) {

                    console.error(
                        "Erreur actualisation livreurs :",
                        error
                    );

                    if (typeof showToast === "function") {
                        showToast(
                            "Impossible d’actualiser la liste des livreurs.",
                            "error"
                        );
                    }

                } finally {

                    boutonActualiserLivreurs.disabled = false;
                    boutonActualiserLivreurs.classList.remove("is-loading");
                }
            }
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

    document
        .getElementById("export-drivers-pdf-btn")
        ?.addEventListener("click", telechargerListeLivreursPDF);
}



function fermerMenusLigneLivreur(){
 document.querySelectorAll("[data-driver-actions-menu],[data-driver-zones-menu]").forEach(m=>m.hidden=true);
 document.querySelectorAll("[data-driver-actions-toggle],[data-driver-zones-toggle]").forEach(b=>b.setAttribute("aria-expanded","false"));
}
function basculerMenuLivreur(bouton, type) {
    const id = String(
        type === "zones"
            ? bouton.dataset.driverZonesToggle
            : bouton.dataset.driverActionsToggle || ""
    );

    const attr =
        type === "zones"
            ? "data-driver-zones-menu"
            : "data-driver-actions-menu";

    const menu = document.querySelector(
        `[${attr}="${CSS.escape(id)}"]`
    );

    if (!menu) return;

    const ouvrir = menu.hidden;
    fermerMenusLigneLivreur();

    if (!ouvrir) {
        bouton.setAttribute("aria-expanded", "false");
        return;
    }

    menu.hidden = false;
    bouton.setAttribute("aria-expanded", "true");

    // Actions d'une ligne : positionnement directement dans le viewport
    // sur TOUS les écrans. Ainsi la dernière ligne reste toujours visible,
    // aussi bien sur PC que sur mobile.
    if (type === "actions") {
        const marge = 12;
        const espace = 8;
        const largeur = Math.min(280, window.innerWidth - marge * 2);
        const rectBouton = bouton.getBoundingClientRect();

        menu.classList.add("driver-row-menu-dropdown-viewport");
        menu.style.width = largeur + "px";
        menu.style.left =
            Math.max(
                marge,
                Math.min(
                    window.innerWidth - largeur - marge,
                    rectBouton.right - largeur
                )
            ) + "px";
        menu.style.right = "auto";
        menu.style.bottom = "auto";

        // Il faut mesurer après l'avoir rendu.
        const hauteur = Math.min(menu.scrollHeight, Math.floor(window.innerHeight * 0.7));
        const placeDessous = window.innerHeight - rectBouton.bottom - marge;
        const placeDessus = rectBouton.top - marge;

        if (placeDessous >= hauteur + espace || placeDessous >= placeDessus) {
            menu.style.top =
                Math.min(
                    window.innerHeight - hauteur - marge,
                    rectBouton.bottom + espace
                ) + "px";
        } else {
            menu.style.top =
                Math.max(
                    marge,
                    rectBouton.top - hauteur - espace
                ) + "px";
        }

        menu.style.maxHeight = Math.min(hauteur, window.innerHeight - marge * 2) + "px";
    }
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
   if (!livreursAutorise("supprimer")) return;

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
 const boutonSuppressionMultiple =
   document.getElementById("delete-drivers-selection-btn");

 boutonSuppressionMultiple?.addEventListener("click", async () => {
   if (!livreursAutorise("supprimer")) return;
   if (boutonSuppressionMultiple.disabled) return;

   if (!livreursSelectionnes.size) {
     afficherToastLivreur?.("Aucun livreur sélectionné.", "info");
     return;
   }

   const totalSelection = livreursSelectionnes.size;

   if (!confirm(`Supprimer ${totalSelection} livreur(s) sélectionné(s) ?`)) {
     return;
   }

   if (navigator.onLine === false) {
     await afficherFeedbackLivreur({
       type: "error",
       message:
         "Connexion impossible. Vérifiez votre connexion Internet puis réessayez."
     });
     return;
   }

   const ids = Array.from(livreursSelectionnes);
   const contenuOriginal = boutonSuppressionMultiple.innerHTML;

   boutonSuppressionMultiple.disabled = true;
   boutonSuppressionMultiple.classList.add("is-loading");
   boutonSuppressionMultiple.setAttribute("aria-busy", "true");
   boutonSuppressionMultiple.innerHTML =
     `<i class="fa-solid fa-spinner fa-spin"></i><span>Suppression...</span>`;

   try {
     // POINT 25 — une seule requête pour toute la sélection.
     const resultat = await apiPost(
       "deleteLivreursBulk",
       { idsLivreurs: ids }
     );

     if (!resultat?.success) {
       throw new Error(
         resultat?.message ||
         "Impossible de supprimer les livreurs sélectionnés."
       );
     }

     if (resultat.signature != null) {
       signatureSyncLivreurs = String(resultat.signature);
     }

     const idsSupprimes =
       Array.isArray(resultat.idsSupprimes)
         ? resultat.idsSupprimes.map(String)
         : [];

     const bloques =
       Array.isArray(resultat.bloques) ? resultat.bloques : [];

     const introuvables =
       Array.isArray(resultat.introuvables) ? resultat.introuvables : [];

     cachePagesLivreursServeur.clear();
     livreursSelectionnes.clear();
     definirModeSelectionLivreurs(false);

     const rechargeOk = await chargerLivreurs({
       forcer: true,
       silencieux: false,
       verifierSync: false
     });

     if (!rechargeOk) {
       throw new Error(
         "La suppression a été traitée, mais la liste n'a pas pu être actualisée."
       );
     }

     sauvegarderCacheNavigationLivreurs();

     const nbSupprimes =
       Number(resultat.totalSupprimes) || idsSupprimes.length;
     const nbBloques =
       Number(resultat.totalBloques) || bloques.length;
     const nbIntrouvables =
       Number(resultat.totalIntrouvables) || introuvables.length;
     const nbRefuses = nbBloques + nbIntrouvables;

     if (nbSupprimes > 0 && nbRefuses === 0) {
       await afficherFeedbackLivreur({
         type: "success",
         titre: "Suppression terminée !",
         message:
           `${nbSupprimes} livreur(s) ont été supprimé(s) avec succès.`
       });
       return;
     }

     const details = [];

     bloques.forEach(function(item) {
       details.push(
         `${item.idLivreur || "Livreur"} : ${item.message || "Suppression impossible."}`
       );
     });

     introuvables.forEach(function(item) {
       details.push(
         `${item.idLivreur || "Livreur"} : ${item.message || "Introuvable."}`
       );
     });

     if (nbSupprimes > 0) {
       await afficherFeedbackLivreur({
         type: "success",
         titre: "Suppression partielle",
         message:
           `${nbSupprimes} livreur(s) supprimé(s). ${nbRefuses} non supprimé(s).` +
           (details.length ? ` ${details.join(" ")}` : "")
       });
       return;
     }

     await afficherFeedbackLivreur({
       type: "error",
       titre: "Suppression impossible",
       message:
         details.join(" ") ||
         "Aucun des livreurs sélectionnés n'a pu être supprimé."
     });

   } catch (error) {
     console.error("Erreur suppression multiple livreurs :", error);

     await afficherFeedbackLivreur({
       type: "error",
       message: messageErreurLivreur(error)
     });

   } finally {
     boutonSuppressionMultiple.disabled = false;
     boutonSuppressionMultiple.classList.remove("is-loading");
     boutonSuppressionMultiple.removeAttribute("aria-busy");
     boutonSuppressionMultiple.innerHTML = contenuOriginal;
   }
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


function rendreFicheLivreurPoint14(livreur) {
 const contenu=document.getElementById("driver-details-content");if(!contenu)return;
 const nom=obtenirNomCompletLivreur(livreur),zones=obtenirZonesLivreur(livreur),initiales=obtenirInitialesLivreur(livreur),statutClasse=obtenirClasseStatutLivreur(livreur.statut);
 contenu.innerHTML=`
 <section class="driver-profile-hero">
   <div class="driver-profile-avatar">${echapperHTMLLivreur(initiales)}</div>
   <div class="driver-profile-main"><h3>${echapperHTMLLivreur(nom||"Livreur")}</h3><p>${echapperHTMLLivreur(formaterTelephoneLivreurAffichage(livreur.telephone)||"—")}</p><span class="status-badge ${statutClasse}">${echapperHTMLLivreur(livreur.statut||"—")}</span></div>
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
     <dl><div><dt>Téléphone</dt><dd>${echapperHTMLLivreur(formaterTelephoneLivreurAffichage(livreur.telephone)||"—")}</dd></div><div><dt>Téléphone secondaire</dt><dd>${echapperHTMLLivreur(formaterTelephoneLivreurAffichage(livreur.telephoneSecondaire)||"—")}</dd></div><div><dt>Email</dt><dd>${echapperHTMLLivreur(livreur.email||"—")}</dd></div><div><dt>Adresse</dt><dd>${echapperHTMLLivreur(livreur.adresse||"—")}</dd></div></dl>
   </article>
   <article class="driver-info-panel"><h4>🛵 Informations professionnelles</h4>
     <dl><div><dt>Type</dt><dd>${echapperHTMLLivreur(livreur.typeLivreur||"—")}</dd></div><div><dt>Transport</dt><dd>${echapperHTMLLivreur(livreur.moyenTransport||"—")}</dd></div><div><dt>Immatriculation</dt><dd>${echapperHTMLLivreur(livreur.immatriculation||"—")}</dd></div><div><dt>Pièce</dt><dd>${echapperHTMLLivreur([livreur.typePiece,livreur.numeroPiece].filter(Boolean).join(" · ")||"—")}</dd></div></dl>
   </article>
   <article class="driver-info-panel driver-info-panel-full"><h4>📍 Zones couvertes</h4><div class="driver-profile-zones">${zones.length?zones.map(z=>`<span>${echapperHTMLLivreur(z)}</span>`).join(""):"—"}</div></article>
 </section>`;
 ouvrirModaleVoirLivreur();
}

async function voirLivreur(idLivreur) {
 const livreurLocal=trouverLivreurParId(idLivreur);if(!livreurLocal)return;

 // Si la fiche a déjà été préchargée, tout est affiché immédiatement.
 const detailsEnCache=cacheDetailsLivreurs.get(String(idLivreur));
 if(detailsEnCache){
   rendreFicheLivreurPoint14({...livreurLocal,...detailsEnCache});
   return;
 }

 // Sinon la fiche s'ouvre quand même immédiatement, sans attendre le réseau.
 rendreFicheLivreurPoint14(livreurLocal);

 try {
   const resultat=await apiGet("getDetailsLivreur",{idLivreur:idLivreur,_ts:Date.now()});
   if(!resultat?.success) throw new Error(resultat?.message||"Impossible de charger la fiche du livreur.");
   const details=resultat.data||{};
   cacheDetailsLivreurs.set(String(idLivreur),details);

   const modal=document.getElementById("view-driver-modal");
   if(!modal?.classList.contains("active"))return;
   rendreFicheLivreurPoint14({...livreurLocal,...details});
 } catch(error) {
   console.error("Erreur chargement détails livreur :",error);
   if(typeof showToast==="function")showToast(messageErreurLivreur(error),"error");
 }
}

function lancerPrechargementDetailsLivreurs() {
 const generation=++generationPrechargementDetailsLivreurs;
 const ids=(Array.isArray(idsPrechargementLivreursServeur)&&idsPrechargementLivreursServeur.length
   ? idsPrechargementLivreursServeur
   : livreursCharges.map(l=>l?.idLivreur))
   .map(id=>String(id||"").trim())
   .filter(Boolean);

 if(!ids.length)return;

 // Laisse d'abord le navigateur terminer l'affichage KPI + tableau.
 const demarrer=()=>prechargerLotDetailsLivreurs(ids,0,generation);

 if("requestIdleCallback" in window){
   requestIdleCallback(demarrer,{timeout:1500});
 }else{
   setTimeout(demarrer,250);
 }
}

async function prechargerLotDetailsLivreurs(ids,index,generation) {
 if(generation!==generationPrechargementDetailsLivreurs)return;
 if(index>=ids.length)return;

 const lot=ids.slice(index,index+10);
 const aCharger=lot.filter(id=>!cacheDetailsLivreurs.has(id));

 if(aCharger.length){
   // Un lot de 10 maximum à la fois. Un échec individuel ne bloque pas les autres.
   await Promise.allSettled(
     aCharger.map(async id=>{
       const resultat=await apiGet("getDetailsLivreur",{idLivreur:id,_ts:Date.now()});
       if(resultat?.success && resultat.data){
         cacheDetailsLivreurs.set(id,resultat.data);
       }
     })
   );
 }

 if(generation!==generationPrechargementDetailsLivreurs)return;

 // Puis lot suivant : 11–20, 21–30, etc., sans bloquer l'interface.
 if("requestIdleCallback" in window){
   requestIdleCallback(
     ()=>prechargerLotDetailsLivreurs(ids,index+10,generation),
     {timeout:1500}
   );
 }else{
   setTimeout(()=>prechargerLotDetailsLivreurs(ids,index+10,generation),100);
 }
}

function modifierLivreur(
    idLivreur
) {
    if (!livreursAutorise("modifier")) return;

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
    if (!livreursAutorise("supprimer")) return;

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
    if (!livreursAutorise("supprimer")) return;
    if(!livreurASupprimer) return;
    const bouton=document.getElementById("confirm-delete-driver-btn");
    if(bouton?.disabled) return;
    const cible={...livreurASupprimer};
    try {
        if(bouton){ bouton.disabled=true; bouton.classList.add("is-loading"); bouton.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i><span>Suppression...</span>'; }
        if(navigator.onLine===false) throw new Error("Connexion impossible. Vérifiez votre connexion Internet puis réessayez.");
        const resultat=await apiPost("deleteLivreur",{idLivreur:cible.idLivreur});
        if(!resultat?.success) throw new Error(resultat?.message||"Impossible de supprimer le livreur.");
        if(resultat.signature!=null) signatureSyncLivreurs=String(resultat.signature);
        retirerLivreurLocal(cible.idLivreur); sauvegarderCacheNavigationLivreurs(); fermerModaleSuppressionLivreur();
        await afficherFeedbackLivreur({type:"success",titre:"Livreur supprimé !",message:"Le livreur a été supprimé avec succès.",reference:[cible.nom,cible.prenom].filter(Boolean).join(" ").trim()});
    } catch(error) {
        console.error("Erreur suppression livreur :",error);
        await afficherFeedbackLivreur({type:"error",message:messageErreurLivreur(error)});
    } finally {
        if(bouton){ bouton.disabled=false; bouton.classList.remove("is-loading"); bouton.innerHTML='<i class="fa-solid fa-trash"></i><span>Supprimer</span>'; }
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
    sauvegarderCacheNavigationLivreurs();
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
    sauvegarderCacheNavigationLivreurs();
}


/* ===========================================================
   KPI
=========================================================== */

function mettreAJourKPILivreurs() {
    const total=kpisLivreursServeur?Number(kpisLivreursServeur.total||0):livreursCharges.length;
    const actifs=kpisLivreursServeur?Number(kpisLivreursServeur.actifs||0):livreursCharges.filter(l=>normaliserTexteLivreurFrontend(l.statut)==="actif").length;
    const livraisons=kpisLivreursServeur?Number(kpisLivreursServeur.livraisons||0):livreursCharges.reduce((s,l)=>s+convertirNombreLivreurFrontend(l.nombreLivraisons),0);
    const montant=kpisLivreursServeur?Number(kpisLivreursServeur.montant||0):livreursCharges.reduce((s,l)=>s+convertirNombreLivreurFrontend(l.montantTotalEncaisse),0);
    const taux=total?Math.round((actifs/total)*100):0;
    if(window.VisiblKPI?.update){
        window.VisiblKPI.update("drivers-total",{value:total,subtitle:"Livreurs enregistrés",theme:"blue"});
        window.VisiblKPI.update("drivers-active",{value:actifs,subtitle:`${taux} % des livreurs`,ring:taux,theme:"green"});
        window.VisiblKPI.update("drivers-deliveries",{value:livraisons,subtitle:"Total cumulé des livraisons réussies",theme:"purple"});
        window.VisiblKPI.update("drivers-collected",{value:montant,unit:"FCFA",subtitle:"Total encaissé par les livreurs",theme:"orange"});
        return;
    }
    definirTexteLivreur("total-drivers-value",formaterNombreLivreur(total));
    definirTexteLivreur("active-drivers-value",formaterNombreLivreur(actifs));
    definirTexteLivreur("active-drivers-description",`${taux} % des livreurs`);
    definirTexteLivreur("total-deliveries-value",formaterNombreLivreur(livraisons));
    definirTexteLivreur("total-collected-value",formaterMontantLivreur(montant));
}

/* ===========================================================
   PAGINATION
=========================================================== */

function initialiserPaginationLivreurs() {
    // Pagination fixe : toujours 10 livreurs par page.
    taillePageLivreurs = 10;

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
                    allerPageLivreurs(pageLivreursActuelle-1);
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
                const totalPages = Math.max(1,totalPagesLivreursServeur);

                if (
                    pageLivreursActuelle <
                    totalPages
                ) {
                    allerPageLivreurs(pageLivreursActuelle+1);
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
                    allerPageLivreurs(page);
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

async function telechargerListeLivreursPDF() {
    const bouton=document.getElementById("export-drivers-pdf-btn");
    if(bouton?.disabled)return;

    const totalAttendu=Number(totalLivreursFiltresServeur||0);
    if(totalAttendu<=0){
        if(typeof showToast==="function")showToast("Aucun livreur à télécharger.","error");
        return;
    }

    const texteInitial=bouton?.innerHTML||"";
    if(bouton){
        bouton.disabled=true;
        bouton.setAttribute("aria-busy","true");
        bouton.innerHTML='⏳ <span>Préparation du PDF…</span>';
    }

    try{
        const chargerScript=function(src,id){
            return new Promise(function(resolve,reject){
                if(id && document.getElementById(id)){resolve();return;}
                const s=document.createElement("script");
                if(id)s.id=id;
                s.src=src;
                s.onload=resolve;
                s.onerror=()=>reject(new Error("Impossible de charger le moteur PDF."));
                document.head.appendChild(s);
            });
        };

        if(!window.jspdf?.jsPDF){
            await chargerScript(
                "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
                "visibl-jspdf"
            );
        }
        if(!window.jspdf?.jsPDF)throw new Error("Le moteur PDF n’est pas disponible.");

        const totalPages=Math.max(1,Number(totalPagesLivreursServeur)||1);
        const resultats=await Promise.all(
            Array.from({length:totalPages},(_,i)=>obtenirPageLivreursServeur(i+1))
        );
        const livreurs=[];
        resultats.forEach(function(resultat){
            if(!resultat?.success)throw new Error(resultat?.message||"Impossible de préparer le PDF.");
            if(Array.isArray(resultat.data))livreurs.push(...resultat.data);
        });
        if(!livreurs.length)throw new Error("Aucun livreur à télécharger.");

        const {jsPDF}=window.jspdf;
        const doc=new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
        const marge=10;
        const largeurPage=doc.internal.pageSize.getWidth();
        const hauteurPage=doc.internal.pageSize.getHeight();
        const colonnes=[
            {titre:"ID",x:10,w:22},
            {titre:"Nom et prénom",x:32,w:45},
            {titre:"Téléphone",x:77,w:29},
            {titre:"Zones",x:106,w:45},
            {titre:"Type",x:151,w:28},
            {titre:"Transport",x:179,w:27},
            {titre:"Livr.",x:206,w:17},
            {titre:"Encaissé",x:223,w:35},
            {titre:"Statut",x:258,w:28}
        ];

        function texte(valeur){return String(valeur??"").replace(/\s+/g," ").trim();}
        function tel(valeur){
            let chiffres=texte(valeur).replace(/\D/g,"");
            if(chiffres.startsWith("225")&&chiffres.length===13)chiffres=chiffres.slice(3);
            if(chiffres.length===9)chiffres="0"+chiffres;
            return chiffres.replace(/(\d{2})(?=\d)/g,"$1 ").trim();
        }
        function montant(valeur){
            const n=Number(valeur);
            return Number.isFinite(n)?new Intl.NumberFormat("fr-FR").format(n)+" FCFA":"0 FCFA";
        }
        function couper(valeur,max){
            const s=texte(valeur);
            return s.length>max?s.slice(0,Math.max(0,max-1))+"…":s;
        }

        function entete(pageNo){
            doc.setFont("helvetica","bold");
            doc.setFontSize(16);
            doc.text("Liste des livreurs",marge,12);
            doc.setFont("helvetica","normal");
            doc.setFontSize(8.5);
            doc.text(
                `${livreurs.length} livreur${livreurs.length>1?"s":""} - ${new Date().toLocaleDateString("fr-FR")} - Page ${pageNo}`,
                marge,18
            );
            doc.setFillColor(245,247,250);
            doc.rect(marge,22,largeurPage-marge*2,8,"F");
            doc.setFont("helvetica","bold");
            doc.setFontSize(7.5);
            colonnes.forEach(c=>doc.text(c.titre,c.x+1,27));
            doc.setFont("helvetica","normal");
        }

        let pageNo=1;
        let y=35;
        entete(pageNo);

        livreurs.forEach(function(l,index){
            if(y>hauteurPage-13){
                doc.addPage();
                pageNo++;
                entete(pageNo);
                y=35;
            }
            if(index%2===1){
                doc.setFillColor(250,250,250);
                doc.rect(marge,y-4.5,largeurPage-marge*2,7,"F");
            }
            doc.setFontSize(7.2);
            const valeurs=[
                couper(l.idLivreur,13),
                couper(obtenirNomCompletLivreur(l),28),
                tel(l.telephone),
                couper(obtenirZonesLivreur(l).join(", "),30),
                couper(l.typeLivreur,16),
                couper(l.moyenTransport,15),
                texte(l.nombreLivraisons||0),
                couper(montant(l.montantTotalEncaisse),20),
                couper(l.statut,15)
            ];
            colonnes.forEach((c,i)=>doc.text(valeurs[i]||"",c.x+1,y,{maxWidth:c.w-2}));
            y+=7;
        });

        const nomFichier=`livreurs_${new Date().toISOString().slice(0,10)}.pdf`;
        doc.save(nomFichier);

        if(typeof showToast==="function"){
            showToast(`${livreurs.length} livreur${livreurs.length>1?"s":""} téléchargé${livreurs.length>1?"s":""} en PDF.`,"success");
        }
    }catch(error){
        console.error("Erreur PDF Livreurs :",error);
        if(typeof showToast==="function")showToast(messageErreurLivreur(error),"error");
    }finally{
        if(bouton){
            bouton.disabled=false;
            bouton.removeAttribute("aria-busy");
            bouton.innerHTML=texteInitial;
        }
    }
}

async function exporterLivreursCSV() {
    const bouton=document.getElementById("export-drivers-btn");
    if(bouton?.disabled)return;

    const totalAttendu=Number(totalLivreursFiltresServeur||0);
    if(totalAttendu<=0){
        if(typeof showToast==="function")showToast("Aucun livreur à exporter.","error");
        return;
    }

    const texteInitial=bouton?.textContent||"";
    if(bouton){
        bouton.disabled=true;
        bouton.setAttribute("aria-busy","true");
        bouton.textContent="Export en cours…";
    }

    try{
        /*
         * Point 16 :
         * avec la pagination serveur, livreursFiltres ne contient que la page visible.
         * On récupère donc TOUTES les pages correspondant exactement aux filtres
         * actifs avant de construire le CSV.
         */
        const totalPages=Math.max(1,Number(totalPagesLivreursServeur)||1);
        const resultats=await Promise.all(
            Array.from({length:totalPages},(_,i)=>obtenirPageLivreursServeur(i+1))
        );

        const livreurs=[];
        resultats.forEach(function(resultat){
            if(!resultat?.success)throw new Error(resultat?.message||"Impossible de préparer l’export.");
            if(Array.isArray(resultat.data))livreurs.push(...resultat.data);
        });

        if(!livreurs.length)throw new Error("Aucun livreur à exporter.");

        const entetes=[
            "ID Livreur","Nom","Prénom","Téléphone","Téléphone Secondaire",
            "Email","Adresse","Zone de Livraison","Type de Livreur",
            "Moyen de Transport","Capacité Maximale","Immatriculation",
            "Type de Pièce","Numéro de Pièce","Nombre de Livraisons",
            "Montant Total Encaissé","Écart Total","Date de Début",
            "Date d’Ajout","Dernière Livraison","Statut","Commentaire"
        ];

        function securiserTexteCSV(valeur){
            let texte=String(valeur??"");
            // Neutralise l'injection de formule CSV/Excel pour les champs texte.
            if(/^[\s]*[=+\-@]/.test(texte))texte="'"+texte;
            return texte;
        }

        function telephoneCSV(valeur){
            let brut=String(valeur??"").trim();
            if(!brut)return "";

            // Google Sheets peut avoir déjà converti un téléphone en nombre et
            // supprimé son zéro initial. On restaure le format ivoirien attendu.
            let chiffres=brut.replace(/\D/g,"");
            if(chiffres.startsWith("225") && chiffres.length===13){
                chiffres=chiffres.slice(3);
            }
            if(chiffres.length===9){
                chiffres="0"+chiffres;
            }

            // CSV : on écrit le téléphone comme texte explicite pour qu'Excel
            // ne retire plus le zéro au début.
            return chiffres ? `="${chiffres}"` : "";
        }

        function celluleCSV(valeur,{telephone=false,nombre=false}={}){
            let texte;
            if(telephone){
                texte=telephoneCSV(valeur);
            }else if(nombre){
                const n=Number(valeur);
                texte=Number.isFinite(n)?String(n):"0";
            }else{
                texte=securiserTexteCSV(valeur);
            }
            return `"${String(texte).replaceAll('"','""')}"`;
        }

        const lignes=livreurs.map(livreur=>[
            celluleCSV(livreur.idLivreur),
            celluleCSV(livreur.nom),
            celluleCSV(livreur.prenom),
            celluleCSV(livreur.telephone,{telephone:true}),
            celluleCSV(livreur.telephoneSecondaire,{telephone:true}),
            celluleCSV(livreur.email),
            celluleCSV(livreur.adresse),
            celluleCSV(livreur.zoneLivraison),
            celluleCSV(livreur.typeLivreur),
            celluleCSV(livreur.moyenTransport),
            celluleCSV(livreur.capaciteMaximale,{nombre:true}),
            celluleCSV(livreur.immatriculation),
            celluleCSV(livreur.typePiece),
            celluleCSV(livreur.numeroPiece),
            celluleCSV(livreur.nombreLivraisons,{nombre:true}),
            celluleCSV(livreur.montantTotalEncaisse,{nombre:true}),
            celluleCSV(livreur.ecartTotal,{nombre:true}),
            celluleCSV(livreur.dateDebut),
            celluleCSV(livreur.dateAjout),
            celluleCSV(livreur.derniereLivraison),
            celluleCSV(livreur.statut),
            celluleCSV(livreur.commentaire)
        ]);

        const csv=[
            entetes.map(h=>celluleCSV(h)).join(";"),
            ...lignes.map(ligne=>ligne.join(";"))
        ].join("\r\n");

        const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
        const url=URL.createObjectURL(blob);
        const lien=document.createElement("a");
        lien.href=url;
        lien.download=`livreurs_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(lien);
        lien.click();
        lien.remove();
        setTimeout(()=>URL.revokeObjectURL(url),0);

        if(typeof showToast==="function"){
            showToast(`${livreurs.length} livreur${livreurs.length>1?"s":""} exporté${livreurs.length>1?"s":""}.`,"success");
        }
    }catch(error){
        console.error("Erreur export CSV Livreurs :",error);
        if(typeof showToast==="function")showToast(messageErreurLivreur(error),"error");
    }finally{
        if(bouton){
            bouton.disabled=false;
            bouton.removeAttribute("aria-busy");
            bouton.textContent=texteInitial;
        }
    }
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


/* ==========================================================
   POINT 19 — ACCESSIBILITÉ CLAVIER
   Ajouté sur la version actuelle fournie par l'utilisateur.
========================================================== */
(function initialiserAccessibiliteClavierLivreurs(){
    let dernierFocusAvantModale=null;
    let modaleActivePrecedente=null;

    const focusablesSelector =
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),' +
        'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    function obtenirModaleActive(){
        return ["driver-feedback-overlay","delete-driver-modal","view-driver-modal","driver-modal"]
            .map(id=>document.getElementById(id))
            .find(el=>{
                if(!el)return false;
                const s=getComputedStyle(el);
                return el.getAttribute("aria-hidden")!=="true" &&
                       !el.hidden &&
                       s.display!=="none" &&
                       s.visibility!=="hidden" &&
                       el.getClientRects().length>0;
            }) || null;
    }

    function obtenirFocusables(conteneur){
        if(!conteneur)return [];
        return Array.from(conteneur.querySelectorAll(focusablesSelector)).filter(el=>{
            const s=getComputedStyle(el);
            return !el.hidden && s.display!=="none" && s.visibility!=="hidden" &&
                   el.getClientRects().length>0;
        });
    }

    document.addEventListener("click",event=>{
        const cible=event.target.closest("button,a,[tabindex],input,select,textarea");
        if(cible && !obtenirModaleActive()?.contains(cible)){
            dernierFocusAvantModale=cible;
        }
    },true);

    const observer=new MutationObserver(()=>{
        const active=obtenirModaleActive();
        if(active && active!==modaleActivePrecedente){
            modaleActivePrecedente=active;
            if(!active.hasAttribute("role"))active.setAttribute("role","dialog");
            active.setAttribute("aria-modal","true");
            requestAnimationFrame(()=>{
                const els=obtenirFocusables(active);
                if(els.length && !active.contains(document.activeElement))els[0].focus();
            });
        }else if(!active && modaleActivePrecedente){
            modaleActivePrecedente=null;
            const retour=dernierFocusAvantModale;
            dernierFocusAvantModale=null;
            if(retour && document.contains(retour))requestAnimationFrame(()=>retour.focus());
        }
    });
    observer.observe(document.documentElement,{
        subtree:true,attributes:true,childList:true,
        attributeFilter:["class","style","hidden","aria-hidden"]
    });

    document.addEventListener("keydown",event=>{
        const modal=obtenirModaleActive();

        if(modal && event.key==="Tab"){
            const els=obtenirFocusables(modal);
            if(!els.length){
                event.preventDefault();
                if(!modal.hasAttribute("tabindex"))modal.setAttribute("tabindex","-1");
                modal.focus();
                return;
            }
            const premier=els[0],dernier=els[els.length-1];
            if(event.shiftKey && (document.activeElement===premier || !modal.contains(document.activeElement))){
                event.preventDefault();dernier.focus();
            }else if(!event.shiftKey && document.activeElement===dernier){
                event.preventDefault();premier.focus();
            }
        }

        const trigger=document.getElementById("drivers-actions-trigger");
        const menu=document.getElementById("drivers-actions-dropdown");
        if(!trigger||!menu)return;

        const items=Array.from(menu.querySelectorAll('button:not([disabled]),a[href]'))
            .filter(el=>!el.hidden && el.getClientRects().length>0);

        if(event.key==="Escape" && !menu.hidden){
            event.preventDefault();
            fermerMenuActionsLivreurs();
            trigger.focus();
            return;
        }

        if(document.activeElement===trigger &&
           ["Enter"," ","ArrowDown"].includes(event.key)){
            event.preventDefault();
            menu.hidden=false;
            trigger.setAttribute("aria-expanded","true");
            requestAnimationFrame(()=>items[0]?.focus());
            return;
        }

        if(menu.hidden || !menu.contains(document.activeElement) || !items.length)return;
        const i=Math.max(0,items.indexOf(document.activeElement));

        if(event.key==="ArrowDown"){
            event.preventDefault();items[(i+1)%items.length].focus();
        }else if(event.key==="ArrowUp"){
            event.preventDefault();items[(i-1+items.length)%items.length].focus();
        }else if(event.key==="Home"){
            event.preventDefault();items[0].focus();
        }else if(event.key==="End"){
            event.preventDefault();items[items.length-1].focus();
        }
    });
})();
