<?php
// Server-rendered app page: /apps/<id>  (real URL, own title/description/OpenGraph and schema.org data = good for SEO).
require __DIR__ . '/_inc/lib.php';
$base = mt_base();
$id = preg_replace('/[^a-z0-9\-]/', '', strtolower((string)($_GET['id'] ?? '')));
$all = mt_public_apps();
$app = null;
foreach ($all as $a) if ($a['id'] === $id) $app = $a;

if (!$app) {
  http_response_code(404);
  mt_shell_top(['base' => $base, 'title' => 'App not found | MT Core Studio', 'noindex' => 1, 'page' => 'app-404']);
  echo '<div class="w"><section class="s"><div class="gl doc"><h1>App not found</h1><p>This app does not exist or is not public yet.</p><p><a class="bt bp" href="./#/apps">Browse all apps →</a></p></div></section></div>';
  mt_shell_bottom();
  exit;
}

$name = (string)$app['name'];
$pub = ($app['st'] === 'Published' && $app['url'] !== '');
$can = $base . 'apps/' . $app['id'];
$desc = mb_substr(trim($app['name'] . ' - ' . ($app['tag'] ?? '') . '. ' . ($app['desc'] ?? '')), 0, 300);
$icon = (string)($app['icon'] ?? '');
$iconAbs = $icon === '' ? $base . 'assets/images/icon-512.png' : (preg_match('#^https?://#i', $icon) ? $icon : $base . $icon);
$play = $app['url'];
if ($pub && preg_match('#^https://play\.google\.com/store/apps/details#i', $play)) {
  $play .= (strpos($play, '?') === false ? '?' : '&') . 'referrer=' . rawurlencode('utm_source=mtcorestudio&utm_medium=portfolio&utm_campaign=' . $app['id'] . '&utm_content=detail');
}
$cats = ['Productivity' => 'BusinessApplication', 'Education' => 'EducationalApplication', 'Utility' => 'UtilitiesApplication', 'Spiritual' => 'LifestyleApplication', 'Lifestyle' => 'LifestyleApplication', 'Entertainment' => 'EntertainmentApplication'];
$ld = ['@context' => 'https://schema.org', '@type' => 'MobileApplication', 'name' => $name, 'operatingSystem' => 'ANDROID',
  'applicationCategory' => $cats[$app['cat'] ?? ''] ?? 'UtilitiesApplication', 'description' => (string)$app['desc'], 'url' => $can, 'image' => $iconAbs,
  'author' => ['@type' => 'Organization', 'name' => 'MT Core Studio', 'url' => $base]];
if ($pub) $ld['offers'] = ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'USD'];
if ($pub && $app['rc'] > 0 && $app['rt'] > 0) $ld['aggregateRating'] = ['@type' => 'AggregateRating', 'ratingValue' => $app['rt'], 'ratingCount' => $app['rc'], 'bestRating' => 5];
$head = '<script type="application/ld+json">' . json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) . '</script>';

mt_shell_top(['base' => $base, 'title' => $name . ' - Android App | MT Core Studio', 'desc' => $desc, 'canonical' => $can, 'image' => $iconAbs, 'head' => $head, 'page' => 'app:' . $app['id']]);

$c = isset($app['c']) && is_array($app['c']) ? $app['c'] : ['#4facfe', '#a855f7'];
$ico = $icon !== ''
  ? '<img class="ic xl" src="' . mt_e($icon) . '" alt="' . mt_e($name) . ' icon" width="96" height="96">'
  : '<div class="ic xl" style="--c1:' . mt_e($c[0] ?? '#4facfe') . ';--c2:' . mt_e($c[1] ?? '#a855f7') . '">' . mt_e($app['e'] ?? mb_substr($name, 0, 1)) . '</div>';
$tagc = $app['st'] === 'Published' ? 'p' : 'c';
$rate = '';
if ($app['rt'] > 0) $rate .= '<span><b>★ ' . mt_e(number_format($app['rt'], 1)) . '</b>' . ($app['rc'] > 0 ? ' (' . mt_e(mt_short_num($app['rc'])) . ' ratings)' : '') . '</span>';
if ($app['ins'] !== '') $rate .= '<span>' . mt_e($app['ins']) . ' downloads</span>';
if (!empty($app['ver'])) $rate .= '<span>' . mt_e($app['ver']) . '</span>';

$notify = '<form class="nlf" data-nl data-src="detail" data-app="' . mt_e($app['id']) . '" id="nf"><label class="sr" for="nfe">Email</label><input id="nfe" name="email" type="email" placeholder="you@email.com" autocomplete="email" required maxlength="120"><input class="hp" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="bt bp" type="submit">🔔 Notify me at launch</button><p class="nl-msg" role="status"></p></form>';
$cta = $pub
  ? '<a class="bt bp lg" data-play data-app="' . mt_e($app['id']) . '" data-loc="detail" href="' . mt_e($play) . '" target="_blank" rel="noopener">▶ Get it on Google Play</a>'
  : $notify;

echo '<div class="w"><section class="s">';
echo '<nav class="crumb" aria-label="Breadcrumb"><a href="./#/apps">← All apps</a></nav>';
echo '<div class="gl adh"><div class="ch">' . $ico . '<div><span class="tag ' . $tagc . '">' . mt_e($pub ? 'Available now' : $app['st']) . '</span><h1>' . mt_e($name) . '</h1><div class="tg">' . mt_e($app['tag'] ?? '') . '</div>' . ($rate !== '' ? '<div class="rate">' . $rate . '</div>' : '') . '</div></div>';
echo '<div class="adc">' . $cta . '</div></div>';

echo '<div class="two ad2"><div class="gl" style="padding:26px"><h2>About ' . mt_e($name) . '</h2>' . (!empty($app['long']) ? '<div class="mu">' . implode('', array_map(function ($p) { return '<p>' . nl2br(mt_e(trim($p))) . '</p>'; }, array_slice(preg_split('/\n{2,}/', trim((string)$app['long'])), 0, 12))) . '</div>' : '<p class="mu">' . mt_e($app['desc'] ?? '') . '</p>') . '';
if (!empty($app['feat']) && is_array($app['feat'])) {
  echo '<ul class="feats">';
  foreach ($app['feat'] as $f) echo '<li>✦ ' . mt_e($f) . '</li>';
  echo '</ul>';
}
echo '<div class="links">' . (!empty($app['pol']) ? '<a href="privacy/' . mt_e($app['id']) . '">Privacy policy</a>' : '') . '<a href="./#/updates">Release notes</a></div></div>';
echo '<div>';
if (!empty($app['shots'])) {
  echo '<div class="phs">';
  foreach (array_slice($app['shots'], 0, 6) as $i => $sh) echo '<img src="' . mt_e($sh) . '" alt="' . mt_e($name) . ' screenshot ' . ($i + 1) . '" loading="lazy" width="220" height="440">';
  echo '</div>';
}
echo '</div></div>';

$rel = array_values(array_filter($all, function ($x) use ($app) { return $x['id'] !== $app['id']; }));
if ($rel) {
  echo '<div class="sh" style="margin-top:34px"><div><span class="eb">More</span><h2>More from <span class="gt">MT Core Studio</span></h2></div></div><div class="grid">';
  foreach (array_slice($rel, 0, 3) as $r) {
    $rc = isset($r['c']) && is_array($r['c']) ? $r['c'] : ['#4facfe', '#a855f7'];
    $ri = !empty($r['icon']) ? '<img class="ic" src="' . mt_e($r['icon']) . '" alt="" loading="lazy" width="58" height="58">' : '<div class="ic" style="--c1:' . mt_e($rc[0] ?? '#4facfe') . ';--c2:' . mt_e($rc[1] ?? '#a855f7') . '">' . mt_e($r['e'] ?? mb_substr((string)$r['name'], 0, 1)) . '</div>';
    echo '<a class="cd gl" href="apps/' . mt_e($r['id']) . '"><div class="ch">' . $ri . '<div><h3>' . mt_e($r['name']) . '</h3><div class="tg">' . mt_e($r['tag'] ?? '') . '</div></div></div></a>';
  }
  echo '</div>';
}
echo '</section></div>';
echo '<div class="scta">' . ($pub ? '<a class="bt bp" data-play data-app="' . mt_e($app['id']) . '" data-loc="sticky" href="' . mt_e($play) . '" target="_blank" rel="noopener">▶ Get it on Google Play</a>' : '<a class="bt bp" href="' . mt_e($can) . '#nf">🔔 Notify me at launch</a>') . '</div>';
mt_shell_bottom();
