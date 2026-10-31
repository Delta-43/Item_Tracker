// Package web embeds the built single-page app so the server ships as one binary.
package web

import "embed"

// Dist holds the Vite build output. Run `npm run build` in web/ before `go build`;
// without it only dist/.gitkeep is embedded and the server reports the UI as missing.
//
//go:embed all:dist
var Dist embed.FS
