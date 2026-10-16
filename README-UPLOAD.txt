MT Core Studio v4 - automated app hub
(Delete this file from the server after uploading.)

UPLOAD
 1. Upload everything into "htdocs" and OVERWRITE existing files.
 2. DO NOT delete or overwrite meher/_data - it holds your live apps, users and settings.
    New data files (play.json, admob.json, analytics.json, subs.json, policies/) are created automatically.
 3. meher/_data, assets/apps and the site root should be writable by PHP (usually already true).
 4. Open https://YOUR-SITE/meher/check.php once - it tests PHP, folders and outbound access to Google Play / GitHub. It deletes itself.
 5. Admin: https://YOUR-SITE/meher  (email trrahat03@gmail.com; your existing password still works - change it in Settings).

WHAT'S NEW
 PRIVACY LINK PER APP (v7)
                    Every app now has its own privacy policy page: https://YOUR-SITE/privacy/<app-id>
                    Admin > My Apps > edit app shows the link with Copy / Open buttons, and Integrations lists all links.
                    Paste it into Play Console > App content > Privacy policy. It works immediately, no GitHub needed.
                    Content: the GitHub file if you linked one, otherwise a ready-made policy built from 3 tick boxes
                    (ads / personal data / analytics) plus optional extra text. It is only a starting point: make sure it
                    matches what the app really does and your Play "Data safety" answers.
 PLAY DETAILS (v7)  The Play reader now also uses Google's embedded data blocks (full description, screenshots, version,
                    category, "what's new") with fall-backs. Fields Google does not provide stay editable, and the editor
                    tells you which ones to fill in. New Play versions put the real "what's new" text in the changelog.
 ADMIN AS AN APP (v6)
                    The admin is now installable: open https://YOUR-SITE/meher in Chrome on Android > menu > "Install app".
                    It opens full-screen with its own icon. For a real APK see the separate MT-Admin-Android package.
 ADD AN APP FROM A PLAY LINK (v5)
                    Admin > My Apps > "Import from Play link" > paste the link. The app is created with name, version,
                    category, tagline, description, icon, features and screenshots, set to Published and "auto".
                    Auto apps re-sync by themselves (every 6h, no action from you). Existing apps: paste the link in the
                    editor, tick "Auto-sync from Google Play", press "Fetch now". Untick auto to edit by hand again.
                    Extras: a "Coming Soon" app is published automatically the moment it appears on Google Play, and a
                    new Play version adds a changelog entry. Play shows no separate "features" list, so features are the
                    bullet lines of your Play description (use lines starting with a bullet or tick).
                    Version is read best-effort from the page; if Google hides it, the version you typed stays.
 Google Play sync   Admin > Integrations. Rating, rating count, downloads and icon are pulled for every app that has a
                    Package name (My Apps > edit app). Runs automatically in the background when the site is visited
                    and data is older than the refresh interval (default 6h). Optional: add the "cron URL" shown in
                    Integrations to cron-job.org for exact timing. If your host cannot reach Google Play, deploy
                    tools/play-proxy-worker.js (free Cloudflare Worker) and paste its URL as the Proxy.
                    Package names for your 3 apps were GUESSED from the icon file names (e.g. com.dailyspark.quotes).
                    Check them in My Apps. Apps not yet on Google Play show "Not on Google Play yet" - that is normal.
 GitHub policies    My Apps > edit app > "Privacy policy (GitHub)". Paste the GitHub link of a .md/.txt/.html file in a PUBLIC repo.
                    The page appears at /privacy/<app-id> (use that as the Privacy Policy URL in Play Console).
                    Optional: a GitHub webhook to <cron URL>&what=policy updates it the moment you push.
 AdMob Hub          Admin > AdMob Hub. Paste publisher IDs (pub-..., ca-app-pub-...) - one app-ads.txt serves all accounts.
                    Saving writes /app-ads.txt (static file; PHP route is the fallback). Per-app account is set in My Apps.
 Analytics          Admin > Analytics. No cookies, no IP stored, Do-Not-Track respected. Country comes from the visitor's
                    timezone (approximate) - or exact if the site sits behind Cloudflare.
 Newsletter         Footer-style signup + "Get notified" dialog on unreleased apps. View/export in Admin > Subscribers.
                    This host cannot send mail, so emails are collected only: export the CSV and send from your mail tool.
 Changelog          Admin > Changelog (add / edit / delete, one note per line).
 Draft / Published  One-click toggle in My Apps. DRAFT apps are now hidden from the public site (before, they showed as
                    "In development"). Use "Coming Soon" for apps you want visible but not yet live.
 SEO / speed        /apps/<id> pages with structured data, sitemap.xml, robots.txt, Play links tagged with UTM referrer,
                    logo + 2 app icons compressed (1.4 MB logo -> 12 KB copy), CSS moved to a cached file.
 Developer Tools    Public page #/tools: Play link/UTM builder and app-ads.txt checker.
 Live stats         In Settings you can use {apps} {installs} {rating} {admob} inside the hero stat values.

NOTES
 - The old footer links privacy.html / terms.html pointed to files that never existed; Privacy now goes to /privacy/.
 - og:image in index.html uses https://mtcorestudio.rf.gd - change it if you move to a custom domain.
 - Google reads app-ads.txt from the developer website domain on your Play listing; on a shared free subdomain
   it may look at the root domain instead. A custom domain is the safest choice.
