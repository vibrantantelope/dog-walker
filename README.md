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

1. On page load the map attempts to center on your current location.
   Allow geolocation access when prompted.
2. Enter a start location and click **Set Start** if you want to override the
   detected location.
3. Input a desired distance and select your preferred unit.
4. Choose a **Walk Preference**:
   * **Scenic** – generates a longer, more varied loop.
   * **Shortest** – aims for the quickest route back to the start.
5. Copy `config.js.example` to `config.js` and add your OpenRouteService API key.
6. Click **Plan Route for Me** to automatically create a circular walk. The
   generated route tries to stick to streets and avoid narrow alleys. When the
   **Shortest** preference is selected fewer turn points are used for a more
   direct loop.
7. Or use **Plan Walk (draw route)** to draw a route manually.
8. Click **Start Tracking** to record your walk in real time. A pulsating dot shows your current location while tracking. The app now requests a screen wake lock so the phone doesn't automatically sleep during tracking. Use **Pause** and **Resume** to temporarily stop or continue tracking. Use **Stop Tracking** to finish recording.
9. Click **Save Walk** to store the tracked route. Use **Load Walk** to display the last saved route.
10. Use **Clear Walk** to remove any planned or tracked route and reset the stats.
11. On small screens tap the **☰** button to show or hide the controls.

## TODO / Future Improvements

* Persist walk history in LocalStorage or a backend.
* Polish offline support (fallback page).
* Replace placeholder paw icons.
