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

type CreateAnonymousFriendshipOutput struct {
	Body httpapi.Envelope[dto.FriendshipResponse]
}

// RegisterCreateAnonymousFriendship registers POST /api/v1/friendships on the Huma API.
func (fh *FriendshipHandler) RegisterCreateAnonymousFriendship(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-anonymous-friendship",
		Method:        http.MethodPost,
		Path:          "/api/v1/friendships",
		Summary:       "Create an anonymous friendship",
		Tags:          []string{"friendships"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *CreateAnonymousFriendshipInput) (*CreateAnonymousFriendshipOutput, error) {
		request := dto.NewAnonymousFriendshipRequest{
			ProfileID: in.ProfileID,
			Name:      in.Body.Name,
		}

		res, err := fh.friendshipService.CreateAnonymous(ctx, request)
		if err != nil {
			return nil, err
		}

		return &CreateAnonymousFriendshipOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}

type GetAllFriendshipsInput struct {
	httpapi.AuthInput
}

type GetAllFriendshipsOutput struct {
	Body httpapi.Envelope[[]dto.FriendshipResponse]
}

// RegisterGetAll registers GET /api/v1/friendships on the Huma API.
func (fh *FriendshipHandler) RegisterGetAll(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-friendships",
		Method:        http.MethodGet,
		Path:          "/api/v1/friendships",
		Summary:       "Get all friendships",
		Tags:          []string{"friendships"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAllFriendshipsInput) (*GetAllFriendshipsOutput, error) {
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

		return &GetAllFriendshipsOutput{Body: httpapi.NewEnvelope(friendships)}, nil
	})
}

type GetFriendshipDetailsInput struct {
	httpapi.AuthInput
	FriendshipID uuid.UUID `path:"friendshipID"`
}

type GetFriendshipDetailsOutput struct {
	Body httpapi.Envelope[dto.FriendDetailsResponse]
}

// RegisterGetDetails registers GET /api/v1/friendships/{friendshipID} on the Huma API.
func (fh *FriendshipHandler) RegisterGetDetails(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-friendship-details",
		Method:        http.MethodGet,
		Path:          "/api/v1/friendships/{friendshipID}",
		Summary:       "Get friendship details",
		Tags:          []string{"friendships"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetFriendshipDetailsInput) (*GetFriendshipDetailsOutput, error) {
		res, err := fh.friendDetailsSvc.GetDetails(ctx, in.ProfileID, in.FriendshipID)
		if err != nil {
			return nil, err
		}

		return &GetFriendshipDetailsOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}
