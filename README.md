# Dog Walk Tracker PWA

A PWA to plan and track dog walks with real-time GPS and manual route drawing.

## Setup

1. **Clone** the repo:
   ```bash
   git clone https://github.com/yourusername/dog-walk-tracker.git
   cd dog-walk-tracker
   ```
2. **Serve** locally:
   * Using VSCode Live Server, *or*
   * Install a static server: `npm install -g serve`, then `serve`.
   Open the URL shown (e.g., [http://localhost:5000](http://localhost:5000)).
3. **Deploy** on GitHub Pages:
   * Push to `main` branch.
   * In repo Settings → Pages → set Source to `main`/`/ (root)`.

## TODO / Future Improvements

* Auto‑generate circular route by target distance using a routing API (e.g., OpenRouteService).
* Allow address search autocomplete instead of plain text input.
* Persist walk history in LocalStorage or a backend.
* Polish offline support (fallback page).
* Replace placeholder paw icons.
