<?php
// MT Core Studio admin API v2: multi-user, per-permission access, audit trail, CSRF, lockout.
declare(strict_types=1);
ini_set('display_errors', '0');
ob_start();
register_shutdown_function(function () { $e = error_get_last(); if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) { @file_put_contents(__DIR__ . '/_data/error.log', date('c') . ' ' . $e['message'] . ' @' . basename($e['file']) . ':' . $e['line'] . "\n", FILE_APPEND); if (!headers_sent()) { http_response_code(500); header('Content-Type: application/json'); } ob_clean(); echo '{"err":"Server error. Open /meher/check.php to see what is wrong."}'; } });
const DD = __DIR__ . '/_data';
const PERMS = ['apps_edit', 'apps_delete', 'updates', 'settings', 'users', 'audit', 'admob', 'sync', 'analytics', 'subs'];
define('MT_STORE_LOCKED', 1);   // api.php holds the store lock while it runs
require_once dirname(__DIR__) . '/_inc/sync.php';   // shared helpers (Play sync, GitHub policies, app-ads.txt)
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('mtcs_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') ?: '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();
foreach (['Content-Type: application/json; charset=utf-8', 'Cache-Control: no-store', 'X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY', 'X-Robots-Tag: noindex, nofollow'] as $h) header($h);

function out(array $a, int $c = 200): void { http_response_code($c); echo json_encode($a, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function rj(string $f, array $d): array { $p = DD . '/' . $f; if (!is_file($p)) return $d; $j = json_decode((string)file_get_contents($p), true); return is_array($j) ? $j : $d; }
function wj(string $f, array $d): bool { $p = DD . '/' . $f; $t = $p . '.' . bin2hex(random_bytes(4)) . '.tmp'; if (file_put_contents($t, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX) === false) return false; return rename($t, $p); }
function s($v, int $n): string { return mb_substr(trim(strip_tags((string)$v)), 0, $n); }
function u($v): string { $v = trim((string)$v); if ($v === '') return ''; if (preg_match('#^https?://[^\s<>"\']{3,480}$#i', $v) || preg_match('#^assets/[A-Za-z0-9_\-/.]{1,200}$#', $v)) return $v; return ''; }
function pbk(string $pw, array $x): string { return hash_pbkdf2('sha256', $pw, (string)hex2bin($x['salt'] ?? '00'), (int)($x['iter'] ?? 1000), 0, true); }
function setpw(array &$x, string $pw): void { $x['salt'] = bin2hex(random_bytes(16)); $x['iter'] = 210000; $x['hash'] = bin2hex(pbk($pw, $x)); $x['pv'] = ($x['pv'] ?? 0) + 1; }
function users(): array { return rj('users.json', ['users' => []])['users']; }
function putUsers(array $l): bool { return wj('users.json', ['users' => array_values($l)]); }
function has(array $x, string $p): bool { return $x['role'] === 'owner' || in_array($p, $x['perms'] ?? [], true); }
function pub(array $x): array { return ['id' => $x['id'], 'name' => $x['name'], 'email' => $x['emails'][0] ?? '', 'role' => $x['role'], 'perms' => $x['role'] === 'owner' ? PERMS : array_values($x['perms'] ?? []), 'active' => !empty($x['active']), 'last' => $x['last'] ?? 0, 'created' => $x['created'] ?? 0]; }
function mip(): string { $ip = $_SERVER['REMOTE_ADDR'] ?? ''; if (strpos($ip, ':') !== false) return implode(':', array_slice(explode(':', $ip), 0, 3)) . '::'; $p = explode('.', $ip); if (count($p) === 4) $p[3] = 'x'; return implode('.', $p); }
function aud(?array $x, string $a, string $d = ''): void { $l = rj('audit.json', ['l' => []])['l']; array_unshift($l, ['t' => time(), 'u' => $x['name'] ?? '-', 'e' => $x['emails'][0] ?? '', 'a' => $a, 'd' => mb_substr($d, 0, 700), 'ip' => mip()]); wj('audit.json', ['l' => array_slice($l, 0, 1500)]); }
function uaH(): string { return hash('sha256', $_SERVER['HTTP_USER_AGENT'] ?? ''); }
function cur(): ?array {
  if (empty($_SESSION['uid'])) return null;
  foreach (users() as $x) if ($x['id'] === $_SESSION['uid'] && !empty($x['active']) && ($x['pv'] ?? 0) === ($_SESSION['pv'] ?? -1)) return $x;
  return null;
}
function need(bool $post, ?string $perm = null): array {
  $x = cur();
  if (!$x) { session_unset(); out(['err' => 'Not signed in'], 401); }
  if ($post && !hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) out(['err' => 'Security token expired, reload the page'], 403);
  if ($perm && !has($x, $perm)) { aud($x, 'denied', "Tried: $perm"); out(['err' => 'You do not have permission for this.'], 403); }
  return $x;
}
function clean(array $in): array {
  $apps = []; $seen = [];
  foreach (array_slice((array)($in['apps'] ?? []), 0, 100) as $x) {
    if (!is_array($x)) continue;
    $id = substr(preg_replace('/[^a-z0-9\-]/', '', strtolower((string)($x['id'] ?? ''))), 0, 80);
    if ($id === '' || isset($seen[$id])) continue; $seen[$id] = 1;
    $st = in_array($x['st'] ?? '', ['Published', 'Coming Soon', 'Draft'], true) ? $x['st'] : 'Draft';
    $c = array_values(array_filter((array)($x['c'] ?? []), fn($h) => is_string($h) && preg_match('/^#[0-9a-fA-F]{6}$/', $h)));
    $pkg = array_key_exists('pkg', $x) ? s($x['pkg'] ?? '', 150) : mt_pkg_guess((string)($x['icon'] ?? ''));
    if (!mt_pkg_ok($pkg)) $pkg = '';
    $apps[] = ['id' => $id, 'name' => s($x['name'] ?? '', 120), 'cat' => s($x['cat'] ?? '', 40), 'tag' => s($x['tag'] ?? '', 160), 'desc' => s($x['desc'] ?? '', 2000),
      'ver' => s($x['ver'] ?? '', 30), 'st' => $st, 'url' => u($x['url'] ?? ''), 'icon' => u($x['icon'] ?? ''),
      'shots' => array_values(array_filter(array_map('u', array_slice((array)($x['shots'] ?? []), 0, 12)))),
      'hid' => !empty($x['hid']), 'feat' => array_values(array_map(fn($f) => s($f, 80), array_slice((array)($x['feat'] ?? []), 0, 8))),
      'c' => count($c) === 2 ? $c : ['#4facfe', '#a855f7'], 'e' => s($x['e'] ?? '', 8),
      'pkg' => $pkg, 'policy' => s($x['policy'] ?? '', 400), 'acct' => substr(preg_replace('/[^a-zA-Z0-9_]/', '', (string)($x['acct'] ?? '')), 0, 40), 'iconp' => !empty($x['iconp']), 'auto' => !empty($x['auto']),
      'ppads' => array_key_exists('ppads', $x) ? !empty($x['ppads']) : true, 'ppdata' => !empty($x['ppdata']), 'ppan' => !empty($x['ppan']), 'ppx' => s($x['ppx'] ?? '', 3000), 'ppts' => max(0, (int)($x['ppts'] ?? 0))];
  }
  $log = [];
  foreach (array_slice((array)($in['log'] ?? []), 0, 300) as $l) {
    if (!is_array($l)) continue; $d = (string)($l['date'] ?? '');
    $log[] = ['app' => s($l['app'] ?? '', 120), 'ver' => s($l['ver'] ?? '', 30), 'date' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) ? $d : date('Y-m-d'),
      'title' => s($l['title'] ?? '', 160), 'notes' => array_values(array_map(fn($n) => s($n, 300), array_slice((array)($l['notes'] ?? []), 0, 12)))];
  }
  $set = (array)($in['set'] ?? []); $st = [];
  foreach (array_slice((array)($set['s'] ?? []), 0, 4) as $p) $st[] = [s($p[0] ?? '', 40), s($p[1] ?? '', 60)];
  while (count($st) < 4) $st[] = ['', ''];
  $em = trim((string)($set['em'] ?? ''));
  return ['apps' => $apps, 'log' => $log, 'set' => ['s' => $st, 'gp' => u($set['gp'] ?? ''), 'em' => filter_var($em, FILTER_VALIDATE_EMAIL) ? $em : '']];
}
function diff(array $o, array $n): array {
  $r = []; $oa = []; $na = [];
  foreach ($o['apps'] as $x) $oa[$x['id']] = $x; foreach ($n['apps'] as $x) $na[$x['id']] = $x;
  $lab = ['name' => 'name', 'cat' => 'category', 'tag' => 'tagline', 'desc' => 'description', 'ver' => 'version', 'st' => 'status', 'url' => 'store link', 'icon' => 'icon', 'shots' => 'screenshots', 'feat' => 'features', 'pkg' => 'package name', 'policy' => 'privacy policy source', 'acct' => 'AdMob account', 'iconp' => 'icon source', 'auto' => 'auto-sync from Google Play', 'ppads' => 'privacy policy (ads)', 'ppdata' => 'privacy policy (data)', 'ppan' => 'privacy policy (analytics)', 'ppx' => 'privacy policy text'];
  foreach ($na as $id => $x) {
    if (!isset($oa[$id])) { $r[] = ['apps_edit', "Added app '{$x['name']}'"]; continue; }
    $b = $oa[$id];
    foreach ($lab as $k => $l) if ($x[$k] !== $b[$k]) { $e = in_array($k, ['ver', 'st', 'name', 'cat'], true) ? ": '" . mb_substr((string)$b[$k], 0, 40) . "' → '" . mb_substr((string)$x[$k], 0, 40) . "'" : ''; $r[] = ['apps_edit', "{$x['name']}: changed $l$e"]; }
    if ($x['hid'] !== $b['hid']) $r[] = ['apps_edit', "{$x['name']}: " . ($x['hid'] ? 'hidden from website' : 'shown on website')];
  }
  foreach ($oa as $id => $x) if (!isset($na[$id])) $r[] = ['apps_delete', "Deleted app '{$x['name']}'"];
  $k = fn($l) => $l['app'] . '|' . $l['ver'] . '|' . $l['date'] . '|' . $l['title'] . '|' . implode(';', $l['notes']);
  $ol = array_map($k, $o['log']); $nl = array_map($k, $n['log']);
  foreach ($n['log'] as $l) if (!in_array($k($l), $ol, true)) $r[] = ['updates', "Added update {$l['app']} {$l['ver']}"];
  foreach ($o['log'] as $l) if (!in_array($k($l), $nl, true)) $r[] = ['updates', "Removed update {$l['app']} {$l['ver']}"];
  if ($o['set']['s'] !== $n['set']['s']) $r[] = ['settings', 'Changed website stats'];
  if ($o['set']['gp'] !== $n['set']['gp']) $r[] = ['settings', 'Changed Google Play developer link'];
  if ($o['set']['em'] !== $n['set']['em']) $r[] = ['settings', 'Changed contact email'];
  return $r;
}

$a = $_GET['a'] ?? '';
$in = json_decode((string)file_get_contents('php://input'), true); if (!is_array($in)) $in = [];
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($post) {
  $o = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($o !== '' && parse_url($o, PHP_URL_HOST) !== explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]) out(['err' => 'Bad origin'], 403);
  $lk = fopen(DD . '/.lock', 'c'); if ($lk) flock($lk, LOCK_EX);
}
if (isset($_SESSION['uid'])) {
  if (time() - (int)($_SESSION['t'] ?? 0) > 7200 || time() - (int)($_SESSION['b'] ?? 0) > 43200 || ($_SESSION['ua'] ?? '') !== uaH()) { session_unset(); session_destroy(); session_start(); }
  else $_SESSION['t'] = time();
}

if ($a === 'me') { $x = cur(); out(['auth' => (bool)$x, 'csrf' => $x ? ($_SESSION['csrf'] ?? '') : '', 'user' => $x ? pub($x) : null]); }

if ($a === 'login' && $post) {
  $now = time(); $email = strtolower(trim((string)($in['email'] ?? ''))); $pw = substr((string)($in['password'] ?? ''), 0, 200);
  $k1 = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? ''); $k2 = 'e' . hash('sha256', $email);
  $th = rj('throttle.json', []);
  foreach ($th as $k => $v) if (($v['until'] ?? 0) < $now && ($v['t'] ?? 0) < $now - 3600) unset($th[$k]);
  if (($th[$k1]['until'] ?? 0) > $now || ($th[$k2]['until'] ?? 0) > $now) out(['err' => 'Too many attempts. Try again in 15 minutes.'], 429);
  $found = null; foreach (users() as $x) if (in_array($email, $x['emails'] ?? [], true)) $found = $x;
  $dummy = ['salt' => str_repeat('ab', 16), 'iter' => 210000];
  $calc = pbk($pw, $found ?? $dummy);
  $ok = $found && !empty($found['active']) && hash_equals((string)hex2bin($found['hash']), $calc);
  if (!$ok) {
    foreach ([$k1, $k2] as $k) { $n = ($th[$k]['n'] ?? 0) + 1; $th[$k] = ['n' => $n, 't' => $now, 'until' => 0]; if ($n >= 5) $th[$k] = ['n' => 0, 't' => $now, 'until' => $now + 900]; }
    wj('throttle.json', $th); aud($found, 'login_failed', 'Email tried: ' . mb_substr(strip_tags($email), 0, 80)); usleep(600000);
    out(['err' => 'Wrong email or password.'], 401);
  }
  unset($th[$k1], $th[$k2]); wj('throttle.json', $th);
  session_regenerate_id(true);
  $_SESSION = ['uid' => $found['id'], 'pv' => $found['pv'] ?? 0, 't' => $now, 'b' => $now, 'ua' => uaH(), 'csrf' => bin2hex(random_bytes(32))];
  $l = users(); foreach ($l as &$x) if ($x['id'] === $found['id']) $x['last'] = $now; unset($x); putUsers($l);
  aud($found, 'login', 'Signed in');
  out(['ok' => 1, 'csrf' => $_SESSION['csrf']]);
}
if ($a === 'logout' && $post) { $x = need(true); aud($x, 'logout'); session_unset(); session_destroy(); out(['ok' => 1]); }
if ($a === 'ping') { need(false); out(['ok' => 1, 'time' => time(), 'writable' => is_writable(DD), 'https' => $https]); }
function syncInfo(): array {
  $st = rj('sync.json', []); unset($st['token']);
  $pol = [];
  foreach (glob(DD . '/policies/*.json') ?: [] as $f) { $r = rj('policies/' . basename($f), []); $pol[basename($f, '.json')] = ['st' => $r['st'] ?? '', 'msg' => $r['msg'] ?? '', 'ts' => $r['ts'] ?? 0, 'changed' => $r['changed'] ?? 0, 'web' => $r['web'] ?? '']; }
  return ['state' => $st, 'play' => rj('play.json', []), 'policy' => $pol];
}
function adminBase(): string { return mt_base(); }
if ($a === 'load') { $x = need(false); out(['store' => clean(rj('store.json', ['apps' => [], 'log' => [], 'set' => []])), 'user' => pub($x), 'sync' => syncInfo()]); }

if ($a === 'save' && $post) {
  $x = need(true);
  $old = clean(rj('store.json', ['apps' => [], 'log' => [], 'set' => []])); $new = clean($in);
  $d = diff($old, $new);
  $miss = []; foreach ($d as [$p, $t]) if (!has($x, $p)) $miss[$p] = 1;
  if ($miss) { aud($x, 'denied', 'Blocked change needing: ' . implode(', ', array_keys($miss))); out(['err' => 'You do not have permission for: ' . implode(', ', array_keys($miss))], 403); }
  if (!$d) out(['ok' => 1, 'store' => $new, 'same' => 1]);
  if (!wj('store.json', $new)) out(['err' => 'Could not write data (check folder permissions).'], 500);
  aud($x, 'change', implode(' | ', array_map(fn($z) => $z[1], $d)));
  out(['ok' => 1, 'store' => $new]);
}

if ($a === 'passwd' && $post) {
  $x = need(true); $cur = substr((string)($in['current'] ?? ''), 0, 200); $new = (string)($in['new'] ?? '');
  if (!hash_equals((string)hex2bin($x['hash'] ?? ''), pbk($cur, $x))) { usleep(600000); out(['err' => 'Current password is wrong.'], 401); }
  if (mb_strlen($new) < 10 || mb_strlen($new) > 200 || in_array(strtolower($new), $x['emails'], true)) out(['err' => 'New password must be 10 to 200 characters and not your email.'], 400);
  $l = users(); foreach ($l as &$y) if ($y['id'] === $x['id']) { setpw($y, $new); $_SESSION['pv'] = $y['pv']; } unset($y);
  putUsers($l); aud($x, 'password', 'Changed own password'); session_regenerate_id(true); out(['ok' => 1]);
}

if ($a === 'users') { $x = need(false, 'users'); out(['users' => array_map('pub', users())]); }
if ($a === 'user_save' && $post) {
  $me = need(true, 'users');
  $id = (string)($in['id'] ?? ''); $name = s($in['name'] ?? '', 60); $em = strtolower(trim((string)($in['email'] ?? '')));
  $role = in_array($in['role'] ?? '', ['admin', 'editor', 'viewer'], true) ? $in['role'] : 'viewer';
  $perms = array_values(array_filter(PERMS, fn($p) => in_array($p, (array)($in['perms'] ?? []), true) && has($me, $p) && ($p !== 'users' || $me['role'] === 'owner')));
  $pw = (string)($in['password'] ?? '');
  if ($name === '' || !filter_var($em, FILTER_VALIDATE_EMAIL)) out(['err' => 'Enter a name and a valid email.'], 400);
  if ($pw !== '' && (mb_strlen($pw) < 10 || mb_strlen($pw) > 200)) out(['err' => 'Password must be 10 to 200 characters.'], 400);
  $l = users();
  foreach ($l as $y) if ($y['id'] !== $id && in_array($em, $y['emails'], true)) out(['err' => 'That email already has an account.'], 400);
  if ($id === '') {
    if ($pw === '') out(['err' => 'Set a password for the new account.'], 400);
    $y = ['id' => 'u_' . bin2hex(random_bytes(6)), 'name' => $name, 'emails' => [$em], 'role' => $role, 'perms' => $perms, 'active' => !empty($in['active']), 'created' => time(), 'last' => 0, 'pv' => 0];
    setpw($y, $pw); $l[] = $y; aud($me, 'user_create', "Created $name <$em> ($role: " . implode(',', $perms) . ')');
  } else {
    $f = false;
    foreach ($l as &$y) if ($y['id'] === $id) {
      $f = true;
      if ($y['role'] === 'owner' || $y['id'] === $me['id']) out(['err' => 'The owner and your own account cannot be edited here.'], 403);
      $ch = []; if ($y['name'] !== $name) $ch[] = 'name'; if (($y['emails'][0] ?? '') !== $em) $ch[] = 'email'; if ($y['role'] !== $role) $ch[] = "role→$role";
      if (array_values($y['perms'] ?? []) !== $perms) $ch[] = 'permissions→' . (implode(',', $perms) ?: 'none'); if (empty($y['active']) !== empty($in['active'])) $ch[] = !empty($in['active']) ? 'activated' : 'deactivated';
      $y['name'] = $name; $y['emails'] = [$em]; $y['role'] = $role; $y['perms'] = $perms; $y['active'] = !empty($in['active']);
      if ($pw !== '') { setpw($y, $pw); $ch[] = 'password reset'; }
      aud($me, 'user_update', "$name <$em>: " . ($ch ? implode(', ', $ch) : 'no change'));
    } unset($y);
    if (!$f) out(['err' => 'User not found'], 404);
  }
  if (!putUsers($l)) out(['err' => 'Could not save users.'], 500);
  out(['ok' => 1, 'users' => array_map('pub', $l)]);
}
if ($a === 'user_delete' && $post) {
  $me = need(true, 'users'); $id = (string)($in['id'] ?? ''); $l = users(); $t = null;
  foreach ($l as $y) if ($y['id'] === $id) $t = $y;
  if (!$t) out(['err' => 'User not found'], 404);
  if ($t['role'] === 'owner' || $t['id'] === $me['id']) out(['err' => 'The owner and your own account cannot be deleted.'], 403);
  putUsers(array_filter($l, fn($y) => $y['id'] !== $id)); aud($me, 'user_delete', "Deleted {$t['name']} <" . ($t['emails'][0] ?? '') . '>');
  out(['ok' => 1, 'users' => array_map('pub', users())]);
}
if ($a === 'audit') { need(false, 'audit'); out(['log' => array_slice(rj('audit.json', ['l' => []])['l'], 0, 400)]); }

/* ---------------- v3: integrations, AdMob hub, analytics, subscribers ---------------- */
if ($a === 'status') {
  need(false);
  $ad = mt_admob(); $on = 0; foreach ($ad['accounts'] as $y) if (!empty($y['on'])) $on++;
  $an = rj('analytics.json', ['days' => []])['days']; $v7 = 0; $c7 = 0;
  for ($i = 0; $i < 7; $i++) { $d = $an[gmdate('Y-m-d', time() - $i * 86400)] ?? null; if (is_array($d)) { $v7 += (int)($d['v'] ?? 0); $c7 += (int)($d['c'] ?? 0); } }
  $si = syncInfo();
  out(['sync' => $si['state'], 'admob' => ['n' => count($ad['accounts']), 'on' => $on, 'ts' => $ad['ts'], 'file' => is_file(MT_ROOT . '/app-ads.txt')], 'subs' => count(rj('subs.json', ['subs' => []])['subs'] ?? []), 'an' => ['v7' => $v7, 'c7' => $c7]]);
}
if ($a === 'cfg') {
  need(false, 'sync'); $cfg = mt_cfg(); $tok = mt_sync_token();
  out(['cfg' => $cfg, 'sync' => syncInfo(), 'cron' => adminBase() . 'sync.php?token=' . $tok, 'env' => ['curl' => function_exists('curl_init'), 'fopen' => (bool)ini_get('allow_url_fopen'), 'icons' => is_writable(MT_ROOT . '/assets/apps'), 'root' => is_writable(MT_ROOT)]]);
}
if ($a === 'cfg_save' && $post) {
  $x = need(true, 'sync');
  $proxy = trim((string)($in['proxy'] ?? ''));
  if ($proxy !== '' && (!preg_match('#^https://[^\s<>"\']{4,400}$#i', $proxy) || strpos($proxy, '{id}') === false)) out(['err' => 'Proxy URL must start with https:// and contain {id} where the package name goes.'], 400);
  $ttl = max(1, min(72, (int)($in['ttl_h'] ?? 6)));
  if (!mt_wj('config.json', ['proxy' => $proxy, 'ttl_h' => $ttl])) out(['err' => 'Could not save settings.'], 500);
  aud($x, 'sync_settings', 'Refresh every ' . $ttl . 'h, proxy ' . ($proxy !== '' ? 'on' : 'off'));
  out(['ok' => 1, 'cfg' => mt_cfg()]);
}
if ($a === 'sync' && $post) {
  $x = need(true, 'sync');
  $what = in_array($in['what'] ?? 'all', ['all', 'play', 'policy'], true) ? (string)($in['what'] ?? 'all') : 'all';
  $only = substr(preg_replace('/[^a-z0-9\-]/', '', strtolower((string)($in['id'] ?? ''))), 0, 80);
  $res = mt_sync_all($what, $only);
  $st = rj('sync.json', []); $st['attempt'] = time(); wj('sync.json', $st);
  aud($x, 'sync', "Manual sync: $what" . ($only !== '' ? " ($only)" : ''));
  $res['info'] = syncInfo();
  out(['ok' => 1, 'res' => $res, 'store' => clean(rj('store.json', ['apps' => [], 'log' => [], 'set' => []]))]);
}
if ($a === 'play_import' && $post) {
  $x = need(true, 'apps_edit');
  if (!has($x, 'sync')) out(['err' => 'You need the "Google Play sync" permission to import apps.'], 403);
  $pkg = mt_pkg_from_link((string)($in['link'] ?? ''));
  if ($pkg === '') out(['err' => 'That does not look like a Google Play link. Example: https://play.google.com/store/apps/details?id=com.studio.app'], 400);
  $st = clean(rj('store.json', ['apps' => [], 'log' => [], 'set' => []]));
  foreach ($st['apps'] as $y) if (($y['pkg'] ?? '') === $pkg) out(['err' => 'This app is already in your list: ' . $y['name'], 'id' => $y['id']], 409);
  if (count($st['apps']) >= 100) out(['err' => 'App limit reached.'], 400);
  $tmp = substr(preg_replace('/[^a-z0-9]+/', '-', strtolower($pkg)), 0, 60);
  $rec = mt_play_sync_app(['id' => $tmp, 'pkg' => $pkg], mt_cfg(), null);
  if (($rec['st'] ?? '') !== 'ok') out(['err' => (string)($rec['msg'] ?? 'Could not read the Google Play page.')], 422);
  $name = (string)($rec['title'] ?? '') !== '' ? (string)$rec['title'] : $pkg;
  $id = substr(trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($name)), '-'), 0, 60); if ($id === '') $id = $tmp;
  $ids = array_column($st['apps'], 'id'); $base = $id; $n = 2; while (in_array($id, $ids, true)) { $id = $base . '-' . $n++; }
  if (!empty($rec['icon']) && preg_match('#^assets/apps/play-' . preg_quote($tmp, '#') . '\.(png|jpg|webp)(\?v=\w+)?$#', (string)$rec['icon'], $mm) && @rename(MT_ROOT . '/assets/apps/play-' . $tmp . '.' . $mm[1], MT_ROOT . '/assets/apps/play-' . $id . '.' . $mm[1]))
    $rec['icon'] = 'assets/apps/play-' . $id . '.' . $mm[1] . ($mm[2] ?? '');
  $st['apps'][] = ['id' => $id, 'name' => $name, 'cat' => (string)($rec['cat'] ?? 'Utility'), 'tag' => (string)($rec['tag'] ?? ''), 'desc' => mt_blurb($rec['desc'] ?? ''),
    'ver' => (string)($rec['ver'] ?? '') !== '' ? (string)$rec['ver'] : 'v1.0.0', 'st' => 'Published', 'url' => '', 'icon' => '', 'shots' => [], 'hid' => false,
    'feat' => (array)($rec['feat'] ?? []), 'c' => ['#4facfe', '#a855f7'], 'e' => '', 'pkg' => $pkg, 'policy' => '', 'acct' => '', 'iconp' => true, 'auto' => true, 'ppads' => true, 'ppdata' => false, 'ppan' => false, 'ppx' => '', 'ppts' => time()];
  $st = clean($st);
  if (!wj('store.json', $st)) out(['err' => 'Could not write data (check folder permissions).'], 500);
  $play = mt_rj('play.json', []); $play[$id] = $rec; mt_wj('play.json', $play);
  aud($x, 'change', 'Imported app from Google Play: ' . $name . ' (' . $pkg . ')');
  out(['ok' => 1, 'id' => $id, 'store' => $st, 'info' => syncInfo()]);
}
if ($a === 'admob') { need(false, 'admob'); $ad = mt_admob(); out(['ad' => $ad, 'text' => mt_admob_text($ad), 'file' => is_file(MT_ROOT . '/app-ads.txt'), 'url' => adminBase() . 'app-ads.txt']); }
if ($a === 'admob_save' && $post) {
  $x = need(true, 'admob');
  $old = mt_admob(); $acc = []; $seen = [];
  foreach (array_slice((array)($in['accounts'] ?? []), 0, 25) as $y) {
    if (!is_array($y)) continue;
    $pub = mt_admob_pub($y['pub'] ?? '');
    if ($pub === '' || isset($seen[$pub])) continue; $seen[$pub] = 1;
    $id = preg_replace('/[^a-zA-Z0-9_]/', '', (string)($y['id'] ?? '')); if ($id === '') $id = 'a_' . bin2hex(random_bytes(4));
    $acc[] = ['id' => substr($id, 0, 40), 'label' => s($y['label'] ?? '', 60), 'pub' => $pub, 'rel' => (($y['rel'] ?? '') === 'RESELLER') ? 'RESELLER' : 'DIRECT',
      'cert' => preg_match('/^[a-f0-9]{16,32}$/i', (string)($y['cert'] ?? '')) ? strtolower((string)$y['cert']) : 'f08c47fec0942fa0', 'on' => !empty($y['on'])];
  }
  $extra = mb_substr(str_replace("\r", '', (string)($in['extra'] ?? '')), 0, 6000); $bad = [];
  foreach (explode("\n", $extra) as $l) if (trim($l) !== '' && !mt_ads_line_ok($l)) $bad[] = mb_substr(trim($l), 0, 80);
  if (!mt_wj('admob.json', ['accounts' => $acc, 'extra' => $extra, 'ts' => time()])) out(['err' => 'Could not save (check folder permissions).'], 500);
  [$okf, $txt] = mt_admob_publish();
  $op = array_column($old['accounts'], 'pub'); $np = array_column($acc, 'pub');
  $ch = []; foreach (array_diff($np, $op) as $p) $ch[] = "added $p"; foreach (array_diff($op, $np) as $p) $ch[] = "removed $p";
  aud($x, 'admob', 'app-ads.txt updated: ' . ($ch ? implode(', ', $ch) : 'settings changed') . ' (' . count($acc) . ' accounts)');
  out(['ok' => 1, 'ad' => mt_admob(), 'text' => $txt, 'file' => $okf, 'bad' => $bad]);
}
if ($a === 'admob_check' && $post) {
  need(true, 'admob'); $url = adminBase() . 'app-ads.txt';
  $r = mt_http_get($url . '?c=' . time(), ['timeout' => 8, 'headers' => ['Accept: text/plain']]);
  $norm = fn($t) => trim(preg_replace('/\s+/', ' ', (string)$t));
  out(['ok' => $r['ok'], 'code' => $r['code'], 'err' => $r['err'], 'match' => $r['ok'] && $norm($r['body']) === $norm(mt_admob_text(mt_admob())), 'url' => $url]);
}
if ($a === 'analytics') {
  need(false, 'analytics'); $n = max(1, min(400, (int)($_GET['days'] ?? 30)));
  $all = rj('analytics.json', ['days' => []])['days']; $o = [];
  for ($i = $n - 1; $i >= 0; $i--) { $k = gmdate('Y-m-d', time() - $i * 86400); $o[$k] = isset($all[$k]) && is_array($all[$k]) ? $all[$k] : new stdClass(); }
  out(['days' => $o]);
}
if ($a === 'subs') { need(false, 'subs'); $l = rj('subs.json', ['subs' => []])['subs']; usort($l, fn($p, $q) => ($q['t'] ?? 0) <=> ($p['t'] ?? 0)); out(['subs' => array_slice($l, 0, 5000)]); }
if ($a === 'subs_delete' && $post) {
  $x = need(true, 'subs'); $em = strtolower(trim((string)($in['email'] ?? '')));
  $lk2 = mt_lock('subs'); $db = rj('subs.json', ['subs' => []]); $n0 = count($db['subs']);
  $db['subs'] = array_values(array_filter($db['subs'], fn($y) => ($y['e'] ?? '') !== $em));
  $okw = mt_wj('subs.json', $db); mt_unlock($lk2);
  if (!$okw) out(['err' => 'Could not save.'], 500);
  aud($x, 'subs_delete', 'Removed 1 subscriber'); out(['ok' => 1, 'removed' => $n0 - count($db['subs'])]);
}
out(['err' => 'Not found'], 404);
