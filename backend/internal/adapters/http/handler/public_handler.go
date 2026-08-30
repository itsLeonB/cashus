package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
)

type PublicHandler struct {
	friendDetailsSvc service.FriendDetailsService
}

func NewPublicHandler(friendDetailsSvc service.FriendDetailsService) *PublicHandler {
	return &PublicHandler{friendDetailsSvc}
}

type GetPublicProfileInput struct {
	Slug string `path:"slug"`
}

type GetPublicProfileOutput struct {
	Body httpapi.Envelope[dto.FriendDetailsResponse]
}

// RegisterGetPublicProfile registers GET /api/v1/public/profiles/{slug} on the Huma API.
func (ph *PublicHandler) RegisterGetPublicProfile(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-public-profile",
		Method:        http.MethodGet,
		Path:          "/api/v1/public/profiles/{slug}",
		Summary:       "Get a public profile by slug",
		Tags:          []string{"public"},
		DefaultStatus: http.StatusOK,
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetPublicProfileInput) (*GetPublicProfileOutput, error) {
		res, err := ph.friendDetailsSvc.GetDetailsBySlug(ctx, in.Slug)
		if err != nil {
			return nil, err
		}

		return &GetPublicProfileOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}
