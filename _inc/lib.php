<?php
// MT Core Studio - core helpers shared by the public site endpoints and the admin API.
// This folder is blocked from the web by _inc/.htaccess.
if (defined('MT_LIB')) { return; }
define('MT_LIB', 1);
define('MT_ROOT', dirname(__DIR__));
define('MT_DATA', MT_ROOT . '/meher/_data');

/* ---------- JSON storage ---------- */
function mt_rj($f, $d = []) {
  $p = MT_DATA . '/' . $f;
  if (!is_file($p)) return $d;
  $j = json_decode((string)@file_get_contents($p), true);
  return is_array($j) ? $j : $d;
}
function mt_wj($f, $d, $pretty = true) {
  $p = MT_DATA . '/' . $f;
  $dir = dirname($p);
  if (!is_dir($dir)) @mkdir($dir, 0755, true);
  $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | ($pretty ? JSON_PRETTY_PRINT : 0);
  $t = $p . '.' . bin2hex(random_bytes(4)) . '.tmp';
  if (@file_put_contents($t, json_encode($d, $flags), LOCK_EX) === false) return false;
  if (!@rename($t, $p)) { @unlink($t); return false; }
  return true;
}
function mt_lock($name, $block = true) {
  $h = @fopen(MT_DATA . '/.' . preg_replace('/[^a-z0-9_]/i', '', $name) . '.lock', 'c');
  if (!$h) return null;
  if (!flock($h, $block ? LOCK_EX : (LOCK_EX | LOCK_NB))) { fclose($h); return null; }
  return $h;
}
function mt_unlock($h) { if ($h) { flock($h, LOCK_UN); fclose($h); } }

/* ---------- config / store ---------- */
function mt_cfg() {
  $c = mt_rj('config.json', []);
  $proxy = trim((string)($c['proxy'] ?? ''));
  if ($proxy !== '' && !preg_match('#^https://[^\s<>"\']{4,400}$#i', $proxy)) $proxy = '';
  return ['proxy' => $proxy, 'ttl_h' => max(1, min(72, (int)($c['ttl_h'] ?? 6)))];
}
function mt_store() {
  $s = mt_rj('store.json', []);
  foreach (['apps', 'log', 'set'] as $k) if (!isset($s[$k]) || !is_array($s[$k])) $s[$k] = [];
  return $s;
}
function mt_pkg_ok($p) {
  return is_string($p) && strlen($p) <= 150 && preg_match('/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/', $p) === 1;
}
// 'assets/apps/com-dailyspark-quotes.png' -> 'com.dailyspark.quotes' (a guess; admin can correct it)
function mt_pkg_guess($icon) {
  if (preg_match('#^assets/apps/((?:com|org|net|io|app|dev)-[a-z0-9_-]+)\.(?:png|webp|jpg)$#i', (string)$icon, $m)) {
    $g = str_replace('-', '.', $m[1]);
    return mt_pkg_ok($g) ? $g : '';
  }
  return '';
}
function mt_app_visible($a) { return empty($a['hid']) && (($a['st'] ?? '') !== 'Draft'); }
function mt_pkg_from_link($s) {
  $s = trim((string)$s);
  if (preg_match('#[?&]id=([A-Za-z0-9._]+)#', $s, $m)) $s = $m[1];
  return mt_pkg_ok($s) ? $s : '';
}
function mt_blurb($t, $n = 300) {
  $t = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$t)));
  if (mb_strlen($t) <= $n) return $t;
  $c = mb_substr($t, 0, $n);
  if (preg_match('/^(.{120,}[.!?])\s/us', $c, $m)) return $m[1];
  $sp = mb_strrpos($c, ' ');
  return rtrim(mb_substr($c, 0, $sp ? $sp : $n), '.,;: ') . '…';
}
// Safely change store.json from background jobs (waits for the admin save lock unless the admin API already holds it).
function mt_store_update($fn) {
  $lk = defined('MT_STORE_LOCKED') ? null : @fopen(MT_DATA . '/.lock', 'c');
  if ($lk) flock($lk, LOCK_EX);
  $s = mt_rj('store.json', []); $ok = false;
  if (isset($s['apps']) && is_array($s['apps']) && $fn($s)) $ok = mt_wj('store.json', $s);
  if ($lk) { flock($lk, LOCK_UN); fclose($lk); }
  return $ok;
}
function mt_play_url($a) {
  if (!empty($a['url'])) return (string)$a['url'];
  if (!empty($a['pkg']) && mt_pkg_ok($a['pkg'])) return 'https://play.google.com/store/apps/details?id=' . rawurlencode($a['pkg']);
  return '';
}

/* ---------- number formatting ---------- */
function mt_n($s) { return (int)preg_replace('/[^0-9]/', '', (string)$s); }
function mt_unshort($s) {
  if (!preg_match('/([0-9][0-9.,]*)\s*([KkMmBb]?)/', (string)$s, $m)) return 0;
  $v = (float)str_replace(',', '', $m[1]);
  $mul = ['' => 1, 'k' => 1e3, 'm' => 1e6, 'b' => 1e9][strtolower($m[2])];
  return (int)round($v * $mul);
}
function mt_short_num($n) {
  $n = (float)$n;
  foreach ([[1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as $u) {
    if ($n >= $u[0]) {
      $v = $n / $u[0];
      $s = number_format($v, $v >= 100 ? 0 : 1, '.', '');
      if (strpos($s, '.') !== false) $s = rtrim(rtrim($s, '0'), '.');
      return $s . $u[1];
    }
  }
  return (string)(int)$n;
}
function mt_installs_label($n) { return $n > 0 ? mt_short_num($n) . '+' : ''; }

/* ---------- site address ---------- */
function mt_base() {
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  $host = preg_replace('/[^A-Za-z0-9.:\-\[\]]/', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost'));
  $dir = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');
  if (substr($dir, -6) === '/meher') $dir = substr($dir, 0, -6);
  return ($https ? 'https' : 'http') . '://' . $host . $dir . '/';
}

/* ---------- outbound HTTP (cURL first, streams as fallback) ---------- */
function mt_http_get($url, $o = []) {
  $ua = $o['ua'] ?? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
  $timeout = (int)($o['timeout'] ?? 12);
  $max = (int)($o['max'] ?? 1500000);
  $hdr = array_merge(['Accept: text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language: en-US,en;q=0.9'], $o['headers'] ?? []);
  $res = ['ok' => false, 'code' => 0, 'body' => '', 'err' => '', 'url' => $url];
  if (!preg_match('#^https?://#i', $url)) { $res['err'] = 'bad url'; return $res; }
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 4,
      CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_USERAGENT => $ua,
      CURLOPT_HTTPHEADER => $hdr, CURLOPT_ENCODING => '',
    ]);
    $body = curl_exec($ch);
    $res['code'] = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) { $res['err'] = $err !== '' ? $err : 'request failed'; return $res; }
    $res['body'] = substr((string)$body, 0, $max);
  } elseif (ini_get('allow_url_fopen')) {
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => $timeout, 'ignore_errors' => true, 'follow_location' => 1, 'max_redirects' => 4, 'user_agent' => $ua, 'header' => implode("\r\n", $hdr)]]);
    $body = @file_get_contents($url, false, $ctx, 0, $max);
    if ($body === false) { $res['err'] = 'request failed (outbound connections may be blocked by the host)'; return $res; }
    $res['body'] = $body;
    if (isset($http_response_header[0]) && preg_match('#\s(\d{3})\s#', $http_response_header[0], $m)) $res['code'] = (int)$m[1];
  } else {
    $res['err'] = 'PHP cURL and allow_url_fopen are both disabled on this host';
    return $res;
  }
  $res['ok'] = $res['code'] >= 200 && $res['code'] < 300;
  if (!$res['ok']) $res['err'] = 'HTTP ' . $res['code'];
  return $res;
}

/* ---------- public app list (shared by data.php, app.php, policy.php, sitemap.php) ---------- */
function mt_public_apps() {
  $s = mt_store();
  $play = mt_rj('play.json', []);
  $out = [];
  foreach ($s['apps'] as $a) {
    if (!is_array($a) || !mt_app_visible($a)) continue;
    $id = (string)($a['id'] ?? '');
    if ($id === '') continue;
    if (!array_key_exists('pkg', $a)) $a['pkg'] = mt_pkg_guess($a['icon'] ?? '');
    $pl = isset($play[$id]) && is_array($play[$id]) ? $play[$id] : [];
    $a['url'] = mt_play_url($a);
    $picon = (string)($pl['icon'] ?? '');
    if ($picon !== '' && (!empty($a['iconp']) || !empty($a['auto']) || empty($a['icon']))) $a['icon'] = $picon;
    if (!empty($a['auto']) && !empty($pl['last_ok'])) {      // "auto" apps take their text from Google Play
      foreach (['title' => 'name', 'ver' => 'ver', 'cat' => 'cat', 'tag' => 'tag', 'feat' => 'feat', 'shots' => 'shots'] as $k => $f) if (!empty($pl[$k])) $a[$f] = $pl[$k];
      if (!empty($pl['desc'])) { $a['long'] = (string)$pl['desc']; $a['desc'] = mt_blurb($pl['desc']); }
    }
    $a['rt'] = round((float)($pl['rt'] ?? 0), 1);
    $a['rc'] = (int)($pl['rc'] ?? 0);
    $a['num'] = (int)($pl['num'] ?? 0);
    $a['ins'] = (string)($pl['ins'] ?? '');
    $a['pol'] = true;      // every app has its own privacy page: GitHub file, or the built-in template
    unset($a['policy'], $a['acct'], $a['iconp'], $a['auto'], $a['ppads'], $a['ppdata'], $a['ppan'], $a['ppx'], $a['ppts']);
    $out[] = $a;
  }
  return $out;
}

/* ---------- sync scheduling (no cron needed: runs lazily on visits, or from a cron URL) ---------- */
function mt_sync_token() {
  $st = mt_rj('sync.json', []);
  if (empty($st['token'])) { $st['token'] = bin2hex(random_bytes(16)); mt_wj('sync.json', $st); }
  return (string)$st['token'];
}
function mt_sync_due($cfg = null, $st = null) {
  $cfg = $cfg ?: mt_cfg();
  $st = $st ?: mt_rj('sync.json', []);
  $now = time();
  if ($now - (int)($st['attempt'] ?? 0) < 600) return false;
  $ttl = $cfg['ttl_h'] * 3600;
  $hasPkg = false; $hasPol = false;
  foreach (mt_store()['apps'] as $a) {
    if (!is_array($a)) continue;
    $pkg = array_key_exists('pkg', $a) ? (string)$a['pkg'] : mt_pkg_guess($a['icon'] ?? '');
    if (mt_pkg_ok($pkg)) $hasPkg = true;
    if (trim((string)($a['policy'] ?? '')) !== '') $hasPol = true;
  }
  if ($hasPkg && $now - (int)($st['play']['ts'] ?? 0) > $ttl) return true;
  if ($hasPol && $now - (int)($st['policy']['ts'] ?? 0) > $ttl) return true;
  return false;
}

/* ---------- app-ads.txt ---------- */
function mt_admob() {
  $a = mt_rj('admob.json', []);
  $acc = [];
  foreach ((array)($a['accounts'] ?? []) as $x) {
    if (!is_array($x)) continue;
    $pub = mt_admob_pub($x['pub'] ?? '');
    if ($pub === '') continue;
    $acc[] = [
      'id' => (string)($x['id'] ?? ('a_' . substr(md5($pub), 0, 8))),
      'label' => mb_substr(trim(strip_tags((string)($x['label'] ?? ''))), 0, 60),
      'pub' => $pub,
      'rel' => (($x['rel'] ?? 'DIRECT') === 'RESELLER') ? 'RESELLER' : 'DIRECT',
      'cert' => preg_match('/^[a-f0-9]{16,32}$/i', (string)($x['cert'] ?? '')) ? strtolower((string)$x['cert']) : 'f08c47fec0942fa0',
      'on' => !empty($x['on']),
    ];
  }
  return ['accounts' => $acc, 'extra' => (string)($a['extra'] ?? ''), 'ts' => (int)($a['ts'] ?? 0)];
}
// Accepts "pub-1234567890123456", "ca-app-pub-1234567890123456~1234567890", or bare 16 digits.
function mt_admob_pub($v) {
  return preg_match('/(?:ca-app-pub-|pub-)?(\d{16})/', (string)$v, $m) ? 'pub-' . $m[1] : '';
}
function mt_ads_line_ok($l) {
  $l = trim($l);
  if ($l === '' || strlen($l) > 300) return false;
  if ($l[0] === '#') return true;
  if (preg_match('/^(CONTACT|SUBDOMAIN|OWNERDOMAIN|MANAGERDOMAIN|INVENTORYPARTNERDOMAIN)\s*=\s*\S{1,200}$/i', $l)) return true;
  return preg_match('/^[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\s*,\s*[A-Za-z0-9._\-]{1,100}\s*,\s*(DIRECT|RESELLER)\s*(,\s*[A-Za-z0-9]{6,64})?\s*(#.*)?$/i', $l) === 1;
}
function mt_admob_text($ad) {
  $L = []; $seen = [];
  $add = function ($l) use (&$L, &$seen) { $k = strtolower(preg_replace('/\s+/', '', $l)); if (!isset($seen[$k])) { $seen[$k] = 1; $L[] = $l; } };
  foreach ($ad['accounts'] as $x) {
    if (empty($x['on'])) continue;
    $add('google.com, ' . $x['pub'] . ', ' . $x['rel'] . ', ' . $x['cert']);
  }
  foreach (preg_split('/\R/', (string)($ad['extra'] ?? '')) as $l) {
    $l = trim($l);
    if ($l !== '' && mt_ads_line_ok($l)) $add($l);
  }
  return $L ? implode("\n", $L) . "\n" : '';
}
// Writes the static file at the site root (served directly by Apache). The PHP route is the fallback.
function mt_admob_publish() {
  $txt = mt_admob_text(mt_admob());
  $ok = @file_put_contents(MT_ROOT . '/app-ads.txt', $txt, LOCK_EX) !== false;
  return [$ok, $txt];
}

/* ---------- HTML shell for server-rendered pages (app pages, privacy pages) ---------- */
function mt_e($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function mt_shell_top($o) {
  $b = $o['base'];
  $t = mt_e($o['title']); $d = mt_e($o['desc'] ?? ''); $can = mt_e($o['canonical'] ?? '');
  echo '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">';
  echo '<base href="' . mt_e($b) . '"><title>' . $t . '</title><meta name="description" content="' . $d . '">';
  if (!empty($o['noindex'])) echo '<meta name="robots" content="noindex,follow">';
  if ($can !== '') echo '<link rel="canonical" href="' . $can . '">';
  echo '<meta property="og:site_name" content="MT Core Studio"><meta property="og:type" content="' . mt_e($o['ogtype'] ?? 'website') . '"><meta property="og:title" content="' . $t . '"><meta property="og:description" content="' . $d . '">';
  if ($can !== '') echo '<meta property="og:url" content="' . $can . '">';
  echo '<meta property="og:image" content="' . mt_e($o['image'] ?? ($b . 'assets/images/icon-512.png')) . '"><meta name="twitter:card" content="summary">';
  echo '<link rel="icon" type="image/svg+xml" href="assets/images/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
  echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"><link rel="stylesheet" href="site.css?v=4">';
  echo $o['head'] ?? '';
  echo '</head><body data-page="' . mt_e($o['page'] ?? 'page') . '"><canvas id="stars"></canvas>';
  echo '<header><div class="w nv"><a class="br" href="./"><img src="assets/images/mt-core-studio-logo-sm.png" alt="MT Core Studio logo" width="60" height="40"><span>MT Core Studio<small>APPS • TOOLS • BETTER TOMORROW</small></span></a>';
  echo '<nav class="lk" id="lk"><a href="./#/home">Home</a><a href="./#/apps">Apps</a><a href="./#/about">About</a><a href="./#/updates">Updates</a><a href="./#/tools">Tools</a><a href="./#/contact">Contact</a></nav>';
  echo '<button class="ib mb" id="mb" aria-label="Menu">☰</button></div></header><main>';
}
function mt_shell_bottom() {
  echo '</main><footer><div class="w fr"><a class="br" href="./"><img src="assets/images/mt-core-studio-logo-sm.png" alt="" width="51" height="34" style="height:34px"><span>MT Core Studio</span></a>';
  echo '<nav><a href="./#/home">Home</a><a href="./#/apps">Apps</a><a href="./#/tools">Tools</a><a href="privacy/">Privacy Policies</a><a href="./#/contact">Contact</a></nav><span>© ' . date('Y') . ' MT Core Studio</span></div></footer>';
  echo '<div id="toast" role="status"></div><script src="core.js?v=4"></script></body></html>';
}

/* ---------- built-in privacy policy (used when no GitHub file is linked) ---------- */
// Returns [markdown, timestamp]. A starting point: it must match what the app really does.
function mt_policy_template($app, $set) {
  $name = (string)($app['name'] ?? 'this app');
  $em = trim((string)($set['em'] ?? ''));
  $ads = array_key_exists('ppads', $app) ? !empty($app['ppads']) : true;
  $data = !empty($app['ppdata']); $an = !empty($app['ppan']);
  $ts = (int)($app['ppts'] ?? 0);
  if ($ts <= 0) $ts = (int)@filemtime(MT_DATA . '/store.json');
  if ($ts <= 0) $ts = time();
  $contact = $em !== '' ? '[' . $em . '](mailto:' . $em . ')' : 'the contact details on our website';
  $m = "MT Core Studio (\"we\", \"us\") built the **$name** Android app (the \"App\"). This policy explains what information the App handles and the choices you have.\n\n## Information we collect\n\n";
  if (!$data && !$an && !$ads) $m .= "The App does not collect, store or share any personal information. Everything you create in the App stays on your device.\n\n";
  else {
    if ($data) $m .= "- **Information you give us**, such as a name, email address or account details, is used only to provide the App's features and support. We do not sell it.\n";
    if ($an) $m .= "- **Usage and diagnostics**: we use analytics and crash-reporting tools to understand how the App is used and to fix problems. They may receive device information (model, Android version, App version) and anonymous usage events.\n";
    if ($ads) $m .= "- **Advertising data**: the App shows ads served by Google AdMob. AdMob may collect and use your device's advertising ID and similar identifiers to show and measure ads.\n";
    $m .= "\n";
  }
  if ($ads) $m .= "## Advertising\n\nThe App displays ads from Google AdMob. You can reset your advertising ID or opt out of personalised ads in your device settings (Settings, Google, Ads). To learn how Google uses data from apps that use its services, see [policies.google.com/technologies/partner-sites](https://policies.google.com/technologies/partner-sites).\n\n";
  $m .= "## Sharing\n\nWe do not sell your personal information. We share data only with the service providers described above, and only to operate the App.\n\n";
  $m .= "## Children\n\nThe App is not directed to children under 13 and we do not knowingly collect personal information from children.\n\n";
  $m .= "## Data retention and deletion\n\nData stored on your device is removed when you uninstall the App. To ask us to delete any data we hold about you, contact $contact.\n\n";
  $m .= "## Security\n\nWe use reasonable measures to protect information, but no method of storage or transmission is completely secure.\n\n";
  $m .= "## Changes\n\nWe may update this policy. The date at the top of this page shows the latest version.\n\n";
  $m .= "## Contact\n\nQuestions about this policy? Contact $contact.\n";
  $x = trim((string)($app['ppx'] ?? ''));
  if ($x !== '') $m .= "\n## Additional information\n\n" . $x . "\n";
  return [$m, $ts];
}
