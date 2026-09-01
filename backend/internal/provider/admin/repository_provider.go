package admin

import (
	"github.com/itsLeonB/cashback/internal/domain/entity/admin"
	"github.com/itsLeonB/go-crud"
	"gorm.io/gorm"
)

type Repositories struct {
	Transactor crud.Transactor
	User       crud.Repository[admin.User]
}

func ProvideRepositories(db *gorm.DB, transactor crud.Transactor) *Repositories {
	return &Repositories{
		Transactor: transactor,
		User:       crud.NewRepository[admin.User](db),
	}
}
