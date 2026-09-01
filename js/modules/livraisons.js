/* VISIBL ERP — Module Livraisons */
let livraisonsChargees=[],livraisonsFiltrees=[],livraisonOuverte=null,pageLivraisonsActuelle=1,taillePageLivraisons=10;
let catalogueClientsLivraisons=[],catalogueLivreursLivraisons=[];
let parametresAlertesLivraison={delaiJours:1,heure:"09:00"};
let parametresFinanceLivraisons={formatMontant:"nombre-devise",nombreDecimales:0,libelleDevise:"FCFA",modeEspeces:true,modeMobileMoney:true,modeVirement:true,modeCheque:true,modeCarteBancaire:true,autoriserPaiementsPartiels:true,autoriserVentesCredit:true};

document.addEventListener("DOMContentLoaded",async()=>{initLivraisons();await chargerParametresFinanceLivraisons();chargerLivraisons();});

function initLivraisons(){
initialiserMenuActionsLivraisons();
initialiserParametresAlertesLivraison();
["deliveries-search-input","delivery-status-filter","delivery-result-filter","delivery-payment-filter"].forEach(id=>document.getElementById(id)?.addEventListener(id==="deliveries-search-input"?"input":"change",()=>appliquerFiltresLivraisons()));
document.getElementById("reset-delivery-filters")?.addEventListener("click",()=>{["deliveries-search-input","delivery-status-filter","delivery-result-filter","delivery-payment-filter"].forEach(id=>setVal(id,""));appliquerFiltresLivraisons();});
document.getElementById("refresh-deliveries-btn")?.addEventListener("click",()=>chargerLivraisons());
document.getElementById("print-deliveries-btn")?.addEventListener("click",()=>window.print());
document.getElementById("export-deliveries-btn")?.addEventListener("click",exporterLivraisonsCSV);
document.getElementById("deliveries-table-body")?.addEventListener("click",gererActionTable);
document.getElementById("deliveries-per-page")?.addEventListener("change",e=>{taillePageLivraisons=Number(e.target.value)||10;pageLivraisonsActuelle=1;afficherTableau();});
document.getElementById("previous-delivery-page-btn")?.addEventListener("click",()=>{if(pageLivraisonsActuelle>1){pageLivraisonsActuelle--;afficherTableau();}});
document.getElementById("next-delivery-page-btn")?.addEventListener("click",()=>{const t=Math.max(1,Math.ceil(livraisonsFiltrees.length/taillePageLivraisons));if(pageLivraisonsActuelle<t){pageLivraisonsActuelle++;afficherTableau();}});
document.getElementById("close-delivery-view-modal")?.addEventListener("click",()=>closeModal("delivery-view-modal"));
document.getElementById("close-delivery-view-footer")?.addEventListener("click",()=>closeModal("delivery-view-modal"));
document.querySelectorAll("[data-close-modal]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.closeModal)));
["delivery-view-modal","delivery-prepare-modal","delivery-departure-modal","delivery-return-modal","delivery-payment-modal","delivery-alert-settings-modal"].forEach(id=>document.getElementById(id)?.addEventListener("click",e=>{if(e.target.id===id)closeModal(id);}));
document.getElementById("confirm-delivery-preparation-btn")?.addEventListener("click",e=>actionSimple("validerPreparationLivraison","prepare-delivery-id","delivery-prepare-modal",e.currentTarget));
document.getElementById("confirm-delivery-departure-btn")?.addEventListener("click",e=>actionSimple("confirmerDepartLivraison","departure-delivery-id","delivery-departure-modal",e.currentTarget));
document.getElementById("delivery-return-result")?.addEventListener("change",majRetourUI);
document.getElementById("delivery-return-product-state")?.addEventListener("change",majRetourUI);
document.querySelectorAll('input[name="delivery-failure-action"]').forEach(r=>r.addEventListener("change",majRetourUI));
document.getElementById("confirm-delivery-return-btn")?.addEventListener("click",enregistrerRetourLivreurUI);
document.getElementById("open-delivery-payment-btn")?.addEventListener("click",ouvrirEncaissement);
document.getElementById("save-delivery-payment-btn")?.addEventListener("click",enregistrerEncaissement);
document.getElementById("delivery-credit-used")?.addEventListener("input",()=>actualiserAvoirEncaissementLivraison("delivery"));
document.getElementById("return-delivery-credit-used")?.addEventListener("input",()=>actualiserAvoirEncaissementLivraison("return"));
document.getElementById("delivery-use-max-credit-btn")?.addEventListener("click",()=>utiliserAvoirMaximumLivraison("delivery"));
document.getElementById("return-use-max-credit-btn")?.addEventListener("click",()=>utiliserAvoirMaximumLivraison("return"));
}


function initialiserMenuActionsLivraisons(){
const trigger=document.getElementById("deliveries-actions-trigger");
const menu=document.getElementById("deliveries-actions-dropdown");
if(!trigger||!menu)return;
trigger.addEventListener("click",e=>{
e.stopPropagation();
const ouvrir=Boolean(menu.hidden);
menu.hidden=!ouvrir;
trigger.setAttribute("aria-expanded",String(ouvrir));
});
menu.addEventListener("click",e=>{
e.stopPropagation();
if(e.target.closest("button")){
menu.hidden=true;
trigger.setAttribute("aria-expanded","false");
}
});
document.addEventListener("click",e=>{
if(!e.target.closest(".deliveries-actions-menu")){
menu.hidden=true;
trigger.setAttribute("aria-expanded","false");
}
});
}


function extraireListeLivraison(resultat,cle){
if(!resultat?.success)return[];
if(Array.isArray(resultat.data))return resultat.data;
if(Array.isArray(resultat.data?.[cle]))return resultat.data[cle];
if(Array.isArray(resultat?.[cle]))return resultat[cle];
return[];
}
function nomClientLivraisonParId(id){
const x=catalogueClientsLivraisons.find(c=>String(c.idClient||c["ID Client"]||"")===String(id||""));
if(!x)return"";
const nom=[x.prenom||x["Prénom"]||"",x.nom||x["Nom"]||""].filter(Boolean).join(" ").trim();
return nom||x.raisonSociale||x["Raison Sociale"]||"";
}
function nomLivreurLivraisonParId(id){
const x=catalogueLivreursLivraisons.find(l=>String(l.idLivreur||l["ID Livreur"]||"")===String(id||""));
if(!x)return"";
return [x.prenom||x["Prénom"]||"",x.nom||x["Nom"]||""].filter(Boolean).join(" ").trim()||
x.nomComplet||x["Nom complet"]||"";
}
function enrichirLivraisonNoms(l){
return {...l,
nomClient:l.nomClient||nomClientLivraisonParId(l.idClient),
nomLivreur:l.nomLivreur||nomLivreurLivraisonParId(l.idLivreur)
};
}


function clientLivraisonParId(id){
return catalogueClientsLivraisons.find(c=>String(c.idClient||c["ID Client"]||"").trim()===String(id||"").trim())||null;
}
function creditLibreClientLivraison(livraison){
const client=clientLivraisonParId(livraison?.idClient);
if(!client)return 0;
return Math.max(0,num(client.creditClient??client.soldeAvoir??client["Crédit client"]??client["Credit client"]??0));
}
function configAvoirLivraison(prefix){
const retour=prefix==="return";
return{champ:retour?"return-delivery-credit-used":"delivery-credit-used",affichage:retour?"return-delivery-credit-available":"delivery-credit-available",apres:retour?"return-delivery-after-credit":"delivery-after-credit",panel:retour?"return-delivery-credit-panel":"delivery-credit-panel"};
}
function preparerAvoirEncaissementLivraison(livraison,prefix){
const cfg=configAvoirLivraison(prefix),disponible=creditLibreClientLivraison(livraison),reste=Math.max(0,num(livraison?.resteAEncaisser)),maximum=Math.max(0,Math.min(disponible,reste));
setVal(cfg.champ,"0");const champ=document.getElementById(cfg.champ);if(champ)champ.max=String(maximum);
text(cfg.affichage,fcfa(disponible));document.getElementById(cfg.panel)?.classList.toggle("is-zero",disponible<=0);
actualiserAvoirEncaissementLivraison(prefix,livraison);
}
function actualiserAvoirEncaissementLivraison(prefix,livraison){
livraison=livraison||livraisonOuverte;if(!livraison)return;
const cfg=configAvoirLivraison(prefix),disponible=creditLibreClientLivraison(livraison),reste=Math.max(0,num(livraison.resteAEncaisser)),maximum=Math.max(0,Math.min(disponible,reste));
let utilise=Math.max(0,num(val(cfg.champ)));utilise=Math.min(utilise,maximum);setVal(cfg.champ,String(utilise));text(cfg.apres,fcfa(Math.max(0,reste-utilise)));
}
function utiliserAvoirMaximumLivraison(prefix){
if(!livraisonOuverte)return;const cfg=configAvoirLivraison(prefix),disponible=creditLibreClientLivraison(livraisonOuverte),reste=Math.max(0,num(livraisonOuverte.resteAEncaisser));
setVal(cfg.champ,String(Math.max(0,Math.min(disponible,reste))));actualiserAvoirEncaissementLivraison(prefix,livraisonOuverte);
}

function appliquerParametresAlertesLivraison(p){
parametresAlertesLivraison={
delaiJours:Number(p?.delaiJours??p?.joursAvant??1)||0,
heure:String(p?.heure||"09:00").slice(0,5)
};
setVal("delivery-alert-days",String(parametresAlertesLivraison.delaiJours));
setVal("delivery-alert-time",parametresAlertesLivraison.heure);
}
function initialiserParametresAlertesLivraison(){
document.getElementById("deliveries-alert-btn")?.addEventListener("click",()=>{
/*
 * Ouverture immédiate : on utilise d'abord les paramètres déjà chargés
 * avec le module Livraisons. Aucun appel API ne bloque l'affichage.
 */
appliquerParametresAlertesLivraison(parametresAlertesLivraison);
openModal("delivery-alert-settings-modal");

/*
 * Rafraîchissement discret en arrière-plan pour rester synchronisé
 * avec le backend sans ralentir l'ouverture de la fenêtre.
 */
apiGet("getParametresAlertesLivraison")
.then(r=>{
if(r?.success)appliquerParametresAlertesLivraison(r.parametres||r.data||r);
})
.catch(()=>{});
});
document.getElementById("save-delivery-alert-settings-btn")?.addEventListener("click",enregistrerParametresAlertesLivraison);
}
async function enregistrerParametresAlertesLivraison(){
const bouton=document.getElementById("save-delivery-alert-settings-btn");
if(bouton?.disabled)return;
const delaiJours=Number(val("delivery-alert-days"));
const heure=val("delivery-alert-time")||"09:00";
if(![0,1,2,7].includes(delaiJours))return msg("delivery-alert-settings-message","Délai de rappel invalide.");
if(!/^\d{2}:\d{2}$/.test(heure))return msg("delivery-alert-settings-message","Heure de rappel invalide.");
bouton.disabled=true;
try{
const r=await apiPost("saveParametresAlertesLivraison",{delaiJours,heure,idUtilisateur:userId()});
if(!r?.success)throw new Error(r?.message||"Impossible d'enregistrer les alertes.");
appliquerParametresAlertesLivraison(r.parametres||{delaiJours,heure});
closeModal("delivery-alert-settings-modal");
mettreAJourNotificationsAlertesLivraison();
toast("Paramètres d'alerte enregistrés.","success");
}catch(e){msg("delivery-alert-settings-message",e.message)}
finally{bouton.disabled=false}
}
function dateLocaleLivraison(v){
if(!v)return null;
let m=String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
const d=new Date(v);return isNaN(d)?null:d;
}
function obtenirAlertesLivraisonActives(){
const maintenant=new Date();
const [hh,mm]=String(parametresAlertesLivraison.heure||"09:00").split(":").map(Number);
return livraisonsChargees.filter(l=>{
if(["cloturee","annulee"].includes(norm(l.statutLivraison)))return false;
const date=dateLocaleLivraison(l.dateLivraisonPrevue);if(!date)return false;
const fin=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1);
if(maintenant>=fin)return true;
const alerte=new Date(date);alerte.setDate(alerte.getDate()-Number(parametresAlertesLivraison.delaiJours||0));alerte.setHours(hh||0,mm||0,0,0);
return maintenant>=alerte;
}).sort((x,y)=>dateLocaleLivraison(x.dateLivraisonPrevue)-dateLocaleLivraison(y.dateLivraisonPrevue));
}

function mettreAJourNotificationsAlertesLivraison(){
const panel=document.getElementById("notification-panel"),badge=document.querySelector(".notification-badge");if(!panel)return;
panel.querySelectorAll(".delivery-alert-notification").forEach(x=>x.remove());
const alertes=obtenirAlertesLivraisonActives();
alertes.forEach(l=>{
const p=infoPrioriteDateLivraison(l),retard=p?.type==="overdue",d=document.createElement("div");
d.className="notification-item delivery-alert-notification"+(retard?" is-overdue":"");
d.innerHTML=`<span class="notification-item-icon">${retard?"⚠️":"⏰"}</span><div><strong>${retard?"Livraison en retard":"Livraison à préparer"}</strong><p>${esc(l.nomClient||l.idClient||"Client")} — ${retard?esc(p.label.toLowerCase()):"prévue le "+esc(dateFr(l.dateLivraisonPrevue))}.</p><small>${esc(l.idLivraison||"")}</small></div>`;
panel.appendChild(d);
});
if(badge){const autres=panel.querySelectorAll(".notification-item:not(.delivery-alert-notification)").length,total=autres+alertes.length;badge.textContent=String(total);badge.hidden=!total;}
}

async function chargerLivraisons(){
definirEtatChargementKPILivraisons(true);
try{
const [r,rc,rl,rp]=await Promise.all([
apiGet("getLivraisons"),
apiGet("getClients").catch(()=>null),
apiGet("getLivreurs").catch(()=>null),
apiGet("getParametresAlertesLivraison").catch(()=>null)
]);
if(!r?.success)throw new Error(r?.message||"Impossible de charger les livraisons.");
catalogueClientsLivraisons=extraireListeLivraison(rc,"clients");
catalogueLivreursLivraisons=extraireListeLivraison(rl,"livreurs");
if(rp?.success)appliquerParametresAlertesLivraison(rp.parametres||rp.data||rp);
livraisonsChargees=(Array.isArray(r.data)?r.data:(r.livraisons||[])).map(enrichirLivraisonNoms);
majKPI();definirEtatChargementKPILivraisons(false);appliquerFiltresLivraisons();
mettreAJourNotificationsAlertesLivraison();
}catch(e){livraisonsChargees=[];livraisonsFiltrees=[];definirEtatChargementKPILivraisons(false);afficherTableau();toast(e.message||"Erreur de chargement","error");}
}

function appliquerFiltresLivraisons(){
const q=norm(val("deliveries-search-input")),s=norm(val("delivery-status-filter")),res=norm(val("delivery-result-filter")),p=norm(val("delivery-payment-filter"));
livraisonsFiltrees=livraisonsChargees.filter(l=>{const t=norm([l.idLivraison,l.idCommande,l.idVente,l.idClient,l.idLivreur,l.commune,l.zoneQuartier,l.adresseLivraison].join(" "));return(!q||t.includes(q))&&(!s||norm(l.statutLivraison)===s)&&(!res||norm(l.resultatLivraison)===res)&&(!p||norm(l.statutEncaissement)===p);});
text("filtered-delivery-count",livraisonsFiltrees.length);pageLivraisonsActuelle=1;afficherTableau();
}


function definirEtatChargementKPILivraisons(actif){
["total-deliveries-value","deliveries-to-prepare-value","deliveries-in-progress-value","deliveries-completed-value"].forEach(id=>{
const el=document.getElementById(id);if(!el)return;
el.classList.toggle("is-loading",Boolean(actif));
el.setAttribute("aria-busy",String(Boolean(actif)));
});
}

function majKPI(){
text("total-deliveries-value",livraisonsChargees.length);
text("deliveries-to-prepare-value",livraisonsChargees.filter(l=>norm(l.statutLivraison)==="a-preparer").length);
text("deliveries-in-progress-value",livraisonsChargees.filter(l=>norm(l.statutLivraison)==="en-livraison").length);
text("deliveries-completed-value",livraisonsChargees.filter(l=>norm(l.statutLivraison)==="cloturee"&&norm(l.resultatLivraison)==="livree").length);
}

function infoPrioriteDateLivraison(l){
if(["cloturee","annulee"].includes(norm(l?.statutLivraison)))return null;
const d=dateLocaleLivraison(l?.dateLivraisonPrevue);if(!d)return null;
const a=new Date();a.setHours(0,0,0,0);const c=new Date(d);c.setHours(0,0,0,0);
const jours=Math.round((c-a)/86400000);
if(jours<0){const n=Math.abs(jours);return{type:"overdue",label:`En retard · ${n} jour${n>1?"s":""}`,joursRetard:n}}
if(jours===0)return{type:"today",label:"Aujourd’hui",joursRetard:0};
if(jours===1)return{type:"tomorrow",label:"Demain",joursRetard:0};
return null;
}
function libellePeriodeDateLivraison(l){
if(["cloturee","annulee"].includes(norm(l?.statutLivraison))) {
const d=dateLocaleLivraison(l?.dateLivraisonPrevue);
if(!d)return "—";
const a=new Date();a.setHours(0,0,0,0);const c=new Date(d);c.setHours(0,0,0,0);
const jours=Math.round((c-a)/86400000);
if(jours===0)return "Aujourd’hui";
if(jours===1)return "Demain";
if(jours===2)return "Après-demain";
if(jours>2&&jours<7)return `Dans ${jours} jours`;
if(jours===7)return "Dans 1 semaine";
if(jours>7&&jours%7===0)return `Dans ${jours/7} semaines`;
if(jours>7)return `Dans ${jours} jours`;
if(jours===-1)return "Hier";
return jours<0?`Il y a ${Math.abs(jours)} jours`:"—";
}
const d=dateLocaleLivraison(l?.dateLivraisonPrevue);if(!d)return "—";
const a=new Date();a.setHours(0,0,0,0);const c=new Date(d);c.setHours(0,0,0,0);
const jours=Math.round((c-a)/86400000);
if(jours<0){const n=Math.abs(jours);return `En retard · ${n} jour${n>1?"s":""}`;}
if(jours===0)return "Aujourd’hui";
if(jours===1)return "Demain";
if(jours===2)return "Après-demain";
if(jours>2&&jours<7)return `Dans ${jours} jours`;
if(jours===7)return "Dans 1 semaine";
if(jours>7&&jours%7===0)return `Dans ${jours/7} semaines`;
return `Dans ${jours} jours`;
}
function htmlDatePrevueLivraison(l){
const p=infoPrioriteDateLivraison(l);
const libelle=libellePeriodeDateLivraison(l);
const type=p?.type||"future";
return `<div class="delivery-date-cell"><span class="delivery-date-relative ${type!=="future"?`delivery-date-priority is-${type}`:""}">${esc(libelle)}</span></div>`;
}

function afficherTableau(){
const tbody=document.getElementById("deliveries-table-body");if(!tbody)return;
const totalPages=Math.max(1,Math.ceil(livraisonsFiltrees.length/taillePageLivraisons));pageLivraisonsActuelle=Math.min(pageLivraisonsActuelle,totalPages);
const debut=(pageLivraisonsActuelle-1)*taillePageLivraisons,liste=livraisonsFiltrees.slice(debut,debut+taillePageLivraisons);
if(!liste.length)tbody.innerHTML='<tr><td colspan="12" class="empty-table">Aucune livraison trouvée.</td></tr>';
else tbody.innerHTML=liste.map(l=>{const s=norm(l.statutLivraison||"a-preparer"),r=norm(l.resultatLivraison),o=norm(l.origine)||"commande";let actions=`<button type="button" data-a="view" data-id="${esc(l.idLivraison)}">👁️ <span>Voir</span></button>`;
if(s==="a-preparer")actions+=`<button type="button" data-a="prepare" data-id="${esc(l.idLivraison)}">📦 <span>Valider la préparation</span></button>`;
if(s==="prete-pour-depart")actions+=`<button type="button" data-a="departure" data-id="${esc(l.idLivraison)}">🛵 <span>Confirmer le départ</span></button>`;
if(s==="en-livraison")actions+=`<button type="button" data-a="return" data-id="${esc(l.idLivraison)}">↩️ <span>Enregistrer le retour</span></button>`;
const menu=`<div class="delivery-row-menu"><button type="button" class="delivery-row-menu-trigger" data-delivery-actions-toggle="${esc(l.idLivraison)}" aria-expanded="false" aria-label="Actions de la livraison">⋮</button><div class="delivery-row-menu-dropdown" data-delivery-actions-menu="${esc(l.idLivraison)}" hidden>${actions}</div></div>`;
return `<tr><td><strong>${esc(l.idLivraison||"—")}</strong><br><small>${esc(l.idCommande||l.idVente||"—")}</small></td><td>${esc(l.nomClient||l.idClient||"—")}</td><td><strong>${esc(l.commune||"—")}</strong><br><small>${esc(l.zoneQuartier||"")}</small></td><td>${esc(l.nomLivreur||l.idLivreur||"Non affecté")}</td><td>${htmlDatePrevueLivraison(l)}</td><td><span class="status-badge status-${s}">${esc(label(l.statutLivraison))}</span></td><td>${r?`<span class="result-badge result-${r}">${esc(label(l.resultatLivraison))}</span>`:"—"}</td><td>${fcfa(l.montantAEncaisser)}</td><td>${fcfa(l.montantTotalEncaisse)}</td><td>${fcfa(l.resteAEncaisser)}</td><td>${Number(l.tentativeLivraison)||1}</td><td class="delivery-actions-cell">${menu}</td></tr>`}).join("");
afficherPagination(totalPages);
}

function afficherPagination(totalPages){
text("deliveries-pagination-summary",`Page ${pageLivraisonsActuelle} / ${totalPages}`);
const prev=document.getElementById("previous-delivery-page-btn"),next=document.getElementById("next-delivery-page-btn");if(prev)prev.disabled=pageLivraisonsActuelle<=1;if(next)next.disabled=pageLivraisonsActuelle>=totalPages;
const z=document.getElementById("deliveries-page-buttons");if(!z)return;z.innerHTML=Array.from({length:totalPages},(_,i)=>i+1).slice(0,10).map(p=>`<button class="pagination-btn ${p===pageLivraisonsActuelle?"active":""}" data-page="${p}">${p}</button>`).join("");z.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{pageLivraisonsActuelle=Number(b.dataset.page);afficherTableau();}));
}

function fermerMenusActionsLivraisons(){
document.querySelectorAll("[data-delivery-actions-menu]").forEach(menu=>menu.hidden=true);
document.querySelectorAll("[data-delivery-actions-toggle]").forEach(btn=>btn.setAttribute("aria-expanded","false"));
}
function gererActionTable(e){
const toggle=e.target.closest("[data-delivery-actions-toggle]");
if(toggle){
e.stopPropagation();
const id=String(toggle.dataset.deliveryActionsToggle||"");
const menu=document.querySelector(`[data-delivery-actions-menu="${CSS.escape(id)}"]`);
const ouvrir=Boolean(menu?.hidden);
fermerMenusActionsLivraisons();
if(menu)menu.hidden=!ouvrir;
toggle.setAttribute("aria-expanded",String(ouvrir));
return;
}
const b=e.target.closest("[data-a]");if(!b)return;
fermerMenusActionsLivraisons();
const l=livraisonsChargees.find(x=>String(x.idLivraison)===String(b.dataset.id));if(!l)return;
if(b.dataset.a==="view")ouvrirFiche(l);if(b.dataset.a==="prepare")ouvrirPreparation(l);if(b.dataset.a==="departure")ouvrirDepart(l);if(b.dataset.a==="return")ouvrirRetour(l);
}
document.addEventListener("click",e=>{if(!e.target.closest(".delivery-row-menu"))fermerMenusActionsLivraisons();});

function classeHistoriqueLivraison(type){
const t=norm(type);if(["livree","cloturee","preparation-validee","encaissement"].includes(t))return"is-success";
if(["reportee","reprogrammee"].includes(t))return"is-warning";if(["non-livree","echec-definitif","annulee"].includes(t))return"is-danger";return"";
}
function afficherHistoriqueLivraison(items){
const z=document.getElementById("delivery-history-list");if(!z)return;const liste=Array.isArray(items)?items:[];
if(!liste.length){z.innerHTML='<div class="delivery-history-empty">Aucun événement historique enregistré pour cette livraison.</div>';return;}
z.innerHTML=liste.map(h=>`<div class="delivery-history-item ${classeHistoriqueLivraison(h.typeEvenement)}"><span class="delivery-history-dot" aria-hidden="true"></span><div class="delivery-history-content"><div class="delivery-history-top"><strong class="delivery-history-title">${esc(h.titre||label(h.typeEvenement)||"Événement")}</strong><span class="delivery-history-date">${esc([h.date,h.heure].filter(Boolean).join(" · "))}</span></div>${h.detail?`<p class="delivery-history-detail">${esc(h.detail)}</p>`:""}${h.utilisateur?`<small class="delivery-history-meta">Par ${esc(h.utilisateur)}</small>`:""}</div></div>`).join("");
}
async function chargerHistoriqueLivraison(idLivraison){
const z=document.getElementById("delivery-history-list");if(z)z.innerHTML='<div class="delivery-history-empty">Chargement de l’historique…</div>';
try{const r=await apiGet("getHistoriqueLivraison",{idLivraison});if(!r?.success)throw new Error(r?.message||"Impossible de charger l’historique.");afficherHistoriqueLivraison(Array.isArray(r.data)?r.data:(r.historique||[]));}
catch(e){if(z)z.innerHTML=`<div class="delivery-history-empty">${esc(e.message||"Historique indisponible.")}</div>`;}
}

function infoMissionLivraison(l){
 const statut=norm(l?.statutLivraison),resultat=norm(l?.resultatLivraison);
 const missionEffectuee=Boolean(l?.missionEffectuee)||Boolean(l?.heureDepart||l?.heureRetour||l?.resultatLivraison)||["en-livraison","cloturee"].includes(statut);
 const reussie=Boolean(l?.livraisonReussie)||(statut==="cloturee"&&resultat==="livree");
 const echec=Boolean(l?.echecDefinitif)||(statut==="cloturee"&&resultat==="non-livree");
 const reportee=Boolean(l?.missionReportee)||(resultat==="reportee"&&statut!=="cloturee");
 let etat="Non démarrée",classe="neutral",prise="Non applicable",impact="Non comptabilisée";
 if(statut==="en-livraison"){etat="En cours";classe="progress";prise="En attente";impact="Mission en cours";}
 else if(reussie){etat="Réussie";classe="success";prise="Client";impact="Comptée comme livraison réalisée";}
 else if(echec){etat="Effectuée · non livrée";classe="danger";prise="Entreprise";impact="Mission effectuée, livraison non réussie";}
 else if(reportee){etat="Reportée";classe="warning";prise="En attente de clôture";impact="Non comptée comme livraison réalisée";}
 else if(missionEffectuee){etat="Mission effectuée";classe="info";prise="À déterminer";impact="En attente de résultat";}
 return {etat,classe,prise,impact};
}

async function ouvrirFiche(l){
 livraisonOuverte=l;
 text("delivery-view-title",`Livraison ${l.idLivraison}`);
 text("delivery-view-subtitle",`${label(l.origine)} ${l.idCommande||l.idVente||""}`);
 text("delivery-view-hero-client",l.nomClient||l.idClient||"Client");
 text("delivery-view-hero-route",[l.commune,l.zoneQuartier].filter(Boolean).join(" · ")||"Destination non renseignée");

 const statutN=norm(l.statutLivraison),resultatN=norm(l.resultatLivraison);
 const hero=document.getElementById("delivery-view-hero-status");
 if(hero)hero.innerHTML=`<span class="status-badge status-${esc(statutN)}">${esc(label(l.statutLivraison))}</span>${resultatN?`<span class="result-badge result-${esc(resultatN)}">${esc(label(l.resultatLivraison))}</span>`:""}`;

 const ordre=["a-preparer","prete-pour-depart","en-livraison","cloturee"],idx=ordre.indexOf(statutN);
 document.getElementById("delivery-process").innerHTML=ordre.map((x,i)=>`<div class="process-step ${i<idx?"is-done":i===idx?"is-current":""}">${label(x)}</div>`).join("");

 const mission=infoMissionLivraison(l);
 const mz=document.getElementById("delivery-mission-summary");
 if(mz)mz.innerHTML=`
 <article class="mission-stat ${mission.classe}"><span>État de la mission</span><strong>${esc(mission.etat)}</strong></article>
 <article class="mission-stat"><span>Frais de mission</span><strong>${fcfa(l.fraisMission??l.fraisLivraison)}</strong></article>
 <article class="mission-stat ${mission.prise==="Entreprise"?"danger":mission.prise==="Client"?"success":""}"><span>Prise en charge</span><strong>${esc(mission.prise)}</strong></article>
 <article class="mission-stat"><span>Impact statistiques livreur</span><strong>${esc(mission.impact)}</strong></article>`;

 const details=[["Commande",l.idCommande||"—"],["Vente",l.idVente||"—"],["Client",l.nomClient||l.idClient||"—"],["Livreur",l.nomLivreur||l.idLivreur||"Non affecté"],["Commune",l.commune||"—"],["Zone / Quartier",l.zoneQuartier||"—"],["Adresse",l.adresseLivraison||"—"],["Date prévue",dateFr(l.dateLivraisonPrevue)],["Date effective",dateFr(l.dateLivraisonEffective)],["Heure départ",l.heureDepart||"—"],["Heure retour",l.heureRetour||"—"],["Tentative",l.tentativeLivraison||1],["Motif",l.motifEchec?label(l.motifEchec):"—"]];
 document.getElementById("delivery-detail-grid").innerHTML=details.map(x=>`<div class="detail-item"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></div>`).join("");

 text("view-amount-expected",fcfa(l.montantAEncaisser));
 text("view-amount-received",fcfa(l.montantTotalEncaisse));
   text("view-credit-used",fcfa(l.montantAvoirUtilise));
text("view-amount-balance",fcfa(l.resteAEncaisser));
 text("view-payment-status",label(l.statutEncaissement));
 majActionsFiche(l);
 openModal("delivery-view-modal");
 chargerHistoriqueLivraison(l.idLivraison);
}

function majActionsFiche(l){
const z=document.getElementById("delivery-view-actions"),s=norm(l.statutLivraison);let h='<button class="btn-secondary" id="close-delivery-view-footer">Fermer</button>';
if(s==="a-preparer")h+='<button class="btn-primary" data-fiche="prepare">Valider la préparation</button>';
if(s==="prete-pour-depart")h+='<button class="btn-primary" data-fiche="departure">Confirmer le départ</button>';
if(s==="en-livraison")h+='<button class="btn-primary" data-fiche="return">Enregistrer le retour</button>';
z.innerHTML=h;z.querySelector("#close-delivery-view-footer")?.addEventListener("click",()=>closeModal("delivery-view-modal"));z.querySelectorAll("[data-fiche]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.fiche==="prepare")ouvrirPreparation(l);if(b.dataset.fiche==="departure")ouvrirDepart(l);if(b.dataset.fiche==="return")ouvrirRetour(l);}));
}

function ouvrirPreparation(l){setVal("prepare-delivery-id",l.idLivraison);text("prepare-delivery-number",l.idLivraison);openModal("delivery-prepare-modal")}
function ouvrirDepart(l){setVal("departure-delivery-id",l.idLivraison);text("departure-delivery-number",l.idLivraison);openModal("delivery-departure-modal")}
function ouvrirRetour(l){
setVal("return-delivery-id",l.idLivraison);
setVal("delivery-return-result","");
setVal("delivery-failure-reason","");
setVal("delivery-return-product-state","");
setVal("delivery-return-product-state-reason","");
setVal("delivery-reschedule-date","");
setVal("delivery-return-comment","");
document.querySelectorAll('input[name="delivery-failure-action"]').forEach(r=>r.checked=false);
["return-payment-source","return-payment-method","return-payment-reference","return-payment-comment"].forEach(id=>setVal(id,""));
setVal("return-payment-amount","");
text("return-payment-delivery-number",l.idLivraison);
text("return-payment-delivery-balance",fcfa(l.resteAEncaisser));
preparerAvoirEncaissementLivraison(l,"return");
const pm=document.getElementById("delivery-return-payment-message");if(pm){pm.textContent="";pm.className="form-message";}
majRetourUI();
openModal("delivery-return-modal");
}

function majRetourUI(){
const r=norm(val("delivery-return-result"));
const estLivre=r==="livree";
const estEchec=r==="non-livree"||r==="reportee";

const failureFields=document.getElementById("delivery-return-failure-fields");
const paymentSection=document.getElementById("delivery-return-payment-section");
if(failureFields)failureFields.hidden=!estEchec;
if(paymentSection)paymentSection.hidden=!estLivre;

document.getElementById("delivery-failure-reason-group").hidden=!estEchec;
document.getElementById("delivery-failure-action-group").hidden=!estEchec;
document.getElementById("delivery-product-state-group").hidden=!estEchec;

const etat=norm(val("delivery-return-product-state"));
document.getElementById("delivery-product-state-reason-group").hidden=!(estEchec&&(etat==="non-vendable"||etat==="non vendable"));

const action=document.querySelector('input[name="delivery-failure-action"]:checked')?.value||"";
document.getElementById("delivery-reschedule-group").hidden=!(estEchec&&(r==="reportee"||action==="reprogrammer"));
}

async function actionSimple(action,idChamp,modal,bouton){
if(bouton?.disabled)return;
if(bouton)bouton.disabled=true;
try{
const r=await apiPost(action,{idLivraison:val(idChamp),idUtilisateur:userId()});
if(!r?.success)throw new Error(r?.message||"Opération impossible");
closeModal(modal);
closeModal("delivery-view-modal");
toast(r.message||"Opération réussie","success");
await chargerLivraisons();
}catch(e){
toast(e.message,"error");
}finally{
if(bouton)bouton.disabled=false;
}
}

async function enregistrerRetourLivreurUI(){
const resultatLivraison=val("delivery-return-result"),
motifEchec=val("delivery-failure-reason"),
actionEchec=document.querySelector('input[name="delivery-failure-action"]:checked')?.value||"",
etatProduitRetour=val("delivery-return-product-state"),
motifEtatProduit=val("delivery-return-product-state-reason"),
nouvelleDatePrevue=val("delivery-reschedule-date"),
commentaire=val("delivery-return-comment");

if(!resultatLivraison)return msg("delivery-return-message","Sélectionnez le résultat.");

const estLivre=norm(resultatLivraison)==="livree";
const estEchec=["non-livree","reportee"].includes(norm(resultatLivraison));

let paiementRetour=null;
if(estLivre){
const provenance=val("return-payment-source");
const modePaiement=val("return-payment-method");
const montant=num(val("return-payment-amount"));
const montantAvoirUtilise=num(val("return-delivery-credit-used"));
if(montant<=0&&montantAvoirUtilise<=0)
return msg("delivery-return-payment-message","Saisissez un montant encaissé ou un avoir à utiliser.");
if(montant>0&&(!provenance||!modePaiement))
return msg("delivery-return-payment-message","La provenance et le mode sont obligatoires pour un encaissement en argent.");
paiementRetour={provenance,modePaiement,montant,montantAvoirUtilise,reference:val("return-payment-reference"),commentaire:val("return-payment-comment")};
}

if(estEchec&&(!motifEchec||!actionEchec))
return msg("delivery-return-message","Le motif et l'action sur le colis sont obligatoires.");

if(estEchec&&!etatProduitRetour)
return msg("delivery-return-message","Indiquez si les produits retournés sont vendables ou non vendables.");

if(estEchec&&["non-vendable","non vendable"].includes(norm(etatProduitRetour))&&!motifEtatProduit)
return msg("delivery-return-message","Indiquez le motif du stock non vendable.");

if(actionEchec==="reprogrammer"&&["non-vendable","non vendable"].includes(norm(etatProduitRetour)))
return msg("delivery-return-message","Un produit non vendable ne peut pas être reprogrammé.");

if((norm(resultatLivraison)==="reportee"||actionEchec==="reprogrammer")&&!nouvelleDatePrevue)
return msg("delivery-return-message","Indiquez la nouvelle date prévue.");

const boutonRetour=document.getElementById("confirm-delivery-return-btn");
if(boutonRetour?.disabled)return;
if(boutonRetour)boutonRetour.disabled=true;

try{
let paiementEnregistreAvantRetour=false;
if(estLivre&&paiementRetour){
const paiement=await apiPost("ajouterEncaissementLivraison",{
idLivraison:val("return-delivery-id"),
...paiementRetour,
idUtilisateur:userId()
});
if(!paiement?.success)throw new Error(paiement?.message||"L'encaissement n'a pas pu être enregistré.");
paiementEnregistreAvantRetour=true;
}

const r=await apiPost("enregistrerRetourLivreur",{
idLivraison:val("return-delivery-id"),
resultatLivraison,
motifEchec,
actionEchec,
etatProduitRetour,
motifEtatProduit,
nouvelleDatePrevue,
commentaire,
idUtilisateur:userId()
});
if(!r?.success)throw new Error(r?.message||"Impossible d'enregistrer le retour");

closeModal("delivery-return-modal");
closeModal("delivery-view-modal");
toast(estLivre&&paiementEnregistreAvantRetour?"Retour et encaissement enregistrés.":r.message,"success");
await chargerLivraisons();
}catch(e){
msg("delivery-return-message",e.message);
}finally{
if(boutonRetour)boutonRetour.disabled=false;
}
}

function ouvrirEncaissement(){
if(!livraisonOuverte)return;
setVal("payment-delivery-id",livraisonOuverte.idLivraison);text("payment-delivery-number",livraisonOuverte.idLivraison);text("payment-delivery-balance",fcfa(livraisonOuverte.resteAEncaisser));
["delivery-payment-source","delivery-payment-method","delivery-payment-amount","delivery-payment-reference","delivery-payment-comment"].forEach(id=>setVal(id,""));
preparerAvoirEncaissementLivraison(livraisonOuverte,"delivery");
openModal("delivery-payment-modal");
}

async function enregistrerEncaissement(){
const provenance=val("delivery-payment-source"),modePaiement=val("delivery-payment-method"),montant=num(val("delivery-payment-amount")),montantAvoirUtilise=num(val("delivery-credit-used"));
if(montant<=0&&montantAvoirUtilise<=0)return msg("delivery-payment-message","Saisissez un montant encaissé ou un avoir à utiliser.");
if(montant>0&&(!provenance||!modePaiement))return msg("delivery-payment-message","La provenance et le mode sont obligatoires pour un encaissement en argent.");

const bouton=document.getElementById("save-delivery-payment-btn");
if(bouton?.disabled)return;
if(bouton)bouton.disabled=true;

try{
const r=await apiPost("ajouterEncaissementLivraison",{idLivraison:val("payment-delivery-id"),provenance,modePaiement,montant,montantAvoirUtilise,reference:val("delivery-payment-reference"),commentaire:val("delivery-payment-comment"),idUtilisateur:userId()});
if(!r?.success)throw new Error(r?.message||"Impossible d'enregistrer");
closeModal("delivery-payment-modal");
toast(r.message,"success");
await chargerLivraisons();
const l=livraisonsChargees.find(x=>x.idLivraison===livraisonOuverte.idLivraison);
if(l)await ouvrirFiche(l);
}catch(e){
msg("delivery-payment-message",e.message);
}finally{
if(bouton)bouton.disabled=false;
}
}

async function chargerEncaissements(idLivraison){
const tb=document.getElementById("delivery-payments-body");try{const r=await apiGet("getEncaissementsLivraison",{idLivraison});if(!r?.success)throw new Error(r?.message);const a=Array.isArray(r.data)?r.data:(r.encaissements||[]);tb.innerHTML=a.length?a.map(x=>`<tr><td>${esc([dateFr(x.date),x.heure].filter(Boolean).join(" à "))}</td><td>${esc(label(x.provenance))}</td><td>${esc(label(x.modePaiement))}</td><td><strong>${fcfa(x.montant)}</strong></td><td>${esc(x.reference||"—")}</td><td>${esc(x.commentaire||"—")}</td></tr>`).join(""):'<tr><td colspan="6" class="empty-table">Aucun encaissement.</td></tr>';}catch(e){tb.innerHTML=`<tr><td colspan="6" class="empty-table">${esc(e.message||"Erreur")}</td></tr>`}
}

function exporterLivraisonsCSV(){
if(!livraisonsFiltrees.length)return toast("Aucune livraison à exporter","info");
const rows=[["ID Livraison","Origine","ID Commande","ID Vente","ID Client","ID Livreur","Commune","Zone","Adresse","Date prévue","Statut","Résultat","Attendu","Encaissé","Reste","Tentative"],...livraisonsFiltrees.map(l=>[l.idLivraison,l.origine,l.idCommande,l.idVente,l.idClient,l.idLivreur,l.commune,l.zoneQuartier,l.adresseLivraison,l.dateLivraisonPrevue,l.statutLivraison,l.resultatLivraison,l.montantAEncaisser,l.montantTotalEncaisse,l.resteAEncaisser,l.tentativeLivraison])];
const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="livraisons_visibl.csv";a.click();URL.revokeObjectURL(u);
}

function openModal(id){const m=document.getElementById(id);if(m){m.classList.add("active");m.setAttribute("aria-hidden","false");document.body.classList.add("modal-open")}}
function closeModal(id){const m=document.getElementById(id);m?.classList.remove("active");m?.setAttribute("aria-hidden","true");if(!document.querySelector(".modal-overlay.active"))document.body.classList.remove("modal-open")}
function val(id){return String(document.getElementById(id)?.value??"").trim()}function setVal(id,v){const e=document.getElementById(id);if(e)e.value=v??""}function text(id,v){const e=document.getElementById(id);if(e)e.textContent=v??""}
function norm(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase()}function num(v){const n=Number(String(v??"").replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:0}function fcfa(v){const p=parametresFinanceLivraisons||{};const d=Number(p.nombreDecimales)===2?2:0;const n=num(v).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d});const devise=String(p.libelleDevise||"FCFA").trim()||"FCFA";return p.formatMontant==="devise-nombre"?devise+" "+n:n+" "+devise}function label(v){const s=String(v??"").replace(/-/g," ").trim();return s?s.charAt(0).toUpperCase()+s.slice(1):"—"}function dateFr(v){if(!v)return"—";if(/^\d{2}\/\d{2}\/\d{4}$/.test(String(v)))return String(v);const d=new Date(v);return isNaN(d)?String(v):d.toLocaleDateString("fr-FR")}function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function userId(){const u=typeof getCurrentUser==="function"?getCurrentUser():null;return String(u?.idUtilisateur||u?.["ID Utilisateur"]||u?.id||"").trim()}function msg(id,m){const e=document.getElementById(id);if(e){e.textContent=m;e.className="form-message error";e.style.display="block"}}function toast(m,t="info"){if(typeof showToast==="function")return showToast(m,t);const z=document.getElementById("toast-container"),e=document.createElement("div");e.className=`toast ${t}`;e.textContent=m;z?.appendChild(e);setTimeout(()=>e.remove(),3500)}


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

  const content=q("section.content");
  if(content){
    /* Retire uniquement les boutons d'ajout en doublon dans les toolbars; celui du haut reste. */
    const topAdd=qa(".welcome-section button,.welcome-section a",content).find(x=>/nouveau|nouvelle|ajouter/i.test(x.textContent));
    if(topAdd){
      qa(".toolbar button,.toolbar a,.clients-toolbar button,.clients-toolbar a,.sales-toolbar button,.sales-toolbar a",content)
        .filter(x=>x!==topAdd && /nouveau|nouvelle|ajouter/i.test(x.textContent))
        .forEach(x=>x.style.display="none");
    }
  }
});


/* ===== PARAMÈTRES > FINANCE — LIVRAISONS ===== */
async function chargerParametresFinanceLivraisons(){
try{const r=await apiGet("getParametresFinance");if(r?.success)parametresFinanceLivraisons={...parametresFinanceLivraisons,...(r.data||r.parametres||{})};}
catch(e){console.warn("Paramètres finance indisponibles dans Livraisons :",e)}
appliquerModesPaiementFinanceLivraisons();
}
function groupeModeFinanceLivraisons(v){const t=norm(v).replace(/_/g,"-").replace(/\s+/g,"-");if(["especes","espece","cash"].includes(t))return"especes";if(t.includes("mobile")||t.includes("wave")||t.includes("orange")||t.includes("mtn")||t.includes("moov"))return"mobile-money";if(t.includes("virement")||t.includes("transfer"))return"virement";if(t.includes("cheque"))return"cheque";if(t.includes("carte")||t.includes("card"))return"carte-bancaire";return t;}
function modeFinanceLivraisonsActif(v){const g=groupeModeFinanceLivraisons(v),p=parametresFinanceLivraisons||{};if(!g)return true;if(g==="especes")return p.modeEspeces!==false;if(g==="mobile-money")return p.modeMobileMoney!==false;if(g==="virement")return p.modeVirement!==false;if(g==="cheque")return p.modeCheque!==false;if(g==="carte-bancaire")return p.modeCarteBancaire!==false;return false;}
function appliquerModesPaiementFinanceLivraisons(){["delivery-payment-method","return-payment-method"].forEach(id=>{const s=document.getElementById(id);if(!s)return;Array.from(s.options).forEach(o=>{if(!o.value)return;const a=modeFinanceLivraisonsActif(o.value);o.hidden=!a;o.disabled=!a;if(!a&&s.value===o.value)s.value=""});});}


/* ===== FINANCE DYNAMIQUE — LIVRAISONS ===== */
function appliquerModesPaiementFinanceLivraisons(){const modes=Array.isArray(parametresFinanceLivraisons?.modesPaiement)?parametresFinanceLivraisons.modesPaiement.filter(m=>m&&m.actif!==false && !["credit","avoir"].includes(String(m.id||""))):[];["delivery-payment-method","return-payment-method"].forEach(id=>{const select=document.getElementById(id);if(!select)return;const courant=select.value;if(modes.length){select.innerHTML='<option value="">Sélectionner le mode de paiement</option>'+modes.map(m=>`<option value="${esc(m.id)}">${esc(m.libelle||m.id)}</option>`).join("");if(Array.from(select.options).some(o=>o.value===courant))select.value=courant;return;}Array.from(select.options).forEach(o=>{if(!o.value)return;const a=modeFinanceLivraisonsActif(o.value);o.hidden=!a;o.disabled=!a;});});}
