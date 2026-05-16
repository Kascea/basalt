package db

import "os"

func (d *DatabaseService) ReadFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (d *DatabaseService) WriteFile(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}

func (d *DatabaseService) PickSQLiteFile() (string, error) {
	if d.App == nil {
		return "", nil
	}
	return d.App.Dialog.OpenFile().
		SetTitle("Select SQLite Database").
		AddFilter("SQLite Database", "*.db;*.sqlite;*.sqlite3").
		AllowsOtherFileTypes(true).
		PromptForSingleSelection()
}
