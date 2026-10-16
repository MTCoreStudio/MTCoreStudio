// OPTIONAL: Cloudflare Worker that fetches a Google Play page for your site.
// Use it only if your host cannot reach play.google.com (see Admin > Integrations > "Optional proxy URL").
//
// 1. Cloudflare dashboard > Workers & Pages > Create > paste this file > Deploy.
// 2. Settings > Variables: add a secret named KEY with a long random value.
// 3. In Admin > Integrations set the proxy URL to:
//      https://YOUR-WORKER.workers.dev/?id={id}&k=YOUR_KEY
// The worker returns the raw Play Store HTML; your site does the parsing.
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const id = u.searchParams.get("id") || "";
    if (!env.KEY || u.searchParams.get("k") !== env.KEY) return new Response("forbidden", { status: 403 });
    if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(id)) return new Response("bad id", { status: 400 });
    const r = await fetch(`https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}&hl=en&gl=US`, {
      headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36", "Accept-Language": "en-US,en;q=0.9", "Cookie": "CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg" },
    });
    return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  },
};
