package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
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

type GetProfileOutput struct {
	Body dto.ProfileResponse
}

// RegisterProfile registers GET /api/v1/profile on the Huma API.
func (ph *ProfileHandler) RegisterProfile(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-profile",
		Method:        http.MethodGet,
		Path:          "/api/v1/profile",
		Summary:       "Get current user's profile",
		Tags:          []string{"profile"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetProfileInput) (*GetProfileOutput, error) {
		res, err := ph.profileService.GetByID(ctx, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetProfileOutput{Body: res}, nil
	})
}

type UpdateProfileInput struct {
	httpapi.AuthInput
	Body struct {
		Name         string `json:"name" minLength:"3" maxLength:"255"`
		HomeCurrency string `json:"homeCurrency" minLength:"3" maxLength:"3"`
	}
}

type UpdateProfileOutput struct {
	Body dto.ProfileResponse
}

// RegisterUpdate registers PATCH /api/v1/profile on the Huma API.
func (ph *ProfileHandler) RegisterUpdate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "update-profile",
		Method:        http.MethodPatch,
		Path:          "/api/v1/profile",
		Summary:       "Update current user's profile",
		Tags:          []string{"profile"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *UpdateProfileInput) (*UpdateProfileOutput, error) {
		request := dto.UpdateProfileRequest{
			ID:           in.ProfileID,
			Name:         in.Body.Name,
			HomeCurrency: in.Body.HomeCurrency,
		}

		res, err := ph.profileService.Update(ctx, request)
		if err != nil {
			return nil, err
		}

		return &UpdateProfileOutput{Body: res}, nil
	})
}

type SearchProfilesInput struct {
	httpapi.AuthInput
	Query string `query:"query" required:"true" minLength:"3" maxLength:"255"`
}

type SearchProfilesOutput struct {
	Body []dto.SearchProfileResponse
}

// RegisterSearch registers GET /api/v1/profiles on the Huma API.
func (ph *ProfileHandler) RegisterSearch(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "search-profiles",
		Method:        http.MethodGet,
		Path:          "/api/v1/profiles",
		Summary:       "Search profiles",
		Tags:          []string{"profile"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *SearchProfilesInput) (*SearchProfilesOutput, error) {
		res, err := ph.profileService.Search(ctx, in.ProfileID, in.Query)
		if err != nil {
			return nil, err
		}

		return &SearchProfilesOutput{Body: res}, nil
	})
}

type AssociateProfileInput struct {
	httpapi.AuthInput
	Body struct {
		RealProfileID uuid.UUID `json:"realProfileId"`
		AnonProfileID uuid.UUID `json:"anonProfileId"`
	}
}

type AssociateProfileOutput struct{}

// RegisterAssociate registers POST /api/v1/profile/associate on the Huma API.
func (ph *ProfileHandler) RegisterAssociate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "associate-profile",
		Method:        http.MethodPost,
		Path:          "/api/v1/profile/associate",
		Summary:       "Associate anonymous profile with real profile",
		Tags:          []string{"profile"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *AssociateProfileInput) (*AssociateProfileOutput, error) {
		if err := ph.profileService.MergeAnonymousProfile(ctx, in.ProfileID, in.Body.RealProfileID, in.Body.AnonProfileID); err != nil {
			return nil, err
		}

		return &AssociateProfileOutput{}, nil
	})
}
