document.addEventListener("DOMContentLoaded", function () {

    if (redirectAuthenticatedUser()) {
        return;
    }
    
    const loginForm = document.getElementById("login-form");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const passwordToggle = document.getElementById("password-toggle");
    const passwordToggleIcon = document.getElementById("password-toggle-icon");
    const loginButton = document.getElementById("login-button");
    const alertMessage = document.getElementById("alert-message");
    const alertText = document.getElementById("alert-text");
    const alertIcon = document.getElementById("alert-icon");
    const forgotPasswordLink = document.getElementById("forgot-password-link");

    passwordToggle.addEventListener("click", function () {
        const passwordIsHidden = passwordInput.type === "password";

        passwordInput.type = passwordIsHidden ? "text" : "password";

        passwordToggleIcon.className = passwordIsHidden
            ? "fa-regular fa-eye-slash"
            : "fa-regular fa-eye";

        passwordToggle.setAttribute(
            "aria-label",
            passwordIsHidden
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
        );

        passwordToggle.setAttribute(
            "title",
            passwordIsHidden
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
        );
    });

    emailInput.addEventListener("input", function () {
        emailInput.classList.remove("input-error");
        hideAlert();
    });

    passwordInput.addEventListener("input", function () {
        passwordInput.classList.remove("input-error");
        hideAlert();
    });

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = emailInput.value.trim();
        const motDePasse = passwordInput.value.trim();

        emailInput.classList.remove("input-error");
        passwordInput.classList.remove("input-error");
        hideAlert();

        let formIsValid = true;

        if (email === "") {
            emailInput.classList.add("input-error");
            formIsValid = false;
        }

        if (motDePasse === "") {
            passwordInput.classList.add("input-error");
            formIsValid = false;
        }

        if (!formIsValid) {
            showAlert(
                "Veuillez renseigner votre adresse e-mail et votre mot de passe.",
                "error"
            );
            return;
        }

        setLoadingState(true);

        try {
            const result = await apiPost("login", {
                email: email,
                motDePasse: motDePasse
            });

            if (!result.success) {
                showAlert(
                    result.message || "Adresse e-mail ou mot de passe incorrect.",
                    "error"
                );
                return;
            }

            /*
             * Ne pas rediriger immédiatement vers dashboard.html.
             * On charge d'abord les permissions du rôle afin d'envoyer
             * l'utilisateur directement vers son premier module autorisé.
             */
            localStorage.setItem(
                "visibl_user",
                JSON.stringify(result.user)
            );

            let permissionsResult = null;

            try {
                permissionsResult = await apiPost(
                    "getPermissions",
                    {
                        roleId: result.user.roleId
                    }
                );
            } catch (permissionsError) {
                console.error(
                    "Erreur de chargement des permissions :",
                    permissionsError
                );
            }

            if (
                !permissionsResult ||
                permissionsResult.success !== true
            ) {
                localStorage.removeItem("visibl_user");

                showAlert(
                    permissionsResult?.message ||
                    "Impossible de charger les autorisations de ce compte.",
                    "error"
                );

                return;
            }

            const userAvecPermissions = {
                ...result.user,
                permissions: Array.isArray(
                    permissionsResult.permissions
                )
                    ? permissionsResult.permissions
                    : [],
                permissionsLoaded: true,
                permissionsLoadedAt:
                    new Date().toISOString()
            };

            localStorage.setItem(
                "visibl_user",
                JSON.stringify(userAvecPermissions)
            );

            const ordreModules = [
                ["dashboard", "dashboard.html"],
                ["ventes", "ventes.html"],
                ["commandes", "commandes.html"],
                ["clients", "clients.html"],
                ["livraisons", "livraisons.html"],
                ["livreurs", "livreurs.html"],
                ["produits", "produits.html"],
                ["stock", "stock.html"],
                ["mouvements_stock", "mouvements-stock.html"],
                ["approvisionnements", "approvisionnements.html"],
                ["fournisseurs", "fournisseurs.html"],
                ["transitaires", "transitaires.html"],
                ["caisse", "caisse.html"],
                ["paiements", "paiements.html"],
                ["factures", "factures.html"],
                ["comptabilite", "comptabilité.html"],
                ["rapports", "rapports.html"],
                ["parametres", "paramètres.html"]
            ];

            const normaliser = (valeur) =>
                String(valeur || "")
                    .trim()
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "_")
                    .replace(/^_+|_+$/g, "");

            const estAdministrateur =
                String(userAvecPermissions.roleId || "")
                    .trim()
                    .toUpperCase() === "ROL0001";

            const modulesVisibles = new Set(
                userAvecPermissions.permissions
                    .filter(
                        (permission) =>
                            normaliser(permission.action) ===
                            "voir"
                    )
                    .map(
                        (permission) =>
                            normaliser(permission.module)
                    )
            );

            const destination =
                estAdministrateur
                    ? "dashboard.html"
                    : (
                        ordreModules.find(
                            ([module]) =>
                                modulesVisibles.has(module)
                        ) || []
                    )[1];

            if (!destination) {
                localStorage.removeItem("visibl_user");

                showAlert(
                    "Ce compte ne dispose d'aucun module accessible. Contactez l'administrateur.",
                    "error"
                );

                return;
            }

            showAlert(
                result.message || "Connexion réussie.",
                "success"
            );

            /*
             * Redirection immédiate : aucune ouverture préalable
             * du dashboard ni flash des modules interdits.
             */
            window.location.replace(destination);

        } catch (error) {
            console.error("Erreur de connexion :", error);

            showAlert(
                "Impossible de joindre le serveur. Veuillez réessayer.",
                "error"
            );

        } finally {
            setLoadingState(false);
        }
    });

    forgotPasswordLink.addEventListener("click", function (event) {
        event.preventDefault();

        showAlert(
            "La récupération du mot de passe sera ajoutée prochainement.",
            "success"
        );
    });

    function setLoadingState(isLoading) {
        loginButton.disabled = isLoading;
        loginButton.classList.toggle("loading", isLoading);
    }

    function showAlert(message, type) {
        alertText.textContent = message;
        alertMessage.className = "alert-message show " + type;

        alertIcon.className = type === "success"
            ? "fa-solid fa-circle-check"
            : "fa-solid fa-circle-exclamation";
    }

    function hideAlert() {
        alertMessage.className = "alert-message";
        alertText.textContent = "";
    }
});
