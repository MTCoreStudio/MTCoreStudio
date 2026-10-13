<?php
/**
 * MT Core Studio - anonymous visit beacon (JSON)
 * ---------------------------------------------------------------------
 * Called once per page load from js/main.js. Records an anonymised visit
 * so the private /admin console can show simple traffic numbers and an
 * approximate country breakdown.
 *
 * POST fields (all optional except behaviour):
 *   page     relative path visited, e.g. "/index.html" or "/app.html?id=..."
 *   country  2-letter country code, best-effort from the client (or blank)
 *
 * Privacy: raw IP addresses are never stored. Only a salted one-way HMAC
 * hash of each visitor's IP is kept (used to count new vs returning visitors),
 * together with the page + date (+ optional country code). The log lives in
 * data/visits.js, which is web-inaccessible (see the site root .htaccess).
 */

require dirname(__DIR__) . '/meher/config.php';

header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    mt_json(['ok' => false, 'error' => 'Use POST for this endpoint.'], 405);
}

$page = mt_clean_text($_POST['page'] ?? '', 300);
$country = strtoupper(mt_clean_text($_POST['country'] ?? '', 8));

// Only accept sane relative paths (e.g. "/index.html", "/app.html?id=x").
if ($page === '' || $page[0] !== '/' || strpos($page, '..') !== false || strlen($page) > 200) {
    $page = '/';
}
if (!preg_match('/^[A-Z]{2}$/', $country)) {
    $country = '';
}

// Light per-IP throttle so a single script or bot cannot flood the log.
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
if (mt_visit_rate_limited('visit:' . $ip)) {
    mt_json(['ok' => true, 'throttled' => true]);
}

mt_record_visit($page, $country, $ip);

mt_json(['ok' => true, 'throttled' => false]);