document.addEventListener("DOMContentLoaded", () => {
    console.log("dashboard.js chargé");

    const dashboardData = {
        revenus: {
            valeur: 4520000,
            evolution: 12
        },
        commandes: {
            valeur: 328,
            evolution: 8
        },
        produits: {
            valeur: 1245,
            evolution: 5
        },
        clients: {
            valeur: 892,
            evolution: -2
        }
    };

    function formatNombre(nombre) {
        return new Intl.NumberFormat("fr-FR").format(nombre);
    }

    function mettreAJourCarte(nom, donnees, unite = "") {
        const valeurElement = document.getElementById(`${nom}-value`);
        const tendanceElement = document.getElementById(`${nom}-trend`);

        if (!valeurElement || !tendanceElement) {
            console.error(`Éléments introuvables pour : ${nom}`);
            return;
        }

        valeurElement.textContent =
            `${formatNombre(donnees.valeur)}${unite}`;

        const evolutionPositive = donnees.evolution >= 0;

        tendanceElement.textContent = evolutionPositive
            ? `↑ +${donnees.evolution}% ce mois`
            : `↓ ${donnees.evolution}% ce mois`;

        tendanceElement.classList.toggle("up", evolutionPositive);
        tendanceElement.classList.toggle("down", !evolutionPositive);
    }

    mettreAJourCarte("revenus", dashboardData.revenus, " FCFA");
    mettreAJourCarte("commandes", dashboardData.commandes);
    mettreAJourCarte("produits", dashboardData.produits);
    mettreAJourCarte("clients", dashboardData.clients);
});
