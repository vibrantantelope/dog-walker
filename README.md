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

## Usage

1. Enter a start location and click **Set Start**.
2. Input a desired distance in meters.
3. Click **Plan Route for Me** to automatically create a circular walk.
   Set your OpenRouteService API key in `app.js`.
4. Or use **Plan Walk (draw route)** to draw a route manually.

## TODO / Future Improvements

* Persist walk history in LocalStorage or a backend.
* Polish offline support (fallback page).
* Replace placeholder paw icons.
