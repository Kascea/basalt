package main

import (
	"strings"
	"time"
)

type Connection struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Driver   string `json:"driver"`
	User     string `json:"user"`
	Host     string `json:"host"`
	Service  string `json:"service"`
	Status   string `json:"status"`
	LastUsed string `json:"lastUsed"`
}

type SchemaObject struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Schema   string `json:"schema"`
	Rows     int    `json:"rows"`
	Modified string `json:"modified"`
}

type QueryResult struct {
	Columns     []string              `json:"columns"`
	Rows        []map[string]string   `json:"rows"`
	DurationMS  int                   `json:"durationMs"`
	Message     string                `json:"message"`
	Plan        []ExecutionPlanStep   `json:"plan"`
	ObjectStats []SchemaObjectSummary `json:"objectStats"`
}

type ExecutionPlanStep struct {
	ID        int    `json:"id"`
	Operation string `json:"operation"`
	Object    string `json:"object"`
	Cost      int    `json:"cost"`
	Rows      int    `json:"rows"`
}

type SchemaObjectSummary struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

type DatabaseService struct{}

func (d *DatabaseService) ListConnections() []Connection {
	return []Connection{
		{
			ID:       "finance-prod",
			Name:     "Production",
			Driver:   "PostgreSQL",
			User:     "readonly",
			Host:     "db.prod.internal",
			Service:  "core_app",
			Status:   "Connected",
			LastUsed: "Today 09:42",
		},
		{
			ID:       "warehouse-dev",
			Name:     "Warehouse",
			Driver:   "PostgreSQL",
			User:     "analyst",
			Host:     "localhost",
			Service:  "warehouse",
			Status:   "Saved",
			LastUsed: "Yesterday",
		},
		{
			ID:       "billing-mysql",
			Name:     "Billing",
			Driver:   "MySQL",
			User:     "app_admin",
			Host:     "mysql.internal",
			Service:  "billing",
			Status:   "Saved",
			LastUsed: "May 06",
		},
		{
			ID:       "local-sqlite",
			Name:     "Local Scratch",
			Driver:   "SQLite",
			User:     "local",
			Host:     "disk",
			Service:  "scratch.db",
			Status:   "Saved",
			LastUsed: "May 04",
		},
	}
}

func (d *DatabaseService) ListSchemaObjects(connectionID string) []SchemaObject {
	now := time.Now().Add(-6 * time.Hour).Format("Jan 02 15:04")

	if connectionID == "warehouse-dev" {
		return []SchemaObject{
			{Name: "fact_orders", Type: "Table", Schema: "analytics", Rows: 492018, Modified: now},
			{Name: "dim_customer", Type: "Table", Schema: "analytics", Rows: 82145, Modified: "May 08 18:20"},
			{Name: "vw_revenue_daily", Type: "View", Schema: "analytics", Rows: 0, Modified: "May 05 11:34"},
			{Name: "refresh_order_rollups", Type: "Function", Schema: "jobs", Rows: 0, Modified: "Apr 29 16:12"},
		}
	}

	return []SchemaObject{
		{Name: "customers", Type: "Table", Schema: "public", Rows: 82451, Modified: now},
		{Name: "invoices", Type: "Table", Schema: "public", Rows: 182773, Modified: "May 08 17:51"},
		{Name: "payments", Type: "Table", Schema: "public", Rows: 179914, Modified: "May 08 17:49"},
		{Name: "open_balances", Type: "View", Schema: "finance", Rows: 0, Modified: "May 07 07:15"},
		{Name: "sync_customer_status", Type: "Function", Schema: "jobs", Rows: 0, Modified: "Apr 28 13:08"},
		{Name: "idx_invoices_customer", Type: "Index", Schema: "public", Rows: 0, Modified: "Apr 18 21:30"},
	}
}

func (d *DatabaseService) ExecuteQuery(connectionID string, sql string) QueryResult {
	trimmed := strings.TrimSpace(sql)
	if trimmed == "" {
		return QueryResult{
			Columns:    []string{"INFO"},
			Rows:       []map[string]string{{"INFO": "Write a SQL statement, then run it."}},
			DurationMS: 0,
			Message:    "No statement executed",
		}
	}

	return QueryResult{
		Columns: []string{"id", "name", "status", "monthly_spend", "last_seen"},
		Rows: []map[string]string{
			{"id": "10042", "name": "Northline Systems", "status": "active", "monthly_spend": "12430.20", "last_seen": "2026-05-08"},
			{"id": "10077", "name": "Keystone Medical", "status": "active", "monthly_spend": "8219.00", "last_seen": "2026-05-07"},
			{"id": "10110", "name": "Canyon Retail Group", "status": "paused", "monthly_spend": "31002.44", "last_seen": "2026-05-03"},
			{"id": "10182", "name": "Valence Labs", "status": "active", "monthly_spend": "2104.78", "last_seen": "2026-05-01"},
		},
		DurationMS: 43,
		Message:    "4 rows fetched from " + connectionID,
		Plan: []ExecutionPlanStep{
			{ID: 0, Operation: "Limit", Object: "", Cost: 18, Rows: 4},
			{ID: 1, Operation: "Nested Loop", Object: "", Cost: 18, Rows: 4},
			{ID: 2, Operation: "Index Scan", Object: "customers_pkey", Cost: 7, Rows: 4},
			{ID: 3, Operation: "Bitmap Index Scan", Object: "idx_customers_status", Cost: 3, Rows: 12},
			{ID: 4, Operation: "Seq Scan", Object: "open_balances", Cost: 10, Rows: 4},
		},
		ObjectStats: []SchemaObjectSummary{
			{Label: "Tables", Count: 3},
			{Label: "Views", Count: 1},
			{Label: "Functions", Count: 1},
			{Label: "Indexes", Count: 1},
		},
	}
}
