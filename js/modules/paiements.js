let parametresFinancePaiements={formatMontant:"nombre-devise",nombreDecimales:0,libelleDevise:"FCFA"};
let paiementsCharges=[],paiementsFiltres=[],paiementSelectionne=null,pagePaiementsActuelle=1,taillePagePaiements=10;
document.addEventListener("DOMContentLoaded",async()=>{if(typeof requireAuth==="function"&&!requireAuth())return;initialiserPaiements();await chargerParametresFinancePaiements();chargerPaiements();});
function initialiserPaiements(){["payments-search-input","payment-origin-filter","payment-method-filter","payment-nature-filter","payment-status-filter"].forEach(id=>document.getElementById(id)?.addEventListener(id==="payments-search-input"?"input":"change",appliquerFiltresPaiements));document.getElementById("reset-payment-filters")?.addEventListener("click",reinitialiserFiltresPaiements);document.getElementById("refresh-payments-btn")?.addEventListener("click",chargerPaiements);document.getElementById("print-payments-btn")?.addEventListener("click",()=>window.print());document.getElementById("export-payments-btn")?.addEventListener("click",exporterPaiementsCSV);document.getElementById("payments-per-page")?.addEventListener("change",e=>{taillePagePaiements=Number(e.target.value)||10;pagePaiementsActuelle=1;afficherTableauPaiements();});document.getElementById("previous-payment-page-btn")?.addEventListener("click",()=>{if(pagePaiementsActuelle>1){pagePaiementsActuelle--;afficherTableauPaiements();}});document.getElementById("next-payment-page-btn")?.addEventListener("click",()=>{const t=obtenirTotalPagesPaiements();if(pagePaiementsActuelle<t){pagePaiementsActuelle++;afficherTableauPaiements();}});document.getElementById("payments-table-body")?.addEventListener("click",gererActionPaiement);document.getElementById("close-payment-detail-modal")?.addEventListener("click",fermerDetailPaiement);document.getElementById("close-payment-detail-footer")?.addEventListener("click",fermerDetailPaiement);document.getElementById("payment-detail-modal")?.addEventListener("click",e=>{if(e.target.id==="payment-detail-modal")fermerDetailPaiement();});document.getElementById("copy-payment-reference-btn")?.addEventListener("click",copierReferencePaiement);document.getElementById("open-payment-origin-btn")?.addEventListener("click",ouvrirOriginePaiementSelectionne);document.getElementById("close-payment-origin-modal")?.addEventListener("click",fermerOriginePaiement);document.getElementById("close-payment-origin-footer")?.addEventListener("click",fermerOriginePaiement);document.getElementById("payment-origin-modal")?.addEventListener("click",e=>{if(e.target.id==="payment-origin-modal")fermerOriginePaiement();});document.addEventListener("click",e=>{if(!e.target.closest(".payment-row-menu"))fermerMenusPaiement();});const hs=document.getElementById("header-payment-search");const run=()=>{const c=document.getElementById("payments-search-input");if(!c)return;c.value=hs?.value||"";appliquerFiltresPaiements();c.scrollIntoView({behavior:"smooth",block:"center"});};hs?.addEventListener("keydown",e=>{if(e.key==="Enter")run();});document.getElementById("header-payment-search-btn")?.addEventListener("click",run);}
async function chargerPaiements(){try{const r=await apiGet("getPaiements");if(!r?.success)throw new Error(r?.message||"Impossible de charger les paiements.");paiementsCharges=Array.isArray(r.paiements)?r.paiements:(Array.isArray(r.data)?r.data:[]);mettreAJourKPIPaiements(r.resume||{});appliquerFiltresPaiements();}catch(e){console.error(e);paiementsCharges=[];paiementsFiltres=[];afficherTableauPaiements();toastPaiement(e.message||"Erreur de chargement des paiements.","error");}}
function mettreAJourKPIPaiements(r){txt("payments-total-value",fcfa(r.totalEncaisse));txt("payments-sales-value",fcfa(r.totalVentes));txt("payments-deliveries-value",fcfa(r.totalLivraisons));txt("payments-count-value",Number(r.nombrePaiements||paiementsCharges.length||0).toLocaleString("fr-FR"));txt("payments-month-description",fcfa(r.totalMois)+" encaissé ce mois");}
function appliquerFiltresPaiements(){const q=nrm(val("payments-search-input")),o=nrm(val("payment-origin-filter")),m=nrm(val("payment-method-filter")),n=nrm(val("payment-nature-filter")),s=nrm(val("payment-status-filter"));paiementsFiltres=paiementsCharges.filter(p=>{const t=nrm([p.idPaiement,p.idVente,p.idLivraison,p.origine,p.referencePaiement,p.naturePaiement,p.modePaiement,p.statut,p.idUtilisateur,p.commentaire].join(" "));return(!q||t.includes(q))&&(!o||nrm(p.origine)===o)&&(!m||(Array.isArray(parametresFinancePaiements?.modesPaiement)&&parametresFinancePaiements.modesPaiement.length?nrm(p.modePaiement)===nrm(m):normMode(p.modePaiement)===m))&&(!n||nrm(p.naturePaiement)===n)&&(!s||normStatut(p.statut)===s);});txt("filtered-payment-count",paiementsFiltres.length);pagePaiementsActuelle=1;afficherTableauPaiements();}
function reinitialiserFiltresPaiements(){["payments-search-input","payment-origin-filter","payment-method-filter","payment-nature-filter","payment-status-filter"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});appliquerFiltresPaiements();}
function afficherTableauPaiements(){const tbody=document.getElementById("payments-table-body");if(!tbody)return;const total=obtenirTotalPagesPaiements();pagePaiementsActuelle=Math.min(Math.max(1,pagePaiementsActuelle),total);const debut=(pagePaiementsActuelle-1)*taillePagePaiements,liste=paiementsFiltres.slice(debut,debut+taillePagePaiements);if(!liste.length)tbody.innerHTML='<tr><td colspan="12" class="empty-table">Aucun paiement trouvé.</td></tr>';else tbody.innerHTML=liste.map(lignePaiement).join("");pagination(total);}
function lignePaiement(p){
    const o=nrm(p.origine),s=normStatut(p.statut),id=esc(p.idPaiement||"");
    const origineDisponible=!!(p.idVente||p.idLivraison);
    return `<tr>
        <td><strong>${esc(p.datePaiement||"—")}</strong><br><small>${esc(p.heurePaiement||"")}</small></td>
        <td><span class="payment-id">${id||"—"}</span></td>
        <td><span class="origin-badge origin-${o||"autre"}">${esc(label(p.origine||"—"))}</span></td>
        <td>${esc(p.idVente||"—")}</td>
        <td>${esc(p.idLivraison||"—")}</td>
        <td><span class="payment-amount">${esc(fcfa(p.montant))}</span></td>
        <td>${esc(labelMode(p.modePaiement))}</td>
        <td><span class="payment-reference">${esc(p.referencePaiement||"—")}</span></td>
        <td><span class="nature-badge">${esc(p.naturePaiement||"—")}</span></td>
        <td><span class="status-badge status-${s||"autre"}">${esc(label(p.statut||"—"))}</span></td>
        <td>${esc(p.idUtilisateur||"—")}</td>
        <td>
            <div class="payment-row-menu">
                <button type="button" class="payment-row-menu-trigger" data-payment-menu-trigger="${id}" aria-label="Actions du paiement" aria-expanded="false">⋮</button>
                <div class="payment-row-menu-dropdown" data-payment-menu="${id}" hidden>
                    <button type="button" data-payment-action="view" data-payment-id="${id}">👁️ <span>Voir les détails</span></button>
                    ${origineDisponible?`<button type="button" data-payment-action="origin" data-payment-id="${id}">🔗 <span>Voir l’origine</span></button>`:""}
                </div>
            </div>
        </td>
    </tr>`;
}
function obtenirTotalPagesPaiements(){return Math.max(1,Math.ceil(paiementsFiltres.length/taillePagePaiements));}
function pagination(total){txt("payments-pagination-summary",`Page ${pagePaiementsActuelle} / ${total}`);const p=document.getElementById("previous-payment-page-btn"),n=document.getElementById("next-payment-page-btn");if(p)p.disabled=pagePaiementsActuelle<=1;if(n)n.disabled=pagePaiementsActuelle>=total;const z=document.getElementById("payments-page-buttons");if(!z)return;let d=Math.max(1,pagePaiementsActuelle-3),f=Math.min(total,d+6);d=Math.max(1,f-6);z.innerHTML=Array.from({length:f-d+1},(_,i)=>d+i).map(x=>`<button type="button" class="pagination-btn ${x===pagePaiementsActuelle?"active":""}" data-payment-page="${x}">${x}</button>`).join("");z.querySelectorAll("[data-payment-page]").forEach(b=>b.addEventListener("click",()=>{pagePaiementsActuelle=Number(b.dataset.paymentPage);afficherTableauPaiements();}));}
function fermerMenusPaiement(excepte=null){
    document.querySelectorAll(".payment-row-menu-dropdown").forEach(menu=>{
        if(menu!==excepte) menu.hidden=true;
    });
    document.querySelectorAll(".payment-row-menu-trigger").forEach(btn=>{
        const menu=btn.parentElement?.querySelector(".payment-row-menu-dropdown");
        btn.setAttribute("aria-expanded",String(!!menu && !menu.hidden));
    });
}
function gererActionPaiement(e){
    const trigger=e.target.closest("[data-payment-menu-trigger]");
    if(trigger){
        e.stopPropagation();
        const menu=trigger.parentElement?.querySelector(".payment-row-menu-dropdown");
        if(!menu)return;
        const ouvrir=menu.hidden;
        fermerMenusPaiement(menu);
        menu.hidden=!ouvrir;
        trigger.setAttribute("aria-expanded",String(ouvrir));
        if(ouvrir){
            requestAnimationFrame(()=>{
                const rect=menu.getBoundingClientRect();
                menu.classList.toggle("open-up",rect.bottom>window.innerHeight-12 && rect.top>menu.offsetHeight+12);
            });
        }
        return;
    }
    const b=e.target.closest("[data-payment-action]");
    if(!b)return;
    const p=paiementsCharges.find(x=>String(x.idPaiement||"")===String(b.dataset.paymentId||""));
    fermerMenusPaiement();
    if(!p)return toastPaiement("Paiement introuvable.","error");
    if(b.dataset.paymentAction==="view")ouvrirDetailPaiement(p);
    if(b.dataset.paymentAction==="origin")ouvrirOriginePaiement(p);
}
function ouvrirDetailPaiement(p){
    paiementSelectionne=p;
    txt("payment-detail-title","Détails du paiement");
    txt("payment-detail-subtitle",`${label(p.origine||"Paiement client")} · ${p.referencePaiement||"Sans référence"}`);
    txt("payment-hero-reference",p.referencePaiement||p.idPaiement||"—");
    txt("payment-hero-amount",fcfa(p.montant));
    txt("payment-hero-status",label(p.statut||"—"));
    const d=[
        ["ID Paiement",p.idPaiement,"id"],
        ["Date / Heure",`${p.datePaiement||"—"} ${p.heurePaiement||""}`,"date"],
        ["Origine",label(p.origine),"origin"],
        ["ID Vente",p.idVente||"—","sale"],
        ["ID Livraison",p.idLivraison||"—","delivery"],
        ["Montant",fcfa(p.montant),"amount"],
        ["Mode de paiement",labelMode(p.modePaiement),"mode"],
        ["Référence",p.referencePaiement||"—","reference"],
        ["Nature",p.naturePaiement||"—","nature"],
        ["Statut",label(p.statut||"—"),"status"],
        ["Utilisateur",p.idUtilisateur||"—","user"],
        ["Commentaire",p.commentaire||"—","comment",true]
    ];
    const g=document.getElementById("payment-detail-grid");
    if(g)g.innerHTML=d.map(x=>`<div class="payment-detail-item payment-detail-item-${esc(x[2])} ${x[3]?"wide":""}"><span>${esc(x[0])}</span><strong>${esc(x[1]||"—")}</strong></div>`).join("");
    const heroStatus=document.getElementById("payment-hero-status");
    if(heroStatus)heroStatus.className=`payment-hero-status status-${normStatut(p.statut)}`;
    const bo=document.getElementById("open-payment-origin-btn");
    if(bo)bo.hidden=!p.idVente&&!p.idLivraison;
    const m=document.getElementById("payment-detail-modal");
    m?.classList.add("active");
    m?.setAttribute("aria-hidden","false");
    document.body.classList.add("modal-open");
}
function fermerDetailPaiement(){const m=document.getElementById("payment-detail-modal");m?.classList.remove("active");m?.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");}
async function copierReferencePaiement(){const r=paiementSelectionne?.referencePaiement||paiementSelectionne?.idPaiement||"";if(!r)return;try{await navigator.clipboard.writeText(r);toastPaiement("Référence copiée.","success");}catch(e){toastPaiement("Impossible de copier automatiquement la référence.","error");}}
function ouvrirOriginePaiementSelectionne(){if(paiementSelectionne){const p=paiementSelectionne;fermerDetailPaiement();ouvrirOriginePaiement(p);}}
function ouvrirOriginePaiement(p){
    paiementSelectionne=p;
    const estLivraison=nrm(p.origine)==="livraison" || (!!p.idLivraison && !p.idVente);
    const typeOrigine=estLivraison?"Livraison":"Vente";
    const idOrigine=estLivraison?(p.idLivraison||"—"):(p.idVente||"—");
    txt("payment-origin-title","Origine du paiement");
    txt("payment-origin-subtitle",`Transaction ${typeOrigine.toLowerCase()} liée au paiement ${p.idPaiement||""}`);
    txt("payment-origin-hero-type",typeOrigine);
    txt("payment-origin-hero-id",idOrigine);
    txt("payment-origin-hero-amount",fcfa(p.montant));
    const d=[
        ["Type d’origine",typeOrigine,"type"],
        ["ID de l’origine",idOrigine,"origin-id"],
        ["ID Vente",p.idVente||"—","sale"],
        ["ID Livraison",p.idLivraison||"—","delivery"],
        ["ID Paiement",p.idPaiement||"—","payment"],
        ["Date / Heure",`${p.datePaiement||"—"} ${p.heurePaiement||""}`,"date"],
        ["Montant encaissé",fcfa(p.montant),"amount"],
        ["Mode de paiement",labelMode(p.modePaiement),"mode"],
        ["Référence",p.referencePaiement||"—","reference"],
        ["Nature",p.naturePaiement||"—","nature"],
        ["Statut",label(p.statut||"—"),"status"],
        ["Utilisateur",p.idUtilisateur||"—","user"],
        ["Commentaire",p.commentaire||"—","comment",true]
    ];
    const g=document.getElementById("payment-origin-grid");
    if(g)g.innerHTML=d.map(x=>`<div class="payment-detail-item payment-detail-item-${esc(x[2])} ${x[3]?"wide":""}"><span>${esc(x[0])}</span><strong>${esc(x[1]||"—")}</strong></div>`).join("");
    const m=document.getElementById("payment-origin-modal");
    m?.classList.add("active");
    m?.setAttribute("aria-hidden","false");
    document.body.classList.add("modal-open");
}
function fermerOriginePaiement(){
    const m=document.getElementById("payment-origin-modal");
    m?.classList.remove("active");
    m?.setAttribute("aria-hidden","true");
    if(!document.getElementById("payment-detail-modal")?.classList.contains("active"))document.body.classList.remove("modal-open");
}
function exporterPaiementsCSV(){if(!paiementsFiltres.length)return toastPaiement("Aucun paiement à exporter.","error");const d=paiementsFiltres.map(p=>({"ID Paiement":p.idPaiement||"","ID Vente":p.idVente||"","ID Livraison":p.idLivraison||"",Origine:p.origine||"","Date de Paiement":p.datePaiement||"","Heure de Paiement":p.heurePaiement||"",Montant:num(p.montant),"Mode de Paiement":p.modePaiement||"","Référence de Paiement":p.referencePaiement||"","Nature du Paiement":p.naturePaiement||"",Statut:p.statut||"","ID Utilisateur":p.idUtilisateur||"",Commentaire:p.commentaire||""}));const c=Object.keys(d[0]),prot=v=>'"'+String(v??"").replace(/"/g,'""')+'"',l=[c.map(prot).join(";"),...d.map(r=>c.map(k=>prot(r[k])).join(";"))];const blob=new Blob(["\ufeff"+l.join("\r\n")],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="VISIBL_paiements_"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toastPaiement(paiementsFiltres.length+" paiement(s) exporté(s).","success");}
function val(id){return document.getElementById(id)?.value||""}function txt(id,v){const e=document.getElementById(id);if(e)e.textContent=v==null?"":String(v)}function nrm(v){return String(v==null?"":v).trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}function normMode(v){const m=nrm(v);if(m.includes("espece"))return"especes";if(m.includes("mobile")||m.includes("wave")||m.includes("orange"))return"mobile-money";if(m.includes("virement"))return"virement";if(m.includes("cheque"))return"cheque";return m}function normStatut(v){const s=nrm(v);if(s.includes("encaisse"))return"encaisse";if(s.includes("annul"))return"annule";if(s.includes("rejet"))return"rejete";return s||"autre"}function labelMode(v){return({especes:"Espèces","mobile-money":"Mobile Money",virement:"Virement",cheque:"Chèque"}[normMode(v)]||v||"—")}function label(v){const t=String(v==null?"":v).trim();return t?t.charAt(0).toUpperCase()+t.slice(1):"—"}function num(v){const n=Number(String(v??0).replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:0}function fcfa(v){const p=parametresFinancePaiements||{};const d=Number(p.nombreDecimales)===2?2:0;const n=num(v).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d});const devise=String(p.libelleDevise||"FCFA").trim()||"FCFA";return p.formatMontant==="devise-nombre"?devise+" "+n:n+" "+devise}function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function toastPaiement(message,type="info"){if(typeof showToast==="function"){showToast(message,type);return;}const c=document.getElementById("toast-container");if(!c){console.log(message);return;}const t=document.createElement("div");t.className="toast "+type;t.textContent=message;c.appendChild(t);setTimeout(()=>t.remove(),3500);}


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

  /* Transforme la zone d'actions existante en Sélection + Actions sans casser les handlers. */
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


/* PARAMÈTRES > FINANCE — PAIEMENTS */
async function chargerParametresFinancePaiements(){try{const r=await apiGet("getParametresFinance");if(r?.success)parametresFinancePaiements={...parametresFinancePaiements,...(r.data||r.parametres||{})};}catch(e){console.warn("Paramètres finance indisponibles dans Paiements :",e)}appliquerFiltreModesPaiementsDynamiques();}
function appliquerFiltreModesPaiementsDynamiques(){const s=document.getElementById("payment-method-filter");if(!s)return;const modes=Array.isArray(parametresFinancePaiements?.modesPaiement)?parametresFinancePaiements.modesPaiement.filter(m=>m&&m.actif!==false):[];if(!modes.length)return;const courant=s.value;s.innerHTML='<option value="">Tous les modes</option>'+modes.map(m=>`<option value="${String(m.id).replace(/"/g,"&quot;")}">${esc(m.libelle||m.id)}</option>`).join("");if(Array.from(s.options).some(o=>o.value===courant))s.value=courant;}
