# Basalt — Domain Vocabulary

This file defines the domain language for Basalt, a native desktop database GUI.
Use these terms in code, comments, and architecture reviews.

## Core Concepts

**Connection** — a live or saved link to a database server. Carries driver, credentials, and status.
A connection produces a unique `connectionID` used to route all service calls.

**Driver** — the database engine behind a connection: `postgres`, `mysql`, or `sqlite`.
Driver identity governs which SQL dialect, row-addressing scheme, and introspection queries apply.

**Introspector** — the per-driver adapter that knows how to interrogate a database's own metadata.
Responsible for listing schema objects, reporting object stats, cataloging column types,
and expressing row-addressing (how to SELECT and WHERE a specific physical row).

**Schema Object** — a named, typed item in the database: Table, View, Materialized View, Index, Sequence.
Belongs to a schema (namespace). Displayed in the sidebar and Structure tab.

**Table State** — the in-memory edit buffer for a table tab: fetched rows, dirty cells, new rows, pending deletes, filter expression, and async status flags (loading, refreshing, committing).

**Worksheet State** — the in-memory state for a SQL worksheet tab: the SQL text, the last query result, dirty cells on the result grid, and the running flag.

**Row ID** — an opaque string that uniquely identifies a physical row within a driver's storage.
For PostgreSQL this is the `ctid`; for other drivers it is driver-specific.
The frontend treats Row IDs as opaque tokens; only the backend interprets them.

**Query Result** — the value returned by FetchTable or ExecuteQuery: column names, column types,
row data (as string maps), Row IDs (parallel to rows, only populated by FetchTable),
duration, message, explain plan steps, and object stats.

**Commit Payload** — the grouped set of row inserts, edits, and deletes accumulated from a Table State,
sent to the backend in a single transaction.

**Tab** — a workspace panel. Kind is one of: `worksheet`, `table`, `schema`, `sequences`, `indexes`, `foreignkeys`.

**Column Category** — a coarse classification of a column's DB type used for input filtering in the grid:
`numeric`, `boolean`, or `text`. Derived from the column type string returned by the backend.

## Module Vocabulary

**WorkspaceSession** — the shared context object consumed by the Workspace component.
Grouped into namespaces: `connection`, `tabs`, `tableEditor`, `worksheet`, `status`.

**TableEditor** — the set of operations that mutate a Table State: cell edits, new rows, deletions,
discard, commit, refresh, and filter. Lives in `useTableTabs`.

**Worksheet** — the SQL editing surface combining the CodeMirror editor and result grid.
