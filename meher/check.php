<?php
// Setup check for the admin. Open /meher/check.php once, then click "Delete this page".
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
if (($_GET['remove'] ?? '') === '1') { @unlink(__FILE__); echo 'Deleted. You can close this page.'; exit; }
$D = __DIR__ . '/_data';
$ok = function ($v) { return $v ? '<b style="color:#10b981">OK</b>' : '<b style="color:#ef4444">PROBLEM</b>'; };
session_start(); $_SESSION['t'] = 1; $sess = isset($_SESSION['t']);
$rows = [
 ['PHP version (needs 7.4 or newer)', PHP_VERSION, version_compare(PHP_VERSION, '7.4', '>=')],
 ['mbstring extension', extension_loaded('mbstring') ? 'loaded' : 'missing', extension_loaded('mbstring')],
 ['hash_pbkdf2 (password check)', function_exists('hash_pbkdf2') ? 'available' : 'missing', function_exists('hash_pbkdf2')],
 ['Sessions work', $sess ? 'yes' : 'no', $sess],
 ['_data folder exists', is_dir($D) ? 'yes' : 'no', is_dir($D)],
 ['_data folder writable', is_writable($D) ? 'yes' : 'no - set permissions to 755 or 775', is_writable($D)],
 ['users.json readable', is_readable($D . '/users.json') ? 'yes' : 'no', is_readable($D . '/users.json')],
 ['store.json readable', is_readable($D . '/store.json') ? 'yes' : 'no', is_readable($D . '/store.json')],
 ['HTTPS', (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'yes' : 'no (admin still works, HTTPS is safer)', true],
];
// --- v4 additions: Play / GitHub sync, app-ads.txt, analytics ---
$root = dirname(__DIR__);
$rows[] = ['PHP cURL (needed for Google Play + GitHub sync)', function_exists('curl_init') ? 'available' : 'missing (falls back to allow_url_fopen)', function_exists('curl_init') || (bool)ini_get('allow_url_fopen')];
$rows[] = ['Shared code folder _inc/ present', is_file($root . '/_inc/lib.php') ? 'yes' : 'no - upload the _inc folder', is_file($root . '/_inc/lib.php')];
$rows[] = ['Site root writable (static app-ads.txt)', is_writable($root) ? 'yes' : 'no - app-ads.txt will be served by PHP instead (still works)', true];
$rows[] = ['assets/apps writable (cached Play icons)', is_writable($root . '/assets/apps') ? 'yes' : 'no - Play icons will be hot-linked instead (still works)', true];
$rows[] = ['Can create sub-folders in _data (policies, analytics)', (is_dir($D . '/policies') || @mkdir($D . '/policies', 0755, true)) ? 'yes' : 'no - set _data to 755/775', is_dir($D . '/policies')];
if (is_file($root . '/_inc/lib.php') && ($_GET['net'] ?? '') === '1') {
  require_once $root . '/_inc/lib.php';
  foreach ([['Outbound: Google Play', 'https://play.google.com/store/apps/details?id=com.google.android.apps.maps&hl=en'], ['Outbound: GitHub raw', 'https://raw.githubusercontent.com/github/gitignore/main/README.md']] as $t) {
    $r = mt_http_get($t[1], ['timeout' => 8, 'max' => 20000]);
    $rows[] = [$t[0], $r['ok'] ? 'reachable (HTTP ' . $r['code'] . ')' : 'FAILED: ' . $r['err'] . ' - see the proxy option in Admin > Integrations', $r['ok']];
  }
} else { $rows[] = ['Outbound connection test', 'not run - <a style="color:#4facfe" href="?net=1">click to test Google Play + GitHub</a>', true]; }
$u = is_readable($D . '/users.json') ? json_decode(file_get_contents($D . '/users.json'), true) : null;
$hashOk = false; if (is_array($u) && isset($u['users'][0]['salt'])) { $x = $u['users'][0]; $hashOk = function_exists('hash_pbkdf2') && strlen(hash_pbkdf2('sha256', 'test', hex2bin($x['salt']), (int)$x['iter'], 0, true)) === 32; }
$rows[] = ['Password hashing test', $hashOk ? 'works' : 'failed', $hashOk];
$err = is_readable($D . '/error.log') ? trim(substr((string)file_get_contents($D . '/error.log'), -800)) : '';
?><!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin setup check</title>
<body style="font:15px/1.6 system-ui,sans-serif;background:#050a16;color:#e8eefc;max-width:680px;margin:30px auto;padding:0 18px">
<h2>MT Core Studio - admin setup check</h2>
<table style="width:100%;border-collapse:collapse"><?php foreach ($rows as $r): ?><tr style="border-bottom:1px solid #243656"><td style="padding:9px 0"><?= htmlspecialchars($r[0]) ?></td><td><?= strpos((string)$r[1], '<a ') !== false ? $r[1] : htmlspecialchars((string)$r[1]) ?></td><td style="text-align:right"><?= $ok($r[2]) ?></td></tr><?php endforeach; ?></table>
<?php if ($err): ?><h3>Last server error</h3><pre style="white-space:pre-wrap;background:#0a1122;padding:12px;border-radius:10px"><?= htmlspecialchars($err) ?></pre><?php endif; ?>
<p>If everything says OK, go to <a style="color:#4facfe" href="./">the admin login</a>. Send me a screenshot of this page if something shows PROBLEM.</p>
<p><a style="color:#f0647f" href="?remove=1">Delete this page</a> (do this when finished).</p>