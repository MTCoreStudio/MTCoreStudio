<?php
/**
 * MT Core Studio - public waitlist endpoint (JSON)
 * ---------------------------------------------------------------------
 * Used by the "Get notified when this app launches" forms on app detail
 * pages. This file is intentionally PUBLIC (no login required): visitors
 * submit their email so the studio can notify them at launch time.
 *
 * POST fields:
 *   action   "subscribe" or "unsubscribe"
 *   app      an app id from data/apps.js (e.g. daily-spark)
 *   email    a valid email address
 *   consent  "1" - required for subscribe
 *
 * Entries are stored in data/waitlist.js and reviewed in /admin.
 * Requires PHP - InfinityFree includes it for free on every account.
 */

require dirname(__DIR__) . '/meher/config.php';

header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    mt_json(['ok' => false, 'error' => 'Use POST for this endpoint.'], 405);
}

$action = mt_clean_text($_POST['action'] ?? '', 30);
if (!in_array($action, ['subscribe', 'unsubscribe'], true)) {
    mt_json(['ok' => false, 'error' => 'Unknown action.'], 400);
}

$app = mt_clean_text($_POST['app'] ?? '', 120);
$email = strtolower(mt_clean_text($_POST['email'] ?? '', 254));
$consent = (string) ($_POST['consent'] ?? '');

if ($app === '' || preg_match('/^[a-zA-Z0-9][a-zA-Z0-9-]{0,119}$/', $app) !== 1) {
    mt_json(['ok' => false, 'error' => 'Invalid app identifier.'], 400);
}
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) < 5) {
    mt_json(['ok' => false, 'error' => 'Enter a valid email address.'], 400);
}

// Only accept apps that currently exist in the directory (prevents junk records).
$knownApp = false;
foreach (mt_read_apps() as $listed) {
    if ((string) ($listed['id'] ?? '') === $app) {
        $knownApp = true;
        break;
    }
}
if (!$knownApp) {
    mt_json(['ok' => false, 'error' => 'Unknown app.'], 404);
}

if ($action === 'subscribe' && !in_array($consent, ['1', 'yes', 'true'], true)) {
    mt_json(['ok' => false, 'error' => 'Please tick the consent box to join the waitlist.'], 400);
}

/* ------------------------- lightweight rate limiting ----------------------- */
$now = time();
$logPath = mt_data_path('.waitlist-log.json');
$log = [];
if (is_file($logPath)) {
    $decoded = json_decode((string) file_get_contents($logPath), true);
    if (is_array($decoded)) {
        $log = $decoded;
    }
}
$log = array_values(array_filter($log, static function ($entry): bool {
    return isset($entry['t']) && (int) $entry['t'] > time() - 1800;
}));
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
$recent = 0;
foreach ($log as $entry) {
    if (($entry['ip'] ?? '') === $ip) {
        $recent++;
    }
}
if ($recent >= 8) {
    mt_json(['ok' => false, 'error' => 'Too many submissions. Please try again later.'], 429);
}
$log[] = ['ip' => $ip, 't' => $now];
@file_put_contents($logPath, json_encode(array_slice($log, -80)));

/* ------------------------------ update entries ----------------------------- */
$entries = mt_read_waitlist();
$existing = false;
$updated = [];
$changed = false;
foreach ($entries as $entry) {
    if ((string) ($entry['email'] ?? '') === $email && (string) ($entry['app'] ?? '') === $app) {
        $existing = true;
        if ($action === 'subscribe') {
            $updated[] = $entry; // keep the first sign-up date
            continue;
        }
        $changed = true; // unsubscribe: drop this entry
        continue;
    }
    $updated[] = $entry;
}

if ($action === 'subscribe' && !$existing) {
    $updated[] = [
        'app' => $app,
        'email' => $email,
        'date' => date('Y-m-d H:i:s', $now),
    ];
    $changed = true;
}

if ($changed && !mt_write_waitlist($updated)) {
    mt_json(['ok' => false, 'error' => 'Could not store the sign-up right now. Please try again shortly.'], 500);
}

mt_json([
    'ok' => true,
    'subscribed' => $action === 'subscribe',
    'count' => count($updated),
]);