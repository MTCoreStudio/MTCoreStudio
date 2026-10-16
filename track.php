<?php
// Privacy-friendly analytics beacon.
//  - No cookies, no IP address stored, honours Do-Not-Track / Global Privacy Control.
//  - "Unique visitor" = a hash of (IP + browser + a random salt that is replaced every day); the hashes are discarded daily.
//  - Country comes from the CDN header if present, otherwise from the visitor's timezone (no IP lookup, no third party).
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function quit($c = 204) { http_response_code($c); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') quit(405);
if (($_SERVER['HTTP_DNT'] ?? '') === '1' || ($_SERVER['HTTP_SEC_GPC'] ?? '') === '1') quit();
$ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|httpclient|axios|node-fetch|go-http/i', $ua)) quit();
$o = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($o !== '' && parse_url($o, PHP_URL_HOST) !== explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0]) quit(403);
require __DIR__ . '/_inc/lib.php';

$j = json_decode((string)file_get_contents('php://input', false, null, 0, 2048), true);
if (!is_array($j)) quit();
$e = (string)($j['e'] ?? '');
if (!in_array($e, ['v', 'c', 'n'], true)) quit();
$clean = function ($v, $n, $re) { return substr(preg_replace($re, '', strtolower((string)$v)), 0, $n); };
$pg = $clean($j['p'] ?? 'home', 40, '/[^a-z0-9:_\-]/');
$app = $clean($j['a'] ?? '', 80, '/[^a-z0-9\-]/');
$loc = $clean($j['l'] ?? '', 20, '/[^a-z0-9\-]/');
$ref = strtolower(trim((string)($j['r'] ?? '')));
$ref = preg_match('/^[a-z0-9.\-]{3,60}$/', $ref) ? preg_replace('/^www\./', '', $ref) : '';
$tz = (string)($j['z'] ?? '');
if ($pg === '') $pg = 'home';

$cc = strtoupper((string)($_SERVER['HTTP_CF_IPCOUNTRY'] ?? ''));
if (!preg_match('/^[A-Z]{2}$/', $cc) || $cc === 'XX' || $cc === 'T1') {
  $cc = '';
  if ($tz !== '' && strlen($tz) < 60) { $map = include __DIR__ . '/_inc/tz.php'; $cc = (string)($map[$tz] ?? ''); }
}
if ($cc === '') $cc = 'ZZ';

$lk = mt_lock('an');
if (!$lk) quit();
$day = gmdate('Y-m-d');
$u = mt_rj('an-uniq.json', []);
if (($u['d'] ?? '') !== $day) $u = ['d' => $day, 's' => bin2hex(random_bytes(16)), 'h' => []];
$hid = substr(hash('sha256', $u['s'] . ($_SERVER['REMOTE_ADDR'] ?? '') . $ua), 0, 12);
$cnt = (int)($u['h'][$hid] ?? 0);
if ($cnt >= 400 || count($u['h']) > 30000) { mt_unlock($lk); quit(); }   // flood guard
$new = !isset($u['h'][$hid]);
$u['h'][$hid] = $cnt + 1;
mt_wj('an-uniq.json', $u, false);

$A = mt_rj('analytics.json', ['days' => []]);
if (!isset($A['days']) || !is_array($A['days'])) $A['days'] = [];
$d = isset($A['days'][$day]) && is_array($A['days'][$day]) ? $A['days'][$day] : [];
$d += ['v' => 0, 'u' => 0, 'c' => 0, 'n' => 0, 'pg' => [], 'ap' => [], 'cc' => [], 'rf' => [], 'cl' => []];
$bump = function (&$arr, $k, $cap) { if (isset($arr[$k])) $arr[$k]++; elseif (count($arr) < $cap) $arr[$k] = 1; };
if (!isset($d['cc'][$cc])) $d['cc'][$cc] = ['v' => 0, 'u' => 0, 'c' => 0];
if ($new) { $d['u']++; $d['cc'][$cc]['u']++; }
if ($e === 'v') {
  $d['v']++; $d['cc'][$cc]['v']++;
  $bump($d['pg'], $pg, 60);
  if ($ref !== '') $bump($d['rf'], $ref, 60);
  if ($app !== '') { if (!isset($d['ap'][$app])) $d['ap'][$app] = ['v' => 0, 'c' => 0]; $d['ap'][$app]['v']++; }
} elseif ($e === 'c') {
  $d['c']++; $d['cc'][$cc]['c']++;
  if ($app !== '') { if (!isset($d['ap'][$app])) $d['ap'][$app] = ['v' => 0, 'c' => 0]; $d['ap'][$app]['c']++; }
  if ($loc !== '') $bump($d['cl'], $loc, 20);
} else {
  $d['n']++;
}
$A['days'][$day] = $d;
$cut = gmdate('Y-m-d', time() - 400 * 86400);
foreach (array_keys($A['days']) as $k) if ($k < $cut) unset($A['days'][$k]);
mt_wj('analytics.json', $A, false);
mt_unlock($lk);
quit();
