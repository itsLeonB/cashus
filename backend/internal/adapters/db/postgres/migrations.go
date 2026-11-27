package postgres

import "embed"

// Migrations contains the complete, unchanged Goose history.
//
//go:embed migrations/*.sql
var Migrations embed.FS
