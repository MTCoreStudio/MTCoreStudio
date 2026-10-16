<?php
// Keeps Google Play numbers and GitHub policies fresh without a cron job.
//  - ?lazy=1            : called quietly by the website; only runs when data is older than the TTL (default 6h).
//  - ?token=SECRET      : call from cron-job.org (or a GitHub webhook) to force a refresh. Add &what=play or &what=policy.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
require __DIR__ . '/_inc/lib.php';

function done($a, $c = 200) {
  $b = json_encode($a);
  http_response_code($c);
  header('Content-Length: ' . strlen($b)); header('Connection: close');
  echo $b;
  while (ob_get_level() > 0) @ob_end_flush();
  flush();
  if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
}

$cfg = mt_cfg();
$st = mt_rj('sync.json', []);
$tok = (string)($_GET['token'] ?? '');
$cron = $tok !== '' && !empty($st['token']) && hash_equals((string)$st['token'], $tok);
if (!$cron) {
  if (($_GET['lazy'] ?? '') !== '1') { done(['err' => 'forbidden'], 403); exit; }
  if (!mt_sync_due($cfg, $st)) { done(['ran' => false]); exit; }
}
ignore_user_abort(true);
$lk = mt_lock('sync', false);
if (!$lk) { done(['ran' => false, 'busy' => true]); exit; }
$st = mt_rj('sync.json', []);
$st['attempt'] = time();
mt_wj('sync.json', $st);
$what = (string)($_GET['what'] ?? 'all');
if (!in_array($what, ['all', 'play', 'policy'], true)) $what = 'all';
done(['ran' => true, 'what' => $what]);
mt_sync_all_safe($what);
mt_unlock($lk);

function mt_sync_all_safe($what) {
  require_once __DIR__ . '/_inc/sync.php';
  try { mt_sync_all($what); } catch (Throwable $e) { @file_put_contents(MT_DATA . '/error.log', date('c') . ' sync: ' . $e->getMessage() . "\n", FILE_APPEND); }
}
