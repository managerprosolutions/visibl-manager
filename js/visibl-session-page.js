(() => {
    if (typeof verifierSessionVisibl !== "function" || typeof apiPost !== "function") return;
    const status = document.getElementById("visibl-session-status");
    const template = document.getElementById("visibl-private-content");
    const retry = document.getElementById("visibl-session-retry");
    const notice = document.getElementById("visibl-session-message");
    let checking = false;
    let confirmedAt = 0;
    let candidate = null;
    let terminerPresentation;
    document.documentElement.setAttribute("data-visibl-session-started", "");

    function afficherErreur(demarrage, erreur) {
        let message = "Impossible de vérifier votre session. Vérifiez votre connexion et réessayez.";
        if (demarrage) {
            message = "Votre session est confirmée, mais le module n’a pas pu démarrer. Réessayez.";
        } else if (erreur?.name === "TimeoutError") {
            message = "Le serveur de session n’a pas répondu à temps. Réessayez.";
        } else if (erreur?.name === "SyntaxError") {
            message = "Le serveur de session a renvoyé une réponse illisible. Réessayez.";
        }
        notice.textContent = message;
        retry.hidden = false;
        status.setAttribute("aria-busy", "false");
    }

    function executerScript(original) {
        const script = document.createElement("script");
        if (!original.hasAttribute("src")) {
            script.textContent = original.textContent;
            document.body.appendChild(script);
            return Promise.resolve();
        }
        script.src = original.src;
        return new Promise((resolve, reject) => {
            const distant = new URL(script.src).origin !== location.origin;
            const timer = setTimeout(() => {
                script.remove();
                if (distant) resolve();
                else reject(Error("Un composant de VISIBL ne répond pas."));
            }, distant ? 3000 : 12000);
            script.onload = () => {
                clearTimeout(timer);
                resolve();
            };
            script.onerror = () => {
                clearTimeout(timer);
                if (distant) resolve();
                else reject(Error("Un composant de VISIBL est indisponible."));
            };
            document.body.appendChild(script);
        });
    }

    async function demarrerModule(verified, initial) {
        const content = template.content;
        const scripts = [...content.querySelectorAll("script")];
        const optional = scripts.filter(script => script.hasAttribute("data-visibl-optional"));
        const required = scripts.filter(script => !optional.includes(script));
        const deferred = required.filter(script => script.hasAttribute("defer"));
        scripts.forEach(script => script.remove());
        document.body.appendChild(content);
        template.remove();
        confirmerSessionVisibl(verified);
        let startupError;
        const onError = event => { if (event.message) startupError = true; };
        window.addEventListener("error", onError);
        try {
            for (const script of [...required.filter(script => !script.hasAttribute("defer")), ...deferred]) {
                if (!memeSessionVisibl(initial, lireSessionVisibl()) || !isAuthenticated()) return;
                await executerScript(script);
                if (startupError) throw new Error("Erreur de démarrage du module.");
            }
            if (!memeSessionVisibl(initial, lireSessionVisibl()) || !isAuthenticated()) return;
            appliquerNavigationUtilisateur();
            // Les modules historiques attendent cet événement pour initialiser leurs formulaires.
            document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
            window.dispatchEvent(new CustomEvent(VISIBL_PERMISSION_EVENT, { detail: {
                user: verified, permissions: verified.permissions
            } }));
            if (startupError) throw new Error("Erreur d’initialisation du module.");
            terminerPresentation?.();
            terminerPresentation = undefined;
            confirmedAt = Date.now();
            document.documentElement.removeAttribute("data-visibl-session-locked");
        } finally {
            window.removeEventListener("error", onError);
        }
        for (const script of optional) {
            void executerScript(script).then(() => {
                if (isAuthenticated()) window.dispatchEvent(new Event("visibl:optional-script-ready"));
            }).catch(() => {});
        }
    }

    async function verifierAcces() {
        if (checking) return;
        const initial = lireSessionVisibl();
        candidate = initial;
        if (!initial) {
            terminerSessionVisibl();
            return;
        }
        checking = true;
        notice.textContent = "";
        status.setAttribute("aria-busy", "true");
        retry.hidden = true;
        try {
            const dashboardLoader = document.getElementById("dashboard-loader");
            if (dashboardLoader) {
                dashboardLoader.classList.remove("is-hidden");
                dashboardLoader.setAttribute("aria-busy", "true");
            } else {
                terminerPresentation = window.VisiblLoading?.preparerOuverture(document.title.split(" | ")[0].trim());
            }
            // apiPost impose l’échéance de la requête, y compris la lecture de la réponse.
            const verified = await verifierSessionVisibl(initial);
            if (!memeSessionVisibl(initial, lireSessionVisibl())) {
                terminerSessionVisibl({ effacerSession: false });
                return;
            }
            const page = decodeURIComponent(location.pathname.split("/").pop());
            const module = VISIBL_AUTH_PAGE_MODULE_MAP[page];
            const destination = getFirstAuthorizedPageFromStoredUser(verified);
            if (!Object.hasOwn(VISIBL_AUTH_PAGE_MODULE_MAP, page) ||
                (module ? !autorisationVisibl(verified, module, "voir") : !destination)) {
                if (destination && destination !== page) location.replace(destination);
                else terminerSessionVisibl();
                return;
            }
            await demarrerModule(verified, initial);
        } catch (error) {
            if (!memeSessionVisibl(initial, lireSessionVisibl())) {
                terminerSessionVisibl({ effacerSession: false });
            } else if (error.sessionRefusee || refusSessionVisibl(error)) {
                terminerSessionVisibl();
            } else {
                verrouillerSessionVisibl();
                afficherErreur(!template.isConnected, error);
            }
        } finally {
            checking = false;
        }
    }

    retry.addEventListener("click", () => {
        if (template.isConnected) verifierAcces();
        else location.reload();
    });
    document.addEventListener("click", event => {
        if (!event.target.closest('#logout-button, .logout')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        logoutUser();
    }, true);
    window.addEventListener("storage", event => {
        if (event.key !== VISIBL_USER_KEY && event.key !== null) return;
        const user = lireSessionVisibl();
        if (!user || (candidate && !memeSessionVisibl(candidate, user))) {
            terminerSessionVisibl({ effacerSession: false });
        }
    });
    window.addEventListener("pagehide", verrouillerSessionVisibl);
    window.addEventListener("pageshow", event => {
        if (!event.persisted) return;
        verrouillerSessionVisibl();
        if (lireSessionVisibl()) location.reload();
        else terminerSessionVisibl();
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden || !confirmedAt) return;
        if (!isAuthenticated()) terminerSessionVisibl({ effacerSession: false });
        else if (Date.now() - confirmedAt > 60000) {
            verrouillerSessionVisibl();
            location.reload();
        }
    });
    document.addEventListener("DOMContentLoaded", verifierAcces, { once: true });
})();
