package handler

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
	profileService service.ProfileService
}

func NewProfileHandler(
	profileService service.ProfileService,
) *ProfileHandler {
	return &ProfileHandler{
		profileService,
	}
}

type GetProfileInput struct {
	httpapi.AuthInput
}

type UpdateProfileInput struct {
	httpapi.AuthInput
	Body struct {
		Name         string `json:"name" minLength:"3" maxLength:"255"`
		HomeCurrency string `json:"homeCurrency" minLength:"3" maxLength:"3"`
	}
}

type AssociateProfileInput struct {
	httpapi.AuthInput
	Body struct {
		RealProfileID uuid.UUID `json:"realProfileId"`
		AnonProfileID uuid.UUID `json:"anonProfileId"`
	}
}

// Routes returns the ProfileHandler routes that share protectedMW, for
// registration via endpoint.RegisterAll. RegisterSearch is registered
// separately (SearchRoutes) because it's rate-limited with profilesMW rather
// than protectedMW.
func (ph *ProfileHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[GetProfileInput, dto.ProfileResponse]{
			OperationID: "get-profile",
			Method:      http.MethodGet,
			Path:        "/api/v1/profile",
			Summary:     "Get current user's profile",
			Tags:        []string{"profile"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in GetProfileInput) (dto.ProfileResponse, error) {
				return ph.profileService.GetByID(ctx, in.ProfileID)
			},
		}),
		endpoint.New(endpoint.Endpoint[UpdateProfileInput, dto.ProfileResponse]{
			OperationID: "update-profile",
			Method:      http.MethodPatch,
			Path:        "/api/v1/profile",
			Summary:     "Update current user's profile",
			Tags:        []string{"profile"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in UpdateProfileInput) (dto.ProfileResponse, error) {
				request := dto.UpdateProfileRequest{
					ID:           in.ProfileID,
					Name:         in.Body.Name,
					HomeCurrency: in.Body.HomeCurrency,
				}

				return ph.profileService.Update(ctx, request)
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[AssociateProfileInput]{
			OperationID: "associate-profile",
			Method:      http.MethodPost,
			Path:        "/api/v1/profile/associate",
			Summary:     "Associate anonymous profile with real profile",
			Tags:        []string{"profile"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in AssociateProfileInput) error {
				return ph.profileService.MergeAnonymousProfile(ctx, in.ProfileID, in.Body.RealProfileID, in.Body.AnonProfileID)
			},
		}),
	}
}

type SearchProfilesInput struct {
	httpapi.AuthInput
	Query string `query:"query" required:"true" minLength:"3" maxLength:"255"`
}

// SearchRoutes returns search-profiles on its own, so routes/api_routes.go
// can register it with profilesMW instead of sharing Routes()'s protectedMW
// group: it's rate-limited like FriendshipRequestHandler.SendRoutes and
// ProfileTransferMethodHandler.GetAllByFriendProfileIDRoutes, using the same
// shared limiter instance.
func (ph *ProfileHandler) SearchRoutes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[SearchProfilesInput, []dto.SearchProfileResponse]{
			OperationID: "search-profiles",
			Method:      http.MethodGet,
			Path:        "/api/v1/profiles",
			Summary:     "Search profiles",
			Tags:        []string{"profile"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in SearchProfilesInput) ([]dto.SearchProfileResponse, error) {
				return ph.profileService.Search(ctx, in.ProfileID, in.Query)
			},
		}),
	}
}
