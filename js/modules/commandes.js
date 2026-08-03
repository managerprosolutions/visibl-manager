/* ===========================================================
   VISIBL ERP — Module Commandes
=========================================================== */

let lignesCommande = [];
let catalogueProduitsCommande = [];

document.addEventListener("DOMContentLoaded", () => {
    initialiserModaleCommande();
    initialiserDateHeureCommande();
    initialiserGestionClientsCommande();
    initialiserProduitsCommande();
    initialiserCalculsCommande();
});


function initialiserModaleCommande() {
    const boutonsOuvrir = [
        document.getElementById("new-order-btn"),
        document.getElementById("new-order-toolbar-btn")
    ].filter(Boolean);

    const modale = document.getElementById("order-modal");
    const boutonFermer = document.getElementById("close-order-modal");
    const boutonAnnuler = document.getElementById("cancel-order-btn");

    if (!modale) {
        console.error("La modale #order-modal est introuvable.");
        return;
    }

    const ouvrir = () => {
        initialiserDateHeureCommande();
        modale.classList.add("active");
        modale.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    };

    const fermer = () => {
        modale.classList.remove("active");
        modale.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    };

    boutonsOuvrir.forEach(bouton => bouton.addEventListener("click", ouvrir));
    boutonFermer?.addEventListener("click", fermer);
    boutonAnnuler?.addEventListener("click", fermer);

    modale.addEventListener("click", event => {
        if (event.target === modale) fermer();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modale.classList.contains("active")) {
            fermer();
        }
    });
}


function initialiserDateHeureCommande() {
    const maintenant = new Date();
    const date = [
        maintenant.getFullYear(),
        String(maintenant.getMonth() + 1).padStart(2, "0"),
        String(maintenant.getDate()).padStart(2, "0")
    ].join("-");

    const heure = [
        String(maintenant.getHours()).padStart(2, "0"),
        String(maintenant.getMinutes()).padStart(2, "0")
    ].join(":");

    const champDate = document.getElementById("order-date");
    const champHeure = document.getElementById("order-time");

    if (champDate) champDate.value = date;
    if (champHeure) champHeure.value = heure;
}


function initialiserGestionClientsCommande() {
    document
        .getElementById("open-new-client-modal-btn")
        ?.addEventListener("click", ouvrirModaleClientRapide);

    document
    .getElementById("refresh-order-clients-btn")
    ?.addEventListener("click", () => {
        chargerClientsCommande();
    });

    document
        .getElementById("close-quick-client-modal")
        ?.addEventListener("click", fermerModaleClientRapide);

    document
        .getElementById("cancel-quick-client-btn")
        ?.addEventListener("click", fermerModaleClientRapide);

    document
        .getElementById("quick-client-modal")
        ?.addEventListener("click", event => {
            if (event.target.id === "quick-client-modal") {
                fermerModaleClientRapide();
            }
        });

    document
        .getElementById("quick-client-form")
        ?.addEventListener("submit", enregistrerClientRapide);

    chargerClientsCommande();
}



function ouvrirModaleClientRapide() {
    const modale = document.getElementById("quick-client-modal");
    const formulaire = document.getElementById("quick-client-form");

    if (!modale) {
        return;
    }

    formulaire?.reset();

    const statut = document.getElementById("quick-client-status");
    if (statut) {
        statut.value = "actif";
    }

    masquerMessageClientRapide();

    modale.classList.add("active");
    modale.setAttribute("aria-hidden", "false");

    setTimeout(() => {
        document.getElementById("quick-client-lastname")?.focus();
    }, 100);
}


function fermerModaleClientRapide() {
    const modale = document.getElementById("quick-client-modal");

    if (!modale) {
        return;
    }

    modale.classList.remove("active");
    modale.setAttribute("aria-hidden", "true");
    masquerMessageClientRapide();
}


async function enregistrerClientRapide(event) {
    event.preventDefault();

    const formulaire = document.getElementById("quick-client-form");
    const bouton = document.getElementById("save-quick-client-btn");

    if (!formulaire) {
        return;
    }

    if (!formulaire.checkValidity()) {
        formulaire.reportValidity();
        return;
    }

    const client = {
        typeClient: obtenirValeurCommande("quick-client-type"),
        statut: obtenirValeurCommande("quick-client-status") || "actif",
        nom: obtenirValeurCommande("quick-client-lastname"),
        prenom: obtenirValeurCommande("quick-client-firstname"),
        telephone: obtenirValeurCommande("quick-client-phone"),
        email: obtenirValeurCommande("quick-client-email"),
        commune: obtenirValeurCommande("quick-client-commune"),
        quartier: obtenirValeurCommande("quick-client-neighborhood"),
        commentaire: obtenirValeurCommande("quick-client-comment")
    };

    try {
        if (bouton) {
            bouton.disabled = true;
            bouton.textContent = "Enregistrement...";
        }

        afficherMessageClientRapide(
            "Enregistrement du client...",
            "info"
        );

        const resultat =
            await apiPost("createClient", client);

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le client."
            );
        }

        const clientCree = resultat.data || {};

        const idClient = String(
            clientCree["ID Client"] ||
            clientCree.idClient ||
            ""
        ).trim();

        const nomClient =
            obtenirNomClient(clientCree) ||
            [client.nom, client.prenom]
                .filter(Boolean)
                .join(" ")
                .trim() ||
            idClient;

        /*
           Recharge la liste depuis Google Sheets pour que le nouveau
           client fasse immédiatement partie des données officielles.
        */
        await chargerClientsCommande(idClient, nomClient);

        fermerModaleClientRapide();

        afficherMessageCommande(
            `Client ${nomClient} enregistré et sélectionné.`,
            "success"
        );

    } catch (error) {
        console.error(
            "Erreur d'enregistrement rapide du client :",
            error
        );

        afficherMessageClientRapide(
            error.message ||
            "Une erreur est survenue.",
            "error"
        );

    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.textContent = "Enregistrer le client";
        }
    }
}


function obtenirValeurCommande(id) {
    const champ = document.getElementById(id);

    return champ
        ? String(champ.value || "").trim()
        : "";
}


function afficherMessageClientRapide(
    message,
    type = "info"
) {
    const zone =
        document.getElementById(
            "quick-client-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent = message;
    zone.className = "form-message " + type;
    zone.style.display = "block";
}


function masquerMessageClientRapide() {
    const zone =
        document.getElementById(
            "quick-client-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent = "";
    zone.className = "form-message";
    zone.style.display = "none";
}


async function chargerClientsCommande(idASelectionner = "", libelleSecours = "") {
    const select = document.getElementById("order-client");
    if (!select || typeof apiGet !== "function") return;

    const valeurActuelle = String(idASelectionner || select.value || "").trim();
    select.disabled = true;
    select.innerHTML = '<option value="">Chargement des clients...</option>';

    try {
        const resultat = await apiGet("getClients");
        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible de charger les clients.");
        }

        /*
           Accepte les différents formats possibles renvoyés par l'API :
           - { success: true, data: [...] }
           - { success: true, data: { clients: [...] } }
           - { success: true, clients: [...] }
        */
        const clients = Array.isArray(resultat.data)
            ? resultat.data
            : Array.isArray(resultat.data?.clients)
                ? resultat.data.clients
                : Array.isArray(resultat.clients)
                    ? resultat.clients
                    : [];

        select.innerHTML = '<option value="">Sélectionner un client</option>';

        clients
            .filter(client => {
                const statut = String(
                    lireValeurClientCommande(
                        client,
                        ["Statut", "statut"]
                    ) || ""
                )
                    .trim()
                    .toLowerCase();

                return (
                    !statut ||
                    statut === "actif" ||
                    statut === "prospect"
                );
            })
            .sort((a, b) =>
                obtenirNomClient(a).localeCompare(
                    obtenirNomClient(b),
                    "fr",
                    { sensitivity: "base" }
                )
            )
            .forEach(client => {
                const id = String(
                    lireValeurClientCommande(
                        client,
                        [
                            "ID Client",
                            "idClient",
                            "Identifiant",
                            "identifiant"
                        ]
                    ) || ""
                ).trim();

                if (!id) {
                    console.warn(
                        "Client ignoré car aucun identifiant reconnu :",
                        client
                    );
                    return;
                }

                const option = document.createElement("option");
                option.value = id;
                option.textContent =
                    obtenirNomClient(client) || id;

                select.appendChild(option);
            });

        console.log(
            `${clients.length} client(s) reçus, ${select.options.length - 1} affiché(s) dans la liste.`
        );

        if (
            valeurActuelle &&
            !Array.from(select.options).some(
                option => option.value === valeurActuelle
            )
        ) {
            const option = document.createElement("option");
            option.value = valeurActuelle;
            option.textContent = libelleSecours || valeurActuelle;
            select.appendChild(option);
        }

        select.value = valeurActuelle;
    } catch (error) {
        console.error("Erreur de chargement des clients :", error);
        select.innerHTML = '<option value="">Impossible de charger les clients</option>';
    } finally {
        select.disabled = false;
    }
}


function obtenirNomClient(client) {
    const nom = lireValeurClientCommande(
        client,
        ["Nom", "nom", "Nom Client", "nomClient"]
    );

    const prenom = lireValeurClientCommande(
        client,
        ["Prénom", "Prenom", "prenom", "Prénom Client"]
    );

    const raisonSociale = lireValeurClientCommande(
        client,
        [
            "Raison Sociale",
            "raisonSociale",
            "Nom Entreprise",
            "nomEntreprise"
        ]
    );

    return (
        [nom, prenom]
            .map(valeur => String(valeur || "").trim())
            .filter(Boolean)
            .join(" ")
        ||
        String(raisonSociale || "").trim()
    );
}


function lireValeurClientCommande(client, cles) {
    if (!client || !Array.isArray(cles)) {
        return "";
    }

    for (const cle of cles) {
        if (
            Object.prototype.hasOwnProperty.call(client, cle) &&
            client[cle] !== null &&
            client[cle] !== undefined &&
            client[cle] !== ""
        ) {
            return client[cle];
        }
    }

    return "";
}


function initialiserProduitsCommande() {
    document
        .getElementById("add-order-product-btn")
        ?.addEventListener("click", ajouterProduitCommande);

    document
        .getElementById("order-product-select")
        ?.addEventListener("change", mettreAJourPrixProduitSelectionne);

    document
        .getElementById("order-lines-table-body")
        ?.addEventListener("click", event => {
            const bouton = event.target.closest("[data-remove-order-line]");
            if (!bouton) return;
            supprimerLigneCommande(bouton.dataset.removeOrderLine);
        });

    chargerProduitsCommande();
}


async function chargerProduitsCommande() {
    const select = document.getElementById("order-product-select");
    if (!select || typeof apiGet !== "function") return;

    select.disabled = true;
    select.innerHTML = '<option value="">Chargement des produits...</option>';

    try {
        const resultat = await apiGet("getProduits");
        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible de charger les produits.");
        }

        catalogueProduitsCommande = Array.isArray(resultat.data) ? resultat.data : [];

        select.innerHTML = '<option value="">Sélectionner un produit</option>';

        catalogueProduitsCommande
            .filter(produit => {
                const statut = String(produit["Statut"] || produit.statut || "").toLowerCase();
                return !statut || statut === "actif";
            })
            .sort((a, b) => obtenirNomProduit(a).localeCompare(obtenirNomProduit(b), "fr", { sensitivity: "base" }))
            .forEach(produit => {
                const id = String(produit["ID Produit"] || produit.idProduit || "").trim();
                if (!id) return;

                const option = document.createElement("option");
                option.value = id;
                option.textContent = obtenirNomProduit(produit) || id;
                select.appendChild(option);
            });
    } catch (error) {
        console.error("Erreur de chargement des produits :", error);
        select.innerHTML = '<option value="">Impossible de charger les produits</option>';
    } finally {
        select.disabled = false;
    }
}


function obtenirNomProduit(produit) {
    return String(
        produit["Désignation"] ||
        produit.designation ||
        produit["Nom Produit"] ||
        ""
    ).trim();
}


function obtenirPrixProduit(produit) {
    return convertirNombre(
        produit["Prix de Vente"] ??
        produit.prixVente ??
        0
    );
}


function mettreAJourPrixProduitSelectionne() {
    const idProduit = document.getElementById("order-product-select")?.value || "";
    const produit = catalogueProduitsCommande.find(item =>
        String(item["ID Produit"] || item.idProduit || "") === String(idProduit)
    );

    const champPrix = document.getElementById("order-product-price");
    if (champPrix) champPrix.value = produit ? obtenirPrixProduit(produit) : "";
}


function ajouterProduitCommande() {
    const select = document.getElementById("order-product-select");
    const idProduit = select?.value || "";
    const quantite = Math.max(1, Math.trunc(convertirNombre(document.getElementById("order-product-quantity")?.value)));
    const prixUnitaire = convertirNombre(document.getElementById("order-product-price")?.value);
    const remise = convertirNombre(document.getElementById("order-product-discount")?.value);

    if (!idProduit) {
        afficherMessageCommande("Sélectionnez un produit.", "error");
        return;
    }

    const produit = catalogueProduitsCommande.find(item =>
        String(item["ID Produit"] || item.idProduit || "") === String(idProduit)
    );

    if (!produit) {
        afficherMessageCommande("Produit introuvable.", "error");
        return;
    }

    const sousTotal = Math.max(0, quantite * prixUnitaire - remise);
    const indexExistant = lignesCommande.findIndex(ligne => ligne.idProduit === idProduit);

    const ligne = {
        idLigne: indexExistant >= 0 ? lignesCommande[indexExistant].idLigne : crypto.randomUUID?.() || String(Date.now()),
        idProduit,
        designation: obtenirNomProduit(produit),
        quantite,
        prixUnitaire,
        remise,
        sousTotal
    };

    if (indexExistant >= 0) {
        lignesCommande[indexExistant] = ligne;
    } else {
        lignesCommande.push(ligne);
    }

    afficherLignesCommande();
    recalculerTotauxCommande();

    if (select) select.value = "";
    document.getElementById("order-product-quantity").value = 1;
    document.getElementById("order-product-price").value = "";
    document.getElementById("order-product-discount").value = "";
    afficherMessageCommande("Produit ajouté à la commande.", "success");
}


function supprimerLigneCommande(idLigne) {
    lignesCommande = lignesCommande.filter(ligne => String(ligne.idLigne) !== String(idLigne));
    afficherLignesCommande();
    recalculerTotauxCommande();
}


function afficherLignesCommande() {
    const tbody = document.getElementById("order-lines-table-body");
    if (!tbody) return;

    if (!lignesCommande.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-table">Aucun produit ajouté.</td></tr>';
        return;
    }

    tbody.innerHTML = lignesCommande.map(ligne => `
        <tr>
            <td>${echapperHTMLCommande(ligne.designation)}</td>
            <td>${ligne.quantite}</td>
            <td>${formaterFCFA(ligne.prixUnitaire)}</td>
            <td>${formaterFCFA(ligne.remise)}</td>
            <td><strong>${formaterFCFA(ligne.sousTotal)}</strong></td>
            <td>
                <button type="button" class="table-action-btn delete-btn" data-remove-order-line="${echapperHTMLCommande(ligne.idLigne)}" aria-label="Retirer le produit">🗑️</button>
            </td>
        </tr>
    `).join("");
}


function initialiserCalculsCommande() {
    ["order-discount", "order-delivery-fees"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", recalculerTotauxCommande);
    });

    recalculerTotauxCommande();
}


function recalculerTotauxCommande() {
    const totalCommande = lignesCommande.reduce((total, ligne) => total + convertirNombre(ligne.sousTotal), 0);
    const remiseTotale = convertirNombre(document.getElementById("order-discount")?.value);
    const fraisLivraison = convertirNombre(document.getElementById("order-delivery-fees")?.value);
    const totalAPayer = Math.max(0, totalCommande - remiseTotale + fraisLivraison);

    definirValeurCommande("order-total", totalCommande || "");
    definirValeurCommande("order-total-payable", totalAPayer || "");
}


function definirValeurCommande(id, valeur) {
    const champ = document.getElementById(id);
    if (champ) champ.value = valeur;
}


function convertirNombre(valeur) {
    const nombre = Number(String(valeur ?? "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(nombre) ? nombre : 0;
}


function formaterFCFA(valeur) {
    return Math.round(convertirNombre(valeur)).toLocaleString("fr-FR") + " FCFA";
}


function afficherMessageCommande(message, type = "info") {
    const zone = document.getElementById("order-form-message");
    if (!zone) return;

    zone.textContent = message;
    zone.className = "form-message " + type;
    zone.style.display = "block";

    clearTimeout(afficherMessageCommande.timer);
    afficherMessageCommande.timer = setTimeout(() => {
        zone.style.display = "none";
    }, 3000);
}


function echapperHTMLCommande(valeur) {
    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
