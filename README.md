# Web apps portal

All of Julie Toussaint's web apps in one place. Pick one and open it right in your browser.

**Live:** https://apps.julietous.workers.dev

## How it works

- All content comes from `site/apps.json`. To add an app, you add one object there, optionally with an image in `site/img/`. The `_readme` field at the top of that file describes every option.
- Search, category filter, language and the selected app are kept in the URL (`?q=…&cat=…&lang=nl#slug`), so every view can be shared as a link.
- The portal is available in English (the default) and Dutch, and remembers the visitor's choice.
- It is vanilla HTML, CSS and JavaScript, with no build step.

## Run locally

```bash
python -m http.server --directory site
```

## Deployment

Static assets on Cloudflare Workers: `npx wrangler deploy`.
