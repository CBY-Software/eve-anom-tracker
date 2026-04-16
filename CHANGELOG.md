# Changelog

All notable changes to this project will be documented in this file.

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
