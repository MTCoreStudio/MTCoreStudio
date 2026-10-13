// ---------------------------------------------------------------------------
// MT Core Studio - studio notes / blog posts
// ---------------------------------------------------------------------------
// Add a post object here to publish it. Dates use an ISO-style YYYY-MM-DD format.
//
// Each post can include: id, slug, date, category, title, description, image,
// imageAlt and content. After editing this file, regenerate the RSS feed:
//     node tools/generate-feed.mjs
// (This writes feed.xml, linked from the blog page as "Subscribe via RSS".)
//
// Keep every claim honest: no invented download numbers, ratings or revenue.
// ---------------------------------------------------------------------------

export const posts = [
  {
    id: "welcome-to-mt-core-studio",
    slug: "welcome-to-mt-core-studio",
    date: "2026-10-01",
    category: "Studio",
    title: "Welcome to MT Core Studio",
    description:
      "A first hello and a short statement of intent: one independent developer, a growing set of useful Android apps, and an honest, clean approach to publishing software.",
    content:
      "MT Core Studio is the name behind my Android apps. This site describes the work as it actually happens: the apps I am building, the pages where they will be published, and the thinking that shapes both.\n\nI work alone, which means every app on this site is designed, coded, tested and maintained by me. That keeps the process simple: I stay close to the problem, I decide honestly what each app should and should not do, and there is no team to signal approval past.\n\nThe current collection is small on purpose — Daily Spark, Nursing Exam Preparation and Shift Schedule. None of them is published yet. Instead of rushing a listing onto Google Play, I am finishing each app properly, with real screenshots and a completed privacy policy, before it ships.\n\nThis blog will hold short, plain-language notes about that progress. If you are researching whether to install one of my apps, or deciding whether MT Core Studio is a developer worth trusting, those notes should give you a clear, truthful picture."
  },
  {
    id: "how-daily-spark-took-shape",
    slug: "how-daily-spark-took-shape",
    date: "2026-09-22",
    category: "Product notes",
    title: "How Daily Spark took shape",
    description:
      "A small development log about designing a daily-prompt app that stays calm, useful and lightweight rather than chasing engagement tricks.",
    content:
      "Daily Spark started with a simple question: why do so many habit and motivation apps feel so noisy? They buzz, streak, badge and notify until the original promise — a small dose of thought for the day — gets buried.\n\nSo the design settled on a small promise instead: one fresh prompt or idea each day, a calm interface to read it in, an archive to browse backwards, and the option of a single reminder at a time you choose.\n\nThe technical goals are equally simple. Keep it fast on entry-level Android phones, keep the package small, and make dark and light themes feel intentional rather than bolted on.\n\nWhat it does not do is also a decision: no accounts, no social feed, no streak pressure. If your day is busy, Daily Spark should stay out of your way until you have a quiet moment to read it.\n\nThe app is in active development. When it reaches a build worth testing, I will note it in the changelog on this site."
  },
  {
    id: "reading-status-to-be-confirmed-honestly",
    slug: "reading-status-to-be-confirmed-honestly",
    date: "2026-09-10",
    category: "Studio",
    title: "Reading 'Status to be confirmed' honestly",
    description:
      "Why the app list shows 'Status to be confirmed' instead of inflated claims, and what has to happen before a listing is marked Published.",
    content:
      "Every app card on this site shows a status pill. Right now, the current collection reads “Status to be confirmed”, and that is a deliberate choice.\n\nAnyone can print a fake rating or a made-up download count on a website. It takes no code at all. But a Play Store listing shows the real numbers, and I would rather the site say nothing than say something that is not true.\n\nBefore any app is marked “Published” here, three things need to be true: the app is listed on Google Play, the official store URL is linked on this site, and the listing links back to a completed privacy policy for that app. You can see that definition in the code comment at the top of data/apps.js.\n\nUntil then, the honest status is the useful one: it tells you the app is still being prepared, which is exactly the current state of the work."
  }
];