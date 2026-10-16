<?php
// Fallback for /app-ads.txt when the static file cannot be written. The admin AdMob Hub keeps both in sync.
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=300');
header('X-Content-Type-Options: nosniff');
require __DIR__ . '/_inc/lib.php';
echo mt_admob_text(mt_admob());
