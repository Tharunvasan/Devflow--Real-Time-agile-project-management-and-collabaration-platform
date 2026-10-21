# Changelog

All notable changes to the DevFlow project during this implementation phase are documented here.

## [1.1.0] - Production Stabilization & Agile Upgrade

### Added
- **Agile Metrics:** Added `storyPoints`, `estimatedHours`, and `isBlocked` tracking to Tasks.
- **Sprint Completion Engine:** Sprints now auto-eject incomplete tasks back to the product backlog upon completion and accurately calculate completed story points.
- **Dashboard Analytics:** Added comprehensive StatCards for Blocked Tasks, Overdue Tasks, and assignee workload aggregation.
- **Automated Testing:** Added full Jest + MongoDB-Memory-Server integration in the backend with `Task.test.ts`.
- **GitHub Actions CI/CD:** Added robust `.github/workflows/ci.yml` pipeline that runs linting, type-checks, tests, and builds.
- **GitHub Integration:** Added `/api/github/webhook/:projectId` webhook receiver endpoint capable of closing tasks via commit messages (`Fixes #ID`).
- **Reports:** Generated `IMPLEMENTATION_STATUS.md` and `AUDIT_REPORT.md`.

### Changed
- **Socket.IO Security:** `join:project` event now strictly queries MongoDB to guarantee the connecting user is an authorized project member.
- **Kanban Board:** Added dynamic visual badges for blocked states and story points on `TaskCard`.
- **Task/Issue Controllers:** Re-wrote creation and update endpoints to explicitly reject assignments of non-project members.
- **Docker Compose:** Secured MongoDB container by removing the public `27017:27017` port map.
- **README.md:** Updated with full GitHub Integration instructions.

### Fixed
- **Kanban Empty States:** Fixed drag-and-drop bug where users could not drop tasks into an empty Kanban column (added `useDroppable`).
- **Build Errors:** Fixed internal missing TypeScript interface fields for new `storyPoints` parameters.
