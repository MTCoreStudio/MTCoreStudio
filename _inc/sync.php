<?php
// MT Core Studio - Google Play + GitHub policy sync engine. Loaded only by sync.php, admin API and check.php.
require_once __DIR__ . '/lib.php';

/* =====================  GOOGLE PLAY  ===================== */

// Reads rating, rating count, installs, title and icon out of a Play Store listing page.
// Several independent strategies are tried so a small layout change does not break everything.
function mt_play_parse($h) {
  $r = ['title' => '', 'rt' => 0.0, 'rc' => 0, 'num' => 0, 'icon' => '', 'ver' => '', 'cat' => '', 'tag' => '', 'desc' => '', 'feat' => [], 'shots' => [], 'sum' => '', 'new' => '', 'got' => []];
  $ldcat = ''; $ldshots = [];
  // 1) schema.org JSON-LD (most stable)
  if (preg_match_all('#<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>#is', $h, $m)) {
    foreach ($m[1] as $raw) {
      $j = json_decode(trim($raw), true);
      if (!is_array($j)) $j = json_decode(trim(html_entity_decode($raw, ENT_QUOTES, 'UTF-8')), true);
      if (!is_array($j)) continue;
      $cands = (isset($j['@graph']) && is_array($j['@graph'])) ? $j['@graph'] : [$j];
      foreach ($cands as $c) {
        if (!is_array($c)) continue;
        $t = $c['@type'] ?? '';
        $types = is_array($t) ? $t : [$t];
        if (!array_intersect($types, ['SoftwareApplication', 'MobileApplication', 'GameApplication'])) continue;
        if (!empty($c['name'])) $r['title'] = (string)$c['name'];
        if (!empty($c['image'])) $r['icon'] = is_array($c['image']) ? (string)($c['image'][0] ?? '') : (string)$c['image'];
        if (!empty($c['description'])) $r['desc'] = trim((string)$c['description']);
        if (!empty($c['softwareVersion'])) $r['ver'] = trim((string)$c['softwareVersion']);
        if (!empty($c['applicationCategory'])) $ldcat = is_array($c['applicationCategory']) ? (string)reset($c['applicationCategory']) : (string)$c['applicationCategory'];
        foreach ((array)($c['screenshot'] ?? []) as $sh) { $u = is_array($sh) ? (string)($sh['url'] ?? '') : (string)$sh; if ($u !== '') $ldshots[] = $u; }
        $ar = $c['aggregateRating'] ?? null;
        if (is_array($ar)) {
          $r['rt'] = (float)($ar['ratingValue'] ?? 0);
          $r['rc'] = mt_n($ar['ratingCount'] ?? ($ar['reviewCount'] ?? 0));
        }
      }
    }
  }
  // 2) HTML fallbacks
  if ($r['title'] === '' && preg_match('#<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)#i', $h, $m)) $r['title'] = trim(preg_replace('/\s*-\s*Apps on Google Play\s*$/i', '', html_entity_decode($m[1], ENT_QUOTES, 'UTF-8')));
  if ($r['icon'] === '') {
    if (preg_match('#<meta[^>]+itemprop=["\']image["\'][^>]+content=["\']([^"\']+)#i', $h, $m) || preg_match('#<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)#i', $h, $m)) $r['icon'] = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
  }
  if ($r['rt'] <= 0 && preg_match('#Rated\s+([0-9](?:\.[0-9])?)\s+stars#i', $h, $m)) $r['rt'] = (float)$m[1];
  if ($r['rc'] <= 0 && preg_match('#([0-9][0-9.,]*\s*[KMB]?)\s*(?:reviews|ratings)#i', $h, $m)) $r['rc'] = mt_unshort($m[1]);
  // 3) installs: embedded data blob (text + exact number must agree), then the visible "Downloads" block
  if (preg_match_all('#"(\d[\d,]*)\+"\s*,\s*(\d{2,})#', $h, $mm, PREG_SET_ORDER)) {
    foreach ($mm as $x) if (mt_n($x[1]) === (int)$x[2] && (int)$x[2] > $r['num']) $r['num'] = (int)$x[2];
  }
  if ($r['num'] <= 0 && preg_match('#>\s*(\d[\d.,]*\s*[KMB]?)\+\s*</div>\s*<div[^>]*>\s*Downloads#i', $h, $m)) $r['num'] = mt_unshort($m[1]);
  if ($r['num'] <= 0 && preg_match('#(\d[\d.,]*\s*[KMB]?)\+?\s*downloads#i', $h, $m)) $r['num'] = mt_unshort($m[1]);
  // Google's embedded data blocks hold the full listing (description, screenshots, version, installs, what's new)
  $b = mt_play_blob($h);
  if ($r['title'] === '' && $b['title'] !== '') $r['title'] = $b['title'];
  if (mb_strlen($b['desc']) > mb_strlen($r['desc'])) $r['desc'] = $b['desc'];
  if ($b['ver'] !== '') $r['ver'] = $b['ver'];
  if ($r['icon'] === '' && $b['icon'] !== '') $r['icon'] = $b['icon'];
  if ($r['rt'] <= 0 && $b['rt'] > 0) $r['rt'] = $b['rt'];
  if ($r['rc'] <= 0 && $b['rc'] > 0) $r['rc'] = $b['rc'];
  if ($r['num'] <= 0 && $b['num'] > 0) $r['num'] = $b['num'];
  if ($b['cat'] !== '') $r['cat'] = $b['cat'];
  $r['sum'] = $b['sum']; $r['new'] = $b['new'];
  mt_play_listing($h, $r, $ldcat, array_merge($b['shots'], $ldshots));
  return $r;
}

function mt_dig($a, $path) {
  foreach ($path as $k) { if (!is_array($a) || !array_key_exists($k, $a)) return null; $a = $a[$k]; }
  return $a;
}
function mt_walk($n, $fn, $d = 0) {
  if ($d > 16 || !is_array($n)) return;
  $fn($n);
  foreach ($n as $c) if (is_array($c)) mt_walk($c, $fn, $d + 1);
}
function mt_blob_text($h) {
  $h = str_ireplace(['<br>', '<br/>', '<br />', '</p>', '</li>', '</div>'], "\n", (string)$h);
  $h = preg_replace('#<li[^>]*>#i', '• ', $h);
  return trim(preg_replace("/\n{3,}/", "\n\n", html_entity_decode(strip_tags($h), ENT_QUOTES, 'UTF-8')));
}
// Reads the AF_initDataCallback blocks of a Play page. Known positions first, heuristics if Google moved them.
function mt_play_blob($h) {
  $o = ['title' => '', 'desc' => '', 'sum' => '', 'num' => 0, 'ver' => '', 'icon' => '', 'shots' => [], 'cat' => '', 'new' => '', 'rt' => 0.0, 'rc' => 0];
  if (!preg_match_all('#AF_initDataCallback\(\{key:\s*\'(ds:\d+)\'.*?data:(.*?),\s*sideChannel:#s', $h, $m, PREG_SET_ORDER)) return $o;
  $app = null; $best = null; $bestLen = 0;
  foreach ($m as $x) {
    $j = json_decode($x[2], true);
    if (!is_array($j)) continue;
    $t = mt_dig($j, [1, 2, 0, 0]);
    if (is_string($t) && $t !== '') { $app = $j; break; }
    $len = 0; mt_walk($j, function ($n) use (&$len) { foreach ($n as $v) if (is_string($v) && strlen($v) > $len) $len = strlen($v); });
    if ($len > $bestLen) { $bestLen = $len; $best = $j; }
  }
  if ($app === null) { if ($best === null || $bestLen < 200) return $o; $app = $best; }
  $str = function ($p) use ($app) { $v = mt_dig($app, $p); return is_string($v) ? $v : ''; };
  $o['title'] = $str([1, 2, 0, 0]);
  $d = $str([1, 2, 72, 0, 1]); if ($d !== '') $o['desc'] = mt_blob_text($d);
  $o['sum'] = trim(strip_tags($str([1, 2, 73, 0, 1])));
  $n = mt_dig($app, [1, 2, 13, 1]); if (is_numeric($n)) $o['num'] = (int)$n;
  $v = mt_dig($app, [1, 2, 51, 0, 1]); if (is_numeric($v)) $o['rt'] = (float)$v;
  $v = mt_dig($app, [1, 2, 51, 2, 1]); if (is_numeric($v)) $o['rc'] = (int)$v;
  $o['icon'] = $str([1, 2, 95, 0, 3, 2]);
  $o['cat'] = $str([1, 2, 79, 0, 0, 0]);
  $o['ver'] = $str([1, 2, 140, 0, 0, 0]);
  $nw = $str([1, 2, 144, 1, 1]); if ($nw !== '') $o['new'] = mt_blob_text($nw);
  $sh = mt_dig($app, [1, 2, 78, 0]);
  if (is_array($sh)) foreach ($sh as $e) { $u = mt_dig($e, [3, 2]); if (is_string($u)) $o['shots'][] = $u; }
  // heuristics (used only for what the fixed positions did not give us)
  if ($o['desc'] === '' || !$o['shots'] || $o['num'] <= 0) {
    $long = '';
    mt_walk($app, function ($n) use (&$o, &$long) {
      foreach ($n as $i => $v) {
        if (is_string($v) && strlen($v) > strlen($long) && strpos($v, ' ') !== false && !preg_match('#^https?://#', $v)) $long = $v;
        if ($o['num'] <= 0 && is_string($v) && preg_match('/^(\d[\d,]*)\+$/', $v, $mm) && isset($n[$i + 1]) && is_int($n[$i + 1]) && $n[$i + 1] === mt_n($mm[1])) $o['num'] = $n[$i + 1];
      }
      $u = mt_dig($n, [3, 2]);
      if (!$o['shots'] && is_string($u) && preg_match('#^https://play-lh\.googleusercontent\.com/#', $u) && is_array(mt_dig($n, [2]))) $o['hs'][] = $u;
    });
    if ($o['desc'] === '' && strlen($long) > 150) $o['desc'] = mt_blob_text($long);
    if (!$o['shots'] && !empty($o['hs'])) $o['shots'] = array_slice(array_values(array_unique($o['hs'])), 0, 10);
    unset($o['hs']);
  }
  return $o;
}

// Name/tagline/description/category/version/features/screenshots (best effort: Google changes its markup now and then).
function mt_play_listing($h, &$r, $ldcat, $ldshots) {
  $meta = '';
  if (preg_match('#<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)#i', $h, $m)) $meta = trim(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'));
  if ($r['desc'] === '' && $meta !== '') $r['desc'] = $meta;
  // tagline: the short meta text if it is short, else the first sentence of the description
  $t = trim(preg_replace('/\s+/u', ' ', $r['sum'] !== '' ? $r['sum'] : ($meta !== '' ? $meta : $r['desc'])));
  if (mb_strlen($t) > 90) { $t = preg_match('/^(.{20,90}?[.!?])(\s|$)/us', $t, $m) ? $m[1] : (rtrim(mb_substr($t, 0, mb_strrpos(mb_substr($t, 0, 90), ' ') ?: 90), '.,;: ') . '…'); }
  $r['tag'] = $t;
  // category
  $cat = preg_match('#/store/apps/category/([A-Z][A-Z_]+)#', $h, $m) ? $m[1] : $ldcat;
  if ($cat !== '' && $r['cat'] === '') $r['cat'] = ucwords(strtolower(str_replace('_', ' ', $cat)));
  // version (only if it looks like one)
  if ($r['ver'] === '' && preg_match('#\[\[\["(\d{1,3}(?:\.\d{1,5}){1,3})"\]\]#', $h, $m)) $r['ver'] = $m[1];
  if ($r['ver'] !== '' && preg_match('/^\d/', $r['ver'])) $r['ver'] = 'v' . $r['ver'];
  if (!preg_match('/^v?\d[\w.\-+]{0,28}$/', $r['ver'])) $r['ver'] = '';
  // features: bullet lines of the description
  foreach (preg_split('/\R/u', (string)$r['desc']) as $ln) {
    if (count($r['feat']) >= 8) break;
    if (preg_match('/^\s*(?:[•·●▪‣◦\-–*✔✓✅☑➤➜→★✨]|\p{So})+\s*(.{3,80}?)\s*$/u', $ln, $m) && !preg_match('#https?://#', $m[1])) $r['feat'][] = rtrim($m[1], ' .;');
  }
  if (!$r['feat']) {      // no bullets: use short stand-alone lines (headings / one-liners) of the description
    foreach (preg_split('/\R/u', (string)$r['desc']) as $ln) {
      $ln = trim($ln);
      if (count($r['feat']) >= 6) break;
      if (mb_strlen($ln) >= 8 && mb_strlen($ln) <= 60 && !preg_match('#https?://|@|:$#', $ln) && preg_match('/^\p{L}/u', $ln)) $r['feat'][] = rtrim($ln, ' .;');
    }
  }
  // screenshots
  $ibase = preg_replace('/=[swh][^=?&]*$/', '', (string)$r['icon']);
  $urls = $ldshots;
  if (preg_match_all('#<img[^>]+>#i', $h, $im)) {
    foreach ($im[0] as $tag) {
      if (stripos($tag, 'screenshot') === false) continue;
      if (preg_match('#(?:data-src|src)=["\'](https://play-lh\.googleusercontent\.com/[^"\']+)#i', $tag, $m)) $urls[] = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
    }
  }
  if (!$urls && preg_match_all('#https://play-lh\.googleusercontent\.com/[A-Za-z0-9_\-]{20,}=w\d+-h\d+[^"\'\s<)]*#', $h, $mm)) $urls = $mm[0];
  $seen = [];
  foreach ($urls as $u) {
    $b = preg_replace('/=[swh][^=?&]*$/', '', $u);
    if (!preg_match('#^https://[a-z0-9.\-]+\.(googleusercontent|ggpht)\.com/#i', $b) || $b === $ibase || isset($seen[$b])) continue;
    $seen[$b] = 1; $r['shots'][] = $b . '=w540';
    if (count($r['shots']) >= 8) break;
  }
}

// Downloads the icon once and keeps a local copy (fast, no hotlinking). Falls back to the remote URL.
function mt_play_icon($icon, $id) {
  $base = preg_replace('/=[swh][^=?&]*$/', '', (string)$icon);
  if (!preg_match('#^https://[a-z0-9.\-]*(googleusercontent\.com|ggpht\.com)/#i', $base)) return '';
  $remote = $base . '=s256';
  $res = mt_http_get($remote, ['timeout' => 10, 'max' => 600000, 'headers' => ['Accept: image/*']]);
  if (!$res['ok'] || strlen($res['body']) < 400) return $remote;
  $b = $res['body']; $ext = '';
  if (substr($b, 0, 8) === "\x89PNG\r\n\x1a\n") $ext = 'png';
  elseif (substr($b, 0, 3) === "\xFF\xD8\xFF") $ext = 'jpg';
  elseif (substr($b, 0, 4) === 'RIFF' && substr($b, 8, 4) === 'WEBP') $ext = 'webp';
  if ($ext === '' || !preg_match('/^[a-z0-9\-]+$/', $id)) return $remote;
  $rel = 'assets/apps/play-' . $id . '.' . $ext;
  if (@file_put_contents(MT_ROOT . '/' . $rel, $b, LOCK_EX) === false) return $remote;
  return $rel . '?v=' . substr(md5($b), 0, 6);
}

function mt_play_sync_app($a, $cfg, $prev) {
  $pkg = (string)$a['pkg'];
  $rec = is_array($prev) ? $prev : [];
  $rec['pkg'] = $pkg; $rec['ts'] = time();
  $direct = 'https://play.google.com/store/apps/details?id=' . rawurlencode($pkg) . '&hl=en&gl=US';
  $urls = [];
  if ($cfg['proxy'] !== '') $urls[] = str_replace('{id}', rawurlencode($pkg), $cfg['proxy']);
  $urls[] = $direct;
  $res = null; $errs = [];
  foreach ($urls as $u) {
    $res = mt_http_get($u, ['timeout' => 14, 'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'headers' => ['Cookie: CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg']]);
    if ($res['ok']) break;
    $errs[] = ($u === $direct ? 'direct' : 'proxy') . ': ' . $res['err'];
    if ($res['code'] === 404 && $u === $direct) break;
  }
  if (!$res['ok']) {
    $nf = $res['code'] === 404;
    $rec['st'] = $nf ? 'notfound' : 'error';
    $rec['msg'] = $nf ? 'Not on Google Play yet (404). Normal for apps that have not launched.' : 'Could not reach Google Play (' . implode('; ', $errs) . ')';
    return $rec;
  }
  $p = mt_play_parse($res['body']);
  if ($p['title'] === '' && $p['rt'] <= 0 && $p['num'] <= 0) {
    $rec['st'] = 'error';
    $rec['msg'] = 'Page loaded but no rating/installs were found (blocked, consent page or layout change). Set a proxy in Integrations.';
    return $rec;
  }
  if ($p['title'] !== '') $rec['title'] = $p['title'];
  $rec['rt'] = $p['rt']; $rec['rc'] = $p['rc'];
  if ($p['num'] > 0) { $rec['num'] = $p['num']; $rec['ins'] = mt_installs_label($p['num']); }
  elseif (!isset($rec['num'])) { $rec['num'] = 0; $rec['ins'] = ''; }
  foreach (['ver', 'cat', 'tag', 'desc', 'feat', 'shots', 'new'] as $k) if (!empty($p[$k])) $rec[$k] = $p[$k];
  if ($p['icon'] !== '') { $ic = mt_play_icon($p['icon'], (string)$a['id']); if ($ic !== '') $rec['icon'] = $ic; }
  $rec['st'] = 'ok'; $rec['msg'] = ''; $rec['last_ok'] = time();
  $got = [];
  foreach (['title' => 'name', 'icon' => 'icon', 'rt' => 'rating', 'num' => 'downloads', 'desc' => 'description', 'tag' => 'tagline', 'cat' => 'category', 'ver' => 'version', 'feat' => 'features', 'shots' => 'screenshots', 'new' => "what's new"] as $k => $lab) if (!empty($rec[$k])) $got[] = $lab;
  $rec['got'] = $got;
  return $rec;
}

/* =====================  GITHUB POLICIES  ===================== */

// Accepts a github.com/blob URL, a raw.githubusercontent.com URL, or "owner/repo/path/file.md[@branch]".
function mt_policy_src($in) {
  $in = trim((string)$in);
  if ($in === '' || strlen($in) > 400) return null;
  $o = $r = $br = $path = '';
  if (preg_match('#^https?://github\.com/([\w.\-]+)/([\w.\-]+)/blob/([^/]+)/(.+)$#i', $in, $m)) { list(, $o, $r, $br, $path) = $m; }
  elseif (preg_match('#^https?://raw\.githubusercontent\.com/([\w.\-]+)/([\w.\-]+)/(?:refs/heads/)?([^/]+)/(.+)$#i', $in, $m)) { list(, $o, $r, $br, $path) = $m; }
  elseif (preg_match('#^([\w.\-]+)/([\w.\-]+)/(.+?)(?:@([\w./\-]+))?$#', $in, $m)) { $o = $m[1]; $r = $m[2]; $path = $m[3]; $br = $m[4] ?? 'main'; if ($br === '') $br = 'main'; }
  else return null;
  $path = trim(preg_replace('/[?#].*$/', '', $path), '/');
  if ($path === '' || strpos($path, '..') !== false || !preg_match('#^[\w.\- /+()@]+$#', $path)) return null;
  $enc = implode('/', array_map('rawurlencode', explode('/', $path)));
  $encb = implode('/', array_map('rawurlencode', explode('/', $br)));
  return [
    'raw' => "https://raw.githubusercontent.com/$o/$r/$encb/$enc",
    'web' => "https://github.com/$o/$r/blob/$encb/$enc",
    'path' => $path,
  ];
}

// Small, safe Markdown renderer: everything is HTML-escaped first, then limited formatting is applied.
function mt_md_fmt($s) {
  $s = preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $s);
  $s = preg_replace('/__(.+?)__/s', '<strong>$1</strong>', $s);
  $s = preg_replace('/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/s', '<em>$1</em>', $s);
  $s = preg_replace('/(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/s', '<em>$1</em>', $s);
  return $s;
}
function mt_md_inline($s) {
  $s = htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
  $keep = [];
  $stash = function ($html) use (&$keep) { $keep[] = $html; return "\x01" . (count($keep) - 1) . "\x02"; };
  $a = function ($url, $text) use ($stash) {
    $url = html_entity_decode($url, ENT_QUOTES, 'UTF-8');
    if (!preg_match('#^(https?://|mailto:)#i', $url)) return $text;
    return $stash('<a href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '" target="_blank" rel="noopener nofollow">' . mt_md_fmt($text) . '</a>');
  };
  $s = preg_replace_callback('/`([^`]+)`/', function ($m) use ($stash) { return $stash('<code>' . $m[1] . '</code>'); }, $s);
  $s = preg_replace_callback('/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/', function ($m) use ($a) { return $a($m[2], $m[1]); }, $s);
  $s = preg_replace_callback('#(?<![\w"=/])(https?://[^\s<\x01]+?)([.,;:!?)]*)(?=\s|$|\x01)#', function ($m) use ($a) { return $a($m[1], $m[1]) . $m[2]; }, $s);
  $s = preg_replace_callback('/(?<![\w\x01@.])([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/', function ($m) use ($a) { return $a('mailto:' . $m[1], $m[1]); }, $s);
  $s = mt_md_fmt($s);
  $s = preg_replace('/&lt;br\s*\/?&gt;/i', '<br>', $s);
  return preg_replace_callback('/\x01(\d+)\x02/', function ($m) use (&$keep) { return $keep[(int)$m[1]] ?? ''; }, $s);
}
function mt_md($t) {
  $t = str_replace(["\r\n", "\r"], "\n", (string)$t);
  $t = preg_replace('/^\xEF\xBB\xBF/', '', $t);
  $lines = explode("\n", $t);
  $n = count($lines); $out = ''; $para = []; $i = 0;
  $flush = function () use (&$para, &$out) { if ($para) { $out .= '<p>' . mt_md_inline(implode(' ', $para)) . '</p>'; $para = []; } };
  while ($i < $n) {
    $l = $lines[$i];
    if (preg_match('/^\s*```/', $l)) {
      $flush(); $code = []; $i++;
      while ($i < $n && !preg_match('/^\s*```/', $lines[$i])) { $code[] = $lines[$i]; $i++; }
      $i++;
      $out .= '<pre><code>' . htmlspecialchars(implode("\n", $code), ENT_QUOTES, 'UTF-8') . '</code></pre>';
      continue;
    }
    if (trim($l) === '') { $flush(); $i++; continue; }
    if (preg_match('/^(#{1,6})\s+(.*?)\s*#*\s*$/', $l, $m)) {
      $flush(); $lv = min(6, strlen($m[1]) + 1);
      $out .= "<h$lv>" . mt_md_inline($m[2]) . "</h$lv>"; $i++; continue;
    }
    if (preg_match('/^\s*([-*_])(\s*\1){2,}\s*$/', $l)) { $flush(); $out .= '<hr>'; $i++; continue; }
    if (preg_match('/^\s*>\s?(.*)$/', $l, $m)) {
      $flush(); $q = [$m[1]]; $i++;
      while ($i < $n && preg_match('/^\s*>\s?(.*)$/', $lines[$i], $mq)) { $q[] = $mq[1]; $i++; }
      $out .= '<blockquote><p>' . mt_md_inline(implode(' ', $q)) . '</p></blockquote>';
      continue;
    }
    if (preg_match('/^\s*([-*+]|\d+[.)])\s+(.*)$/', $l, $m)) {
      $flush(); $ord = preg_match('/\d/', $m[1]) === 1; $items = [$m[2]]; $i++;
      while ($i < $n) {
        if (preg_match('/^\s*([-*+]|\d+[.)])\s+(.*)$/', $lines[$i], $m2) && (preg_match('/\d/', $m2[1]) === 1) === $ord) { $items[] = $m2[2]; $i++; }
        elseif (preg_match('/^\s{2,}\S/', $lines[$i]) && trim($lines[$i]) !== '') { $items[count($items) - 1] .= ' ' . trim($lines[$i]); $i++; }
        else break;
      }
      $tag = $ord ? 'ol' : 'ul';
      $out .= "<$tag>" . implode('', array_map(function ($x) { return '<li>' . mt_md_inline($x) . '</li>'; }, $items)) . "</$tag>";
      continue;
    }
    $para[] = trim($l); $i++;
  }
  $flush();
  return $out;
}

// For .html policies: keep a small whitelist of tags and rebuild them without attributes (except safe links).
function mt_html_clean($h) {
  $h = preg_replace('#<(script|style|iframe|object|embed|form|svg|math)\b.*?</\1>#is', '', (string)$h);
  if (preg_match('#<body[^>]*>(.*)</body>#is', $h, $m)) $h = $m[1];
  $h = strip_tags($h, '<p><br><ul><ol><li><h1><h2><h3><h4><h5><h6><strong><b><em><i><a><blockquote><hr><code><pre>');
  return preg_replace_callback('#<(/?)([a-z0-9]+)([^>]*)>#i', function ($m) {
    $t = strtolower($m[2]);
    if ($m[1] === '/') return "</$t>";
    if ($t === 'a') {
      if (preg_match('#href\s*=\s*("([^"]*)"|\'([^\']*)\')#i', $m[3], $x)) {
        $u = html_entity_decode($x[2] !== '' ? $x[2] : ($x[3] ?? ''), ENT_QUOTES, 'UTF-8');
        if (preg_match('#^(https?://|mailto:)#i', $u)) return '<a href="' . htmlspecialchars($u, ENT_QUOTES, 'UTF-8') . '" target="_blank" rel="noopener nofollow">';
      }
      return '<a>';
    }
    return "<$t>";
  }, $h);
}

function mt_policy_sync_app($a, $prev) {
  $src = mt_policy_src($a['policy'] ?? '');
  if (!$src) return null;
  $rec = is_array($prev) ? $prev : [];
  $rec['ts'] = time(); $rec['src'] = $src['raw']; $rec['web'] = $src['web'];
  $res = mt_http_get($src['raw'], ['timeout' => 12, 'max' => 400000, 'headers' => ['Accept: text/plain,text/markdown,text/html,*/*']]);
  if (!$res['ok']) {
    $rec['st'] = $res['code'] === 404 ? 'notfound' : 'error';
    $rec['msg'] = $res['code'] === 404 ? 'File not found on GitHub (check owner/repo/branch/path; the repo must be public).' : 'Could not fetch from GitHub: ' . $res['err'];
    return $rec;
  }
  $body = $res['body'];
  $sha = sha1($body);
  $isHtml = preg_match('/\.html?$/i', $src['path']) === 1;
  $html = $isHtml ? mt_html_clean($body) : mt_md($body);
  if (trim(strip_tags($html)) === '') { $rec['st'] = 'error'; $rec['msg'] = 'The file on GitHub is empty.'; return $rec; }
  if (($rec['sha'] ?? '') !== $sha) $rec['changed'] = time();
  $rec['sha'] = $sha; $rec['html'] = $html; $rec['st'] = 'ok'; $rec['msg'] = '';
  if (empty($rec['changed'])) $rec['changed'] = time();
  return $rec;
}

/* =====================  ORCHESTRATOR  ===================== */

// $what: 'all' | 'play' | 'policy'.  $only: restrict to one app id.
function mt_sync_all($what = 'all', $only = '') {
  @set_time_limit(150);
  $cfg = mt_cfg();
  $apps = array_slice(mt_store()['apps'], 0, 40);
  $out = ['play' => [], 'policy' => []];
  $sum = [];

  if ($what === 'all' || $what === 'play') {
    $play = mt_rj('play.json', []); $ok = 0; $tot = 0; $first = true; $auto = [];
    foreach ($apps as $a) {
      if (!is_array($a) || ($only !== '' && ($a['id'] ?? '') !== $only)) continue;
      $a['pkg'] = array_key_exists('pkg', $a) ? (string)$a['pkg'] : mt_pkg_guess($a['icon'] ?? '');
      if (!mt_pkg_ok($a['pkg'])) continue;
      $tot++;
      if (!$first) usleep(500000);
      $first = false;
      $pv = (string)($play[$a['id']]['ver'] ?? '');
      $rec = mt_play_sync_app($a, $cfg, $play[$a['id']] ?? null);
      $play[$a['id']] = $rec; $out['play'][$a['id']] = $rec;
      if ($rec['st'] === 'ok') { $ok++; if (!empty($a['auto'])) $auto[] = [$a['id'], $pv, (string)($rec['ver'] ?? ''), (string)($rec['new'] ?? '')]; }
    }
    $ids = [];
    foreach ($apps as $a) if (is_array($a)) $ids[$a['id'] ?? ''] = 1;
    foreach ($play as $k => $v) if (!isset($ids[$k])) unset($play[$k]);
    mt_wj('play.json', $play);
    if (!empty($auto)) mt_auto_actions($auto);
    if ($only === '') $sum['play'] = ['ts' => time(), 'ok' => $ok, 'n' => $tot];
  }

  if ($what === 'all' || $what === 'policy') {
    $ok = 0; $tot = 0;
    foreach ($apps as $a) {
      if (!is_array($a)) continue;
      $id = (string)($a['id'] ?? '');
      if ($id === '' || !preg_match('/^[a-z0-9\-]+$/', $id)) continue;
      $file = 'policies/' . $id . '.json';
      if (trim((string)($a['policy'] ?? '')) === '') { @unlink(MT_DATA . '/' . $file); continue; }
      if ($only !== '' && $id !== $only) continue;
      $tot++;
      $rec = mt_policy_sync_app($a, mt_rj($file, []));
      if ($rec === null) { $out['policy'][$id] = ['st' => 'error', 'msg' => 'Could not understand the GitHub link.']; continue; }
      mt_wj($file, $rec);
      $out['policy'][$id] = array_diff_key($rec, ['html' => 1]);
      if ($rec['st'] === 'ok') $ok++;
    }
    if ($only === '') $sum['policy'] = ['ts' => time(), 'ok' => $ok, 'n' => $tot];
  }

  $st = mt_rj('sync.json', []);
  foreach ($sum as $k => $v) $st[$k] = $v;
  $st['last'] = time();
  mt_wj('sync.json', $st);
  return $out;
}

// Apps in "auto" mode: when a Coming Soon app appears on Google Play it is published, and a new Play version adds a changelog entry.
function mt_auto_actions($auto) {
  mt_store_update(function (&$s) use ($auto) {
    $ch = false;
    foreach ($auto as $it) {
      list($id, $pv, $nv, $nw) = $it;
      $notes = array_slice(array_values(array_filter(array_map(function ($l) { return mb_substr(trim(preg_replace('/^[•\-*\s]+/u', '', $l)), 0, 200); }, preg_split('/\R/u', (string)$nw)))), 0, 8);
      foreach ($s['apps'] as &$x) {
        if (($x['id'] ?? '') !== $id) continue;
        $log = isset($s['log']) && is_array($s['log']) ? array_slice($s['log'], -295) : [];
        if (($x['st'] ?? '') === 'Coming Soon') {
          $x['st'] = 'Published'; $ch = true;
          $log[] = ['app' => (string)$x['name'], 'ver' => $nv !== '' ? $nv : (string)($x['ver'] ?? ''), 'date' => date('Y-m-d'), 'title' => 'Now available on Google Play', 'notes' => ['Download it from the Google Play Store.']];
        } elseif ($pv !== '' && $nv !== '' && $pv !== $nv) {
          $ch = true;
          $log[] = ['app' => (string)$x['name'], 'ver' => $nv, 'date' => date('Y-m-d'), 'title' => 'Update', 'notes' => $notes ? $notes : ['Updated to ' . $nv . ' on Google Play.']];
        }
        $s['log'] = $log;
      }
      unset($x);
    }
    return $ch;
  });
}
