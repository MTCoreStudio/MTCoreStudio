<?php
// /sitemap.xml and /robots.txt (see .htaccess rewrites). Only public pages are listed.
require __DIR__ . '/_inc/lib.php';
$base = mt_base();
if (!empty($_GET['robots'])) {
  header('Content-Type: text/plain; charset=utf-8');
  echo "User-agent: *\nDisallow: /meher/\nDisallow: /_inc/\nAllow: /\n\nSitemap: {$base}sitemap.xml\n";
  exit;
}
header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600');
$day = gmdate('Y-m-d');
$u = [[$base, $day, '1.0']];
foreach (mt_public_apps() as $a) {
  $u[] = [$base . 'apps/' . $a['id'], $day, '0.8'];
  if (!empty($a['pol'])) $u[] = [$base . 'privacy/' . $a['id'], $day, '0.4'];
}
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($u as $r) echo '<url><loc>' . htmlspecialchars($r[0], ENT_QUOTES, 'UTF-8') . '</loc><lastmod>' . $r[1] . '</lastmod><priority>' . $r[2] . "</priority></url>\n";
echo "</urlset>\n";
