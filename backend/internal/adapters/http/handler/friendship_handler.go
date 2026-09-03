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

type FriendshipHandler struct {
	friendshipService        service.FriendshipService
	friendDetailsSvc         service.FriendDetailsService
	friendshipBalanceService service.FriendshipBalanceService
}

func NewFriendshipHandler(
	friendshipService service.FriendshipService,
	friendDetailsSvc service.FriendDetailsService,
	friendshipBalanceService service.FriendshipBalanceService,
) *FriendshipHandler {
	return &FriendshipHandler{
		friendshipService,
		friendDetailsSvc,
		friendshipBalanceService,
	}
}

type CreateAnonymousFriendshipInput struct {
	httpapi.AuthInput
	Body struct {
		Name string `json:"name" minLength:"3"`
	}
}

type GetAllFriendshipsInput struct {
	httpapi.AuthInput
}

type GetFriendshipDetailsInput struct {
	httpapi.AuthInput
	FriendshipID uuid.UUID `path:"friendshipID"`
}

// Routes returns every route FriendshipHandler exposes, for registration via
// endpoint.RegisterAll.
func (fh *FriendshipHandler) createAnonymousFriendship(ctx context.Context, in CreateAnonymousFriendshipInput) (dto.FriendshipResponse, error) {
	request := dto.NewAnonymousFriendshipRequest{
		ProfileID: in.ProfileID,
		Name:      in.Body.Name,
	}

	return fh.friendshipService.CreateAnonymous(ctx, request)
}

func (fh *FriendshipHandler) getFriendships(ctx context.Context, in GetAllFriendshipsInput) ([]dto.FriendshipResponse, error) {
	friendships, err := fh.friendshipService.GetAll(ctx, in.ProfileID)
	if err != nil {
		return nil, err
	}

	balances, err := fh.friendshipBalanceService.GetNetBalancesForProfile(ctx, in.ProfileID)
	if err != nil {
		return nil, err
	}

	for i := range friendships {
		if b, ok := balances[friendships[i].ProfileID]; ok {
			friendships[i].BalancesPerCurrency = b
		}
	}

	return friendships, nil
}

func (fh *FriendshipHandler) getFriendshipDetails(ctx context.Context, in GetFriendshipDetailsInput) (dto.FriendDetailsResponse, error) {
	return fh.friendDetailsSvc.GetDetails(ctx, in.ProfileID, in.FriendshipID)
}

func (fh *FriendshipHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[CreateAnonymousFriendshipInput, dto.FriendshipResponse]{
			OperationID: "create-anonymous-friendship",
			Method:      http.MethodPost,
			Path:        "/api/v1/friendships",
			Summary:     "Create an anonymous friendship",
			Tags:        []string{"friendships"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			HandlerFunc: fh.createAnonymousFriendship,
		}),
		endpoint.New(endpoint.Endpoint[GetAllFriendshipsInput, []dto.FriendshipResponse]{
			OperationID: "get-friendships",
			Method:      http.MethodGet,
			Path:        "/api/v1/friendships",
			Summary:     "Get all friendships",
			Tags:        []string{"friendships"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: fh.getFriendships,
		}),
		endpoint.New(endpoint.Endpoint[GetFriendshipDetailsInput, dto.FriendDetailsResponse]{
			OperationID: "get-friendship-details",
			Method:      http.MethodGet,
			Path:        "/api/v1/friendships/{friendshipID}",
			Summary:     "Get friendship details",
			Tags:        []string{"friendships"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: fh.getFriendshipDetails,
		}),
	}
}
