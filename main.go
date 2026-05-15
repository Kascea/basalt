package main

import (
	"embed"
	_ "embed"
	"log"

	"basalt/db"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	svc := db.NewDatabaseService()

	app := application.New(application.Options{
		Name:        "basalt",
		Description: "A modern database workspace for browsing, querying, and editing",
		Services: []application.Service{
			application.NewService(svc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	svc.OnConnectionsChanged = buildMenus(app, svc)

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Basalt",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 40,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(13, 17, 23),
		URL:              "/",
	})

	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
