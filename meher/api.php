<?php
/**
 * MT Core Studio - admin API (JSON)
 * All state-changing actions require login plus a valid CSRF token.
 */

require __DIR__ . '/config.php';

mt_session_start();
mt_security_headers();
header('Content-Type: application/json; charset=utf-8');

$action = mt_clean_text($_POST['action'] ?? ($_GET['action'] ?? ''), 40);

/* ------------------------- sign in / first run ---------------------------- */

if ($action === 'login') {
    $ip = mt_client_ip();

    if (mt_login_throttled($ip)) {
        mt_json(['ok' => false, 'error' => 'Too many failed attempts. Wait 15 minutes and try again.'], 429);
    }

    $username = strtolower(mt_clean_text($_POST['username'] ?? '', 120));
    $password = (string) base64_decode((string) ($_POST['password'] ?? ''));
    $login = $username;
    $users = mt_read_users();

    // First run: no accounts exist yet. Create the owner account.
    if (count($users) === 0) {
        $password2 = (string) base64_decode((string) ($_POST['password2'] ?? ''));
        if (strlen($password) < 8) {
            mt_json(['ok' => false, 'error' => 'Password must be at least 8 characters.'], 400);
        }
        if ($password !== $password2) {
            mt_json(['ok' => false, 'error' => 'The two passwords do not match.'], 400);
        }
        if (!mt_valid_username($username)) {
            mt_json(['ok' => false, 'error' => 'Username must be 3-24 letters, numbers, _ or - (e.g. "owner").'], 400);
        }
        $name = mt_clean_text($_POST['name'] ?? '', 80);
        if ($name === '') {
            $name = 'Admin';
        }
        $email = strtolower(mt_clean_text($_POST['email'] ?? '', 254));
        if ($email !== '' && !mt_valid_email($email)) {
            mt_json(['ok' => false, 'error' => 'That email address does not look valid.'], 400);
        }

        // If this site upgraded from the old single-password setup, reuse that
        // hash so the existing password keeps working, then clear the legacy
        // hash so meher/config.php no longer holds credentials.
        $hash = admin_password_hash();
        if ($hash === '') {
            $hash = password_hash($password, PASSWORD_DEFAULT);
        } else {
            mt_set_password_hash('');
        }

        $owner = [
            'id' => mt_new_uid(),
            'username' => $username,
            'name' => $name,
            'email' => $email,
            'role' => 'owner',
            'hash' => $hash,
            'created' => date('Y-m-d H:i'),
            'lastLogin' => date('Y-m-d H:i'),
            'lastIp' => $ip,
        ];
        if (!mt_write_users([$owner])) {
            mt_json(['ok' => false, 'error' => 'Could not create the admin account. Make sure the admin folder is writable by PHP.'], 500);
        }
        session_regenerate_id(true);
        $_SESSION['mt_admin'] = true;
        $_SESSION['mt_uid'] = $owner['id'];
        mt_audit('setup', 'Owner account "' . $username . '" created');
        mt_json(['ok' => true, 'firstRun' => true, 'user' => mt_public_user($owner)]);
    }

    // Normal login: find the account by username OR email address.
    $user = null;
    foreach ($users as $candidate) {
        if ((string) ($candidate['username'] ?? '') === $login) {
            $user = $candidate;
            break;
        }
        if ($login !== '' && (string) ($candidate['email'] ?? '') === $login) {
            $user = $candidate;
            break;
        }
    }
    if ($user === null || !password_verify($password, (string) ($user['hash'] ?? ''))) {
        mt_login_record_failure($ip);
        mt_audit('login-failed', 'username "' . $username . '"');
        mt_json(['ok' => false, 'error' => 'Incorrect username or password.'], 403);
    }

    mt_login_clear($ip);
    session_regenerate_id(true);
    $_SESSION['mt_admin'] = true;
    $_SESSION['mt_uid'] = (string) ($user['id'] ?? '');

    // Record the successful login in the user's profile.
    $updated = [];
    foreach ($users as $candidate) {
        if ((string) ($candidate['id'] ?? '') === (string) ($user['id'] ?? '')) {
            $candidate['lastLogin'] = date('Y-m-d H:i');
            $candidate['lastIp'] = $ip;
            $user = $candidate;
        }
        $updated[] = $candidate;
    }
    mt_write_users($updated);
    mt_audit('login', $username);
    mt_json(['ok' => true, 'user' => mt_public_user($user)]);
}

if ($action === 'logout') {
    if (mt_is_logged_in()) {
        mt_audit('logout', mt_current_username());
    }
    $_SESSION = [];
    session_destroy();
    mt_json(['ok' => true]);
}

/* --------------------------- authenticated area --------------------------- */

mt_require_login();
if (!mt_verify_csrf((string) ($_POST['csrf'] ?? ''))) {
    mt_json(['ok' => false, 'error' => 'Invalid security token. Please reload the page and try again.'], 403);
}

/* ------------------------------ access control ---------------------------- */
/* owner level gates the most sensitive actions; editor level gates content   */
/* changes; everything left below requires only an authenticated account.     */

if (in_array($action, MT_OWNER_ACTIONS, true)) {
    mt_require_role('owner');
} elseif (in_array($action, MT_EDITOR_ACTIONS, true)) {
    mt_require_role('editor');
}

if ($action === 'list') {
    mt_json([
        'ok' => true,
        'apps' => mt_read_apps(),
        'config' => mt_read_config(),
        'ads' => mt_read_ads(),
        'policies' => mt_read_policies(),
        'verification' => mt_verification_files(),
        'categories' => ['Productivity', 'Education', 'Lifestyle', 'Entertainment', 'Tools', 'Other'],
        'user' => mt_public_user(mt_current_user()),
        'users' => mt_role() === 'owner' ? mt_public_users(mt_read_users()) : null,
        'audit' => array_reverse(mt_read_audit()),
    ]);
}

if ($action === 'save-app') {
    $apps = mt_read_apps();
    $appRaw = (string) ($_POST['app'] ?? '[]');
    $appDecoded = json_decode($appRaw, true);
    $app = mt_normalize_app(is_array($appDecoded) ? $appDecoded : []);
    if ($app['name'] === '') {
        mt_json(['ok' => false, 'error' => 'App name is required.'], 400);
    }
    $app['updatedAt'] = date('Y-m-d H:i');

    /* Legal source auto-detect: when a Legal / Policy Source URL is set and one
     * of the two policy URLs is still empty, read the source page and fill ONLY
     * the empty fields. Existing URLs are never overwritten, and every failure
     * is returned as a warning so the admin sees it instead of a silent save. */
    $warnings = [];
    $source = $app['policySourceUrl'];
    if ($source !== '' && ($app['privacyUrl'] === '' || $app['termsUrl'] === '')) {
        $links = mt_fetch_legal_links($source);
        $gotPrivacy = (string) ($links['privacyUrl'] ?? '') !== '';
        $gotTerms = (string) ($links['termsUrl'] ?? '') !== '';
        if (!$gotPrivacy && !$gotTerms) {
            $warnings[] = 'Could not read the legal source page (' . $source . ') — no links detected. Check the URL or enter the Privacy Policy and Terms of Service URLs manually.';
        } else {
            if ($app['privacyUrl'] === '') {
                if ($gotPrivacy) {
                    $app['privacyUrl'] = $links['privacyUrl'];
                } else {
                    $warnings[] = 'Privacy Policy link was not found on the source page — enter it manually.';
                }
            }
            if ($app['termsUrl'] === '') {
                if ($gotTerms) {
                    $app['termsUrl'] = $links['termsUrl'];
                } else {
                    $warnings[] = 'Terms of Service link was not found on the source page — enter it manually.';
                }
            }
        }
    }

    $originalId = mt_clean_text($_POST['originalId'] ?? '', 200);
    $found = false;
    $updated = [];
    foreach ($apps as $existing) {
        $existingId = (string) ($existing['id'] ?? '');
        if ($originalId !== '' && $existingId === $originalId) {
            $updated[] = $app;
            $found = true;
        } else {
            $updated[] = $existing;
        }
    }
    if (!$found) {
        $updated[] = $app;
    }
    if (!mt_write_apps($updated)) {
        mt_json(['ok' => false, 'error' => 'Could not write data/apps.js. Check that the data folder is writable by PHP.'], 500);
    }
    mt_audit('app-save', $app['name'] . ($found ? '' : ' (new)'));
    mt_json(['ok' => true, 'apps' => $updated, 'warnings' => $warnings]);
}

if ($action === 'delete-app') {
    $id = mt_clean_text($_POST['id'] ?? '', 200);
    $apps = mt_read_apps();
    $name = '';
    foreach ($apps as $app) {
        if ((string) ($app['id'] ?? '') === $id) {
            $name = (string) ($app['name'] ?? $id);
        }
    }
    $updated = array_values(array_filter($apps, static function ($a) use ($id): bool {
        return (string) ($a['id'] ?? '') !== $id;
    }));
    if (!mt_write_apps($updated)) {
        mt_json(['ok' => false, 'error' => 'Could not write data/apps.js. Check file permissions.'], 500);
    }
    mt_audit('app-delete', $name);
    mt_json(['ok' => true, 'apps' => $updated]);
}

if ($action === 'save-config') {
    if (!mt_write_config((array) $_POST)) {
        mt_json(['ok' => false, 'error' => 'Could not write data/site-config.js. Check file permissions.'], 500);
    }
    mt_audit('settings-update', '');
    mt_json(['ok' => true, 'config' => mt_read_config()]);
}

if ($action === 'save-ads') {
    $lines = [];
    foreach ((array) ($_POST['lines'] ?? []) as $line) {
        $line = mt_clean_text($line, 500);
        if ($line !== '') {
            $lines[] = $line;
        }
    }
    if (!mt_write_ads($lines)) {
        mt_json(['ok' => false, 'error' => 'Could not write app-ads.txt. Check file permissions.'], 500);
    }
    mt_audit('ads-update', count($lines) . ' publisher line(s)');
    mt_json(['ok' => true, 'ads' => $lines]);
}

if ($action === 'import-play') {
    $raw = mt_clean_text($_POST['url'] ?? '', 2000);
    $packageId = mt_parse_package_id($raw);
    if ($packageId === '') {
        mt_json([
            'ok' => false,
            'error' => 'Enter a Google Play URL or a package ID, for example "https://play.google.com/store/apps/details?id=com.example.app" or just "com.example.app".',
        ], 400);
    }

    $page = mt_http_get('https://play.google.com/store/apps/details?id=' . urlencode($packageId) . '&hl=en&gl=US');
    if ($page === null) {
        mt_json(['ok' => false, 'error' => 'Could not reach Google Play right now. Check your hosting outbound connection, or enter the app details manually.'], 502);
    }

    $info = mt_parse_play_store((string) $page, $packageId);
    if (!$info['found'] && $info['name'] === '') {
        mt_json(['ok' => false, 'error' => 'Could not read details for that package. The app may be unavailable on the US store, or Google blocked the request. Enter the details manually instead.'], 404);
    }

    $iconSaved = '';
    if ($info['icon'] !== '') {
        $slug = mt_slugify($packageId);
        $dest = MT_SITE_ROOT . '/assets/apps/' . $slug . '.png';
        if (mt_download_image($info['icon'], $dest)) {
            $iconSaved = 'assets/apps/' . $slug . '.png';
        }
    }

    mt_audit('app-import', $info['name'] . ' (' . $packageId . ')');
    mt_json(['ok' => true, 'info' => $info, 'iconSaved' => $iconSaved]);
}

/* Auto-fill Privacy Policy + Terms of Service URLs from one legal-pages link
 * (e.g. https://mtcorestudio.github.io/daily-spark-privacy/). The page links
 * to its own Privacy Policy and a Terms of Service page - both are detected. */
if ($action === 'fetch-links') {
    $url = mt_clean_text($_POST['url'] ?? '', 500);
    $links = mt_fetch_legal_links($url);
    mt_json([
        'ok' => true,
        'privacyUrl' => (string) ($links['privacyUrl'] ?? ''),
        'termsUrl' => (string) ($links['termsUrl'] ?? ''),
    ]);
}

if ($action === 'waitlist-list') {
    mt_json(['ok' => true, 'waitlist' => mt_read_waitlist()]);
}

if ($action === 'waitlist-clear') {
    $count = count(mt_read_waitlist());
    if (!mt_write_waitlist([])) {
        mt_json(['ok' => false, 'error' => 'Could not clear data/waitlist.js. Check file permissions.'], 500);
    }
    mt_audit('waitlist-clear', $count . ' entries');
    mt_json(['ok' => true, 'waitlist' => []]);
}

/* ---------------------------- visitors / statistics ----------------------- */

if ($action === 'visits-stats') {
    $stats = mt_visit_stats();
    mt_json(['ok' => true, 'stats' => $stats['stats'], 'countries' => $stats['countries'], 'topPages' => $stats['topPages'], 'recent' => $stats['recent']]);
}

/* Ranged analytics for the Analytics sidebar (Overview / IP Analysis / Pages).
 * Read-only for any signed-in account; the hashed IP rows never leave the
 * authenticated console. */
if ($action === 'analytics') {
    $range = strtolower(mt_clean_text($_POST['range'] ?? '30', 10));
    $payload = mt_analytics($range);
    $payload['ok'] = true;
    mt_json($payload);
}

if ($action === 'visits-clear') {
    if (!mt_write_visits([])) {
        mt_json(['ok' => false, 'error' => 'Could not clear data/visits.js. Check file permissions.'], 500);
    }
    mt_audit('visits-clear', '');
    $fresh = mt_visit_stats();
    mt_json(['ok' => true, 'stats' => $fresh['stats'], 'countries' => [], 'topPages' => [], 'recent' => []]);
}

if ($action === 'visits-export') {
    $visits = mt_read_visits();
    $rows = [["date", "page", "country"]];
    foreach (array_reverse($visits) as $v) {
        $country = (string) ($v['c'] ?? '');
        $rows[] = [
            (string) ($v['d'] ?? ''),
            (string) ($v['p'] ?? ''),
            $country !== '' ? $country : 'unknown',
        ];
    }
    $fh = fopen('php://temp', 'r+');
    foreach ($rows as $row) {
        fputcsv($fh, $row, ',', '"', '\\');
    }
    rewind($fh);
    $csv = (string) stream_get_contents($fh);
    fclose($fh);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="mt-core-studio-visits.csv"');
    echo "\xEF\xBB\xBF" . $csv;
    exit;
}

/* ---------------------------- privacy policies ---------------------------- */
/* Saved per app into data/policies.js; the public privacy page renders the  */
/* saved policy instead of the default template once content exists.          */

if ($action === 'save-policy') {
    $id = mt_clean_text($_POST['id'] ?? '', 200);
    $status = strtolower(mt_clean_text($_POST['status'] ?? 'draft', 20));
    if ($status !== 'completed') {
        $status = 'draft';
    }
    $content = mt_clean_policy_content((string) ($_POST['content'] ?? ''));
    if ($id === '') {
        mt_json(['ok' => false, 'error' => 'App id is required.'], 400);
    }
    $policies = mt_read_policies();
    $policies[$id] = ['updated' => date('Y-m-d'), 'status' => $status, 'content' => $content];
    if (!mt_write_policies($policies)) {
        mt_json(['ok' => false, 'error' => 'Could not write data/policies.js. Check that the data folder is writable by PHP.'], 500);
    }
    mt_audit('policy-save', $id . ($status === 'completed' ? ' (completed)' : ' (draft)'));
    mt_json(['ok' => true, 'policies' => $policies]);
}

if ($action === 'reset-policy') {
    $id = mt_clean_text($_POST['id'] ?? '', 200);
    $policies = mt_read_policies();
    if ($id !== '' && isset($policies[$id])) {
        unset($policies[$id]);
    }
    if (!mt_write_policies($policies)) {
        mt_json(['ok' => false, 'error' => 'Could not write data/policies.js. Check file permissions.'], 500);
    }
    mt_audit('policy-remove', $id);
    mt_json(['ok' => true, 'policies' => $policies]);
}

/* ----------------------------- AdMob app-ads.txt --------------------------- */
/* Guided helper: builds a valid authorized-sellers line and adds it to        */
/* app-ads.txt, keeping the raw editor available for power users.              */

if ($action === 'add-ads-line') {
    $domain = strtolower(mt_clean_text($_POST['domain'] ?? '', 200));
    $publisherId = mt_clean_text($_POST['publisher'] ?? '', 200);
    $relation = strtoupper(mt_clean_text($_POST['relation'] ?? 'DIRECT', 20));
    $token = mt_clean_text($_POST['token'] ?? '', 200);
    $lines = mt_read_ads();

    if ($domain === '' || stripos($domain, '.') === false) {
        mt_json(['ok' => false, 'error' => 'Enter the developer website domain shown on your listings, for example "mtcorestudio.com".'], 400);
    }
    if (preg_match('/^pub-[0-9]{14,20}$/', $publisherId) !== 1) {
        mt_json(['ok' => false, 'error' => 'The AdMob publisher ID should look like "pub-1234567890123456" (the pub- number from your AdMob account).'], 400);
    }
    if ($relation !== 'DIRECT' && $relation !== 'RESELLER') {
        $relation = 'DIRECT';
    }
    if ($relation === 'DIRECT') {
        $token = 'f08c47fec0942fa0';
    }
    if ($token === '') {
        mt_json(['ok' => false, 'error' => 'Enter the reseller verification token for RESELLER lines.'], 400);
    }

    $line = $domain . ', ' . $publisherId . ', ' . $relation . ', ' . $token;
    $already = false;
    foreach ($lines as $existing) {
        if (strtolower($existing) === strtolower($line)) {
            $already = true;
            break;
        }
    }
    if (!$already) {
        $lines[] = $line;
        if (!mt_write_ads($lines)) {
            mt_json(['ok' => false, 'error' => 'Could not write app-ads.txt. Check file permissions.'], 500);
        }
        mt_audit('ads-line-add', $line);
    }
    mt_json(['ok' => true, 'ads' => $lines]);
}

/* ------------------------ Google Play verification files ------------------- */

if ($action === 'save-verification') {
    $name = mt_clean_text($_POST['name'] ?? '', 200);
    $content = trim((string) ($_POST['content'] ?? ''));
    if (!mt_is_verification_file($name)) {
        mt_json(['ok' => false, 'error' => 'The file name must look like "google1a2b3c.html" — only Google Play verification files can be created here.'], 400);
    }
    if (strlen($content) > 20000) {
        mt_json(['ok' => false, 'error' => 'Verification file content is too large.'], 400);
    }
    if (!mt_write_verification_file($name, $content)) {
        mt_json(['ok' => false, 'error' => 'Could not write the verification file. Check that the site root is writable by PHP.'], 500);
    }
    mt_audit('verification-add', $name);
    mt_json(['ok' => true, 'verification' => mt_verification_files()]);
}

if ($action === 'delete-verification') {
    $name = mt_clean_text($_POST['name'] ?? '', 200);
    if (!mt_is_verification_file($name)) {
        mt_json(['ok' => false, 'error' => 'Only Google Play verification files can be removed here.'], 400);
    }
    if (!mt_delete_verification_file($name)) {
        mt_json(['ok' => false, 'error' => 'Could not delete the verification file. Check file permissions.'], 500);
    }
    mt_audit('verification-delete', $name);
    mt_json(['ok' => true, 'verification' => mt_verification_files()]);
}

/* ------------------------- account & user management ---------------------- */

if ($action === 'change-password') {
    $current = (string) base64_decode((string) ($_POST['current'] ?? ''));
    $next = (string) base64_decode((string) ($_POST['password'] ?? ''));
    $next2 = (string) base64_decode((string) ($_POST['password2'] ?? ''));
    if (strlen($next) < 8) {
        mt_json(['ok' => false, 'error' => 'The new password must be at least 8 characters.'], 400);
    }
    if ($next !== $next2) {
        mt_json(['ok' => false, 'error' => 'The two new passwords do not match.'], 400);
    }
    $me = mt_current_user();
    if ($me === null || !password_verify($current, (string) ($me['hash'] ?? ''))) {
        mt_json(['ok' => false, 'error' => 'Your current password is incorrect.'], 403);
    }
    $users = mt_read_users();
    $updated = [];
    foreach ($users as $candidate) {
        if ((string) ($candidate['id'] ?? '') === (string) ($me['id'] ?? '')) {
            $candidate['hash'] = password_hash($next, PASSWORD_DEFAULT);
        }
        $updated[] = $candidate;
    }
    if (!mt_write_users($updated)) {
        mt_json(['ok' => false, 'error' => 'Could not save the new password. Check that the admin folder is writable by PHP.'], 500);
    }
    mt_audit('change-password', (string) ($me['username'] ?? ''));
    mt_json(['ok' => true, 'audit' => array_reverse(mt_read_audit())]);
}

if ($action === 'save-user') {
    mt_require_role('owner');
    $id = trim((string) ($_POST['id'] ?? ''));
    $username = strtolower(mt_clean_text($_POST['username'] ?? '', 60));
    $name = mt_clean_text($_POST['name'] ?? '', 80);
    $email = strtolower(mt_clean_text($_POST['email'] ?? '', 254));
    $role = mt_clean_text($_POST['role'] ?? 'editor', 20);
    if ($role !== 'owner' && $role !== 'editor' && $role !== 'viewer') {
        $role = 'editor';
    }
    if (!mt_valid_username($username)) {
        mt_json(['ok' => false, 'error' => 'Username must be 3-24 letters, numbers, _ or - (e.g. "editor1").'], 400);
    }
    if ($email !== '' && !mt_valid_email($email)) {
        mt_json(['ok' => false, 'error' => 'That email address does not look valid.'], 400);
    }
    if ($name === '') {
        $name = $username;
    }
    $password = (string) base64_decode((string) ($_POST['password'] ?? ''));
    if ($password !== '' && strlen($password) < 8) {
        mt_json(['ok' => false, 'error' => 'Password must be at least 8 characters.'], 400);
    }

    $users = mt_read_users();
    $me = mt_current_user();
    $existing = null;
    $existingIndex = -1;
    foreach ($users as $i => $candidate) {
        if ((string) ($candidate['id'] ?? '') === $id) {
            $existing = $candidate;
            $existingIndex = $i;
        }
        if ((string) ($candidate['username'] ?? '') === $username && (string) ($candidate['id'] ?? '') !== $id) {
            mt_json(['ok' => false, 'error' => 'That username is already taken.'], 400);
        }
        if ($email !== '' && (string) ($candidate['email'] ?? '') === $email && (string) ($candidate['id'] ?? '') !== $id) {
            mt_json(['ok' => false, 'error' => 'That email address is already in use.'], 400);
        }
    }

    // Owner integrity: never remove the last owner, and you cannot change
    // your own role (use a second owner for that kind of change).
    $ownerCount = 0;
    foreach ($users as $candidate) {
        if ((string) ($candidate['role'] ?? '') === 'owner') {
            $ownerCount++;
        }
    }
    if ($existing === null) {
        if ($password === '') {
            mt_json(['ok' => false, 'error' => 'A temporary password is required for a new user.'], 400);
        }
        $users[] = [
            'id' => mt_new_uid(),
            'username' => $username,
            'name' => $name,
            'email' => $email,
            'role' => $role,
            'hash' => password_hash($password, PASSWORD_DEFAULT),
            'created' => date('Y-m-d H:i'),
            'lastLogin' => '',
            'lastIp' => '',
        ];
        mt_audit('user-create', $username . ' (' . $role . ')');
    } else {
        if ((string) ($existing['role'] ?? '') === 'owner' && $role !== 'owner' && $ownerCount <= 1) {
            mt_json(['ok' => false, 'error' => 'Cannot demote the last owner. Create a second owner first.'], 400);
        }
        if ($me !== null && (string) ($existing['id'] ?? '') === (string) ($me['id'] ?? '') && $role !== 'owner') {
            mt_json(['ok' => false, 'error' => 'You cannot change your own role.'], 400);
        }
        $existing['username'] = $username;
        $existing['name'] = $name;
        $existing['email'] = $email;
        $existing['role'] = $role;
        if ($password !== '') {
            $existing['hash'] = password_hash($password, PASSWORD_DEFAULT);
        }
        $users[$existingIndex] = $existing;
        mt_audit('user-update', $username . ($password !== '' ? ' (password reset)' : ''));
    }
    if (!mt_write_users(array_values($users))) {
        mt_json(['ok' => false, 'error' => 'Could not save the user. Check that the admin folder is writable by PHP.'], 500);
    }
    mt_json(['ok' => true, 'users' => mt_public_users($users), 'audit' => array_reverse(mt_read_audit())]);
}

if ($action === 'delete-user') {
    mt_require_role('owner');
    $id = trim((string) ($_POST['id'] ?? ''));
    $me = mt_current_user();
    if ($id === '' || ($me !== null && $id === (string) ($me['id'] ?? ''))) {
        mt_json(['ok' => false, 'error' => 'You cannot delete the account you are signed in with.'], 400);
    }
    $users = mt_read_users();
    $target = null;
    foreach ($users as $candidate) {
        if ((string) ($candidate['id'] ?? '') === $id) {
            $target = $candidate;
        }
    }
    if ($target === null) {
        mt_json(['ok' => false, 'error' => 'That user no longer exists.'], 404);
    }
    $ownerCount = 0;
    foreach ($users as $candidate) {
        if ((string) ($candidate['role'] ?? '') === 'owner') {
            $ownerCount++;
        }
    }
    if ((string) ($target['role'] ?? '') === 'owner' && $ownerCount <= 1) {
        mt_json(['ok' => false, 'error' => 'Cannot remove the last owner. Create a second owner first.'], 400);
    }
    $remaining = array_values(array_filter($users, static function ($candidate) use ($id): bool {
        return (string) ($candidate['id'] ?? '') !== $id;
    }));
    if (!mt_write_users($remaining)) {
        mt_json(['ok' => false, 'error' => 'Could not delete the user. Check that the admin folder is writable by PHP.'], 500);
    }
    mt_audit('user-delete', (string) ($target['username'] ?? $id));
    mt_json(['ok' => true, 'users' => mt_public_users($remaining), 'audit' => array_reverse(mt_read_audit())]);
}

if ($action === 'audit-clear') {
    mt_require_role('owner');
    if (!mt_write_audit([])) {
        mt_json(['ok' => false, 'error' => 'Could not clear the activity log.'], 500);
    }
    mt_audit('audit-clear', '');
    mt_json(['ok' => true, 'audit' => array_reverse(mt_read_audit())]);
}

mt_json(['ok' => false, 'error' => 'Unknown action.'], 400);