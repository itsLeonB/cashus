package handler

import (
	"context"
	"net/http"

	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
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

// Routes returns every route PublicHandler exposes, for registration via
// endpoint.RegisterAll.
func (ph *PublicHandler) getPublicProfile(ctx context.Context, in GetPublicProfileInput) (dto.FriendDetailsResponse, error) {
	return ph.friendDetailsSvc.GetDetailsBySlug(ctx, in.Slug)
}

func (ph *PublicHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[GetPublicProfileInput, dto.FriendDetailsResponse]{
			OperationID: "get-public-profile",
			Method:      http.MethodGet,
			Path:        "/api/v1/public/profiles/{slug}",
			Summary:     "Get a public profile by slug",
			Tags:        []string{"public"},
			SuccessCode: http.StatusOK,
			HandlerFunc: ph.getPublicProfile,
		}),
	}
}
