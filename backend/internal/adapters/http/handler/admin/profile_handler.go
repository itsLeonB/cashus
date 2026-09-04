package admin

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
)

type ProfileHandler struct {
	svc service.ProfileService
}

type GetAdminProfileListInput struct {
	httpapi.AdminAuthInput
}

type GetAdminProfileInput struct {
	httpapi.AdminAuthInput
	ProfileID uuid.UUID `path:"profileID"`
}

// Routes returns every route ProfileHandler exposes via endpoint.Endpoint,
// for registration via endpoint.RegisterAll.
func (ph *ProfileHandler) getAdminProfiles(ctx context.Context, in GetAdminProfileListInput) ([]dto.ProfileResponse, error) {
	return ph.svc.GetAllReal(ctx)
}

func (ph *ProfileHandler) getAdminProfile(ctx context.Context, in GetAdminProfileInput) (dto.ProfileResponse, error) {
	return ph.svc.GetByID(ctx, in.ProfileID)
}

func (ph *ProfileHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.NewList(endpoint.ListEndpoint[GetAdminProfileListInput, dto.ProfileResponse]{
			OperationID: "get-admin-profiles",
			Method:      http.MethodGet,
			Path:        "/admin/v1/profiles",
			Summary:     "Get all real profiles",
			Tags:        []string{"admin-profiles"},
			Secured:     true,
			HandlerFunc: ph.getAdminProfiles,
		}),
		endpoint.New(endpoint.Endpoint[GetAdminProfileInput, dto.ProfileResponse]{
			OperationID: "get-admin-profile",
			Method:      http.MethodGet,
			Path:        "/admin/v1/profiles/{profileID}",
			Summary:     "Get a profile by ID",
			Tags:        []string{"admin-profiles"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: ph.getAdminProfile,
		}),
	}
}
