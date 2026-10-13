// ---------------------------------------------------------------------------
// MT Core Studio - public site configuration
// ---------------------------------------------------------------------------
// This file is loaded by the browser and uploaded to public_html.
// It is PUBLIC: never place login credentials, AdMob account IDs, API keys,
// tax or payment information, or any other private record here.
// (The /admin console edits the public fields for you automatically.)
//
// Leave fields blank when they are not yet configured. The website hides
// blank channels instead of showing placeholders.
// ---------------------------------------------------------------------------

export const siteConfig = {
  // Official brand (do not change)
  brandName: "MT Core Studio",
  tagline: "BUILD • INNOVATE • SIMPLIFY",

  // Public support / contact email
  email: "trrahat03@gmail.com",

  // Official public profile URLs. Only add links you own and verified.
  playStoreUrl: "", // Google Play developer page (https://play.google.com/store/apps/dev?id=...)
  githubUrl: "https://github.com/trrahat01/MTCoreStudio",
  youtubeUrl: "",
  facebookUrl: "",
  xUrl: "",

  // Developer profile details
  developerName: "",
  developerRole: "Independent Android App Developer",
  country: "",

  // -------------------------------------------------------------------------
  // OPTIONAL PUBLIC SECTIONS (both stay hidden until you fill them in)
  // -------------------------------------------------------------------------

  // Homepage "verified statistics" band. Only add numbers you can prove from
  // an official source such as your Google Play Console. Never invent figures.
  // Each item: { value, label, source } e.g.
  //   { value: "1,200+", label: "Downloads", source: "Play Console" }
  publishedStats: [],

  // "Roadmap" section shown on the About page. Each item: { title, detail }.
  // This is a public, honest plan - update it as the work actually changes.
  roadmap: [
    {
      title: "Publish the first apps",
      detail:
        "Finish, test and publish Daily Spark and Nursing Exam Preparation on Google Play, each with a completed listing and privacy policy."
    },
    {
      title: "Open the launch waitlist",
      detail:
        "Let early visitors subscribe per app so they are emailed the moment each app goes live."
    },
    {
      title: "Expand the collection",
      detail:
        "Continue with Shift Schedule and evaluate one new idea at a time, keeping the set small and genuinely useful."
    }
  ],

  // -------------------------------------------------------------------------
  // DOMAIN PLACEHOLDERS
  // When you connect a custom domain (e.g. https://mtcorestudio.com), replace the
  // two values below AND update the canonical/og URLs in every HTML file,
  // robots.txt and sitemap.xml. See README-INFINITYFREE.md.
  // -------------------------------------------------------------------------
  websiteUrl: "https://mtcorestudio.rf.gd",
  canonicalDomain: "https://mtcorestudio.rf.gd",

  // Homepage metadata (kept here so all pages can reference a single source)
  homeTitle: "MT Core Studio | Android Apps & Software Studio",
  homeDescription:
    "MT Core Studio is an independent Android app-development brand. Explore a growing collection of useful, lightweight mobile applications built for everyday life."
};