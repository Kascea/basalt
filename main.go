package main

import (
	"embed"
	_ "embed"
	"log"

	"basalt/db"
	"basalt/localdb"
	"basalt/providers"
	"basalt/providers/planetscale"
	"basalt/providers/supabase"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed icons/basalt-icon.png
var appIcon []byte

func main() {
	store, err := localdb.Open()
	if err != nil {
		log.Fatalf("failed to open local database: %v", err)
	}

	dbSvc := db.NewDatabaseService(store)
	appSvc := localdb.NewService(store)
	psSvc := planetscale.NewService(store)
	sbSvc := supabase.NewService(store)
	provSvc := providers.NewService(store, psSvc, sbSvc)

	app := application.New(application.Options{
		Name:        "basalt",
		Description: "A modern database workspace for browsing, querying, and editing",
		Icon:        appIcon,
		Services: []application.Service{
			application.NewService(dbSvc),
			application.NewService(appSvc),
			application.NewService(psSvc),
			application.NewService(sbSvc),
			application.NewService(provSvc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	dbSvc.App = app

	rebuilder := buildMenus(app, dbSvc, appSvc)
	dbSvc.OnConnectionsChanged = rebuilder
	appSvc.OnConnectionsChanged = rebuilder
	psSvc.OnConnectionsChanged = rebuilder
	sbSvc.OnConnectionsChanged = rebuilder
	provSvc.OnConnectionsChanged = rebuilder

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "basalt",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 0,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(13, 17, 23),
		URL:              "/",
	})

	err = app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
