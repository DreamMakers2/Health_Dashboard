# Health Dashboard

Local-first workout and body-metrics dashboard that runs on a tiny Node.js server.

## Quick start
- Clone or download this repo.
- Install Node.js.
- Start the server:
  - Windows: run `launch_dashboard.bat`. It starts the server on `http://localhost:3003` and opens a browser window.
  - Any OS: run `node server.js` and open `http://localhost:3000` in your browser.
  - To change the port, set `PORT` before launching (for example, `PORT=3005 node server.js`).

## Using the dashboard
- Log workouts on the schedule cards and add cardio minutes.
- Add body metrics (weight, fat %, muscle %) in the right-hand panel.
- Use the Progress range toggle to switch between 30 days, 90 days, or all-time views.
- Use the calendar to jump to a scheduled day or add/remove a custom workout day (click again to remove if empty, confirm to delete if it has data).
- Use Settings to adjust schedule days, visible weeks, exercise list, and kcal formulas.
- Formula inputs accept `bw` (body weight in kg) and `load` (external weight in kg).

## Data and settings
- All data is stored locally on your machine.
- `data/health.json` stores workouts, metrics, and profile data.
- `data/health.backup.json` is written alongside the main file as a safety copy.
- `config.json` stores the default schedule, exercises, formulas, and theme; settings changes update this file automatically.
- The `data/` folder is ignored by git. Commit `config.json` if you want shared defaults.

## Reset or move data
- To reset, stop the server and delete `data/health.json` (and the backup).
- To move data, copy the `data/` folder to another machine and start the server once.

## Add to startup (Windows)
Option 1: Startup folder
- Press `Win + R`, type `shell:startup`, press Enter.
- Create a shortcut to `launch_dashboard.bat` in that folder.

Option 2: Task Scheduler
- Create a new task that runs `launch_dashboard.bat` at logon.
