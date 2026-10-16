const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const E=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const MT=window.MT||{};
const A="assets/apps/";
/* offline fallback only (used when data.php is unreachable) - the live copy comes from the admin panel */
const seed=()=>({apps:[
{id:"daily-spark",name:"Daily Spark",cat:"Productivity",tag:"Quotes • Motivation • Quiz",desc:"Get inspired every day with powerful quotes, motivation messages, flashcards and fun quizzes. Make your day brighter!",ver:"v1.2.0",st:"Coming Soon",url:"",icon:A+"com-dailyspark-quotes.png",shots:[A+"daily-spark-1.svg",A+"daily-spark-2.svg"],hid:false,feat:["Inspirational Quotes","Flashcards","Daily Quiz","Multiple Languages"],c:["#f59e0b","#ef4444"],e:"☀"},
{id:"shiftsync",name:"ShiftSync",cat:"Productivity",tag:"Work • Schedule • Life",desc:"Manage your work shifts, schedules and never miss your next duty.",ver:"v1.0.5",st:"Coming Soon",url:"",icon:A+"com-trdevworks-shiftsync-app.png",shots:[A+"shift-schedule-1.svg",A+"shift-schedule-2.svg"],hid:false,c:["#4facfe","#00f2fe"],e:"🗓"},
{id:"nursing-exam-prep",name:"Nursing Exam Preparation",cat:"Education",tag:"Study • Practice • Pass",desc:"Prepare for nursing exams with practice questions, explanations and mock tests.",ver:"v1.0.3",st:"Coming Soon",url:"",icon:A+"com-nurseexampreparation-nursing.png",shots:[A+"nursing-exam-1.svg",A+"nursing-exam-2.svg"],hid:false,c:["#a855f7","#4facfe"],e:"🩺"}],
log:[],set:{s:[["3+","Apps in portfolio"],["2+","AdMob accounts"],["100%","Passion"],["24/7","Support"]],gp:"",em:"trrahat03@gmail.com"},agg:{}});
/* data: show the last good copy instantly, then refresh from the server */
const CK="mtcs:d3";
const readCache=()=>{try{const c=JSON.parse(localStorage.getItem(CK)||"null");return c&&Date.now()-c.t<3*864e5&&c.d&&Array.isArray(c.d.apps)?c.d:null}catch(e){return null}};
const writeCache=d=>{try{localStorage.setItem(CK,JSON.stringify({t:Date.now(),d}))}catch(e){}};
let S=readCache(),pending=null,cat="All",slide=0;
const vis=()=>S.apps.filter(a=>!a.hid&&a.st!=="Draft");
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),2200)};
const cats=()=>["All",...new Set(vis().map(a=>a.cat))];
const stc=a=>a.st==="Published"?"p":a.st==="Draft"?"d":"c";
const k=n=>n>=1e6?+(n/1e6).toFixed(1)+"M":n>=1e3?+(n/1e3).toFixed(1)+"K":""+n;
const ico=a=>a.icon?`<img class="ic" src="${E(a.icon)}" alt="" width="58" height="58" loading="lazy" decoding="async">`:`<div class="ic" style="--c1:${E((a.c||[])[0]||"#4facfe")};--c2:${E((a.c||[])[1]||"#a855f7")}">${E(a.e||a.name[0])}</div>`;
const rate=a=>{const r=[];if(a.rt>0)r.push(`<span><b>★ ${(+a.rt).toFixed(1)}</b>${a.rc>0?` (${k(a.rc)})`:""}</span>`);if(a.ins)r.push(`<span>${E(a.ins)} downloads</span>`);return r.length?`<div class="rate">${r.join("")}</div>`:""};
const live=a=>a.st==="Published"&&a.url;
const playBtn=(a,loc,cls)=>`<a class="${cls}" data-play data-app="${E(a.id)}" data-loc="${loc}" href="${E(MT.playUrl?MT.playUrl(a.url,a.id,loc):a.url)}" target="_blank" rel="noopener">${cls==="gp hot"?"▶ GET IT ON GOOGLE PLAY":"View on Google Play →"}</a>`;
const card=(a,loc)=>`<article class="cd gl rv"><div class="ch">${ico(a)}<div><h3>${E(a.name)}</h3><div class="tg">${E(a.tag)}</div></div></div>${rate(a)}<p>${E(a.desc)}</p><div class="cmeta"><span class="tag ${stc(a)}">${E(a.st)}</span><span class="lnk"><a href="apps/${E(a.id)}">Details</a>${a.pol?`<a href="privacy/${E(a.id)}">Privacy</a>`:""}</span></div>${live(a)?playBtn(a,loc,"gp hot"):`<a class="gp" href="#/notify/${E(a.id)}">🔔 GET NOTIFIED</a>`}</article>`;
const skel=n=>Array.from({length:n},()=>`<article class="cd gl sk"><div class="ch"><i class="l1"></i><div style="flex:1;display:grid;gap:8px"><i class="l2"></i><i class="l2" style="width:40%"></i></div></div><i class="l3"></i><i class="l3" style="width:80%"></i><i class="l4"></i></article>`).join("");
/* scroll reveal */
const io="IntersectionObserver"in window&&!matchMedia("(prefers-reduced-motion:reduce)").matches?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{rootMargin:"0px 0px -5% 0px"}):null;
if(io)document.documentElement.classList.add("js");
const reveal=()=>$$(".rv:not(.in)").forEach(el=>io?io.observe(el):el.classList.add("in"));
function render(){
 const v=vis(),agg=S.agg||{};
 $("#st").innerHTML=S.set.s.filter(([a,b])=>a||b).map(([a,b])=>`<div><b class="cnt">${E(a)}</b><span>${E(b)}</span></div>`).join("");
 const pr=[];if(agg.rating>0)pr.push(`<span>★ <b>${(+agg.rating).toFixed(1)}</b> average rating</span>`);if(agg.installs>0)pr.push(`<span><b>${k(agg.installs)}+</b> downloads</span>`);pr.push(`<span>🔒 Privacy-first apps</span>`);
 $("#proof").innerHTML=pr.join("");
 $("#g-home").innerHTML=v.slice(0,6).map(a=>card(a,"home")).join("")||"<p>No apps yet.</p>";
 if(!cats().includes(cat))cat="All";
 $("#tabs").innerHTML=cats().map(c=>`<button class="tb ${c===cat?"on":""}" data-c="${E(c)}">${E(c)}</button>`).join("");
 $("#g-apps").innerHTML=v.filter(a=>cat==="All"||a.cat===cat).map(a=>card(a,"apps")).join("")||"<p>No apps in this category.</p>";
 const f=v.find(a=>a.feat)||v[0];
 $("#feat").innerHTML=f?`<div class="fp"><div class="ph"><div class="sc">${f.shots&&f.shots[0]?`<img class="on" src="${E(f.shots[0])}" alt="">`:`<img class="lg on" src="assets/images/mt-core-studio-logo-sm.png" alt="" style="position:static;width:46%;height:auto">`}</div></div></div><div><span class="eb">Featured App</span><h2 style="margin:10px 0 6px;font-size:36px">${E(f.name)}</h2><div class="tg">${E(f.tag)}</div>${rate(f)}<p style="color:var(--mu)">${E(f.desc)}</p><ul>${(f.feat||["Fast & lightweight","Clean interface","Made with care"]).map(x=>`<li>✦ ${E(x)}</li>`).join("")}</ul><div class="row">${live(f)?playBtn(f,"featured","bt bp"):`<a class="bt bp" href="#/notify/${E(f.id)}">Get notified →</a>`}<a class="bt bo" href="apps/${E(f.id)}">Details</a></div></div>`:"";
 const lg=n=>[...S.log].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,n).map(u=>`<div class="ti gl rv"><h3><span class="vt">${E(u.ver)}</span>${E(u.app)} — ${E(u.title)}</h3><small style="color:var(--mu)">${E(u.date)}</small><ul>${(u.notes||[]).map(x=>`<li>${E(x)}</li>`).join("")}</ul></div>`).join("")||"<p>No updates yet.</p>";
 $("#tl-home").innerHTML=lg(3);$("#tl-all").innerHTML=lg(99);
 const gp=S.set.gp;$("#gp").href=gp||"#";$("#gp").style.display=gp?"":"none";
 $("#ce").textContent=S.set.em;$("#cs").innerHTML=gp?`<a class="bt bo bs" href="${E(gp)}" target="_blank" rel="noopener">▶ Google Play</a>`:"";
 shots();structured();reveal();count();
 if(pending){const p=pending;pending=null;openNotify(p)}
}
function shots(){const imgs=vis().flatMap(a=>a.shots||[]);$("#scr").innerHTML=`<img class="lg on" src="assets/images/mt-core-studio-logo-sm.png" alt="" width="360" height="240" style="position:static;width:46%;height:auto">`+imgs.map(s=>`<img src="${E(s)}" alt="" loading="lazy">`).join("")}
setInterval(()=>{const im=$$("#scr img:not(.lg)");if(!im.length||document.hidden)return;im.forEach(i=>i.classList.remove("on"));$("#scr .lg").style.opacity=0;im[slide++%im.length].classList.add("on")},2600);
/* structured data for Google (Organization + app list) */
function structured(){let s=$("#ld");if(!s){s=document.createElement("script");s.type="application/ld+json";s.id="ld";document.head.appendChild(s)}
 const b=location.origin+location.pathname.replace(/[^/]*$/,"");
 s.textContent=JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"MT Core Studio","url":b,"logo":b+"assets/images/icon-512.png","sameAs":S.set.gp?[S.set.gp]:[]},{"@type":"ItemList","itemListElement":vis().map((a,i)=>({"@type":"ListItem","position":i+1,"name":a.name,"url":b+"apps/"+a.id}))}]})}
/* load data */
if(S)render();else{$("#g-home").innerHTML=skel(3);$("#g-apps").innerHTML=skel(3)}
fetch("data.php",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{
 if(d&&Array.isArray(d.apps)&&d.set){S=d;writeCache(d);render();if(d.stale)setTimeout(()=>fetch("sync.php?lazy=1",{keepalive:true}).catch(()=>{}),4000)}
 else if(!S){S=seed();render()}}).catch(()=>{if(!S){S=seed();render()}});
/* notify dialog (replaces the old mailto flow: captures the email and the app of interest) */
function openNotify(id){if(!S){pending=id;return}const a=S.apps.find(x=>x.id===id);if(!a){location.hash="#/apps";return}
 $("#ndt").textContent=`Get notified: ${a.name}`;$("#ndp").textContent="Leave your email and we'll tell you the moment it's on Google Play.";$("#ndf").dataset.app=a.id;$("#ndf .nl-msg").textContent="";
 const d=$("#nd");if(!d.open){d.showModal?d.showModal():d.setAttribute("open","")}$("#nde").focus()}
$("#nd").addEventListener("close",()=>{if(location.hash.startsWith("#/notify"))history.replaceState(null,"","#/apps")});
$("#ndx").onclick=()=>$("#nd").close();
$("#nd").addEventListener("click",e=>{if(e.target===$("#nd"))$("#nd").close()});
MT.onSub=f=>{if(f.id==="ndf")setTimeout(()=>$("#nd").open&&$("#nd").close(),1700)};
/* router */
const TT={home:"MT Core Studio | Building Useful Apps for Everyday Life",apps:"Android Apps | MT Core Studio",about:"About | MT Core Studio",updates:"Updates & Changelog | MT Core Studio",tools:"Developer Tools | MT Core Studio",contact:"Contact | MT Core Studio"};
function route(){const seg=(location.hash||"#/home").slice(2).split("?")[0].split("/"),h=seg[0],nf=h==="notify",p=nf?"apps":["home","apps","about","updates","tools","contact"].includes(h)?h:"home";
 $$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-"+p));$$("#lk a").forEach(a=>a.classList.toggle("on",a.getAttribute("href")==="#/"+p));$("#lk").classList.remove("o");
 document.title=TT[p];if(!nf)scrollTo({top:0});
 if(p==="contact"){const m=new URLSearchParams((location.hash.split("?")[1]||"")).get("app");if(m)$("#cm").value=`Please notify me when ${m} launches.`}
 if(nf)openNotify(seg[1]||"");
 reveal();if(p==="home")count();if(route.last!==p){MT.track&&MT.track("v",{p});route.last=p}}
function count(){$$(".cnt").forEach(n=>{const m=n.textContent.match(/^(\D*)([\d,.]+)(.*)$/);if(!m)return;const e=parseFloat(m[2].replace(/,/g,"")),t0=performance.now();if(matchMedia("(prefers-reduced-motion:reduce)").matches)return;const dec=(m[2].split(".")[1]||"").length;(function f(t){const q=Math.min(1,(t-t0)/1200),v=e*(1-Math.pow(1-q,3));n.textContent=m[1]+(dec?v.toFixed(dec):Math.round(v).toLocaleString())+m[3];if(q<1)requestAnimationFrame(f)})(t0)})}
addEventListener("hashchange",route);
/* ui */
$("#mb").onclick=()=>$("#lk").classList.toggle("o");
$("#tabs").onclick=e=>{const b=e.target.closest("[data-c]");if(b){cat=b.dataset.c;render()}};
$("#cf").onsubmit=e=>{e.preventDefault();location.href=`mailto:${S?S.set.em:"trrahat03@gmail.com"}?subject=${encodeURIComponent("Message from "+$("#cn").value)}&body=${encodeURIComponent($("#cm").value)}`};
$("#yr").textContent=new Date().getFullYear();
if(matchMedia("(hover:hover)").matches&&!matchMedia("(prefers-reduced-motion:reduce)").matches){
 $("#ph3").addEventListener("pointermove",e=>{const r=e.currentTarget.getBoundingClientRect();$("#ph").style.transform=`rotateY(${((e.clientX-r.left)/r.width-.5)*26}deg) rotateX(${-((e.clientY-r.top)/r.height-.5)*20}deg)`});
 $("#ph3").addEventListener("pointerleave",()=>$("#ph").style.transform="");
 document.addEventListener("pointermove",e=>{const c=e.target.closest&&e.target.closest(".cd:not(.sk)");if(!c)return;const r=c.getBoundingClientRect();c.style.transform=`perspective(800px) rotateX(${-((e.clientY-r.top)/r.height-.5)*8}deg) rotateY(${((e.clientX-r.left)/r.width-.5)*8}deg) translateY(-6px)`});
 document.addEventListener("pointerout",e=>{const c=e.target.closest&&e.target.closest(".cd");if(c&&!c.contains(e.relatedTarget))c.style.transform=""})}
/* developer tools (all client-side) */
const copy=async(t,m)=>{try{await navigator.clipboard.writeText(t);toast(m||"Copied")}catch(e){toast("Copy failed - select the text manually")}};
let linkOut="";
function utm(){const p=$("#u-pkg").value.trim(),o=$("#u-out");
 if(!p){linkOut="";o.textContent="Enter a package name to build your link.";return}
 if(!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(p)){linkOut="";o.innerHTML='<span class="no">That does not look like a package name (example: com.studio.app).</span>';return}
 const r=["utm_source="+$("#u-src").value.trim(),"utm_medium="+$("#u-med").value.trim(),"utm_campaign="+$("#u-cmp").value.trim()].filter(x=>!/=$/.test(x)).join("&");
 linkOut="https://play.google.com/store/apps/details?id="+encodeURIComponent(p)+(r?"&referrer="+encodeURIComponent(r):"");o.textContent=linkOut}
["#u-pkg","#u-src","#u-med","#u-cmp"].forEach(s=>$(s).addEventListener("input",utm));
$("#u-copy").onclick=()=>linkOut?copy(linkOut,"Link copied"):toast("Build a link first");
$("#u-html").onclick=()=>linkOut?copy(`<a href="${E(linkOut)}" target="_blank" rel="noopener">Get it on Google Play</a>`,"HTML copied"):toast("Build a link first");
let adsOut="";
const ADS=/^[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\s*,\s*[A-Za-z0-9._\-]{1,100}\s*,\s*(DIRECT|RESELLER)\s*(,\s*[A-Za-z0-9]{6,64})?\s*(#.*)?$/i,ADV=/^(CONTACT|SUBDOMAIN|OWNERDOMAIN|MANAGERDOMAIN|INVENTORYPARTNERDOMAIN)\s*=\s*\S+$/i;
function ads(){const lines=$("#a-in").value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean),res=[],keep=[],seen=new Set();
 lines.forEach(l=>{let fix=null,m;
  if(l[0]==="#"){res.push(`<div class="cm">${E(l)}</div>`);keep.push(l);return}
  if(m=l.match(/^(?:ca-app-pub-|pub-)?(\d{16})(?:[~\/]\d+)?$/i))fix=`google.com, pub-${m[1]}, DIRECT, f08c47fec0942fa0`;
  const v=fix||(ADS.test(l)||ADV.test(l)?l.replace(/\s*,\s*/g,", "):null);
  if(!v){res.push(`<div class="no">✗ ${E(l)}<br>&nbsp;&nbsp;Expected: domain, publisher-id, DIRECT or RESELLER[, certification-id]</div>`);return}
  const key=v.toLowerCase();if(seen.has(key)){res.push(`<div class="cm">• duplicate skipped: ${E(v)}</div>`);return}
  seen.add(key);keep.push(v);res.push(`<div class="ok">✓ ${E(v)}${fix?' <span class="cm">(converted from ID)</span>':""}</div>`)});
 adsOut=keep.length?keep.join("\n")+"\n":"";$("#a-out").innerHTML=res.join("")||'<span class="cm">Results appear here.</span>'}
$("#a-in").addEventListener("input",ads);
$("#a-copy").onclick=()=>adsOut?copy(adsOut,"Clean file copied"):toast("Paste something first");
render.ready=1;
route();
