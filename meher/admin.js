/* MT Core Studio Admin v4 - server-side sessions, per-user permissions, audit trail. */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const E=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),3200)};
let S=null,ME=null,CSRF="",USERS=[],AUD=[],VIEW="dash",Q="",SEL=null,PING=[];
let SYNC={state:{},play:{},policy:{}},AD=null,CFG=null,STAT=null,AN=null,SUBS=[];
const can=p=>ME&&(ME.role==="owner"||ME.perms.includes(p));
const when=t=>t?new Date(t*1000).toLocaleString([],{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Never";
const ago=t=>{if(!t)return"Never";const d=Math.floor(Date.now()/1000-t);return d<60?"just now":d<3600?Math.floor(d/60)+" min ago":d<86400?Math.floor(d/3600)+" h ago":Math.floor(d/86400)+" d ago"};
async function api(a,body){const o={method:body?"POST":"GET",credentials:"same-origin",headers:{"Content-Type":"application/json"}};if(body){o.body=JSON.stringify(body);o.headers["X-CSRF"]=CSRF}
 let j={};try{const r=await fetch("api.php?a="+a,o),t=await r.text();try{j=JSON.parse(t)}catch(e){j={err:"Server problem (HTTP "+r.status+"). Open /meher/check.php to see what is wrong."}}j._s=r.status}catch(e){j={err:"Cannot reach the server. Check your internet.",_s:0}}
 if(j._s===401&&ME){toast("Session ended. Please sign in again.");setTimeout(()=>location.reload(),900)}return j}
async function save(msg){const j=await api("save",S);if(j.ok){S=j.store;draw();if(j.same)toast("No changes to save");else if(msg)toast(msg);return true}toast(j.err||"Save failed");const d=await api("load");if(d.store){S=d.store;draw()}return false}
/* stars */
(()=>{const c=$("#stars"),x=c.getContext("2d");let s=[];function rs(){c.width=innerWidth;c.height=innerHeight;s=Array.from({length:Math.min(120,innerWidth/9)},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.3+.2,v:Math.random()*.12+.03,p:Math.random()*6}))}rs();addEventListener("resize",rs);
(function f(t){x.clearRect(0,0,c.width,c.height);s.forEach(o=>{o.y+=o.v;if(o.y>c.height)o.y=0;x.globalAlpha=.35+.45*Math.sin(t/900+o.p);x.fillStyle="#9fd8ff";x.beginPath();x.arc(o.x,o.y,o.r,0,7);x.fill()});requestAnimationFrame(f)})(0)})();
/* auth */
async function enter(){const d=await api("load");if(!d.store){$("#lg").hidden=false;$("#app").hidden=true;if(d.err)$("#le2").textContent=d.err;return}S=d.store;ME=d.user;SYNC=d.sync||SYNC;$("#lg").hidden=true;$("#app").hidden=false;
 $("#un").textContent=ME.name;$("#ur").textContent=ME.role;$("#av").textContent=(ME.name[0]||"?").toUpperCase();
 $$("[data-perm]").forEach(e=>e.hidden=!can(e.dataset.perm));$("#sf").querySelectorAll("input").forEach(i=>i.disabled=!can("settings"));
 $("#f-cat").innerHTML=["Utility","Education","Productivity","Spiritual","Lifestyle","Entertainment"].map(c=>`<option>${c}</option>`).join("");
 if(S.apps[0])select(S.apps[0].id,true);else fillPanel(null);
 if(can("audit"))loadAudit();view(location.hash.slice(1)||"dash");health();loadStat();if(can("admob"))loadAd();setInterval(()=>{if(VIEW==="dash"&&!document.hidden)health(true)},15000)}
$("#lf").onsubmit=async e=>{e.preventDefault();$("#le2").textContent="";const j=await api("login",{email:$("#le").value,password:$("#lp").value});
 if(j.ok){CSRF=j.csrf;$("#lp").value="";enter()}else $("#le2").textContent=j.err||"Sign in failed."};
$("#ax").onclick=async()=>{await api("logout",{});location.reload()};
(async()=>{const m=await api("me");if(m.auth){CSRF=m.csrf;enter()}else if(m.err&&m._s>=500)$("#le2").textContent=m.err})();
/* navigation */
const TITLES={dash:"Dashboard",apps:"My Apps",media:"Media Library",admob:"AdMob Hub",log:"Changelog",analytics:"Analytics",subs:"Subscribers",sync:"Integrations",users:"Users & Access",activity:"Activity Log",health:"System Health",set:"Settings"};
const PV={admob:"admob",log:"updates",analytics:"analytics",subs:"subs",sync:"sync",users:"users",activity:"audit"};
async function view(v){if(!TITLES[v]||(PV[v]&&!can(PV[v])))v="dash";VIEW=v;history.replaceState(null,"","#"+v);
 $$(".vw").forEach(x=>x.classList.toggle("on",x.id==="v-"+v));$$("#nav button").forEach(b=>b.classList.toggle("on",b.dataset.v===v));$("#ttl").textContent=TITLES[v];$("#sb").classList.remove("o");
 if(v==="users"){const j=await api("users");USERS=j.users||[];drawUsers()}if(v==="activity")await loadAudit();if(v==="admob")await loadAd();if(v==="analytics")await loadAn();if(v==="subs")await loadSubs();if(v==="sync")await loadSync();draw();if(v==="dash")drawChart()}
$("#nav").onclick=e=>{const b=e.target.closest("button");if(b)view(b.dataset.v)};
$("#bell").onclick=()=>can("audit")?view("activity"):toast("No new notifications");
document.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(g)view(g.dataset.go);if(e.target.closest("[data-close]"))$$(".md").forEach(m=>m.hidden=true)});
$("#mbt").onclick=()=>$("#sb").classList.toggle("o");
$("#q").oninput=e=>{Q=e.target.value.toLowerCase();draw()};$("#sf2").onchange=draw;
$("#dt").onclick=async e=>{const b=e.target.closest("button");if(!b)return;$$("#dt button").forEach(x=>x.classList.toggle("on",x===b));$$(".pane").forEach(p=>p.classList.toggle("on",p.id==="t-"+b.dataset.t));
 if(b.dataset.t==="users"){const j=await api("users");USERS=j.users||[];drawUsers()}if(b.dataset.t==="logs")await loadAudit()};
/* rendering */
const stc=a=>a.st==="Published"?"p":a.st==="Draft"?"d":"c";
const src=u=>E(u&&u.startsWith("assets/")?"../"+u:u);
const ico=a=>{const pi=(SYNC.play[a.id]||{}).icon,i=(a.iconp&&pi)||a.icon||pi;return i?`<img class="ic" src="${src(i)}" alt="" loading="lazy">`:`<div class="ic" style="--c1:${E((a.c||[])[0]||"#4facfe")};--c2:${E((a.c||[])[1]||"#a855f7")}">${E(a.e||a.name[0]||"?")}</div>`};
const rtc=a=>{const p=SYNC.play[a.id];return p&&p.st==="ok"&&p.rt?` <span class="chip">★ ${p.rt}${p.ins?" · "+E(p.ins):""}</span>`:""};
const btns=a=>`<div class="acts"><button data-a="view" data-i="${E(a.id)}">View</button>${can("apps_edit")?`<button data-a="edit" data-i="${E(a.id)}">Edit</button><button data-a="pub" data-i="${E(a.id)}">${a.st==="Published"?"Unpublish":"Publish"}</button><button data-a="hide" data-i="${E(a.id)}">${a.hid?"Show":"Hide"}</button>`:""}${can("apps_edit")&&can("updates")?`<button data-a="ver" data-i="${E(a.id)}">Update V</button>`:""}${can("apps_delete")?`<button class="x" data-a="del" data-i="${E(a.id)}">Delete</button>`:""}</div>`;
const flt=()=>S.apps.filter(a=>(!Q||(a.name+a.cat+a.tag).toLowerCase().includes(Q))&&(!$("#sf2").value||a.st===$("#sf2").value));
function draw(){if(!S)return;const n=S.apps.length,p=S.apps.filter(a=>a.st==="Published").length;
 $("#kp").innerHTML=`<div><b>${n}</b><span>Total apps</span></div><div><b>${p}</b><span>Published</span></div><div><b>${n-p}</b><span>Not live yet</span></div><div><b>${S.log.length}</b><span>Updates logged</span></div>`;
 $("#dg").innerHTML=S.apps.map(a=>`<div class="ac ${a.hid?"hid":""} ${SEL===a.id?"sel":""}" data-sel="${E(a.id)}"><div class="ah">${ico(a)}<div><b>${E(a.name)}</b><small>${E(a.tag)||E(a.cat)}</small></div></div><div><span class="chip ${stc(a)}">${E(a.st)}</span> <span class="chip r">${E(a.ver)}</span>${a.hid?' <span class="chip">hidden</span>':""}</div>${btns(a)}</div>`).join("")||'<p class="mu">No apps yet.</p>';
 $("#al").innerHTML=flt().map(a=>`<div class="rw ${a.hid?"hid":""}">${ico(a)}<div class="nm"><b>${E(a.name)}</b><small>${E(a.tag)||"—"}</small></div><span class="chip">${E(a.cat)}</span><span class="chip ${stc(a)}">${E(a.st)}</span><span class="chip r">${E(a.ver)}</span>${rtc(a)}${btns(a)}</div>`).join("")||'<p class="mu">No apps match.</p>';
 const ch=can("audit")&&AUD.some(x=>x.a==="change")?AUD.filter(x=>x.a==="change").slice(0,6).map(x=>`<div><b>${E(x.u)}</b> ${E(x.d.split(" | ")[0])}<small>${ago(x.t)}</small></div>`):[...S.log].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(u=>`<div><b>${E(u.app)} ${E(u.ver)}</b> ${E(u.title)}<small>${E(u.date)}</small></div>`);
 $("#lc").innerHTML=ch.join("")||'<p class="mu">Nothing yet.</p>';
 $("#w-app").innerHTML=S.apps.map(a=>`<option>${E(a.name)}</option>`).join("");
 $("#dup").innerHTML=[...S.log].map((u,i)=>({u,i})).sort((a,b)=>b.u.date.localeCompare(a.u.date)).slice(0,12).map(({u,i})=>`<div class="rw" style="margin:0 0 8px"><div class="nm"><b>${E(u.app)}</b> <span class="chip r">${E(u.ver)}</span><small>${E(u.date)} · ${E(u.title)}: ${E((u.notes||[]).join("; "))}</small></div>${can("updates")?`<div class="acts"><button class="x" data-rm="${i}">Remove</button></div>`:""}</div>`).join("")||'<p class="mu">No updates yet.</p>';
 $("#ml").innerHTML=S.apps.map(a=>`<div class="card" style="margin-bottom:14px"><h2 style="margin-bottom:12px">${E(a.name)}</h2><div class="shots">${a.icon?`<img src="${src(a.icon)}" alt="" style="height:90px">`:""}${(a.shots||[]).map(s=>`<img src="${src(s)}" alt="">`).join("")||'<span class="mu">No images yet. Add URLs in the app editor.</span>'}</div></div>`).join("");
 S.set.s.forEach((x,i)=>{$("#s-"+(i+1)+"v").value=x[0];$("#s-"+(i+1)+"l").value=x[1]});$("#s-gp").value=S.set.gp;$("#s-em").value=S.set.em;
 const nb=AUD.filter(x=>x.a==="change"&&Date.now()/1000-x.t<86400).length;$("#bb").hidden=!nb;drawDlg();drawLog();if(VIEW==="sync")drawSync()}
/* app panel (right column) */
function select(id,quiet){SEL=id;const a=S.apps.find(x=>x.id===id);fillPanel(a||null);if(!quiet){if(VIEW!=="dash")view("dash");else draw()}}
function fillPanel(a){const ed=can("apps_edit");$("#f-id").value=a?a.id:"";$("#f-name").value=a?a.name:"";if(a&&![...$("#f-cat").options].some(o=>o.value===a.cat))$("#f-cat").add(new Option(a.cat,a.cat));$("#f-cat").value=a?a.cat:"Utility";$("#f-tag").value=a?a.tag:"";$("#f-desc").value=a?a.desc:"";$("#f-ver").value=a?a.ver:"v1.0.0";$("#f-st").value=a?a.st:"Draft";$("#f-url").value=a?a.url:"";$("#f-icon").value=a?a.icon:"";$("#f-shots").value=a?(a.shots||[]).join(", "):"";$("#f-pkg").value=a?a.pkg||"":"";$("#f-pol").value=a?a.policy||"":"";$("#f-iconp").checked=!!(a&&a.iconp);$("#f-feat").value=a?(a.feat||[]).join("\n"):"";accSel(a?a.acct:"");syncLines(a);$("#ppub").textContent=a&&a.st==="Published"?"Unpublish":"Publish";$("#ppub").hidden=!can("apps_edit")||!a;
 $("#pi").innerHTML=a?`<div class="ah">${ico(a)}<div><b>${E(a.name)}</b><small>${E(a.ver)}</small></div></div>`:'<b>New app</b>';$("#pc").textContent=a?a.st:"Draft";$("#pc").className="chip "+(a?stc(a):"d");
 $("#ps").innerHTML=a?(a.shots||[]).slice(0,4).map(s=>`<img src="${src(s)}" alt="">`).join(""):"";
 $("#ef").querySelectorAll("input,select,textarea").forEach(i=>i.disabled=!ed);$("#sv").hidden=!ed;$("#phide").hidden=!ed||!a;$("#phide").textContent=a&&a.hid?"Show":"Hide";$("#pdel").hidden=!can("apps_delete")||!a}
function openNew(){SEL=null;fillPanel(null);view("dash");setTimeout(()=>$("#f-name").focus(),50)}
$("#na").onclick=openNew;
const PKGRE=/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
function accSel(sel){$("#f-acct").innerHTML='<option value="">— none —</option>'+((AD&&AD.accounts)||[]).map(a=>`<option value="${E(a.id)}">${E(a.label||a.pub)}</option>`).join("");$("#f-acct").value=sel||""}
function syncLines(a){const p=a&&SYNC.play[a.id],l=a&&SYNC.policy[a.id];
 $("#fsy").innerHTML=!a?"":!a.pkg?'<span class="no">Add the package name to fetch rating, downloads and icon from Google Play.</span>':!p?'<span class="no">Not synced yet. Save the app to fetch from Google Play.</span>':p.st==="ok"?`<span class="ok">✓ ★ ${p.rt||"–"} · ${E(p.ins||"no download count")} · synced ${ago(p.ts)}</span>`:`<span class="${p.st==="notfound"?"no":"er"}">${E(p.msg)}</span>`;
 $("#fpl").innerHTML=!a||!a.policy?"":!l?'<span class="no">Not synced yet. Save the app to pull it from GitHub.</span>':l.st==="ok"?`<span class="ok">✓ Live at <a href="../privacy/${E(a.id)}" target="_blank" rel="noopener">/privacy/${E(a.id)}</a> · synced ${ago(l.ts)}</span>`:`<span class="er">${E(l.msg)}</span>`}
$("#ef").onsubmit=async e=>{e.preventDefault();const id=$("#f-id").value,o={name:$("#f-name").value.trim(),cat:$("#f-cat").value,tag:$("#f-tag").value.trim(),desc:$("#f-desc").value.trim(),ver:$("#f-ver").value.trim()||"v1.0.0",st:$("#f-st").value,url:$("#f-url").value.trim(),icon:$("#f-icon").value.trim(),shots:$("#f-shots").value.split(",").map(s=>s.trim()).filter(Boolean),
  pkg:$("#f-pkg").value.trim(),policy:$("#f-pol").value.trim(),acct:$("#f-acct").value,iconp:$("#f-iconp").checked,auto:$("#f-auto").checked,ppads:$("#f-ppads").checked,ppdata:$("#f-ppdata").checked,ppan:$("#f-ppan").checked,ppx:$("#f-ppx").value.trim(),feat:$("#f-feat").value.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,8)};let nid=id;
 if(o.pkg&&!PKGRE.test(o.pkg)){toast("That package name looks wrong. Example: com.studio.app");return}
 const prev=id?{...S.apps.find(a=>a.id===id)}:null;
 const ppk=x=>JSON.stringify([x.ppads,x.ppdata,x.ppan,x.ppx]);o.ppts=(prev&&prev.ppts&&ppk(prev)===ppk(o))?prev.ppts:Math.floor(Date.now()/1000);
 if(id)Object.assign(S.apps.find(a=>a.id===id),o);else{nid=(o.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"app")+"-"+Date.now().toString(36);o.id=nid;o.hid=false;o.c=["#4facfe","#a855f7"];o.e="";S.apps.push(o)}
 if(await save("App saved")){SEL=nid;const a=S.apps.find(x=>x.id===nid);
  if(a&&can("sync")&&((a.pkg&&(!prev||prev.pkg!==a.pkg||(a.auto&&!prev.auto)))||(a.policy&&(!prev||prev.policy!==a.policy)))){toast("Saved. Fetching from Google Play / GitHub…");const j=await api("sync",{what:"all",id:nid});if(j.ok){SYNC=j.res.info;if(j.store)S=j.store;toast("Sync finished")}else toast(j.err||"Sync failed");loadStat()}
  fillPanel(S.apps.find(x=>x.id===nid)||null);draw()}};
async function togglePub(a){const id=a.id;a.st=a.st==="Published"?"Draft":"Published";if(await save(a.st==="Published"?"Published: now live on the website":"Moved to Draft: removed from the website")&&SEL===id)fillPanel(S.apps.find(x=>x.id===id)||null)}
$("#ppub").onclick=()=>{const a=S.apps.find(x=>x.id===SEL);if(a)togglePub(a)};
$("#phide").onclick=()=>{const a=S.apps.find(x=>x.id===SEL);if(a){a.hid=!a.hid;save(a.hid?"App hidden":"App visible").then(()=>fillPanel(S.apps.find(x=>x.id===SEL)))}};
async function delApp(a){if(confirm(`Delete "${a.name}"? This is logged.`)){S.apps=S.apps.filter(x=>x!==a);if(await save("App deleted")){SEL=S.apps[0]?S.apps[0].id:null;fillPanel(S.apps[0]||null);draw()}}}
$("#pdel").onclick=()=>{const a=S.apps.find(x=>x.id===SEL);if(a)delApp(a)};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-a]");
 if(b){const a=S.apps.find(x=>x.id===b.dataset.i);if(!a)return;const k=b.dataset.a;
  if(k==="view")window.open("../#/apps","_blank");else if(k==="edit")select(a.id);
  else if(k==="pub")togglePub(a);else if(k==="hide"){a.hid=!a.hid;save(a.hid?"App hidden":"App visible")}else if(k==="del")delApp(a);
  else if(k==="ver"){const v=prompt("New version (e.g. v1.3.0):",a.ver);if(!v)return;const n=prompt("What changed? (short note)","Improvements and bug fixes");a.ver=v;S.log.push({app:a.name,ver:v,date:new Date().toISOString().slice(0,10),title:"New release",notes:[n||"Update"]});save("Version updated").then(()=>{if(SEL===a.id)fillPanel(a)})}return}
 const r=e.target.closest("[data-rm]");if(r){if(confirm("Remove this update note?")){S.log.splice(+r.dataset.rm,1);save("Update removed")}return}
 if(e.target.closest("button,a,input,select"))return;const c=e.target.closest("[data-sel]");if(c)select(c.dataset.sel)});
$("#wf").onsubmit=e=>{e.preventDefault();S.log.push({app:$("#w-app").value,ver:$("#w-ver").value.trim(),date:new Date().toISOString().slice(0,10),title:$("#w-title").value.trim(),notes:[$("#w-note").value.trim()]});save("Update added");$("#w-ver").value=$("#w-title").value=$("#w-note").value=""};
$("#sf").onsubmit=e=>{e.preventDefault();S.set.s=[1,2,3,4].map(i=>[$("#s-"+i+"v").value,$("#s-"+i+"l").value]);S.set.gp=$("#s-gp").value.trim();S.set.em=$("#s-em").value.trim();save("Settings saved")};
$("#pf").onsubmit=async e=>{e.preventDefault();const j=await api("passwd",{current:$("#pw0").value,new:$("#pw1").value});if(j.ok){$("#pw0").value=$("#pw1").value="";toast("Password changed")}else toast(j.err||"Failed")};
/* inside the Android app a native bridge saves to Downloads; in a browser the normal download is used */
function saveFile(name,mime,text){if(window.MTApp&&MTApp.save){MTApp.save(name,mime,text);return}const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:mime}));a.download=name;a.click()}
$("#ex").onclick=()=>saveFile("mtcorestudio-data.json","application/json",JSON.stringify(S,null,2));
/* users */
const PRE={admin:["apps_edit","apps_delete","updates","settings","audit","admob","sync","analytics","subs"],editor:["apps_edit","updates"],viewer:[]};
const PL={apps_edit:"edit apps",apps_delete:"delete apps",updates:"updates",settings:"settings",audit:"activity log",users:"manage users",admob:"AdMob hub",sync:"integrations",analytics:"analytics",subs:"subscribers"};
function drawUsers(){const h=USERS.map(u=>`<div class="rw"><div class="av" style="width:40px;height:40px">${E((u.name[0]||"?").toUpperCase())}</div><div class="nm"><b>${E(u.name)}</b> <span class="chip ${u.role==="owner"?"r":""}">${E(u.role)}</span> ${u.active?"":'<span class="chip d">disabled</span>'}<small>${E(u.email)} · last login ${ago(u.last)}</small><small>${u.role==="owner"?"Full access":(u.perms.map(p=>PL[p]).join(", ")||"View only")}</small></div>${u.role!=="owner"&&u.id!==ME.id&&can("users")?`<div class="acts"><button data-u="${E(u.id)}">Edit</button></div>`:""}</div>`).join("");$("#ul").innerHTML=h;$("#du").innerHTML=h+(can("users")?'<button class="btn ghost sm" data-go="users">Manage users →</button>':"")}
function openUser(u){$("#md").hidden=false;$("#mt").textContent=u?"Edit user":"Add user";$("#u-id").value=u?u.id:"";$("#u-name").value=u?u.name:"";$("#u-email").value=u?u.email:"";$("#u-role").value=u?u.role:"viewer";$("#u-pw").value="";$("#u-pwh").textContent=u?"(leave empty to keep)":"";$("#u-act").checked=u?u.active:true;$("#u-del").hidden=!u;
 $$(".pm input").forEach(c=>{c.checked=u?u.perms.includes(c.value):false;c.disabled=!can(c.value)||(c.value==="users"&&ME.role!=="owner")});$("#pk-users").hidden=ME.role!=="owner";if(!u)preset("viewer")}
function preset(r){$$(".pm input").forEach(c=>{if(!c.disabled)c.checked=PRE[r].includes(c.value)})}
$("#u-role").onchange=e=>preset(e.target.value);$("#nu").onclick=()=>openUser(null);
$("#u-gen").onclick=()=>{const c="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#%",a=crypto.getRandomValues(new Uint32Array(14));$("#u-pw").value=[...a].map(n=>c[n%c.length]).join("")};
document.addEventListener("click",e=>{const b=e.target.closest("[data-u]");if(b)openUser(USERS.find(u=>u.id===b.dataset.u))});
$("#uf").onsubmit=async e=>{e.preventDefault();const j=await api("user_save",{id:$("#u-id").value,name:$("#u-name").value,email:$("#u-email").value,role:$("#u-role").value,perms:$$(".pm input:checked").map(c=>c.value),active:$("#u-act").checked,password:$("#u-pw").value});
 if(j.ok){USERS=j.users;drawUsers();$("#md").hidden=true;toast("User saved")}else toast(j.err||"Failed")};
$("#u-del").onclick=async()=>{if(!confirm("Delete this account? This is logged."))return;const j=await api("user_delete",{id:$("#u-id").value});if(j.ok){USERS=j.users;drawUsers();$("#md").hidden=true;toast("User deleted")}else toast(j.err||"Failed")};
/* activity */
const AL={change:"Changed content",login:"Signed in",logout:"Signed out",login_failed:"Failed sign-in",password:"Password",user_create:"User created",user_update:"User updated",user_delete:"User deleted",denied:"Blocked",sync:"Synced data",sync_settings:"Sync settings",admob:"AdMob / app-ads",subs_delete:"Subscriber removed"};
async function loadAudit(){if(!can("audit"))return;const j=await api("audit");AUD=j.log||[];const us=[...new Set(AUD.map(x=>x.u))];const cu=$("#af-u").value;$("#af-u").innerHTML='<option value="">All users</option>'+us.map(u=>`<option ${u===cu?"selected":""}>${E(u)}</option>`).join("");drawAudit();draw()}
const row=x=>`<div class="lr"><div><b>${E(x.u)}</b><small>${E(x.ip)}</small></div><div><span class="chip ${x.a==="change"?"r":x.a==="denied"||x.a==="login_failed"?"d":""}">${E(AL[x.a]||x.a)}</span><small>${when(x.t)}</small></div><div class="dt">${E(x.d).split(" | ").join("<br>")||"—"}</div></div>`;
function drawAudit(){const u=$("#af-u").value,q=$("#af-q").value.toLowerCase();$("#au").innerHTML=AUD.filter(x=>(!u||x.u===u)&&(!q||(x.d+x.a+x.u).toLowerCase().includes(q))).map(row).join("")||'<p class="mu" style="padding:14px 0">No activity yet.</p>'}
function drawDlg(){$("#dlg").innerHTML=AUD.slice(0,8).map(row).join("")||'<p class="mu" style="padding:14px 0">No activity yet.</p>'}
$("#af-u").onchange=drawAudit;$("#af-q").oninput=drawAudit;
/* health + chart */
let LAST={};
function drawChart(){const c=$("#ch");if(!c||!c.offsetWidth)return;const d=devicePixelRatio||1,w=c.offsetWidth,h=130;c.width=w*d;c.height=h*d;const x=c.getContext("2d");x.scale(d,d);x.clearRect(0,0,w,h);
 x.strokeStyle="rgba(148,190,255,.12)";x.lineWidth=1;for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,i*h/4);x.lineTo(w,i*h/4);x.stroke()}
 if(PING.length<2){$("#chm").textContent="Collecting live measurements…";return}const mx=Math.max(...PING,100)*1.25,st=w/(PING.length-1),y=v=>h-4-(v/mx)*(h-12);
 const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,"#00f2fe");g.addColorStop(1,"#a855f7");x.beginPath();PING.forEach((v,i)=>i?x.lineTo(i*st,y(v)):x.moveTo(0,y(v)));x.strokeStyle=g;x.lineWidth=2.2;x.stroke();
 x.lineTo(w,h);x.lineTo(0,h);x.closePath();const f=x.createLinearGradient(0,0,0,h);f.addColorStop(0,"rgba(0,242,254,.28)");f.addColorStop(1,"rgba(0,242,254,0)");x.fillStyle=f;x.fill();
 $("#chm").textContent=`Live: ${PING[PING.length-1]} ms (last ${PING.length} checks)`}
async function health(quiet){const t=performance.now(),p=await api("ping"),ms=Math.round(performance.now()-t),ok=!!p.ok;LAST={p,ok,ms};if(ok){PING.push(ms);if(PING.length>30)PING.shift()}
 const g=$("#gv");g.style.strokeDashoffset=ok&&p.writable?0:251;g.style.stroke=ok&&p.writable?"#10b981":"#ef4444";$("#gt").textContent=ok&&p.writable?"OK":"Check";$("#gm").textContent=ok?(p.writable?"Data storage writable":"Data folder is not writable"):"Server not reachable";
 drawChart();if(quiet)return;
 await loadStat();const st=STAT||{},ps=(st.sync||{}).play,pl=(st.sync||{}).policy,nPol=S.apps.filter(a=>a.policy).length;
 $("#hc").innerHTML=[["Admin API ("+(ok?ms+" ms":"n/a")+")",ok],["Data folder writable",ok&&!!p.writable],["HTTPS connection",ok&&!!p.https],
  ["Google Play sync",ps?ps.ok>0:null,ps?`${ps.ok}/${ps.n} apps · ${ago(ps.ts)}`:"Not run yet"],
  ["GitHub policy sync",nPol?(pl?pl.ok===pl.n&&pl.n>0:null):null,nPol?(pl?`${pl.ok}/${pl.n} · ${ago(pl.ts)}`:"Not run yet"):"No policies set"],
  ["Visitor analytics",st.an?st.an.v7>0:null,st.an?st.an.v7+" views (7 days)":"…"],
  ["app-ads.txt",st.admob?(st.admob.on>0&&st.admob.file):null,st.admob?(st.admob.on?st.admob.on+" account(s)"+(st.admob.file?"":" (PHP route)"):"No accounts"):"…"]]
  .map(([n,v,t])=>`<div><span>${n}</span><b style="color:${v===null?"#93a4c3":v?"#10b981":"#ef4444"}">${E(t||(v?"OK":"Check"))}</b></div>`).join("")}
$("#rc").onclick=()=>health();addEventListener("resize",drawChart);

/* ================= v4: status tiles, AdMob hub, integrations, analytics, subscribers, changelog ================= */
async function loadStat(){const j=await api("status");if(!j.sync)return;STAT=j;SYNC.state=j.sync;const A=j.admob,p=j.sync.play;
 $("#hm-admob").textContent=A.on?`${A.on} account${A.on>1?"s":""} live`:"No accounts";$("#hm-admob").className="nc"+(A.on&&A.file?" okc":"");$("#hm-admob2").textContent=A.file?"app-ads.txt is published":A.on?"Served by the PHP route":"Add IDs in AdMob Hub";
 $("#hm-play").textContent=p?`${p.ok}/${p.n} apps synced`:"Not synced yet";$("#hm-play").className="nc"+(p&&p.ok?" okc":"");$("#hm-play2").textContent=p?"Last sync "+ago(p.ts):"Add package names, then sync"}
const appName=id=>id==="studio"?"Developer page":(S.apps.find(a=>a.id===id)||{}).name||id;
const ADOK=l=>l[0]==="#"||/^(CONTACT|SUBDOMAIN|OWNERDOMAIN|MANAGERDOMAIN|INVENTORYPARTNERDOMAIN)\s*=\s*\S+$/i.test(l)||/^[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\s*,\s*[A-Za-z0-9._\-]{1,100}\s*,\s*(DIRECT|RESELLER)\s*(,\s*[A-Za-z0-9]{6,64})?\s*(#.*)?$/i.test(l);
/* --- AdMob hub --- */
const adText=()=>{if(!AD)return"";const L=[],seen=new Set(),add=l=>{const k=l.replace(/\s+/g,"").toLowerCase();if(!seen.has(k)){seen.add(k);L.push(l)}};
 AD.accounts.filter(a=>a.on).forEach(a=>add(`google.com, ${a.pub}, ${a.rel}, ${a.cert}`));AD.extra.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&ADOK(l)).forEach(add);return L.length?L.join("\n")+"\n":""};
const adSnap=()=>JSON.stringify([AD.accounts,AD.extra]);
async function loadAd(){const j=await api("admob");if(!j.ad)return;AD={accounts:j.ad.accounts,extra:j.ad.extra,file:j.file};AD.snap=adSnap();$("#ad-extra").value=AD.extra;$("#ad-open").href="../app-ads.txt";
 accSel((S.apps.find(a=>a.id===SEL)||{}).acct);drawAd()}
function drawAd(){if(!AD)return;const used={};S.apps.forEach(a=>{if(a.acct)(used[a.acct]=used[a.acct]||[]).push(a.name)});
 $("#ad-list").innerHTML=AD.accounts.map((a,i)=>`<div class="adr ${a.on?"":"off"}"><div><input data-ai="${i}" data-k="label" value="${E(a.label)}" placeholder="Account name" maxlength="60" aria-label="Account name"><div class="pub" style="margin-top:6px">${E(a.pub)}</div></div><div style="display:flex;gap:12px;align-items:center"><label class="sw" title="Include in app-ads.txt" style="margin:0"><input type="checkbox" data-ai="${i}" data-k="on" ${a.on?"checked":""} aria-label="Enabled"><i></i></label><div class="acts"><button class="x" data-ad-del="${i}">Remove</button></div></div><div class="r2"><select data-ai="${i}" data-k="rel" aria-label="Relationship"><option ${a.rel==="DIRECT"?"selected":""}>DIRECT</option><option ${a.rel==="RESELLER"?"selected":""}>RESELLER</option></select><input data-ai="${i}" data-k="cert" value="${E(a.cert)}" aria-label="Certification authority ID" spellcheck="false"></div><small>${used[a.id]?"Apps: "+E(used[a.id].join(", ")):"No apps assigned yet (choose it in My Apps → Edit)."}</small></div>`).join("")||'<p class="mu">No accounts yet. Paste your first ID below.</p>';adPreview()}
function adPreview(){if(!AD)return;const t=adText();$("#ad-pre").textContent=t||"(empty: no enabled accounts)";$("#ad-dirty").hidden=adSnap()===AD.snap;$("#ad-st").textContent=AD.file?"Static file":"PHP route";$("#ad-st").className="chip "+(AD.file?"p":"d")}
$("#v-admob").addEventListener("input",e=>{const t=e.target;if(!AD)return;if(t.id==="ad-extra"){AD.extra=t.value;adPreview();return}
 if(t.dataset.ai===undefined)return;const a=AD.accounts[+t.dataset.ai],k=t.dataset.k;if(!a)return;if(k==="on"){a.on=t.checked;drawAd();return}a[k]=k==="cert"?t.value.trim().toLowerCase():t.value;adPreview()});
$("#v-admob").addEventListener("click",e=>{const d=e.target.closest("[data-ad-del]");if(d&&AD&&confirm("Remove this account from app-ads.txt?")){AD.accounts.splice(+d.dataset.adDel,1);drawAd()}});
$("#ad-add").onclick=()=>{if(!AD)return;let add=0,dup=0,ex=0,skip=0;const have=new Set(AD.accounts.map(a=>a.pub));
 $("#ad-paste").value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(l=>{let m=l.match(/^google\.com\s*,\s*(?:pub-)?(\d{16})\s*,\s*(DIRECT|RESELLER)\s*(?:,\s*([a-f0-9]{16,32}))?/i),pub,rel="DIRECT",cert="f08c47fec0942fa0";
  if(m){pub="pub-"+m[1];rel=m[2].toUpperCase();if(m[3])cert=m[3].toLowerCase()}
  else if(/,/.test(l)&&ADOK(l)){if(!AD.extra.split(/\r?\n/).some(x=>x.trim().toLowerCase()===l.toLowerCase())){AD.extra+=(AD.extra&&!AD.extra.endsWith("\n")?"\n":"")+l+"\n";ex++}else dup++;return}
  else if(m=l.match(/(?:ca-app-pub-|pub-)?(\d{16})/))pub="pub-"+m[1];else{skip++;return}
  if(have.has(pub)){dup++;return}have.add(pub);AD.accounts.push({id:"a_"+Math.random().toString(36).slice(2,10),label:"AdMob account "+(AD.accounts.length+1),pub,rel,cert,on:true});add++});
 $("#ad-extra").value=AD.extra;$("#ad-paste").value="";drawAd();toast(`${add} account(s) added${dup?`, ${dup} duplicate(s) skipped`:""}${ex?`, ${ex} extra line(s)`:""}${skip?`, ${skip} line(s) not understood`:""}. Click Save & publish.`)};
$("#ad-save").onclick=async()=>{if(!AD)return;const j=await api("admob_save",{accounts:AD.accounts,extra:AD.extra});if(!j.ok){toast(j.err||"Save failed");return}
 AD.accounts=j.ad.accounts;AD.extra=j.ad.extra;AD.file=j.file;AD.snap=adSnap();drawAd();$("#ad-msg").textContent=(j.file?"Published ✓ The file is live at /app-ads.txt.":"Saved ✓ The root folder is not writable, so /app-ads.txt is served by PHP instead.")+(j.bad&&j.bad.length?` Ignored ${j.bad.length} invalid extra line(s), e.g. “${j.bad[0]}”.`:"");toast("app-ads.txt updated");loadStat()};
$("#ad-check").onclick=async()=>{$("#ad-msg").textContent="Checking the live file…";const j=await api("admob_check",{});$("#ad-msg").textContent=j.err&&!j.url?j.err:j.ok?(j.match?"✓ The live file matches what you see here.":"⚠ The live file is reachable but differs. Save & publish, then check again (it may be cached for a few minutes)."):"✗ Could not read "+j.url+" ("+(j.err||"HTTP "+j.code)+")"};
/* --- integrations --- */
async function loadSync(){const j=await api("cfg");if(!j.cfg)return;CFG=j;SYNC=j.sync;$("#sy-ttl").value=String(j.cfg.ttl_h);if(![...$("#sy-ttl").options].some(o=>o.value===String(j.cfg.ttl_h)))$("#sy-ttl").add(new Option(j.cfg.ttl_h+" hours",j.cfg.ttl_h));$("#sy-ttl").value=String(j.cfg.ttl_h);$("#sy-proxy").value=j.cfg.proxy;$("#sy-cron").value=j.cron;drawSync()}
function drawSync(){if(!CFG)return;const ok=can("sync");
 $("#sy-play").innerHTML=S.apps.filter(a=>a.pkg).map(a=>{const p=SYNC.play[a.id]||{};return `<div class="spy">${ico(a)}<div><b>${E(a.name)}</b><small>${E(a.pkg)}</small></div><div><span class="chip ${p.st==="ok"?"p":p.st==="notfound"?"d":p.st?"c":""}">${p.st==="ok"?"★ "+(p.rt||"–")+" · "+E(p.ins||"n/a"):p.st==="notfound"?"Not live yet":p.st?"Problem":"Not synced"}</span><small>${p.ts?ago(p.ts):""}</small></div><div class="acts"><button data-sy="${E(a.id)}" ${ok?"":"disabled"}>Sync</button></div></div>${p.st&&p.st!=="ok"?`<small class="mu" style="display:block;margin:-2px 0 8px">${E(p.msg||"")}</small>`:""}`}).join("")||'<p class="mu">No apps have a package name yet. Add it in My Apps → Edit.</p>';
 $("#sy-policy").innerHTML=S.apps.filter(a=>a.policy).map(a=>{const l=SYNC.policy[a.id];return `<div class="spy">${ico(a)}<div><b>${E(a.name)}</b><small>${E(a.policy)}</small></div><div><span class="chip ${l&&l.st==="ok"?"p":l?"d":""}">${l?l.st==="ok"?"Live":"Problem":"Not synced"}</span><small>${l&&l.ts?ago(l.ts):""}</small></div><div class="acts">${l&&l.st==="ok"?`<button data-pv="${E(a.id)}">View</button>`:""}<button data-sy="${E(a.id)}" data-w="policy" ${ok?"":"disabled"}>Sync</button></div></div>${l&&l.st!=="ok"?`<small class="mu" style="display:block;margin:-2px 0 8px">${E(l.msg||"")}</small>`:""}`}).join("")||'<p class="mu">No GitHub policy links yet. Add one in My Apps → Edit.</p>';
 const e=CFG.env;$("#sy-env").innerHTML=[["PHP cURL available",e.curl],["Outbound connections (fopen)",e.fopen||e.curl],["Icon folder writable",e.icons],["Site root writable (static app-ads.txt)",e.root]].map(([n,v])=>`<div><span>${n}</span><b style="color:${v?"#10b981":"#f59e0b"}">${v?"OK":"Limited"}</b></div>`).join("")}
async function runSync(what,id){toast("Syncing… this can take up to a minute");const j=await api("sync",{what,id:id||""});if(!j.ok){toast(j.err||"Sync failed");return}SYNC=j.res.info;drawSync();if(SEL)syncLines(S.apps.find(a=>a.id===SEL));
 const r=[...Object.values(j.res.play||{}),...Object.values(j.res.policy||{})],bad=r.filter(x=>x.st!=="ok").length;toast(!r.length?"Nothing to sync yet":bad?`Done: ${r.length-bad} ok, ${bad} need attention`:"Sync complete ✓");loadStat()}
$("#sy-all").onclick=()=>runSync("all","");$("#sy-pol").onclick=()=>runSync("policy","");
$("#v-sync").addEventListener("click",e=>{const b=e.target.closest("[data-sy]");if(b)runSync(b.dataset.w||"all",b.dataset.sy);const v=e.target.closest("[data-pv]");if(v)window.open("../privacy/"+v.dataset.pv,"_blank")});
$("#sy-copy").onclick=async()=>{try{await navigator.clipboard.writeText($("#sy-cron").value);toast("Refresh URL copied")}catch(e){$("#sy-cron").select()}};
$("#sy-f").onsubmit=async e=>{e.preventDefault();const j=await api("cfg_save",{proxy:$("#sy-proxy").value.trim(),ttl_h:+$("#sy-ttl").value});toast(j.ok?"Settings saved":j.err||"Failed")};
/* --- analytics --- */
const sumInto=(t,o)=>Object.entries(o||{}).forEach(([k,v])=>t[k]=(t[k]||0)+(+v||0));
const flag=c=>/^[A-Z]{2}$/.test(c)&&c!=="ZZ"?String.fromCodePoint(...[...c].map(x=>127397+x.charCodeAt())):"🌐";
let REG=null;try{REG=new Intl.DisplayNames(["en"],{type:"region"})}catch(e){}
const cname=c=>c==="ZZ"?"Unknown":(REG&&(()=>{try{return REG.of(c)}catch(e){return c}})())||c;
async function loadAn(){const j=await api("analytics&days="+$("#an-r").value);if(!j.days){toast(j.err||"Could not load analytics");return}AN=j.days;drawAn()}
$("#an-r").onchange=loadAn;
function bars(el,rows,unit){const mx=Math.max(1,...rows.map(r=>r[1]));$(el).innerHTML=rows.map(([l,v,sub])=>`<div class="bw"><span>${l}</span><div class="tr"><i style="width:${Math.max(2,v/mx*100)}%"></i></div><b>${v}${unit?" "+unit:""}${sub?` <small>${sub}</small>`:""}</b></div>`).join("")||'<p class="mu" style="margin:10px 0 0">No data yet.</p>'}
function drawAn(){const days=Object.values(AN),T={v:0,u:0,c:0,n:0},pg={},rf={},cl={},ap={},cc={};
 days.forEach(d=>{T.v+=d.v||0;T.u+=d.u||0;T.c+=d.c||0;T.n+=d.n||0;sumInto(pg,d.pg);sumInto(rf,d.rf);sumInto(cl,d.cl);Object.entries(d.ap||{}).forEach(([k,v])=>{const a=ap[k]=ap[k]||{v:0,c:0};a.v+=v.v||0;a.c+=v.c||0});Object.entries(d.cc||{}).forEach(([k,v])=>{const a=cc[k]=cc[k]||{v:0,u:0,c:0};a.v+=v.v||0;a.u+=v.u||0;a.c+=v.c||0})});
 const rate=T.u?Math.round(T.c/T.u*1000)/10:0;
 $("#an-kp").innerHTML=`<div><b>${T.v.toLocaleString()}</b><span>Page views</span></div><div><b>${T.u.toLocaleString()}</b><span>Visitors (daily unique)</span></div><div><b>${T.c.toLocaleString()}</b><span>Play Store clicks</span></div><div><b>${rate}%</b><span>Clicks per visitor</span></div><div><b>${T.n}</b><span>Newsletter signups</span></div>`;
 anChart();
 bars("#an-apps",Object.entries(ap).sort((a,b)=>b[1].c-a[1].c||b[1].v-a[1].v).slice(0,10).map(([k,v])=>[E(appName(k)),v.c,`${v.v} views`]),"clicks");
 bars("#an-cc",Object.entries(cc).sort((a,b)=>b[1].u-a[1].u).slice(0,12).map(([k,v])=>[`${flag(k)} ${E(cname(k))}`,v.u,v.c?`${v.c} clicks`:""]),"visitors");
 bars("#an-pg",Object.entries(pg).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>[E(k),v]),"views");
 bars("#an-rf",Object.entries(rf).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>[E(k),v]),"visits");
 bars("#an-cl",Object.entries(cl).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[E(k),v]),"clicks")}
function anChart(){const c=$("#an-ch");if(!c||!c.offsetWidth||!AN)return;const d=devicePixelRatio||1,w=c.offsetWidth,h=190;c.width=w*d;c.height=h*d;const x=c.getContext("2d");x.scale(d,d);x.clearRect(0,0,w,h);
 const days=Object.values(AN),V=days.map(q=>q.v||0),C=days.map(q=>q.c||0),mx=Math.max(5,...V,...C)*1.15,st=w/Math.max(1,days.length-1),y=v=>h-22-(v/mx)*(h-34);
 x.strokeStyle="rgba(148,190,255,.12)";x.fillStyle="#93a4c3";x.font="11px sans-serif";x.lineWidth=1;for(let i=0;i<4;i++){const yy=14+i*(h-36)/3;x.beginPath();x.moveTo(0,yy);x.lineTo(w,yy);x.stroke();x.fillText(Math.round(mx*(1-i/3)),2,yy-3)}
 const line=(a,col,fill)=>{x.beginPath();a.forEach((v,i)=>i?x.lineTo(i*st,y(v)):x.moveTo(0,y(v)));x.strokeStyle=col;x.lineWidth=2.2;x.stroke();if(fill){x.lineTo((a.length-1)*st,h-22);x.lineTo(0,h-22);x.closePath();const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,fill);g.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=g;x.fill()}};
 line(V,"#00f2fe","rgba(0,242,254,.22)");line(C,"#a855f7");const ks=Object.keys(AN);x.fillStyle="#93a4c3";x.textAlign="left";x.fillText(ks[0],2,h-6);x.textAlign="right";x.fillText(ks[ks.length-1],w-2,h-6)}
addEventListener("resize",()=>{if(VIEW==="analytics")anChart()});
/* --- subscribers --- */
async function loadSubs(){const j=await api("subs");if(!j.subs){toast(j.err||"Could not load subscribers");return}SUBS=j.subs;drawSubs()}
function drawSubs(){const q=$("#sb-q").value.toLowerCase(),l=SUBS.filter(s=>!q||s.e.includes(q));
 $("#sb-kp").innerHTML=`<div><b>${SUBS.length}</b><span>Subscribers</span></div><div><b>${SUBS.filter(s=>Date.now()/1000-s.t<7*864e2).length}</b><span>New this week</span></div><div><b>${SUBS.filter(s=>(s.a||[]).length).length}</b><span>Waiting for a launch</span></div>`;
 $("#sb-list").innerHTML=l.slice(0,300).map(s=>`<div class="sbr"><div><b>${E(s.e)}</b><small>${E(s.s||"site")} · ${ago(s.t)}</small></div><div class="mu">${(s.a||[]).map(a=>E(appName(a))).join(", ")||"General newsletter"}</div>${can("subs")?`<div class="acts"><button class="x" data-sbd="${E(s.e)}">Delete</button></div>`:""}</div>`).join("")||'<p class="mu">No subscribers yet. They will appear here when visitors use the newsletter form or "Get notified".</p>'}
$("#sb-q").oninput=drawSubs;
$("#sb-list").addEventListener("click",async e=>{const b=e.target.closest("[data-sbd]");if(!b||!confirm("Delete this subscriber? (They can sign up again.)"))return;const j=await api("subs_delete",{email:b.dataset.sbd});if(j.ok){SUBS=SUBS.filter(s=>s.e!==b.dataset.sbd);drawSubs();toast("Subscriber removed")}else toast(j.err||"Failed")});
$("#sb-copy").onclick=async()=>{try{await navigator.clipboard.writeText(SUBS.map(s=>s.e).join(", "));toast(SUBS.length+" emails copied")}catch(e){toast("Copy failed")}};
$("#sb-csv").onclick=()=>{const q=v=>'"'+String(v).replace(/"/g,'""')+'"',rows=[["email","date","source","apps"],...SUBS.map(s=>[s.e,new Date(s.t*1000).toISOString().slice(0,10),s.s||"",(s.a||[]).map(appName).join("; ")])];saveFile("subscribers.csv","text/csv",rows.map(r=>r.map(q).join(",")).join("\n"))};
/* --- changelog manager --- */
function drawLog(){const el=$("#lg-list");if(!el||!S)return;el.innerHTML=S.log.map((u,i)=>({u,i})).sort((a,b)=>b.u.date.localeCompare(a.u.date)).map(({u,i})=>`<div class="rw"><div class="nm"><b>${E(u.app)}</b> <span class="chip r">${E(u.ver)}</span><small>${E(u.date)} · ${E(u.title)}</small><small>${E((u.notes||[]).join(" • "))}</small></div>${can("updates")?`<div class="acts"><button data-lg="${i}">Edit</button></div>`:""}</div>`).join("")||'<p class="mu">No entries yet. Add your first release note.</p>'}
function openLog(i){const u=i===null?null:S.log[i];$("#md2").hidden=false;$("#lg-mt").textContent=u?"Edit changelog entry":"New changelog entry";$("#lg-i").value=u?i:"";
 $("#lg-app").innerHTML=S.apps.map(a=>`<option>${E(a.name)}</option>`).join("");if(u&&![...$("#lg-app").options].some(o=>o.value===u.app))$("#lg-app").add(new Option(u.app,u.app));
 $("#lg-app").value=u?u.app:(S.apps.find(a=>a.id===SEL)||S.apps[0]||{}).name||"";$("#lg-ver").value=u?u.ver:((S.apps.find(a=>a.id===SEL)||{}).ver||"");$("#lg-date").value=u?u.date:new Date().toISOString().slice(0,10);$("#lg-title").value=u?u.title:"New release";$("#lg-notes").value=u?(u.notes||[]).join("\n"):"";$("#lg-del").hidden=!u}
$("#lg-new").onclick=()=>openLog(null);
$("#lg-list").addEventListener("click",e=>{const b=e.target.closest("[data-lg]");if(b)openLog(+b.dataset.lg)});
$("#lf2").onsubmit=e=>{e.preventDefault();const i=$("#lg-i").value,o={app:$("#lg-app").value,ver:$("#lg-ver").value.trim(),date:$("#lg-date").value,title:$("#lg-title").value.trim(),notes:$("#lg-notes").value.split("\n").map(x=>x.trim()).filter(Boolean)};
 if(i!=="")S.log[+i]=o;else S.log.push(o);$("#md2").hidden=true;save("Changelog saved")};
$("#lg-del").onclick=()=>{const i=$("#lg-i").value;if(i===""||!confirm("Delete this entry?"))return;S.log.splice(+i,1);$("#md2").hidden=true;save("Entry deleted")};

/* ---- v5: the Google Play link is the single source of truth ---- */
const AUTOF=["f-name","f-ver","f-cat","f-tag","f-desc","f-icon","f-feat","f-shots"];
const pkgFrom=v=>{v=(v||"").trim();const m=v.match(/[?&]id=([A-Za-z0-9._]+)/);return m?m[1]:PKGRE.test(v)?v:""};
function effective(a){const p=a&&SYNC.play&&SYNC.play[a.id];if(!a||!a.auto||!p||!p.last_ok)return a;const o={...a};if(p.title)o.name=p.title;["ver","cat","tag"].forEach(k=>{if(p[k])o[k]=p[k]});["feat","shots"].forEach(k=>{if(p[k]&&p[k].length)o[k]=p[k]});if(p.desc)o.desc=p.desc;if(p.icon)o.icon=p.icon;return o}
const AUTOK={"f-name":"title","f-ver":"ver","f-cat":"cat","f-tag":"tag","f-desc":"desc","f-icon":"icon","f-feat":"feat","f-shots":"shots"};
const AUTOL={title:"name",ver:"version",cat:"category",tag:"tagline",desc:"description",icon:"icon",feat:"features",shots:"screenshots"};
function lockAuto(){const on=$("#f-auto").checked,ed=can("apps_edit"),a=S.apps.find(x=>x.id===$("#f-id").value),p=a&&SYNC.play&&SYNC.play[a.id],ok=!!(p&&p.last_ok),miss=[];
 AUTOF.forEach(id=>{const k=AUTOK[id],has=ok&&p[k]&&(!Array.isArray(p[k])||p[k].length);if(on&&ok&&!has)miss.push(AUTOL[k]);$("#"+id).disabled=!ed||(on&&!!has)});
 $("#fauto").innerHTML=!on?"":!ok?'<span class="no">Auto mode is on. Save the app or press Fetch to read the Google Play page.</span>':'<span class="ok">✓ Auto mode: fields read from Google Play refresh by themselves.</span>'+(miss.length?'<br><span class="no">Google Play did not provide: '+miss.join(", ")+'. Type these in by hand.</span>':"")}
const _fill=fillPanel;
fillPanel=function(a){_fill(effective(a));if(a&&!a.url&&a.pkg)$("#f-url").value="https://play.google.com/store/apps/details?id="+a.pkg;$("#f-auto").checked=!!(a&&a.auto);$("#fpf").hidden=!can("apps_edit");ppFill(a);lockAuto()};
$("#f-auto").addEventListener("change",lockAuto);
$("#f-url").addEventListener("input",()=>{const v=$("#f-url").value;if(/play\.google\.com/.test(v)){const p=pkgFrom(v);if(p)$("#f-pkg").value=p}});
async function importPlay(link){link=link||prompt("Paste the Google Play link of the app:\nhttps://play.google.com/store/apps/details?id=…");if(!link)return;
 toast("Reading Google Play…");const j=await api("play_import",{link:link.trim()});
 if(j.ok){S=j.store;SYNC=j.info;SEL=j.id;view("dash");fillPanel(S.apps.find(a=>a.id===j.id));draw();loadStat();toast("Imported. Name, icon, description and screenshots now sync automatically.")}
 else{toast(j.err||"Import failed");if(j.id)select(j.id)}}
$("#imp").onclick=()=>importPlay();
$("#fpf").onclick=async()=>{const link=$("#f-url").value.trim()||$("#f-pkg").value.trim(),pkg=pkgFrom(link);if(!pkg){toast("Paste the Google Play link first");return}
 const id=$("#f-id").value;if(!id)return importPlay(link);
 const a=S.apps.find(x=>x.id===id);a.pkg=pkg;a.auto=true;if(!a.url&&/play\.google\.com/.test(link))a.url=link;
 if(!(await save()))return;toast("Fetching from Google Play…");
 const j=await api("sync",{what:"play",id});if(!j.ok){toast(j.err||"Sync failed");return}
 SYNC=j.res.info;if(j.store)S=j.store;const p=SYNC.play[id];toast(p&&p.st==="ok"?"Fetched: "+(p.title||"app"):(p?p.msg:"Could not fetch"));
 fillPanel(S.apps.find(x=>x.id===id));draw();loadStat()};

/* installable app (PWA) */
if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js",{scope:"./"}).catch(()=>{}));

/* ---- v7: a privacy-policy link for every app (for Play Console) ---- */
const SITE=location.origin+location.pathname.replace(/meher\/?[^/]*$/,"");
function ppFill(a){const ed=can("apps_edit");$("#f-ppads").checked=a?a.ppads!==false:true;$("#f-ppdata").checked=!!(a&&a.ppdata);$("#f-ppan").checked=!!(a&&a.ppan);$("#f-ppx").value=a?a.ppx||"":"";
 ["f-ppads","f-ppdata","f-ppan","f-ppx"].forEach(i=>$("#"+i).disabled=!ed);
 const l=a&&a.id?SITE+"privacy/"+a.id:"";$("#f-ppl").value=l||"Save the app first to get its link";$("#ppc").disabled=!l;$("#ppo").hidden=!l;if(l)$("#ppo").href=l}
const copyText=async(t,m)=>{try{await navigator.clipboard.writeText(t);toast(m)}catch(e){toast("Select the link and copy it")}};
$("#ppc").onclick=()=>copyText($("#f-ppl").value,"Privacy policy link copied");
$("#f-ppl").onclick=e=>e.target.select();
function drawPL(){let c=$("#pl-card");if(!c){c=document.createElement("div");c.className="card";c.id="pl-card";c.innerHTML='<h3>Privacy policy links for Play Console</h3><p class="mu">One link per app. Paste it in Play Console, App content, Privacy policy. Each page works as soon as the app exists.</p><div id="pl-list"></div>';const v=$("#v-sync");(v.querySelector(".cols2>div:last-child")||v).appendChild(c)}
 $("#pl-list").innerHTML=S.apps.map(a=>{const l=SITE+"privacy/"+a.id;return `<div class="rw"><div style="min-width:0;flex:1"><b>${E(a.name)}</b><div class="mu" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(l)}</div></div><button class="btn sm" data-cp="${E(l)}">Copy</button><a class="btn sm ghost" href="${E(l)}" target="_blank" rel="noopener">Open</a></div>`}).join("")||'<p class="mu">No apps yet.</p>'}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-cp]");if(b)copyText(b.dataset.cp,"Link copied")});
const _ds=drawSync;drawSync=function(){_ds();drawPL()};
