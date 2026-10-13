<?php
require __DIR__ . '/config.php';
mt_session_start();
mt_security_headers();

$loggedIn = mt_is_logged_in();
$firstRun = mt_first_run();
$csrf = mt_csrf();
$host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
$me = $loggedIn ? mt_current_user() : null;
$role = $me ? (string) ($me['role'] ?? 'viewer') : '';
$meName = $me ? (string) ($me['name'] ?? '') : '';
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>MT Core Studio - Admin</title>
<link rel="icon" type="image/svg+xml" href="../assets/images/favicon.svg">
<link rel="stylesheet" href="admin.css">
</head>
<body class="<?php echo trim(($loggedIn ? 'is-auth' : 'is-login') . ($loggedIn ? ' mt-' . htmlspecialchars($role, ENT_QUOTES, 'UTF-8') : '')); ?>">

<div class="page">

<?php if (!$loggedIn): ?>

  <section class="card login-card">
    <div class="card-head">
      <img src="../assets/images/mt-core-studio-logo.png" alt="MT Core Studio logo" width="72" height="48">
      <div>
        <h1>MT Core Studio <span>Admin</span></h1>
        <p><?php echo $firstRun ? 'Create the owner account to secure this console.' : 'Sign in to manage the website.'; ?></p>
      </div>
    </div>

    <?php if ($firstRun): ?>
      <p class="notice">First run: create the owner account. The password is stored only as a secure hash and is never displayed again. More team members with limited roles can be added afterwards.</p>
      <label>Your name <span class="muted">(optional)</span>
        <input type="text" id="name" autocomplete="name">
      </label>
      <label>Username
        <input type="text" id="username" autocomplete="username" placeholder="owner" minlength="3" maxlength="24" required>
      </label>
      <label>Email address <span class="muted">(optional — can be used to sign in)</span>
        <input type="email" id="email" autocomplete="email" placeholder="you@example.com">
      </label>
      <label>Password
        <input type="password" id="pw1" autocomplete="new-password" minlength="8" required>
      </label>
      <label>Repeat password
        <input type="password" id="pw2" autocomplete="new-password" minlength="8" required>
      </label>
      <button type="button" class="btn" id="btn-create">Create owner &amp; enter</button>
    <?php else: ?>
      <label>Username or email address
        <input type="text" id="username" autocomplete="username" placeholder="owner or you@example.com" required>
      </label>
      <label>Password
        <input type="password" id="pw1" autocomplete="current-password" required>
      </label>
      <button type="button" class="btn" id="btn-login">Sign in</button>
    <?php endif; ?>

    <p class="status" id="login-status" role="status"></p>
  </section>

<?php else: ?>

  <header class="topbar">
    <div class="topbar-brand">
      <img src="../assets/images/mt-core-studio-logo.png" alt="" width="60" height="40">
      <strong>MT Core Studio - Admin</strong>
    </div>
    <div class="topbar-actions">
      <button class="btn btn-ghost nav-toggle" type="button" id="nav-toggle" aria-label="Toggle menu">☰ Menu</button>
      <span class="user-chip" title="Signed in as <?php echo htmlspecialchars($meName, ENT_QUOTES, 'UTF-8'); ?>">
        <?php if ($meName !== ''): ?><span class="user-chip-name"><?php echo htmlspecialchars($meName, ENT_QUOTES, 'UTF-8'); ?></span><?php endif; ?>
        <span class="pill pill-<?php echo htmlspecialchars($role, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars($role, ENT_QUOTES, 'UTF-8'); ?></span>
      </span>
      <button class="btn btn-ghost" type="button" id="btn-change-pw">Change password</button>
      <a class="btn btn-ghost" href="../index.html" target="_blank" rel="noopener">View site ^</a>
      <button class="btn btn-ghost" type="button" id="btn-logout">Sign out</button>
    </div>
  </header>
  <div class="shell">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-head">
      <img src="../assets/images/mt-core-studio-logo.png" alt="" width="44" height="28">
      <div><strong>MT Core Studio</strong><span>Admin console</span></div>
    </div>
    <nav id="sidebar-nav" aria-label="Console sections">
      <div class="nav-group"><span class="nav-title">Dashboard</span>
        <a href="#" data-nav="dashboard" class="nav-link" title="Overview"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg><span>Overview</span></a>
      </div>
      <div class="nav-group"><span class="nav-title">Apps</span>
        <a href="#" data-nav="apps" class="nav-link" title="All Apps"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg><span>All Apps</span></a>
        <a href="#" data-nav="app-edit" class="nav-link" title="Add App"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg><span>Add App</span></a>
        <a href="#" data-nav="categories" class="nav-link" title="Categories"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12.5V4.5A1.5 1.5 0 0 1 4.5 3h8L21 11.5 12.5 20 3 12.5z"/><circle cx="7.8" cy="7.8" r="1.4"/></svg><span>Categories</span></a>
      </div>
      <div class="nav-group"><span class="nav-title">Analytics</span>
        <a href="#" data-nav="analytics" class="nav-link" title="Overview"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M6 17v-5M11 17V7M16 17v-8M21 17v-3"/></svg><span>Overview</span></a>
        <a href="#" data-nav="visitors" class="nav-link" title="Visitors"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg><span>Visitors</span></a>
        <a href="#" data-nav="ip-analysis" class="nav-link" title="IP Analysis"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3 7 21M17 3l-2 21M4 8.5h16M3.5 15.5h16"/></svg><span>IP Analysis</span></a>
        <a href="#" data-nav="pages" class="nav-link" title="Most Visited Pages"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4z"/><path d="M14 3v4h4M9 13h6M9 17h5"/></svg><span>Most Visited Pages</span></a>
      </div>
      <div class="nav-group"><span class="nav-title">Content</span>
        <a href="#" data-nav="readiness" class="nav-link" title="Website Overview"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5a3 3 0 0 1 6 0M9.2 13.2l2 2 3.6-3.8"/></svg><span>Website Overview</span></a>
        <a href="#" data-nav="policies" class="nav-link" title="Legal Policies"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8.2-8 9-4.5-.8-8-4-8-9V6l8-3z"/><path d="m9 12 2 2 4-4.5"/></svg><span>Legal Policies</span></a>
        <a href="#" data-nav="waitlist" class="nav-link" title="Waitlist"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg><span>Waitlist</span></a>
        <a href="#" data-nav="ads" class="nav-link" title="AdMob &amp; app-ads.txt"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10v4h3.5L13 18V6l-6.5 4H3zM16.5 9a4.5 4.5 0 0 1 0 6"/></svg><span>AdMob &amp; app-ads.txt</span></a>
        <a href="#" data-nav="verification" class="nav-link" title="Play Verification"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.3 12.2 2.5 2.5 4.9-5.4"/></svg><span>Play Verification</span></a>
      </div>
      <div class="nav-group"><span class="nav-title">Settings</span>
        <a href="#" data-nav="settings" class="nav-link" title="General"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h9M17.5 7H20M4 17h3.5M12 17h8"/><circle cx="15" cy="7" r="2.2"/><circle cx="9.5" cy="17" r="2.2"/></svg><span>General</span></a>
        <?php if ($role === 'owner'): ?>
        <a href="#" data-nav="users" class="nav-link" title="Admin Users"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5a3.5 3.5 0 0 1 0 7M17.5 14.7c2 .8 3.5 2.6 3.5 5.3"/></svg><span>Admin Users</span></a>
        <?php endif; ?>
        <a href="#" data-nav="activity" class="nav-link" title="Activity Log"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3.6 6h.01M3.6 12h.01M3.6 18h.01"/></svg><span>Activity Log</span></a>
      </div>
    </nav>
    <div class="sidebar-foot">
      <a href="../index.html" target="_blank" rel="noopener" class="side-foot-link"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9S14.6 18.3 12 21c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z"/></svg><span>Open website ↗</span></a>
      <button class="btn btn-ghost side-logout" type="button" id="btn-logout-side"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 12H3.5M7.5 8l-4 4 4 4M13 4.5h5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-5"/></svg><span>Logout</span></button>
    </div>
  </aside>
  <div class="nav-scrim" id="nav-scrim" hidden></div>
  <main class="content">

    <section class="card" data-view="dashboard">
      <div class="card-head">
        <div><h2>Dashboard</h2><p>Live numbers from your app directory, visit log and activity trail — real data only, never estimated.</p></div>
        <button class="btn btn-sm" type="button" id="btn-dash-refresh">Refresh</button>
      </div>
      <div id="dash-stats" class="stat-grid" aria-live="polite"></div>
      <div class="grid-2" style="margin-top:18px">
        <div>
          <h3 class="sub-h">Recent activity</h3>
          <div id="dash-activity" class="audit-list" aria-live="polite"></div>
        </div>
        <div>
          <h3 class="sub-h">Quick actions</h3>
          <div class="quick-actions">
            <button class="btn" type="button" data-quick="new-app">+ Add app</button>
            <button class="btn" type="button" data-quick="policies">Legal policies</button>
            <button class="btn" type="button" data-quick="analytics">View analytics</button>
            <button class="btn" type="button" data-quick="settings">Site settings</button>
          </div>
          <p class="status muted" id="dash-status" role="status"></p>
        </div>
      </div>
    </section>

    <section class="card" data-view="apps">
      <div class="card-head">
        <div><h2>Apps</h2><p>Add, edit or remove apps. Changes go live immediately on the public website.</p></div>
        <button class="btn" type="button" id="btn-new-app">+ New app</button>
      </div>
      <div id="apps-list" class="apps-list" aria-live="polite"></div>
      <p class="status muted" id="apps-status"></p>
    </section>

    <section class="card" data-view="categories">
      <div class="card-head">
        <div><h2>Categories</h2><p>Every app grouped by its Category field. New categories appear automatically — click an app to edit it.</p></div>
      </div>
      <div id="categories-list" aria-live="polite"></div>
    </section>

    <section class="card" data-view="waitlist">
      <div class="card-head">
        <div><h2>Waitlist</h2><p>Emails captured from the "Notify me" forms on app pages. Export to CSV to import into your mail tool.</p></div>
        <div class="row">
          <button class="btn" type="button" id="btn-waitlist-export">Export CSV</button>
          <button class="btn btn-danger" type="button" id="btn-waitlist-clear">Clear all</button>
        </div>
      </div>
      <div id="waitlist-list" class="waitlist-list" aria-live="polite"></div>
      <p class="status muted" id="waitlist-status"></p>
    </section>

    <section class="card" data-view="visitors">
      <div class="card-head">
        <div><h2>Visitors</h2><p>Traffic from the visit beacon: page views over time, country breakdown, top pages, and new vs returning visitors (IPs are stored only as salted hashes — never the raw address). Log auto-trims after 120 days.</p></div>
        <div class="row">
          <button class="btn" type="button" id="btn-visits-export">Export CSV</button>
          <button class="btn btn-danger hide-for-editor" type="button" id="btn-visits-clear">Clear all</button>
        </div>
      </div>
      <div id="visits-stats" class="visits-stats" aria-live="polite"></div>
      <p class="status muted" id="visits-status"></p>
    </section>

    <section class="card" data-view="analytics">
      <div class="card-head">
        <div><h2>Analytics overview</h2><p>Real traffic from the anonymous visit beacon — IPs are stored only as salted hashes and never leave this console.</p></div>
        <div class="row range-group" data-range-for="analytics" role="group" aria-label="Date range">
          <button class="btn btn-sm range-btn" type="button" data-range="today">Today</button>
          <button class="btn btn-sm range-btn" type="button" data-range="7">7 Days</button>
          <button class="btn btn-sm range-btn active" type="button" data-range="30">30 Days</button>
          <button class="btn btn-sm range-btn" type="button" data-range="all">All Time</button>
        </div>
      </div>
      <div id="an-stats" class="stat-grid" aria-live="polite"></div>
      <div class="grid-2" style="margin-top:18px">
        <div>
          <h3 class="sub-h">Daily visits</h3>
          <div class="chart-box" id="an-trend"></div>
        </div>
        <div>
          <h3 class="sub-h">New vs returning visitors</h3>
          <div class="chart-box" id="an-mix"></div>
        </div>
      </div>
      <div class="grid-2" style="margin-top:18px">
        <div>
          <h3 class="sub-h">Top pages</h3>
          <div id="an-pages" class="page-list"></div>
        </div>
        <div>
          <h3 class="sub-h">Top countries</h3>
          <div id="an-countries" class="country-list"></div>
        </div>
      </div>
      <p class="status muted" id="an-status" role="status"></p>
    </section>

    <section class="card" data-view="ip-analysis">
      <div class="card-head">
        <div><h2>IP analysis</h2><p>Visits grouped per anonymised visitor. “New address” never appeared in your log before this range; “Same address” was seen before or repeated. Raw IPs are never stored or shown.</p></div>
        <div class="row range-group" data-range-for="ips" role="group" aria-label="Date range">
          <button class="btn btn-sm range-btn" type="button" data-range="today">Today</button>
          <button class="btn btn-sm range-btn" type="button" data-range="7">7 Days</button>
          <button class="btn btn-sm range-btn active" type="button" data-range="30">30 Days</button>
          <button class="btn btn-sm range-btn" type="button" data-range="all">All Time</button>
        </div>
      </div>
      <div id="ip-summary" class="stat-grid" aria-live="polite"></div>
      <div class="row ip-toolbar">
        <input type="search" id="ip-search" placeholder="Search by visitor id, e.g. a1b2c3d4e5f6">
        <span class="muted" id="ip-count"></span>
      </div>
      <div id="ip-table" aria-live="polite"></div>
      <div class="row pager" id="ip-pager"></div>
      <p class="status muted" id="ip-status" role="status"></p>
    </section>

    <section class="card" data-view="pages">
      <div class="card-head">
        <div><h2>Most visited pages</h2><p>Sorted by views from the visit beacon. Click a column header to re-sort; all numbers are exact counts from the log.</p></div>
        <div class="row range-group" data-range-for="pages" role="group" aria-label="Date range">
          <button class="btn btn-sm range-btn" type="button" data-range="today">Today</button>
          <button class="btn btn-sm range-btn" type="button" data-range="7">7 Days</button>
          <button class="btn btn-sm range-btn active" type="button" data-range="30">30 Days</button>
          <button class="btn btn-sm range-btn" type="button" data-range="all">All Time</button>
        </div>
      </div>
      <div class="row ip-toolbar">
        <input type="search" id="pages-search" placeholder="Search pages, e.g. /apps">
        <span class="muted" id="pages-count"></span>
      </div>
      <div id="pages-table" aria-live="polite"></div>
      <p class="status muted" id="pages-status" role="status"></p>
    </section>

    <section class="card" id="editor" data-view="app-edit">
      <div class="card-head">
        <div><h2 id="editor-title">Add a new app</h2>
        <p>Tip: paste a Google Play link below to auto-fill most fields.</p></div>
        <button class="btn btn-ghost" type="button" id="btn-cancel">Cancel</button>
      </div>

      <div class="import-panel">
        <label for="import-url">Google Play link or package ID <span class="muted">(e.g. com.example.app)</span></label>
        <div class="row">
          <input type="text" id="import-url" placeholder="https://play.google.com/store/apps/details?id=com.example.app">
          <button class="btn" type="button" id="btn-import">Fetch details</button>
        </div>
        <p class="status" id="import-status" role="status"></p>
      </div>

      <form id="app-form" autocomplete="off">
        <input type="hidden" id="f-original-id">
        <div class="grid">
          <label>App name *
            <input type="text" id="f-name" required>
          </label>
          <label>Category
            <input type="text" id="f-category" list="category-list" placeholder="Lifestyle">
            <datalist id="category-list">
              <option value="Productivity"></option>
              <option value="Education"></option>
              <option value="Lifestyle"></option>
              <option value="Entertainment"></option>
              <option value="Tools"></option>
              <option value="Other"></option>
            </datalist>
          </label>
          <label>Status
            <select id="f-status">
              <option>Status to be confirmed</option>
              <option>In development</option>
              <option>Published</option>
            </select>
          </label>
          <label>App ID / slug <span class="muted">(URL: app.html?id=...)</span>
            <input type="text" id="f-id" placeholder="auto-from-name">
          </label>
          <label>Package name
            <input type="text" id="f-package" placeholder="com.mtcorestudio.example">
          </label>
          <label>Google Play URL
            <input type="url" id="f-play-url" placeholder="https://play.google.com/store/apps/details?id=...">
          </label>
          <div class="field-block" style="grid-column: 1 / -1;">
            <label for="f-policy-source">Legal / Policy Source URL <span class="muted">(one page that links to BOTH policies — the two URLs below are detected from it on save)</span></label>
            <div class="row">
              <input type="url" id="f-policy-source" placeholder="https://mtcorestudio.github.io/daily-spark-privacy/" style="flex: 1; min-width: 240px;">
              <button class="btn btn-sm" type="button" id="btn-detect-legal">Detect links</button>
            </div>
            <p class="status" id="legal-status" role="status"></p>
          </div>
          <label>Privacy policy URL
            <input type="url" id="f-privacy-url" placeholder="https://.../privacy-policy">
          </label>
          <label>Terms of Service URL
            <input type="url" id="f-terms-url" placeholder="https://.../terms-of-service">
          </label>
          <label>Icon path <span class="muted">(optional)</span>
            <input type="text" id="f-icon" placeholder="assets/apps/example.png">
          </label>
        </div>
        <label>Short description
          <textarea id="f-description" rows="3" maxlength="2000"></textarea>
        </label>
        <label>Features <span class="muted">(one per line)</span>
          <textarea id="f-features" rows="5"></textarea>
        </label>
        <label>Screenshot URLs <span class="muted">(one per line, optional)</span>
          <textarea id="f-screenshots" rows="3"></textarea>
        </label>
        <div class="row">
          <button class="btn btn-primary" type="submit" id="btn-save">Save app</button>
          <span class="status" id="save-status" role="status"></span>
        </div>
      </form>
    </section>
    <section class="card" data-view="settings">
      <div class="card-head">
        <div><h2>Site settings</h2><p>Public contact channels and developer profile details shown on the website.</p></div>
      </div>
      <form id="settings-form" autocomplete="off">
        <div class="grid">
          <label>Support email
            <input type="email" id="s-email" placeholder="support@mtcorestudio.com">
          </label>
          <label>Google Play developer page
            <input type="url" id="s-play" placeholder="https://play.google.com/store/apps/dev?id=...">
          </label>
          <label>GitHub
            <input type="url" id="s-github" placeholder="https://github.com/...">
          </label>
          <label>YouTube
            <input type="url" id="s-youtube" placeholder="https://youtube.com/...">
          </label>
          <label>Facebook
            <input type="url" id="s-facebook" placeholder="https://facebook.com/...">
          </label>
          <label>X (Twitter)
            <input type="url" id="s-x" placeholder="https://x.com/...">
          </label>
          <label>Developer name
            <input type="text" id="s-devname" placeholder="Your name or studio name">
          </label>
          <label>Country
            <input type="text" id="s-country" placeholder="Region">
          </label>
        </div>
        <div class="row">
          <button class="btn btn-primary" type="submit">Save settings</button>
          <span class="status" id="settings-status" role="status"></span>
        </div>
      </form>
    </section>

    <section class="card" data-view="ads">
      <div class="card-head">
        <div><h2>AdMob &amp; app-ads.txt</h2><p>AdMob verifies you as an authorized seller of your app inventory through this file at the site root. Enter each AdMob publisher ID below, then check AdMob → Apps → app-ads.txt after 24 hours.</p></div>
      </div>
      <div class="sub-panel">
        <h3>Add an AdMob publisher line</h3>
        <form id="ads-add-form" autocomplete="off">
          <div class="grid">
            <label>Developer website domain
              <input type="text" id="ads-domain" placeholder="mtcorestudio.com">
            </label>
            <label>AdMob publisher ID
              <input type="text" id="ads-pub" placeholder="pub-1234567890123456">
            </label>
          </div>
          <div class="grid">
            <label>Relationship
              <select id="ads-rel">
                <option value="DIRECT">DIRECT — you sell your own inventory</option>
                <option value="RESELLER">RESELLER</option>
              </select>
            </label>
            <label>Reseller token <span class="muted">(auto-filled for DIRECT)</span>
              <input type="text" id="ads-token" placeholder="f08c47fec0942fa0">
            </label>
          </div>
          <div class="row">
            <button class="btn btn-primary" type="submit" id="btn-ads-add">Add line</button>
            <span class="status" id="ads-helper-status"></span>
          </div>
        </form>
      </div>
      <p class="muted">Or edit the file directly — one advertising line per row, for example: <code>google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0</code><br>
      Public URL: <code>https://<?php echo htmlspecialchars($host, ENT_QUOTES, 'UTF-8'); ?>/app-ads.txt</code></p>
      <form id="ads-form">
        <label class="sr-only" for="ads-lines">app-ads.txt lines</label>
        <textarea id="ads-lines" rows="5" placeholder="google.com, pub-..., DIRECT, f08c47fec0942fa0"></textarea>
        <div class="row">
          <button class="btn btn-primary" type="submit">Save app-ads.txt</button>
          <span class="status" id="ads-status" role="status"></span>
        </div>
      </form>
    </section>

    <section class="card" data-view="policies">
      <div class="card-head">
        <div><h2>Privacy policies <span class="muted">(Play Store)</span></h2><p>Google Play requires every app to have a public privacy-policy URL. Write each policy here — it is published at <code>app-privacy.html?id=&lt;app&gt;</code> and ready to paste into the Play Console.</p></div>
      </div>
      <div id="policies-list" class="policy-list" aria-live="polite"></div>
      <p class="status muted" id="policies-status"></p>
    </section>

    <section class="card" id="policy-editor" data-view="policy-edit">
      <div class="card-head">
        <div><h2 id="policy-editor-title">Edit privacy policy</h2><p>Simple HTML is fine — <code>&lt;h2&gt;</code> for section headings and <code>&lt;p&gt;</code> for paragraphs (the default template matches the site’s policy styling).</p></div>
      </div>
      <form id="policy-form" autocomplete="off">
        <div class="grid">
          <label>App
            <select id="pol-app"></select>
          </label>
          <label>Status
            <select id="pol-status">
              <option value="draft">Draft — still working on it</option>
              <option value="completed">Completed — ready for Play Store review</option>
            </select>
          </label>
        </div>
        <label>Play Store privacy policy URL <span class="muted">(after saving, paste this link into the Play Console → App content → Privacy policy)</span>
          <div class="url-copy">
            <input type="text" id="pol-url" readonly value="">
            <button class="btn btn-sm" type="button" id="btn-pol-copy-url">Copy URL</button>
            <button class="btn btn-sm" type="button" id="btn-pol-open-url">Open ↗</button>
          </div>
        </label>
        <label>Policy HTML <span class="muted">· last updated: <span id="pol-updated">—</span></span>
          <textarea id="pol-content" rows="12" spellcheck="true"></textarea>
        </label>
        <div class="row">
          <button class="btn btn-ghost" type="button" id="btn-pol-fill">Fill with default template</button>
          <button class="btn btn-primary" type="submit" id="btn-pol-save">Save policy</button>
          <button class="btn btn-danger" type="button" id="btn-pol-remove">Remove saved policy</button>
          <button class="btn" type="button" id="btn-pol-close">Close editor</button>
          <span class="status" id="pol-status-msg" role="status"></span>
        </div>
      </form>
    </section>

    <section class="card" data-view="verification">
      <div class="card-head">
        <div><h2>Google Play site verification</h2><p>When the Play Console asks you to verify that you own a website, Google provides a file name like <code>google1a2b3c.html</code> with exact content. Add it here to host it instantly at the site root.</p></div>
      </div>
      <div id="verification-list" class="file-list" aria-live="polite"></div>
      <p class="status muted" id="verification-status"></p>
      <form id="verification-form" autocomplete="off">
        <label>File name
          <input type="text" id="vf-name" placeholder="google1a2b3c.html">
        </label>
        <label>File content <span class="muted">(paste exactly what Google shows, e.g. <code>google-site-verification: google1a2b3c.html</code>)</span>
          <textarea id="vf-content" rows="3" placeholder="google-site-verification: google1a2b3c.html"></textarea>
        </label>
        <div class="row">
          <button class="btn btn-primary" type="submit" id="btn-vf-save">Add / update file</button>
          <span class="status" id="vf-status" role="status"></span>
        </div>
      </form>
    </section>

    <section class="card" data-view="readiness">
      <div class="card-head">
        <div><h2>Website Overview</h2><p>Launch readiness — everything Google Play and AdMob reviewers look at, checked live against the data you have entered.</p></div>
      </div>
      <div id="checklist-list" class="checklist" aria-live="polite"></div>
      <p class="status muted" id="checklist-status"></p>
    </section>

    <section class="card" id="pw-card" data-view="pass">
      <div class="card-head">
        <div><h2>Change your password</h2><p>You will stay signed in everywhere after the change. The password is stored only as a secure hash.</p></div>
      </div>
      <form id="pw-form" autocomplete="off">
        <div class="grid">
          <label>Current password
            <input type="password" id="pw-current" autocomplete="current-password" required>
          </label>
          <label>New password <span class="muted">(min. 8 characters)</span>
            <input type="password" id="pw-new" autocomplete="new-password" minlength="8" required>
          </label>
        </div>
        <label>Repeat new password
          <input type="password" id="pw-new2" autocomplete="new-password" minlength="8" required>
        </label>
        <div class="row">
          <button class="btn btn-primary" type="submit">Update password</button>
          <button class="btn" type="button" id="btn-pw-cancel">Close</button>
          <span class="status" id="pw-status-msg" role="status"></span>
        </div>
      </form>
    </section>

    <?php if ($role === 'owner'): ?>
    <section class="card" data-view="users">
      <div class="card-head">
        <div><h2>Admin users</h2><p>Add team members and choose what each one can do: <strong>Owner</strong> has full control (including users &amp; activity log), <strong>Editor</strong> can change content, <strong>Viewer</strong> can only look.</p></div>
        <button class="btn" type="button" id="btn-new-user">+ New user</button>
      </div>
      <div id="users-list" class="user-list" aria-live="polite"></div>
      <p class="status muted" id="users-status"></p>
    </section>

    <section class="card" id="user-editor" data-view="user-edit">
      <div class="card-head">
        <div><h2 id="user-editor-title">New user</h2><p id="user-editor-hint">Create a login for someone who needs access to this console.</p></div>
      </div>
      <form id="user-form" autocomplete="off">
        <input type="hidden" id="usr-id" value="">
        <div class="grid">
          <label>Name
            <input type="text" id="usr-name" placeholder="Team member">
          </label>
          <label>Username <span class="muted">(3-24 letters, numbers, _ or -)</span>
            <input type="text" id="usr-username" placeholder="editor1" minlength="3" maxlength="24" required>
          </label>
        </div>
        <label>Email address <span class="muted">(optional — can be used to sign in)</span>
          <input type="email" id="usr-email" placeholder="teammate@example.com">
        </label>
        <div class="grid">
          <label>Role
            <select id="usr-role">
              <option value="editor">Editor — can change content</option>
              <option value="viewer">Viewer — read-only</option>
              <option value="owner">Owner — full control</option>
            </select>
          </label>
          <label id="usr-password-label">Temporary password <span class="muted">(min. 8 characters)</span>
            <input type="password" id="usr-password" autocomplete="new-password" placeholder="Set for new user" minlength="8">
          </label>
        </div>
        <div class="row">
          <button class="btn btn-primary" type="submit" id="btn-user-save">Save user</button>
          <button class="btn btn-danger" type="button" id="btn-user-delete" hidden>Delete user</button>
          <button class="btn" type="button" id="btn-user-cancel">Cancel</button>
          <span class="status" id="user-status-msg" role="status"></span>
        </div>
      </form>
    </section>
    <?php endif; ?>

    <section class="card" data-view="activity">
      <div class="card-head">
        <div><h2>Activity log</h2><p>Every account change and content save is recorded here, so each admin can see what the others did.</p></div>
        <div class="row">
          <button class="btn btn-danger hide-for-editor" type="button" id="btn-audit-clear">Clear log</button>
        </div>
      </div>
      <div id="audit-list" class="audit-list" aria-live="polite"></div>
      <p class="status muted" id="audit-status"></p>
    </section>

  </main>
  </div><!-- /.shell -->

<?php endif; ?>

</div>

<script>
  var MT_CSRF = <?php echo json_encode($csrf, JSON_UNESCAPED_SLASHES); ?>;
  var MT_LOGGED_IN = <?php echo $loggedIn ? 'true' : 'false'; ?>;
  var MT_FIRST_RUN = <?php echo $firstRun ? 'true' : 'false'; ?>;
  var MT_ROLE = <?php echo json_encode($role, JSON_UNESCAPED_SLASHES); ?>;
</script>
<script src="admin.js"></script>
</body>
</html>