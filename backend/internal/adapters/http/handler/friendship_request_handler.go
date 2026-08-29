package handler

import (
	"context"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/ungerr"
)

type FriendshipRequestHandler struct {
	svc service.FriendshipRequestService
}

func NewFriendshipRequestHandler(svc service.FriendshipRequestService) *FriendshipRequestHandler {
	return &FriendshipRequestHandler{svc}
}

type SendFriendRequestInput struct {
	httpapi.AuthInput
	FriendProfileID uuid.UUID `path:"profileID"`
}

type SendFriendRequestOutput struct{}

// RegisterSend registers POST /api/v1/profiles/{profileID}/friend-requests on the Huma API.
func (frh *FriendshipRequestHandler) RegisterSend(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "send-friend-request",
		Method:        http.MethodPost,
		Path:          "/api/v1/profiles/{profileID}/friend-requests",
		Summary:       "Send a friend request",
		Tags:          []string{"friend-requests"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *SendFriendRequestInput) (*SendFriendRequestOutput, error) {
		if err := frh.svc.Send(ctx, in.ProfileID, in.FriendProfileID); err != nil {
			return nil, err
		}

		return &SendFriendRequestOutput{}, nil
	})
}

type GetAllFriendRequestsInput struct {
	httpapi.AuthInput
	RequestType string `path:"friendRequestType"`
}

type GetAllFriendRequestsOutput struct {
	Body []dto.FriendshipRequestResponse
}

// RegisterGetAll registers GET /api/v1/friend-requests/{friendRequestType} on the Huma API.
func (frh *FriendshipRequestHandler) RegisterGetAll(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-friend-requests",
		Method:        http.MethodGet,
		Path:          fmt.Sprintf("/api/v1/friend-requests/{%s}", appconstant.PathFriendRequestType),
		Summary:       "Get all friend requests (sent or received)",
		Tags:          []string{"friend-requests"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAllFriendRequestsInput) (*GetAllFriendRequestsOutput, error) {
		var response []dto.FriendshipRequestResponse
		var err error

		switch in.RequestType {
		case appconstant.SentFriendRequest:
			response, err = frh.svc.GetAllSent(ctx, in.ProfileID)
		case appconstant.ReceivedFriendRequest:
			response, err = frh.svc.GetAllReceived(ctx, in.ProfileID)
		default:
			err = ungerr.BadRequestError("invalid path parameter")
		}

		if err != nil {
			return nil, err
		}

		return &GetAllFriendRequestsOutput{Body: response}, nil
	})
}

type FriendRequestIDInput struct {
	httpapi.AuthInput
	FriendRequestID uuid.UUID `path:"friendRequestID"`
}

type CancelFriendRequestOutput struct{}

// RegisterCancel registers DELETE /api/v1/friend-requests/sent/{friendRequestID} on the Huma API.
func (frh *FriendshipRequestHandler) RegisterCancel(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "cancel-friend-request",
		Method:        http.MethodDelete,
		Path:          fmt.Sprintf("/api/v1/friend-requests/%s/{friendRequestID}", appconstant.SentFriendRequest),
		Summary:       "Cancel a sent friend request",
		Tags:          []string{"friend-requests"},
		DefaultStatus: http.StatusNoContent,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *FriendRequestIDInput) (*CancelFriendRequestOutput, error) {
		if err := frh.svc.Cancel(ctx, in.ProfileID, in.FriendRequestID); err != nil {
			return nil, err
		}

		return &CancelFriendRequestOutput{}, nil
	})
}

type IgnoreFriendRequestOutput struct{}

// RegisterIgnore registers DELETE /api/v1/friend-requests/received/{friendRequestID} on the Huma API.
func (frh *FriendshipRequestHandler) RegisterIgnore(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "ignore-friend-request",
		Method:        http.MethodDelete,
		Path:          fmt.Sprintf("/api/v1/friend-requests/%s/{friendRequestID}", appconstant.ReceivedFriendRequest),
		Summary:       "Ignore a received friend request",
		Tags:          []string{"friend-requests"},
		DefaultStatus: http.StatusNoContent,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *FriendRequestIDInput) (*IgnoreFriendRequestOutput, error) {
		if err := frh.svc.Ignore(ctx, in.ProfileID, in.FriendRequestID); err != nil {
			return nil, err
		}

		return &IgnoreFriendRequestOutput{}, nil
	})
}

type BlockFriendRequestInput struct {
	httpapi.AuthInput
	FriendRequestID uuid.UUID `path:"friendRequestID"`
	Command         string    `query:"command"`
}

type BlockFriendRequestOutput struct{}

// RegisterBlock registers PATCH /api/v1/friend-requests/received/{friendRequestID} on the Huma API.
func (frh *FriendshipRequestHandler) RegisterBlock(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "block-friend-request",
		Method:        http.MethodPatch,
		Path:          fmt.Sprintf("/api/v1/friend-requests/%s/{friendRequestID}", appconstant.ReceivedFriendRequest),
		Summary:       "Block or unblock a friend request sender",
		Tags:          []string{"friend-requests"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *BlockFriendRequestInput) (*BlockFriendRequestOutput, error) {
		var err error

		switch in.Command {
		case "block":
			err = frh.svc.Block(ctx, in.ProfileID, in.FriendRequestID)
		case "unblock":
			err = frh.svc.Unblock(ctx, in.ProfileID, in.FriendRequestID)
		default:
			err = ungerr.BadRequestError(fmt.Sprintf("unknown command: %s", in.Command))
		}

		if err != nil {
			return nil, err
		}

		return &BlockFriendRequestOutput{}, nil
	})
}

type AcceptFriendRequestOutput struct {
	Body dto.FriendshipResponse
}

// RegisterAccept registers POST /api/v1/friend-requests/received/{friendRequestID} on the Huma API.
func (frh *FriendshipRequestHandler) RegisterAccept(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "accept-friend-request",
		Method:        http.MethodPost,
		Path:          fmt.Sprintf("/api/v1/friend-requests/%s/{friendRequestID}", appconstant.ReceivedFriendRequest),
		Summary:       "Accept a received friend request",
		Tags:          []string{"friend-requests"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *FriendRequestIDInput) (*AcceptFriendRequestOutput, error) {
		res, err := frh.svc.Accept(ctx, in.ProfileID, in.FriendRequestID)
		if err != nil {
			return nil, err
		}

		return &AcceptFriendRequestOutput{Body: res}, nil
	})
}
