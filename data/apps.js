// ---------------------------------------------------------------------------
// MT Core Studio - application directory data
// ---------------------------------------------------------------------------
// This is the ONLY file you edit to add or update an app on the website.
// Add one object per app to the `apps` array, then upload the changed file.
// (The /admin console edits this file for you automatically.)
//
// Supported fields:
//   id          unique lowercase slug used in the app detail URL (app.html?id=...)
//   name        app display name
//   category    use one of: Productivity, Education, Lifestyle, Entertainment,
//               Tools, Other  (new categories are added automatically)
//   platform    always "Android" for now
//   description short, honest summary shown on cards and the detail page
//   icon        path to the app icon, e.g. "assets/apps/daily-spark.png".
//               Leave "" to show a generated monogram tile instead.
//   screenshots array of image paths shown on the detail page ("" when none)
//   features    array of short feature bullets shown on the detail page
//   playStoreUrl official Google Play listing URL; leave blank until published.
//   status      keep "Status to be confirmed" until the app is live. Once it is
//               verified on Google Play, change it to "Published" so it appears
//               on the Publisher page and its store button activates.
//   privacyUrl  link to the app's completed privacy policy ("" until ready).
//               When in progress, point it at the generated template instead:
//               "app-privacy.html?id=daily-spark" - complete the policy on that
//               page before each app launches (see app-privacy.html).
//   termsUrl    link to the app's Terms of Service ("" until ready). Tip: in the
//               /admin app editor you can paste one GitHub Pages link and it
//               auto-fills both privacyUrl and termsUrl (e.g.
//               https://mtcorestudio.github.io/daily-spark-privacy/).
//
// IMPORTANT: never invent ratings, download counts, reviews, user numbers,
// revenue or statistics. Only publish information that has been verified.
// ---------------------------------------------------------------------------

export const apps = [
  {
    id: "daily-spark",
    name: "Daily Spark",
    category: "Lifestyle",
    platform: "Android",
    description:
      "A fresh, thoughtful idea or prompt every day - a small spark of motivation to help you start each morning with clarity, focus and a calmer mindset.",
    icon: "assets/apps/com-dailyspark-quotes.png",
    screenshots: [
      "assets/apps/daily-spark-1.svg",
      "assets/apps/daily-spark-2.svg"
    ],
    features: [
      "A new daily prompt designed to begin the day with focus",
      "A browsable archive of past daily sparks",
      "Reminders that fit your morning routine",
      "Clean, calm interface with dark and light themes",
      "Weightless and fast on every Android device"
    ],
    packageName: "com.dailyspark.quotes",
    playStoreUrl: "",
    privacyUrl: "app-privacy.html?id=daily-spark",
    termsUrl: "",
    status: "Status to be confirmed"
  },
  {
    id: "nursing-exam-preparation",
    name: "Nursing Exam Preparation",
    category: "Education",
    platform: "Android",
    description:
      "A focused study companion for nursing students. Review core topics, practice in short sessions and track your readiness ahead of exams.",
    icon: "assets/apps/com-nurseexampreparation-nursing.png",
    screenshots: [
      "assets/apps/nursing-exam-1.svg",
      "assets/apps/nursing-exam-2.svg"
    ],
    features: [
      "Organized question sets covering core nursing topics",
      "Practice and review modes for difficult areas",
      "Progress tracking to show where to focus next",
      "Timed practice sessions that mirror real exam pacing",
      "Mobile-first layout tuned for short study sessions",
      "Readable design that keeps revision calm and clear"
    ],
    packageName: "com.nurseexampreparation.nursing",
    playStoreUrl: "",
    privacyUrl: "app-privacy.html?id=nursing-exam-preparation",
    termsUrl: "",
    status: "Status to be confirmed"
  },
  {
    id: "shift-schedule",
    name: "Shift Schedule",
    category: "Productivity",
    platform: "Android",
    description:
      "A simple planner for people who work rotating or irregular hours. Keep a clear view of upcoming shifts and organize your week with less mental effort.",
    icon: "assets/apps/shift-schedule.svg",
    screenshots: [
      "assets/apps/shift-schedule-1.svg",
      "assets/apps/shift-schedule-2.svg"
    ],
    features: [
      "At-a-glance view of your upcoming shifts",
      "Built for rotating and irregular shift patterns",
      "Quick day-by-day planning around your routine",
      "Color-coded shift types that are easy to scan",
      "Comfortable dark and light themes for day or night",
      "Lightweight and smooth on entry-level devices"
    ],
    packageName: "",
    playStoreUrl: "",
    privacyUrl: "app-privacy.html?id=shift-schedule",
    termsUrl: "",
    status: "Status to be confirmed"
  }
];