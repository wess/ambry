# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-06-04

### Added

- App icon (`assets/icon.icns`) wired through `window.icon`, so the bundled `.app`, Dock, and Finder show a branded icon.

### Changed

- Release builds are now signed with a Developer ID Application certificate, hardened-runtime + JIT entitlements, and notarized + stapled in CI, so the DMG installs without the "unidentified developer" Gatekeeper warning.

## [1.0.1] - 2026-05-31

### Added

- `tsconfig.json` and a `typecheck` script that gates `bun run build`, so type errors block compilation and releases.
- Automated test suite (`bun test`) covering CSV parsing and import SQL generation, schema comparison, the SQLite adapter, connection storage round-trips, and mock-data generation.
- `LICENSE` file (MIT).

### Fixed

- Export fallback referenced an undefined `defaultName` identifier, throwing a `ReferenceError` when the chosen filename was empty. It now falls back to the table-based default name.
- Resolved a duplicate `Settings` identifier in the connection route (the Lucide icon now imports as `SettingsIcon`).
- Added `ssl`, `ssh`, and `startupCommands` to the `StoredConnection` type and removed the `as any` cast that masked the field mismatch during database switching.

### Changed

- README corrected: removed dead links to `TODO.md` and `SPEC.md`, updated the source-file count, documented the macOS (Apple Silicon) platform scope, and linked the new `LICENSE`.

## [1.0.0]

### Added

- Initial release. Cross-database client for PostgreSQL, MySQL/MariaDB, and SQLite built on Butter, React 19, and Mantine 8.
- Connection management, SQL editor, data grid with inline editing, schema tools, ER diagram, import/export, mock data, macros, command palette, and settings.
