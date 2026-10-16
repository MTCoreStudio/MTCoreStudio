<?php
// Public, read-only data for the website. Hidden and Draft apps are never exposed.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60, stale-while-revalidate=300');
header('X-Content-Type-Options: nosniff');
require __DIR__ . '/_inc/lib.php';

$p = MT_DATA . '/store.json';
$s = is_file($p) ? json_decode((string)file_get_contents($p), true) : null;
if (!is_array($s) || !isset($s['apps'], $s['set'])) { http_response_code(404); echo '{}'; exit; }

$apps = mt_public_apps();
foreach ($apps as $i => $a) unset($apps[$i]['long']);   // full text is only needed on /apps/<id>
$shown = []; foreach ($apps as $a) $shown[(string)($a['name'] ?? '')] = 1;
$log = [];
foreach ((array)($s['log'] ?? []) as $l) {            // never leak changelog lines of hidden/draft apps
  if (!is_array($l)) continue;
  $known = false;
  foreach ($s['apps'] as $a) if (is_array($a) && ($a['name'] ?? '') === ($l['app'] ?? null)) $known = true;
  if (!$known || isset($shown[(string)($l['app'] ?? '')])) $log[] = $l;
}

// live numbers for the hero stats and structured data
$inst = 0; $rs = 0.0; $rcs = 0;
foreach ($apps as $a) {
  if (($a['st'] ?? '') !== 'Published') continue;
  $inst += (int)$a['num'];
  if ($a['rc'] > 0 && $a['rt'] > 0) { $rs += $a['rt'] * $a['rc']; $rcs += $a['rc']; }
}
$ad = mt_admob(); $nad = 0; foreach ($ad['accounts'] as $x) if (!empty($x['on'])) $nad++;
$agg = ['apps' => count($apps), 'installs' => $inst, 'rating' => $rcs ? round($rs / $rcs, 1) : 0, 'admob' => $nad];

$set = (array)$s['set'];
if (isset($set['s']) && is_array($set['s'])) {
  $rep = ['{apps}' => (string)$agg['apps'], '{installs}' => $inst > 0 ? mt_installs_label($inst) : '0', '{rating}' => $agg['rating'] ? (string)$agg['rating'] : '—', '{admob}' => (string)$agg['admob']];
  foreach ($set['s'] as $i => $row) if (is_array($row)) $set['s'][$i][0] = strtr((string)($row[0] ?? ''), $rep);
}

echo json_encode(['apps' => $apps, 'log' => $log, 'set' => $set, 'agg' => $agg, 'stale' => mt_sync_due(), 'ts' => time()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
