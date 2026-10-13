App icons folder
================

Drop an app icon image here for each app you add, for example:

    assets/apps/daily-spark.png

Then reference it in `data/apps.js` with the `icon` field:

    icon: "assets/apps/daily-spark.png"

Recommended icon: a 512x512 square PNG named after the app's `id`.
While `icon` is empty, the website shows a clean monogram tile instead,
so nothing breaks if an icon is missing.
