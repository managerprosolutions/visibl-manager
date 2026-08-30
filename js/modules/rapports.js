/* ===========================================================
   VISIBL ERP — rapports.js
   Aucun jeu de données fictif : toutes les valeurs viennent de getRapports.
=========================================================== */

let donneesRapports = null;
let lignesRapport = [];
let lignesRapportFiltrees = [];

const CONFIG_RAPPORTS = {
    ventes: {
        titre: "Rapport des ventes",
        detail: "Détail des ventes"
    },
    commandes: { titre: "Rapport des commandes", detail: "Détail des commandes" },
    clients: { titre: "Rapport des clients", detail: "Détail des clients" },
    stock: { titre: "Rapport de stock", detail: "État du stock" },
    mouvementsStock: { titre: "Rapport des mouvements de stock", detail: "Historique des mouvements de stock" },
    approvisionnements: { titre: "Rapport des approvisionnements", detail: "Détail des approvisionnements" },
    caisse: { titre: "Rapport de caisse", detail: "Mouvements de caisse" },
    paiements: { titre: "Rapport des paiements", detail: "Détail des paiements" },
    comptabilite: { titre: "Rapport comptable", detail: "Écritures comptables" },
    livraisons: { titre: "Rapport des livraisons", detail: "Détail des livraisons" },
    livreurs: { titre: "Performance des livreurs", detail: "Performance des livreurs" }
};

function initialiserRapports(){
    if(typeof requireAuth==="function" && !requireAuth()) return;

    document.getElementById("generate-report-btn")?.addEventListener("click", regenererRapportDepuisServeur);
    document.getElementById("report-type-filter")?.addEventListener("change", genererRapport);
    document.getElementById("report-period-filter")?.addEventListener("change", ()=>{
        mettreAJourPeriodePersonnalisee();
        genererRapport();
    });
    document.getElementById("report-start-date")?.addEventListener("change", genererRapport);
    document.getElementById("report-end-date")?.addEventListener("change", genererRapport);
    document.getElementById("report-details-search-input")?.addEventListener("input", appliquerFiltresDetailRapport);
    document.getElementById("report-status-filter")?.addEventListener("change", appliquerFiltresDetailRapport);
    document.getElementById("report-payment-filter")?.addEventListener("change", appliquerFiltresDetailRapport);
    document.querySelector(".header .search-input")?.addEventListener("input", appliquerRechercheHeaderRapport);
    document.querySelector(".header .search-btn")?.addEventListener("click", appliquerRechercheHeaderRapport);
    document.getElementById("export-excel-btn")?.addEventListener("click", exporterRapportCSV);
    document.getElementById("export-pdf-btn")?.addEventListener("click", exporterRapportPDF);
    document.getElementById("print-report-btn")?.addEventListener("click", ()=>window.print());

    document.querySelectorAll(".chart-period-btn").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            document.querySelectorAll(".chart-period-btn").forEach(x=>x.classList.remove("active"));
            btn.classList.add("active");
            afficherGraphiquePrincipal();
        });
    });

    initialiserHeaderRapports();
    mettreAJourPeriodePersonnalisee();
    chargerRapports();
}

if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", initialiserRapports);
}else{
    initialiserRapports();
}


/* ===========================================================
   CORRECTIFS UI / ACTIONS RAPPORTS
=========================================================== */

function initialiserHeaderRapports(){
    const boutonNotification=document.getElementById("notification-button");
    const panneauNotification=document.getElementById("notification-panel");
    const boutonRecherche=document.getElementById("mobile-search-btn");
    const conteneurRecherche=document.querySelector(".header .search-container");

    const fermerNotifications=()=>{
        if(panneauNotification) panneauNotification.hidden=true;
        boutonNotification?.setAttribute("aria-expanded","false");
    };

    const fermerRecherche=()=>{
        conteneurRecherche?.classList.remove("active");
    };

    // Capture : le module Rapports garde la maîtrise même si app.js possède
    // aussi un gestionnaire générique du header.
    boutonNotification?.addEventListener("click",event=>{
        event.preventDefault();
        event.stopImmediatePropagation();
        const ouvrir=panneauNotification?.hidden !== false;
        fermerRecherche();
        if(panneauNotification) panneauNotification.hidden=!ouvrir;
        boutonNotification.setAttribute("aria-expanded",ouvrir?"true":"false");
    },true);

    boutonRecherche?.addEventListener("click",()=>{
        fermerNotifications();
    },true);

    document.addEventListener("click",event=>{
        if(!event.target.closest(".header .notification-menu")) fermerNotifications();
    });
}

async function regenererRapportDepuisServeur(){
    const bouton=document.getElementById("generate-report-btn");
    const texteInitial=bouton?.innerHTML;
    if(bouton){
        bouton.disabled=true;
        bouton.innerHTML="<span>⏳</span> Génération...";
    }

    try{
        const r=await apiGet("getRapports");
        if(!r?.success) throw new Error(r?.message||"Impossible de générer le rapport.");
        donneesRapports=r.data||{};
        genererRapport();
        toastRapport("Rapport généré avec les données à jour.","success");
    }catch(error){
        console.error("Génération du rapport :",error);
        toastRapport(error.message||"Impossible de générer le rapport.","error");
    }finally{
        if(bouton){
            bouton.disabled=false;
            bouton.innerHTML=texteInitial||"<span>📊</span> Générer le rapport";
        }
    }
}

function exporterRapportPDF(){
    if(!lignesRapportFiltrees.length){
        toastRapport("Aucune donnée à exporter en PDF.","info");
        return;
    }

    const jsPDFCtor=window.jspdf?.jsPDF;
    if(typeof jsPDFCtor!=="function"){
        toastRapport("Le moteur PDF n'a pas pu être chargé. Vérifiez votre connexion puis réessayez.","error");
        return;
    }

    const type=valeur("report-type-filter")||"ventes";
    const cfg=CONFIG_RAPPORTS[type]||CONFIG_RAPPORTS.ventes;
    const periode=document.getElementById("report-period-filter")?.selectedOptions?.[0]?.textContent?.trim()||"Période";
    const schema=schemaTableRapport(type);
    const doc=new jsPDFCtor({orientation:"landscape",unit:"mm",format:"a4"});

    doc.setFont("helvetica","bold");
    doc.setFontSize(18);
    doc.text(cfg.titre||"Rapport VISIBL",14,16);

    doc.setFont("helvetica","normal");
    doc.setFontSize(10);
    doc.text(`Période : ${periode}`,14,23);
    doc.text(`Généré le : ${new Date().toLocaleString("fr-FR")}`,14,29);

    const body=lignesRapportFiltrees.map(x=>
        schema.map(c=>String(c.get(x)??"—").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim())
    );

    if(typeof doc.autoTable==="function"){
        doc.autoTable({
            startY:35,
            head:[schema.map(c=>c.label)],
            body,
            styles:{fontSize:8,cellPadding:2.4,overflow:"linebreak"},
            headStyles:{fontStyle:"bold"},
            margin:{left:10,right:10},
            tableWidth:"auto"
        });
    }else{
        doc.setFontSize(9);
        doc.text("Le module de tableau PDF n'a pas pu être chargé.",14,40);
    }

    doc.save(`rapport-${type}-${new Date().toISOString().slice(0,10)}.pdf`);
    toastRapport("PDF téléchargé.","success");
}


async function chargerRapports(){
    definirChargementRapport(true);
    try{
        const r=await apiGet("getRapports");
        if(!r?.success) throw new Error(r?.message||"Impossible de charger les rapports.");
        donneesRapports=r.data||{};
        genererRapport();
    }catch(error){
        console.error("Erreur rapports :",error);
        donneesRapports={};
        lignesRapport=[];
        afficherEtatVideRapport(error.message||"Impossible de charger les rapports.");
    }finally{
        definirChargementRapport(false);
    }
}


function dateDansPeriodeRapport(date,debut,fin){
    if(!date) return false;
    if(debut && date<debut) return false;
    if(fin && date>fin) return false;
    return true;
}

function nomCompletLivreurRapport(livreur){
    const direct=String(
        livreur?.nomComplet ??
        livreur?.nomLivreur ??
        ""
    ).trim();
    if(direct) return direct;

    const nom=[
        livreur?.prenom ?? livreur?.["Prénom"] ?? "",
        livreur?.nom ?? livreur?.["Nom"] ?? ""
    ].filter(Boolean).join(" ").trim();

    return nom || String(livreur?.idLivreur||"Livreur");
}

function construirePerformanceLivreursRapport(debut,fin){
    const livreurs=Array.isArray(donneesRapports?.livreurs)
        ? donneesRapports.livreurs
        : [];

    const livraisons=Array.isArray(donneesRapports?.livraisons)
        ? donneesRapports.livraisons
        : [];

    const historique=Array.isArray(donneesRapports?.historiqueLivraisons)
        ? donneesRapports.historiqueLivraisons
        : [];

    const encaissements=Array.isArray(donneesRapports?.encaissementsLivraison)
        ? donneesRapports.encaissementsLivraison
        : [];

    const livraisonParId=new Map(
        livraisons
            .filter(x=>String(x?.idLivraison||"").trim())
            .map(x=>[String(x.idLivraison).trim(),x])
    );

    const stats=new Map();

    livreurs.forEach(l=>{
        const id=String(l?.idLivreur||"").trim();
        if(!id) return;

        stats.set(id,{
            ...l,
            nomComplet:nomCompletLivreurRapport(l),
            missionsEffectueesPeriode:0,
            livraisonsReussiesPeriode:0,
            livraisonsEchoueesPeriode:0,
            missionsReporteesPeriode:0,
            fraisLivraisonsReussiesPeriode:0,
            fraisPrisEnChargeEntreprisePeriode:0,
            montantEncaisseParLivreurPeriode:0,
            ecartTotalPeriode:0,
            tauxReussitePeriode:0,
            derniereLivraisonPeriode:""
        });
    });

    function obtenirStat(idLivreur){
        const id=String(idLivreur||"").trim();
        if(!id) return null;

        if(!stats.has(id)){
            stats.set(id,{
                idLivreur:id,
                nomComplet:id,
                statut:"—",
                missionsEffectueesPeriode:0,
                livraisonsReussiesPeriode:0,
                livraisonsEchoueesPeriode:0,
                missionsReporteesPeriode:0,
                fraisLivraisonsReussiesPeriode:0,
                fraisPrisEnChargeEntreprisePeriode:0,
                montantEncaisseParLivreurPeriode:0,
                ecartTotalPeriode:0,
                tauxReussitePeriode:0,
                derniereLivraisonPeriode:""
            });
        }

        return stats.get(id);
    }

    // Résultats logistiques : source de vérité = Livraisons.
    livraisons.forEach(l=>{
        const idLivreur=String(l?.idLivreur||"").trim();
        const s=obtenirStat(idLivreur);
        if(!s) return;

        const dateEffective=convertirDateRapport(l.dateLivraisonEffective);
        if(!dateDansPeriodeRapport(dateEffective,debut,fin)) return;

        const statut=norm(l.statutLivraison);
        const resultat=norm(l.resultatLivraison);
        const reussie=statut==="cloturee" && resultat==="livree";
        const echec=statut==="cloturee" && resultat==="non-livree";

        if(reussie){
            s.livraisonsReussiesPeriode++;
            s.fraisLivraisonsReussiesPeriode+=Math.max(0,num(l.fraisLivraison));
        }

        if(echec){
            s.livraisonsEchoueesPeriode++;
            s.fraisPrisEnChargeEntreprisePeriode+=Math.max(0,num(l.fraisLivraison));
        }

        if(reussie || echec){
            s.ecartTotalPeriode+=num(l.ecart);

            const dateTexte=String(l.dateLivraisonEffective||"").trim();
            const ancienne=convertirDateRapport(s.derniereLivraisonPeriode);
            if(dateTexte && (!ancienne || dateEffective>ancienne)){
                s.derniereLivraisonPeriode=dateTexte;
            }
        }
    });

    // Missions réellement parties et reprogrammations : HistoriqueLivraisons.
    historique.forEach(h=>{
        const livraison=livraisonParId.get(String(h?.idLivraison||"").trim());
        if(!livraison) return;

        const s=obtenirStat(livraison.idLivreur);
        if(!s) return;

        const date=convertirDateRapport(h.date);
        if(!dateDansPeriodeRapport(date,debut,fin)) return;

        const type=norm(h.typeEvenement);
        if(type==="depart") s.missionsEffectueesPeriode++;
        if(type==="reprogrammee") s.missionsReporteesPeriode++;
    });

    // Montants réellement remis par un livreur : Encaissements Livraison.
    encaissements.forEach(e=>{
        if(norm(e.provenance)!=="livreur") return;

        const livraison=livraisonParId.get(String(e?.idLivraison||"").trim());
        if(!livraison) return;

        const s=obtenirStat(livraison.idLivreur);
        if(!s) return;

        const date=convertirDateRapport(e.date);
        if(!dateDansPeriodeRapport(date,debut,fin)) return;

        s.montantEncaisseParLivreurPeriode+=Math.max(0,num(e.montant));
    });

    stats.forEach(s=>{
        // Sécurité historique : si aucun événement "départ" n'existe,
        // on retombe sur les missions terminées de la période.
        if(!s.missionsEffectueesPeriode){
            s.missionsEffectueesPeriode=
                s.livraisonsReussiesPeriode+
                s.livraisonsEchoueesPeriode;
        }

        const terminees=
            s.livraisonsReussiesPeriode+
            s.livraisonsEchoueesPeriode;

        s.tauxReussitePeriode=terminees
            ? Math.round((s.livraisonsReussiesPeriode/terminees)*1000)/10
            : 0;
    });

    return [...stats.values()];
}

function genererRapport(){
    if(!donneesRapports) return;
    const type=valeur("report-type-filter")||"ventes";
    const source=extraireSourceRapport(type);
    const periode=obtenirBornesPeriodeRapport();

    lignesRapport=type==="livreurs"
        ? construirePerformanceLivreursRapport(periode.debut,periode.fin)
        : filtrerParPeriodeRapport(source,type,periode.debut,periode.fin);

    lignesRapportFiltrees=[...lignesRapport];

    const cfg=CONFIG_RAPPORTS[type]||CONFIG_RAPPORTS.ventes;
    texte("report-details-title",cfg.detail);
    const periodeLibelle=document.getElementById("report-period-filter")?.selectedOptions?.[0]?.textContent?.trim()||"Période sélectionnée";
    texte("report-period-chip",periodeLibelle);
    adapterFiltresDetail(type);
    calculerEtAfficherKpis(type,lignesRapport);
    afficherGraphiquePrincipal();
    afficherGraphiquesSecondaires(type,lignesRapport);
    afficherTableauRapport(type,lignesRapportFiltrees);
}

function extraireSourceRapport(type){
    const d=donneesRapports||{};
    const mapping={
        ventes:d.ventes,
        commandes:d.commandes,
        clients:d.clients,
        stock:d.stock,
        mouvementsStock:d.mouvementsStock,
        approvisionnements:d.approvisionnements,
        caisse:d.caisse,
        paiements:d.paiements,
        comptabilite:d.comptabilite,
        livraisons:d.livraisons,
        livreurs:d.livreurs,
        historiqueLivraisons:d.historiqueLivraisons,
        encaissementsLivraison:d.encaissementsLivraison
    };
    return Array.isArray(mapping[type])?mapping[type]:[];
}

function extraireListeResultat(r,cles){
    if(Array.isArray(r)) return r;
    if(!r||typeof r!=="object") return [];
    for(const cle of cles){
        if(Array.isArray(r[cle])) return r[cle];
    }
    return Array.isArray(r.data)?r.data:[];
}

function filtrerParPeriodeRapport(liste,type,debut,fin){
    if(type==="stock") return [...liste];
    return liste.filter(item=>{
        const d=obtenirDateItemRapport(item,type);
        if(!d) return true;
        if(debut && d<debut) return false;
        if(fin && d>fin) return false;
        return true;
    });
}

function obtenirDateItemRapport(x,type){
    if(type==="clients") return parseDate(x.dateInscription??x.dateCreation??x.createdAt);
    const candidats={
        ventes:["dateVente","date"],
        commandes:["dateCommande","date"],
        mouvementsStock:["date","dateMouvement"],
        approvisionnements:["dateAchat","dateApprovisionnement","dateCommande","date"],
        caisse:["date","dateOperation"],
        paiements:["datePaiement","date"],
        comptabilite:["date"],
        livraisons:["dateLivraisonEffective","dateLivraisonPrevue","date"],
        livreurs:["date"]
    }[type]||["date"];
    for(const cle of candidats){
        const d=convertirDateRapport(x?.[cle]);
        if(d) return d;
    }
    return null;
}

function obtenirBornesPeriodeRapport(){
    const mode=valeur("report-period-filter")||"mois";
    const maintenant=new Date();
    maintenant.setHours(0,0,0,0);
    let debut=null,fin=new Date(maintenant); fin.setHours(23,59,59,999);

    if(mode==="aujourdhui") debut=new Date(maintenant);
    else if(mode==="semaine"){
        debut=new Date(maintenant);
        const jour=(debut.getDay()+6)%7;
        debut.setDate(debut.getDate()-jour);
    }else if(mode==="mois") debut=new Date(maintenant.getFullYear(),maintenant.getMonth(),1);
    else if(mode==="trimestre"){
        const m=Math.floor(maintenant.getMonth()/3)*3;
        debut=new Date(maintenant.getFullYear(),m,1);
    }else if(mode==="annee") debut=new Date(maintenant.getFullYear(),0,1);
    else if(mode==="personnalisee"){
        debut=convertirDateRapport(valeur("report-start-date"));
        fin=convertirDateRapport(valeur("report-end-date"));
        if(fin) fin.setHours(23,59,59,999);
    }
    return {debut,fin};
}

function calculerEtAfficherKpis(type,liste){
    const kpis=construireKpisRapport(type,liste);
    for(let i=0;i<6;i++){
        const k=kpis[i]||{titre:"Indicateur",valeur:"—",description:"Aucune donnée",badge:"—"};
        texte(`report-kpi-${i+1}-title`,k.titre);
        texte(`report-kpi-${i+1}-value`,k.valeur);
        texte(`report-kpi-${i+1}-description`,k.description||"");
        texte(`report-kpi-${i+1}-badge`,k.badge||"—");
    }
}

function montantCommandeRapport(commande){
    if(!commande || typeof commande!=="object") return 0;
    return num(
        commande.totalAPayer ??
        commande.totalCommande ??
        commande.montantTotal ??
        commande.total ??
        commande.montantNet ??
        0
    );
}

function sensMouvementStockRapport(typeMouvement){
    const type=norm(typeMouvement);

    const entrees=[
        "stock initial","initial","entree","approvisionnement","achat",
        "retour client","annulation echange client","retour client vendable",
        "retour livraison vendable","retour colis vendable",
        "retour client non vendable","retour livraison non vendable",
        "retour colis non vendable","ajustement positif","correction positive",
        "inventaire positif"
    ];

    const sorties=[
        "sortie","vente","livraison","sortie livraison","depart livraison",
        "depart livreur","colis remis au livreur","retrait boutique",
        "remise client boutique","echange client","annulation retour client",
        "retour fournisseur","ajustement negatif","correction negative",
        "inventaire negatif","perte","casse","vol","don","produit endommage",
        "sortie non vendable","destruction non vendable","rebut non vendable"
    ];

    const neutres=[
        "reservation","reservation stock","reservation commande","stock reserve",
        "mise en reserve","liberation reservation","liberation de reservation",
        "annulation reservation","annulation de reservation","de-reservation",
        "dereservation","mise en non vendable","passage non vendable",
        "reclassement non vendable","vendable vers non vendable",
        "remise en vendable","retour en vendable","non vendable vers vendable",
        "reclassement vendable"
    ];

    if(entrees.includes(type)) return "entree";
    if(sorties.includes(type)) return "sortie";
    if(neutres.includes(type)) return "neutre";
    return "inconnu";
}

function variationPhysiqueMouvementRapport(mouvement){
    const q=Math.abs(num(mouvement?.quantite));
    const sens=sensMouvementStockRapport(mouvement?.typeMouvement);
    if(sens==="entree") return q;
    if(sens==="sortie") return -q;
    return 0;
}

function volumeMouvementRapport(mouvement){
    return Math.abs(num(mouvement?.quantite));
}

function estApprovisionnementFinancierActif(approvisionnement){
    const statut=norm(approvisionnement?.statut);
    return statut!=="brouillon" && !statut.includes("annul");
}

function montantGlobalApprovisionnementRapport(approvisionnement){
    if(!approvisionnement || typeof approvisionnement!=="object") return 0;

    const global=approvisionnement.montantGlobal;
    if(global!==undefined && global!==null && String(global).trim()!==""){
        return num(global);
    }

    return (
        num(approvisionnement.montantTotal) +
        num(approvisionnement.fraisTransport) +
        num(approvisionnement.fraisDivers)
    );
}

function obtenirNomFournisseurRapport(idFournisseur, approvisionnement){
    const direct=String(
        approvisionnement?.nomFournisseur ??
        approvisionnement?.["Nom Fournisseur"] ??
        approvisionnement?.raisonSociale ??
        ""
    ).trim();

    if(direct) return direct;

    const id=String(idFournisseur||"").trim();
    if(!id) return "Fournisseur";

    const fournisseurs=Array.isArray(donneesRapports?.fournisseurs)
        ? donneesRapports.fournisseurs
        : [];

    const fournisseur=fournisseurs.find(f=>{
        const fid=String(
            f?.idFournisseur ??
            f?.["ID Fournisseur"] ??
            f?.id ??
            ""
        ).trim();
        return fid===id;
    });

    const nom=String(
        fournisseur?.nomFournisseur ??
        fournisseur?.["Nom Fournisseur"] ??
        fournisseur?.raisonSociale ??
        fournisseur?.nom ??
        ""
    ).trim();

    return nom || id;
}

function obtenirNomTransitaireRapport(idTransitaire, approvisionnement){
    const direct=String(
        approvisionnement?.nomTransitaire ??
        approvisionnement?.["Nom Transitaire"] ??
        ""
    ).trim();

    if(direct) return direct;

    const id=String(idTransitaire||"").trim();
    if(!id) return "—";

    const transitaires=Array.isArray(donneesRapports?.transitaires)
        ? donneesRapports.transitaires
        : [];

    const transitaire=transitaires.find(t=>{
        const tid=String(
            t?.idTransitaire ??
            t?.["ID Transitaire"] ??
            t?.id ??
            ""
        ).trim();
        return tid===id;
    });

    const nom=String(
        transitaire?.nomTransitaire ??
        transitaire?.["Nom Transitaire"] ??
        transitaire?.nom ??
        ""
    ).trim();

    return nom || id;
}


function typeMouvementCaisseRapport(operation){
    return norm(operation?.typeMouvement ?? operation?.type);
}

function categorieCaisseRapport(operation){
    return norm(operation?.categorie);
}

function montantCaisseRapport(operation){
    return Math.abs(num(operation?.montant));
}

function estEntreeCaisseRapport(operation){
    return typeMouvementCaisseRapport(operation)==="entree";
}

function estSortieCaisseRapport(operation){
    return typeMouvementCaisseRapport(operation)==="sortie";
}

function estAjustementPositifCaisseRapport(operation){
    return typeMouvementCaisseRapport(operation)==="ajustement"
        && categorieCaisseRapport(operation)==="ajustement positif";
}

function estAjustementNegatifCaisseRapport(operation){
    return typeMouvementCaisseRapport(operation)==="ajustement"
        && categorieCaisseRapport(operation)==="ajustement negatif";
}

function estTransfertSortantCaisseRapport(operation){
    return typeMouvementCaisseRapport(operation)==="transfert"
        && categorieCaisseRapport(operation)==="transfert sortant";
}

function estTransfertEntrantCaisseRapport(operation){
    return typeMouvementCaisseRapport(operation)==="transfert"
        && categorieCaisseRapport(operation)==="transfert entrant";
}

function variationTresorerieCaisseRapport(operation){
    const montant=montantCaisseRapport(operation);

    if(estEntreeCaisseRapport(operation)) return montant;
    if(estSortieCaisseRapport(operation)) return -montant;
    if(estAjustementPositifCaisseRapport(operation)) return montant;
    if(estAjustementNegatifCaisseRapport(operation)) return -montant;

    // Un transfert déplace la trésorerie entre comptes mais ne change pas
    // le solde global : il vaut donc 0 dans l'évolution globale.
    return 0;
}

function nombreOperationsMetierCaisseRapport(liste){
    let total=0;

    liste.forEach(operation=>{
        const type=typeMouvementCaisseRapport(operation);

        if(type==="entree" || type==="sortie" || type==="ajustement"){
            total+=1;
            return;
        }

        // Un transfert crée deux lignes physiques ; seule la ligne sortante
        // représente l'action métier, comme dans CaisseService.gs.
        if(estTransfertSortantCaisseRapport(operation)){
            total+=1;
        }
    });

    return total;
}

function soldeCompteCaisseAlaFinPeriodeRapport(liste,compte){
    const operations=liste
        .filter(x=>String(x?.compteCaisse||"").trim()===compte)
        .filter(x=>obtenirDateItemRapport(x,"caisse"))
        .sort((a,b)=>{
            const da=obtenirDateItemRapport(a,"caisse")?.getTime()||0;
            const db=obtenirDateItemRapport(b,"caisse")?.getTime()||0;
            if(da!==db) return da-db;
            return String(a?.heure||"").localeCompare(String(b?.heure||""));
        });

    if(!operations.length) return null;
    return num(operations[operations.length-1]?.soldeApres);
}


function paiementStatutExcluRapport(paiement){
    const statut=norm(paiement?.statut);
    return ["annule","annulee","rejete","rejetee"].includes(statut);
}

function paiementEstRemboursementRapport(paiement){
    const statut=norm(paiement?.statut);
    const nature=norm(paiement?.naturePaiement);
    return ["rembourse","remboursee"].includes(statut)
        || nature.includes("remboursement");
}

function montantSignePaiementRapport(paiement){
    if(paiementStatutExcluRapport(paiement)) return 0;
    const montant=Math.abs(num(paiement?.montant));
    return paiementEstRemboursementRapport(paiement)
        ? -montant
        : montant;
}

function montantEncaissePaiementRapport(paiement){
    const v=montantSignePaiementRapport(paiement);
    return v>0?v:0;
}

function montantRemboursePaiementRapport(paiement){
    if(paiementStatutExcluRapport(paiement)) return 0;
    return paiementEstRemboursementRapport(paiement)
        ? Math.abs(num(paiement?.montant))
        : 0;
}


function compteComptaRapport(ecriture){
    return norm(ecriture?.compte);
}

function estCompteComptaRapport(ecriture,prefixe){
    return compteComptaRapport(ecriture).startsWith(norm(prefixe));
}

function produitsComptaRapport(liste){
    const ventes=somme(
        liste.filter(x=>estCompteComptaRapport(x,"701 -")),
        x=>num(x.credit)-num(x.debit)
    );

    const retours=somme(
        liste.filter(x=>estCompteComptaRapport(x,"709 -")),
        x=>num(x.debit)-num(x.credit)
    );

    const autresProduits=somme(
        liste.filter(x=>estCompteComptaRapport(x,"758 -")),
        x=>num(x.credit)-num(x.debit)
    );

    return Math.max(0,ventes-retours+autresProduits);
}

function chargesComptaRapport(liste){
    const prefixesCharges=[
        "6611 -",
        "6222 -",
        "6052 -",
        "6051 -",
        "628 -",
        "627 -",
        "658 -"
    ];

    return somme(
        liste.filter(x=>prefixesCharges.some(prefixe=>estCompteComptaRapport(x,prefixe))),
        x=>Math.max(0,num(x.debit)-num(x.credit))
    );
}

function totalDebitsComptaRapport(liste){
    return somme(liste,x=>num(x.debit));
}

function totalCreditsComptaRapport(liste){
    return somme(liste,x=>num(x.credit));
}

function ecartComptableRapport(liste){
    return totalDebitsComptaRapport(liste)-totalCreditsComptaRapport(liste);
}


function estLivraisonLivreeRapport(livraison){
    return norm(livraison?.statutLivraison)==="cloturee"
        && norm(livraison?.resultatLivraison)==="livree";
}

function estLivraisonEchecDefinitifRapport(livraison){
    return norm(livraison?.statutLivraison)==="cloturee"
        && norm(livraison?.resultatLivraison)==="non-livree";
}

function estLivraisonReporteeRapport(livraison){
    return norm(livraison?.resultatLivraison)==="reportee"
        && norm(livraison?.statutLivraison)!=="cloturee";
}

function obtenirNomClientRapport(idClient, livraison){
    const direct=String(
        livraison?.nomClient ??
        livraison?.clientNom ??
        ""
    ).trim();

    if(direct) return direct;

    const id=String(idClient||"").trim();
    if(!id) return "Client";

    const clients=Array.isArray(donneesRapports?.clients)
        ? donneesRapports.clients
        : [];

    const client=clients.find(c=>{
        const cid=String(
            c?.idClient ??
            c?.["ID Client"] ??
            c?.id ??
            ""
        ).trim();
        return cid===id;
    });

    if(!client) return id;

    const nomComplet=String(
        client?.nomComplet ??
        client?.nomClient ??
        ""
    ).trim();

    if(nomComplet) return nomComplet;

    const nom=[
        client?.prenom ?? client?.["Prénom"] ?? "",
        client?.nom ?? client?.["Nom"] ?? ""
    ].filter(Boolean).join(" ").trim();

    return nom ||
        String(client?.raisonSociale ?? client?.["Raison Sociale"] ?? "").trim() ||
        id;
}

function obtenirNomLivreurRapport(idLivreur, livraison){
    const direct=String(
        livraison?.nomLivreur ??
        ""
    ).trim();

    if(direct) return direct;

    const id=String(idLivreur||"").trim();
    if(!id) return "Non affecté";

    const livreurs=Array.isArray(donneesRapports?.livreurs)
        ? donneesRapports.livreurs
        : [];

    const livreur=livreurs.find(l=>{
        const lid=String(
            l?.idLivreur ??
            l?.["ID Livreur"] ??
            l?.id ??
            ""
        ).trim();
        return lid===id;
    });

    if(!livreur) return id;

    const nomComplet=String(
        livreur?.nomComplet ??
        livreur?.["Nom complet"] ??
        ""
    ).trim();

    if(nomComplet) return nomComplet;

    const nom=[
        livreur?.prenom ?? livreur?.["Prénom"] ?? "",
        livreur?.nom ?? livreur?.["Nom"] ?? ""
    ].filter(Boolean).join(" ").trim();

    return nom || id;
}

function construireKpisRapport(type,liste){
    if(type==="ventes"){
        const ca=somme(liste,x=>num(x.montantNet??x.montantTTC??x.total));
        const encaisse=somme(liste,x=>num(x.montantPaye??x.montantEncaisse));
        const avoir=somme(liste,x=>num(x.montantAvoirUtilise));
        const regle=somme(liste,x=>num(x.montantRegle??(num(x.montantPaye)+num(x.montantAvoirUtilise))));
        const reste=Math.max(0,somme(liste,x=>num(x.resteAPayer)));
        const panier=liste.length?ca/liste.length:0;
        const produit=meilleurProduit(liste);
        return [
            kpi("Chiffre d'affaires",fcfa(ca),"Total des ventes de la période",String(liste.length)),
            kpi("Nombre de ventes",String(liste.length),"Ventes enregistrées","Ventes"),
            kpi("Panier moyen",fcfa(panier),"Montant moyen par vente","Moyenne"),
            kpi("Paiement encaissé",fcfa(encaisse),"Argent réellement reçu",ca?pct(encaisse/ca):"0 %"),
            kpi("Reste à encaisser",fcfa(reste),`Total réglé : ${fcfa(regle)}${avoir>0?` · dont ${fcfa(avoir)} d'avoir`:""}`,ca?pct(reste/ca):"0 %"),
            kpi("Produit le plus vendu",produit.nom||"—",produit.qte?`${produit.qte} unité(s) vendue(s)`:"Aucune ligne produit",produit.qte?"N° 1":"—")
        ];
    }
    if(type==="commandes"){
        const total=somme(liste,x=>montantCommandeRapport(x));
        const attente=liste.filter(x=>norm(x.statut).includes("attente")).length;
        const confirmees=liste.filter(x=>norm(x.statut).includes("confirm")).length;
        const annulees=liste.filter(x=>norm(x.statut).includes("annul")).length;
        return [
            kpi("Montant des commandes",fcfa(total),"Valeur totale sur la période",String(liste.length)),
            kpi("Nombre de commandes",String(liste.length),"Commandes enregistrées","Commandes"),
            kpi("En attente",String(attente),"Commandes restant à traiter","Attente"),
            kpi("Confirmées",String(confirmees),"Commandes confirmées","OK"),
            kpi("Annulées",String(annulees),"Commandes annulées","Annulées"),
            kpi("Montant moyen",fcfa(liste.length?total/liste.length:0),"Valeur moyenne par commande","Moyenne")
        ];
    }
    if(type==="clients"){
        const totalClients=liste.length;
        const actifs=liste.filter(x=>norm(x.statut)==="actif").length;
        const achats=somme(liste,x=>num(x.montantTotalAchats));
        const moyenne=totalClients?achats/totalClients:0;
        const credits=somme(liste,x=>num(x.creditClient??x.soldeAvoir));
        const commandes=somme(liste,x=>num(x.nombreCommandes));

        return [
            kpi("Nombre de clients",String(totalClients),"Clients inscrits sur la période","Clients"),
            kpi("Clients actifs",String(actifs),"Statut Actif sur la période",totalClients?pct(actifs/totalClients):"0 %"),
            kpi("Nouveaux clients",String(totalClients),"Inscriptions sur la période sélectionnée","Nouveaux"),
            kpi("Total des achats",fcfa(achats),`${fmt(commandes)} commande(s) associée(s)`,"Achats"),
            kpi("Moyenne achats / client",fcfa(moyenne),"Achats moyens par client sur la sélection","Moyenne"),
            kpi("Crédit client disponible",fcfa(credits),"Solde d'avoir disponible des clients sélectionnés","Avoirs")
        ];
    }
    if(type==="livreurs"){
        const points=[...lignesRapport]
            .sort((a,b)=>num(b.tauxReussitePeriode)-num(a.tauxReussitePeriode))
            .slice(0,14)
            .map(x=>[
                nomCompletLivreurRapport(x),
                num(x.tauxReussitePeriode)
            ]);

        const totalTerminees=somme(
            lignesRapport,
            x=>num(x.livraisonsReussiesPeriode)+num(x.livraisonsEchoueesPeriode)
        );
        const totalReussies=somme(
            lignesRapport,
            x=>num(x.livraisonsReussiesPeriode)
        );
        const tauxGlobal=totalTerminees?totalReussies/totalTerminees:0;

        texte("report-chart-total",pct(tauxGlobal));
        texte("report-chart-evolution","Taux de réussite");
        texte("report-chart-evolution-label",`${lignesRapport.length} livreur(s)`);

        if(!points.length){
            zone.innerHTML='<div class="report-chart-empty">Aucun livreur à afficher.</div>';
            return;
        }

        zone.innerHTML=`<div class="report-bars">${points.map(([label,v])=>`
            <div class="report-bar-item" title="${escapeHtml(label)} : ${escapeHtml(fmt(v))} %">
                <span class="report-bar-value">${escapeHtml(fmt(v))} %</span>
                <div class="report-bar" style="height:${Math.max(3,(Math.min(100,v)/100)*195)}px"></div>
                <span class="report-bar-label">${escapeHtml(label)}</span>
            </div>`).join("")}</div>`;
        return;
    }

    if(type==="stock"){
        const physique=somme(liste,x=>num(x.stockPhysique));
        const reserve=somme(liste,x=>num(x.stockReserve));
        const nonVendable=somme(liste,x=>num(x.stockNonVendable));
        const vendable=somme(liste,x=>num(x.stockVendable??x.stockDisponible));
        const faibles=liste.filter(x=>norm(x.etat)==="faible").length;
        const ruptures=liste.filter(x=>norm(x.etat)==="rupture").length;

        return [
            kpi("Stock physique",fmt(physique),"Quantité réellement présente",`${liste.length} référence(s)`),
            kpi("Stock réservé",fmt(reserve),"Quantité immobilisée pour des commandes","Réservé"),
            kpi("Stock non vendable",fmt(nonVendable),"Quantité présente mais non commercialisable","Non vendable"),
            kpi("Stock vendable",fmt(vendable),"Quantité réellement disponible à la vente","Disponible"),
            kpi("Stocks faibles",String(faibles),"Références sous le seuil d'alerte","Alerte"),
            kpi("Ruptures",String(ruptures),"Références sans stock vendable","Rupture")
        ];
    }

    if(type==="mouvementsStock"){
        const entrees=somme(liste,x=>{
            const v=variationPhysiqueMouvementRapport(x);
            return v>0?v:0;
        });
        const sorties=somme(liste,x=>{
            const v=variationPhysiqueMouvementRapport(x);
            return v<0?Math.abs(v):0;
        });
        const ajustements=liste.filter(x=>{
            const t=norm(x.typeMouvement);
            return t.includes("ajustement")||t.includes("inventaire");
        }).length;
        const produits=new Set(
            liste.map(x=>String(x.idProduit||x.produit||"").trim()).filter(Boolean)
        ).size;
        const variationNette=entrees-sorties;

        return [
            kpi("Nombre de mouvements",String(liste.length),"Mouvements enregistrés sur la période","Mouvements"),
            kpi("Entrées de stock",fmt(entrees),"Quantités ayant augmenté le stock physique","Entrées"),
            kpi("Sorties de stock",fmt(sorties),"Quantités ayant diminué le stock physique","Sorties"),
            kpi("Ajustements",String(ajustements),"Ajustements et inventaires enregistrés","Ajustements"),
            kpi("Variation nette",`${variationNette>0?"+":""}${fmt(variationNette)}`,"Entrées moins sorties physiques","Net"),
            kpi("Produits concernés",String(produits),"Références touchées sur la période","Produits")
        ];
    }

    if(type==="approvisionnements"){
        const actifs=liste.filter(estApprovisionnementFinancierActif);

        const montantGlobal=somme(
            actifs,
            x=>montantGlobalApprovisionnementRapport(x)
        );

        const montantPaye=somme(
            actifs,
            x=>num(x.montantPaye)
        );

        const reste=somme(
            actifs,
            x=>Math.max(0,num(x.resteAPayer))
        );

        const enTransit=liste.filter(
            x=>norm(x.statut)==="en transit"
        ).length;

        const recus=liste.filter(
            x=>norm(x.statut)==="recu"
        ).length;

        return [
            kpi(
                "Nombre d'approvisionnements",
                String(liste.length),
                "Approvisionnements enregistrés sur la période",
                "Approvisionnements"
            ),
            kpi(
                "Montant global engagé",
                fcfa(montantGlobal),
                "Produits + transport + frais divers, hors brouillons et annulés",
                `${actifs.length} engagé(s)`
            ),
            kpi(
                "Montant payé",
                fcfa(montantPaye),
                "Décaissements enregistrés sur les approvisionnements actifs",
                montantGlobal?pct(montantPaye/montantGlobal):"0 %"
            ),
            kpi(
                "Reste à payer",
                fcfa(reste),
                "Solde restant sur les approvisionnements actifs",
                montantGlobal?pct(reste/montantGlobal):"0 %"
            ),
            kpi(
                "En transit",
                String(enTransit),
                "Approvisionnements actuellement en transit",
                "Transit"
            ),
            kpi(
                "Réceptionnés",
                String(recus),
                "Approvisionnements entièrement reçus",
                "Reçus"
            )
        ];
    }

    if(type==="caisse"){
        const entrees=somme(liste,x=>estEntreeCaisseRapport(x)?montantCaisseRapport(x):0);
        const sorties=somme(liste,x=>estSortieCaisseRapport(x)?montantCaisseRapport(x):0);
        const ajustementsPositifs=somme(liste,x=>estAjustementPositifCaisseRapport(x)?montantCaisseRapport(x):0);
        const ajustementsNegatifs=somme(liste,x=>estAjustementNegatifCaisseRapport(x)?montantCaisseRapport(x):0);
        const ajustementNet=ajustementsPositifs-ajustementsNegatifs;
        const transferts=somme(liste,x=>estTransfertSortantCaisseRapport(x)?montantCaisseRapport(x):0);
        const variationNette=entrees-sorties+ajustementNet;
        const operationsMetier=nombreOperationsMetierCaisseRapport(liste);

        return [
            kpi(
                "Entrées",
                fcfa(entrees),
                "Encaissements ayant augmenté la trésorerie sur la période",
                `${liste.filter(estEntreeCaisseRapport).length} mouvement(s)`
            ),
            kpi(
                "Sorties",
                fcfa(sorties),
                "Décaissements ayant diminué la trésorerie sur la période",
                `${liste.filter(estSortieCaisseRapport).length} mouvement(s)`
            ),
            kpi(
                "Variation nette",
                `${variationNette>0?"+":""}${fcfa(variationNette)}`,
                "Entrées − sorties + ajustements nets ; transferts internes exclus",
                variationNette>=0?"Positive":"Négative"
            ),
            kpi(
                "Ajustement net",
                `${ajustementNet>0?"+":""}${fcfa(ajustementNet)}`,
                `Positifs : ${fcfa(ajustementsPositifs)} · Négatifs : ${fcfa(ajustementsNegatifs)}`,
                "Ajustements"
            ),
            kpi(
                "Transferts internes",
                fcfa(transferts),
                "Montant déplacé entre comptes, compté une seule fois par transfert",
                `${liste.filter(estTransfertSortantCaisseRapport).length} transfert(s)`
            ),
            kpi(
                "Opérations",
                String(operationsMetier),
                `${liste.length} mouvement(s) physique(s) sur la période`,
                "Actions métier"
            )
        ];
    }

    if(type==="paiements"){
        const valides=liste.filter(x=>!paiementStatutExcluRapport(x));
        const totalNet=somme(valides,x=>montantSignePaiementRapport(x));
        const totalEncaisseBrut=somme(valides,x=>montantEncaissePaiementRapport(x));
        const totalRembourse=somme(valides,x=>montantRemboursePaiementRapport(x));

        const totalVentes=somme(
            valides.filter(x=>norm(x.origine)==="vente"),
            x=>montantSignePaiementRapport(x)
        );

        const totalLivraisons=somme(
            valides.filter(x=>norm(x.origine)==="livraison"),
            x=>montantSignePaiementRapport(x)
        );

        const exclus=liste.length-valides.length;

        return [
            kpi(
                "Encaissement net",
                fcfa(totalNet),
                "Encaissements moins remboursements, hors paiements annulés ou rejetés",
                `${valides.length} valide(s)`
            ),
            kpi(
                "Encaissements",
                fcfa(totalEncaisseBrut),
                "Montant effectivement encaissé avant remboursements",
                "Entrées"
            ),
            kpi(
                "Remboursements",
                fcfa(totalRembourse),
                "Montants remboursés aux clients sur la période",
                "Sorties"
            ),
            kpi(
                "Paiements ventes",
                fcfa(totalVentes),
                "Encaissement net provenant directement des ventes",
                "Ventes"
            ),
            kpi(
                "Paiements livraisons",
                fcfa(totalLivraisons),
                "Encaissement net provenant des livraisons",
                "Livraisons"
            ),
            kpi(
                "Nombre de paiements",
                String(liste.length),
                `${valides.length} valide(s) · ${exclus} annulé(s)/rejeté(s)`,
                "Paiements"
            )
        ];
    }

    if(type==="comptabilite"){
        const produits=produitsComptaRapport(liste);
        const charges=chargesComptaRapport(liste);
        const resultat=produits-charges;
        const debits=totalDebitsComptaRapport(liste);
        const credits=totalCreditsComptaRapport(liste);
        const ecart=ecartComptableRapport(liste);

        return [
            kpi(
                "Produits",
                fcfa(produits),
                "Ventes nettes des retours + autres produits sur la période",
                "Produits"
            ),
            kpi(
                "Charges",
                fcfa(charges),
                "Charges comptables reconnues sur la période",
                "Charges"
            ),
            kpi(
                "Résultat",
                fcfa(resultat),
                "Produits moins charges",
                resultat>=0?"Bénéfice":"Perte"
            ),
            kpi(
                "Nombre d'écritures",
                String(liste.length),
                "Lignes comptables générées sur la période",
                "Écritures"
            ),
            kpi(
                "Total débits",
                fcfa(debits),
                "Somme des débits du journal sur la période",
                "Débits"
            ),
            kpi(
                "Équilibre comptable",
                Math.abs(ecart)<0.01?"Équilibré":"À vérifier",
                `Écart Débit - Crédit : ${fcfa(ecart)}`,
                Math.abs(ecart)<0.01?"OK":"Écart"
            )
        ];
    }

    if(type==="livraisons"){
        const aPreparer=liste.filter(x=>norm(x.statutLivraison)==="a-preparer").length;
        const enLivraison=liste.filter(x=>norm(x.statutLivraison)==="en-livraison").length;
        const livrees=liste.filter(estLivraisonLivreeRapport).length;

        const montantEncaisse=somme(
            liste,
            x=>Math.max(0,num(x.montantTotalEncaisse))
        );

        const resteAEncaisser=somme(
            liste,
            x=>Math.max(0,num(x.resteAEncaisser))
        );

        const missionsTerminees=liste.filter(
            x=>norm(x.statutLivraison)==="cloturee"
        ).length;

        const tauxReussite=missionsTerminees
            ? livrees/missionsTerminees
            : 0;

        return [
            kpi(
                "Nombre de livraisons",
                String(liste.length),
                "Livraisons enregistrées sur la période",
                "Livraisons"
            ),
            kpi(
                "À préparer",
                String(aPreparer),
                "Colis en attente de préparation",
                "Préparation"
            ),
            kpi(
                "En livraison",
                String(enLivraison),
                "Missions actuellement en cours",
                "En cours"
            ),
            kpi(
                "Livrées",
                String(livrees),
                "Livraisons clôturées avec résultat Livrée",
                missionsTerminees?pct(tauxReussite):"0 %"
            ),
            kpi(
                "Montant encaissé",
                fcfa(montantEncaisse),
                "Argent réellement encaissé sur les livraisons de la période",
                "Encaissé"
            ),
            kpi(
                "Reste à encaisser",
                fcfa(resteAEncaisser),
                "Solde restant à recevoir sur les livraisons de la période",
                "Créances"
            )
        ];
    }

    if(type==="livreurs"){
        const actifs=liste.filter(x=>norm(x.statut)==="actif").length;
        const missions=somme(liste,x=>num(x.missionsEffectueesPeriode));
        const reussies=somme(liste,x=>num(x.livraisonsReussiesPeriode));
        const echouees=somme(liste,x=>num(x.livraisonsEchoueesPeriode));
        const terminees=reussies+echouees;
        const taux=terminees?reussies/terminees:0;
        const encaisse=somme(liste,x=>num(x.montantEncaisseParLivreurPeriode));

        return [
            kpi(
                "Livreurs actifs",
                String(actifs),
                `${liste.length} livreur(s) enregistré(s)`,
                liste.length?pct(actifs/liste.length):"0 %"
            ),
            kpi(
                "Missions effectuées",
                fmt(missions),
                "Départs en livraison enregistrés sur la période",
                "Missions"
            ),
            kpi(
                "Livraisons réussies",
                fmt(reussies),
                "Missions clôturées avec résultat Livrée",
                "Réussies"
            ),
            kpi(
                "Livraisons échouées",
                fmt(echouees),
                "Missions clôturées avec résultat Non livrée",
                "Échecs"
            ),
            kpi(
                "Taux de réussite",
                pct(taux),
                "Réussites / missions terminées",
                `${fmt(terminees)} terminée(s)`
            ),
            kpi(
                "Montant encaissé",
                fcfa(encaisse),
                "Montants remis par les livreurs sur la période",
                "Encaissements"
            )
        ];
    }

    const montant=somme(liste,x=>num(x.montant??x.montantTotal??x.montantPaye??x.debit??x.credit));
    return [
        kpi("Nombre d'opérations",String(liste.length),"Éléments sur la période","Total"),
        kpi("Montant cumulé",fcfa(montant),"Selon les montants disponibles","Montant"),
        kpi("Valeur moyenne",fcfa(liste.length?montant/liste.length:0),"Moyenne par opération","Moyenne"),
        kpi("Éléments traités",String(liste.filter(x=>/pay|term|livr|valid|confirm|effectu/i.test(norm(x.statut))).length),"Statuts finalisés détectés","Traités"),
        kpi("Éléments en attente",String(liste.filter(x=>/attente|partiel|cours|prepar/i.test(norm(x.statut))).length),"Statuts en attente détectés","Attente"),
        kpi("Source",CONFIG_RAPPORTS[type]?.titre||type,"Données issues du module réel","Réel")
    ];
}

function kpi(titre,valeur,description,badge){return{titre,valeur,description,badge};}

function obtenirNomProduitRapport(idProduit, ligne){
    const direct=String(
        ligne?.designation ??
        ligne?.nomProduit ??
        ligne?.["Nom Produit"] ??
        ligne?.["Désignation"] ??
        ""
    ).trim();

    if(direct) return direct;

    const id=String(idProduit||"").trim();
    if(!id) return "Produit";

    const produits=Array.isArray(donneesRapports?.produits)
        ? donneesRapports.produits
        : [];

    const produit=produits.find(p=>{
        const pid=String(
            p?.idProduit ??
            p?.["ID Produit"] ??
            p?.id ??
            p?.ID ??
            ""
        ).trim();
        return pid===id;
    });

    const nom=String(
        produit?.nomProduit ??
        produit?.["Nom Produit"] ??
        produit?.designation ??
        produit?.["Désignation"] ??
        produit?.Designation ??
        produit?.nom ??
        produit?.Nom ??
        ""
    ).trim();

    return nom || id;
}

function meilleurProduit(ventes){
    const map=new Map();

    ventes.forEach(v=>{
        const details=
            Array.isArray(v.details) ? v.details :
            Array.isArray(v.lignes) ? v.lignes :
            Array.isArray(v.detailsVente) ? v.detailsVente :
            [];

        details.forEach(l=>{
            const id=String(l.idProduit||l["ID Produit"]||"").trim();
            const nom=obtenirNomProduitRapport(id,l);
            const q=num(l.quantiteVendue??l.quantite??l["Quantité Vendue"]);

            if(q<=0) return;
            map.set(nom,(map.get(nom)||0)+q);
        });
    });

    let nom="",qte=0;
    map.forEach((q,n)=>{
        if(q>qte){
            qte=q;
            nom=n;
        }
    });

    return {nom,qte};
}

function afficherGraphiquePrincipal(){
    const zone=document.getElementById("report-main-chart-area");
    if(!zone) return;
    const type=valeur("report-type-filter")||"ventes";

    if(type==="stock"){
        const points=[...lignesRapport]
            .sort((a,b)=>num(b.stockVendable??b.stockDisponible)-num(a.stockVendable??a.stockDisponible))
            .slice(0,14)
            .map(x=>[
                String(x.produit||x.designation||x.nomProduit||x.idProduit||"Produit"),
                num(x.stockVendable??x.stockDisponible)
            ]);

        const total=somme(lignesRapport,x=>num(x.stockVendable??x.stockDisponible));
        texte("report-chart-total",fmt(total));
        texte("report-chart-evolution","Stock vendable");
        texte("report-chart-evolution-label",`${lignesRapport.length} référence(s)`);

        if(!points.length){
            zone.innerHTML='<div class="report-chart-empty">Aucune donnée de stock à afficher.</div>';
            return;
        }

        const max=Math.max(...points.map(p=>p[1]),1);
        zone.innerHTML=`<div class="report-bars">${points.map(([label,v])=>`
            <div class="report-bar-item" title="${escapeHtml(label)} : ${escapeHtml(fmt(v))} unité(s)">
                <span class="report-bar-value">${escapeHtml(abregerNombre(v))}</span>
                <div class="report-bar" style="height:${Math.max(3,(v/max)*195)}px"></div>
                <span class="report-bar-label">${escapeHtml(label)}</span>
            </div>`).join("")}</div>`;
        return;
    }
    const mode=document.querySelector(".chart-period-btn.active")?.textContent?.trim().toLowerCase()||"jour";
    const groupes=new Map();

    lignesRapport.forEach(x=>{
        const d=obtenirDateItemRapport(x,type);
        if(!d) return;
        let cle;
        if(mode==="mois") cle=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        else if(mode==="semaine"){
            const lundi=new Date(d); lundi.setDate(d.getDate()-((d.getDay()+6)%7));
            cle=lundi.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"});
        }else cle=d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"});
        groupes.set(cle,(groupes.get(cle)||0)+valeurGraphiqueRapport(x,type));
    });

    const points=[...groupes.entries()].slice(-14);
    const total=points.reduce((s,p)=>s+p[1],0);
    texte("report-chart-total",type==="mouvementsStock"?fmt(total):(type==="clients"||type==="stock"||type==="livreurs"?String(lignesRapport.length):fcfa(total)));
    texte("report-chart-evolution","Données réelles");
    texte("report-chart-evolution-label",`${lignesRapport.length} élément(s) dans la période`);

    if(!points.length){
        zone.innerHTML='<div class="report-chart-empty">Aucune donnée datée à afficher pour cette période.</div>';
        return;
    }
    const max=Math.max(...points.map(p=>p[1]),1);
    zone.innerHTML=`<div class="report-bars">${points.map(([label,v])=>`
        <div class="report-bar-item" title="${escapeHtml(label)} : ${escapeHtml(type==="mouvementsStock"?fmt(v)+" unité(s)":fcfa(v))}">
            <span class="report-bar-value">${escapeHtml(abregerNombre(v))}</span>
            <div class="report-bar" style="height:${Math.max(3,(v/max)*195)}px"></div>
            <span class="report-bar-label">${escapeHtml(label)}</span>
        </div>`).join("")}</div>`;
}

function valeurGraphiqueRapport(x,type){
    if(type==="ventes") return num(x.montantNet??x.montantTTC??x.total);
    if(type==="commandes") return montantCommandeRapport(x);
    if(type==="caisse") return variationTresorerieCaisseRapport(x);
    if(type==="paiements") return montantSignePaiementRapport(x);
    if(type==="comptabilite") return num(x.debit);
    if(type==="livraisons") return 1;
    if(type==="approvisionnements") return estApprovisionnementFinancierActif(x)?montantGlobalApprovisionnementRapport(x):0;
    if(type==="mouvementsStock") return volumeMouvementRapport(x);
    return 1;
}

function afficherGraphiquesSecondaires(type,liste){
    afficherBreakdown("products-report-chart",construireRepartition(liste,type,"principal"));
    afficherBreakdown("payment-methods-chart",construireRepartition(liste,type,"secondaire"));
    const titre1=document.querySelector("#products-report-chart")?.closest(".chart-container")?.querySelector("h3");
    const titre2=document.querySelector("#payment-methods-chart")?.closest(".chart-container")?.querySelector("h3");
    if(titre1) titre1.textContent=
        type==="ventes" ? "Ventes par produit" :
        type==="stock" ? "Stock vendable par produit" :
        type==="mouvementsStock" ? "Volume par produit" :
        type==="approvisionnements" ? "Achats par fournisseur" :
        type==="caisse" ? "Flux par compte" :
        type==="paiements" ? "Encaissements par origine" :
        type==="comptabilite" ? "Montants par journal" :
        type==="livraisons" ? "Livraisons par livreur" :
        type==="livreurs" ? "Livraisons réussies par livreur" :
        "Répartition principale";

    if(titre2) titre2.textContent=
        type==="ventes" ? "Modes de paiement" :
        type==="stock" ? "Répartition par état" :
        type==="mouvementsStock" ? "Types de mouvement" :
        type==="approvisionnements" ? "Répartition par statut" :
        type==="caisse" ? "Origine des mouvements" :
        type==="paiements" ? "Modes de paiement" :
        type==="comptabilite" ? "Écritures par source" :
        type==="livraisons" ? "Résultats de livraison" :
        type==="livreurs" ? "Montants encaissés par livreur" :
        "Répartition par statut";
}

function construireRepartition(liste,type,mode){
    const map=new Map();
    if(type==="ventes" && mode==="principal"){
        liste.forEach(v=>{
            const details=
                Array.isArray(v.details) ? v.details :
                Array.isArray(v.lignes) ? v.lignes :
                Array.isArray(v.detailsVente) ? v.detailsVente :
                [];

            details.forEach(l=>{
                const id=String(l.idProduit||l["ID Produit"]||"").trim();
                const k=obtenirNomProduitRapport(id,l);
                const valeur=num(
                    l.sousTotal ??
                    (num(l.quantiteVendue??l.quantite) * num(l.prixVenteUnitaire??l.prixUnitaire))
                );
                map.set(k,(map.get(k)||0)+valeur);
            });
        });
    }else if(type==="ventes" && mode==="secondaire"){
        // Le bloc s'appelle "Modes de paiement" : on agrège donc réellement par mode de paiement.
        liste.forEach(x=>{
            const k=String(x.modePaiement||"Non renseigné").trim()||"Non renseigné";
            map.set(k,(map.get(k)||0)+1);
        });
    }else if(type==="stock" && mode==="principal"){
        liste.forEach(x=>{
            const k=String(x.produit||x.designation||x.nomProduit||x.idProduit||"Produit");
            map.set(k,(map.get(k)||0)+num(x.stockVendable??x.stockDisponible));
        });
    }else if(type==="stock" && mode==="secondaire"){
        liste.forEach(x=>{
            const k=String(x.etat||"Non renseigné");
            map.set(k,(map.get(k)||0)+1);
        });
    }else if(type==="mouvementsStock" && mode==="principal"){
        liste.forEach(x=>{
            const k=String(x.produit||x.idProduit||"Produit");
            map.set(k,(map.get(k)||0)+volumeMouvementRapport(x));
        });
    }else if(type==="mouvementsStock" && mode==="secondaire"){
        liste.forEach(x=>{
            const k=String(x.typeMouvement||"Non renseigné");
            map.set(k,(map.get(k)||0)+1);
        });
    }else if(type==="approvisionnements" && mode==="principal"){
        liste
            .filter(estApprovisionnementFinancierActif)
            .forEach(x=>{
                const k=obtenirNomFournisseurRapport(x.idFournisseur,x);
                map.set(
                    k,
                    (map.get(k)||0)+montantGlobalApprovisionnementRapport(x)
                );
            });
    }else if(type==="approvisionnements" && mode==="secondaire"){
        liste.forEach(x=>{
            const k=String(x.statut||"Non renseigné");
            map.set(k,(map.get(k)||0)+1);
        });
    }else if(type==="caisse" && mode==="principal"){
        liste.forEach(x=>{
            const k=String(x.compteCaisse||"Compte non renseigné").trim()||"Compte non renseigné";
            const montant=montantCaisseRapport(x);

            // Le graphique montre le volume réellement passé par chaque compte.
            // Les deux jambes d'un transfert sont conservées ici car elles
            // concernent deux comptes différents.
            map.set(k,(map.get(k)||0)+montant);
        });
    }else if(type==="caisse" && mode==="secondaire"){
        liste.forEach(x=>{
            const k=String(x.origine||"Caisse").trim()||"Caisse";
            map.set(k,(map.get(k)||0)+1);
        });
    }else if(type==="paiements" && mode==="principal"){
        liste
            .filter(x=>!paiementStatutExcluRapport(x))
            .forEach(x=>{
                const k=String(x.origine||"Non renseigné").trim()||"Non renseigné";
                map.set(k,(map.get(k)||0)+montantSignePaiementRapport(x));
            });
    }else if(type==="paiements" && mode==="secondaire"){
        liste
            .filter(x=>!paiementStatutExcluRapport(x))
            .forEach(x=>{
                const k=String(x.modePaiement||"Non renseigné").trim()||"Non renseigné";
                map.set(k,(map.get(k)||0)+Math.abs(montantSignePaiementRapport(x)));
            });
    }else if(type==="comptabilite" && mode==="principal"){
        liste.forEach(x=>{
            const k=String(x.journal||"Journal non renseigné").trim()||"Journal non renseigné";
            // On prend le débit pour mesurer le volume comptable sans additionner
            // débit + crédit d'une même écriture équilibrée.
            map.set(k,(map.get(k)||0)+num(x.debit));
        });
    }else if(type==="comptabilite" && mode==="secondaire"){
        liste.forEach(x=>{
            const k=String(x.source||"Source non renseignée").trim()||"Source non renseignée";
            map.set(k,(map.get(k)||0)+1);
        });
    }else if(type==="livraisons" && mode==="principal"){
        liste.forEach(x=>{
            const k=obtenirNomLivreurRapport(x.idLivreur,x);
            map.set(k,(map.get(k)||0)+1);
        });
    }else if(type==="livraisons" && mode==="secondaire"){
        liste.forEach(x=>{
            const resultat=String(x.resultatLivraison||"").trim();
            const k=resultat || (
                norm(x.statutLivraison)==="a-preparer" ? "À préparer" :
                norm(x.statutLivraison)==="prete-pour-depart" ? "Prête pour départ" :
                norm(x.statutLivraison)==="en-livraison" ? "En livraison" :
                norm(x.statutLivraison)==="annulee" ? "Annulée" :
                "Sans résultat"
            );
            map.set(k,(map.get(k)||0)+1);
        });
    }else if(type==="livreurs" && mode==="principal"){
        liste.forEach(x=>{
            const k=nomCompletLivreurRapport(x);
            map.set(k,num(x.livraisonsReussiesPeriode));
        });
    }else if(type==="livreurs" && mode==="secondaire"){
        liste.forEach(x=>{
            const k=nomCompletLivreurRapport(x);
            map.set(k,num(x.montantEncaisseParLivreurPeriode));
        });
    }else{
        liste.forEach(x=>{
            const k=mode==="secondaire"
                ? String(x.statutPaiement||x.statut||x.etat||"Non renseigné")
                : String(x.modePaiement||x.source||x.journal||x.categorie||"Autre");
            map.set(k,(map.get(k)||0)+1);
        });
    }
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,7);
}

function afficherBreakdown(id,data){
    const el=document.getElementById(id); if(!el)return;
    if(!data.length){el.innerHTML='<p class="chart-empty-message">Aucune donnée.</p>';return;}
    const max=Math.max(...data.map(x=>x[1]),1);
    el.innerHTML=data.map(([k,v])=>`<div class="report-breakdown-item">
        <span class="report-breakdown-label">${escapeHtml(k)}</span>
        <strong class="report-breakdown-value">${escapeHtml(fmt(v))}</strong>
        <div class="report-breakdown-track"><div class="report-breakdown-fill" style="width:${Math.max(3,(v/max)*100)}%"></div></div>
    </div>`).join("");
}

function afficherTableauRapport(type,liste){
    const schema=schemaTableRapport(type);
    const head=document.getElementById("report-details-table-head");
    const body=document.getElementById("report-details-table-body");
    const foot=document.getElementById("report-details-table-foot");
    if(!head||!body||!foot)return;

    head.innerHTML=`<tr>${schema.map(c=>`<th>${escapeHtml(c.label)}</th>`).join("")}</tr>`;
    if(!liste.length){
        body.innerHTML=`<tr><td colspan="${schema.length}" class="report-empty-cell">Aucune donnée pour les filtres sélectionnés.</td></tr>`;
    }else{
        body.innerHTML=liste.map(x=>`<tr>${schema.map(c=>`<td>${c.html?c.get(x):escapeHtml(String(c.get(x)??"—"))}</td>`).join("")}</tr>`).join("");
    }
    foot.innerHTML=`<tr><th colspan="${schema.length}">${liste.length} opération(s) affichée(s)</th></tr>`;
}

function schemaTableRapport(type){
    const money=v=>fcfa(num(v));
    const status=v=>`<span class="report-status">${escapeHtml(String(v||"—"))}</span>`;
    const schemas={
        ventes:[
            col("Date",x=>x.dateVente||x.date||"—"),col("Référence",x=>x.numeroVente||x.idVente||"—"),
            col("Client",x=>x.nomClient||x.clientNom||x.idClient||"—"),
            col("Montant",x=>money(x.montantNet??x.montantTTC)),
            col("Encaissé",x=>money(x.montantPaye)),col("Avoir",x=>money(x.montantAvoirUtilise)),
            col("Reste",x=>money(x.resteAPayer)),col("Mode",x=>x.modePaiement||"—"),
            col("Statut",x=>status(x.statutPaiement),true)
        ],
        commandes:[
            col("Date",x=>x.dateCommande||x.date||"—"),col("Référence",x=>x.numeroCommande||x.idCommande||"—"),
            col("Client",x=>x.nomClient||x.clientNom||x.idClient||"—"),col("Montant",x=>money(montantCommandeRapport(x))),
            col("Paiement",x=>x.modePaiementPrevu||x.modePaiement||"—"),col("Statut",x=>status(x.statut),true)
        ],
        clients:[
            col("Client",x=>x.nomComplet||x.nomClient||x.nom||x.idClient||"—"),col("Téléphone",x=>x.telephone||x.numeroTelephone||"—"),
            col("Email",x=>x.email||"—"),col("Avoir disponible",x=>money(x.creditClient??x.soldeAvoir)),
            col("Statut",x=>status(x.statut||"Actif"),true)
        ],
        stock:[
            col("Référence",x=>x.reference||x.idProduit||"—"),
            col("Produit",x=>x.produit||x.designation||x.nomProduit||x.idProduit||"—"),
            col("Physique",x=>fmt(num(x.stockPhysique))),
            col("Réservé",x=>fmt(num(x.stockReserve))),
            col("Non vendable",x=>fmt(num(x.stockNonVendable))),
            col("Vendable",x=>fmt(num(x.stockVendable??x.stockDisponible))),
            col("Seuil",x=>fmt(num(x.seuilAlerte))),
            col("État",x=>status(x.etat||"normal"),true),
            col("Dernière opération",x=>x.derniereOperation||"—"),
            col("Mise à jour",x=>x.derniereMiseAJour||"—")
        ],
        mouvementsStock:[
            col("Date",x=>x.date||"—"),
            col("Heure",x=>x.heure||"—"),
            col("Produit",x=>x.produit||x.idProduit||"—"),
            col("Type",x=>x.typeMouvement||"—"),
            col("Quantité",x=>{
                const q=num(x.quantite);
                return `${q>0?"+":""}${fmt(q)}`;
            }),
            col("Stock avant",x=>fmt(num(x.stockAvant))),
            col("Stock après",x=>fmt(num(x.stockApres))),
            col("Référence",x=>x.reference||x.referenceProduit||"—"),
            col("Module origine",x=>x.moduleOrigine||"—"),
            col("Utilisateur",x=>x.utilisateur||x.idUtilisateur||"SYSTEM"),
            col("Commentaire",x=>x.commentaire||"—")
        ],
        approvisionnements:[
            col("Date achat",x=>x.dateAchat||x.dateApprovisionnement||x.date||"—"),
            col("Référence",x=>x.idApprovisionnement||x.numeroApprovisionnement||"—"),
            col("Fournisseur",x=>obtenirNomFournisseurRapport(x.idFournisseur,x)),
            col("Transitaire",x=>obtenirNomTransitaireRapport(x.idTransitaire,x)),
            col("Montant produits",x=>money(x.montantTotal)),
            col("Transport",x=>money(x.fraisTransport)),
            col("Frais divers",x=>money(x.fraisDivers)),
            col("Montant global",x=>money(montantGlobalApprovisionnementRapport(x))),
            col("Payé",x=>money(x.montantPaye)),
            col("Reste à payer",x=>money(x.resteAPayer)),
            col("Mode paiement",x=>x.modePaiement||"—"),
            col("Statut paiement",x=>status(x.statutPaiement||"Non payé"),true),
            col("Statut appro.",x=>status(x.statut||"—"),true)
        ],
        caisse:[
            col("Date",x=>x.date||"—"),
            col("Heure",x=>x.heure||"—"),
            col("ID mouvement",x=>x.idMouvement||"—"),
            col("Référence",x=>x.reference||"—"),
            col("Compte",x=>x.compteCaisse||"—"),
            col("Type",x=>status(x.typeMouvement||x.type||"—"),true),
            col("Catégorie",x=>x.categorie||"—"),
            col("Montant",x=>money(x.montant)),
            col("Mode paiement",x=>x.modePaiement||"—"),
            col("Solde avant",x=>money(x.soldeAvant)),
            col("Solde après",x=>money(x.soldeApres)),
            col("Destination",x=>x.compteDestination||"—"),
            col("Origine",x=>x.origine||"Caisse"),
            col("ID origine",x=>x.idOrigine||"—"),
            col("Commentaire",x=>x.commentaire||"—")
        ],
        paiements:[
            col("Date",x=>x.datePaiement||"—"),
            col("Heure",x=>x.heurePaiement||"—"),
            col("ID paiement",x=>x.idPaiement||"—"),
            col("Origine",x=>x.origine||"—"),
            col("ID vente",x=>x.idVente||"—"),
            col("ID livraison",x=>x.idLivraison||"—"),
            col("Montant",x=>money(x.montant)),
            col("Impact net",x=>{
                const v=montantSignePaiementRapport(x);
                return `${v<0?"−":""}${money(Math.abs(v))}`;
            }),
            col("Mode paiement",x=>x.modePaiement||"—"),
            col("Référence",x=>x.referencePaiement||"—"),
            col("Nature",x=>x.naturePaiement||"—"),
            col("Statut",x=>status(x.statut||"—"),true),
            col("Utilisateur",x=>x.idUtilisateur||"—"),
            col("Commentaire",x=>x.commentaire||"—")
        ],
        comptabilite:[
            col("Date",x=>x.date||"—"),
            col("Journal",x=>x.journal||"—"),
            col("Référence",x=>x.reference||"—"),
            col("Compte",x=>x.compte||"—"),
            col("Libellé",x=>x.libelle||"—"),
            col("Débit",x=>num(x.debit)>0?money(x.debit):"—"),
            col("Crédit",x=>num(x.credit)>0?money(x.credit):"—"),
            col("Source",x=>x.source||"—"),
            col("Pièce",x=>x.piece||"—"),
            col("Utilisateur",x=>x.idUtilisateur||"SYSTEM")
        ],
        livraisons:[
            col("ID livraison",x=>x.idLivraison||"—"),
            col("Origine",x=>x.origine||"—"),
            col("Commande / Vente",x=>x.idCommande||x.idVente||"—"),
            col("Client",x=>obtenirNomClientRapport(x.idClient,x)),
            col("Livreur",x=>obtenirNomLivreurRapport(x.idLivreur,x)),
            col("Destination",x=>{
                const zone=[x.commune,x.zoneQuartier].filter(Boolean).join(" — ");
                return zone||x.adresseLivraison||"—";
            }),
            col("Date prévue",x=>x.dateLivraisonPrevue||"—"),
            col("Date effective",x=>x.dateLivraisonEffective||"—"),
            col("Statut",x=>status(x.statutLivraison||"—"),true),
            col("Résultat",x=>status(x.resultatLivraison||"—"),true),
            col("Frais livraison",x=>money(x.fraisLivraison)),
            col("À encaisser",x=>money(x.montantAEncaisser)),
            col("Encaissé",x=>money(x.montantTotalEncaisse)),
            col("Reste",x=>money(x.resteAEncaisser)),
            col("Statut encaissement",x=>status(x.statutEncaissement||"—"),true),
            col("Tentative",x=>String(Number(x.tentativeLivraison)||1)),
            col("Motif échec",x=>x.motifEchec||"—")
        ],
        livreurs:[
            col("Livreur",x=>nomCompletLivreurRapport(x)),
            col("Téléphone",x=>x.telephone||"—"),
            col("Zone",x=>x.zoneLivraison||x.zonesLivraison?.join?.(", ")||"—"),
            col("Transport",x=>x.moyenTransport||"—"),
            col("Statut",x=>status(x.statut||"—"),true),
            col("Missions",x=>fmt(x.missionsEffectueesPeriode)),
            col("Réussies",x=>fmt(x.livraisonsReussiesPeriode)),
            col("Échouées",x=>fmt(x.livraisonsEchoueesPeriode)),
            col("Reportées",x=>fmt(x.missionsReporteesPeriode)),
            col("Taux réussite",x=>`${fmt(x.tauxReussitePeriode)} %`),
            col("Frais réussis",x=>money(x.fraisLivraisonsReussiesPeriode)),
            col("Frais échecs",x=>money(x.fraisPrisEnChargeEntreprisePeriode)),
            col("Montant encaissé",x=>money(x.montantEncaisseParLivreurPeriode)),
            col("Écart",x=>money(x.ecartTotalPeriode)),
            col("Dernière livraison",x=>x.derniereLivraisonPeriode||"—")
        ]
    };
    return schemas[type]||[col("Donnée",x=>JSON.stringify(x))];
}
function col(label,get,html=false){return{label,get,html};}

function appliquerFiltresDetailRapport(){
    const type=valeur("report-type-filter")||"ventes";
    const recherche=norm(document.getElementById("report-details-search-input")?.value||"");
    const statut=norm(valeur("report-status-filter"));
    const paiement=norm(valeur("report-payment-filter"));
    lignesRapportFiltrees=lignesRapport.filter(x=>{
        const contenu=norm(JSON.stringify(x));
        if(recherche&&!contenu.includes(recherche))return false;
        if(statut){
            const valeurStatut=type==="livraisons"
                ? `${x.statutLivraison||""} ${x.resultatLivraison||""}`
                : (x.statutPaiement||x.statut);
            if(!norm(valeurStatut).includes(statut.replace("partielle","partiel")))return false;
        }
        if(paiement){
            const valeurPaiement=type==="livraisons"
                ? x.statutEncaissement
                : x.modePaiement;
            if(!norm(valeurPaiement).includes(paiement.replace("-"," ")))return false;
        }
        return true;
    });
    afficherTableauRapport(valeur("report-type-filter")||"ventes",lignesRapportFiltrees);
}

function appliquerRechercheHeaderRapport(){
    const q=document.querySelector(".header .search-input")?.value||"";
    const local=document.getElementById("report-details-search-input");
    if(local)local.value=q;
    appliquerFiltresDetailRapport();
}

function adapterFiltresDetail(type){
    const statut=document.getElementById("report-status-filter");
    const paiement=document.getElementById("report-payment-filter");
    if(statut) statut.hidden=["clients","stock","mouvementsStock","comptabilite"].includes(type);
    if(paiement) paiement.hidden=!["ventes","commandes","paiements","approvisionnements","caisse","livraisons"].includes(type);
}

function mettreAJourPeriodePersonnalisee(){
    document.body.classList.toggle("report-custom-period",valeur("report-period-filter")==="personnalisee");
}

function exporterRapportCSV(){
    if(!lignesRapportFiltrees.length){toastRapport("Aucune donnée à exporter.","info");return;}
    const type=valeur("report-type-filter")||"ventes";
    const schema=schemaTableRapport(type);
    const lignes=[
        schema.map(c=>c.label),
        ...lignesRapportFiltrees.map(x=>schema.map(c=>String(c.get(x)??"").replace(/<[^>]*>/g,"")))
    ];
    const csv="\uFEFF"+lignes.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=`rapport-${type}-${new Date().toISOString().slice(0,10)}.csv`;a.click();
    URL.revokeObjectURL(url);
}

function afficherEtatVideRapport(message){
    for(let i=1;i<=6;i++){texte(`report-kpi-${i}-value`,"—");texte(`report-kpi-${i}-description`,message||"Aucune donnée");}
    const body=document.getElementById("report-details-table-body");
    if(body)body.innerHTML=`<tr><td class="report-empty-cell">${escapeHtml(message||"Aucune donnée.")}</td></tr>`;
}

function definirChargementRapport(actif){
    document.querySelectorAll(".report-kpi-value").forEach(x=>x.classList.toggle("is-loading",actif));
    if(actif) document.querySelectorAll(".report-kpi-value").forEach(x=>x.textContent="Chargement…");
}

function convertirDateRapport(v){
    if(!v)return null;
    if(v instanceof Date && !isNaN(v))return new Date(v);
    const s=String(v).trim();
    let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m)return new Date(+m[3],+m[2]-1,+m[1]);
    const d=new Date(s);return isNaN(d)?null:d;
}
function valeur(id){return document.getElementById(id)?.value||"";}
function texte(id,v){const e=document.getElementById(id);if(e)e.textContent=v??"";}
function num(v){if(typeof v==="number")return isFinite(v)?v:0;const n=Number(String(v??"").replace(/FCFA/gi,"").replace(/[\s\u00a0\u202f]/g,"").replace(",","."));return isFinite(n)?n:0;}
function somme(l,f){return l.reduce((s,x)=>s+num(f(x)),0);}
function fmt(v){return new Intl.NumberFormat("fr-FR",{maximumFractionDigits:2}).format(num(v));}
function fcfa(v){return `${new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(num(v))} FCFA`;}
function pct(v){return `${new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(num(v)*100)} %`;}
function norm(v){return String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();}
function abregerNombre(v){v=num(v);if(Math.abs(v)>=1e6)return `${(v/1e6).toFixed(1).replace(".",",")} M`;if(Math.abs(v)>=1e3)return `${(v/1e3).toFixed(0)} k`;return fmt(v);}
function escapeHtml(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function toastRapport(message,type){if(typeof showToast==="function")showToast(message,type);else console.log(message);}
