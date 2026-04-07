# Changelog

All notable changes to this project will be documented in this file.

## [0.4.5] - 2026-04-07

### Belt Statistics
- Added a dedicated **Belt Statistics** dashboard with detailed tracking of Faction Subcapitals, Hauler NPCs, and Officer spawns.
- Implemented **Hourly & Weekly Activity** charts for belt tracking with trend-line mapping and special outcome percentages.
- Added a comprehensive **Belt History** modal with run-time duration tracking and infinite scrolling support.

### Added
- Added **Hourly & Daily Analysis** for **Combat Statistics** charts featuring a layered HUD aesthetic with site count bars and success rate trend lines for better performance tracking.

### Application Updates
- Added a "Close Application" button to update notifications to help users exit the app before running a new installer.
- Redesigned the update check UI in Settings with a more visible button and status text.
- Added an "Exit App to Update" button to the Settings page for easier installation of downloaded releases.

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
