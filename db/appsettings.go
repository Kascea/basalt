package db

import "basalt/config"

func (d *DatabaseService) GetSettings() config.AppSettings {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.settings
}

func (d *DatabaseService) SaveSettings(s config.AppSettings) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.settings = s
	return config.SaveAppSettings(s)
}
