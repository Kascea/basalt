import { DatabaseService } from '../../bindings/basalt/db'
import type { CommitPayload, ConnectRequest, FKViolation, QueryResult, SchemaObject, Connection } from '../../bindings/basalt/db'

// Single seam between the frontend and the Wails RPC bindings.
// All error normalization and type coercions live here so hooks stay clean.

function rethrow(err: unknown): never {
  throw err instanceof Error ? err : new Error(String(err))
}

export const DatabaseClient = {
  connect(request: ConnectRequest): Promise<Connection> {
    return DatabaseService.Connect(request).catch(rethrow)
  },

  connectSaved(id: string): Promise<Connection> {
    return DatabaseService.ConnectSaved(id).catch(rethrow)
  },

  disconnect(id: string): Promise<void> {
    return DatabaseService.DisconnectConnection(id).catch(rethrow)
  },

  listSchemaObjects(connID: string): Promise<SchemaObject[]> {
    return DatabaseService.ListSchemaObjects(connID).catch(rethrow)
  },

  fetchTable(connID: string, schema: string, table: string, filter: string, page = 0, pageSize = 0): Promise<QueryResult> {
    return DatabaseService.FetchTable(connID, schema, table, filter, page, pageSize).catch(rethrow)
  },

  executeQuery(connID: string, sql: string): Promise<QueryResult> {
    return DatabaseService.ExecuteQuery(connID, sql).catch(rethrow)
  },

  explainQuery(connID: string, sql: string): Promise<string[]> {
    return DatabaseService.ExplainQuery(connID, sql).catch(rethrow)
  },

  commitTableEdits(connID: string, payload: CommitPayload): Promise<FKViolation | null> {
    return DatabaseService.CommitTableEdits(connID, payload).catch(rethrow)
  },

  getNextSequenceValues(connID: string, schema: string, table: string): Promise<Record<string, string | undefined>> {
    return DatabaseService.GetNextSequenceValues(connID, schema, table).catch(rethrow)
  },

  writeFile(path: string, content: string): Promise<void> {
    return DatabaseService.WriteFile(path, content).catch(rethrow)
  },

  readFile(path: string): Promise<string> {
    return DatabaseService.ReadFile(path).catch(rethrow)
  },
}
