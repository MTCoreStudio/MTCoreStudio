// ---------------------------------------------------------------------------
// MT Core Studio - per-app privacy policies
// ---------------------------------------------------------------------------
// Written automatically by the /admin console (Store & verification ->
// Privacy policies) and read by the browser on app-privacy.html?id=<app-id>.
//
// Format - one entry per app id from data/apps.js:
//   "app-id": {
//     updated: "YYYY-MM-DD",                  // date of the last save
//     status:  "draft" | "completed",         // completed = ready to paste
//                                             // into the Play Store Console
//     content: "<h2>Heading</h2><p>Text</p>"  // HTML rendered on the public
//                                             // privacy page for the app
//   }
//
// While an app has no entry (or empty content), the public page continues to
// show the default working template instead. Every app must have a completed
// policy linked from its Google Play listing before it goes live.
// ---------------------------------------------------------------------------

export const appPolicies = {};