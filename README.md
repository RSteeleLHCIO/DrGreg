DrGreg (preview)

This repository contains a small Vite + React preview created to run the original DrGreg UI locally.

Quick start

1. Install dependencies

```powershell
npm install
```

2. Run the dev server

```powershell
npm run dev
```

Open the app at http://localhost:5173/ in your browser.

Notes

- The preview mounts `src/App.jsx` (this file contains the ported app logic).
- Small UI shim components are under `src/components/ui/` and provide minimal styling/behavior for the preview.
- If you have the original `main.js`, it is not required for the preview and may be removed or kept for reference.

If you'd like, I can tidy the CSS or add a small test harness next.
