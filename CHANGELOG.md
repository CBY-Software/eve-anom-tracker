# Changelog

All notable changes to this project will be documented in this file.

## [0.4.8] - 2026-05-09

### Income & Statistics
- Added **Active Character** count to the Income Stats summary to track unique contributing characters.
- Added **Total Active Time** display to the Income Stats dashboard for better visibility of merged activity windows.
- Added an **Income Statistics** feature toggle in Settings to show/hide the module from the main menu.
- Implemented a customizable **Minimum Payout** filter in Settings to ignore small bounty and ESS payouts (defaulting to 100,000 ISK).


## [0.4.7] - 2026-05-01

### Combat Log & UI
- Renamed **Recent** section to **Recent Sites** for better clarity.
- Added **Site Duration** display to recent logs to track time spent per anomaly.
- Implemented **Clear History** button in Combat Log with confirmation dialog.
- Added logic to only clear history older than 12 hours or since last daily reset.
- Fixed a bug where deleting a log entry would not update the recent site count display.

## [0.4.6] - 2026-04-17

### Application
- Added feature toggles in Settings to show or hide **Combat Anomaly Tracking** and **Belt Tracking** modules.
- Fixed a bug where feature toggles would reset to defaults after a restart.
- Fixed an issue where the application window would not resize correctly when switching views.

### Income & Statistics
- Fixed a SQL syntax error in the Income Stats dashboard when filtering for "All Time".
- Added **Est. Income / Hour** metric to the Income Stats dashboard.
- Implemented **Global Setup Throughput** calculation by merging overlapping activity windows across all active characters.
- Added a noise filter to exclude bounty payouts under 100,000 ISK from hourly efficiency calculations.
- Fixed an issue where the Income Stats dashboard would appear empty on initial load.
- Set default filter to "Today" on the Income Stats screen for better immediate visibility.
- Added automatic data refresh in Income Stats after a wallet sync completes.
- Refined Income Analysis UI with neutral status colors for "High" data points.
- Optimized Income Stats horizontal layout to prevent overflow when using Custom Range filters.


## [0.4.5] - 2026-04-17

### Janice API & Loot Appraisal
- Added automated loot appraisal integration with **janice.e-351.com**.

### Income & Statistics
- Added manual income logging and journal filtering (All | API | Manual).
- Fixed EVE (UTC) date synchronization for manual income records.
- Added a dedicated **Belt Statistics** dashboard and history view.
- Added hourly and daily analysis charts for Combat and Belt statistics.

### Application
- Added update notifications and manual update check functionality.
- Enhanced update check UI in settings with simplified "Exit App to Update" options.


## [0.4.4] - 2026-04-03
### Added
- Implemented site duration tracking to show time spent in anomalies.

### Fixed
- Fixed database corruption on restore by cleaning up existing WAL and SHM files.

### Improved
- Manual and automatic backups now include SQLite WAL and SHM files for better data consistency.
- Automatic backups are now disabled in development sessions.

## [0.4.3] - 2026-03-28
### Added
- Added a restore backup function to settings and database.


## [0.4.2-beta] - 2026-03-22
### Added
- Added GitHub-based update notification system.
- Added Application Information section to Settings.
- Added manual update check functionality to Settings.
- Added system browser support for external URLs.

## [0.4.0-beta] - 2026-03-13
- Initial stable beta release.
- Core tracking logic for anomalies and belt spawns.
- Data backup and settings persistence.
