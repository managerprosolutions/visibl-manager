/* ===========================================================
   VISIBL ERP — parametres.js
   Étape 1 : Paramètres > Entreprise
=========================================================== */

let parametresEntrepriseCharges = null;
let logoEntrepriseEnEdition = null;
let logoEntrepriseASupprimer = false;

document.addEventListener("DOMContentLoaded", initialiserParametres);

function initialiserParametres() {
    initialiserNavigationParametres();
    initialiserParametresEntreprise();
    initialiserParametresUtilisateurs();
    initialiserParametresRolesAutorisations();
    neutraliserFormulairesParametresNonConnectes();
}

/* ===========================================================
   NAVIGATION DES SECTIONS
=========================================================== */

function initialiserNavigationParametres() {
    const boutons = document.querySelectorAll(".settings-nav-btn");
    const sections = document.querySelectorAll(".settings-section");

    boutons.forEach((bouton) => {
        bouton.addEventListener("click", () => {
            const sectionId = bouton.dataset.settingsSection;

            boutons.forEach((item) => item.classList.remove("active"));
            sections.forEach((section) => section.classList.remove("active"));

            bouton.classList.add("active");
            document.getElementById(sectionId)?.classList.add("active");
        });
    });
}

/* ===========================================================
   ENTREPRISE
=========================================================== */

function initialiserParametresEntreprise() {
    document
        .getElementById("company-settings-form")
        ?.addEventListener("submit", enregistrerParametresEntreprise);

    document
        .getElementById("reset-company-settings-btn")
        ?.addEventListener("click", restaurerParametresEntrepriseCharges);

    document
        .getElementById("company-logo-input")
        ?.addEventListener("change", gererSelectionLogoEntreprise);

    document
        .getElementById("remove-company-logo-btn")
        ?.addEventListener("click", supprimerLogoEntrepriseEdition);

    chargerParametresEntreprise();
}

async function chargerParametresEntreprise() {
    definirChargementEntreprise(true);
    afficherMessageEntreprise("Chargement des informations de l'entreprise...", "info");

    try {
        const resultat = await apiGet("getParametresEntreprise");

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger les paramètres de l'entreprise."
            );
        }

        const donnees = resultat.data || resultat.parametres || {};
        parametresEntrepriseCharges = normaliserParametresEntreprise(donnees);

        appliquerParametresEntreprise(parametresEntrepriseCharges);
        masquerMessageEntreprise();

    } catch (error) {
        console.error("Paramètres entreprise — chargement :", error);

        afficherMessageEntreprise(
            error.message ||
            "Impossible de charger les paramètres de l'entreprise.",
            "error"
        );
    } finally {
        definirChargementEntreprise(false);
    }
}

async function enregistrerParametresEntreprise(event) {
    event.preventDefault();

    const formulaire = document.getElementById("company-settings-form");
    const bouton = document.getElementById("save-company-settings-btn");

    if (!formulaire) return;

    if (!formulaire.checkValidity()) {
        formulaire.reportValidity();
        return;
    }

    const payload = lireParametresEntrepriseFormulaire();

    definirChargementEntreprise(true);

    if (bouton) {
        bouton.dataset.originalText = bouton.textContent;
        bouton.textContent = "Enregistrement...";
    }

    afficherMessageEntreprise("Enregistrement en cours...", "info");

    try {
        console.log(
            "[Paramètres] Envoi logo :",
            payload.logoDataUrl
                ? payload.logoDataUrl.substring(0, 40) + "..."
                : "aucun logo"
        );

        const resultat = await apiPost(
            "saveParametresEntreprise",
            payload
        );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer les paramètres de l'entreprise."
            );
        }

        const donnees = resultat.data || resultat.parametres || payload;
        parametresEntrepriseCharges = normaliserParametresEntreprise(donnees);

        appliquerParametresEntreprise(parametresEntrepriseCharges);

        afficherMessageEntreprise(
            resultat.message ||
            "Les informations de l'entreprise ont été enregistrées.",
            "success"
        );

        afficherToastParametres(
            "Informations de l'entreprise enregistrées.",
            "success"
        );

    } catch (error) {
        console.error("Paramètres entreprise — enregistrement :", error);

        afficherMessageEntreprise(
            error.message ||
            "Impossible d'enregistrer les paramètres de l'entreprise.",
            "error"
        );
    } finally {
        definirChargementEntreprise(false);

        if (bouton) {
            bouton.textContent =
                bouton.dataset.originalText ||
                "💾 Enregistrer";
        }
    }
}

function lireParametresEntrepriseFormulaire() {
    const payload = {
        nomEntreprise: valeurParametre("company-name"),
        raisonSociale: valeurParametre("company-legal-name"),
        secteurActivite: valeurParametre("company-activity"),
        numeroContribuable: valeurParametre("company-tax-number"),
        numeroRccm: valeurParametre("company-register-number"),
        pays: valeurParametre("company-country"),
        ville: valeurParametre("company-city"),
        adresse: valeurParametre("company-address"),
        telephone: valeurParametre("company-phone"),
        email: valeurParametre("company-email"),
        siteWeb: valeurParametre("company-website"),
        devise: valeurParametre("company-currency") || "XOF",
        description: valeurParametre("company-description"),
        supprimerLogo: logoEntrepriseASupprimer === true
    };

    if (
        typeof logoEntrepriseEnEdition === "string" &&
        /^data:image\/(png|jpeg);base64,/i.test(logoEntrepriseEnEdition)
    ) {
        payload.logoDataUrl = logoEntrepriseEnEdition;
    }

    console.log("[Paramètres] Payload entreprise :", {
        ...payload,
        logoDataUrl: payload.logoDataUrl
            ? `IMAGE OK (${payload.logoDataUrl.length} caractères)`
            : "AUCUN NOUVEAU LOGO"
    });

    return payload;
}

function appliquerParametresEntreprise(data) {
    const p = normaliserParametresEntreprise(data);

    definirValeurParametre("company-name", p.nomEntreprise);
    definirValeurParametre("company-legal-name", p.raisonSociale);
    definirValeurParametre("company-activity", p.secteurActivite);
    definirValeurParametre("company-tax-number", p.numeroContribuable);
    definirValeurParametre("company-register-number", p.numeroRccm);
    definirValeurParametre("company-country", p.pays || "cote-ivoire");
    definirValeurParametre("company-city", p.ville);
    definirValeurParametre("company-address", p.adresse);
    definirValeurParametre("company-phone", p.telephone);
    definirValeurParametre("company-email", p.email);
    definirValeurParametre("company-website", p.siteWeb);
    definirValeurParametre("company-currency", p.devise || "XOF");
    definirValeurParametre("company-description", p.description);

    const preview = document.getElementById("company-logo-preview");

    if (preview) {
        preview.src =
            p.logoDataUrl ||
            "../logo-vizibl.png";
    }

    const inputLogo = document.getElementById("company-logo-input");

    if (inputLogo) {
        inputLogo.value = "";
    }

    logoEntrepriseEnEdition = null;
    logoEntrepriseASupprimer = false;
}

function restaurerParametresEntrepriseCharges() {
    if (!parametresEntrepriseCharges) {
        chargerParametresEntreprise();
        return;
    }

    appliquerParametresEntreprise(parametresEntrepriseCharges);
    masquerMessageEntreprise();

    afficherToastParametres(
        "Modifications annulées.",
        "info"
    );
}

function normaliserParametresEntreprise(data) {
    return {
        nomEntreprise: texteParametre(data?.nomEntreprise),
        raisonSociale: texteParametre(data?.raisonSociale),
        secteurActivite: texteParametre(data?.secteurActivite),
        numeroContribuable: texteParametre(data?.numeroContribuable),
        numeroRccm: texteParametre(data?.numeroRccm),
        pays: texteParametre(data?.pays) || "cote-ivoire",
        ville: texteParametre(data?.ville),
        adresse: texteParametre(data?.adresse),
        telephone: texteParametre(data?.telephone),
        email: texteParametre(data?.email),
        siteWeb: texteParametre(data?.siteWeb),
        devise: texteParametre(data?.devise) || "XOF",
        description: texteParametre(data?.description),
        logoFileId: texteParametre(data?.logoFileId),
        logoDataUrl: texteParametre(data?.logoDataUrl),
        derniereModification: texteParametre(data?.derniereModification)
    };
}

/* ===========================================================
   LOGO
=========================================================== */

async function gererSelectionLogoEntreprise(event) {
    const input = event.currentTarget;
    const fichier = input?.files?.[0];

    if (!fichier) return;

    const typesAutorises = [
        "image/png",
        "image/jpeg"
    ];

    if (!typesAutorises.includes(fichier.type)) {
        input.value = "";

        afficherMessageEntreprise(
            "Le logo doit être au format PNG ou JPG.",
            "error"
        );
        return;
    }

    const tailleMax = 2 * 1024 * 1024;

    if (fichier.size > tailleMax) {
        input.value = "";

        afficherMessageEntreprise(
            "Le logo ne doit pas dépasser 2 Mo.",
            "error"
        );
        return;
    }

    try {
        const dataUrl = await lireFichierEnDataUrl(fichier);

        logoEntrepriseEnEdition = dataUrl;
        logoEntrepriseASupprimer = false;

        const preview = document.getElementById("company-logo-preview");

        if (preview) {
            preview.src = dataUrl;
        }

        masquerMessageEntreprise();

    } catch (error) {
        console.error("Lecture logo :", error);

        input.value = "";

        afficherMessageEntreprise(
            "Impossible de lire le logo sélectionné.",
            "error"
        );
    }
}

function supprimerLogoEntrepriseEdition() {
    logoEntrepriseEnEdition = null;
    logoEntrepriseASupprimer = true;

    const input = document.getElementById("company-logo-input");
    const preview = document.getElementById("company-logo-preview");

    if (input) input.value = "";
    if (preview) preview.src = "../logo-vizibl.png";

    afficherMessageEntreprise(
        "Le logo sera supprimé après l'enregistrement.",
        "info"
    );
}

function lireFichierEnDataUrl(fichier) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(
            typeof reader.result === "string"
                ? reader.result
                : ""
        );

        reader.onerror = () => reject(
            reader.error ||
            new Error("Lecture du fichier impossible.")
        );

        reader.readAsDataURL(fichier);
    });
}


/* ===========================================================
   UTILISATEURS
=========================================================== */

let parametresUtilisateurs = [];
let parametresRoles = [];
let utilisateurConsultationId = "";

function initialiserParametresUtilisateurs() {
    document.getElementById("add-user-btn")?.addEventListener("click", () => ouvrirFormulaireUtilisateur());
    document.getElementById("user-settings-form")?.addEventListener("submit", enregistrerUtilisateurParametres);
    document.getElementById("users-search-input")?.addEventListener("input", afficherUtilisateursParametres);
    document.getElementById("users-table-body")?.addEventListener("click", gererActionTableUtilisateur);
    document.getElementById("user-password-toggle")?.addEventListener("click", basculerAffichageMotDePasseUtilisateur);
    document.getElementById("user-password-reset-form")?.addEventListener("submit", enregistrerReinitialisationMotDePasseUtilisateur);
    document.getElementById("user-password-reset-toggle")?.addEventListener("click", basculerAffichageMotDePasseReinitialisation);
    document.querySelectorAll("[data-user-password-reset-close]").forEach((el) =>
        el.addEventListener("click", fermerReinitialisationMotDePasseUtilisateur)
    );
    document.getElementById("user-view-edit-btn")?.addEventListener("click", () => {
        const utilisateur = trouverUtilisateurParametres(utilisateurConsultationId);
        fermerConsultationUtilisateur();
        if (utilisateur) ouvrirFormulaireUtilisateur(utilisateur);
    });

    document.querySelectorAll("[data-user-modal-close]").forEach((el) =>
        el.addEventListener("click", fermerFormulaireUtilisateur)
    );
    document.querySelectorAll("[data-user-view-close]").forEach((el) =>
        el.addEventListener("click", fermerConsultationUtilisateur)
    );

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        fermerFormulaireUtilisateur();
        fermerConsultationUtilisateur();
        fermerReinitialisationMotDePasseUtilisateur();
        fermerMenusUtilisateurs();
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".settings-user-actions")) fermerMenusUtilisateurs();
    });

    chargerRolesParametres();
    chargerUtilisateursParametres();
}


async function chargerRolesParametres() {
    const select = document.getElementById("user-role");
    if (select) {
        select.disabled = true;
        select.innerHTML = `<option value="">Chargement des rôles...</option>`;
    }

    try {
        const resultat = await apiGet("getParametresRoles");
        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible de charger les rôles.");
        }

        parametresRoles = Array.isArray(resultat.data) ? resultat.data : [];

        if (select) {
            select.innerHTML = `<option value="">Sélectionner un rôle</option>` +
                parametresRoles
                    .filter((role) => String(role.statut || "").trim().toLowerCase() === "actif")
                    .map((role) =>
                        `<option value="${echapperHtmlUtilisateur(role.idRole)}">${echapperHtmlUtilisateur(role.nomRole)}</option>`
                    )
                    .join("");
            select.disabled = false;
        }
    } catch (error) {
        console.error("Paramètres rôles — chargement :", error);
        parametresRoles = [];
        if (select) {
            select.innerHTML = `<option value="">Rôles indisponibles</option>`;
            select.disabled = true;
        }
        afficherMessageUtilisateurs(
            error.message || "Impossible de charger la liste des rôles.",
            "error"
        );
    }
}

function nomRoleParametres(idRole) {
    const id = String(idRole || "").trim();
    const role = parametresRoles.find((item) => String(item.idRole || "").trim() === id);
    return role?.nomRole || id || "—";
}

async function chargerUtilisateursParametres() {
    afficherMessageUtilisateurs("Chargement des utilisateurs...", "info");
    try {
        const resultat = await apiGet("getParametresUtilisateurs");
        if (!resultat?.success) throw new Error(resultat?.message || "Impossible de charger les utilisateurs.");
        parametresUtilisateurs = Array.isArray(resultat.data) ? resultat.data : (Array.isArray(resultat.utilisateurs) ? resultat.utilisateurs : []);
        afficherUtilisateursParametres();
        masquerMessageUtilisateurs();
    } catch (error) {
        console.error("Paramètres utilisateurs — chargement :", error);
        parametresUtilisateurs = [];
        afficherUtilisateursParametres();
        afficherMessageUtilisateurs(error.message || "Impossible de charger les utilisateurs.", "error");
    }
}

function afficherUtilisateursParametres() {
    const tbody = document.getElementById("users-table-body");
    if (!tbody) return;
    const recherche = String(document.getElementById("users-search-input")?.value || "").trim().toLowerCase();
    const filtres = parametresUtilisateurs.filter((u) => {
        if (!recherche) return true;
        return [u.nomComplet, u.email, u.roleNom || nomRoleParametres(u.roleId || u.role), u.statut].some((v) => String(v || "").toLowerCase().includes(recherche));
    });

    const actifs = parametresUtilisateurs.filter((u) => normaliserStatutUtilisateur(u.statut) === "Actif").length;
    mettreTexte("users-total-count", parametresUtilisateurs.length);
    mettreTexte("users-active-count", actifs);
    mettreTexte("users-inactive-count", Math.max(0, parametresUtilisateurs.length - actifs));
    mettreTexte("users-result-count", `${filtres.length} utilisateur${filtres.length > 1 ? "s" : ""} affiché${filtres.length > 1 ? "s" : ""}`);

    if (!filtres.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="settings-users-empty">${recherche ? "Aucun utilisateur ne correspond à la recherche." : "Aucun utilisateur enregistré."}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtres.map((u) => {
        const actif = normaliserStatutUtilisateur(u.statut) === "Actif";
        return `
            <tr>
                <td data-label="Utilisateur">
                    <div class="settings-user-cell">
                        <div class="settings-user-avatar">${echapperHtmlUtilisateur(initialesUtilisateur(u.nomComplet))}</div>
                        <div><strong>${echapperHtmlUtilisateur(u.nomComplet || "Utilisateur")}</strong><span>${echapperHtmlUtilisateur(u.idUtilisateur || "")}</span></div>
                    </div>
                </td>
                <td data-label="E-mail">${echapperHtmlUtilisateur(u.email || "—")}</td>
                <td data-label="Rôle">${echapperHtmlUtilisateur(u.roleNom || nomRoleParametres(u.roleId || u.role))}</td>
                <td data-label="Dernière connexion">${echapperHtmlUtilisateur(formaterDerniereConnexionUtilisateur(u.derniereConnexion))}</td>
                <td data-label="Statut"><span class="status-badge ${actif ? "status-paid" : "status-cancelled"}">${actif ? "Actif" : "Inactif"}</span></td>
                <td data-label="Actions" class="settings-users-actions-cell">
                    <div class="settings-user-actions">
                        <button type="button" class="settings-user-actions-trigger" data-user-action="menu" data-user-id="${echapperAttributUtilisateur(u.idUtilisateur)}" aria-label="Actions">⋮</button>
                        <div class="settings-user-actions-menu" hidden>
                            <button type="button" data-user-action="view" data-user-id="${echapperAttributUtilisateur(u.idUtilisateur)}">👁 Voir</button>
                            <button type="button" data-user-action="edit" data-user-id="${echapperAttributUtilisateur(u.idUtilisateur)}">✏️ Modifier</button>
                            <button type="button" data-user-action="reset-password" data-user-id="${echapperAttributUtilisateur(u.idUtilisateur)}">🔑 Réinitialiser le mot de passe</button>
                            <button type="button" data-user-action="toggle" data-user-id="${echapperAttributUtilisateur(u.idUtilisateur)}">${actif ? "⛔ Désactiver" : "✅ Activer"}</button>
                        </div>
                    </div>
                </td>
            </tr>`;
    }).join("");
}

function gererActionTableUtilisateur(event) {
    const bouton = event.target.closest("[data-user-action]");
    if (!bouton) return;
    const action = bouton.dataset.userAction;
    const id = bouton.dataset.userId || "";
    const utilisateur = trouverUtilisateurParametres(id);

    if (action === "menu") {
        event.stopPropagation();
        const menu = bouton.parentElement?.querySelector(".settings-user-actions-menu");
        const etaitFerme = Boolean(menu?.hidden);
        fermerMenusUtilisateurs();
        if (menu && etaitFerme) menu.hidden = false;
        return;
    }
    fermerMenusUtilisateurs();
    if (!utilisateur) return;
    if (action === "view") ouvrirConsultationUtilisateur(utilisateur);
    if (action === "edit") ouvrirFormulaireUtilisateur(utilisateur);
    if (action === "reset-password") ouvrirReinitialisationMotDePasseUtilisateur(utilisateur);
    if (action === "toggle") changerStatutUtilisateurParametres(utilisateur);
}

function formaterDerniereConnexionUtilisateur(valeur) {
    const texte = String(valeur || "").trim();
    if (!texte) return "Jamais";

    let date = new Date(texte);

    if (Number.isNaN(date.getTime())) {
        const match = texte.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(?:à\s*)?(\d{1,2}):(\d{2}))?/i);
        if (match) {
            date = new Date(
                Number(match[3]),
                Number(match[2]) - 1,
                Number(match[1]),
                Number(match[4] || 0),
                Number(match[5] || 0)
            );
        }
    }

    if (Number.isNaN(date.getTime())) return texte;

    const maintenant = new Date();
    const debutAujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    const debutDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const ecartJours = Math.round((debutAujourdhui - debutDate) / 86400000);
    const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    if (ecartJours === 0) return `Aujourd’hui à ${heure}`;
    if (ecartJours === 1) return `Hier à ${heure}`;

    return `${date.toLocaleDateString("fr-FR")} à ${heure}`;
}

function ouvrirReinitialisationMotDePasseUtilisateur(utilisateur) {
    const modal = document.getElementById("user-password-reset-modal");
    const form = document.getElementById("user-password-reset-form");
    if (!modal || !form || !utilisateur?.idUtilisateur) return;

    form.reset();
    mettreValeurUtilisateur("user-password-reset-id", utilisateur.idUtilisateur);
    mettreTexte(
        "user-password-reset-subtitle",
        `Définissez un nouveau mot de passe pour ${utilisateur.nomComplet || "cet utilisateur"}.`
    );

    const message = document.getElementById("user-password-reset-message");
    if (message) {
        message.hidden = true;
        message.textContent = "";
        message.className = "settings-form-message";
    }

    const nouveau = document.getElementById("user-password-reset-new");
    if (nouveau) nouveau.type = "password";

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("settings-modal-open");
    setTimeout(() => nouveau?.focus(), 20);
}

function fermerReinitialisationMotDePasseUtilisateur() {
    const modal = document.getElementById("user-password-reset-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("settings-modal-open");
}

function basculerAffichageMotDePasseReinitialisation() {
    const nouveau = document.getElementById("user-password-reset-new");
    const confirmation = document.getElementById("user-password-reset-confirm");
    if (!nouveau || !confirmation) return;

    const afficher = nouveau.type === "password";
    nouveau.type = afficher ? "text" : "password";
    confirmation.type = afficher ? "text" : "password";
}

async function enregistrerReinitialisationMotDePasseUtilisateur(event) {
    event.preventDefault();

    const idUtilisateur = valeurElementUtilisateur("user-password-reset-id");
    const motDePasse = valeurElementUtilisateur("user-password-reset-new");
    const confirmation = valeurElementUtilisateur("user-password-reset-confirm");
    const bouton = document.getElementById("save-user-password-reset-btn");
    const message = document.getElementById("user-password-reset-message");

    const afficherErreur = (texte) => {
        if (!message) return;
        message.textContent = texte;
        message.className = "settings-form-message error";
        message.hidden = false;
    };

    if (!idUtilisateur) {
        afficherErreur("Utilisateur introuvable.");
        return;
    }

    if (motDePasse.length < 6) {
        afficherErreur("Le mot de passe doit contenir au moins 6 caractères.");
        return;
    }

    if (motDePasse !== confirmation) {
        afficherErreur("Les deux mots de passe ne correspondent pas.");
        return;
    }

    if (bouton) {
        bouton.disabled = true;
        bouton.dataset.originalText = bouton.textContent;
        bouton.textContent = "Réinitialisation...";
    }

    try {
        const resultat = await apiPost("resetParametresUtilisateurPassword", {
            idUtilisateur,
            motDePasse
        });

        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible de réinitialiser le mot de passe.");
        }

        fermerReinitialisationMotDePasseUtilisateur();
        afficherToastParametres(resultat.message || "Mot de passe réinitialisé.", "success");
    } catch (error) {
        console.error("Paramètres utilisateur — réinitialisation mot de passe :", error);
        afficherErreur(error.message || "Impossible de réinitialiser le mot de passe.");
    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.textContent = bouton.dataset.originalText || "🔑 Réinitialiser";
        }
    }
}

function ouvrirFormulaireUtilisateur(utilisateur = null) {
    const modal = document.getElementById("user-form-modal");
    const form = document.getElementById("user-settings-form");
    if (!modal || !form) return;
    form.reset();
    masquerMessageUtilisateurForm();
    const edition = Boolean(utilisateur?.idUtilisateur);
    mettreValeurUtilisateur("user-id", edition ? utilisateur.idUtilisateur : "");
    mettreValeurUtilisateur("user-full-name", edition ? utilisateur.nomComplet : "");
    mettreValeurUtilisateur("user-email", edition ? utilisateur.email : "");
    mettreValeurUtilisateur("user-role", edition ? (utilisateur.roleId || utilisateur.role) : "");
    mettreValeurUtilisateur("user-status", edition ? normaliserStatutUtilisateur(utilisateur.statut) : "Actif");
    mettreValeurUtilisateur("user-password", "");
    const pwd = document.getElementById("user-password");
    if (pwd) { pwd.required = !edition; pwd.type = "password"; }
    mettreTexte("user-password-label", edition ? "Nouveau mot de passe" : "Mot de passe initial *");
    mettreTexte("user-password-help", edition ? "Laissez vide pour conserver le mot de passe actuel." : "Obligatoire lors de la création du compte.");
    mettreTexte("user-form-modal-title", edition ? "Modifier l'utilisateur" : "Nouvel utilisateur");
    mettreTexte("user-form-modal-subtitle", edition ? "Mettez à jour les informations du compte." : "Créez un compte autorisé à accéder à VISIBL.");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("settings-modal-open");
    setTimeout(() => document.getElementById("user-full-name")?.focus(), 20);
}

function fermerFormulaireUtilisateur() {
    const modal = document.getElementById("user-form-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("settings-modal-open");
}

async function enregistrerUtilisateurParametres(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const idUtilisateur = valeurElementUtilisateur("user-id");
    const payload = {
        idUtilisateur,
        nomComplet: valeurElementUtilisateur("user-full-name"),
        email: valeurElementUtilisateur("user-email"),
        roleId: valeurElementUtilisateur("user-role"),
        statut: valeurElementUtilisateur("user-status"),
        motDePasse: valeurElementUtilisateur("user-password")
    };
    const btn = document.getElementById("save-user-btn");
    if (btn) { btn.disabled = true; btn.dataset.originalText = btn.textContent; btn.textContent = "Enregistrement..."; }
    afficherMessageUtilisateurForm("Enregistrement en cours...", "info");
    try {
        const action = idUtilisateur ? "updateParametresUtilisateur" : "createParametresUtilisateur";
        const resultat = await apiPost(action, payload);
        if (!resultat?.success) throw new Error(resultat?.message || "Impossible d'enregistrer l'utilisateur.");
        await chargerUtilisateursParametres();
        fermerFormulaireUtilisateur();
        afficherToastParametres(resultat.message || "Utilisateur enregistré.", "success");
    } catch (error) {
        console.error("Paramètres utilisateur — enregistrement :", error);
        afficherMessageUtilisateurForm(error.message || "Impossible d'enregistrer l'utilisateur.", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || "💾 Enregistrer"; }
    }
}

async function changerStatutUtilisateurParametres(utilisateur) {
    const actuel = normaliserStatutUtilisateur(utilisateur.statut);
    const nouveau = actuel === "Actif" ? "Inactif" : "Actif";
    if (!window.confirm(`${nouveau === "Inactif" ? "Désactiver" : "Activer"} le compte de ${utilisateur.nomComplet || utilisateur.email} ?`)) return;
    try {
        const resultat = await apiPost("setStatutParametresUtilisateur", { idUtilisateur: utilisateur.idUtilisateur, statut: nouveau });
        if (!resultat?.success) throw new Error(resultat?.message || "Impossible de modifier le statut.");
        await chargerUtilisateursParametres();
        afficherToastParametres(resultat.message || `Utilisateur ${nouveau.toLowerCase()}.`, "success");
    } catch (error) {
        console.error("Paramètres utilisateur — statut :", error);
        afficherMessageUtilisateurs(error.message || "Impossible de modifier le statut.", "error");
    }
}

function ouvrirConsultationUtilisateur(utilisateur) {
    utilisateurConsultationId = utilisateur.idUtilisateur || "";
    const modal = document.getElementById("user-view-modal");
    if (!modal) return;
    const actif = normaliserStatutUtilisateur(utilisateur.statut) === "Actif";
    mettreTexte("user-view-avatar", initialesUtilisateur(utilisateur.nomComplet));
    mettreTexte("user-view-name", utilisateur.nomComplet || "Utilisateur");
    mettreTexte("user-view-email", utilisateur.email || "—");
    mettreTexte("user-view-role", utilisateur.roleNom || nomRoleParametres(utilisateur.roleId || utilisateur.role));
    mettreTexte("user-view-last-login", formaterDerniereConnexionUtilisateur(utilisateur.derniereConnexion));
    mettreTexte("user-view-created", utilisateur.dateCreation || "—");
    mettreTexte("user-view-updated", utilisateur.derniereModification || "—");
    const statut = document.getElementById("user-view-status");
    if (statut) { statut.textContent = actif ? "Actif" : "Inactif"; statut.className = `status-badge ${actif ? "status-paid" : "status-cancelled"}`; }
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("settings-modal-open");
}

function fermerConsultationUtilisateur() {
    const modal = document.getElementById("user-view-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("settings-modal-open");
}

function basculerAffichageMotDePasseUtilisateur() {
    const input = document.getElementById("user-password");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
}

function fermerMenusUtilisateurs() {
    document.querySelectorAll(".settings-user-actions-menu").forEach((menu) => { menu.hidden = true; });
}

function trouverUtilisateurParametres(id) { return parametresUtilisateurs.find((u) => String(u.idUtilisateur || "") === String(id || "")); }
function normaliserStatutUtilisateur(statut) { return String(statut || "").trim().toLowerCase() === "inactif" ? "Inactif" : "Actif"; }
function valeurElementUtilisateur(id) { return String(document.getElementById(id)?.value ?? "").trim(); }
function mettreValeurUtilisateur(id, valeur) { const el = document.getElementById(id); if (el) el.value = valeur == null ? "" : String(valeur); }
function mettreTexte(id, valeur) { const el = document.getElementById(id); if (el) el.textContent = valeur == null ? "" : String(valeur); }
function initialesUtilisateur(nom) { const mots = String(nom || "U").trim().split(/\s+/).filter(Boolean); return (mots.slice(0,2).map((m) => m[0]).join("") || "U").toUpperCase(); }
function echapperHtmlUtilisateur(v) { return String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function echapperAttributUtilisateur(v) { return echapperHtmlUtilisateur(v); }
function afficherMessageUtilisateurs(message, type) { const z=document.getElementById("users-settings-message"); if(!z)return; z.hidden=false; z.textContent=message||""; z.className=`settings-form-message ${type === "error" ? "is-error" : type === "success" ? "is-success" : "is-info"}`; }
function masquerMessageUtilisateurs() { const z=document.getElementById("users-settings-message"); if(!z)return; z.hidden=true; z.textContent=""; z.className="settings-form-message"; }
function afficherMessageUtilisateurForm(message, type) { const z=document.getElementById("user-form-message"); if(!z)return; z.hidden=false; z.textContent=message||""; z.className=`settings-form-message ${type === "error" ? "is-error" : type === "success" ? "is-success" : "is-info"}`; }
function masquerMessageUtilisateurForm() { const z=document.getElementById("user-form-message"); if(!z)return; z.hidden=true; z.textContent=""; z.className="settings-form-message"; }


/* ===========================================================
   RÔLES ET AUTORISATIONS
=========================================================== */

const PARAMETRES_ROLE_MODULES = [
    ["dashboard", "Tableau de bord", ["voir"]],
    ["clients", "Clients", ["voir", "creer", "modifier", "supprimer"]],
    ["commandes", "Commandes", ["voir", "creer", "modifier", "supprimer"]],
    ["ventes", "Ventes", ["voir", "creer", "modifier", "supprimer"]],
    ["livraisons", "Livraisons", ["voir", "creer", "modifier"]],
    ["livreurs", "Livreurs", ["voir", "creer", "modifier", "supprimer"]],
    ["produits", "Produits", ["voir", "creer", "modifier", "supprimer"]],
    ["stock", "Stock", ["voir", "creer", "modifier"]],
    ["mouvements_stock", "Mouvements de stock", ["voir", "creer", "modifier"]],
    ["approvisionnements", "Approvisionnements", ["voir", "creer", "modifier", "supprimer"]],
    ["fournisseurs", "Fournisseurs", ["voir", "creer", "modifier", "supprimer"]],
    ["transitaires", "Transitaires", ["voir", "creer", "modifier", "supprimer"]],
    ["caisse", "Caisse", ["voir", "creer", "modifier"]],
    ["paiements", "Paiements", ["voir", "creer", "modifier"]],
    ["factures", "Factures", ["voir", "creer", "modifier"]],
    ["comptabilite", "Comptabilité", ["voir", "creer", "modifier"]],
    ["rapports", "Rapports", ["voir"]],
    ["parametres", "Paramètres", ["voir", "modifier"]]
];

let rolesParametresGestion = [];
let roleConsultationId = "";

function initialiserParametresRolesAutorisations() {
    document.getElementById("add-role-btn")?.addEventListener("click", () => ouvrirFormulaireRole());
    document.getElementById("roles-search-input")?.addEventListener("input", afficherRolesParametresGestion);
    document.getElementById("roles-settings-list")?.addEventListener("click", gererActionRoleParametres);
    document.getElementById("role-settings-form")?.addEventListener("submit", enregistrerRoleParametres);
    document.getElementById("role-permissions-all-btn")?.addEventListener("click", toutAutoriserRoleParametres);
    document.getElementById("role-view-edit-btn")?.addEventListener("click", () => {
        const role = trouverRoleParametresGestion(roleConsultationId);
        fermerConsultationRoleParametres();
        if (role) ouvrirFormulaireRole(role);
    });

    document.querySelectorAll("[data-role-modal-close]").forEach((el) =>
        el.addEventListener("click", fermerFormulaireRole)
    );
    document.querySelectorAll("[data-role-view-close]").forEach((el) =>
        el.addEventListener("click", fermerConsultationRoleParametres)
    );

    chargerRolesParametresGestion();
}

async function chargerRolesParametresGestion() {
    afficherMessageRoles("Chargement des rôles...", "info");

    try {
        const resultat = await apiGet("getParametresRolesGestion");
        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible de charger les rôles.");
        }

        rolesParametresGestion = Array.isArray(resultat.data) ? resultat.data : [];
        afficherRolesParametresGestion();
        masquerMessageRoles();
    } catch (error) {
        console.error("Rôles et autorisations — chargement :", error);
        rolesParametresGestion = [];
        afficherRolesParametresGestion();
        afficherMessageRoles(error.message || "Impossible de charger les rôles.", "error");
    }
}

function afficherRolesParametresGestion() {
    const conteneur = document.getElementById("roles-settings-list");
    if (!conteneur) return;

    const recherche = String(document.getElementById("roles-search-input")?.value || "").trim().toLowerCase();
    const roles = rolesParametresGestion.filter((role) => {
        if (!recherche) return true;
        return [
            role.idRole,
            role.nomRole,
            role.description,
            role.niveauAcces,
            role.statut
        ].some((v) => String(v || "").toLowerCase().includes(recherche));
    });

    mettreTexte("roles-result-count", `${roles.length} rôle${roles.length > 1 ? "s" : ""}`);

    if (!roles.length) {
        conteneur.innerHTML = `<div class="settings-users-empty">${recherche ? "Aucun rôle ne correspond à la recherche." : "Aucun rôle enregistré."}</div>`;
        return;
    }

    conteneur.innerHTML = roles.map((role) => {
        const actif = String(role.statut || "").toLowerCase() === "actif";
        const permissions = Array.isArray(role.permissions) ? role.permissions : [];
        const modules = permissions
            .filter((p) => p.voir || p.creer || p.modifier || p.supprimer)
            .slice(0, 7)
            .map((p) => `<span>${echapperHtmlUtilisateur(p.libelle || p.module)}</span>`)
            .join("");

        return `
            <div class="role-settings-card">
                <div class="role-settings-header">
                    <div>
                        <h4>${echapperHtmlUtilisateur(role.nomRole || "Rôle")}</h4>
                        <p>${echapperHtmlUtilisateur(role.description || "Aucune description.")}</p>
                        <small>${echapperHtmlUtilisateur(role.idRole || "")} · ${echapperHtmlUtilisateur(role.niveauAcces || "—")}</small>
                    </div>
                    <div>
                        <span class="status-badge ${actif ? "status-paid" : "status-cancelled"}">${actif ? "Actif" : "Inactif"}</span>
                        <span class="status-badge status-paid">${Number(role.nombreUtilisateurs || 0)} utilisateur${Number(role.nombreUtilisateurs || 0) > 1 ? "s" : ""}</span>
                    </div>
                </div>

                <div class="role-permissions">
                    ${modules || "<span>Aucune autorisation</span>"}
                </div>

                <div class="role-settings-actions settings-user-actions">
                    <button type="button" class="btn-secondary" data-role-action="view" data-role-id="${echapperAttributUtilisateur(role.idRole)}">
                        Voir les autorisations
                    </button>
                    <button type="button" class="btn-primary" data-role-action="edit" data-role-id="${echapperAttributUtilisateur(role.idRole)}">
                        Modifier
                    </button>
                    ${role.idRole === "ROL0001" ? "" : `
                    <button type="button" class="settings-user-actions-trigger" data-role-action="menu" data-role-id="${echapperAttributUtilisateur(role.idRole)}" aria-label="Autres actions">⋮</button>
                    <div class="settings-user-actions-menu" hidden>
                        <button type="button" data-role-action="toggle" data-role-id="${echapperAttributUtilisateur(role.idRole)}">
                            ${actif ? "⛔ Désactiver" : "✅ Activer"}
                        </button>
                    </div>`}
                </div>
            </div>
        `;
    }).join("");
}

function gererActionRoleParametres(event) {
    const bouton = event.target.closest("[data-role-action]");
    if (!bouton) return;

    const action = bouton.dataset.roleAction;
    const idRole = bouton.dataset.roleId || "";
    const role = trouverRoleParametresGestion(idRole);

    if (action === "menu") {
        event.stopPropagation();
        const menu = bouton.parentElement?.querySelector(".settings-user-actions-menu");
        document.querySelectorAll("#roles-settings-list .settings-user-actions-menu").forEach((m) => {
            if (m !== menu) m.hidden = true;
        });
        if (menu) menu.hidden = !menu.hidden;
        return;
    }

    if (!role) return;
    if (action === "view") ouvrirConsultationRoleParametres(role);
    if (action === "edit") ouvrirFormulaireRole(role);
    if (action === "toggle") changerStatutRoleParametres(role);
}

function construireMatricePermissionsRole(permissions = [], verrouille = false) {
    const tbody = document.getElementById("role-permissions-body");
    if (!tbody) return;

    const map = new Map(
        (Array.isArray(permissions) ? permissions : []).map((p) => [String(p.module || ""), p])
    );

    tbody.innerHTML = PARAMETRES_ROLE_MODULES.map(([module, libelle, actions]) => {
        const p = map.get(module) || {};
        const cellule = (action) => {
            const disponible = actions.includes(action);
            if (!disponible) return `<td data-label="${action}">—</td>`;

            const checked = verrouille || Boolean(p[action]);
            return `<td data-label="${action}">
                <input type="checkbox"
                    class="settings-switch-input role-permission-checkbox"
                    data-role-module="${module}"
                    data-role-permission="${action}"
                    ${checked ? "checked" : ""}
                    ${verrouille ? "disabled" : ""}>
            </td>`;
        };

        return `<tr>
            <td data-label="Module"><strong>${echapperHtmlUtilisateur(libelle)}</strong></td>
            ${cellule("voir")}
            ${cellule("creer")}
            ${cellule("modifier")}
            ${cellule("supprimer")}
        </tr>`;
    }).join("");
}

function lirePermissionsRoleFormulaire() {
    return PARAMETRES_ROLE_MODULES.map(([module, libelle]) => {
        const valeur = (action) => Boolean(
            document.querySelector(`[data-role-module="${module}"][data-role-permission="${action}"]`)?.checked
        );

        return {
            module,
            libelle,
            voir: valeur("voir"),
            creer: valeur("creer"),
            modifier: valeur("modifier"),
            supprimer: valeur("supprimer")
        };
    });
}

function ouvrirFormulaireRole(role = null) {
    const modal = document.getElementById("role-form-modal");
    const form = document.getElementById("role-settings-form");
    if (!modal || !form) return;

    form.reset();
    masquerMessageRoleForm();

    const edition = Boolean(role?.idRole);
    const admin = role?.idRole === "ROL0001";

    mettreValeurUtilisateur("role-id", edition ? role.idRole : "");
    mettreValeurUtilisateur("role-name", edition ? role.nomRole : "");
    mettreValeurUtilisateur("role-level", edition ? (role.niveauAcces || "Intermédiaire") : "Intermédiaire");
    mettreValeurUtilisateur("role-status", admin ? "Actif" : (edition ? role.statut : "Actif"));
    mettreValeurUtilisateur("role-description", edition ? role.description : "");
    mettreValeurUtilisateur("role-comment", edition ? role.commentaire : "");

    const status = document.getElementById("role-status");
    if (status) status.disabled = admin;

    const name = document.getElementById("role-name");
    if (name) name.disabled = admin;

    construireMatricePermissionsRole(edition ? role.permissions : [], admin);

    mettreTexte("role-form-title", edition ? `Modifier ${role.nomRole}` : "Nouveau rôle");
    mettreTexte(
        "role-form-subtitle",
        admin
            ? "Le rôle Administrateur conserve toujours un accès complet."
            : edition
                ? "Modifiez les informations et les autorisations du rôle."
                : "Créez un rôle et définissez ses autorisations."
    );

    const allBtn = document.getElementById("role-permissions-all-btn");
    if (allBtn) allBtn.disabled = admin;

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("settings-modal-open");
    setTimeout(() => document.getElementById("role-name")?.focus(), 20);
}

function fermerFormulaireRole() {
    const modal = document.getElementById("role-form-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("settings-modal-open");

    const status = document.getElementById("role-status");
    const name = document.getElementById("role-name");
    const allBtn = document.getElementById("role-permissions-all-btn");
    if (status) status.disabled = false;
    if (name) name.disabled = false;
    if (allBtn) allBtn.disabled = false;
}

async function enregistrerRoleParametres(event) {
    event.preventDefault();

    const form = document.getElementById("role-settings-form");
    const bouton = document.getElementById("save-role-btn");
    if (!form) return;

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const idRole = valeurElementUtilisateur("role-id");
    const payload = {
        idRole,
        nomRole: valeurElementUtilisateur("role-name"),
        description: valeurElementUtilisateur("role-description"),
        niveauAcces: valeurElementUtilisateur("role-level"),
        statut: valeurElementUtilisateur("role-status") || "Actif",
        commentaire: valeurElementUtilisateur("role-comment"),
        permissions: lirePermissionsRoleFormulaire()
    };

    if (bouton) {
        bouton.disabled = true;
        bouton.dataset.originalText = bouton.textContent;
        bouton.textContent = "Enregistrement...";
    }

    try {
        const resultat = await apiPost(
            idRole ? "updateParametresRole" : "createParametresRole",
            payload
        );

        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible d'enregistrer le rôle.");
        }

        fermerFormulaireRole();
        await Promise.all([
            chargerRolesParametresGestion(),
            chargerRolesParametres()
        ]);
        afficherToastParametres(resultat.message || "Rôle enregistré.", "success");
    } catch (error) {
        console.error("Rôle — enregistrement :", error);
        afficherMessageRoleForm(error.message || "Impossible d'enregistrer le rôle.", "error");
    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.textContent = bouton.dataset.originalText || "💾 Enregistrer";
        }
    }
}

async function changerStatutRoleParametres(role) {
    if (!role?.idRole || role.idRole === "ROL0001") return;

    const nouveau = String(role.statut || "").toLowerCase() === "actif" ? "Inactif" : "Actif";

    try {
        const resultat = await apiPost("setStatutParametresRole", {
            idRole: role.idRole,
            statut: nouveau
        });

        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible de modifier le statut du rôle.");
        }

        await Promise.all([
            chargerRolesParametresGestion(),
            chargerRolesParametres()
        ]);
        afficherToastParametres(resultat.message || "Statut du rôle modifié.", "success");
    } catch (error) {
        console.error("Rôle — statut :", error);
        afficherMessageRoles(error.message || "Impossible de modifier le statut du rôle.", "error");
    }
}

function ouvrirConsultationRoleParametres(role) {
    roleConsultationId = role.idRole || "";
    const modal = document.getElementById("role-view-modal");
    if (!modal) return;

    mettreTexte("role-view-title", role.nomRole || "Rôle");
    mettreTexte("role-view-description", role.description || "Aucune description renseignée.");
    mettreTexte("role-view-id", role.idRole || "—");
    mettreTexte("role-view-level", role.niveauAcces || "—");
    mettreTexte("role-view-users", String(Number(role.nombreUtilisateurs || 0)));
    mettreTexte("role-view-created", role.dateCreation || "—");
    mettreTexte("role-view-creator", role.idCreateur || "—");

    const statut = String(role.statut || "—").trim();
    const statutEl = document.getElementById("role-view-status");
    if (statutEl) {
        statutEl.textContent = statut || "—";
        statutEl.className = "";
        if (statut.toLowerCase() === "actif") {
            statutEl.classList.add("role-view-status-active");
        } else if (statut.toLowerCase() === "inactif") {
            statutEl.classList.add("role-view-status-inactive");
        }
    }

    const tbody = document.getElementById("role-view-permissions-body");
    const permissions = Array.isArray(role.permissions) ? role.permissions : [];
    let totalActives = 0;

    const afficherPermission = (active, libelle) => {
        if (active) {
            totalActives += 1;
            return `<span class="role-permission-state is-allowed" title="${libelle} autorisé"><span aria-hidden="true">✓</span><small>Oui</small></span>`;
        }
        return `<span class="role-permission-state is-denied" title="${libelle} non autorisé"><span aria-hidden="true">—</span><small>Non</small></span>`;
    };

    if (tbody) {
        tbody.innerHTML = permissions.length
            ? permissions.map((p) => `
                <tr>
                    <td data-label="Module">
                        <div class="role-view-module-cell">
                            <span class="role-view-module-icon">${iconeModuleRoleParametres(p.module)}</span>
                            <strong>${echapperHtmlUtilisateur(p.libelle || p.module || "Module")}</strong>
                        </div>
                    </td>
                    <td data-label="Voir">${afficherPermission(Boolean(p.voir), "Voir")}</td>
                    <td data-label="Créer">${afficherPermission(Boolean(p.creer), "Créer")}</td>
                    <td data-label="Modifier">${afficherPermission(Boolean(p.modifier), "Modifier")}</td>
                    <td data-label="Supprimer">${afficherPermission(Boolean(p.supprimer), "Supprimer")}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="5" class="role-view-empty">Aucune autorisation enregistrée pour ce rôle.</td></tr>`;
    }

    mettreTexte("role-view-permission-count", String(totalActives));

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("settings-modal-open");
}

function iconeModuleRoleParametres(module) {
    const icones = {
        dashboard: "📊",
        clients: "👥",
        commandes: "🧾",
        ventes: "🛒",
        livraisons: "🚚",
        livreurs: "🛵",
        produits: "📦",
        stock: "🏷️",
        mouvements_stock: "🔄",
        approvisionnements: "📥",
        fournisseurs: "🏭",
        transitaires: "🌍",
        caisse: "💰",
        paiements: "💳",
        factures: "📄",
        comptabilite: "📚",
        rapports: "📈",
        parametres: "⚙️"
    };

    return icones[String(module || "").trim()] || "◻️";
}

function fermerConsultationRoleParametres() {
    const modal = document.getElementById("role-view-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("settings-modal-open");
}

function toutAutoriserRoleParametres() {
    document.querySelectorAll(".role-permission-checkbox:not(:disabled)").forEach((input) => {
        input.checked = true;
    });
}

function trouverRoleParametresGestion(idRole) {
    return rolesParametresGestion.find(
        (role) => String(role.idRole || "") === String(idRole || "")
    );
}

function afficherMessageRoles(message, type) {
    const zone = document.getElementById("roles-settings-message");
    if (!zone) return;
    zone.hidden = false;
    zone.textContent = message || "";
    zone.className = `settings-form-message ${type === "error" ? "is-error" : type === "success" ? "is-success" : "is-info"}`;
}

function masquerMessageRoles() {
    const zone = document.getElementById("roles-settings-message");
    if (!zone) return;
    zone.hidden = true;
    zone.textContent = "";
    zone.className = "settings-form-message";
}

function afficherMessageRoleForm(message, type) {
    const zone = document.getElementById("role-form-message");
    if (!zone) return;
    zone.hidden = false;
    zone.textContent = message || "";
    zone.className = `settings-form-message ${type === "error" ? "is-error" : type === "success" ? "is-success" : "is-info"}`;
}

function masquerMessageRoleForm() {
    const zone = document.getElementById("role-form-message");
    if (!zone) return;
    zone.hidden = true;
    zone.textContent = "";
    zone.className = "settings-form-message";
}

/* ===========================================================
   AUTRES SECTIONS — PAS ENCORE CONNECTÉES
=========================================================== */

function neutraliserFormulairesParametresNonConnectes() {
    document
        .querySelectorAll(".settings-form")
        .forEach((formulaire) => {
            if (["company-settings-form", "user-settings-form", "role-settings-form"].includes(formulaire.id)) return;

            formulaire.addEventListener("submit", (event) => {
                event.preventDefault();

                afficherToastParametres(
                    "Cette section sera connectée dans l'étape suivante.",
                    "info"
                );
            });
        });
}

/* ===========================================================
   OUTILS UI
=========================================================== */

function valeurParametre(id) {
    return String(
        document.getElementById(id)?.value ?? ""
    ).trim();
}

function definirValeurParametre(id, valeur) {
    const element = document.getElementById(id);

    if (element) {
        element.value =
            valeur === undefined || valeur === null
                ? ""
                : String(valeur);
    }
}

function texteParametre(valeur) {
    return String(
        valeur === undefined || valeur === null
            ? ""
            : valeur
    ).trim();
}

function definirChargementEntreprise(actif) {
    const formulaire =
        document.getElementById("company-settings-form");

    if (formulaire) {
        formulaire.classList.toggle(
            "is-loading",
            Boolean(actif)
        );

        formulaire.setAttribute(
            "aria-busy",
            String(Boolean(actif))
        );

        formulaire
            .querySelectorAll("button, input, select, textarea")
            .forEach((element) => {
                if (
                    actif &&
                    element.id !== "company-logo-preview"
                ) {
                    element.disabled = true;
                } else {
                    element.disabled = false;
                }
            });
    }
}

function afficherMessageEntreprise(message, type) {
    const zone =
        document.getElementById("company-settings-message");

    if (!zone) return;

    zone.hidden = false;
    zone.textContent = message || "";
    zone.className =
        "settings-form-message " +
        (
            type === "success"
                ? "is-success"
                : type === "error"
                    ? "is-error"
                    : "is-info"
        );
}

function masquerMessageEntreprise() {
    const zone =
        document.getElementById("company-settings-message");

    if (!zone) return;

    zone.hidden = true;
    zone.textContent = "";
    zone.className = "settings-form-message";
}

function afficherToastParametres(message, type) {
    if (typeof showToast === "function") {
        showToast(message, type || "info");
        return;
    }

    if (typeof toast === "function") {
        toast(message, type || "info");
        return;
    }

    console.log(
        `[Paramètres ${type || "info"}]`,
        message
    );
}
