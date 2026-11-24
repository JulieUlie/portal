# Web apps portal

All of Julie Toussaint's web apps in one place. Pick one and open it right in your browser.

**Live:** https://apps.julietous.workers.dev

## How it works

- All content comes from `site/apps.json`. To add an app, you add one object there, optionally with an image in `site/img/`. The `_readme` field at the top of that file describes every option.
- Search, category filter, language and the selected app are kept in the URL (`?q=…&cat=…&lang=nl#slug`), so every view can be shared as a link.
- The portal is available in English (the default) and Dutch, and remembers the visitor's choice.
- It is vanilla HTML, CSS and JavaScript, with no build step.

## Motion

Every animation has a job: it shows where something came from or where it went.

- **Load:** a rainbow scan line runs down the screen, and each card powers on like a CRT (a thin bright line that opens into the banner) as the line reaches it.
- **Sort and filter:** cards that stay on screen glide to their new place (FLIP), and new ones power on.
- **Paging:** the current page leaves against the direction of travel and the next one slides in with it (buttons, arrow keys, swipe or mouse wheel).
- **Details:** the pop-up grows out of the card you clicked. The banner travels into place first and the details unfold under it. Closing (button, backdrop, Esc or Back) shrinks it back into the card.
- **Hover:** cards tilt toward the pointer with a moving glare, and a spotlight lights up the background grid around the cursor.
- **Small touches:** the language pill slides between EN and NL, the picked category chip pulses, the sort icon spins when it swaps, and the "new" dot pings.
- Rainbow borders and glows rotate a pre-drawn gradient layer on one shared clock, so many cards stay cheap to draw. Visitors with `prefers-reduced-motion` get no animation at all.

## Run locally

```bash
python -m http.server --directory site
```

## Deployment

Static assets on Cloudflare Workers: `npx wrangler deploy`.
