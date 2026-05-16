package main

import (
	"basalt/db"
	"basalt/localdb"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type menuState struct {
	app        *application.App
	dbSvc      *db.DatabaseService
	appSvc     *localdb.Service
	recentMenu *application.Menu
	tray       *application.SystemTray
}

func buildMenus(app *application.App, dbSvc *db.DatabaseService, appSvc *localdb.Service) func() {
	ms := &menuState{app: app, dbSvc: dbSvc, appSvc: appSvc}
	app.Menu.Set(ms.buildAppMenu())
	ms.tray = ms.buildSystemTray()
	return ms.rebuildDynamic
}

func (ms *menuState) buildAppMenu() *application.Menu {
	menu := application.NewMenu()

	basalt := menu.AddSubmenu("Basalt")
	basalt.AddRole(application.About)
	basalt.AddSeparator()
	basalt.Add("Settings...").
		SetAccelerator("CmdOrCtrl+,").
		OnClick(func(*application.Context) { ms.app.Event.Emit("menu:settings") })
	basalt.AddSeparator()
	basalt.AddRole(application.Hide)
	basalt.AddRole(application.HideOthers)
	basalt.AddRole(application.ShowAll)
	basalt.AddSeparator()
	basalt.AddRole(application.Quit)

	file := menu.AddSubmenu("File")
	file.Add("New Connection...").
		SetAccelerator("CmdOrCtrl+N").
		OnClick(func(*application.Context) { ms.app.Event.Emit("menu:new-connection") })
	ms.recentMenu = file.AddSubmenu("Recent Connections")
	ms.populateRecentMenuFrom(ms.appSvc.ListSavedConnections())
	file.AddSeparator()
	file.Add("Close Connection").
		OnClick(func(*application.Context) { ms.app.Event.Emit("menu:close-connection") })

	edit := menu.AddSubmenu("Edit")
	edit.AddRole(application.Undo)
	edit.AddRole(application.Redo)
	edit.AddSeparator()
	edit.AddRole(application.Cut)
	edit.AddRole(application.Copy)
	edit.AddRole(application.Paste)
	edit.AddSeparator()
	edit.AddRole(application.SelectAll)

	dbMenu := menu.AddSubmenu("Database")
	dbMenu.Add("Run Query").
		SetAccelerator("CmdOrCtrl+Return").
		OnClick(func(*application.Context) { ms.app.Event.Emit("menu:run-query") })
	dbMenu.Add("Refresh Schema").
		SetAccelerator("CmdOrCtrl+Shift+R").
		OnClick(func(*application.Context) { ms.app.Event.Emit("menu:refresh-schema") })

	return menu
}

func (ms *menuState) rebuildDynamic() {
	saved := ms.appSvc.ListSavedConnections()
	ms.populateRecentMenuFrom(saved)
	ms.recentMenu.Update()
	ms.tray.SetMenu(ms.buildTrayMenuFrom(saved))
}

func (ms *menuState) populateRecentMenuFrom(saved []localdb.SavedConnection) {
	ms.recentMenu.Clear()
	if len(saved) == 0 {
		ms.recentMenu.Add("No Recent Connections").SetEnabled(false)
		return
	}
	for _, conn := range saved {
		c := conn
		ms.recentMenu.Add(c.Name).OnClick(func(*application.Context) {
			ms.app.Event.Emit("menu:connect-saved", c.ID)
		})
	}
}

func (ms *menuState) buildSystemTray() *application.SystemTray {
	tray := ms.app.SystemTray.New()
	tray.SetLabel("Basalt")
	tray.SetTooltip("Basalt Database Workspace")
	tray.OnClick(func() {
		if win := ms.app.Window.Current(); win != nil {
			win.Focus()
		}
	})
	tray.SetMenu(ms.buildTrayMenuFrom(ms.appSvc.ListSavedConnections()))
	return tray
}

func (ms *menuState) buildTrayMenuFrom(saved []localdb.SavedConnection) *application.Menu {
	m := application.NewMenu()

	connectTo := m.AddSubmenu("Connect To")
	if len(saved) == 0 {
		connectTo.Add("No saved connections").SetEnabled(false)
	} else {
		for _, conn := range saved {
			c := conn
			connectTo.Add(c.Name).OnClick(func(*application.Context) {
				if win := ms.app.Window.Current(); win != nil {
					win.Focus()
				}
				ms.app.Event.Emit("menu:connect-saved", c.ID)
			})
		}
	}

	m.Add("New Connection...").OnClick(func(*application.Context) {
		if win := ms.app.Window.Current(); win != nil {
			win.Focus()
		}
		ms.app.Event.Emit("menu:new-connection")
	})
	m.AddSeparator()
	m.Add("Show Basalt").OnClick(func(*application.Context) {
		if win := ms.app.Window.Current(); win != nil {
			win.Focus()
		}
	})
	m.AddSeparator()
	m.Add("Quit").OnClick(func(*application.Context) {
		ms.app.Quit()
	})

	return m
}
