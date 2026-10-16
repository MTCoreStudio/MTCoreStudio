/* MT Core Studio - shared by every page: privacy-friendly analytics, newsletter forms, background stars. */
(()=>{
const D=document,W=window,MT=W.MT=W.MT||{};
/* analytics: no cookies, honours Do-Not-Track / Global Privacy Control */
const dnt=navigator.doNotTrack==="1"||W.doNotTrack==="1"||navigator.globalPrivacyControl===true;
let tz="",first=true;try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(e){}
const refHost=()=>{try{const h=new URL(D.referrer).hostname.replace(/^www\./,"");return h&&h!==location.hostname?h:""}catch(e){return""}};
MT.track=(e,o)=>{if(dnt)return;o=o||{};const s=JSON.stringify({e,p:o.p||"",a:o.a||"",l:o.l||"",z:tz,r:e==="v"&&first?refHost():""});if(e==="v")first=false;
 try{if(navigator.sendBeacon)navigator.sendBeacon("track.php",new Blob([s],{type:"application/json"}));else fetch("track.php",{method:"POST",body:s,keepalive:true,headers:{"Content-Type":"application/json"}})}catch(x){}};
/* Play Store link: add attribution so installs can be traced to this site (utm via the Play "referrer" parameter) */
MT.playUrl=(u,id,loc)=>{if(!/^https:\/\/play\.google\.com\/store\/apps\/details/i.test(u||""))return u||"#";return u+(u.includes("?")?"&":"?")+"referrer="+encodeURIComponent("utm_source=mtcorestudio&utm_medium=portfolio&utm_campaign="+id+"&utm_content="+loc)};
const click=e=>{const a=e.target.closest&&e.target.closest("[data-play]");if(a)MT.track("c",{a:a.dataset.app,l:a.dataset.loc})};
D.addEventListener("click",click);D.addEventListener("auxclick",click);
/* server-rendered pages report their own page view (the single-page home reports route changes itself) */
const pg=D.body.dataset.page;
if(pg){const [k,id]=pg.split(":");if(!/-404$/.test(k))MT.track("v",{p:k,a:id||""});
 const mb=D.getElementById("mb"),lk=D.getElementById("lk");if(mb&&lk)mb.onclick=()=>lk.classList.toggle("o")}
/* newsletter / "notify me" forms: <form data-nl data-src="home" data-app="app-id"> */
D.addEventListener("submit",async e=>{const f=e.target.closest&&e.target.closest("form[data-nl]");if(!f)return;e.preventDefault();
 const m=f.querySelector(".nl-msg"),b=f.querySelector("button[type=submit]"),em=f.querySelector("input[name=email]"),hp=f.querySelector("input[name=hp]");
 const say=(t,c)=>{if(m){m.textContent=t;m.className="nl-msg "+(c||"")}};
 b.disabled=true;say("Saving…");
 try{const r=await fetch("subscribe.php",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em.value,app:f.dataset.app||"",src:f.dataset.src||"site",hp:hp?hp.value:""})});
  const j=await r.json().catch(()=>({}));
  if(j.ok){say(f.dataset.app?"You're on the list! We'll email you when it launches.":"Thanks for subscribing! 🎉","ok");em.value="";MT.track("n",{});if(MT.onSub)MT.onSub(f)}
  else say(j.err||"Something went wrong. Please try again.","er")}catch(x){say("Network problem. Please try again.","er")}
 b.disabled=false});
/* stars */
const c=D.getElementById("stars");
if(c&&!matchMedia("(prefers-reduced-motion:reduce)").matches){const x=c.getContext("2d");let s=[];
 const rs=()=>{c.width=innerWidth;c.height=innerHeight;s=Array.from({length:Math.min(140,innerWidth/8)},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.4+.2,v:Math.random()*.15+.03,p:Math.random()*6}))};rs();addEventListener("resize",rs);
 (function f(t){if(!D.hidden){x.clearRect(0,0,c.width,c.height);s.forEach(o=>{o.y+=o.v;if(o.y>c.height)o.y=0;x.globalAlpha=.4+.5*Math.sin(t/900+o.p);x.fillStyle="#9fd8ff";x.beginPath();x.arc(o.x,o.y,o.r,0,7);x.fill()})}requestAnimationFrame(f)})(0)}
})();
