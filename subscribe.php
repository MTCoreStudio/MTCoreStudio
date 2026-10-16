<?php
// Newsletter / "notify me when it launches" signups. Stores only the email, the apps of interest and a timestamp.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function done($a, $c = 200) { http_response_code($c); echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') done(['err' => 'POST only'], 405);
$o = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($o !== '' && parse_url($o, PHP_URL_HOST) !== explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0]) done(['err' => 'Bad origin'], 403);
require __DIR__ . '/_inc/lib.php';

$j = json_decode((string)file_get_contents('php://input', false, null, 0, 2048), true);
if (!is_array($j)) done(['err' => 'Bad request'], 400);
if (!empty($j['hp'])) done(['ok' => 1]);                       // honeypot: bots fill this, humans never see it
$em = strtolower(trim((string)($j['email'] ?? '')));
if (strlen($em) > 120 || !filter_var($em, FILTER_VALIDATE_EMAIL)) done(['err' => 'Please enter a valid email address.'], 400);
$app = substr(preg_replace('/[^a-z0-9\-]/', '', strtolower((string)($j['app'] ?? ''))), 0, 80);
$src = substr(preg_replace('/[^a-z0-9\-]/', '', strtolower((string)($j['src'] ?? 'site'))), 0, 20);

$lk = mt_lock('subs');
if (!$lk) done(['err' => 'Busy, please try again.'], 503);
$hr = gmdate('YmdH');
$rl = mt_rj('sub-rate.json', []);
if (($rl['t'] ?? '') !== $hr) $rl = ['t' => $hr, 'c' => []];
$k = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . $hr), 0, 16);
if ((int)($rl['c'][$k] ?? 0) >= 5) { mt_unlock($lk); done(['err' => 'Too many attempts. Please try again later.'], 429); }
$rl['c'][$k] = (int)($rl['c'][$k] ?? 0) + 1;
mt_wj('sub-rate.json', $rl, false);

$db = mt_rj('subs.json', ['subs' => []]);
if (!isset($db['subs']) || !is_array($db['subs'])) $db['subs'] = [];
$found = false;
foreach ($db['subs'] as &$x) {
  if (($x['e'] ?? '') === $em) {
    $found = true;
    if ($app !== '' && !in_array($app, (array)($x['a'] ?? []), true)) $x['a'][] = $app;
  }
}
unset($x);
if (!$found) {
  if (count($db['subs']) >= 20000) { mt_unlock($lk); done(['err' => 'Signups are temporarily closed.'], 503); }
  $db['subs'][] = ['e' => $em, 't' => time(), 'a' => $app !== '' ? [$app] : [], 's' => $src];
}
$ok = mt_wj('subs.json', $db);
mt_unlock($lk);
if (!$ok) done(['err' => 'Could not save. Please try again.'], 500);
done(['ok' => 1, 'new' => !$found]);
