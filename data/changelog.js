// ---------------------------------------------------------------------------
// MT Core Studio - release changelog data
// ---------------------------------------------------------------------------
// Add one object per release. Entries appear on the app detail page
// (app.html?id=...) and on updates.html, newest first.
//
//   app     app id - must match an id in data/apps.js
//   version version tag, e.g. "1.0.0"
//   date    ISO-style date, e.g. "2026-10-01"
//   notes   short bullets describing what changed
//
// Keep it honest: only list changes users can actually see in the published
// app or in a build they were invited to test.
//
// Example entry:
// {
//   app: "daily-spark",
//   version: "1.0.0",
//   date: "2026-10-01",
//   notes: [
//     "First public release on Google Play",
//     "Daily prompt archive added",
//     "Dark and light themes"
//   ]
// },
// ---------------------------------------------------------------------------

export const changelog = [
  {
    app: "daily-spark",
    version: "0.1",
    date: "2026-10-01",
    notes: [
      "Internal build: daily prompt flow working on device",
      "Prompt archive and dark/light themes in place",
      "Not yet on Google Play — status remains 'to be confirmed'"
    ]
  },
  {
    app: "nursing-exam-preparation",
    version: "0.1",
    date: "2026-09-28",
    notes: [
      "Internal build: question bank and quiz flow in progress",
      "Study mode and progress tracking being designed",
      "Not yet on Google Play — status remains 'to be confirmed'"
    ]
  },
  {
    app: "shift-schedule",
    version: "0.1",
    date: "2026-09-25",
    notes: [
      "Internal build: rotating shift planner concept",
      "Schedule editor and week overview being tested",
      "Not yet on Google Play — status remains 'to be confirmed'"
    ]
  }
];