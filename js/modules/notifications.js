/* ===========================================================
   VISIBL ERP — notifications.js
   Centre de notifications interne commun à toutes les pages
=========================================================== */

(function () {
    "use strict";

    let notificationsVisibl = [];
    let compteurNonLuVisibl = 0;
    let chargementNotificationsVisibl = false;

    function utilisateurNotificationsVisibl() {
        const cles = ["visibl_user", "user", "utilisateur", "currentUser", "authUser"];
        for (const cle of cles) {
            try {
                const brut = localStorage.getItem(cle);
                if (!brut) continue;
                const utilisateur = JSON.parse(brut);
                if (utilisateur && typeof utilisateur === "object") return utilisateur;
            } catch (error) {}
        }
        return null;
    }

    function idUtilisateurNotificationsVisibl() {
        const utilisateur = utilisateurNotificationsVisibl();
        return String(
            utilisateur?.idUtilisateur ||
            utilisateur?.["ID Utilisateur"] ||
            utilisateur?.id ||
            utilisateur?.userId ||
            ""
        ).trim();
    }

    function injecterStylesNotificationsVisibl() {
        if (document.getElementById("visibl-notifications-runtime-style")) return;

        const style = document.createElement("style");
        style.id = "visibl-notifications-runtime-style";
        style.textContent = `
            .notification-menu{position:relative;display:inline-flex}
            .notification-panel{position:absolute;top:calc(100% + 12px);right:0;width:min(390px,calc(100vw - 28px));max-height:min(620px,72vh);background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 22px 60px rgba(15,23,42,.18);z-index:3000;overflow:hidden}
            .notification-panel[hidden]{display:none!important}
            .notification-panel-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 12px;border-bottom:1px solid #eef2f7}
            .notification-panel-header h3{margin:0;font-size:16px;color:#0f172a}
            .notification-mark-all{border:0;background:transparent;color:#2563eb;font-size:12px;font-weight:700;cursor:pointer;padding:6px 4px}
            .notification-list{max-height:520px;overflow:auto}
            .notification-item{display:grid;grid-template-columns:10px 1fr;gap:10px;width:100%;padding:13px 16px;border:0;border-bottom:1px solid #f1f5f9;background:#fff;text-align:left;cursor:pointer}
            .notification-item:hover{background:#f8fafc}
            .notification-item.is-unread{background:#f8fbff}
            .notification-dot{width:8px;height:8px;margin-top:6px;border-radius:999px;background:#cbd5e1}
            .notification-item.is-unread .notification-dot{background:#2563eb}
            .notification-item[data-severity="critical"] .notification-dot{background:#dc2626}
            .notification-item[data-severity="warning"] .notification-dot{background:#f59e0b}
            .notification-item[data-severity="success"] .notification-dot{background:#16a34a}
            .notification-item-title{display:block;margin:0 0 4px;color:#0f172a;font-size:13px;font-weight:800;line-height:1.35}
            .notification-item-message{display:block;color:#475569;font-size:12px;line-height:1.45}
            .notification-item-time{display:block;margin-top:6px;color:#94a3b8;font-size:10px;font-weight:600}
            .notification-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:34px 22px;color:#64748b;text-align:center}
            .notification-empty-state span{font-size:28px}
            .notification-empty-state p{margin:0;font-size:12px;line-height:1.5}
            .notification-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#dc2626;color:#fff;font-size:10px;font-weight:800;line-height:18px;text-align:center;box-shadow:0 0 0 2px #fff}
            .notification-badge[hidden]{display:none!important}
            .notification-loading{padding:24px;text-align:center;color:#64748b;font-size:12px}
            .is-notification-target{outline:3px solid rgba(37,99,235,.28)!important;outline-offset:3px!important}
            @media(max-width:640px){.notification-panel{position:fixed;left:12px;right:12px;top:70px;width:auto;max-height:calc(100vh - 90px)}}
        `;
        document.head.appendChild(style);
    }

    function assurerStructurePanneauNotificationsVisibl() {
        const bouton = document.getElementById("notification-button") || document.querySelector(".icon-btn.notifications");
        if (!bouton) return null;

        bouton.id = "notification-button";
        bouton.type = "button";
        bouton.setAttribute("aria-label", "Afficher les notifications");
        bouton.setAttribute("aria-expanded", "false");

        let badge = bouton.querySelector(".notification-badge");
        if (!badge) {
            badge = document.createElement("span");
            badge.className = "notification-badge";
            bouton.appendChild(badge);
        }
        badge.hidden = true;
        badge.textContent = "0";

        let menu = bouton.closest(".notification-menu");
        if (!menu) {
            menu = document.createElement("div");
            menu.className = "notification-menu";
            bouton.parentNode.insertBefore(menu, bouton);
            menu.appendChild(bouton);
        }

        let panneau = document.getElementById("notification-panel");
        if (!panneau) {
            panneau = document.createElement("div");
            panneau.id = "notification-panel";
            panneau.className = "notification-panel";
            panneau.hidden = true;
            menu.appendChild(panneau);
        }

        return { bouton, badge, panneau, menu };
    }

    function rendrePanneauNotificationsVisibl() {
        const ui = assurerStructurePanneauNotificationsVisibl();
        if (!ui) return;

        ui.badge.textContent = compteurNonLuVisibl > 99 ? "99+" : String(compteurNonLuVisibl);
        ui.badge.hidden = compteurNonLuVisibl <= 0;

        if (!notificationsVisibl.length) {
            ui.panneau.innerHTML = `
                <div class="notification-panel-header"><h3>Notifications</h3></div>
                <div class="notification-empty-state">
                    <span aria-hidden="true">🔔</span>
                    <p>Aucune notification pour le moment.</p>
                </div>`;
            return;
        }

        ui.panneau.innerHTML = `
            <div class="notification-panel-header">
                <h3>Notifications</h3>
                <button type="button" class="notification-mark-all" id="notification-mark-all">Tout marquer comme lu</button>
            </div>
            <div class="notification-list">
                ${notificationsVisibl.map((notification) => `
                    <button
                        type="button"
                        class="notification-item ${notification.lue ? "" : "is-unread"}"
                        data-notification-id="${echapperNotificationsVisibl(notification.idNotification)}"
                        data-notification-destination="${echapperNotificationsVisibl(notification.destination || "")}"
                        data-severity="${echapperNotificationsVisibl(notification.severite || "info")}">
                        <span class="notification-dot" aria-hidden="true"></span>
                        <span>
                            <strong class="notification-item-title">${echapperNotificationsVisibl(notification.titre || "Notification")}</strong>
                            <span class="notification-item-message">${echapperNotificationsVisibl(notification.message || "")}</span>
                            <small class="notification-item-time">${echapperNotificationsVisibl(formaterDateNotificationVisibl(notification.dateCreation))}</small>
                        </span>
                    </button>`).join("")}
            </div>`;

        ui.panneau
            .querySelectorAll("[data-notification-id]")
            .forEach((element) => element.addEventListener("click", ouvrirNotificationVisibl));

        ui.panneau
            .querySelector("#notification-mark-all")
            ?.addEventListener("click", marquerToutesNotificationsVisibl);
    }

    async function chargerNotificationsVisibl() {
        if (chargementNotificationsVisibl || typeof apiGet !== "function") return;
        const idUtilisateur = idUtilisateurNotificationsVisibl();
        if (!idUtilisateur) return;

        chargementNotificationsVisibl = true;
        try {
            const resultat = await apiGet("getNotifications", {
                idUtilisateur,
                limite: 50
            });

            if (!resultat?.success) {
                throw new Error(resultat?.message || "Impossible de charger les notifications.");
            }

            notificationsVisibl = Array.isArray(resultat.notifications)
                ? resultat.notifications
                : (Array.isArray(resultat.data) ? resultat.data : []);
            compteurNonLuVisibl = Math.max(0, Number(resultat.nonLues) || 0);
            rendrePanneauNotificationsVisibl();
            traiterRapportNotificationVisibl();
        } catch (error) {
            console.warn("Notifications VISIBL :", error);
        } finally {
            chargementNotificationsVisibl = false;
        }
    }

    async function ouvrirNotificationVisibl(event) {
        const element = event.currentTarget;
        const idNotification = String(element.dataset.notificationId || "").trim();
        const destination = String(element.dataset.notificationDestination || "").trim();
        const idUtilisateur = idUtilisateurNotificationsVisibl();

        if (idNotification) {
            const notification = notificationsVisibl.find((item) => item.idNotification === idNotification);
            if (notification && !notification.lue) {
                notification.lue = true;
                compteurNonLuVisibl = Math.max(0, compteurNonLuVisibl - 1);
                rendrePanneauNotificationsVisibl();
            }

            if (typeof apiPost === "function" && idUtilisateur) {
                try {
                    await apiPost("markNotificationRead", {
                        idUtilisateur,
                        idNotification
                    });
                } catch (error) {
                    console.warn("Lecture notification non synchronisée :", error);
                }
            }
        }

        if (destination) {
            window.location.href = destination;
        }
    }

    async function marquerToutesNotificationsVisibl(event) {
        event?.stopPropagation();
        const idUtilisateur = idUtilisateurNotificationsVisibl();
        if (!idUtilisateur || typeof apiPost !== "function") return;

        notificationsVisibl = notificationsVisibl.map((item) => ({ ...item, lue: true }));
        compteurNonLuVisibl = 0;
        rendrePanneauNotificationsVisibl();

        try {
            await apiPost("markAllNotificationsRead", { idUtilisateur });
        } catch (error) {
            console.warn("Tout marquer comme lu :", error);
            chargerNotificationsVisibl();
        }
    }

    function initialiserInteractionNotificationsVisibl() {
        const ui = assurerStructurePanneauNotificationsVisibl();
        if (!ui || ui.bouton.dataset.visiblNotificationsBound === "1") return;
        ui.bouton.dataset.visiblNotificationsBound = "1";

        ui.bouton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const ouverture = ui.panneau.hidden;
            ui.panneau.hidden = !ouverture;
            ui.bouton.setAttribute("aria-expanded", String(ouverture));
            if (ouverture) chargerNotificationsVisibl();
        }, true);

        document.addEventListener("click", (event) => {
            if (!ui.menu.contains(event.target)) {
                ui.panneau.hidden = true;
                ui.bouton.setAttribute("aria-expanded", "false");
            }
        });
    }

    function formaterDateNotificationVisibl(valeur) {
        const date = new Date(valeur || "");
        if (Number.isNaN(date.getTime())) return "";
        const maintenant = new Date();
        const difference = Math.max(0, maintenant.getTime() - date.getTime());
        const minutes = Math.floor(difference / 60000);
        if (minutes < 1) return "À l'instant";
        if (minutes < 60) return `Il y a ${minutes} min`;
        const heures = Math.floor(minutes / 60);
        if (heures < 24) return `Il y a ${heures} h`;
        return date.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function echapperNotificationsVisibl(valeur) {
        return String(valeur ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }



    function traiterRapportNotificationVisibl() {
        const chemin = window.location.pathname.toLowerCase();
        if (!chemin.includes("rapports")) return;

        const params = new URLSearchParams(window.location.search);
        const periode = String(params.get("periode") || "").trim();
        const cle = String(params.get("cle") || "").trim();
        if (!periode || !cle || document.getElementById("notification-report-detail-modal")) return;

        const notification = notificationsVisibl.find((item) =>
            String(item?.type || "") === `rapport-${periode}` &&
            String(item?.idEntite || "") === cle
        );
        if (!notification) return;

        const resume = notification?.donnees?.resume || {};
        const modal = document.createElement("div");
        modal.id = "notification-report-detail-modal";
        modal.style.cssText = "position:fixed;inset:0;z-index:5000;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;padding:18px";
        modal.innerHTML = `
            <div style="width:min(680px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 28px 80px rgba(15,23,42,.25)">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px;border-bottom:1px solid #e2e8f0">
                    <div><h2 style="margin:0 0 5px;font-size:20px;color:#0f172a">${echapperNotificationsVisibl(notification.titre || "Rapport")}</h2><p style="margin:0;color:#64748b;font-size:12px">Période : ${echapperNotificationsVisibl(cle)}</p></div>
                    <button type="button" id="notification-report-close" style="border:0;background:#f1f5f9;border-radius:9px;width:36px;height:36px;cursor:pointer">✕</button>
                </div>
                <div style="padding:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
                    ${carteRapportNotificationVisibl("Chiffre d'affaires", formaterMontantRapportNotificationVisibl(resume.chiffreAffaires))}
                    ${carteRapportNotificationVisibl("Ventes", resume.ventes || 0)}
                    ${carteRapportNotificationVisibl("Commandes", resume.commandes || 0)}
                    ${carteRapportNotificationVisibl("Paiements", resume.paiements || 0)}
                    ${carteRapportNotificationVisibl("Livraisons", resume.livraisons || 0)}
                    ${carteRapportNotificationVisibl("Retours", resume.retours || 0)}
                    ${carteRapportNotificationVisibl("Stock faible", resume.stockFaible || 0)}
                    ${carteRapportNotificationVisibl("Ruptures", resume.ruptures || 0)}
                    ${carteRapportNotificationVisibl("Solde de caisse", formaterMontantRapportNotificationVisibl(resume.soldeCaisse))}
                </div>
            </div>`;
        document.body.appendChild(modal);

        const fermer = () => {
            modal.remove();
            params.delete("periode");
            params.delete("cle");
            const q = params.toString();
            window.history.replaceState({}, "", window.location.pathname + (q ? "?" + q : "") + window.location.hash);
        };
        modal.querySelector("#notification-report-close")?.addEventListener("click", fermer);
        modal.addEventListener("click", (event) => {
            if (event.target === modal) fermer();
        });
    }

    function carteRapportNotificationVisibl(libelle, valeur) {
        return `<div style="padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc"><span style="display:block;color:#64748b;font-size:11px;margin-bottom:5px">${echapperNotificationsVisibl(libelle)}</span><strong style="color:#0f172a;font-size:17px">${echapperNotificationsVisibl(valeur)}</strong></div>`;
    }

    function formaterMontantRapportNotificationVisibl(valeur) {
        const nombre = Math.round(Number(valeur) || 0);
        return nombre.toLocaleString("fr-FR") + " FCFA";
    }

    function traiterLienProfondNotificationVisibl() {
        const params = new URLSearchParams(window.location.search);
        const id = String(params.get("notificationEntity") || "").trim();
        const retour = String(params.get("notificationReturn") || "").trim();
        const compte = String(params.get("notificationAccount") || "").trim();
        if (!id && !compte) return;

        let tentatives = 0;
        const minuterie = window.setInterval(() => {
            tentatives += 1;
            let ouvert = false;
            const chemin = window.location.pathname.toLowerCase();

            try {
                if (id && chemin.includes("commandes") && typeof window.voirCommande === "function") {
                    window.voirCommande(id);
                    ouvert = true;
                } else if (id && chemin.includes("paiements")) {
                    const liste = typeof paiementsCharges !== "undefined" && Array.isArray(paiementsCharges) ? paiementsCharges : [];
                    const paiement = liste.find((item) => String(item?.idPaiement || "") === id);
                    if (paiement && typeof window.ouvrirDetailPaiement === "function") {
                        window.ouvrirDetailPaiement(paiement);
                        ouvert = true;
                    }
                } else if (id && chemin.includes("livraisons")) {
                    const liste = typeof livraisonsChargees !== "undefined" && Array.isArray(livraisonsChargees) ? livraisonsChargees : [];
                    const livraison = liste.find((item) => String(item?.idLivraison || "") === id);
                    if (livraison && typeof window.ouvrirFiche === "function") {
                        window.ouvrirFiche(livraison);
                        ouvert = true;
                    }
                } else if (id && chemin.includes("caisse")) {
                    const liste = typeof operationsCaisseChargees !== "undefined" && Array.isArray(operationsCaisseChargees) ? operationsCaisseChargees : [];
                    const operation = liste.find((item) => String(item?.idMouvement || "") === id);
                    if (operation && typeof window.ouvrirDetailCaisse === "function") {
                        window.ouvrirDetailCaisse(operation);
                        ouvert = true;
                    }
                } else if (id && chemin.includes("produits") && typeof window.ouvrirConsultationProduit === "function") {
                    const liste = typeof produits !== "undefined" && Array.isArray(produits) ? produits : [];
                    const existe = liste.some((item) => String(item?.["ID Produit"] || item?.idProduit || "") === id);
                    if (existe) {
                        window.ouvrirConsultationProduit(id);
                        ouvert = true;
                    }
                } else if (id && chemin.includes("ventes") && typeof window.voirVente === "function") {
                    if (retour && typeof window.ouvrirHistoriqueRetoursVente === "function") {
                        window.ouvrirHistoriqueRetoursVente(id);
                    } else {
                        window.voirVente(id);
                    }
                    ouvert = true;
                } else if (compte && chemin.includes("caisse")) {
                    const carte = Array.from(document.querySelectorAll("[data-account], .cash-account-card, .account-card"))
                        .find((element) => element.textContent?.includes(compte));
                    if (carte) {
                        carte.scrollIntoView({ behavior: "smooth", block: "center" });
                        carte.classList.add("is-notification-target");
                        window.setTimeout(() => carte.classList.remove("is-notification-target"), 2500);
                        ouvert = true;
                    }
                }
            } catch (error) {
                console.warn("Ouverture de la cible notification :", error);
            }

            if (ouvert || tentatives >= 20) {
                window.clearInterval(minuterie);
                if (ouvert) {
                    params.delete("notificationEntity");
                    params.delete("notificationReturn");
                    params.delete("notificationAccount");
                    const nouvelleQuery = params.toString();
                    window.history.replaceState({}, "", window.location.pathname + (nouvelleQuery ? "?" + nouvelleQuery : "") + window.location.hash);
                }
            }
        }, 500);
    }

    function initialiserNotificationsVisibl() {
        injecterStylesNotificationsVisibl();
        initialiserInteractionNotificationsVisibl();
        chargerNotificationsVisibl();
        traiterLienProfondNotificationVisibl();
        window.setInterval(chargerNotificationsVisibl, 60000);
    }

    window.visiblNotificationsRefresh = chargerNotificationsVisibl;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialiserNotificationsVisibl);
    } else {
        initialiserNotificationsVisibl();
    }
})();
