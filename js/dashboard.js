// ========================================
// DONNÉES DE SIMULATION
// ========================================

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
        valeur: 186,
        evolution: -2
    },

    conversion: {
        valeur: 3.2,
        evolution: 0.5
    },

    livraisons: {
        valeur: 156,
        evolution: 15
    },

    paiements: {
        valeur: 4210000,
        evolution: 10
    },

    factures: {
        valeur: 245,
        evolution: 3
    }
};


// ========================================
// FONCTIONS DE FORMATAGE
// ========================================

function formatNombre(nombre) {
    return new Intl.NumberFormat("fr-FR").format(nombre);
}


// ========================================
// AFFICHAGE DES KPI
// ========================================

function mettreAJourCarte(nom, donnees, unite = "") {
    const valeurElement = document.getElementById(`${nom}-value`);
    const tendanceElement = document.getElementById(`${nom}-trend`);

    if (!valeurElement || !tendanceElement) {
        console.error(`Éléments introuvables pour la carte : ${nom}`);
        return;
    }

    valeurElement.textContent =
        `${formatNombre(donnees.valeur)}${unite}`;

    const evolutionPositive = donnees.evolution >= 0;

    if (evolutionPositive) {
        tendanceElement.textContent =
            `↑ +${donnees.evolution}% ce mois`;

        tendanceElement.classList.remove("down");
        tendanceElement.classList.add("up");
    } else {
        tendanceElement.textContent =
            `↓ ${donnees.evolution}% ce mois`;

        tendanceElement.classList.remove("up");
        tendanceElement.classList.add("down");
    }
}


// ========================================
// KPI PRINCIPAUX
// ========================================

function afficherKPIPrincipaux() {
    mettreAJourCarte(
        "revenus",
        dashboardData.revenus,
        " FCFA"
    );

    mettreAJourCarte(
        "commandes",
        dashboardData.commandes
    );

    mettreAJourCarte(
        "produits",
        dashboardData.produits
    );

    mettreAJourCarte(
        "clients",
        dashboardData.clients
    );
}


// ========================================
// KPI SECONDAIRES
// ========================================

function afficherKPISecondaires() {
    mettreAJourCarte(
        "conversion",
        dashboardData.conversion,
        "%"
    );

    mettreAJourCarte(
        "livraisons",
        dashboardData.livraisons
    );

    mettreAJourCarte(
        "paiements",
        dashboardData.paiements,
        " FCFA"
    );

    mettreAJourCarte(
        "factures",
        dashboardData.factures
    );
}


// ========================================
// GRAPHIQUE DES REVENUS
// ========================================

function afficherGraphiqueRevenus() {
    const canvas = document.getElementById("revenus-chart");

    if (!canvas) {
        console.error("Canvas revenus-chart introuvable");
        return;
    }

    if (typeof Chart === "undefined") {
        console.error("La bibliothèque Chart.js n'est pas chargée");
        return;
    }

    new Chart(canvas, {
        type: "line",

        data: {
            labels: [
                "Février",
                "Mars",
                "Avril",
                "Mai",
                "Juin",
                "Juillet"
            ],

            datasets: [
                {
                    label: "Revenus",
                    data: [
                        1800000,
                        2200000,
                        2600000,
                        3100000,
                        3600000,
                        4520000
                    ],
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${formatNombre(context.raw)} FCFA`;
                        }
                    }
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        callback: function (value) {
                            return `${formatNombre(value)} FCFA`;
                        }
                    }
                }
            }
        }
    });
}


// ========================================
// INITIALISATION DU DASHBOARD
// ========================================

function initialiserDashboard() {
    console.log("dashboard.js chargé");

    afficherKPIPrincipaux();
    afficherKPISecondaires();
    afficherGraphiqueRevenus();
}


// ========================================
// DÉMARRAGE
// ========================================

document.addEventListener("DOMContentLoaded", initialiserDashboard);
