# Change Note & Changelog Rules

## 1. General Principles
- **User-Facing Value Only:** Only document changes that a user can see, click, or experience directly.
- **Concise & High-Level:** Each bullet point must be a summary of the *result*, not a log of the *work*.
- **No Implementation Details:** Strictly forbidden to list file names, function names, terminal commands, or internal logic steps.
- **No Application Version Changes:** Strictly forbidden to change application internal versioning unless explicitly asked to.

## 2. The "Internal Plumbing" Filter
Do NOT list the following types of technical tasks. Instead, fold them into the high-level feature bullet or omit them entirely:
- **Routing/Logic:** (e.g., "Integrated auto-redirection," "Added conditional rendering logic").
- **State/Data:** (e.g., "Updated Redux store," "Modified API endpoint schema").
- **Refactoring:** (e.g., "Cleaned up CSS," "Refactored component to use hooks").
- **Boilerplate:** (e.g., "Added prop-types," "Updated dependencies").

## 3. The "So What?" Test
Before adding a bullet point, ask: *"If a user read this, would they understand what changed in their experience?"* - If the answer is "No" (e.g., "Handled navigation logic for disabled views"), **OMIT IT**. 
- The user only cares that the view is disabled; they assume the navigation works.

## 4. Structure & Formatting
- **Version Header:** `## [Version] - YYYY-MM-DD`
- **Categorization:** Group by feature area (e.g., `### Application`) or standard labels (`### Added`, `### Fixed`).
- **Bullet Style:** Use a simple dash `-`.
- **Length:** Maximum one sentence per bullet.

## 5. Examples
- **BAD:** "Integrated auto-redirection logic for disabled views to ensure a smooth user experience."
- **GOOD:** "Added feature toggles to show or hide Combat Anomaly and Belt Tracking modules."
- **BAD:** "Updated SQLite queries to fetch data from the belts table."
- **GOOD:** "Fixed a bug where belt statistics were not loading correctly."