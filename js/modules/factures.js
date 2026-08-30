
let facturesChargees=[],facturesFiltrees=[],factureSelectionnee=null,pageFacturesActuelle=1,facturesParPage=10,ventesFacturesCache=[],ventesFacturesPromise=null,filtreRapideFacture="",historiqueFacturesCache=new Map();

document.addEventListener("DOMContentLoaded",()=>{if(typeof requireAuth==="function"&&!requireAuth())return;initFactures();chargerFactures();});

function initFactures(){
  initHeaderFactures();initLogoutFactures();
  ["invoices-search-input","invoice-type-filter","invoice-status-filter"].forEach(id=>{
    const e=document.getElementById(id);if(!e)return;e.addEventListener(id==="invoices-search-input"?"input":"change",appliquerFiltresFactures);
  });
  document.getElementById("reset-invoice-filters")?.addEventListener("click",()=>{["invoices-search-input","invoice-type-filter","invoice-status-filter"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});filtreRapideFacture="";document.querySelectorAll("[data-invoice-quick]").forEach(x=>x.classList.toggle("active",!x.dataset.invoiceQuick));appliquerFiltresFactures();});
  document.getElementById("refresh-invoices-btn")?.addEventListener("click",chargerFactures);
  document.getElementById("print-invoices-btn")?.addEventListener("click",()=>window.print());
  document.getElementById("export-invoices-btn")?.addEventListener("click",exporterFacturesCSV);
  document.getElementById("invoices-per-page")?.addEventListener("change",e=>{facturesParPage=Number(e.target.value)||10;pageFacturesActuelle=1;afficherTableauFactures();});
  document.getElementById("previous-invoice-page-btn")?.addEventListener("click",()=>{if(pageFacturesActuelle>1){pageFacturesActuelle--;afficherTableauFactures();}});
  document.getElementById("next-invoice-page-btn")?.addEventListener("click",()=>{if(pageFacturesActuelle<totalPagesFactures()){pageFacturesActuelle++;afficherTableauFactures();}});
  document.getElementById("invoices-table-body")?.addEventListener("click",actionFacture);
  ["close-invoice-modal","close-invoice-footer-btn"].forEach(id=>document.getElementById(id)?.addEventListener("click",fermerFacture));
  document.getElementById("invoice-modal")?.addEventListener("click",e=>{if(e.target.id==="invoice-modal")fermerFacture();});
  document.getElementById("copy-invoice-number-btn")?.addEventListener("click",copierNumeroFacture);
  document.getElementById("open-invoice-sale-btn")?.addEventListener("click",()=>factureSelectionnee&&ouvrirVenteFacture(factureSelectionnee));
  document.getElementById("print-current-invoice-btn")?.addEventListener("click",()=>factureSelectionnee&&imprimerFacture(factureSelectionnee));
  document.getElementById("open-invoice-payments-btn")?.addEventListener("click",()=>factureSelectionnee&&ouvrirPaiementsFacture(factureSelectionnee));
  document.getElementById("open-invoice-return-btn")?.addEventListener("click",()=>factureSelectionnee&&ouvrirRetourFacture(factureSelectionnee));
  ["close-invoice-payments-modal","close-invoice-payments-footer-btn"].forEach(id=>document.getElementById(id)?.addEventListener("click",fermerPaiementsFacture));
  ["close-invoice-return-modal","close-invoice-return-footer-btn"].forEach(id=>document.getElementById(id)?.addEventListener("click",fermerRetourFacture));
  document.querySelectorAll("[data-invoice-quick]").forEach(b=>b.addEventListener("click",()=>{filtreRapideFacture=b.dataset.invoiceQuick||"";document.querySelectorAll("[data-invoice-quick]").forEach(x=>x.classList.toggle("active",x===b));appliquerFiltresFactures();}));
  ["close-invoice-sale-modal","close-invoice-sale-footer-btn"].forEach(id=>document.getElementById(id)?.addEventListener("click",fermerVenteFacture));
  document.getElementById("invoice-sale-modal")?.addEventListener("click",e=>{if(e.target.id==="invoice-sale-modal")fermerVenteFacture();});
}

function initHeaderFactures(){
  const nb=document.getElementById("notification-button"),np=document.getElementById("notification-panel"),
        pb=document.getElementById("invoice-profile-button"),pd=document.getElementById("invoice-profile-dropdown"),
        hs=document.getElementById("invoice-header-search");
  const close=()=>{if(np)np.hidden=true;nb?.setAttribute("aria-expanded","false");pd?.classList.remove("invoice-profile-open");pb?.setAttribute("aria-expanded","false");};
  nb?.addEventListener("click",e=>{e.stopPropagation();const open=np?.hidden;close();if(np){np.hidden=!open;nb.setAttribute("aria-expanded",open?"true":"false");}});
  np?.addEventListener("click",e=>e.stopPropagation());
  pb?.addEventListener("click",e=>{e.stopPropagation();const open=!pd?.classList.contains("invoice-profile-open");close();if(open){pd?.classList.add("invoice-profile-open");pb.setAttribute("aria-expanded","true");}});
  pd?.addEventListener("click",e=>e.stopPropagation());document.addEventListener("click",close);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){close();fermerFacture();}});
  const sync=()=>{const s=document.getElementById("invoices-search-input");if(!s)return;s.value=hs?.value||"";appliquerFiltresFactures();s.scrollIntoView({behavior:"smooth",block:"center"});};
  hs?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();sync();}});
  document.getElementById("invoice-header-search-btn")?.addEventListener("click",sync);
  document.getElementById("mobile-search-btn")?.addEventListener("click",()=>{document.querySelector(".search-container")?.classList.toggle("active");setTimeout(()=>hs?.focus(),50);});
}

function initLogoutFactures(){
  document.getElementById("logout-button")?.addEventListener("click",e=>{e.preventDefault();try{if(typeof logoutUser==="function")logoutUser();else{sessionStorage.clear();["user","utilisateur","currentUser","authUser","isAuthenticated","token","authToken"].forEach(k=>localStorage.removeItem(k));}}catch(err){}setTimeout(()=>window.location.replace("connexion.html"),50);});
}

async function chargerFactures(){
  try{
    const r=await apiGet("getFactures");if(!r?.success)throw new Error(r?.message||"Impossible de charger les factures.");
    facturesChargees=Array.isArray(r.factures)?r.factures:(Array.isArray(r.data)?r.data:[]);
    const x=r.resume||{};
    t("total-invoices-value",nf(x.nombreFactures));t("invoiced-amount-value",fcfa(x.montantFacture));t("invoice-paid-value",fcfa(x.montantEncaisse));t("invoice-balance-value",fcfa(x.resteAEncaisser));t("credit-notes-value",nf(x.nombreAvoirs));t("credit-notes-description",fcfa(x.montantAvoirs)+" en avoirs");
    appliquerFiltresFactures();
    setTimeout(()=>chargerVentesFacturesEnArrierePlan(),0);
  }catch(e){facturesChargees=[];facturesFiltrees=[];afficherTableauFactures();toastFac(e.message||"Erreur de chargement.","error");}
}

function appliquerFiltresFactures(){
  const q=norm(v("invoices-search-input")),type=norm(v("invoice-type-filter")),stat=v("invoice-status-filter");
  facturesFiltrees=facturesChargees.filter(f=>{
    const txt=norm([f.numeroFacture,f.idFacture,f.idVente,f.idFactureOrigine,f.idClient,f.clientNom].join(" "));
    let rapide=true;
    if(filtreRapideFacture==="avoir")rapide=norm(f.typeFacture)==="avoir";
    else if(filtreRapideFacture==="payee")rapide=statutClasse(f.statut)==="payee"&&norm(f.typeFacture)!=="avoir";
    else if(filtreRapideFacture==="partiellement-payee")rapide=statutClasse(f.statut)==="partiellement-payee";
    else if(filtreRapideFacture==="impayee")rapide=norm(f.typeFacture)!=="avoir"&&Math.max(0,Number(f.resteAPayer)||0)>0&&Math.max(0,Number(f.montantPaye)||0)===0&&Math.max(0,Number(f.montantAvoirUtilise)||0)===0;
    return rapide&&(!q||txt.includes(q))&&(!type||norm(f.typeFacture)===type)&&(!stat||statutClasse(f.statut)===stat);
  });
  t("filtered-invoice-count",facturesFiltrees.length);pageFacturesActuelle=1;afficherTableauFactures();
}

function afficherTableauFactures(){
  const b=document.getElementById("invoices-table-body");if(!b)return;const total=totalPagesFactures();pageFacturesActuelle=Math.min(Math.max(1,pageFacturesActuelle),total);
  const list=facturesFiltrees.slice((pageFacturesActuelle-1)*facturesParPage,pageFacturesActuelle*facturesParPage);
  b.innerHTML=list.length?list.map(rowFacture).join(""):'<tr><td colspan="11" class="empty-table">Aucune facture trouvée.</td></tr>';
  paginationFactures(total);
}

function rowFacture(f){
  const type=norm(f.typeFacture)||"facture",avoir=type==="avoir",stat=statutClasse(f.statut),id=esc(f.idFacture||"");
  return `<tr>
  <td><span class="invoice-number">${esc(f.numeroFacture||"—")}</span></td>
  <td><strong>${esc(f.dateEmission||"—")}</strong><br><small>${esc(f.heureEmission||"")}</small></td>
  <td><span class="invoice-type-badge type-${type}">${avoir?"Avoir":"Facture"}</span></td>
  <td><div class="invoice-client"><strong>${esc(f.clientNom||f.idClient||"—")}</strong><small>${esc(f.idClient||"")}</small></div></td>
  <td>${esc(f.idVente||"—")}</td><td>${esc(String(f.nombreArticles||0))}</td><td><span class="money">${esc(fcfa(f.montantTTC))}</span></td>
  <td>${avoir?"—":resumeReglementTableauFacture(f)}</td><td><span class="money money-balance">${avoir?"—":esc(fcfa(f.resteAPayer))}</span></td>
  <td><span class="invoice-status-badge status-${stat}">${esc(f.statut||"—")}</span></td>
  <td><div class="invoice-row-actions"><button class="invoice-row-actions-trigger" type="button" data-invoice-action="menu" data-invoice-id="${id}" aria-label="Actions" aria-expanded="false">⋮</button><div class="invoice-row-actions-menu" hidden><button type="button" data-invoice-action="view" data-invoice-id="${id}">👁️ <span>Voir la facture</span></button><button type="button" data-invoice-action="print" data-invoice-id="${id}">🖨️ <span>Imprimer / PDF</span></button>${f.idVente?`<button type="button" data-invoice-action="sale" data-invoice-id="${id}">🔗 <span>Voir la vente</span></button>`:""}</div></div></td></tr>`;
}

function resumeReglementTableauFacture(f){const cash=Math.max(0,Number(f.montantPaye)||0),credit=Math.max(0,Number(f.montantAvoirUtilise)||0);return credit>0?`<div class="invoice-payment-breakdown"><strong>${esc(fcfa(cash))}</strong><small>encaissé + ${esc(fcfa(credit))} avoir</small></div>`:`<span class="money money-paid">${esc(fcfa(cash))}</span>`;}
function totalPagesFactures(){return Math.max(1,Math.ceil(facturesFiltrees.length/facturesParPage));}
function paginationFactures(total){
  t("invoices-pagination-summary",`Page ${pageFacturesActuelle} / ${total}`);
  const p=document.getElementById("previous-invoice-page-btn"),n=document.getElementById("next-invoice-page-btn");if(p)p.disabled=pageFacturesActuelle<=1;if(n)n.disabled=pageFacturesActuelle>=total;
  const z=document.getElementById("invoices-page-buttons");if(!z)return;let a=Math.max(1,pageFacturesActuelle-3),b=Math.min(total,a+6);a=Math.max(1,b-6);
  z.innerHTML=Array.from({length:b-a+1},(_,i)=>a+i).map(x=>`<button class="pagination-btn ${x===pageFacturesActuelle?"active":""}" data-page="${x}">${x}</button>`).join("");
  z.querySelectorAll("[data-page]").forEach(x=>x.addEventListener("click",()=>{pageFacturesActuelle=Number(x.dataset.page);afficherTableauFactures();}));
}

function actionFacture(e){
  const b=e.target.closest("[data-invoice-action]");if(!b)return;
  const action=b.dataset.invoiceAction;
  if(action==="menu"){
    e.stopPropagation();
    const menu=b.closest(".invoice-row-actions")?.querySelector(".invoice-row-actions-menu");
    document.querySelectorAll(".invoice-row-actions-menu").forEach(m=>{if(m!==menu)m.hidden=true;});
    document.querySelectorAll(".invoice-row-actions-trigger").forEach(t=>{if(t!==b)t.setAttribute("aria-expanded","false");});
    if(menu){menu.hidden=!menu.hidden;b.setAttribute("aria-expanded",String(!menu.hidden));}
    return;
  }
  const f=facturesChargees.find(x=>String(x.idFacture)===String(b.dataset.invoiceId));if(!f)return;
  const menu=b.closest(".invoice-row-actions-menu");if(menu)menu.hidden=true;
  b.closest(".invoice-row-actions")?.querySelector(".invoice-row-actions-trigger")?.setAttribute("aria-expanded","false");
  if(action==="view")ouvrirFacture(f);
  if(action==="print")imprimerFacture(f);
  if(action==="sale")ouvrirVenteFacture(f);
}

document.addEventListener("click",e=>{
  if(e.target.closest(".invoice-row-actions"))return;
  document.querySelectorAll(".invoice-row-actions-menu").forEach(m=>m.hidden=true);
  document.querySelectorAll(".invoice-row-actions-trigger").forEach(t=>t.setAttribute("aria-expanded","false"));
});

function ouvrirFacture(f){
  factureSelectionnee=f;const avoir=norm(f.typeFacture)==="avoir";
  t("invoice-modal-title",avoir?"Facture d’avoir":"Facture");t("invoice-modal-subtitle",f.numeroFacture||f.idFacture||"");t("invoice-document-type",avoir?"FACTURE D’AVOIR":"FACTURE");t("invoice-document-number",f.numeroFacture||"—");
  t("invoice-client-name",f.clientNom||f.idClient||"Client");t("invoice-client-contact",[f.clientTelephone,f.clientEmail].filter(Boolean).join(" · ")||f.idClient||"—");t("invoice-date",[f.dateEmission,f.heureEmission].filter(Boolean).join(" ")||"—");t("invoice-sale-id",f.idVente||"—");
  const orig=document.getElementById("invoice-origin-row");if(orig)orig.hidden=!avoir;if(avoir){const o=facturesChargees.find(x=>String(x.idFacture)===String(f.idFactureOrigine));t("invoice-origin-number",o?.numeroFacture||f.idFactureOrigine||"—");}
  const reason=document.getElementById("invoice-credit-reason");if(reason)reason.hidden=!avoir;t("invoice-credit-reason-text",f.motifAvoir||"Retour client");
  const body=document.getElementById("invoice-lines-body"),details=Array.isArray(f.details)?f.details:[];if(body)body.innerHTML=details.length?details.map(l=>`<tr><td>${esc(l.designation||l.idProduit||"Article")}</td><td>${esc(nf(l.quantite))}</td><td>${esc(fcfa(l.prixUnitaireTTC))}</td><td>${esc(fcfa(l.remise))}</td><td>${esc(fcfa(l.sousTotalTTC))}</td></tr>`).join(""):'<tr><td colspan="5" class="empty-table">Aucun détail produit.</td></tr>';
  const montantEncaisse=Math.max(0,Number(f.montantPaye)||0);
  const montantAvoirUtilise=Math.max(0,Number(f.montantAvoirUtilise)||0);
  const montantRegle=Math.min(Math.max(0,Number(f.montantTTC)||0),montantEncaisse+montantAvoirUtilise);
  t("invoice-status-display",f.statut||"—");t("invoice-total-display",fcfa(f.montantTTC));t("invoice-paid-display",fcfa(montantEncaisse));t("invoice-credit-used-display",fcfa(montantAvoirUtilise));t("invoice-settled-display",fcfa(montantRegle));t("invoice-balance-display",fcfa(f.resteAPayer));
  const pr=document.getElementById("invoice-paid-row"),cr=document.getElementById("invoice-credit-used-row"),sr=document.getElementById("invoice-settled-row"),br=document.getElementById("invoice-balance-row");
  if(pr)pr.hidden=avoir;
  if(cr){const afficherAvoir=!avoir&&montantAvoirUtilise>0;cr.hidden=!afficherAvoir;cr.style.display=afficherAvoir?"":"none";}
  if(sr)sr.hidden=avoir;
  if(br)br.hidden=avoir;
  const cb=document.getElementById("invoice-comment-box");if(cb)cb.hidden=!String(f.commentaire||"").trim();t("invoice-comment-text",f.commentaire||"");
  const payBtn=document.getElementById("open-invoice-payments-btn"),retBtn=document.getElementById("open-invoice-return-btn");if(payBtn)payBtn.hidden=true;if(retBtn)retBtn.hidden=!avoir;
  afficherHistoriqueFactureCharge(null);
  document.getElementById("invoice-modal")?.classList.add("active");document.getElementById("invoice-modal")?.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");
  chargerHistoriqueFacture(f).then(h=>{if(factureSelectionnee?.idFacture===f.idFacture){afficherHistoriqueFactureCharge(h);if(payBtn)payBtn.hidden=!(h?.paiements?.length);if(retBtn)retBtn.hidden=!(h?.retour);}}).catch(()=>afficherHistoriqueFactureCharge({erreur:true}));
}
async function chargerHistoriqueFacture(f){const k=String(f.idFacture||"");if(historiqueFacturesCache.has(k))return historiqueFacturesCache.get(k);const r=await apiGet("getHistoriqueFacture",{idFacture:k});if(!r?.success)throw new Error(r?.message||"Historique indisponible.");const h=r.historique||r.data||r;historiqueFacturesCache.set(k,h);return h;}
function afficherHistoriqueFactureCharge(h){const b=document.getElementById("invoice-history"),c=document.getElementById("invoice-history-count");if(!b)return;if(!h){b.innerHTML='<div class="invoice-history-loading">Chargement de l’historique…</div>';if(c)c.textContent="…";return}if(h.erreur){b.innerHTML='<div class="invoice-history-empty">Historique momentanément indisponible.</div>';if(c)c.textContent="—";return}const e=Array.isArray(h.evenements)?h.evenements:[];if(c)c.textContent=`${e.length} événement${e.length>1?"s":""}`;b.innerHTML=e.map(x=>`<div class="invoice-history-item type-${esc(x.type||"info")}"><span class="invoice-history-dot"></span><div class="invoice-history-content"><div><strong>${esc(x.titre||"Événement")}</strong><span>${esc([x.date,x.heure].filter(Boolean).join(" "))}</span></div><p>${esc(x.description||"")}</p>${x.montant!=null?`<b>${esc(fcfa(x.montant))}</b>`:""}</div></div>`).join("")||'<div class="invoice-history-empty">Aucun événement.</div>';}
async function ouvrirPaiementsFacture(f){let h=historiqueFacturesCache.get(String(f.idFacture||""));if(!h){try{h=await chargerHistoriqueFacture(f)}catch(e){return toastFac(e.message,"error")}}const ps=Array.isArray(h.paiements)?h.paiements:[];if(!ps.length)return toastFac("Aucun paiement lié.","info");t("invoice-payments-subtitle",f.numeroFacture||f.idFacture);t("invoice-payments-count",ps.length);t("invoice-payments-total",fcfa(ps.filter(p=>!["annule","annulee","rejete","rejetee"].includes(norm(p.statut))).reduce((s,p)=>s+(norm(p.naturePaiement).includes("remboursement")?-Number(p.montant||0):Number(p.montant||0)),0)));const l=document.getElementById("invoice-payments-list");if(l)l.innerHTML=ps.map(p=>`<article class="invoice-payment-card"><div class="invoice-payment-card-top"><div><span>${esc(p.datePaiement||"—")} ${esc(p.heurePaiement||"")}</span><strong>${esc(fcfa(p.montant))}</strong></div><span class="invoice-status-badge status-${statutClasse(p.statut)}">${esc(p.statut||"—")}</span></div><div class="invoice-payment-meta"><span><b>Mode</b>${esc(p.modePaiement||"—")}</span><span><b>Origine</b>${esc(p.origine||"—")}</span><span><b>Référence</b>${esc(p.referencePaiement||p.idPaiement||"—")}</span></div>${p.commentaire?`<p>${esc(p.commentaire)}</p>`:""}</article>`).join("");document.getElementById("invoice-payments-modal")?.classList.add("active");}
function fermerPaiementsFacture(){document.getElementById("invoice-payments-modal")?.classList.remove("active")}
async function ouvrirRetourFacture(f){let h=historiqueFacturesCache.get(String(f.idFacture||""));if(!h){try{h=await chargerHistoriqueFacture(f)}catch(e){return toastFac(e.message,"error")}}const r=h.retour;if(!r)return toastFac("Retour lié introuvable.","info");t("invoice-return-subtitle",`Origine de ${f.numeroFacture||"la facture d’avoir"}`);t("invoice-return-id",r.idRetour||"—");t("invoice-return-date",[r.dateRetour||r.date,r.heureRetour||r.heure].filter(Boolean).join(" ")||"—");t("invoice-return-sale",r.idVente||f.idVente||"—");t("invoice-return-reason-text",r.motif||f.motifAvoir||"Retour client");const st=document.getElementById("invoice-return-status");if(st)st.textContent=r.etat||r.statut||"Enregistré";const a=Array.isArray(r.lignes)?r.lignes:(Array.isArray(r.details)?r.details:[]),b=document.getElementById("invoice-return-lines-body");if(b)b.innerHTML=a.length?a.map(x=>`<tr><td>${esc(x.designation||x.nomProduit||x.idProduit||"Article")}</td><td>${esc(nf(x.quantiteRetournee??x.quantite??0))}</td><td>${esc(fcfa(x.montantRetour??x.valeurRetour??x.sousTotalTTC??0))}</td></tr>`).join(""):'<tr><td colspan="3" class="empty-table">Aucun détail produit disponible.</td></tr>';document.getElementById("invoice-return-modal")?.classList.add("active");}
function fermerRetourFacture(){document.getElementById("invoice-return-modal")?.classList.remove("active")}

function fermerFacture(){const m=document.getElementById("invoice-modal");m?.classList.remove("active");m?.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");}
async function copierNumeroFacture(){if(!factureSelectionnee?.numeroFacture)return;try{await navigator.clipboard.writeText(factureSelectionnee.numeroFacture);toastFac("Numéro de facture copié.","success");}catch(e){toastFac("Impossible de copier le numéro.","error");}}
function chargerVentesFacturesEnArrierePlan(){
  if(ventesFacturesCache.length)return Promise.resolve(ventesFacturesCache);
  if(ventesFacturesPromise)return ventesFacturesPromise;
  ventesFacturesPromise=apiGet("getVentes").then(r=>{
    if(!r?.success)throw new Error(r?.message||"Impossible de charger les ventes.");
    ventesFacturesCache=Array.isArray(r.ventes)?r.ventes:(Array.isArray(r.data)?r.data:[]);
    return ventesFacturesCache;
  }).catch(()=>[]).finally(()=>{ventesFacturesPromise=null;});
  return ventesFacturesPromise;
}

function afficherVenteDansFactures(vente,f){
    const montantTotal=Math.max(0,Number(vente.montantNet ?? vente.montantTTC ?? f.montantTTC)||0);
    const montantEncaisse=Math.max(0,Number(vente.montantPaye ?? f.montantPaye)||0);
    const montantAvoir=Math.max(0,Number(vente.montantAvoirUtilise ?? f.montantAvoirUtilise)||0);
    const montantRegle=Math.min(montantTotal,montantEncaisse+montantAvoir);
    const reste=Math.max(0,Number(vente.resteAPayer ?? f.resteAPayer ?? (montantTotal-montantRegle))||0);

    t("invoice-sale-subtitle",`Vente liée à ${f.numeroFacture||f.idFacture||"la facture"}`);
    t("invoice-sale-id",vente.idVente||f.idVente);
    t("invoice-sale-client",vente.clientNom||f.clientNom||vente.idClient||f.idClient||"Client");
    t("invoice-sale-client-contact",[vente.clientTelephone||f.clientTelephone,vente.clientEmail||f.clientEmail].filter(Boolean).join(" · ")||vente.idClient||f.idClient||"—");
    t("invoice-sale-date",[vente.dateVente||vente.date||f.dateEmission,vente.heureVente||vente.heure||""].filter(Boolean).join(" ")||"—");
    t("invoice-sale-order",vente.idCommande?`Commande : ${vente.idCommande}`:"");
    t("invoice-sale-total",fcfa(montantTotal));
    t("invoice-sale-paid",fcfa(montantEncaisse));
    t("invoice-sale-credit",fcfa(montantAvoir));
    t("invoice-sale-settled",fcfa(montantRegle));
    t("invoice-sale-balance",fcfa(reste));
    const creditRow=document.getElementById("invoice-sale-credit-row");if(creditRow)creditRow.hidden=!(montantAvoir>0);

    const status=document.getElementById("invoice-sale-status");
    if(status){status.textContent=vente.statut||vente.statutPaiement||f.statut||"—";status.className=`invoice-status-badge status-${statutClasse(vente.statutPaiement||vente.statut||f.statut)}`;}

    const details=Array.isArray(vente.details)?vente.details:(Array.isArray(vente.produits)?vente.produits:(Array.isArray(f.details)?f.details:[]));
    const body=document.getElementById("invoice-sale-lines-body");
    if(body)body.innerHTML=details.length?details.map(l=>{
      const qte=l.quantite??l.qte??0,pu=l.prixUnitaireTTC??l.prixUnitaire??l.prixVente??0;
      const st=l.sousTotalTTC??l.sousTotal??(num(qte)*num(pu));
      return `<tr><td>${esc(l.designation||l.nomProduit||l.produit||l.idProduit||"Article")}</td><td>${esc(nf(qte))}</td><td>${esc(fcfa(pu))}</td><td>${esc(fcfa(st))}</td></tr>`;
    }).join(""):'<tr><td colspan="4" class="empty-table">Aucun détail produit.</td></tr>';

    const m=document.getElementById("invoice-sale-modal");m?.classList.add("active");m?.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");
}

async function ouvrirVenteFacture(f){
  if(!f?.idVente)return toastFac("Aucune vente liée.","info");

  /* Affichage immédiat : aucune requête réseau ne bloque l'ouverture. */
  const cachee=ventesFacturesCache.find(x=>String(x.idVente)===String(f.idVente));
  const provisoire=cachee||{
    idVente:f.idVente,idClient:f.idClient,clientNom:f.clientNom,
    clientTelephone:f.clientTelephone,clientEmail:f.clientEmail,
    dateVente:f.dateEmission,heureVente:f.heureEmission,
    montantNet:f.montantTTC,montantPaye:f.montantPaye,
    montantAvoirUtilise:f.montantAvoirUtilise,resteAPayer:f.resteAPayer,
    statut:f.statut,details:Array.isArray(f.details)?f.details:[]
  };
  fermerFacture();
  afficherVenteDansFactures(provisoire,f);

  /* Enrichissement silencieux avec la vente complète. */
  if(!cachee){
    const ventes=await chargerVentesFacturesEnArrierePlan();
    const complete=ventes.find(x=>String(x.idVente)===String(f.idVente));
    if(complete && document.getElementById("invoice-sale-modal")?.classList.contains("active")){
      afficherVenteDansFactures(complete,f);
    }
  }
}
function fermerVenteFacture(){
  const m=document.getElementById("invoice-sale-modal");m?.classList.remove("active");m?.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");
}

function imprimerFacture(f){
  const avoir=norm(f.typeFacture)==="avoir",details=Array.isArray(f.details)?f.details:[],o=avoir?facturesChargees.find(x=>String(x.idFacture)===String(f.idFactureOrigine)):null;
  const montantEncaisse=Math.max(0,Number(f.montantPaye)||0),montantAvoirUtilise=Math.max(0,Number(f.montantAvoirUtilise)||0),montantRegle=Math.min(Math.max(0,Number(f.montantTTC)||0),montantEncaisse+montantAvoirUtilise);
  const rows=details.length?details.map(l=>`<tr><td>${esc(l.designation||l.idProduit||"Article")}</td><td>${esc(nf(l.quantite))}</td><td>${esc(fcfa(l.prixUnitaireTTC))}</td><td>${esc(fcfa(l.remise))}</td><td>${esc(fcfa(l.sousTotalTTC))}</td></tr>`).join(""):'<tr><td colspan="5">Aucun détail produit.</td></tr>';
  const w=window.open("","_blank","width=900,height=850");if(!w)return toastFac("Autorisez les pop-ups pour imprimer.","error");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.numeroFacture||"Facture")}</title><style>body{font-family:Arial;color:#172033;padding:30px}.doc{max-width:850px;margin:auto}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:18px}.title{text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0}.box{padding:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px}table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:12px}th{background:#f8fafc;text-transform:uppercase;font-size:10px}th:not(:first-child),td:not(:first-child){text-align:right}.tot{margin:20px 0 0 auto;width:330px}.tot div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #cbd5e1}.reason{padding:12px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;margin:15px 0}@media print{body{padding:0}}</style></head><body><div class="doc"><div class="head"><div><h2>VISIBL</h2><small>Document commercial</small></div><div class="title"><b>${avoir?"FACTURE D’AVOIR":"FACTURE"}</b><h3>${esc(f.numeroFacture||"—")}</h3></div></div><div class="grid"><div class="box"><small>CLIENT</small><h3>${esc(f.clientNom||f.idClient||"Client")}</h3><div>${esc([f.clientTelephone,f.clientEmail].filter(Boolean).join(" · "))}</div></div><div class="box"><div><b>Date :</b> ${esc([f.dateEmission,f.heureEmission].filter(Boolean).join(" "))}</div><div><b>Vente :</b> ${esc(f.idVente||"—")}</div>${avoir?`<div><b>Facture origine :</b> ${esc(o?.numeroFacture||f.idFactureOrigine||"—")}</div>`:""}</div></div>${avoir?`<div class="reason"><b>Motif :</b> ${esc(f.motifAvoir||"Retour client")}</div>`:""}<table><thead><tr><th>Produit</th><th>Qté</th><th>Prix unitaire TTC</th><th>Remise</th><th>Sous-total TTC</th></tr></thead><tbody>${rows}</tbody></table><div class="tot"><div><span>Montant TTC</span><b>${esc(fcfa(f.montantTTC))}</b></div>${avoir?"":`<div><span>Paiement encaissé</span><b>${esc(fcfa(montantEncaisse))}</b></div>${montantAvoirUtilise>0?`<div><span>Avoir client utilisé</span><b>${esc(fcfa(montantAvoirUtilise))}</b></div>`:""}<div><span>Total réglé</span><b>${esc(fcfa(montantRegle))}</b></div><div><span>Reste</span><b>${esc(fcfa(f.resteAPayer))}</b></div>`}<div><span>Statut</span><b>${esc(f.statut||"—")}</b></div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);w.document.close();
}

function exporterFacturesCSV(){
  if(!facturesFiltrees.length)return toastFac("Aucune facture à exporter.","error");
  const cols=["ID Facture","Numéro de Facture","Type de Facture","ID Vente","ID Facture Origine","ID Client","Client","Date d’Émission","Heure d’Émission","Montant TTC","Montant Payé","Reste à Payer","Statut","Motif Avoir","ID Utilisateur","Commentaire"];
  const rows=facturesFiltrees.map(f=>[f.idFacture,f.numeroFacture,f.typeFacture,f.idVente,f.idFactureOrigine,f.idClient,f.clientNom,f.dateEmission,f.heureEmission,f.montantTTC,f.montantPaye,f.resteAPayer,f.statut,f.motifAvoir,f.idUtilisateur,f.commentaire]);
  const q=x=>'"'+String(x??"").replace(/"/g,'""')+'"',csv="\ufeff"+[cols,...rows].map(r=>r.map(q).join(";")).join("\r\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="VISIBL_factures_"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toastFac("Export terminé.","success");
}

function v(id){return document.getElementById(id)?.value||""}function t(id,x){const e=document.getElementById(id);if(e)e.textContent=x==null?"":String(x)}
function norm(x){return String(x==null?"":x).trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function statutClasse(x){x=norm(x);if(x.includes("partiellement"))return"partiellement-payee";if(x==="payee")return"payee";if(x.includes("annul"))return"annule";if(x==="emise"||x==="emis")return"emise";return x||"autre"}
function num(x){const n=Number(String(x??0).replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:0}function nf(x){return num(x).toLocaleString("fr-FR",{maximumFractionDigits:2})}function fcfa(x){return num(x).toLocaleString("fr-FR",{maximumFractionDigits:0})+" FCFA"}
function esc(x){return String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function toastFac(m,type="info"){if(typeof showToast==="function")return showToast(m,type);const c=document.getElementById("toast-container");if(!c)return;const e=document.createElement("div");e.className="toast "+type;e.textContent=m;c.appendChild(e);setTimeout(()=>e.remove(),3500)}


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

  /* Transforme la zone d'actions existante en un seul menu Actions sans casser les handlers. */
  const content=q("section.content");
  if(content){
    const actionButtons=qa("button",content).filter(b=>/export|imprim|actual|refresh|télécharg|telecharg/i.test((b.id||"")+" "+b.textContent));
    if(actionButtons.length){
      let host=actionButtons[0].closest(".toolbar-right,.actions,.toolbar-actions,.clients-toolbar,.sales-toolbar,.toolbar")||actionButtons[0].parentElement;
      if(host && !q(".visibl-common-toolbar-actions",host)){
        const wrap=document.createElement("div");wrap.className="visibl-common-toolbar-actions";
        const menuWrap=document.createElement("div");menuWrap.className="visibl-common-actions";
        const trigger=document.createElement("button");trigger.type="button";trigger.className="btn-secondary";trigger.textContent="Actions ⌄";trigger.setAttribute("aria-expanded","false");
        const menu=document.createElement("div");menu.className="visibl-common-actions-menu";menu.hidden=true;
        actionButtons.forEach(old=>{
          const clone=document.createElement("button");clone.type="button";clone.innerHTML=old.innerHTML||old.textContent;
          clone.addEventListener("click",()=>{old.click();menu.hidden=true;trigger.setAttribute("aria-expanded","false")});
          menu.appendChild(clone); old.style.display="none";
        });
        trigger.addEventListener("click",e=>{e.stopPropagation();menu.hidden=!menu.hidden;trigger.setAttribute("aria-expanded",String(!menu.hidden))});
        menuWrap.append(trigger,menu);wrap.append(menuWrap);host.appendChild(wrap);
        document.addEventListener("click",e=>{if(!e.target.closest(".visibl-common-actions")){menu.hidden=true;trigger.setAttribute("aria-expanded","false")}});
      }
    }

    /* Retire uniquement les boutons d'ajout en doublon dans les toolbars; celui du haut reste. */
    const topAdd=qa(".welcome-section button,.welcome-section a",content).find(x=>/nouveau|nouvelle|ajouter/i.test(x.textContent));
    if(topAdd){
      qa(".toolbar button,.toolbar a,.clients-toolbar button,.clients-toolbar a,.sales-toolbar button,.sales-toolbar a",content)
        .filter(x=>x!==topAdd && /nouveau|nouvelle|ajouter/i.test(x.textContent))
        .forEach(x=>x.style.display="none");
    }
  }
});
