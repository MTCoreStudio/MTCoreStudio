/* MT Core Studio — admin console logic (vanilla JS) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var mtRole = window.MT_ROLE || '';
  var mtCanWrite = mtRole !== 'viewer';
  var mtIsOwner = mtRole === 'owner';

  /* ------------------------------ sidebar / views ------------------------- */

  var lastView = 'dashboard';
  var currentView = '';

  function switchView(name) {
    var all = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
    var wanted = all.filter(function (v) { return v.getAttribute('data-view') === name; });
    all.forEach(function (v) {
      v.style.display = v === (wanted[0] || null) ? '' : 'none';
    });
    Array.prototype.slice.call(document.querySelectorAll('.nav-link[data-nav]')).forEach(function (a) {
      a.classList.remove('active');
      if (a.getAttribute('data-nav') === name) a.classList.add('active');
    });
    currentView = name;
    document.body.classList.remove('nav-open');
    var scrim = document.getElementById('nav-scrim');
    if (scrim) scrim.hidden = true;
    var main = document.querySelector('main.content');
    if (main) main.scrollTop = 0;
    if (window.scrollTo) { window.scrollTo(0, 0); }
  }

  function onNav(name) {
    if (name === 'analytics' || name === 'ip-analysis' || name === 'pages') {
      refreshAnalytics();
    }
  }

  function wireSidebar() {
    if (!MT_LOGGED_IN) return;
    Array.prototype.slice.call(document.querySelectorAll('.nav-link[data-nav]')).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var name = a.getAttribute('data-nav');
        if (name === 'pass') { lastView = currentView || 'dashboard'; }
        if (name === 'app-edit') { openNewEditor(); return; }
        switchView(name);
        onNav(name);
      });
    });
    Array.prototype.slice.call(document.querySelectorAll('[data-view]')).forEach(function (v) { v.style.display = 'none'; });
    switchView('dashboard');
    var toggle = $('nav-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 900px)').matches) {
          var open = document.body.classList.toggle('nav-open');
          var scrim = $('nav-scrim');
          if (scrim) scrim.hidden = !open;
        } else {
          document.body.classList.toggle('nav-collapsed');
        }
      });
    }
    var scrim = $('nav-scrim');
    if (scrim) {
      scrim.addEventListener('click', function () {
        document.body.classList.remove('nav-open');
        scrim.hidden = true;
      });
    }
    var sideLogout = $('btn-logout-side');
    if (sideLogout) {
      sideLogout.addEventListener('click', function () {
        api('logout').then(function () { window.location.reload(); });
      });
    }
  }

  function encodeUTF8(value) {
    return btoa(unescape(encodeURIComponent(String(value))));
  }

  function setStatus(el, text, ok) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'status' + (ok ? ' ok' : (text ? ' err' : ' muted'));
  }

  async function api(action, payload) {
    var body = new FormData();
    body.append('action', action);
    body.append('csrf', MT_CSRF);
    if (payload) {
      Object.keys(payload).forEach(function (key) {
        var value = payload[key];
        if (Array.isArray(value)) {
          value.forEach(function (item) { body.append(key + '[]', item); });
        } else if (value && typeof value === 'object') {
          body.append(key, JSON.stringify(value));
        } else {
          body.append(key, value === null || value === undefined ? '' : value);
        }
      });
    }
    var res = await fetch('api.php', { method: 'POST', body: body });
    var json;
    try { json = await res.json(); } catch (e) { throw new Error('Server returned an invalid response.'); }
    if (!json.ok) {
      if (res.status === 401 || res.status === 403) {
        window.location.reload();
      }
      throw new Error(json.error || 'Request failed.');
    }
    return json;
  }

  /* ------------------------------- login --------------------------------- */

  function wireLogin() {
    var btnLogin = $('btn-login');
    var btnCreate = $('btn-create');
    var status = $('login-status');

    function attempt(pw1, pw2) {
      setStatus(status, 'Working…');
      return api('login', {
        username: $('username') ? String($('username').value || '').trim() : '',
        name: $('name') ? String($('name').value || '').trim() : '',
        email: $('email') ? String($('email').value || '').trim() : '',
        password: encodeUTF8(pw1),
        password2: encodeUTF8(pw2 || '')
      })
        .then(function () { window.location.reload(); })
        .catch(function (err) { setStatus(status, err.message, false); });
    }

    function enterOn(ids, handler) {
      ids.forEach(function (id) {
        var el = $(id);
        if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') handler(); });
      });
    }

    if (btnLogin) {
      btnLogin.addEventListener('click', function () { attempt($('pw1').value, ''); });
      enterOn(['username', 'pw1'], function () { attempt($('pw1').value, ''); });
    }
    if (btnCreate) {
      btnCreate.addEventListener('click', function () { attempt($('pw1').value, $('pw2').value); });
      enterOn(['name', 'username', 'pw1', 'pw2'], function () { attempt($('pw1').value, $('pw2').value); });
    }
  }

  /* ------------------------------ dashboard ------------------------------- */

  var appImage;

  function esc(value) {
    var div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
  }
  function escAttr(value) { return esc(value).replace(/"/g, '&quot;'); }

  var APP_STATUSES = ['Status to be confirmed', 'In development', 'Published'];

  function monogramOf(name) {
    return String(name).split(/\s+/).slice(0, 2).map(function (w) { return (w[0] || '').toUpperCase(); }).join('');
  }

  function policyChips(app) {
    var priv = String(app.privacyUrl || '');
    var terms = String(app.termsUrl || '');
    return '<span class="pol-chip ' + (priv ? 'ok' : 'bad') + '" title="' + escAttr(priv || 'Not set — use the Legal / Policy Source URL in the app editor') + '">' + (priv ? '✓ Privacy' : '✗ Privacy') + '</span>' +
      '<span class="pol-chip ' + (terms ? 'ok' : 'bad') + '" title="' + escAttr(terms || 'Not set — use the Legal / Policy Source URL in the app editor') + '">' + (terms ? '✓ Terms' : '✗ Terms') + '</span>';
  }

  function renderApps(apps) {
    var list = $('apps-list');
    appImage = apps || [];
    renderCategories(appImage);
    if (!list) return;
    if (!apps.length) {
      list.innerHTML = '<p class="muted">No apps yet. Click “+ New app” to add your first app.</p>';
      return;
    }
    var head = '<div class="table-wrap"><table class="data-table apps-table">' +
      '<thead><tr><th>Icon</th><th>App</th><th>Package</th><th>Category</th><th>Status</th><th>Policy</th><th>Updated</th><th>Actions</th></tr></thead><tbody>';
    var body = apps.map(function (app) {
      var id = String(app.id || '');
      var name = String(app.name || 'Unnamed app');
      var status = String(app.status || 'Status to be confirmed');
      var iconCell = app.icon
        ? '<img class="table-icon" src="' + escAttr(String(app.icon)) + '" alt="">'
        : '<div class="app-row-icon table-mono" aria-hidden="true">' + esc(monogramOf(name)) + '</div>';
      var options = APP_STATUSES.map(function (s) {
        return '<option' + (s === status ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('');
      return '<tr>' +
        '<td>' + iconCell + '</td>' +
        '<td><div class="cell-stack"><strong>' + esc(name) + '</strong><span class="muted mono-id">' + esc(id) + '</span></div></td>' +
        '<td class="cell-pkg">' + esc(String(app.packageName || '—')) + '</td>' +
        '<td>' + esc(String(app.category || '—')) + '</td>' +
        '<td><select class="status-select" data-act="status" data-id="' + escAttr(id) + '" aria-label="Status for ' + escAttr(name) + '">' + options + '</select></td>' +
        '<td>' + policyChips(app) + '</td>' +
        '<td class="muted">' + esc(String(app.updatedAt || '—')) + '</td>' +
        '<td><div class="cell-actions">' +
          '<button class="btn btn-sm" type="button" data-act="edit" data-id="' + escAttr(id) + '">Edit</button>' +
          '<a class="btn btn-sm btn-ghost" href="../app.html?id=' + encodeURIComponent(id) + '" target="_blank" rel="noopener">View</a>' +
          '<button class="btn btn-sm btn-danger" type="button" data-act="delete" data-id="' + escAttr(id) + '">Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
    list.innerHTML = head + body + '</tbody></table></div>';

    list.querySelectorAll('button[data-act="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () { openEditor(btn.getAttribute('data-id')); });
    });
    list.querySelectorAll('select[data-act="status"]').forEach(function (sel) {
      sel.addEventListener('change', function () { quickStatus(sel.getAttribute('data-id'), sel.value); });
    });
    list.querySelectorAll('button[data-act="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (window.confirm('Delete this app permanently?') === true) {
          setStatus($('apps-status'), 'Deleting…');
          api('delete-app', { id: id })
            .then(function (json) {
              if (siteData) { siteData.apps = json.apps; renderPolicies(json.apps, siteData.policies || {}); renderChecklist(siteData); }
              renderApps(json.apps);
              setStatus($('apps-status'), 'App deleted.', true);
            })
            .catch(function (err) { setStatus($('apps-status'), err.message, false); });
        }
      });
    });
  }
  /* Quick status change from the Apps table: send the full stored record with
   * only the status replaced, so a partial write can never lose other fields. */
  function quickStatus(id, status) {
    var app = null;
    for (var i = 0; i < appImage.length; i++) {
      if (String(appImage[i].id) === String(id)) { app = appImage[i]; break; }
    }
    if (!app) return;
    var payload = JSON.parse(JSON.stringify(app));
    payload.status = status;
    setStatus($('apps-status'), 'Saving status…');
    api('save-app', { originalId: String(id), app: JSON.stringify(payload) })
      .then(function (json) {
        if (siteData) { siteData.apps = json.apps; renderPolicies(json.apps, siteData.policies || {}); renderChecklist(siteData); }
        renderApps(json.apps);
        var msg = 'Status for “' + String(app.name) + '” → ' + status + '. Saved — refresh the public website to see it.';
        if (json.warnings && json.warnings.length) {
          setStatus($('apps-status'), msg + ' Warning: ' + json.warnings.join(' '), false);
        } else {
          setStatus($('apps-status'), msg, true);
        }
      })
      .catch(function (err) {
        setStatus($('apps-status'), err.message, false);
        renderApps(appImage);
      });
  }

  function renderCategories(apps) {
    var el = $('categories-list');
    if (!el) return;
    if (!apps || !apps.length) {
      el.innerHTML = '<p class="muted">Add an app first — categories appear here automatically.</p>';
      return;
    }
    var groups = {};
    apps.forEach(function (a) {
      var c = String(a.category || '').trim() || 'Uncategorized';
      if (!groups[c]) groups[c] = [];
      groups[c].push(a);
    });
    el.innerHTML = Object.keys(groups).sort().map(function (c) {
      var rows = groups[c];
      return '<div class="cat-group">' +
        '<div class="cat-head"><strong>' + esc(c) + '</strong><span class="muted">' + rows.length + ' app' + (rows.length === 1 ? '' : 's') + '</span></div>' +
        '<div class="cat-chips">' + rows.map(function (a) {
          return '<button class="cat-chip" type="button" data-id="' + escAttr(String(a.id)) + '">' + esc(String(a.name || a.id)) + ' <span class="muted">' + esc(String(a.status || '')) + '</span></button>';
        }).join('') + '</div>' +
      '</div>';
    }).join('');
    el.querySelectorAll('.cat-chip').forEach(function (btn) {
      btn.addEventListener('click', function () { openEditor(btn.getAttribute('data-id')); });
    });
  }
  function fillSettings(config) {
    $('s-email').value = config.email || '';
    $('s-play').value = config.playStoreUrl || '';
    $('s-github').value = config.githubUrl || '';
    $('s-youtube').value = config.youtubeUrl || '';
    $('s-facebook').value = config.facebookUrl || '';
    $('s-x').value = config.xUrl || '';
    $('s-devname').value = config.developerName || '';
    $('s-country').value = config.country || '';
  }

  function fillAds(lines) {
    $('ads-lines').value = (lines || []).join('\n');
  }

  function openEditor(id) {
    var editor = $('editor');
    editor.hidden = false;
    switchView('app-edit');
    $('editor-title').textContent = id ? 'Edit app' : 'Add a new app';

    var source = {};
    if (id && appImage) {
      var match = appImage.find(function (a) { return String(a.id) === id; });
      if (match) source = match;
    }

    $('f-original-id').value = source.id || '';
    $('f-name').value = source.name || '';
    $('f-category').value = source.category || '';
    $('f-status').value = source.status || 'Status to be confirmed';
    $('f-id').value = source.id || '';
    $('f-package').value = source.packageName || '';
    $('f-play-url').value = source.playStoreUrl || '';
    $('f-privacy-url').value = source.privacyUrl || '';
    $('f-terms-url').value = source.termsUrl || '';
    $('f-policy-source').value = source.policySourceUrl || '';
    $('f-icon').value = source.icon || '';
    $('f-description').value = source.description || '';
    $('f-features').value = (source.features || []).join('\n');
    $('f-screenshots').value = (source.screenshots || []).join('\n');
    $('import-url').value = source.playStoreUrl || '';
    setStatus($('import-status'), '');
    setStatus($('legal-status'), '');
    setStatus($('save-status'), '');
  }

  function openNewEditor() {
    var editor = $('editor');
    editor.hidden = false;
    switchView('app-edit');
    $('editor-title').textContent = 'Add a new app';
    ['f-original-id', 'f-name', 'f-category', 'f-id', 'f-package', 'f-play-url', 'f-privacy-url', 'f-terms-url', 'f-policy-source', 'f-icon', 'f-description', 'f-features', 'f-screenshots', 'import-url']
      .forEach(function (field) { $(field).value = ''; });
    $('f-status').value = 'Status to be confirmed';
    setStatus($('import-status'), '');
    setStatus($('legal-status'), '');
    setStatus($('save-status'), '');
  }

  function collectAppForm() {
    return {
      originalId: $('f-original-id').value,
      app: {
        name: $('f-name').value,
        category: $('f-category').value,
        status: $('f-status').value,
        id: $('f-id').value,
        packageName: $('f-package').value,
        playStoreUrl: $('f-play-url').value,
        privacyUrl: $('f-privacy-url').value,
        termsUrl: $('f-terms-url').value,
        policySourceUrl: $('f-policy-source').value,
        icon: $('f-icon').value,
        description: $('f-description').value,
        features: $('f-features').value.split('\n').filter(Boolean),
        screenshots: $('f-screenshots').value.split('\n').filter(Boolean)
      }
    };
  }

  /* -------------------------------- wiring -------------------------------- */

  function renderWaitlist(list) {
    var el = $('waitlist-list');
    if (!el) return;
    if (!list || !list.length) {
      el.innerHTML = '<p class="muted">No waitlist sign-ups yet. They appear here as visitors subscribe on the app pages.</p>';
      return;
    }
    el.innerHTML = '<div class="waitlist-table"><div class="waitlist-row waitlist-head"><span>App</span><span>Email</span><span>Date</span></div>' +
      list.map(function (entry) {
        return '<div class="waitlist-row"><span>' + esc(String(entry.app || '')) + '</span><span>' + esc(String(entry.email || '')) + '</span><span>' + esc(String(entry.date || '')) + '</span></div>';
      }).join('') +
      '</div><p class="muted waitlist-count">' + list.length + ' sign-up' + (list.length === 1 ? '' : 's') + '.</p>';
  }

  function downloadWaitlistCsv(list) {
    var rows = [['App', 'Email', 'Date']].concat((list || []).map(function (entry) {
      return [String(entry.app || ''), String(entry.email || ''), String(entry.date || '')];
    }));
    var csv = rows.map(function (row) {
      return row.map(function (cell) {
        var safe = String(cell).replace(/"/g, '""');
        return (safe.indexOf(',') !== -1 || safe.indexOf('"') !== -1 || safe.indexOf('\n') !== -1) ? '"' + safe + '"' : safe;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mt-core-studio-waitlist.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  }

  function slugify(value) {
    return String(value).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function countryName(code) {
    var names = {
      US: 'United States', GB: 'United Kingdom', IN: 'India', DE: 'Germany',
      FR: 'France', CA: 'Canada', AU: 'Australia', NL: 'Netherlands',
      BR: 'Brazil', ID: 'Indonesia', PK: 'Pakistan', BD: 'Bangladesh',
      NG: 'Nigeria', PH: 'Philippines', VN: 'Vietnam', EG: 'Egypt',
      TR: 'Turkey', SA: 'Saudi Arabia', AE: 'United Arab Emirates',
      UA: 'Ukraine', PL: 'Poland', ES: 'Spain', IT: 'Italy', JP: 'Japan',
      KR: 'South Korea', MX: 'Mexico', AR: 'Argentina', ZA: 'South Africa',
      KE: 'Kenya', GH: 'Ghana', RO: 'Romania', CZ: 'Czechia', SE: 'Sweden',
      CH: 'Switzerland', AT: 'Austria', BE: 'Belgium', PT: 'Portugal',
      FI: 'Finland', NO: 'Norway', DK: 'Denmark', IE: 'Ireland', NZ: 'New Zealand'
    };
    return names[String(code).toUpperCase()] || String(code).toUpperCase() || 'Unknown';
  }

  function renderVisits(stats, countries, recent, topPages) {
    var el = $('visits-stats');
    if (!el) return;
    var s = stats || {};
    var total = s.total || 0;
    if (total === 0) {
      el.innerHTML = '<p class="muted">No visits recorded yet. They appear here as people open the public pages (the visit beacon is live).</p>';
      return;
    }
    var statRow = '<div class="stat-grid">' +
      '<div class="stat-tile"><b>' + (s.today || 0) + '</b><span>Today</span></div>' +
      '<div class="stat-tile"><b>' + (s.yesterday || 0) + '</b><span>Yesterday</span></div>' +
      '<div class="stat-tile"><b>' + (s.week || 0) + '</b><span>Last 7 days</span></div>' +
      '<div class="stat-tile"><b>' + (s.month || 0) + '</b><span>Last 30 days</span></div>' +
      '<div class="stat-tile"><b>' + (s.unique || 0) + '</b><span>Unique visitors</span></div>' +
      '<div class="stat-tile"><b>' + (s.newMembers || 0) + '</b><span>First-time</span></div>' +
      '<div class="stat-tile"><b>' + (s.returning || 0) + '</b><span>Returning</span></div>' +
      '<div class="stat-tile"><b>' + total + '</b><span>All time</span></div>' +
      '</div>';

    var pages = topPages || [];
    var pageRows = '';
    if (pages.length) {
      var pMax = pages[0] ? pages[0].count : 1;
      pageRows = '<div class="page-list">' + pages.map(function (p) {
        var count = p.count || 0;
        var pct = Math.round((count / pMax) * 100);
        return '<div class="page-row">' +
          '<span class="page-path">' + esc(String(p.page || '/')) + '</span>' +
          '<span class="page-bar"><i style="width:' + pct + '%"></i></span>' +
          '<span class="page-count">' + count + '</span>' +
          '</div>';
      }).join('') + '</div>';
    }

    var countryRows = countryRowsHtml(countries);

    el.innerHTML = statRow +
      (pageRows ? '<p class="muted" style="margin-top:14px">Most viewed pages:</p>' + pageRows : '') +
      '<p class="muted" style="margin-top:14px">Top countries (approximate, from the visit beacon):</p>' + countryRows;
  }

  /* --------------------------- dashboard + analytics ----------------------- */

  var lastVisits = null;

  function statTile(value, label, textTile) {
    return '<div class="stat-tile' + (textTile ? ' tile-wide' : '') + '"><b class="' + (textTile ? 'tile-text' : '') + '">' + esc(String(value)) + '</b><span>' + esc(label) + '</span></div>';
  }

  function renderDashboard(apps, visits) {
    if (visits) lastVisits = visits;
    var el = $('dash-stats');
    if (!el) return;
    var list = apps || [];
    var published = 0;
    list.forEach(function (a) { if (/published/i.test(String(a.status || ''))) published++; });
    var s = (lastVisits && lastVisits.stats) || {};
    var topPages = (lastVisits && lastVisits.topPages) || [];
    var most = topPages.length ? String(topPages[0].page) : 'No data available';
    el.innerHTML =
      statTile(list.length, 'Total apps') +
      statTile(published, 'Published apps') +
      statTile(list.length - published, 'Draft apps') +
      statTile(s.total || 0, 'Total visitors') +
      statTile(s.today || 0, "Today's visitors") +
      statTile(s.unique || 0, 'Unique visitors') +
      statTile(s.total || 0, 'Page views') +
      statTile(most, 'Most visited page', true);
  }

  /* ------------------------------ analytics ------------------------------- */

  var analyticsCache = {};
  var analyticsRanges = { analytics: '30', ips: '30', pages: '30' };
  var ipState = { page: 1, size: 15 };
  var pagesState = { sort: 'views', dir: -1 };

  function currentAnalytics(key) {
    return analyticsCache[analyticsRanges[key]] || null;
  }

  function ensureAnalytics(range) {
    if (analyticsCache[range]) return Promise.resolve(analyticsCache[range]);
    return api('analytics', { range: range }).then(function (json) {
      analyticsCache[range] = json;
      return json;
    });
  }

  function updateRangeButtons() {
    Array.prototype.slice.call(document.querySelectorAll('.range-group')).forEach(function (group) {
      var key = group.getAttribute('data-range-for');
      Array.prototype.slice.call(group.querySelectorAll('.range-btn')).forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-range') === analyticsRanges[key]);
      });
    });
  }

  function refreshAnalytics() {
    setStatus($('an-status'), 'Loading…');
    Promise.all([
      ensureAnalytics(analyticsRanges.analytics),
      ensureAnalytics(analyticsRanges.ips),
      ensureAnalytics(analyticsRanges.pages)
    ])
      .then(function (all) {
        setStatus($('an-status'), '');
        updateRangeButtons();
        renderAnalytics(all[0]);
        renderIpAnalysis(all[1]);
        renderPages(all[2]);
      })
      .catch(function (err) {
        setStatus($('an-status'), err.message, false);
        setStatus($('ip-status'), err.message, false);
        setStatus($('pages-status'), err.message, false);
      });
  }

  function emptyBox(text) { return '<p class="muted">' + esc(text || 'No data available') + '</p>'; }

  function renderTrend(el, trend) {
    if (!el) return;
    if (!trend || !trend.length) { el.innerHTML = emptyBox(); return; }
    var max = 1;
    trend.forEach(function (p) { if (p.n > max) max = p.n; });
    var w = 100 / trend.length;
    var bars = trend.map(function (p, i) {
      var h = p.n > 0 ? Math.max((p.n / max) * 36, 1.5) : 0.4;
      return '<rect class="bar" x="' + (i * w).toFixed(3) + '" y="' + (40 - h).toFixed(2) + '" width="' + Math.max(w - 0.35, 0.35).toFixed(3) + '" height="' + h.toFixed(2) + '" rx="0.3"><title>' + esc(p.d + ' — ' + p.n + ' visit' + (p.n === 1 ? '' : 's')) + '</title></rect>';
    }).join('');
    el.innerHTML = '<svg class="trend-svg" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Daily visits">' + bars + '</svg>' +
      '<div class="chart-axis"><span>' + esc(trend[0].d) + '</span><span>' + esc(trend[trend.length - 1].d) + '</span></div>';
  }

  function renderMix(el, s) {
    if (!el) return;
    var newIps = s.newIps || 0;
    var ret = s.returningIps || 0;
    var sum = newIps + ret;
    if (!sum) { el.innerHTML = emptyBox(); return; }
    var newPct = Math.round((newIps / sum) * 100);
    el.innerHTML =
      '<div class="mix-bar">' +
        '<i class="seg-new" style="width:' + newPct + '%"></i>' +
        '<i class="seg-ret" style="width:' + (100 - newPct) + '%"></i>' +
      '</div>' +
      '<div class="mix-legend">' +
        '<span><i class="dot dot-new"></i>New IPs (first time): <strong>' + newIps + '</strong></span>' +
        '<span><i class="dot dot-ret"></i>Returning / same IPs: <strong>' + ret + '</strong></span>' +
        '<span><i class="dot dot-rep"></i>Repeated (2+ visits in range): <strong>' + (s.repeatedIps || 0) + '</strong></span>' +
      '</div>';
  }

  function countryRowsHtml(countries) {
    var entries = Object.keys(countries || {}).slice(0, 10);
    if (!entries.length) return emptyBox();
    var top = entries[0];
    var max = countries[top] || 1;
    return '<div class="country-list">' + entries.map(function (code) {
      var count = countries[code] || 0;
      var pct = Math.round((count / max) * 100);
      var label = code === '??' ? 'Unknown' : countryName(code);
      return '<div class="country-row">' +
        '<span class="country-flag">' + esc(label.slice(0, 2).toUpperCase()) + '</span>' +
        '<span class="country-name">' + esc(label) + '</span>' +
        '<span class="country-bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="country-count">' + count + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function renderAnalytics(data) {
    var el = $('an-stats');
    if (!el || !data) return;
    var s = data.stats || {};
    var topPage = (data.pages && data.pages.length) ? String(data.pages[0].page) : 'No data available';
    el.innerHTML =
      statTile(s.visits || 0, 'Visits in range') +
      statTile(s.unique || 0, 'Unique visitors') +
      statTile(s.newIps || 0, 'New IPs') +
      statTile(s.returningIps || 0, 'Returning IPs') +
      statTile(s.repeatedIps || 0, 'Repeated IPs') +
      statTile(topPage, 'Top page', true);

    renderTrend($('an-trend'), data.trend);
    renderMix($('an-mix'), s);

    var pg = $('an-pages');
    if (pg) {
      var pages = (data.pages || []).slice(0, 5);
      if (!pages.length) {
        pg.innerHTML = emptyBox();
      } else {
        var maxV = pages[0].views || 1;
        pg.innerHTML = pages.map(function (p) {
          var pct = Math.round(((p.views || 0) / maxV) * 100);
          return '<div class="page-row"><span class="page-path">' + esc(String(p.page)) + '</span><span class="page-bar"><i style="width:' + pct + '%"></i></span><span class="page-count">' + (p.views || 0) + '</span></div>';
        }).join('');
      }
    }

    var cg = $('an-countries');
    if (cg) cg.innerHTML = countryRowsHtml(data.countries);
  }

  function renderIpAnalysis(data) {
    var el = $('ip-summary');
    if (!el || !data) return;
    var s = data.stats || {};
    el.innerHTML =
      statTile(s.visits || 0, 'Total visits') +
      statTile(s.unique || 0, 'Unique IPs') +
      statTile(s.newIps || 0, 'New IPs') +
      statTile(s.returningIps || 0, 'Returning IPs') +
      statTile(s.repeatedIps || 0, 'Repeated IPs');

    var rows = data.ips || [];
    var qEl = $('ip-search');
    var q = qEl ? String(qEl.value || '').toLowerCase().trim() : '';
    var filtered = q ? rows.filter(function (r) { return String(r.id).toLowerCase().indexOf(q) !== -1; }) : rows;

    var count = $('ip-count');
    var table = $('ip-table');
    var pager = $('ip-pager');
    if (!table) return;
    if (!filtered.length) {
      if (count) count.textContent = '';
      table.innerHTML = emptyBox('No hashed visitors in this range.');
      if (pager) pager.innerHTML = '';
      return;
    }
    var totalPages = Math.max(1, Math.ceil(filtered.length / ipState.size));
    if (ipState.page > totalPages) ipState.page = totalPages;
    if (ipState.page < 1) ipState.page = 1;
    var start = (ipState.page - 1) * ipState.size;
    var slice = filtered.slice(start, start + ipState.size);

    if (count) count.textContent = 'Showing ' + (start + 1) + '–' + (start + slice.length) + ' of ' + filtered.length + ' visitor hashes';
    table.innerHTML = '<div class="table-wrap"><table class="data-table">' +
      '<thead><tr><th>Visitor (hashed)</th><th>Visits</th><th>First seen</th><th>Last seen</th><th>Type</th></tr></thead><tbody>' +
      slice.map(function (r) {
        var badges = '<span class="ip-badge ' + (r.isNew ? 'new' : 'ret') + '">' + (r.isNew ? 'New address' : 'Same address') + '</span>';
        if ((r.visits || 0) >= 2) badges += ' <span class="ip-badge rep">Repeated</span>';
        return '<tr>' +
          '<td><code>' + esc(String(r.id)) + '</code></td>' +
          '<td>' + (r.visits || 0) + '</td>' +
          '<td class="muted">' + esc(String(r.first)) + '</td>' +
          '<td class="muted">' + esc(String(r.last)) + '</td>' +
          '<td>' + badges + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';

    if (pager) {
      pager.innerHTML =
        '<button class="btn btn-sm" type="button" data-step="-1"' + (ipState.page <= 1 ? ' disabled' : '') + '>← Prev</button>' +
        '<span class="muted">Page ' + ipState.page + ' of ' + totalPages + '</span>' +
        '<button class="btn btn-sm" type="button" data-step="1"' + (ipState.page >= totalPages ? ' disabled' : '') + '>Next →</button>';
      Array.prototype.slice.call(pager.querySelectorAll('button[data-step]')).forEach(function (b) {
        b.addEventListener('click', function () {
          ipState.page += parseInt(b.getAttribute('data-step'), 10) || 0;
          renderIpAnalysis(currentAnalytics('ips'));
        });
      });
    }
  }

  function renderPages(data) {
    var el = $('pages-table');
    if (!el || !data) return;
    var rows = (data.pages || []).slice();
    var qEl = $('pages-search');
    var q = qEl ? String(qEl.value || '').toLowerCase().trim() : '';
    if (q) rows = rows.filter(function (r) { return String(r.page).toLowerCase().indexOf(q) !== -1; });

    var key = pagesState.sort;
    rows.sort(function (a, b) {
      var av;
      var bv;
      if (key === 'page') {
        av = String(a.page).toLowerCase();
        bv = String(b.page).toLowerCase();
      } else {
        av = Number(a[key] || 0);
        bv = Number(b[key] || 0);
      }
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * pagesState.dir;
    });

    var countEl = $('pages-count');
    if (countEl) countEl.textContent = rows.length + ' page' + (rows.length === 1 ? '' : 's');

    if (!rows.length) {
      el.innerHTML = emptyBox('No page views in this range.');
      return;
    }
    var th = function (col, label) {
      var active = pagesState.sort === col;
      return '<th><button class="th-sort' + (active ? ' active' : '') + '" type="button" data-sort="' + col + '">' +
        esc(label) + (active ? (pagesState.dir === 1 ? ' ↑' : ' ↓') : '') + '</button></th>';
    };
    el.innerHTML = '<div class="table-wrap"><table class="data-table">' +
      '<thead><tr>' + th('page', 'Page') + th('views', 'Views') + th('unique', 'Unique visitors') + th('avg', 'Avg visits') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' +
          '<td><code>' + esc(String(r.page)) + '</code></td>' +
          '<td><strong>' + (r.views || 0) + '</strong></td>' +
          '<td>' + (r.unique || 0) + '</td>' +
          '<td>' + (r.avg != null ? Number(r.avg).toFixed(1) : '—') + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';

    Array.prototype.slice.call(el.querySelectorAll('.th-sort')).forEach(function (b) {
      b.addEventListener('click', function () {
        var col = b.getAttribute('data-sort');
        if (pagesState.sort === col) {
          pagesState.dir = -pagesState.dir;
        } else {
          pagesState.sort = col;
          pagesState.dir = col === 'page' ? 1 : -1;
        }
        renderPages(currentAnalytics('pages'));
      });
    });
  }
  function wireDashboard() {
    if (!MT_LOGGED_IN) return;

    api('list').then(function (json) {
      siteData = json;
      renderApps(json.apps);
      fillSettings(json.config);
      fillAds(json.ads);
      renderPolicies(json.apps, json.policies || {});
      renderVerification(json.verification || []);
      renderChecklist(json);
      renderUsers(json.users || []);
      renderAudit(json.audit || []);
      renderDashboard(json.apps, null);
      renderAuditEntries(json.audit || [], $('dash-activity'), 6);
    }).catch(function (err) {
      setStatus($('apps-status'), err.message, false);
    });

    $('btn-logout').addEventListener('click', function () {
      api('logout').then(function () { window.location.reload(); });
    });

    $('btn-new-app').addEventListener('click', openNewEditor);
    $('btn-cancel').addEventListener('click', function () { $('editor').hidden = true; switchView('apps'); });

    $('app-form').addEventListener('submit', function (e) {
      e.preventDefault();
      setStatus($('save-status'), 'Saving…');
      api('save-app', collectAppForm())
        .then(function (json) {
          if (siteData) { siteData.apps = json.apps; renderPolicies(json.apps, siteData.policies || {}); renderChecklist(siteData); }
          renderApps(json.apps);
          $('editor').hidden = true;
          switchView('apps');
          var warn = json.warnings || [];
          if (warn.length) {
            setStatus($('apps-status'), 'Saved — but review needed: ' + warn.join(' '), false);
          } else {
            setStatus($('apps-status'), 'App saved. It is live on the website now.', true);
          }
        })
        .catch(function (err) { setStatus($('save-status'), err.message, false); });
    });

    $('btn-import').addEventListener('click', function () {
      setStatus($('import-status'), 'Fetching details from Google Play…');
      api('import-play', { url: $('import-url').value })
        .then(function (json) {
          var info = json.info;
          $('f-name').value = info.name || '';
          $('f-package').value = info.packageName || '';
          $('f-category').value = info.category || '';
          $('f-description').value = info.description || '';
          $('f-icon').value = json.iconSaved || info.icon || '';
          $('f-screenshots').value = (info.screenshots || []).slice(0, 6).join('\n');
          if (info.name) { $('f-id').value = slugify(info.name); }
          setStatus($('import-status'), 'Details filled in. Review them, then press “Save app”.', true);
        })
        .catch(function (err) { setStatus($('import-status'), err.message, false); });
    });

    $('btn-detect-legal').addEventListener('click', function () {
      var url = $('f-policy-source').value.trim();
      if (!url) { setStatus($('legal-status'), 'Enter the Legal / Policy Source URL first — the page that links to both policies.', false); return; }
      setStatus($('legal-status'), 'Reading the source page…');
      api('fetch-links', { url: url })
        .then(function (json) {
          var p = json.privacyUrl || '';
          var t = json.termsUrl || '';
          var notes = [];
          if (p) {
            if ($('f-privacy-url').value.trim()) { notes.push('kept your existing Privacy URL'); }
            else { $('f-privacy-url').value = p; notes.push('Privacy Policy filled'); }
          }
          if (t) {
            if ($('f-terms-url').value.trim()) { notes.push('kept your existing Terms URL'); }
            else { $('f-terms-url').value = t; notes.push('Terms of Service filled'); }
          }
          var missing = [];
          if (!p) missing.push('Privacy Policy');
          if (!t) missing.push('Terms of Service');
          if (!p && !t) {
            setStatus($('legal-status'), 'Could not detect any links on that page — nothing was changed. Enter both URLs manually, then save.', false);
          } else if (missing.length) {
            setStatus($('legal-status'), 'Detected: ' + notes.join(', ') + '. ' + missing.join(' and ') + ' link NOT found — enter it manually before saving.', false);
          } else {
            setStatus($('legal-status'), 'Both links detected (' + notes.join(', ') + '). Review them, then press “Save app”.', true);
          }
        })
        .catch(function (err) { setStatus($('legal-status'), err.message, false); });
    });

    $('settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      setStatus($('settings-status'), 'Saving…');
      api('save-config', {
        email: $('s-email').value,
        playStoreUrl: $('s-play').value,
        githubUrl: $('s-github').value,
        youtubeUrl: $('s-youtube').value,
        facebookUrl: $('s-facebook').value,
        xUrl: $('s-x').value,
        developerName: $('s-devname').value,
        country: $('s-country').value
      })
        .then(function () { setStatus($('settings-status'), 'Settings saved.', true); })
        .catch(function (err) { setStatus($('settings-status'), err.message, false); });
    });

    $('ads-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var lines = $('ads-lines').value.split('\n')
        .map(function (l) { return l.trim(); })
        .filter(Boolean);
      setStatus($('ads-status'), 'Saving…');
      api('save-ads', { lines: lines })
        .then(function (json) {
          var count = json.ads.length;
          setStatus($('ads-status'), 'app-ads.txt updated (' + count + ' line' + (count === 1 ? '' : 's') + ').', true);
        })
        .catch(function (err) { setStatus($('ads-status'), err.message, false); });
    });

    api('waitlist-list')
      .then(function (json) { renderWaitlist(json.waitlist); })
      .catch(function (err) { setStatus($('waitlist-status'), err.message, false); });

    var btnExport = $('btn-waitlist-export');
    if (btnExport) {
      btnExport.addEventListener('click', function () {
        api('waitlist-list')
          .then(function (json) { downloadWaitlistCsv(json.waitlist); })
          .catch(function (err) { setStatus($('waitlist-status'), err.message, false); });
      });
    }

    var btnClear = $('btn-waitlist-clear');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (!window.confirm('Remove every waitlist entry? This cannot be undone.')) return;
        api('waitlist-clear')
          .then(function (json) {
            renderWaitlist(json.waitlist);
            setStatus($('waitlist-status'), 'Waitlist cleared.', true);
          })
          .catch(function (err) { setStatus($('waitlist-status'), err.message, false); });
      });
    }

    /* --------------------- visitors + dashboard stats ---------------------- */

    function loadVisitStats() {
      return api('visits-stats')
        .then(function (json) {
          renderVisits(json.stats, json.countries, json.recent, json.topPages);
          renderDashboard(siteData ? siteData.apps : [], json);
          return json;
        })
        .catch(function (err) {
          setStatus($('visits-status'), err.message, false);
          setStatus($('dash-status'), err.message, false);
          return null;
        });
    }
    loadVisitStats();

    var btnDashRefresh = $('btn-dash-refresh');
    if (btnDashRefresh) {
      btnDashRefresh.addEventListener('click', function () {
        setStatus($('dash-status'), 'Refreshing…');
        api('list')
          .then(function (json) {
            siteData = json;
            renderApps(json.apps);
            renderPolicies(json.apps, json.policies || {});
            renderChecklist(json);
            renderAudit(json.audit || []);
            renderAuditEntries(json.audit || [], $('dash-activity'), 6);
            loadVisitStats();
            setStatus($('dash-status'), 'Refreshed.', true);
          })
          .catch(function (err) { setStatus($('dash-status'), err.message, false); });
      });
    }

    Array.prototype.slice.call(document.querySelectorAll('.quick-actions [data-quick]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-quick');
        if (act === 'new-app') { openNewEditor(); }
        else if (act === 'analytics') { switchView('analytics'); refreshAnalytics(); }
        else { switchView(act); }
      });
    });

    /* --------------------------- analytics screens ------------------------- */
    Array.prototype.slice.call(document.querySelectorAll('.range-group')).forEach(function (group) {
      var key = group.getAttribute('data-range-for');
      Array.prototype.slice.call(group.querySelectorAll('.range-btn')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          analyticsRanges[key] = btn.getAttribute('data-range');
          refreshAnalytics();
        });
      });
    });
    var ipSearch = $('ip-search');
    if (ipSearch) {
      ipSearch.addEventListener('input', function () {
        ipState.page = 1;
        renderIpAnalysis(currentAnalytics('ips'));
      });
    }
    var pagesSearch = $('pages-search');
    if (pagesSearch) {
      pagesSearch.addEventListener('input', function () { renderPages(currentAnalytics('pages')); });
    }

    var btnVisitsExport = $('btn-visits-export');
    if (btnVisitsExport) {
      btnVisitsExport.addEventListener('click', function () {
        var body = new FormData();
        body.append('action', 'visits-export');
        body.append('csrf', MT_CSRF);
        fetch('api.php', { method: 'POST', body: body })
          .then(function (res) {
            if (!res.ok) throw new Error('Export failed.');
            return res.blob();
          })
          .then(function (blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'mt-core-studio-visits.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
          })
          .catch(function () { setStatus($('visits-status'), 'Could not create the CSV export.', false); });
      });
    }

    var btnVisitsClear = $('btn-visits-clear');
    if (btnVisitsClear) {
      btnVisitsClear.addEventListener('click', function () {
        if (!window.confirm('Remove all recorded visits? This cannot be undone.')) return;
        api('visits-clear')
          .then(function () {
            loadVisitStats();
            setStatus($('visits-status'), 'Visit log cleared.', true);
          })
          .catch(function (err) { setStatus($('visits-status'), err.message, false); });
      });
    }
  }

  /* ------------------------- store & verification ------------------------- */

  var siteData = null;

  // Default policy skeleton, matching the public page template styling.
  var POLICY_TEMPLATE = [
    '<section class="detail-block"><h2>Policy owner &amp; contact</h2><p><strong>APP NAME</strong> is developed and published by MT Core Studio. Privacy questions are handled through the public <a class="text-link" href="contact.html">contact page</a>, or by email to the address listed there. This policy is effective as of [DATE].</p></section>',
    '<section class="detail-block"><h2>Information this app handles</h2><p>[List every category of personal or device information the app collects, its purpose, and whether providing it is optional or required.]</p></section>',
    '<section class="detail-block"><h2>Sharing &amp; service providers</h2><p>[Identify any SDKs, analytics, advertising or infrastructure providers and their roles, each linked to its current policy.]</p></section>',
    '<section class="detail-block"><h2>Storage, security &amp; retention</h2><p>[Describe retention periods, security practices and any cross-border handling in accurate general terms.]</p></section>',
    '<section class="detail-block"><h2>Children, choices &amp; rights</h2><p>[Describe age requirements, the controls available to users, and how deletion or other data rights can be exercised.]</p></section>',
    '<section class="detail-block"><h2>Changes to this policy</h2><p>[Describe how updates to this policy are communicated and note the version history.]</p></section>'
  ].join('\n');

  function currentAppName(id) {
    if (!siteData || !siteData.apps) return '';
    var match = siteData.apps.find(function (a) { return String(a.id) === String(id); });
    return match ? String(match.name || '') : '';
  }

  // Real public site root. Prefers the configured canonical domain, but if it is
  // still the https://example.com placeholder (or missing), uses the origin the
  // console is actually served from - so the links you copy are always live.
  function siteRootUrl() {
    var config = siteData && siteData.config ? siteData.config : {};
    var canned = String(config.canonicalDomain || '').trim().replace(/\/+$/, '');
    if (canned && !/example\.com/i.test(canned)) {
      return canned;
    }
    var origin = String(window.location.origin || '').trim();
    if (origin && origin.indexOf('http') === 0) {
      return origin.replace(/\/+$/, '');
    }
    return '';
  }

  function policyPublicUrl(id) {
    return siteRootUrl() + '/app-privacy.html?id=' + encodeURIComponent(String(id));
  }

  // Keep the read-only URL field in the policy editor in sync with the app selected.
  function refreshPolicyUrl() {
    var el = $('pol-url');
    if (!el) return;
    el.value = policyPublicUrl($('pol-app').value || '');
  }

  function copyText(text, statusEl, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      try {
        ta.select();
        document.execCommand('copy');
        setStatus(statusEl, okMsg, true);
      } catch (e2) {
        setStatus(statusEl, text, false);
      }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setStatus(statusEl, okMsg, true);
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  function policyState(policy) {
    if (!policy) return { cls: 'bad', label: 'Not written' };
    var content = String(policy.content || '').trim();
    if (!content) return { cls: 'bad', label: 'Not written' };
    return String(policy.status || '').toLowerCase() === 'completed'
      ? { cls: 'ok', label: 'Completed' }
      : { cls: 'warn', label: 'Draft' };
  }

  function renderPolicies(apps, policies) {
    var el = $('policies-list');
    if (!el) return;
    if (!apps || !apps.length) {
      el.innerHTML = '<p class="muted">Add an app first — each app needs its own policy before it can be listed on Google Play.</p>';
      return;
    }
    el.innerHTML = '<div class="policy-table"><div class="policy-row policy-head"><span>App</span><span>Policy</span><span>Actions</span></div>' +
      apps.map(function (app) {
        var id = String(app.id || '');
        var st = policyState(policies && policies[id]);
        return '<div class="policy-row">' +
          '<span><strong>' + esc(String(app.name || id)) + '</strong><br><span class="muted">' + esc(id) + '</span></span>' +
          '<span><span class="pill pill-' + st.cls + '">' + st.label + '</span></span>' +
          '<span class="policy-actions">' +
            '<button class="btn btn-sm" type="button" data-act="edit-policy" data-id="' + escAttr(id) + '">Edit</button>' +
            '<button class="btn btn-sm" type="button" data-act="copy-policy" data-id="' + escAttr(id) + '">Copy URL</button>' +
            '<button class="btn btn-sm" type="button" data-act="open-policy" data-id="' + escAttr(id) + '">View ↗</button>' +
          '</span></div>';
      }).join('') + '</div>';

    el.querySelectorAll('button[data-act="edit-policy"]').forEach(function (btn) {
      btn.addEventListener('click', function () { openPolicyEditor(btn.getAttribute('data-id')); });
    });
    el.querySelectorAll('button[data-act="copy-policy"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyText(policyPublicUrl(btn.getAttribute('data-id')), $('policies-status'), 'Privacy policy URL copied — paste it into the Play Console when it asks for a Privacy Policy URL.');
      });
    });
    el.querySelectorAll('button[data-act="open-policy"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var w = window.open(policyPublicUrl(btn.getAttribute('data-id')), '_blank', 'noopener');
        if (w) w.opener = null;
      });
    });
  }

  function fillPolicySelect(selected) {
    var sel = $('pol-app');
    if (!sel) return;
    var apps = siteData && siteData.apps ? siteData.apps : [];
    sel.innerHTML = apps.map(function (app) {
      return '<option value="' + escAttr(String(app.id || '')) + '">' + esc(String(app.name || app.id || '')) + '</option>';
    }).join('');
    if (selected && apps.some(function (a) { return String(a.id) === String(selected); })) {
      sel.value = String(selected);
    }
  }

  function openPolicyEditor(id) {
    if (!siteData) return;
    var editor = $('policy-editor');
    editor.hidden = false;
    switchView('policy-edit');
    fillPolicySelect(id);
    var policy = (siteData.policies && siteData.policies[id]) || {};
    $('pol-status').value = String(policy.status || 'draft') === 'completed' ? 'completed' : 'draft';
    $('pol-content').value = String(policy.content || '');
    $('pol-updated').textContent = policy.updated ? String(policy.updated) : 'not saved yet';
    setStatus($('pol-status-msg'), '');
    $('policy-editor-title').textContent = 'Privacy policy — ' + (currentAppName(id) || id);
    refreshPolicyUrl();
    $('pol-content').focus();
  }

  function renderVerification(files) {
    var el = $('verification-list');
    if (!el) return;
    if (!files || !files.length) {
      el.innerHTML = '<p class="muted">No Google Play verification files hosted yet. Add the file name and content from the Play Console below.</p>';
      return;
    }
    var domain = siteRootUrl();
    el.innerHTML = files.map(function (f) {
      var name = String(f.name || '');
      var url = (domain ? domain : '') + '/' + name;
      var meta = esc(String(f.modified || '') + (f.size ? ' · ' + f.size + ' B' : ''));
      return '<div class="file-row">' +
        '<span><strong>' + esc(name) + '</strong><br><span class="muted">' + meta + '</span></span>' +
        '<span><code>' + esc(url) + '</code></span>' +
        '<span class="file-actions">' +
          '<button class="btn btn-sm" type="button" data-act="copy-vf" data-url="' + escAttr(url) + '">Copy URL</button>' +
          '<button class="btn btn-sm btn-danger" type="button" data-act="delete-vf" data-name="' + escAttr(name) + '">Delete</button>' +
        '</span></div>';
    }).join('');

    el.querySelectorAll('button[data-act="copy-vf"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyText(btn.getAttribute('data-url'), $('verification-status'), 'Verification file URL copied — paste it into the Play Console.');
      });
    });
    el.querySelectorAll('button[data-act="delete-vf"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-name');
        if (!window.confirm('Delete ' + name + ' from the site root? Google may no longer verify the website until you re-add it.')) return;
        api('delete-verification', { name: name })
          .then(function (json) {
            renderVerification(json.verification || []);
            setStatus($('verification-status'), name + ' deleted.', true);
          })
          .catch(function (err) { setStatus($('verification-status'), err.message, false); });
      });
    });
  }

  function renderChecklist(data) {
    var el = $('checklist-list');
    if (!el) return;
    var apps = data && data.apps ? data.apps : [];
    var config = data && data.config ? data.config : {};
    var ads = data && data.ads ? data.ads : [];
    var policies = data && data.policies ? data.policies : {};

    var items = [];
    function add(ok, label, hint) {
      items.push('<div class="check-row ' + (ok ? 'ok' : 'bad') + '"><span class="check-mark">' + (ok ? '✓' : '✗') + '</span><span>' +
        esc(label) + (hint ? '<br><span class="muted">' + esc(hint) + '</span>' : '') + '</span></div>');
    }

    var domainOk = !!(config.canonicalDomain && !/example\.com/i.test(String(config.canonicalDomain)));
    add(domainOk, 'A real canonical domain is set', domainOk ? String(config.canonicalDomain) : 'Edit data/site-config.js and replace https://example.com with your domain.');
    add(!!config.email, 'Contact / support email is set', 'Site settings → Support email.');
    add(!!config.playStoreUrl, 'Google Play developer page URL is set', 'Site settings → Google Play developer page.');
    add(ads.length > 0, 'app-ads.txt has at least one publisher line', ads.length + ' line(s) currently.');

    apps.forEach(function (app) {
      var name = String(app.name || app.id || '');
      var id = String(app.id || '');
      var st = policyState(policies[id]);
      var privacyLinked = !app.privacyUrl || String(app.privacyUrl).indexOf('app-privacy.html') !== -1;
      add(st.cls !== 'bad', '“' + name + '” has a written privacy policy', st.label + (app.privacyUrl ? ' · linked from the app: ' + String(app.privacyUrl) : ''));
      add(privacyLinked, '“' + name + '” privacyUrl points to the policy page', 'App editor → Privacy policy URL.');
      add(!!app.termsUrl, '“' + name + '” has a Terms of Service URL', String(app.termsUrl || 'App editor → Terms of Service URL.'));
      add(!!app.playStoreUrl, '“' + name + '” has a Google Play listing URL', String(app.playStoreUrl || 'Added automatically after publishing.'));
      add(String(app.status || '').toLowerCase().indexOf('publish') !== -1, '“' + name + '” status is Published', String(app.status || '') + ' — set in the app editor.');
    });

    el.innerHTML = items.join('') || '<p class="muted">Add your first app to start the checklist.</p>';
  }

  function wireStoreFeatures() {
    if (!MT_LOGGED_IN) return;

    /* privacy policy editor */
    $('btn-pol-close').addEventListener('click', function () { $('policy-editor').hidden = true; switchView('policies'); });

    if ($('pol-app')) {
      $('pol-app').addEventListener('change', refreshPolicyUrl);
    }
    if ($('btn-pol-copy-url')) {
      $('btn-pol-copy-url').addEventListener('click', function () {
        copyText(policyPublicUrl($('pol-app').value || ''), $('pol-status-msg'), 'Privacy policy URL copied — paste it into the Play Console when it asks for a Privacy Policy URL.');
      });
    }
    if ($('btn-pol-open-url')) {
      $('btn-pol-open-url').addEventListener('click', function () {
        var w = window.open(policyPublicUrl($('pol-app').value || ''), '_blank', 'noopener');
        if (w) w.opener = null;
      });
    }

    $('btn-pol-fill').addEventListener('click', function () {
      var name = currentAppName($('pol-app').value) || 'This app';
      $('pol-content').value = POLICY_TEMPLATE.replace(/APP NAME/g, name);
      setStatus($('pol-status-msg'), 'Default template inserted — replace the [bracketed] parts with real details.', true);
    });

    $('policy-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var id = $('pol-app').value;
      if (!id) { setStatus($('pol-status-msg'), 'Choose an app first.', false); return; }
      setStatus($('pol-status-msg'), 'Saving…');
      api('save-policy', { id: id, status: $('pol-status').value, content: $('pol-content').value })
        .then(function (json) {
          if (siteData) { siteData.policies = json.policies || siteData.policies; renderPolicies(siteData.apps, siteData.policies); renderChecklist(siteData); }
          $('pol-updated').textContent = new Date().toISOString().slice(0, 10);
          refreshPolicyUrl();
          $('policy-editor').hidden = true;
          switchView('policies');
          setStatus($('pol-status-msg'), 'Policy saved — your Play Store link is ' + policyPublicUrl(id) + ' (use Copy URL to paste it into the Play Console).', true);
        })
        .catch(function (err) { setStatus($('pol-status-msg'), err.message, false); });
    });

    $('btn-pol-remove').addEventListener('click', function () {
      var id = $('pol-app').value;
      if (!id) return;
      if (!window.confirm('Remove the saved policy for this app? The public page will go back to the default draft template.')) return;
      api('reset-policy', { id: id })
        .then(function (json) {
          if (siteData) { siteData.policies = json.policies || {}; renderPolicies(siteData.apps, siteData.policies); renderChecklist(siteData); }
          $('pol-content').value = '';
          $('pol-updated').textContent = 'not saved yet';
          $('policy-editor').hidden = true;
          switchView('policies');
          setStatus($('pol-status-msg'), 'Saved policy removed.', true);
        })
        .catch(function (err) { setStatus($('pol-status-msg'), err.message, false); });
    });

    /* AdMob publisher-line helper */
    $('ads-rel').addEventListener('change', function () {
      var direct = $('ads-rel').value === 'DIRECT';
      $('ads-token').disabled = direct;
      if (direct) $('ads-token').value = 'f08c47fec0942fa0';
    });
    $('ads-token').value = 'f08c47fec0942fa0';
    $('ads-token').disabled = true;

    $('ads-add-form').addEventListener('submit', function (e) {
      e.preventDefault();
      setStatus($('ads-helper-status'), 'Adding…');
      api('add-ads-line', {
        domain: $('ads-domain').value,
        publisher: $('ads-pub').value,
        relation: $('ads-rel').value,
        token: $('ads-token').value
      }).then(function (json) {
        fillAds(json.ads || []);
        $('ads-pub').value = '';
        setStatus($('ads-helper-status'), 'Publisher line added to app-ads.txt. Check AdMob → Apps → app-ads.txt after 24 hours.', true);
      }).catch(function (err) { setStatus($('ads-helper-status'), err.message, false); });
    });

    /* Google Play verification files */
    $('verification-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('vf-name').value.trim();
      if (!/^google[A-Za-z0-9_-]*\.html$/i.test(name)) {
        setStatus($('vf-status'), 'The file name must look like "google1a2b3c.html" — exactly what the Play Console shows.', false);
        return;
      }
      setStatus($('vf-status'), 'Saving…');
      api('save-verification', { name: name, content: $('vf-content').value })
        .then(function (json) {
          renderVerification(json.verification || []);
          $('vf-content').value = '';
          setStatus($('vf-status'), name + ' is now live at the site root.', true);
        })
        .catch(function (err) { setStatus($('vf-status'), err.message, false); });
    });
  }

  /* ----------------------- admin users, passwords, audit ------------------- */

  function renderUsers(users) {
    var el = $('users-list');
    if (!el) return;
    if (!Array.isArray(users) || !users.length) {
      el.innerHTML = '<p class="muted">No admin users yet. Use “+ New user” to add your first team member.</p>';
      return;
    }
    var head = '<div class="user-table"><div class="user-row user-head"><span>Name</span><span>Username</span><span>Role</span><span>Last login / actions</span></div>';
    el.innerHTML = head + users.map(function (u) {
      var isYou = siteData && siteData.user && String(siteData.user.id) === String(u.id);
      var delBtn = isYou ? '' : '<button class="btn btn-sm btn-danger" type="button" data-act="delete-user" data-id="' + escAttr(String(u.id)) + '">Delete</button>';
      return '<div class="user-row">' +
        '<span><strong>' + esc(String(u.name || u.username || '')) + '</strong>' + (isYou ? ' <span class="user-you">(you)</span>' : '') +
        '<br><span class="muted">' + esc(String(u.email || '')) + '</span></span>' +
        '<span><code>' + esc(String(u.username || '')) + '</code></span>' +
        '<span><span class="pill pill-' + escAttr(String(u.role || 'viewer')) + '">' + esc(String(u.role || 'viewer')) + '</span></span>' +
        '<span class="user-actions"><span class="muted">' + esc(String(u.lastLogin || 'never')) + '</span>' +
          '<button class="btn btn-sm" type="button" data-act="edit-user" data-id="' + escAttr(String(u.id)) + '">Edit</button>' +
          delBtn +
        '</span></div>';
    }).join('') + '</div>';

    el.querySelectorAll('button[data-act="edit-user"]').forEach(function (btn) {
      btn.addEventListener('click', function () { openUserEditor(btn.getAttribute('data-id')); });
    });
    el.querySelectorAll('button[data-act="delete-user"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var u = (siteData && siteData.users ? siteData.users : []).find(function (x) { return String(x.id) === String(id); });
        if (!window.confirm('Delete user "' + (u ? String(u.username) : id) + '"? They will be signed out immediately.')) return;
        api('delete-user', { id: id })
          .then(function (json) {
            if (siteData) siteData.users = json.users || [];
            renderUsers(json.users || []);
            if (json.audit) renderAudit(json.audit);
            setStatus($('users-status'), 'User deleted.', true);
          })
          .catch(function (err) { setStatus($('users-status'), err.message, false); });
      });
    });
  }

  function openUserEditor(id) {
    var editor = $('user-editor');
    if (!editor || !siteData) return;
    var users = siteData && siteData.users ? siteData.users : [];
    var target = id ? users.find(function (u) { return String(u.id) === String(id); }) : null;
    editor.hidden = false;
    switchView('user-edit');
    $('usr-id').value = target ? String(target.id || '') : '';
    $('usr-name').value = target ? String(target.name || '') : '';
    $('usr-username').value = target ? String(target.username || '') : '';
    $('usr-email').value = target ? String(target.email || '') : '';
    $('usr-role').value = target ? String(target.role || 'editor') : 'editor';
    $('usr-password').value = '';
    $('usr-password').placeholder = target ? 'Leave blank to keep current password' : 'Set for new user';
    $('user-editor-title').textContent = target ? 'Edit user' : 'New user';
    $('user-editor-hint').textContent = target
      ? 'Update this account. The password stays unchanged unless you set a new one here.'
      : 'Create a login for someone who needs access to this console. They can change their own password after signing in.';
    $('btn-user-delete').hidden = !target;
    setStatus($('user-status-msg'), '');
    $('usr-username').focus();
  }

  function renderAudit(entries) {
    renderAuditEntries(entries, $('audit-list'), 100);
  }

  function renderAuditEntries(entries, el, limit) {
    if (!el) return;
    if (!entries || !entries.length) {
      el.innerHTML = '<p class="muted">No activity yet. Every sign-in and saved change will appear here.</p>';
      return;
    }
    el.innerHTML = '<table class="audit-table"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>' +
      entries.slice(0, limit || 100).map(function (e) {
        return '<tr>' +
          '<td>' + esc(String(e.d || '')) + '</td>' +
          '<td>' + esc(String(e.u || '')) + '</td>' +
          '<td class="audit-action">' + esc(String(e.a || '')) + '</td>' +
          '<td class="audit-note">' + esc(String(e.x || '')) + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
  }

  function wireAccountFeatures() {
    if (!MT_LOGGED_IN) return;

    /* change password */
    $('btn-change-pw').addEventListener('click', function () {
      lastView = currentView || 'dashboard';
      switchView('pass');
      $('pw-current').focus();
    });
    $('btn-pw-cancel').addEventListener('click', function () { switchView(lastView || 'dashboard'); });
    $('pw-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('pw-new').value !== $('pw-new2').value) {
        setStatus($('pw-status-msg'), 'The two new passwords do not match.', false);
        return;
      }
      setStatus($('pw-status-msg'), 'Updating…');
      api('change-password', {
        current: encodeUTF8($('pw-current').value),
        password: encodeUTF8($('pw-new').value),
        password2: encodeUTF8($('pw-new2').value)
      }).then(function (json) {
        ['pw-current', 'pw-new', 'pw-new2'].forEach(function (id) { $(id).value = ''; });
        if (json.audit) renderAudit(json.audit);
        switchView(lastView || 'dashboard');
        setStatus($('pw-status-msg'), 'Password updated.', true);
      }).catch(function (err) { setStatus($('pw-status-msg'), err.message, false); });
    });

    /* admin users (owner only - the elements only exist for the owner) */
    var btnNewUser = $('btn-new-user');
    if (!btnNewUser) return;
    btnNewUser.addEventListener('click', function () { openUserEditor(''); });
    $('btn-user-cancel').addEventListener('click', function () { $('user-editor').hidden = true; switchView('users'); });
    $('btn-user-delete').addEventListener('click', function () {
      var id = $('usr-id').value;
      if (!id) return;
      var u = (siteData && siteData.users ? siteData.users : []).find(function (x) { return String(x.id) === String(id); });
      if (!window.confirm('Delete user "' + (u ? String(u.username) : id) + '"? They will be signed out immediately.')) return;
      api('delete-user', { id: id })
        .then(function (json) {
          if (siteData) siteData.users = json.users || [];
          renderUsers(json.users || []);
          if (json.audit) renderAudit(json.audit);
          $('user-editor').hidden = true;
          switchView('users');
          setStatus($('users-status'), 'User deleted.', true);
        })
        .catch(function (err) { setStatus($('user-status-msg'), err.message, false); });
    });
    $('user-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = {
        id: $('usr-id').value,
        name: $('usr-name').value,
        username: $('usr-username').value,
        email: $('usr-email').value,
        role: $('usr-role').value
      };
      var pw = $('usr-password').value;
      if (pw) payload.password = encodeUTF8(pw);
      setStatus($('user-status-msg'), 'Saving…');
      api('save-user', payload)
        .then(function (json) {
          if (siteData) siteData.users = json.users || [];
          renderUsers(json.users || []);
          if (json.audit) renderAudit(json.audit);
          $('user-editor').hidden = true;
          switchView('users');
          setStatus($('users-status'), 'User saved.', true);
        })
        .catch(function (err) { setStatus($('user-status-msg'), err.message, false); });
    });

    /* activity log (owner can clear) */
    var btnAuditClear = $('btn-audit-clear');
    if (btnAuditClear) {
      btnAuditClear.addEventListener('click', function () {
        if (!window.confirm('Clear the entire activity log? This cannot be undone.')) return;
        api('audit-clear')
          .then(function (json) {
            renderAudit(json.audit || []);
            setStatus($('audit-status'), 'Activity log cleared.', true);
          })
          .catch(function (err) { setStatus($('audit-status'), err.message, false); });
      });
    }
  }

  wireLogin();
  wireDashboard();
  wireStoreFeatures();
  wireAccountFeatures();
  wireSidebar();
})();

