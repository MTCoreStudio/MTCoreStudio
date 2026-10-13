/* ---------------------------------------------------------------------------
 * MT Core Studio — static site renderer (vanilla JavaScript, ES modules)
 *
 * Every page is a small HTML shell. This script fills in the header, main
 * content and footer using the centralized data files in /data:
 *   data/apps.js         app directory
 *   data/posts.js        studio notes / blog
 *   data/site-config.js  brand, contact and profile configuration
 *
 * No frameworks, no build step, no server requirements. Upload the files to
 * public_html on InfinityFree and it works.
 * ------------------------------------------------------------------------- */
import { apps } from "../data/apps.js";
import { posts } from "../data/posts.js";
import { siteConfig } from "../data/site-config.js";
import { changelog } from "../data/changelog.js";
import { appPolicies } from "../data/policies.js";

const logo = "assets/images/mt-core-studio-logo.png";
const pageName = document.body.dataset.page || "home";
const year = new Date().getFullYear();

/* ------------------------------ small helpers ----------------------------- */

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

const cleanUrl = (value = "") => {
  const input = String(value || "").trim();
  if (!input) return "";
  try {
    const parsed = new URL(input, window.location.href);
    return ["https:", "http:", "mailto:"].includes(parsed.protocol) ? input : "";
  } catch {
    return "";
  }
};

// Per-app privacy policies are authored (HTML) through the /admin console and
// stored in data/policies.js. This sanitizer keeps the rendered output free of
// <script> blocks and inline event handlers as a safety net.
const sanitizePolicyHTML = (html = "") =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s*(?:href|src)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, "");


// Filter list = "All" + every category used by the apps, keeping a familiar
// order first. New categories added to data/apps.js appear automatically.
const preferredCategories = [
  "Productivity",
  "Education",
  "Lifestyle",
  "Entertainment",
  "Tools",
  "Other"
];
const categories = [
  "All",
  ...preferredCategories.filter((c) => apps.some((app) => app.category === c)),
  ...[...new Set(apps.map((app) => app.category))]
    .filter((c) => c && !preferredCategories.includes(c))
];

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("publish")) return "status-live";
  if (s.includes("develop") || s.includes("beta")) return "status-brew";
  return "status-pending";
}

function availableAction(label, url, primary = false) {
  const safe = cleanUrl(url);
  if (safe) {
    return `<a class="button ${primary ? "button-primary" : "button-secondary"}" href="${escapeHTML(safe)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} <span aria-hidden="true">↗</span></a>`;
  }
  return `<button class="button button-secondary button-unavailable" type="button" disabled aria-disabled="true" title="This button activates once the app is published on Google Play">${escapeHTML(label)} <span aria-hidden="true">↗</span></button>`;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items
    .map(
      ([label, href]) =>
        href
          ? `<li><a href="${escapeHTML(href)}">${escapeHTML(label)}</a></li>`
          : `<li aria-current="page">${escapeHTML(label)}</li>`
    )
    .join("")}</ol></nav>`;
}

function waitlistBlock(app) {
  if (isPublished(app)) return "";
  return `<section class="detail-block waitlist-block">
    <span class="eyebrow">LAUNCH NOTICE</span>
    <h2>Get notified when ${escapeHTML(app.name)} launches.</h2>
    <p>Leave your email and I'll send one single note when this app goes live on Google Play. No spam, no lists sold — just the launch note. Your address is never shown publicly (see the <a class="text-link" href="privacy.html">privacy policy</a>).</p>
    <form class="waitlist-form" data-app="${escapeHTML(app.id)}" novalidate>
      <div class="waitlist-field">
        <label class="sr-only" for="waitlist-email">Email address</label>
        <input id="waitlist-email" type="email" name="email" required maxlength="254" placeholder="you@example.com" autocomplete="email">
        <button class="button button-primary" type="submit">Notify me</button>
      </div>
      <label class="waitlist-consent"><input type="checkbox" required><span>Yes — email me once when this app is published on Google Play.</span></label>
      <p class="waitlist-status" role="status" aria-live="polite"></p>
    </form>
  </section>`;
}

function changelogBlock(app) {
  const entries = changelog
    .filter((entry) => entry.app === app.id)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  if (!entries.length) {
    return `<section class="detail-block"><span class="eyebrow">UPDATES</span><h2>What's new</h2>
      <p class="detail-note">Release notes will be published here with the first release of ${escapeHTML(app.name)}.</p>
    </section>`;
  }
  return `<section class="detail-block"><span class="eyebrow">UPDATES</span><h2>What's new</h2>
    <ul class="changelog-list">${entries
      .map(
        (entry) => `<li><span class="changelog-version">${escapeHTML(entry.version || "next")}</span>${entry.date ? ` <span class="changelog-date">${escapeHTML(entry.date)}</span>` : ""}${Array.isArray(entry.notes) && entry.notes.length ? `<ul>${entry.notes.map((note) => `<li>${escapeHTML(note)}</li>`).join("")}</ul>` : ""}</li>`
      )
      .join("")}</ul>
  </section>`;
}

function statsBand() {
  const stats = Array.isArray(siteConfig.publishedStats) ? siteConfig.publishedStats : [];
  if (!stats.length) return "";
  return `<section class="stats-band" aria-label="Verified public statistics">
    <div class="wrap stats-row">${stats
      .map(
        (stat) => `<div class="stat"><span class="stat-number">${escapeHTML(stat.value || "")}</span><span class="stat-label">${escapeHTML(stat.label || "")}</span>${stat.source ? `<span class="stat-source">Source: ${escapeHTML(stat.source)}</span>` : ""}</div>`
      )
      .join("")}</div>
  </section>`;
}

function roadmapSection() {
  const items = Array.isArray(siteConfig.roadmap) ? siteConfig.roadmap : [];
  if (!items.length) return "";
  return `<section class="section"><div class="wrap">
    <div class="section-head" data-reveal><div><span class="eyebrow">WHAT'S NEXT</span><h2>Roadmap</h2><p>Where the studio is heading next — an honest plan that changes as work progresses.</p></div></div>
    <ol class="roadmap-list" data-reveal>${items
      .map(
        (item, index) => `<li><span class="roadmap-index">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHTML(item.title || "")}</h3><p>${escapeHTML(item.detail || "")}</p></div></li>`
      )
      .join("")}</ol>
  </div></section>`;
}

/* ------------------------------- shared UI -------------------------------- */

function iconTile(app, size = 56) {
  const src = String(app.icon || "").trim();
  const mono = escapeHTML(monogram(app.name));
  const img = src
    ? `<img class="app-icon" src="${escapeHTML(src)}" alt="${escapeHTML(app.name)} app icon" width="${size}" height="${size}" loading="lazy" onerror="this.remove()">`
    : "";
  return `<span class="icon-tile" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.34)}px" role="img" aria-label="${escapeHTML(app.name)} app icon">${img}<span class="icon-mono" aria-hidden="true">${mono}</span></span>`;
}

const isPublished = (app) =>
  /^published$/i.test(app.status || "") && !!cleanUrl(app.playStoreUrl);

const monogram = (name) =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

function header() {
  const links = [
    ["Home", "index.html", "home"],
    ["Apps", "apps.html", "apps"],
    ["About", "about.html", "about"],
    ["Updates", "updates.html", "updates"],
    ["Blog", "blog.html", "blog"],
    ["Contact", "contact.html", "contact"]
  ];
  return `<a class="skip-link" href="#main-content">Skip to content</a>
  <header class="site-header">
    <div class="wrap nav-row">
      <a class="brand" href="index.html" aria-label="MT Core Studio — home">
        <img src="${logo}" alt="MT Core Studio logo" width="66" height="44">
        <span class="brand-copy"><span class="brand-name">${escapeHTML(siteConfig.brandName)}</span><span class="brand-tag">${escapeHTML(siteConfig.tagline)}</span></span>
      </a>
      <nav class="nav-links" id="primary-navigation" aria-label="Main navigation">
        ${links
          .map(
            ([label, href, key]) =>
              `<a href="${href}"${pageName === key ? ' aria-current="page"' : ""}>${label}</a>`
          )
          .join("")}
      </nav>
      <div class="nav-actions">
        <button class="theme-toggle" type="button" id="theme-toggle" aria-label="Switch to light mode" title="Switch color theme"></button>
        <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="primary-navigation"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></button>
      </div>
    </div>
  </header>`;
}

function footer() {
  const socials = [
    [siteConfig.playStoreUrl, "Google Play"],
    [siteConfig.githubUrl, "GitHub"],
    [siteConfig.youtubeUrl, "YouTube"],
    [siteConfig.facebookUrl, "Facebook"],
    [siteConfig.xUrl, "X (Twitter)"]
  ].filter(([url]) => cleanUrl(url));

  const socialLinks = socials.length
    ? socials
        .map(
          ([url, label]) =>
            `<a class="footer-social" href="${escapeHTML(cleanUrl(url))}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">↗</span></a>`
        )
        .join("")
    : `<span class="footer-note">Official profiles will appear here once configured.</span>`;

  return `<footer class="site-footer">
    <div class="wrap footer-main">
      <div class="footer-brand">
        <a class="footer-logo" href="index.html" aria-label="MT Core Studio — home">
          <img src="${logo}" alt="MT Core Studio logo" width="81" height="54" loading="lazy">
          <span class="footer-logo-copy"><span class="brand-name">${escapeHTML(siteConfig.brandName)}</span><span class="brand-tag">${escapeHTML(siteConfig.tagline)}</span></span>
        </a>
        <p>I'm an independent Android app developer crafting useful, lightweight mobile applications for everyday life.</p>
      </div>
      <div class="footer-col"><h2 class="footer-heading">Explore</h2><div class="footer-links">
        <a href="index.html">Home</a><a href="apps.html">Apps</a><a href="about.html">About</a>
        <a href="developer.html">Developer</a><a href="publisher.html">Publisher</a><a href="blog.html">Blog</a><a href="updates.html">Updates</a>
      </div></div>
      <div class="footer-col"><h2 class="footer-heading">Information</h2><div class="footer-links">
        <a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms</a><a href="contact.html">Contact</a><a href="sitemap.xml">Sitemap</a>
      </div></div>
      <div class="footer-col"><h2 class="footer-heading">Connect</h2><div class="footer-links">${socialLinks}</div></div>
    </div>
    <div class="wrap footer-bottom">
      <span>© ${year} ${escapeHTML(siteConfig.brandName)}. All rights reserved.</span>
      <span>${escapeHTML(siteConfig.tagline)}</span>
    </div>
  </footer>`;
}

function appCard(app) {
  const href = `app.html?id=${encodeURIComponent(app.id)}`;
  return `<article class="app-card">
    <div class="app-card-top">${iconTile(app, 60)}<span class="category-pill">${escapeHTML(app.category)}</span></div>
    <h3 class="app-card-title"><a href="${href}">${escapeHTML(app.name)} <span aria-hidden="true">→</span></a></h3>
    <p class="app-card-desc">${escapeHTML(app.description || "Description to be added.")}</p>
    <div class="app-card-bottom">
      <span class="status-pill ${statusClass(app.status)}"><span class="status-dot" aria-hidden="true"></span>${escapeHTML(app.status || "Status to be confirmed")}</span>
    </div>
    <div class="app-card-actions">${availableAction("Google Play", app.playStoreUrl)}<a class="card-link" href="${href}">Details <span aria-hidden="true">↗</span></a></div>
  </article>`;
}

/* -------------------------------- home page ------------------------------- */

function studioStatusPanel() {
  const items = [
    ["Website online", true],
    ["Apps in development", apps.length > 0],
    ["Continuous development", true],
    ["New projects", true]
  ];
  return `<section class="section status-section"><div class="wrap">
    <div class="section-head" data-reveal>
      <div><span class="eyebrow">STUDIO STATUS</span><h2>A small studio, in active motion.</h2><p>A visual brand element showing MT Core Studio's current working state — it is not connected to real server monitoring.</p></div>
    </div>
    <div class="status-panel" data-reveal>
      <div class="status-head">
        <span class="status-pulse" aria-hidden="true"></span>
        <span class="status-title">MT CORE STUDIO</span>
        <span class="status-sub">STUDIO STATUS</span>
        <span class="status-live" role="status">LIVE</span>
      </div>
      <ul class="status-list">
        ${items.map(([label, on]) => `<li class="${on ? "is-on" : ""}"><span class="status-dot" aria-hidden="true"></span><span>${label}</span></li>`).join("")}
      </ul>
    </div>
  </div></section>`;
}

function featuredAppSection() {
  const app = apps[0];
  if (!app) return "";
  const screenshots = (Array.isArray(app.screenshots) ? app.screenshots : []).filter(Boolean);
  return `<section class="section featured-section"><div class="wrap">
    <div class="section-head" data-reveal>
      <div><span class="eyebrow">FEATURED APP</span><h2>${escapeHTML(app.name)}</h2><p>A closer look at the app currently leading the collection.</p></div>
    </div>
    <article class="featured-card" data-reveal>
      <div class="featured-media">
        ${iconTile(app, 120)}
        ${screenshots.length ? `<div class="featured-shots"><img src="${escapeHTML(screenshots[0])}" alt="${escapeHTML(app.name)} preview" loading="lazy">${screenshots.length > 1 ? `<img src="${escapeHTML(screenshots[1])}" alt="${escapeHTML(app.name)} preview" loading="lazy">` : ""}</div>` : ""}
      </div>
      <div class="featured-copy">
        <span class="category-pill">${escapeHTML(app.category)}</span>
        <h3>${escapeHTML(app.name)}</h3>
        <p>${escapeHTML(app.description || "")}</p>
        ${isPublished(app) ? `<div class="hero-actions featured-actions">${availableAction("View on Google Play", app.playStoreUrl, true)}<a class="button button-secondary" href="app.html?id=${encodeURIComponent(app.id)}">App details <span aria-hidden="true">→</span></a></div>` : `<a class="button button-secondary" href="app.html?id=${encodeURIComponent(app.id)}">App details <span aria-hidden="true">→</span></a>`}
      </div>
    </article>
  </div></section>`;
}

function ecosystemSection() {
  const cats = ["Productivity", "Education", "Lifestyle", "Tools", "Entertainment", "Utilities"];
  return `<section class="section ecosystem-section"><div class="wrap">
    <div class="section-head" data-reveal>
      <div><span class="eyebrow">APP ECOSYSTEM</span><h2>One studio, many categories.</h2><p>MT Core Studio applications span everyday categories — each one small, focused and genuinely useful.</p></div>
    </div>
    <div class="ecosystem" data-reveal>
      <div class="eco-connector" aria-hidden="true"></div>
      ${cats.map((cat, i) => `<div class="eco-node" style="--i:${i}" role="listitem" aria-label="${escapeHTML(cat)}">
        <span class="eco-orbit" aria-hidden="true"></span>
        <span class="eco-code" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <span class="eco-name">${escapeHTML(cat)}</span>
      </div>`).join("")}
    </div>
  </div></section>`;
}

function pipelineSection() {
  const steps = [
    ["Idea", "A clear need, shaped into an honest plan."],
    ["Design", "Screens and flows mapped with care."],
    ["Develop", "Modern Android tooling, kept small and fast."],
    ["Test", "Checked on emulators and real devices."],
    ["Publish", "A complete, honest Play Store listing."],
    ["Improve", "Feedback becomes the next update."]
  ];
  return `<section class="section pipeline-section"><div class="wrap">
    <div class="section-head" data-reveal>
      <div><span class="eyebrow">DEVELOPMENT PIPELINE</span><h2>From idea to Play Store.</h2><p>The full journey behind every MT Core Studio app.</p></div>
    </div>
    <ol class="pipeline" data-reveal>
      ${steps.map(([name, desc], i) => `<li class="pipeline-step" style="--i:${i}">
        <span class="pipeline-node" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <div class="pipeline-copy"><strong>${name}</strong><p>${desc}</p></div>
      </li>`).join("")}
    </ol>
  </div></section>`;
}

function purposeSection() {
  const items = [
    ["Useful", "Applications that solve real, everyday problems."],
    ["Simple", "Experiences that stay easy to understand."],
    ["Modern", "Current design and technology, used with restraint."],
    ["Performant", "Small, fast and practical — even on entry-level phones."]
  ];
  return `<section class="section purpose-section"><div class="wrap">
    <div class="section-head" data-reveal>
      <div><span class="eyebrow">BUILT WITH PURPOSE</span><h2>Principles behind every app.</h2><p>Four simple standards that shape each MT Core Studio product.</p></div>
    </div>
    <div class="purpose-grid" data-reveal>
      ${items.map(([title, text], i) => `<article class="purpose-card" style="--i:${i}">
        <span class="purpose-mark" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <h3>${title}</h3>
        <p>${text}</p>
      </article>`).join("")}
    </div>
  </div></section>`;
}

function legacyHomePage() {
  const heroPlay = cleanUrl(siteConfig.playStoreUrl)
    ? `<a class="button button-secondary button-google" href="${escapeHTML(cleanUrl(siteConfig.playStoreUrl))}" target="_blank" rel="noopener noreferrer">Google Play <span aria-hidden="true">↗</span></a>`
    : `<a class="button button-secondary" href="apps.html">View the collection <span aria-hidden="true">→</span></a>`;

  return `<section class="hero"><div class="hero-bg" aria-hidden="true"><canvas class="hero-canvas" data-fx="particles"></canvas><span class="hero-beam"></span></div>
  <div class="wrap hero-grid">
    <div class="reveal hero-lead">
      <span class="hero-chip">MT CORE STUDIO • APP DEVELOPMENT</span>
      <h1>BUILD. <span class="accent">INNOVATE.</span><br>SIMPLIFY.</h1>
      <p class="hero-copy">MT Core Studio creates useful mobile applications and digital products — simple, fast Android apps that make everyday routines a little easier.</p>
      <div class="hero-actions">
        <a class="button button-primary" href="apps.html">Explore Apps <span aria-hidden="true">→</span></a>
        ${heroPlay}
      </div>
    </div>
    <div class="hero-visual reveal reveal-delay" aria-label="MT Core Studio brand artwork">
      <div class="hero-orbit" aria-hidden="true"></div>
      <div class="hero-logo-frame"><img src="${logo}" alt="MT Core Studio logo" width="1536" height="1024"></div>
      <div class="visual-tag"><b>ONE DEVELOPER • ANDROID</b><span>Every app designed, built and shipped by me.</span></div>
    </div>
  </div></section>

  ${statsBand()}
  <section class="feature-band" aria-label="Studio principles" data-reveal><div class="wrap feature-row">
    ${["Useful", "Simple", "Modern", "Performant"]
      .map((label, i) => `<div class="feature"><span class="feature-mark" aria-hidden="true">${["01", "02", "03", "04"][i]}</span><span>${label}</span></div>`)
      .join("")}
  </div></section>

  ${featuredAppSection()}

  ${ecosystemSection()}

  <section class="section apps-directory-section"><div class="wrap">
    <div class="section-head" data-reveal>
      <div><span class="eyebrow">APPLICATION DIRECTORY</span><h2>Apps for real routines.</h2><p>A growing collection, each one built end-to-end by one developer.</p></div>
      <a class="text-link" href="apps.html">Browse all apps <span aria-hidden="true">→</span></a>
    </div>
    <div class="app-grid" data-reveal>${apps.slice(0, 3).map(appCard).join("")}</div>
  </div></section>

  ${pipelineSection()}

  ${purposeSection()}

  ${studioStatusPanel()}

  <section class="section-tight"><div class="wrap"><div class="studio-note" data-reveal>
    <div class="studio-stamp"><img src="${logo}" alt="" width="108" height="72" loading="lazy"><span>INDEPENDENT<br>BY DESIGN</span></div>
    <div><span class="eyebrow">A PERSONAL SCALE, A PRACTICAL FOCUS</span><h2>Small enough to stay close to the problem.</h2><p>MT Core Studio is my personal Android app-development brand — not a platform or a promise of scale. Every app is designed, coded, tested and maintained by me, one clear experience at a time.</p></div>
    <a class="text-link" href="about.html">More about the developer <span aria-hidden="true">→</span></a>
  </div></div></section>

  <section class="section-tight"><div class="wrap"><div class="callout" data-reveal><div class="callout-content">
    <span class="eyebrow">BUILD • INNOVATE • SIMPLIFY</span>
    <h2>Thoughtful tools. Less friction in the day.</h2>
    <p>Every MT Core Studio app starts the same way: a simple question — can this make a familiar task easier to handle?</p>
    <a href="about.html" class="button button-secondary">Get to know the developer <span aria-hidden="true">→</span></a>
  </div></div></section>`;
}



function homePage() {
  const latestPosts = [...posts]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 2);

  return `<section class="studio-hero">
    <div class="studio-hero-grid wrap">
      <div class="studio-hero-copy" data-reveal>
        <span class="eyebrow"><span class="eyebrow-mark" aria-hidden="true"></span> INDEPENDENT SOFTWARE STUDIO</span>
        <h1>Useful software,<br><span>thoughtfully built.</span></h1>
        <p>MT Core Studio creates focused Android applications for everyday life — carefully designed, clearly useful, and built to stay out of your way.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="apps.html">Explore apps <span aria-hidden="true">↗</span></a>
          <a class="button button-quiet" href="about.html">Meet the studio <span aria-hidden="true">→</span></a>
        </div>
        <div class="hero-meta"><span>BUILD <i>·</i> INNOVATE <i>·</i> SIMPLIFY</span><span>Independent Android development</span></div>
      </div>
      <div class="studio-hero-visual phone-ecosystem-scene" data-reveal aria-label="A floating smartphone showcasing MT Core Studio apps">
        <div class="hero-visual-grid" aria-hidden="true"></div>
        <div class="phone-orbit phone-orbit-one" aria-hidden="true"></div><div class="phone-orbit phone-orbit-two" aria-hidden="true"></div>
        <div class="phone-glow" aria-hidden="true"></div>
        <div class="app-phone" aria-label="MT Core Studio app showcase">
          <div class="phone-side-key phone-side-key-one"></div><div class="phone-side-key phone-side-key-two"></div>
          <div class="phone-screen">
            <div class="phone-status"><span>9:41</span><span class="phone-status-icons" aria-hidden="true"><i></i><i></i><i></i></span></div>
            <div class="phone-brand-row"><img src="${logo}" alt="" width="34" height="34"><div><strong>MT CORE</strong><small>APP ECOSYSTEM</small></div><span class="phone-live-dot" aria-hidden="true"></span></div>
            <div class="phone-welcome"><small>BUILT FOR EVERYDAY</small><h3>Ideas into<br><span>useful apps.</span></h3><p>One studio. Different ways to simplify life.</p></div>
            <div class="phone-apps-heading"><span>MY APPLICATIONS</span><span>${Math.min(apps.length, 6).toString().padStart(2, "0")} / 06</span></div>
            <div class="phone-app-grid">${apps.slice(0, 6).map((app, index) => `<a class="phone-app-item" href="app.html?id=${encodeURIComponent(app.id)}" style="--app-index:${index}" aria-label="View ${escapeHTML(app.name)}"><span class="phone-app-icon">${app.icon ? `<img src="${escapeHTML(app.icon)}" alt="${escapeHTML(app.name)} logo" loading="lazy" onerror="this.style.display='none'">` : `<span>${escapeHTML(monogram(app.name))}</span>`}</span><span class="phone-app-name">${escapeHTML(app.name)}</span><span class="phone-app-category">${escapeHTML(app.category || "APP")}</span></a>`).join("")}</div>
            <div class="phone-bottom-bar"><span></span><small>BUILD · INNOVATE · SIMPLIFY</small><span></span></div>
          </div>
        </div>
        <div class="floating-tech-tag tech-tag-top"><span class="tech-tag-dot"></span> ANDROID · MOBILE</div>
        <div class="floating-tech-tag tech-tag-bottom"><span class="tech-tag-spark">✦</span> MADE WITH PURPOSE</div>
        <div class="hero-visual-caption"><span class="caption-line"></span><span>SOFTWARE WITH A CLEAR PURPOSE</span></div>
      </div>
    </div>
    <a class="hero-scroll-cue" href="#studio-work"><span aria-hidden="true"></span> Explore the work</a>
  </section>

  <section class="section studio-work" id="studio-work"><div class="wrap">
    <div class="section-head studio-section-head" data-reveal><div><span class="eyebrow">THE APPLICATIONS</span><h2>Small ideas. Built with care.</h2><p>Explore the current collection and see what each product is being made to do.</p></div><a class="text-link" href="apps.html">Browse all apps <span aria-hidden="true">↗</span></a></div>
    <div class="app-grid" data-reveal>${apps.map(appCard).join("")}</div>
  </div></section>

  <section class="section studio-capabilities"><div class="wrap capabilities-layout">
    <div class="capabilities-intro" data-reveal><span class="eyebrow">FROM FIRST QUESTION TO RELEASE</span><h2>One clear process.<br><span>One accountable builder.</span></h2><p>Every app moves through the same careful cycle: understand the need, shape a useful experience, build it for Android, test the details, then keep improving.</p><a class="text-link" href="developer.html">About the developer <span aria-hidden="true">↗</span></a></div>
    <div class="capability-list" data-reveal>
      <article><span>01</span><div><h3>Product direction</h3><p>Start with a real everyday need and a focused scope.</p></div><b aria-hidden="true">↗</b></article>
      <article><span>02</span><div><h3>Interface design</h3><p>Make the important actions clear and comfortable to use.</p></div><b aria-hidden="true">↗</b></article>
      <article><span>03</span><div><h3>Android development</h3><p>Build practical, lightweight applications for mobile devices.</p></div><b aria-hidden="true">↗</b></article>
      <article><span>04</span><div><h3>Testing and iteration</h3><p>Check real flows, fix rough edges, and ship considered updates.</p></div><b aria-hidden="true">↗</b></article>
    </div>
  </div></section>

  <section class="section studio-principles"><div class="wrap principles-layout" data-reveal>
    <div><span class="eyebrow">THE STUDIO PRINCIPLE</span><h2>Build with intent.<br>Make it simpler.</h2></div>
    <div class="principle-cards">
      <article><span>01</span><h3>BUILD</h3><p>Create useful products for real routines.</p></article>
      <article><span>02</span><h3>INNOVATE</h3><p>Use technology where it makes the experience better.</p></article>
      <article><span>03</span><h3>SIMPLIFY</h3><p>Remove friction from everyday tasks.</p></article>
    </div>
  </div></section>

  ${latestPosts.length ? `<section class="section studio-latest"><div class="wrap"><div class="section-head studio-section-head" data-reveal><div><span class="eyebrow">LATEST FROM THE STUDIO</span><h2>Notes on the work.</h2><p>Product notes and updates, shared as the projects take shape.</p></div><a class="text-link" href="blog.html">All studio notes <span aria-hidden="true">↗</span></a></div><div class="latest-grid" data-reveal>${latestPosts.map((post) => `<article class="latest-card"><span class="latest-meta">${escapeHTML(post.category || "Studio")} <i>·</i> ${escapeHTML(post.date || "")}</span><h3><a href="blog.html">${escapeHTML(post.title)}</a></h3><p>${escapeHTML(post.description || "")}</p><a class="text-link" href="blog.html">Read note <span aria-hidden="true">↗</span></a></article>`).join("")}</div></div></section>` : ""}

  <section class="studio-final-cta"><div class="wrap final-cta-inner" data-reveal><div><span class="eyebrow">MT CORE STUDIO</span><h2>Have a useful idea<br>to talk through?</h2><p>Get in touch about the studio or explore the apps currently in development.</p></div><div class="hero-actions"><a class="button button-primary" href="contact.html">Contact the studio <span aria-hidden="true">↗</span></a><a class="button button-quiet" href="apps.html">Explore apps <span aria-hidden="true">→</span></a></div></div></section>`;
}

function appsPage() {
  return `<section class="page-intro"><div class="wrap">
    <span class="eyebrow">APPLICATION DIRECTORY</span>
    <h1>Useful apps, clearly listed.</h1>
    <p>Explore the current MT Core Studio app collection. Search by app name or category, and use the filters to narrow the list whenever it grows.</p>
  </div></section>
  <section class="content-section"><div class="wrap">
    <div class="directory-tools" data-reveal>
      <label class="search-wrap">
        <span class="search-icon" aria-hidden="true"></span>
        <span class="sr-only">Search apps by name or category</span>
        <input class="search-input" id="app-search" type="search" placeholder="Search app name or category…" autocomplete="off">
      </label>
      <div class="filter-row" role="group" aria-label="Filter apps by category">
        ${categories
          .map(
            (name, index) =>
              `<button class="filter-button" type="button" data-filter="${escapeHTML(name)}" aria-pressed="${index === 0 ? "true" : "false"}"${index === 0 ? ' aria-current="true"' : ""}>${escapeHTML(name)}</button>`
          )
          .join("")}
      </div>
    </div>
    <p class="result-count" id="result-count" aria-live="polite"></p>
    <div class="app-grid" id="apps-grid">${apps.map(appCard).join("")}</div>
    <div class="empty-state" id="apps-empty" hidden role="status"><strong>No apps match that search.</strong>Try a different name or choose another category.</div>
  </div></section>`;
}

/* ------------------------------ app detail page --------------------------- */

function detailPage() {
  const id = new URLSearchParams(window.location.search).get("id");
  const app = apps.find((item) => item.id === id);

  if (!app) {
    document.title = "App not found | MT Core Studio";
    return `<section class="page-intro"><div class="wrap">
      <span class="eyebrow">APP DETAILS</span>
      <h1>App not found.</h1>
      <p>That app record is not available. Browse the directory to see the current collection.</p>
      <div class="hero-actions"><a class="button button-primary" href="apps.html">Explore apps <span aria-hidden="true">→</span></a></div>
    </div></section>`;
  }

  // Keep page metadata in sync with the open app.
  document.title = `${app.name} | MT Core Studio`;
  const description = `${app.name} — ${app.category} ${app.platform || "Android"} app by MT Core Studio. ${app.description}`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${app.name} | MT Core Studio`);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  const siteRoot = siteConfig.canonicalDomain.replace(/\/+$/, "");
  const detailUrl = `${siteRoot}/app.html?id=${encodeURIComponent(app.id)}`;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = detailUrl;
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", detailUrl);
  const appImage = app.icon
    ? `${siteRoot}/${String(app.icon).replace(/^\.?\//, "")}`
    : `${siteRoot}/assets/images/mt-core-studio-logo.png`;
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", appImage);
  document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", appImage);

  const screenshots = Array.isArray(app.screenshots) ? app.screenshots.filter(Boolean) : [];
  const features = Array.isArray(app.features) ? app.features.filter(Boolean) : [];

  return `${breadcrumbs([["Home", "index.html"], ["Apps", "apps.html"], [app.name, ""]])}
  <section class="content-section"><div class="wrap detail-layout">
    <aside class="detail-aside" data-reveal>
      ${iconTile(app, 88)}
      <h1>${escapeHTML(app.name)}</h1>
      <p class="detail-intro">${escapeHTML(app.description || "")}</p>
      <div class="hero-actions detail-actions">${availableAction("View on Google Play", app.playStoreUrl, true)}</div>
      <dl class="detail-meta">
        <div class="meta-row"><dt>Category</dt><dd>${escapeHTML(app.category)}</dd></div>
        <div class="meta-row"><dt>Platform</dt><dd>${escapeHTML(app.platform || "Android")}</dd></div>
        <div class="meta-row"><dt>Status</dt><dd><span class="status-pill ${statusClass(app.status)}"><span class="status-dot" aria-hidden="true"></span>${escapeHTML(app.status || "Status to be confirmed")}</span></dd></div>
        <div class="meta-row"><dt>Package</dt><dd>${escapeHTML(app.packageName || "To be published")}</dd></div>
      </dl>
    </aside>
    <div class="detail-body" data-reveal>
      <section class="detail-block"><span class="eyebrow">OVERVIEW</span><h2>About this app</h2>
        <p>${escapeHTML(app.description)}</p>
        ${isPublished(app) ? "" : `<p class="detail-note">This app is in active preparation. The official Google Play listing will be linked here as soon as it is published.</p>`}
      </section>

      <section class="detail-block"><span class="eyebrow">WHAT IT DOES</span><h2>Features</h2>
        ${features.length
          ? `<ul class="feature-list" data-reveal>${features.map((feature) => `<li>${escapeHTML(feature)}</li>`).join("")}</ul>`
          : `<p class="detail-note">Feature details will be added as the app progresses.</p>`}
      </section>
      <section class="detail-block"><span class="eyebrow">GALLERY</span><h2>Screenshots</h2>
        ${screenshots.length
          ? `<div class="screenshot-grid" data-reveal>${screenshots
              .map((src, i) => `<figure class="screenshot"><img src="${escapeHTML(src)}" alt="${escapeHTML(app.name)} screenshot ${i + 1}" loading="lazy"></figure>`)
              .join("")}</div>`
          : `<p class="detail-note">Concept previews of the interface — the final design may change before release.</p>`}
      </section>
      <section class="detail-block"><span class="eyebrow">PRIVACY &amp; SUPPORT</span><h2>Privacy &amp; support</h2>
        <p class="legal-links">${cleanUrl(app.privacyUrl)
          ? `<a class="text-link" href="${escapeHTML(cleanUrl(app.privacyUrl))}" target="_blank" rel="noopener noreferrer">Privacy Policy <span aria-hidden="true">↗</span></a>`
          : `<span class="detail-note">A completed privacy policy will be linked here before the app is published.</span>`}${cleanUrl(app.termsUrl)
          ? ` <span class="legal-sep" aria-hidden="true">·</span> <a class="text-link" href="${escapeHTML(cleanUrl(app.termsUrl))}" target="_blank" rel="noopener noreferrer">Terms of Service <span aria-hidden="true">↗</span></a>`
          : ` <span class="detail-note">The terms of service will be linked here before the app is published.</span>`}</p>
        <p>Questions about ${escapeHTML(app.name)}? Visit the <a class="text-link" href="contact.html">contact page</a> or review the <a class="text-link" href="privacy.html">privacy policy</a>.</p>
      </section>

      ${waitlistBlock(app)}
      ${changelogBlock(app)}
    </div>
  </div></section>`;
}

/* --------------------------------- about page ----------------------------- */

function aboutPage() {
  return `<section class="page-intro"><div class="wrap">
    <span class="eyebrow">ABOUT MT CORE STUDIO</span>
    <h1>One developer. A clear purpose.</h1>
    <p>MT Core Studio is the personal brand behind my Android apps — an independent, one-person effort to build practical software that makes everyday routines a little easier.</p>
  </div></section>
  <section class="content-section"><div class="wrap">
    <div class="info-grid" data-reveal>
      <article class="info-panel"><span class="number">01 / WHO I AM</span><h2>Who I Am</h2><p>I'm an independent Android app developer working under the MT Core Studio brand. Every app on this site is designed, coded, tested and maintained by me.</p></article>
      <article class="info-panel"><span class="number">02 / WHAT I BUILD</span><h2>What I Build</h2><p>Practical Android applications across different categories. Each product begins with a simple question: can this make a familiar task easier to handle?</p></article>
      <article class="info-panel"><span class="number">03 / HOW I WORK</span><h2>How I Work</h2><p>The whole chain stays in one pair of hands: idea, design, code, testing, publishing and updates. That keeps quality control simple and honest.</p></article>
      <article class="info-panel"><span class="number">04 / WHY MT CORE STUDIO</span><h2>Why MT Core Studio</h2><p>A solo developer can stay close to the problem. My focus is on considered features, approachable interfaces and continuous improvement.</p></article>
    </div>
    <div class="principles"><div><span class="eyebrow">THE NAME SAYS IT SIMPLY</span><h2>Three ideas.<br>One working practice.</h2></div>
      <div class="principle-list" data-reveal><div class="principle"><b>BUILD</b><p>Create useful products that answer everyday needs.</p></div><div class="principle"><b>INNOVATE</b><p>Improve good ideas with thoughtful use of modern technology.</p></div><div class="principle"><b>SIMPLIFY</b><p>Make apps easier for everyday users to navigate and understand.</p></div></div>
    </div>
  </div></section>

  <section class="section practice-section"><div class="wrap practice-layout">
    <div class="practice-intro">
      <span class="eyebrow">FROM IDEA TO PLAY STORE</span>
      <h2>How an MT Core Studio app gets made.</h2>
      <p>Six clear stages, handled by one developer. No hand-offs and no lost context — just a plan that goes from a sketch to a published listing.</p>
      <div class="terminal-card" role="img" aria-label="Terminal window showing the app build workflow">
        <span class="term-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="term-line"><b>$</b> mtstudio new --android</span>
        <span class="term-line"><b>$</b> mtstudio design --material</span>
        <span class="term-line"><b>$</b> mtstudio build --kotlin</span>
        <span class="term-line"><b>$</b> mtstudio test --all-devices</span>
        <span class="term-line"><b>$</b> mtstudio publish --google-play</span>
        <span class="term-line term-ok">ok — release ready, shipping</span>
      </div>
    </div>
    <div class="practice-list" data-reveal>
      <article class="practice-step"><span>01</span><div><h3>Define the problem</h3><p>Write down the real need, the person it serves and the smallest version of the app that could genuinely help them.</p></div><b aria-hidden="true">↗</b></article>
      <article class="practice-step"><span>02</span><div><h3>Design the experience</h3><p>Sketch the screens and map every flow, following Android's Material Design system so the app feels native on any device.</p></div><b aria-hidden="true">↗</b></article>
      <article class="practice-step"><span>03</span><div><h3>Build a lightweight app</h3><p>Code it with modern Android tooling and keep it small, fast and smooth — even on entry-level phones.</p></div><b aria-hidden="true">↗</b></article>
      <article class="practice-step"><span>04</span><div><h3>Test every flow</h3><p>Run the app on emulators and real devices, then fix the rough edges, contrast and error states before anyone sees it.</p></div><b aria-hidden="true">↗</b></article>
      <article class="practice-step"><span>05</span><div><h3>Publish honestly</h3><p>Prepare the Play Store listing with real screenshots and a completed privacy policy, then launch and learn from feedback.</p></div><b aria-hidden="true">↗</b></article>
      <article class="practice-step"><span>06</span><div><h3>Keep improving</h3><p>Watch crash reports and reviews, then ship regular updates that keep the app fast, stable and genuinely useful.</p></div><b aria-hidden="true">↗</b></article>
    </div>
  </div></section>

  ${roadmapSection()}

  <section class="section"><div class="wrap toolbox-layout">
    <div class="practice-intro">
      <span class="eyebrow">TOOLBOX</span>
      <h2>The stack I build with.</h2>
      <p>A focused toolset chosen for quality, speed and low overhead — used end-to-end on every app in the directory.</p>
    </div>
    <ul class="stack-grid" data-reveal>
      <li class="chip">Android Studio</li>
      <li class="chip">Java &amp; Kotlin</li>
      <li class="chip">Material Design</li>
      <li class="chip">Figma</li>
      <li class="chip">Git &amp; GitHub</li>
      <li class="chip">Google Play Console</li>
      <li class="chip">AdMob</li>
      <li class="chip">HTML / CSS / JS</li>
      <li class="chip">PHP admin console</li>
    </ul>
  </div></section>`;
}

/* ------------------------------ developer page ---------------------------- */

function developerPage() {
  const configured = (label, value) =>
    cleanUrl(value)
      ? `<a class="profile-link" href="${escapeHTML(cleanUrl(value))}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">↗</span></a>`
      : "";

  return `<section class="page-intro"><div class="wrap">
    <span class="eyebrow">DEVELOPER PROFILE</span>
    <h1>One developer, building for mobile.</h1>
    <p>Public developer information for MT Core Studio. Details not provided are left unlisted rather than guessed.</p>
  </div></section>
  <section class="content-section"><div class="wrap">
    <article class="profile-card" data-reveal>
      <div class="profile-heading">${iconTile({ name: siteConfig.brandName, icon: logo }, 76)}<div><h2>${escapeHTML(siteConfig.brandName)}</h2><p>${escapeHTML(siteConfig.developerRole || "Independent Android App Developer")}</p></div></div>
      <dl class="detail-meta">
        <div class="meta-row"><dt>Developer name</dt><dd>${escapeHTML(siteConfig.developerName || "Not provided")}</dd></div>
        <div class="meta-row"><dt>Country</dt><dd>${escapeHTML(siteConfig.country || "Not provided")}</dd></div>
        <div class="meta-row"><dt>Website</dt><dd>${escapeHTML(siteConfig.websiteUrl || "Not provided")}</dd></div>
      </dl>
      <div class="profile-links">
        ${siteConfig.email ? `<a class="profile-link" href="mailto:${escapeHTML(siteConfig.email)}">Email MT Core Studio <span aria-hidden="true">↗</span></a>` : ""}
        ${configured("Google Play developer page", siteConfig.playStoreUrl)}
        ${configured("GitHub", siteConfig.githubUrl)}
        ${configured("YouTube", siteConfig.youtubeUrl)}
        ${configured("Facebook", siteConfig.facebookUrl)}
        ${configured("X (Twitter)", siteConfig.xUrl)}
      </div>
    </article>
    <div class="notice"><strong>About this profile</strong><br>Public links are read from <code>data/site-config.js</code>. Configure only verified details you intend to publish.</div>
  </div></section>`;
}

function publisherPage() {
  const published = apps.filter(isPublished);

  return `<section class="page-intro"><div class="wrap">
    <span class="eyebrow">PUBLISHER INFORMATION</span>
    <h1>Who publishes these apps.</h1>
    <p>Publicly shareable publisher details for MT Core Studio. Only information intentionally configured for publication appears here.</p>
  </div></section>
  <section class="content-section"><div class="wrap">
    <article class="profile-card" data-reveal>
      <div class="profile-heading">${iconTile({ name: siteConfig.brandName, icon: logo }, 76)}<div><h2>${escapeHTML(siteConfig.brandName)}</h2><p>${escapeHTML(siteConfig.developerRole)}</p></div></div>
      <dl class="detail-meta">
        <div class="meta-row"><dt>Publisher</dt><dd>${escapeHTML(siteConfig.brandName)}</dd></div>
        <div class="meta-row"><dt>Developer</dt><dd>${escapeHTML(siteConfig.developerName || "Not provided")}</dd></div>
        <div class="meta-row"><dt>Country</dt><dd>${escapeHTML(siteConfig.country || "Not provided")}</dd></div>
        <div class="meta-row"><dt>Support email</dt><dd>${siteConfig.email ? `<a class="text-link" href="mailto:${escapeHTML(siteConfig.email)}">${escapeHTML(siteConfig.email)}</a>` : "Not configured"}</dd></div>
        <div class="meta-row"><dt>Developer page</dt><dd>${cleanUrl(siteConfig.playStoreUrl) ? `<a class="text-link" href="${escapeHTML(cleanUrl(siteConfig.playStoreUrl))}" target="_blank" rel="noopener noreferrer">Google Play <span aria-hidden="true">↗</span></a>` : "Not configured"}</dd></div>
      </dl>
    </article>

    <div class="publisher-facts" data-reveal>
      <article class="info-panel"><span class="number">01 / THE STUDIO</span><h2>Independent studio</h2><p>MT Core Studio is my independent Android app-developer brand. Every app is designed, developed, published and maintained directly by me on Google Play.</p></article>
      <article class="info-panel"><span class="number">02 / ADVERTISING</span><h2>Advertising &amp; accounts</h2><p>Some affordably free apps may include advertising served through advertising platforms, in line with Google Play and advertising-platform policies. For legitimate business and organizational purposes I may use more than one advertising account; each account serves a clear purpose and follows the same policies.</p></article>
      <article class="info-panel"><span class="number">03 / VERIFICATION</span><h2>Verification &amp; documents</h2><p>Account verification and ownership documents are shared only with the relevant platform support teams through official channels. They are never published or recreated on this website. No badges, screenshots or certificates claiming verification are presented here.</p></article>
      <article class="info-panel"><span class="number">04 / PRIVACY</span><h2>Privacy practices</h2><p>Each app publishes a completed privacy policy before launch, explaining its actual data practices. See the <a class="text-link" href="privacy.html">privacy policy</a> for details.</p></article>
    </div>

    <div class="published-section" data-reveal>
      <div class="section-head"><div><span class="eyebrow">APP RECORDS</span><h2>Published apps</h2><p>Only apps marked <em>Published</em> with a configured official store URL appear below.</p></div></div>
      ${published.length
        ? `<div class="app-grid">${published
            .map(
              (app) => `<article class="app-card"><div class="app-card-top">${iconTile(app, 56)}<span class="category-pill">${escapeHTML(app.category)}</span></div><h3 class="app-card-title"><a href="${escapeHTML(cleanUrl(app.playStoreUrl))}" target="_blank" rel="noopener noreferrer">${escapeHTML(app.name)} <span aria-hidden="true">↗</span></a></h3><p class="app-card-desc">${escapeHTML(app.description)}</p><div class="app-card-bottom"><span class="status-pill status-live"><span class="status-dot" aria-hidden="true"></span>Published</span><a class="text-link" href="${escapeHTML(cleanUrl(app.playStoreUrl))}" target="_blank" rel="noopener noreferrer">Official listing <span aria-hidden="true">↗</span></a></div></article>`
            )
            .join("")}</div>`
        : `<div class="empty-state"><strong>No apps are currently confirmed as published.</strong>Update an app record with verified publication details before listing it here.</div>`}
    </div>

    <div class="notice"><strong>Public information only.</strong><br>Private advertising-account identifiers, login details, tax, payment and other sensitive publisher records do not belong in public website files. This static site has no private admin area.</div>
  </div></section>`;
}

/* ------------------------------- contact page ----------------------------- */

function contactPage() {
  const emailCta = siteConfig.email
    ? `<a class="button button-primary" href="mailto:${escapeHTML(siteConfig.email)}">Email ${escapeHTML(siteConfig.brandName)} <span aria-hidden="true">↗</span></a>`
    : `<p class="detail-note">A public support email will be added here soon. In the meantime, please check back shortly.</p>`;

  const links = [
    [siteConfig.playStoreUrl, "Google Play developer page", "External link to the Google Play developer page"],
    [siteConfig.githubUrl, "GitHub", "External link to my GitHub profile"],
    [siteConfig.youtubeUrl, "YouTube", "External link to my YouTube channel"],
    [siteConfig.facebookUrl, "Facebook", "External link to my Facebook page"],
    [siteConfig.xUrl, "X (Twitter)", "External link to my X (Twitter) profile"]
  ]
    .filter(([url]) => cleanUrl(url))
    .map(
      ([url, label, desc]) =>
        `<a class="button button-secondary" href="${escapeHTML(cleanUrl(url))}" target="_blank" rel="noopener noreferrer" aria-label="${desc}">${label} <span aria-hidden="true">↗</span></a>`
    )
    .join("");

  return `<section class="page-intro"><div class="wrap">
    <span class="eyebrow">CONTACT</span>
    <h1>Start with a clear note.</h1>
    <p>For questions about MT Core Studio or its apps, use a configured public channel below.</p>
  </div></section>
  <section class="content-section"><div class="wrap">
    <div class="callout" data-reveal><div class="callout-content">
      <span class="eyebrow">GET IN TOUCH</span>
      <h2>I’m listening.</h2>
      <p>Email and official profile links appear here once they are configured in the public site settings.</p>
      <div class="profile-links">${emailCta}${links}</div>
      <p class="contact-note">No contact form is used on this site — reach out through an official channel instead.</p>
    </div></div>
  </div></section>`;
}

/* ------------------------------ privacy page ------------------------------ */

function privacyPage() {
  return `<section class="page-intro"><div class="wrap">
    <span class="eyebrow">PRIVACY POLICY</span>
    <h1>Your data, handled with care.</h1>
    <p>This page documents MT Core Studio's approach to privacy — both for the studio website you are reading now and for the Android apps published under the brand. App-specific policies are completed and linked from each app before it goes live.</p>
  </div></section>
  <section class="content-section"><div class="wrap">
    <div class="notice"><strong>Working document:</strong> The sections below are being completed as each app's real data practices are confirmed. Nothing here claims a specific data practice until it matches the actual app or website behaviour.</div>
    <article class="detail-copy policy" style="max-width:780px;margin-top:34px">
      <section class="detail-block"><h2>Policy owner &amp; contact</h2><p>MT Core Studio is an independent Android app-development brand. Questions about this policy or any MT Core Studio app can be sent through the public <a class="text-link" href="contact.html">contact page</a>. The completed policy for each app names the app's publisher, effective date and a monitored contact address.</p></section>
      <section class="detail-block"><h2>Website visit statistics</h2><p>This website records anonymous visit statistics to understand which pages are useful and where visitors come from. For each site visit, the following is logged once: the page visited, the date, and an approximate country derived from the visitor's IP address. No IP addresses, names, email addresses or exact locations are stored, no cookies are used for this, and the data cannot be used to identify a person. The statistics are visible only in the studio's private admin area and are summarised, never published.</p></section>
      <section class="detail-block"><h2>Information and purposes</h2><p>Each app's policy lists every category of personal or device information the app handles, whether collected directly or by third parties, why it is used, and whether providing it is optional or required. The current MT Core Studio apps are designed not to require an account, and this section is completed per app before the app is listed.</p></section>
      <section class="detail-block"><h2>Sharing and service providers</h2><p>If an app uses third-party services such as advertising or analytics SDKs, they are identified here along with their roles and links to their current policies, before the app is published. The website itself does not embed third-party trackers.</p></section>
      <section class="detail-block"><h2>Retention, security and location</h2><p>Retention periods, security practices and any cross-border handling are described per app in accurate general terms. Website statistics are kept for a limited period for internal review and then removed.</p></section>
      <section class="detail-block"><h2>Choices, children and rights</h2><p>Controls available to users, how to request deletion or exercise data rights, applicable age information and jurisdiction-specific disclosures are added per app before launch.</p></section>
      <section class="detail-block"><h2>Changes &amp; app-specific details</h2><p>How policy updates are communicated and each policy's version history are noted per app. Where two apps differ in practice, they receive separate completed policies.</p></section>
    </article>
  </div></section>`;
}

/* --------------------------- updates & changelog page --------------------- */

function updatesPage() {
  const entries = changelog
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  if (!entries.length) {
    return `<section class="page-intro"><div class="wrap">
      <span class="eyebrow">UPDATES &amp; CHANGELOG</span>
      <h1>Release notes, kept clearly.</h1>
      <p>Every version of every MT Core Studio app, listed in one place. Entries appear here as releases are published (added to <code>data/changelog.js</code>).</p>
    </div></section>
    <section class="content-section"><div class="wrap">
      ${breadcrumbs([["Home", "index.html"], ["Updates", ""]])}
      <div class="empty-state"><strong>No releases listed yet.</strong>Notes will appear here with the first app release.</div>
    </div></section>`;
  }

  return `<section class="page-intro"><div class="wrap">
    <span class="eyebrow">UPDATES &amp; CHANGELOG</span>
    <h1>The changelog, across the studio.</h1>
    <p>Every version of every MT Core Studio app, newest first.</p>
  </div></section>
  <section class="content-section"><div class="wrap">
    ${breadcrumbs([["Home", "index.html"], ["Updates", ""]])}
    <div class="updates-list" data-reveal>${entries
      .map((entry) => {
        const app = apps.find((a) => a.id === entry.app);
        return `<article class="update-card">
        ${app ? `<div class="update-icon">${iconTile(app, 48)}</div>` : ""}
        <div class="update-copy">
          <span class="post-date">${escapeHTML(app ? app.name : entry.app || "MT Core Studio")}${entry.version ? ` · v${escapeHTML(entry.version)}` : ""}${entry.date ? ` · ${escapeHTML(entry.date)}` : ""}</span>
          <h2>${escapeHTML(app ? app.name : entry.app || "Update")}</h2>
          ${Array.isArray(entry.notes) && entry.notes.length ? `<ul class="changelog-list">${entry.notes.map((note) => `<li>${escapeHTML(note)}</li>`).join("")}</ul>` : ""}
        </div>
      </article>`;
      })
      .join("")}</div>
  </div></section>`;
}

/* ------------------------------ app privacy page -------------------------- */

function appPrivacyPage() {
  const id = new URLSearchParams(window.location.search).get("id");
  const app = apps.find((item) => item.id === id);

  if (!app) {
    document.title = "Privacy policy not found | MT Core Studio";
    return `<section class="page-intro"><div class="wrap">
      <span class="eyebrow">APP PRIVACY POLICY</span>
      <h1>Privacy policy not found.</h1>
      <p>That app record is not available. View the <a class="text-link" href="privacy.html">main privacy policy</a> instead.</p>
    </div></section>`;
  }

  document.title = `Privacy policy for ${app.name} | MT Core Studio`;
  const siteRoot = siteConfig.canonicalDomain.replace(/\/+$/, "");
  const policyUrl = `${siteRoot}/app-privacy.html?id=${encodeURIComponent(app.id)}`;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = policyUrl;
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", policyUrl);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", `Privacy policy for ${app.name}`);

  const policy = (appPolicies && typeof appPolicies === "object" && appPolicies[app.id]) || null;
  const policyHTML = policy ? String(policy.content || "").trim() : "";
  const policyReady = policyHTML !== "";
  const policyMeta = policyReady
    ? `<p class="policy-meta" style="margin-top:8px;font-size:13px;color:var(--muted)">Last updated <time>${escapeHTML(policy.updated || "")}</time> · ${policy.status === "completed" ? "Completed policy" : "Draft policy"}</p>`
    : "";
  const draftNotice = !policyReady || policy.status !== "completed"
    ? `<div class="notice"><strong>Policy in progress:</strong> This policy is finalised before the app is published. Nothing below claims a specific data practice until it matches the actual app.</div>`
    : `<div class="notice"><strong>Completed policy:</strong> This is the current policy linked from ${escapeHTML(app.name)} on Google Play.</div>`;
  const policyBody = policyReady
    ? sanitizePolicyHTML(policyHTML)
    : `<section class="detail-block"><h2>Policy owner &amp; contact</h2><p><strong>${escapeHTML(app.name)}</strong> is developed and published by MT Core Studio${siteConfig.country ? ` (${escapeHTML(siteConfig.country)})` : ""}. Privacy questions are handled through the public <a class="text-link" href="contact.html">contact page</a>. [The confirmed effective date and a monitored privacy email are added here before publication.]</p></section>
      <section class="detail-block"><h2>Information this app handles</h2><p>[A per-app list of every category of personal or device information the app collects, its purpose, and whether providing it is optional or required is completed here before publication.]</p></section>
      <section class="detail-block"><h2>Sharing &amp; service providers</h2><p>[Any SDKs, analytics, advertising or infrastructure providers and their roles are identified here, each linked to its current policy.]</p></section>
      <section class="detail-block"><h2>Storage, security &amp; retention</h2><p>[Retention periods, security practices and any cross-border handling are described here in accurate general terms.]</p></section>
      <section class="detail-block"><h2>Children, choices &amp; rights</h2><p>[Age requirements, the controls available to users, and how someone can exercise deletion or other data rights are described here.]</p></section>
      <section class="detail-block"><h2>Changes to this policy</h2><p>[How updates to this policy are communicated and its version history are noted here.]</p></section>`;

  return `<section class="page-intro"><div class="wrap">
    <span class="eyebrow">APP PRIVACY POLICY</span>
    <h1>${escapeHTML(app.name)} — privacy, plainly.</h1>
    <p>This page documents how <strong>${escapeHTML(app.name)}</strong> (${escapeHTML(app.packageName || "package to be confirmed")}) handles data. It is completed, reviewed and linked from the app before the app goes live.</p>
  </div></section>
  <section class="content-section"><div class="wrap">
    ${breadcrumbs([["Home", "index.html"], ["Privacy", "privacy.html"], [app.name, ""]])}
    ${draftNotice}
    ${policyMeta}
    <article class="detail-copy policy" style="max-width:780px;margin-top:34px">
      ${policyBody}
    </article>
    ${policyReady ? "" : `<p class="contact-note">This is the working policy template for <strong>${escapeHTML(app.name)}</strong>. The publishing checklist completes every section before the app is listed on Google Play.</p>`}
  </div></section>`;
}

/* -------------------------------- blog page ------------------------------- */

function blogPage() {
  if (!posts.length) {
    return `<section class="page-intro"><div class="wrap">
      <span class="eyebrow">NOTES FROM THE STUDIO</span>
      <h1>Ideas in progress.</h1>
      <p>News, product notes and practical thoughts from MT Core Studio — added by hand when there is something worth sharing.</p>
      <a class="text-link" href="./feed.xml">Subscribe via RSS <span aria-hidden="true">→</span></a>
    </div></section>
    <section class="content-section"><div class="wrap">
      <div class="empty-state"><strong>No posts yet.</strong>New writing will appear here as it is added to <code>data/posts.js</code>.</div>
    </div></section>`;
  }
  return `<section class="page-intro"><div class="wrap">
    <span class="eyebrow">NOTES FROM THE STUDIO</span>
    <h1>Ideas in progress.</h1>
    <p>News, product notes and practical thoughts from MT Core Studio.</p>
    <a class="text-link" href="./feed.xml">Subscribe via RSS <span aria-hidden="true">→</span></a>
  </div></section>
  <section class="content-section"><div class="wrap">
    <div class="post-list" data-reveal>${posts
      .map(
        (post) => `<article class="post-card">
        ${post.image ? `<img src="${escapeHTML(post.image)}" alt="${escapeHTML(post.imageAlt || post.title)}" loading="lazy">` : `<div class="post-date">${escapeHTML(post.date || "Date to be added")}</div>`}
        <div class="post-copy"><span class="post-date">${escapeHTML(post.category || "Studio note")}${post.image ? ` · ${escapeHTML(post.date || "Date to be added")}` : ""}</span><h2>${escapeHTML(post.title || "Untitled post")}</h2><p>${escapeHTML(post.description || "")}</p>${post.content ? `<div class="post-content">${String(post.content).split(/\n\s*\n/).map((para) => `<p>${escapeHTML(para)}</p>`).join("")}</div>` : ""}</div>
      </article>`
      )
      .join("")}</div>
  </div></section>`;
}

/* ------------------------------ interactive setup ------------------------- */

function setupTheme() {
  const button = document.getElementById("theme-toggle");
  const root = document.documentElement;

  let theme = "dark";
  try {
    theme = localStorage.getItem("mt-core-studio-theme") || "dark";
  } catch {
    /* storage may be disabled */
  }
  if (theme !== "light") theme = "dark";
  root.dataset.theme = theme;
  document.body.dataset.theme = theme;

  const sunIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.7" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const moonIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.3 15.2A8.4 8.4 0 0 1 8.8 3.7 8.5 8.5 0 1 0 20.3 15.2Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`;

  const applyThemeColor = () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "light" ? "#f4f7fb" : "#060910";
  };

  const update = () => {
    const isDark = root.dataset.theme !== "light";
    button.dataset.theme = root.dataset.theme;
    button.setAttribute("role", "switch");
    button.setAttribute("aria-checked", String(!isDark));
    button.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
    button.innerHTML = `<span class="theme-toggle-thumb" aria-hidden="true"></span>
      <span class="theme-toggle-icon" data-icon="sun" aria-hidden="true">${sunIcon}</span>
      <span class="theme-toggle-icon" data-icon="moon" aria-hidden="true">${moonIcon}</span>`;
    applyThemeColor();
  };

  update();
  button.addEventListener("click", () => {
    theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    document.body.dataset.theme = theme;
    try {
      localStorage.setItem("mt-core-studio-theme", theme);
    } catch {
      /* preference remains for this page view */
    }
    update();
  });
}

function setupNavigation() {
  const button = document.getElementById("menu-toggle");
  const nav = document.getElementById("primary-navigation");

  const close = () => {
    nav.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation menu");
  };

  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    nav.classList.toggle("is-open", open);
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      close();
      button.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) close();
  });
}

function setupDirectory() {
  if (pageName !== "apps") return;
  const input = document.getElementById("app-search");
  const buttons = [...document.querySelectorAll("[data-filter]")];
  const grid = document.getElementById("apps-grid");
  const empty = document.getElementById("apps-empty");
  const count = document.getElementById("result-count");
  let filter = "All";

  const draw = () => {
    const query = input.value.trim().toLowerCase();
    const visible = apps.filter(
      (app) =>
        (filter === "All" || app.category === filter) &&
        `${app.name} ${app.category} ${app.description || ""}`.toLowerCase().includes(query)
    );
    grid.innerHTML = visible.map(appCard).join("");
    empty.hidden = visible.length > 0;
    count.textContent = `${visible.length} ${visible.length === 1 ? "app" : "apps"} shown`;
  };

  buttons.forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      buttons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
        if (item === button) item.setAttribute("aria-current", "true");
        else item.removeAttribute("aria-current");
      });
      draw();
    })
  );

  input.addEventListener("input", draw);
  draw();
}

/* --------------- waitlist forms & progressive web app support -------------- */

function setupWaitlist() {
  if (!document.querySelector(".waitlist-form")) return;
  document.addEventListener("submit", async (event) => {
    const form = event.target.closest(".waitlist-form");
    if (!form) return;
    event.preventDefault();

    const statusEl = form.querySelector(".waitlist-status");
    const emailEl = form.querySelector('input[type="email"]');
    const email = (emailEl?.value || "").trim();
    const app = form.dataset.app || "";
    const consent = form.querySelector('input[type="checkbox"]')?.checked ? "1" : "";

    if (!email || !app) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      statusEl.textContent = "Please enter a valid email address.";
      statusEl.className = "waitlist-status err";
      return;
    }

    statusEl.textContent = "Sending…";
    statusEl.className = "waitlist-status";

    const body = new FormData();
    body.append("action", "subscribe");
    body.append("app", app);
    body.append("email", email);
    body.append("consent", consent);

    try {
      const res = await fetch("api/waitlist.php", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        statusEl.textContent = "Thanks! I'll email you once this app launches on Google Play.";
        statusEl.className = "waitlist-status ok";
        emailEl.value = "";
        form.querySelector('input[type="checkbox"]').checked = false;
      } else {
        statusEl.textContent = json.error || "Could not subscribe right now. Please try again later.";
        statusEl.className = "waitlist-status err";
      }
    } catch {
      statusEl.textContent = "The waitlist needs the live PHP host — it activates once the site is published.";
      statusEl.className = "waitlist-status err";
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* --------------- scroll reveal + scrolled header state -------------------- */

function prefersReducedMotion() {
  return (
    window.matchMedia &&
    typeof window.matchMedia("(prefers-reduced-motion: reduce)").matches === "boolean" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function setupScrollReveal() {
  if (prefersReducedMotion()) return;
  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js-anim");
  const nodes = [...document.querySelectorAll("[data-reveal]")];
  if (!nodes.length) return;
  const observe = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observe.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
  );
  nodes.forEach((node) => observe.observe(node));
}

function setupHeaderState() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/* --------------- anonymous visit beacon (for the admin console) ------------ */

function trackVisit() {
  try {
    const path = window.location.pathname + window.location.search;
    if (!path.startsWith("/")) return;
    if (navigator.onLine === false) return; // offline PWA pages do not count
    if (navigator.sendBeacon) {
      const body = new FormData();
      body.append("page", path);
      // Best-effort country, obtained via a privacy-friendly client lookup.
      browserCountryCode().then((country) => {
        if (country) body.append("country", country);
        try { navigator.sendBeacon("api/visit.php", body); } catch (e) { /* noop */ }
      });
    }
  } catch (e) { /* tracking is optional - never block the page */ }
}

function browserCountryCode() {
  try {
    const cached = sessionStorage.getItem("mt-country");
    if (cached) return Promise.resolve(cached);
  } catch (e) { /* storage unavailable */ }
  if (!window.fetch) return Promise.resolve("");
  const fallback = (value) => {
    const code = /^[A-Za-z]{2}$/.test(value || "") ? String(value).toUpperCase() : "";
    try { if (code) sessionStorage.setItem("mt-country", code); } catch (e) { /* noop */ }
    return code;
  };
  // ipwho.is returns the visitor's own country without any key. If it is
  // unreachable the visit is still counted, just without a country code.
  return Promise.race([
    fetch("https://ipwho.is/", { method: "GET" }).then((res) => (res.ok ? res.json() : null)),
    new Promise((resolve) => setTimeout(() => resolve(null), 2200))
  ])
    .then((data) => fallback(data && data.country_code))
    .catch(() => fallback(""));
}

/* ------------------------------ live visual effects ------------------------ */

function setupHeroCanvas() {
  const canvas = document.querySelector(".hero-canvas");
  if (!canvas) return;
  if (prefersReducedMotion()) return;
  if (!canvas.getContext) return;
  // Desktop only: touch devices use reduced effects.
  if (window.matchMedia && !window.matchMedia("(hover: hover)").matches) return;
  const reducing = () => prefersReducedMotion();
  const isMobile = window.innerWidth < 768;
  const ctx = canvas.getContext("2d");
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let particles = [];
  let w = 0;
  let h = 0;

  const resize = () => {
    const hero = canvas.closest(".hero");
    w = hero ? hero.getBoundingClientRect().width : window.innerWidth;
    h = hero ? hero.getBoundingClientRect().height : 420;
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const count = isMobile ? 16 : 42;
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      a: 0.12 + Math.random() * 0.3
    }));
  };

  const draw = () => {
    if (reducing()) return;
    ctx.clearRect(0, 0, w, h);
    // connecting lines
    ctx.strokeStyle = "rgba(56, 220, 255, 0.14)";
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) {
          ctx.globalAlpha = 0.5 * (1 - Math.sqrt(d2) / 120);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    // particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -8) p.x = w + 8;
      if (p.x > w + 8) p.x = -8;
      if (p.y < -8) p.y = h + 8;
      if (p.y > h + 8) p.y = -8;
      ctx.globalAlpha = p.a;
      ctx.fillStyle = "rgba(120, 190, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });
  requestAnimationFrame(draw);
}

function setupMouseGlow() {
  const hero = document.querySelector(".studio-hero");
  if (!hero || prefersReducedMotion()) return;
  if (window.matchMedia && !window.matchMedia("(hover: hover)").matches) return;
  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    hero.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
    hero.classList.add("has-pointer");
  }, { passive: true });
  hero.addEventListener("pointerleave", () => hero.classList.remove("has-pointer"), { passive: true });
}

function setupLiveEffects() {
  setupMouseGlow();
}

function termsPage() {
  return `<section class="page-intro legal-intro"><div class="wrap">
    <span class="eyebrow">TERMS</span><h1>Terms of use</h1>
    <p>App-specific terms are not published yet. This page will link to each product’s terms when they are ready.</p>
  </div></section>
  <section class="content-section"><div class="wrap legal-layout">
    <article class="legal-card"><span class="eyebrow">CURRENT STATUS</span><h2>Terms are being prepared</h2>
      <p>The MT Core Studio app collection is still in development. No app-specific terms have been supplied for publication, so this page does not present draft terms as final.</p>
      <p>Before an app is published, its applicable terms will be linked from its details page and store listing.</p>
      <p>For questions about the studio or its apps, visit the <a class="text-link" href="contact.html">contact page</a>.</p>
    </article>
    <aside class="legal-aside"><h2>Explore the collection</h2><p>See current app details and their published status.</p><a class="button button-primary" href="apps.html">Browse apps <span aria-hidden="true">↗</span></a></aside>
  </div></section>`;
}

function notFoundPage() {
  document.title = "Page not found | MT Core Studio";
  document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex, follow");
  return `<section class="not-found-page"><div class="wrap not-found-inner">
    <span class="eyebrow">404 / PAGE NOT FOUND</span><p class="not-found-code" aria-hidden="true">404</p>
    <h1>This page isn’t in the studio.</h1><p>The address may have changed, or the page may not exist. Find your way back to the current app collection.</p>
    <div class="hero-actions"><a class="button button-primary" href="/index.html">Back to home <span aria-hidden="true">↗</span></a><a class="button button-quiet" href="/apps.html">Explore apps <span aria-hidden="true">→</span></a></div>
  </div></section>`;
}

/* ---------------------------------- boot ---------------------------------- */

const renderers = {
  home: homePage,
  apps: appsPage,
  app: detailPage,
  about: aboutPage,
  developer: developerPage,
  publisher: publisherPage,
  contact: contactPage,
  privacy: privacyPage,
  terms: termsPage,
  "404": notFoundPage,
  blog: blogPage,
  updates: updatesPage,
  "app-privacy": appPrivacyPage
};

document.getElementById("site-header").innerHTML = header();
document.getElementById("main-content").innerHTML = (renderers[pageName] || homePage)();
document.getElementById("site-footer").innerHTML = footer();
setupTheme();
setupNavigation();
setupDirectory();
setupWaitlist();
setupScrollReveal();
setupHeaderState();
setupLiveEffects();
registerServiceWorker();
trackVisit();
