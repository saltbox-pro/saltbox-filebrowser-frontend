# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [X.X.X] - YYYY-MM-DD

### Added

### Changed

- `SourceScope.readOnly` is now computed on the client from a static list of
  read-only source names instead of a native API field, since FileBrowser
  does not expose one and its own per-scope permissions are unreliable under
  the `noauth` method Saltbox uses.

### Fixed

- `getScopes()` sent the removed `id=self` query parameter to
  `/public/api/users`, causing every file browser page load to fail.
- File viewing and downloading called the removed `/api/raw` endpoint,
  causing every open or download action to fail.
- Renaming a file or folder sent query parameters FileBrowser no longer
  accepts, causing every rename to fail.

## [0.4.0] - 2026-10-13

### Added

- File download support in the file browser module.
- Upload progress panel in the toolbar; upload progress now persists after
  leaving the page.
- File Browser page state synced with the URL query string.
- Error boundaries wired for the module and its routes.

### Changed

- File browser migrated onto the shared common `FileBrowser` UI components:
  notifications by item kind, HTTP mutation handling, hover row actions,
  read-only scope action restrictions, path-copy button, upload modal,
  content view/edit modes, toolbar listing reload, and shared error handling
  for mutations.
- Column resizing enabled in the file browser table (rollout scoped to this
  module only).

### Fixed

## [0.4.0] - 2026-10-13

### Added

- File download support in the file browser module.
- Upload progress panel in the toolbar; upload progress now persists after
  leaving the page.
- File Browser page state synced with the URL query string.
- Error boundaries wired for the module and its routes.

### Changed

- File browser migrated onto the shared common `FileBrowser` UI components:
  notifications by item kind, HTTP mutation handling, hover row actions,
  read-only scope action restrictions, path-copy button, upload modal,
  content view/edit modes, toolbar listing reload, and shared error handling
  for mutations.
- Column resizing enabled in the file browser table (rollout scoped to this
  module only).

### Fixed
