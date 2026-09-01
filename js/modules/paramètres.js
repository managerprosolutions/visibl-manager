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
    initialiserParametresVentes();
    initialiserParametresStock();
    initialiserParametresFinance();
    initialiserParametresNotifications();
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
   PARAMÈTRES > VENTES
   Le workflow métier est volontairement verrouillé.
   Seule la mention de facture est configurable ici.
=========================================================== */

let parametresVentesCharges = null;

function initialiserParametresVentes() {
    document.getElementById("sales-settings-form")?.addEventListener("submit", enregistrerParametresVentes);
    document.getElementById("reset-sales-settings-btn")?.addEventListener("click", restaurerParametresVentesCharges);
    chargerParametresVentes();
}

async function chargerParametresVentes() {
    definirChargementVentes(true);
    afficherMessageVentes("Chargement des paramètres des ventes...", "info");
    try {
        const resultat = await apiGet("getParametresVentes");
        if (!resultat?.success) throw new Error(resultat?.message || "Impossible de charger les paramètres des ventes.");
        parametresVentesCharges = normaliserParametresVentes(resultat.data || resultat.parametres || {});
        appliquerParametresVentes(parametresVentesCharges);
        masquerMessageVentes();
    } catch (error) {
        console.error("Paramètres ventes — chargement :", error);
        afficherMessageVentes(error.message || "Impossible de charger les paramètres des ventes.", "error");
    } finally { definirChargementVentes(false); }
}

async function enregistrerParametresVentes(event) {
    event.preventDefault();
    const bouton = document.getElementById("save-sales-settings-btn");
    const payload = { mentionFacture: valeurParametre("sale-invoice-message") };
    if (payload.mentionFacture.length > 500) { afficherMessageVentes("La mention ne doit pas dépasser 500 caractères.", "error"); return; }
    definirChargementVentes(true);
    if (bouton) { bouton.dataset.originalText = bouton.textContent; bouton.textContent = "Enregistrement..."; }
    afficherMessageVentes("Enregistrement en cours...", "info");
    try {
        const resultat = await apiPost("saveParametresVentes", payload);
        if (!resultat?.success) throw new Error(resultat?.message || "Impossible d'enregistrer les paramètres des ventes.");
        parametresVentesCharges = normaliserParametresVentes(resultat.data || resultat.parametres || payload);
        appliquerParametresVentes(parametresVentesCharges);
        afficherMessageVentes(resultat.message || "Les paramètres des ventes ont été enregistrés.", "success");
        afficherToastParametres("Paramètres des ventes enregistrés.", "success");
    } catch (error) {
        console.error("Paramètres ventes — enregistrement :", error);
        afficherMessageVentes(error.message || "Impossible d'enregistrer les paramètres des ventes.", "error");
    } finally {
        definirChargementVentes(false);
        if (bouton) bouton.textContent = bouton.dataset.originalText || "💾 Enregistrer";
    }
}

function appliquerParametresVentes(data) {
    definirValeurParametre("sale-invoice-message", normaliserParametresVentes(data).mentionFacture);
}

function restaurerParametresVentesCharges() {
    if (!parametresVentesCharges) { chargerParametresVentes(); return; }
    appliquerParametresVentes(parametresVentesCharges);
    masquerMessageVentes();
    afficherToastParametres("Modifications annulées.", "info");
}

function normaliserParametresVentes(data) {
    return { mentionFacture: texteParametre(data?.mentionFacture), derniereModification: texteParametre(data?.derniereModification) };
}

function caseParametreCochee(id) {
    return document.getElementById(id)?.checked === true;
}

function definirCaseParametre(id, valeur) {
    const element = document.getElementById(id);
    if (element) element.checked = valeur === true;
}

function booleenParametreVentes(valeur, defaut) {
    if (valeur === true || valeur === false) return valeur;
    const texte = String(valeur ?? "").trim().toLowerCase();
    if (["true", "1", "oui", "yes", "x"].includes(texte)) return true;
    if (["false", "0", "non", "no"].includes(texte)) return false;
    return defaut === true;
}

function nombreParametreVentes(valeur, defaut) {
    const nombre = Number(valeur);
    return Number.isFinite(nombre) ? nombre : defaut;
}

function actualiserEtatRemiseParametresVentes() {
    const autorisee = caseParametreCochee("sale-allow-discount");
    const groupe = document.getElementById("sale-max-discount-group");
    const champ = document.getElementById("sale-max-discount");

    if (groupe) groupe.classList.toggle("is-disabled", !autorisee);
    if (champ) champ.disabled = !autorisee;
}

function definirChargementVentes(actif) {
    const formulaire = document.getElementById("sales-settings-form");
    if (!formulaire) return;

    formulaire.classList.toggle("is-loading", Boolean(actif));
    formulaire.setAttribute("aria-busy", String(Boolean(actif)));

    formulaire.querySelectorAll("button, input, textarea").forEach((element) => {
        if (actif) {
            element.dataset.ventesEtatDesactive = element.disabled ? "1" : "0";
            element.disabled = true;
        } else {
            const etaitDesactive = element.dataset.ventesEtatDesactive === "1";
            delete element.dataset.ventesEtatDesactive;
            if (!etaitDesactive) element.disabled = false;
        }
    });

    if (!actif) actualiserEtatRemiseParametresVentes();
}

function afficherMessageVentes(message, type) {
    const zone = document.getElementById("sales-settings-message");
    if (!zone) return;

    zone.hidden = false;
    zone.textContent = message || "";
    zone.className = `settings-form-message ${type === "error" ? "is-error" : type === "success" ? "is-success" : "is-info"}`;
}

function masquerMessageVentes() {
    const zone = document.getElementById("sales-settings-message");
    if (!zone) return;
    zone.hidden = true;
    zone.textContent = "";
    zone.className = "settings-form-message";
}

/* ===========================================================
   PARAMÈTRES > STOCK
=========================================================== */
let parametresStockCharges = null;

function initialiserParametresStock() {
    document.getElementById("stock-settings-form")?.addEventListener("submit", enregistrerParametresStock);
    document.getElementById("reset-stock-settings-btn")?.addEventListener("click", restaurerParametresStockCharges);
    chargerParametresStock();
}

async function chargerParametresStock() {
    definirChargementStock(true);
    afficherMessageStock("Chargement des paramètres du stock...", "info");
    try {
        const resultat = await apiGet("getParametresStock");
        if (!resultat?.success) throw new Error(resultat?.message || "Impossible de charger les paramètres du stock.");
        parametresStockCharges = normaliserParametresStock(resultat.data || resultat.parametres || {});
        appliquerParametresStock(parametresStockCharges);
        masquerMessageStock();
    } catch (error) {
        console.error("Paramètres stock — chargement :", error);
        afficherMessageStock(error.message || "Impossible de charger les paramètres du stock.", "error");
    } finally { definirChargementStock(false); }
}

async function enregistrerParametresStock(event) {
    event.preventDefault();
    const bouton = document.getElementById("save-stock-settings-btn");
    const payload = {
        alertesStockFaible: caseParametreCochee("stock-low-alert-enabled"),
        seuilAlerteDefaut: Math.max(0, Math.trunc(Number(valeurParametre("default-stock-threshold")) || 0)),
        alerteRupture: caseParametreCochee("stock-out-alert-enabled"),
        autoriserCommandeStockInsuffisant: caseParametreCochee("stock-allow-pending-insufficient"),
        exigerMotifAjustement: caseParametreCochee("stock-require-adjustment-reason")
    };
    definirChargementStock(true);
    if (bouton) { bouton.dataset.originalText = bouton.textContent; bouton.textContent = "Enregistrement..."; }
    afficherMessageStock("Enregistrement en cours...", "info");
    try {
        const resultat = await apiPost("saveParametresStock", payload);
        if (!resultat?.success) throw new Error(resultat?.message || "Impossible d'enregistrer les paramètres du stock.");
        parametresStockCharges = normaliserParametresStock(resultat.data || resultat.parametres || payload);
        appliquerParametresStock(parametresStockCharges);
        afficherMessageStock(resultat.message || "Les paramètres du stock ont été enregistrés.", "success");
        afficherToastParametres("Paramètres du stock enregistrés.", "success");
    } catch (error) {
        console.error("Paramètres stock — enregistrement :", error);
        afficherMessageStock(error.message || "Impossible d'enregistrer les paramètres du stock.", "error");
    } finally {
        definirChargementStock(false);
        if (bouton) bouton.textContent = bouton.dataset.originalText || "💾 Enregistrer";
    }
}

function normaliserParametresStock(data) {
    return {
        alertesStockFaible: booleenParametreVentes(data?.alertesStockFaible, true),
        seuilAlerteDefaut: Math.max(0, Math.trunc(nombreParametreVentes(data?.seuilAlerteDefaut, 5))),
        alerteRupture: booleenParametreVentes(data?.alerteRupture, true),
        autoriserCommandeStockInsuffisant: booleenParametreVentes(data?.autoriserCommandeStockInsuffisant, false),
        exigerMotifAjustement: booleenParametreVentes(data?.exigerMotifAjustement, true),
        derniereModification: texteParametre(data?.derniereModification)
    };
}
function appliquerParametresStock(data) {
    const p = normaliserParametresStock(data);
    definirValeurParametre("default-stock-threshold", p.seuilAlerteDefaut);
    definirCaseParametre("stock-low-alert-enabled", p.alertesStockFaible);
    definirCaseParametre("stock-out-alert-enabled", p.alerteRupture);
    definirCaseParametre("stock-allow-pending-insufficient", p.autoriserCommandeStockInsuffisant);
    definirCaseParametre("stock-require-adjustment-reason", p.exigerMotifAjustement);
}
function restaurerParametresStockCharges() {
    if (!parametresStockCharges) { chargerParametresStock(); return; }
    appliquerParametresStock(parametresStockCharges); masquerMessageStock(); afficherToastParametres("Modifications annulées.", "info");
}
function definirChargementStock(actif) {
    const formulaire=document.getElementById("stock-settings-form"); if(!formulaire)return;
    formulaire.classList.toggle("is-loading",Boolean(actif)); formulaire.setAttribute("aria-busy",String(Boolean(actif)));
    formulaire.querySelectorAll("button, input").forEach(el=>{ if(el.readOnly)return; if(actif){el.dataset.stockEtatDesactive=el.disabled?"1":"0";el.disabled=true;}else{const d=el.dataset.stockEtatDesactive==="1";delete el.dataset.stockEtatDesactive;if(!d)el.disabled=false;} });
}
function afficherMessageStock(message,type){const z=document.getElementById("stock-settings-message");if(!z)return;z.hidden=false;z.textContent=message||"";z.className=`settings-form-message ${type==="error"?"is-error":type==="success"?"is-success":"is-info"}`;}
function masquerMessageStock(){const z=document.getElementById("stock-settings-message");if(!z)return;z.hidden=true;z.textContent="";z.className="settings-form-message";}


/* ===========================================================
   PARAMÈTRES > FINANCE — DYNAMIQUE
=========================================================== */
let parametresFinanceCharges = null;
let comptesFinanceEdition = [];
let modesFinanceEdition = [];

function slugFinanceFront(v){return texteParametre(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}
function comptesFinanceDefautFront(){return [{id:"caisse-principale",libelle:"Caisse principale",type:"especes",actif:true},{id:"banque",libelle:"Banque",type:"banque",actif:true},{id:"wave-business",libelle:"Wave Business",type:"mobile-money",actif:true},{id:"orange-money-business",libelle:"Orange Money Business",type:"mobile-money",actif:true}];}
function modesFinanceDefautFront(){return [{id:"especes",libelle:"Espèces",groupe:"especes",compteId:"caisse-principale",actif:true},{id:"wave",libelle:"Wave",groupe:"mobile-money",compteId:"wave-business",actif:true},{id:"orange-money",libelle:"Orange Money",groupe:"mobile-money",compteId:"orange-money-business",actif:true},{id:"virement",libelle:"Virement bancaire",groupe:"virement",compteId:"banque",actif:true},{id:"cheque",libelle:"Chèque",groupe:"cheque",compteId:"banque",actif:true},{id:"carte-bancaire",libelle:"Carte bancaire",groupe:"carte-bancaire",compteId:"banque",actif:true}];}

function initialiserParametresFinance() {
    document.getElementById("finance-settings-form")?.addEventListener("submit", enregistrerParametresFinance);
    document.getElementById("reset-finance-settings-btn")?.addEventListener("click", restaurerParametresFinanceCharges);
    document.getElementById("finance-add-account-btn")?.addEventListener("click",()=>{comptesFinanceEdition.push({id:"",libelle:"",type:"autre",actif:true});rendreComptesFinance();});
    document.getElementById("finance-add-method-btn")?.addEventListener("click",()=>{modesFinanceEdition.push({id:"",libelle:"",groupe:"autre",compteId:comptesFinanceEdition.find(c=>c.actif)?.id||"",actif:true});rendreModesFinance();});
    chargerParametresFinance();
}

async function chargerParametresFinance() {
    definirChargementFinance(true); afficherMessageFinance("Chargement des paramètres financiers...", "info");
    try { const resultat=await apiGet("getParametresFinance"); if(!resultat?.success)throw new Error(resultat?.message||"Impossible de charger les paramètres financiers."); parametresFinanceCharges=normaliserParametresFinance(resultat.data||resultat.parametres||{}); appliquerParametresFinance(parametresFinanceCharges); masquerMessageFinance(); }
    catch(error){console.error("Paramètres finance — chargement :",error);afficherMessageFinance(error.message||"Impossible de charger les paramètres financiers.","error");}
    finally{definirChargementFinance(false);}
}

function normaliserParametresFinance(data) {
    const devise=texteParametre(data?.devise||data?.codeDevise||"XOF").toUpperCase()||"XOF";
    const comptes=Array.isArray(data?.comptesFinanciers)&&data.comptesFinanciers.length?data.comptesFinanciers:comptesFinanceDefautFront();
    const modes=Array.isArray(data?.modesPaiement)&&data.modesPaiement.length?data.modesPaiement:modesFinanceDefautFront();
    return {devise,libelleDevise:texteParametre(data?.libelleDevise)||(devise==="XOF"?"FCFA":devise),formatMontant:texteParametre(data?.formatMontant)==="devise-nombre"?"devise-nombre":"nombre-devise",nombreDecimales:Number(data?.nombreDecimales)===2?2:0,autoriserPaiementsPartiels:booleenParametreVentes(data?.autoriserPaiementsPartiels,true),autoriserVentesCredit:booleenParametreVentes(data?.autoriserVentesCredit,true),comptesFinanciers:comptes.map(c=>({...c,actif:c.actif!==false})),modesPaiement:modes.map(m=>({...m,actif:m.actif!==false})),derniereModification:texteParametre(data?.derniereModification)};
}

function appliquerParametresFinance(data){const p=normaliserParametresFinance(data);definirValeurParametre("finance-currency",`${p.devise} — ${p.libelleDevise}`);definirValeurParametre("finance-amount-format",p.formatMontant);definirValeurParametre("finance-decimals",p.nombreDecimales);definirCaseParametre("finance-allow-partial-payments",p.autoriserPaiementsPartiels);definirCaseParametre("finance-allow-credit-sales",p.autoriserVentesCredit);comptesFinanceEdition=p.comptesFinanciers.map(x=>({...x}));modesFinanceEdition=p.modesPaiement.map(x=>({...x}));rendreComptesFinance();rendreModesFinance();}

function echapperFinance(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function rendreComptesFinance(){const z=document.getElementById("finance-accounts-list");if(!z)return;z.innerHTML=comptesFinanceEdition.map((c,i)=>`<div class="finance-dynamic-row" data-fin-account="${i}"><input class="finance-account-label" value="${echapperFinance(c.libelle)}" placeholder="Nom du compte"><select class="finance-account-type"><option value="especes">Espèces</option><option value="banque">Banque</option><option value="mobile-money">Mobile Money</option><option value="autre">Autre</option></select><label class="finance-mini-switch"><input type="checkbox" class="finance-account-active" ${c.actif!==false?"checked":""}><span>Actif</span></label><button type="button" class="finance-remove-btn" aria-label="Supprimer">✕</button></div>`).join("");z.querySelectorAll("[data-fin-account]").forEach(row=>{const i=Number(row.dataset.finAccount),c=comptesFinanceEdition[i];row.querySelector(".finance-account-type").value=c.type||"autre";row.querySelector(".finance-account-label").addEventListener("input",e=>{c.libelle=e.target.value;if(!c.id)c.id=slugFinanceFront(e.target.value);rendreModesFinance();});row.querySelector(".finance-account-type").addEventListener("change",e=>c.type=e.target.value);row.querySelector(".finance-account-active").addEventListener("change",e=>{c.actif=e.target.checked;rendreModesFinance();});row.querySelector(".finance-remove-btn").addEventListener("click",()=>{if(comptesFinanceEdition.length<=1)return afficherMessageFinance("Au moins un compte financier est requis.","error");const id=c.id;comptesFinanceEdition.splice(i,1);modesFinanceEdition.forEach(m=>{if(m.compteId===id)m.compteId="";});rendreComptesFinance();rendreModesFinance();});});}
function rendreModesFinance(){const z=document.getElementById("finance-methods-list");if(!z)return;const options=comptesFinanceEdition.map(c=>`<option value="${echapperFinance(c.id||slugFinanceFront(c.libelle))}" ${c.actif===false?"disabled":""}>${echapperFinance(c.libelle||"Compte sans nom")}${c.actif===false?" — inactif":""}</option>`).join("");z.innerHTML=modesFinanceEdition.map((m,i)=>`<div class="finance-dynamic-row finance-method-row" data-fin-method="${i}"><input class="finance-method-label" value="${echapperFinance(m.libelle)}" placeholder="Nom du mode"><select class="finance-method-group"><option value="especes">Espèces</option><option value="mobile-money">Mobile Money</option><option value="virement">Virement</option><option value="cheque">Chèque</option><option value="carte-bancaire">Carte bancaire</option><option value="autre">Autre</option></select><select class="finance-method-account"><option value="">Compte associé</option>${options}</select><label class="finance-mini-switch"><input type="checkbox" class="finance-method-active" ${m.actif!==false?"checked":""}><span>Actif</span></label><button type="button" class="finance-remove-btn" aria-label="Supprimer">✕</button></div>`).join("");z.querySelectorAll("[data-fin-method]").forEach(row=>{const i=Number(row.dataset.finMethod),m=modesFinanceEdition[i];row.querySelector(".finance-method-group").value=m.groupe||"autre";row.querySelector(".finance-method-account").value=m.compteId||"";row.querySelector(".finance-method-label").addEventListener("input",e=>{m.libelle=e.target.value;if(!m.id)m.id=slugFinanceFront(e.target.value);});row.querySelector(".finance-method-group").addEventListener("change",e=>m.groupe=e.target.value);row.querySelector(".finance-method-account").addEventListener("change",e=>m.compteId=e.target.value);row.querySelector(".finance-method-active").addEventListener("change",e=>m.actif=e.target.checked);row.querySelector(".finance-remove-btn").addEventListener("click",()=>{if(modesFinanceEdition.length<=1)return afficherMessageFinance("Au moins un mode de paiement est requis.","error");modesFinanceEdition.splice(i,1);rendreModesFinance();});});}

function collecterFinanceDynamique(){const comptes=comptesFinanceEdition.map((c,i)=>{const libelle=texteParametre(c.libelle);return{id:slugFinanceFront(c.id||libelle)||`compte-${i+1}`,libelle,type:c.type||"autre",actif:c.actif!==false};});const ids=new Set();for(const c of comptes){if(!c.libelle)throw new Error("Chaque compte financier doit avoir un nom.");if(ids.has(c.id))throw new Error("Deux comptes financiers ont le même identifiant.");ids.add(c.id);}const modes=modesFinanceEdition.map((m,i)=>{const libelle=texteParametre(m.libelle);return{id:slugFinanceFront(m.id||libelle)||`mode-${i+1}`,libelle,groupe:m.groupe||"autre",compteId:m.compteId||"",actif:m.actif!==false};});const mids=new Set();for(const m of modes){if(!m.libelle)throw new Error("Chaque mode de paiement doit avoir un nom.");if(mids.has(m.id))throw new Error("Deux modes de paiement ont le même identifiant.");mids.add(m.id);if(m.actif&&!m.compteId)throw new Error(`Le mode « ${m.libelle} » doit être lié à un compte.`);}return{comptes,modes};}

async function enregistrerParametresFinance(event){event.preventDefault();const bouton=document.getElementById("save-finance-settings-btn");try{const dyn=collecterFinanceDynamique();const payload={formatMontant:valeurParametre("finance-amount-format")||"nombre-devise",nombreDecimales:Number(valeurParametre("finance-decimals"))===2?2:0,autoriserPaiementsPartiels:caseParametreCochee("finance-allow-partial-payments"),autoriserVentesCredit:caseParametreCochee("finance-allow-credit-sales"),comptesFinanciers:dyn.comptes,modesPaiement:dyn.modes};if(!dyn.modes.some(m=>m.actif))throw new Error("Activez au moins un mode de paiement.");definirChargementFinance(true);if(bouton){bouton.dataset.originalText=bouton.textContent;bouton.textContent="Enregistrement...";}afficherMessageFinance("Enregistrement en cours...","info");const resultat=await apiPost("saveParametresFinance",payload);if(!resultat?.success)throw new Error(resultat?.message||"Impossible d'enregistrer les paramètres financiers.");parametresFinanceCharges=normaliserParametresFinance(resultat.data||resultat.parametres||payload);appliquerParametresFinance(parametresFinanceCharges);afficherMessageFinance(resultat.message||"Les paramètres financiers ont été enregistrés.","success");afficherToastParametres("Paramètres financiers enregistrés.","success");}catch(error){console.error("Paramètres finance — enregistrement :",error);afficherMessageFinance(error.message||"Impossible d'enregistrer les paramètres financiers.","error");}finally{definirChargementFinance(false);if(bouton)bouton.textContent=bouton.dataset.originalText||"💾 Enregistrer";}}
function restaurerParametresFinanceCharges(){if(!parametresFinanceCharges)return chargerParametresFinance();appliquerParametresFinance(parametresFinanceCharges);masquerMessageFinance();afficherToastParametres("Modifications annulées.","info");}
function definirChargementFinance(actif){const f=document.getElementById("finance-settings-form");if(!f)return;f.classList.toggle("is-loading",Boolean(actif));f.setAttribute("aria-busy",String(Boolean(actif)));f.querySelectorAll("button,input:not([readonly]),select").forEach(el=>{if(actif){el.dataset.financeEtatDesactive=el.disabled?"1":"0";el.disabled=true;}else{const d=el.dataset.financeEtatDesactive==="1";delete el.dataset.financeEtatDesactive;if(!d)el.disabled=false;}});}
function afficherMessageFinance(message,type){const z=document.getElementById("finance-settings-message");if(!z)return;z.hidden=false;z.textContent=message||"";z.className=`settings-form-message ${type==="error"?"is-error":type==="success"?"is-success":"is-info"}`;}
function masquerMessageFinance(){const z=document.getElementById("finance-settings-message");if(!z)return;z.hidden=true;z.textContent="";z.className="settings-form-message";}

/* ===========================================================
   AUTRES SECTIONS — PAS ENCORE CONNECTÉES
=========================================================== */

function neutraliserFormulairesParametresNonConnectes() {
    document
        .querySelectorAll(".settings-form")
        .forEach((formulaire) => {
            if (["company-settings-form", "user-settings-form", "role-settings-form", "sales-settings-form", "stock-settings-form", "finance-settings-form", "notifications-settings-form"].includes(formulaire.id)) return;

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
   NOTIFICATIONS
=========================================================== */

let parametresNotificationsCharges = null;
let comptesFinanceNotifications = [];

function initialiserParametresNotifications() {
    document
        .getElementById("notifications-settings-form")
        ?.addEventListener("submit", enregistrerParametresNotifications);

    document
        .getElementById("disable-all-notifications-btn")
        ?.addEventListener("click", desactiverToutesNotifications);

    document
        .getElementById("reset-notifications-settings-btn")
        ?.addEventListener("click", restaurerParametresNotificationsCharges);

    chargerParametresNotifications();
}

async function chargerParametresNotifications() {
    definirChargementNotifications(true);
    afficherMessageNotifications("Chargement des paramètres de notifications...", "info");

    try {
        const [resultatNotifications, resultatFinance] = await Promise.all([
            apiGet("getParametresNotifications"),
            apiGet("getParametresFinance").catch(() => null)
        ]);

        if (!resultatNotifications?.success) {
            throw new Error(
                resultatNotifications?.message ||
                "Impossible de charger les paramètres de notifications."
            );
        }

        const finance = resultatFinance?.success
            ? (resultatFinance.data || resultatFinance.parametres || {})
            : {};

        comptesFinanceNotifications = Array.isArray(finance.comptesFinanciers)
            ? finance.comptesFinanciers.filter((compte) => compte && compte.actif !== false)
            : [];

        parametresNotificationsCharges = normaliserParametresNotifications(
            resultatNotifications.data || resultatNotifications.parametres || {}
        );

        appliquerParametresNotifications(parametresNotificationsCharges);
        masquerMessageNotifications();
    } catch (error) {
        console.error("Paramètres notifications — chargement :", error);
        afficherMessageNotifications(
            error.message || "Impossible de charger les paramètres de notifications.",
            "error"
        );
    } finally {
        definirChargementNotifications(false);
    }
}

function normaliserParametresNotifications(data) {
    data = data || {};
    return {
        nouvelleCommande: data.nouvelleCommande !== false,
        commandeConfirmee: data.commandeConfirmee !== false,
        commandeAnnulee: data.commandeAnnulee !== false,
        paiementRecu: data.paiementRecu !== false,
        stockFaible: data.stockFaible !== false,
        ruptureStock: data.ruptureStock !== false,
        retardLivraison: data.retardLivraison !== false,
        livraisonAPreparer: data.livraisonAPreparer !== false,
        livraisonPretePourDepart: data.livraisonPretePourDepart !== false,
        livraisonEnCours: data.livraisonEnCours !== false,
        livraisonEffectuee: data.livraisonEffectuee !== false,
        livraisonNonLivree: data.livraisonNonLivree !== false,
        livraisonReportee: data.livraisonReportee !== false,
        retourProduit: data.retourProduit !== false,
        mouvementCaisseImportant: data.mouvementCaisseImportant !== false,
        soldeCaisseFaible: data.soldeCaisseFaible !== false,
        rapportJournalier: data.rapportJournalier === true,
        rapportHebdomadaire: data.rapportHebdomadaire === true,
        rapportMensuel: data.rapportMensuel === true,
        seuilMouvementCaisseImportant: Math.max(0, Number(data.seuilMouvementCaisseImportant) || 0),
        seuilsSoldeCaisse: data.seuilsSoldeCaisse && typeof data.seuilsSoldeCaisse === "object"
            ? { ...data.seuilsSoldeCaisse }
            : {}
    };
}

function appliquerParametresNotifications(data) {
    const p = normaliserParametresNotifications(data);

    definirCaseParametre("notification-new-order", p.nouvelleCommande);
    definirCaseParametre("notification-order-confirmed", p.commandeConfirmee);
    definirCaseParametre("notification-order-cancelled", p.commandeAnnulee);
    definirCaseParametre("notification-payment-received", p.paiementRecu);
    definirCaseParametre("notification-low-stock", p.stockFaible);
    definirCaseParametre("notification-out-stock", p.ruptureStock);
    definirCaseParametre("notification-delivery-late", p.retardLivraison);
    definirCaseParametre("notification-delivery-to-prepare", p.livraisonAPreparer);
    definirCaseParametre("notification-delivery-ready", p.livraisonPretePourDepart);
    definirCaseParametre("notification-delivery-in-progress", p.livraisonEnCours);
    definirCaseParametre("notification-delivery-done", p.livraisonEffectuee);
    definirCaseParametre("notification-delivery-not-delivered", p.livraisonNonLivree);
    definirCaseParametre("notification-delivery-postponed", p.livraisonReportee);
    definirCaseParametre("notification-product-return", p.retourProduit);
    definirCaseParametre("notification-cash-important", p.mouvementCaisseImportant);
    definirCaseParametre("notification-cash-low", p.soldeCaisseFaible);
    definirCaseParametre("notification-daily-report", p.rapportJournalier);
    definirCaseParametre("notification-weekly-report", p.rapportHebdomadaire);
    definirCaseParametre("notification-monthly-report", p.rapportMensuel);
    definirValeurParametre(
        "notification-important-cash-threshold",
        p.seuilMouvementCaisseImportant || 500000
    );

    rendreSeuilsComptesNotifications(p.seuilsSoldeCaisse);
}

function rendreSeuilsComptesNotifications(seuils) {
    const conteneur = document.getElementById("notification-account-thresholds");
    if (!conteneur) return;

    const comptes = comptesFinanceNotifications.length
        ? comptesFinanceNotifications
        : [
            { libelle: "Caisse principale", actif: true },
            { libelle: "Banque", actif: true },
            { libelle: "Wave Business", actif: true },
            { libelle: "Orange Money Business", actif: true }
        ];

    conteneur.innerHTML = comptes.map((compte) => {
        const libelle = texteParametre(compte.libelle || compte.nom || compte.label);
        if (!libelle) return "";
        const valeur = Math.max(0, Number(seuils?.[libelle]) || 0);
        return `
            <div class="notification-account-threshold-row" data-notification-account="${echapperHtmlNotifications(libelle)}">
                <div>
                    <strong>${echapperHtmlNotifications(libelle)}</strong>
                    <span>Alerter lorsque le solde atteint ou passe sous ce montant.</span>
                </div>
                <div class="settings-money-input notification-account-threshold-input">
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value="${valeur}"
                        data-notification-account-threshold="${echapperHtmlNotifications(libelle)}"
                    >
                    <span>FCFA</span>
                </div>
            </div>`;
    }).join("");
}

async function enregistrerParametresNotifications(event) {
    event.preventDefault();
    const bouton = document.getElementById("save-notifications-settings-btn");

    try {
        const payload = lireParametresNotificationsFormulaire();
        definirChargementNotifications(true);

        if (bouton) {
            bouton.dataset.originalText = bouton.textContent;
            bouton.textContent = "Enregistrement...";
        }

        afficherMessageNotifications("Enregistrement en cours...", "info");

        const resultat = await apiPost("saveParametresNotifications", payload);
        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer les paramètres de notifications."
            );
        }

        parametresNotificationsCharges = normaliserParametresNotifications(
            resultat.data || resultat.parametres || payload
        );
        appliquerParametresNotifications(parametresNotificationsCharges);
        afficherMessageNotifications(
            resultat.message || "Paramètres de notifications enregistrés.",
            "success"
        );
        afficherToastParametres("Paramètres de notifications enregistrés.", "success");

        if (typeof window.visiblNotificationsRefresh === "function") {
            window.visiblNotificationsRefresh();
        }
    } catch (error) {
        console.error("Paramètres notifications — enregistrement :", error);
        afficherMessageNotifications(
            error.message || "Impossible d'enregistrer les paramètres de notifications.",
            "error"
        );
    } finally {
        definirChargementNotifications(false);
        if (bouton) {
            bouton.textContent = bouton.dataset.originalText || "💾 Enregistrer";
        }
    }
}

function lireParametresNotificationsFormulaire() {
    const seuilsSoldeCaisse = {};
    document
        .querySelectorAll("[data-notification-account-threshold]")
        .forEach((input) => {
            const compte = texteParametre(input.dataset.notificationAccountThreshold);
            if (compte) {
                seuilsSoldeCaisse[compte] = Math.max(0, Number(input.value) || 0);
            }
        });

    return {
        nouvelleCommande: caseParametreCochee("notification-new-order"),
        commandeConfirmee: caseParametreCochee("notification-order-confirmed"),
        commandeAnnulee: caseParametreCochee("notification-order-cancelled"),
        paiementRecu: caseParametreCochee("notification-payment-received"),
        stockFaible: caseParametreCochee("notification-low-stock"),
        ruptureStock: caseParametreCochee("notification-out-stock"),
        retardLivraison: caseParametreCochee("notification-delivery-late"),
        livraisonAPreparer: caseParametreCochee("notification-delivery-to-prepare"),
        livraisonPretePourDepart: caseParametreCochee("notification-delivery-ready"),
        livraisonEnCours: caseParametreCochee("notification-delivery-in-progress"),
        livraisonEffectuee: caseParametreCochee("notification-delivery-done"),
        livraisonNonLivree: caseParametreCochee("notification-delivery-not-delivered"),
        livraisonReportee: caseParametreCochee("notification-delivery-postponed"),
        retourProduit: caseParametreCochee("notification-product-return"),
        mouvementCaisseImportant: caseParametreCochee("notification-cash-important"),
        soldeCaisseFaible: caseParametreCochee("notification-cash-low"),
        rapportJournalier: caseParametreCochee("notification-daily-report"),
        rapportHebdomadaire: caseParametreCochee("notification-weekly-report"),
        rapportMensuel: caseParametreCochee("notification-monthly-report"),
        seuilMouvementCaisseImportant: Math.max(
            0,
            Number(valeurParametre("notification-important-cash-threshold")) || 0
        ),
        seuilsSoldeCaisse
    };
}

function desactiverToutesNotifications() {
    document
        .querySelectorAll("#notifications-settings .settings-switch-input")
        .forEach((input) => {
            input.checked = false;
        });

    afficherToastParametres(
        "Toutes les notifications ont été désactivées dans le formulaire. Enregistrez pour confirmer.",
        "info"
    );
}

function restaurerParametresNotificationsCharges() {
    if (!parametresNotificationsCharges) {
        chargerParametresNotifications();
        return;
    }

    appliquerParametresNotifications(parametresNotificationsCharges);
    masquerMessageNotifications();
    afficherToastParametres("Modifications des notifications annulées.", "info");
}

function definirChargementNotifications(actif) {
    const formulaire = document.getElementById("notifications-settings-form");
    if (!formulaire) return;

    formulaire.classList.toggle("is-loading", Boolean(actif));
    formulaire.setAttribute("aria-busy", String(Boolean(actif)));
    formulaire
        .querySelectorAll("button, input, select, textarea")
        .forEach((element) => {
            element.disabled = Boolean(actif);
        });
}

function afficherMessageNotifications(message, type) {
    const zone = document.getElementById("notifications-settings-message");
    if (!zone) return;

    zone.hidden = false;
    zone.textContent = message || "";
    zone.className =
        "settings-form-message " +
        (type === "success" ? "is-success" : type === "error" ? "is-error" : "is-info");
}

function masquerMessageNotifications() {
    const zone = document.getElementById("notifications-settings-message");
    if (!zone) return;
    zone.hidden = true;
    zone.textContent = "";
    zone.className = "settings-form-message";
}

function echapperHtmlNotifications(valeur) {
    return String(valeur ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
