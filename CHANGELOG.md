# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [x.x.x] - YYYY-MM-DD

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
