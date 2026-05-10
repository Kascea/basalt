# Basalt

Basalt is a native database GUI editor built with Wails, Go, and React.

The goal is a fast desktop workflow for browsing schemas, writing SQL, inspecting plans, and editing query results in a spreadsheet-like grid across databases such as PostgreSQL, MySQL, and SQLite.

## Development

```sh
wails3 dev
```

## Build

```sh
wails3 build
```

## Current Prototype

- Wails v3 app shell with a React + TypeScript frontend
- Universal connection browser with Postgres, MySQL, and SQLite sample connections
- Schema/object browser
- SQL worksheet with result, structure, and plan tabs
- Editable result grid with pending-cell tracking

## Next Targets

- Add real connection profiles and secure local credential storage
- Start with a PostgreSQL driver and table metadata introspection
- Generate `UPDATE` statements from edited grid cells using primary keys
- Add keyboard shortcuts for run statement, commit, rollback, and tab navigation
