package handler

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
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

// SendRoutes returns send-friend-request on its own, so
// routes/api_routes.go can register it with profilesMW instead of sharing
// Routes()'s protectedMW group: it's rate-limited like RegisterSearch and
// RegisterGetAllByFriendProfileID, using the same shared limiter instance.
func (frh *FriendshipRequestHandler) sendFriendRequest(ctx context.Context, in SendFriendRequestInput) (dto.FriendshipRequestResponse, error) {
	return frh.svc.Send(ctx, in.ProfileID, in.FriendProfileID)
}

func (frh *FriendshipRequestHandler) SendRoutes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[SendFriendRequestInput, dto.FriendshipRequestResponse]{
			OperationID: "send-friend-request",
			Method:      http.MethodPost,
			Path:        "/api/v1/profiles/{profileID}/friend-requests",
			Summary:     "Send a friend request",
			Tags:        []string{"friend-requests"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			HandlerFunc: frh.sendFriendRequest,
		}),
	}
}

type GetAllFriendRequestsInput struct {
	httpapi.AuthInput
	RequestType string `path:"friendRequestType"`
}

type FriendRequestIDInput struct {
	httpapi.AuthInput
	FriendRequestID uuid.UUID `path:"friendRequestID"`
}

type BlockFriendRequestInput struct {
	httpapi.AuthInput
	FriendRequestID uuid.UUID `path:"friendRequestID"`
	Command         string    `query:"command"`
}

// Routes returns every route FriendshipRequestHandler exposes via
// endpoint.Endpoint/endpoint.NoBodyEndpoint that shares protectedMW, for
// registration via endpoint.RegisterAll. Send is returned separately
// (SendRoutes) because it needs profilesMW instead. GetAll used to be
// hand-written, for building a manual ungerr.BadRequestError on an
// unrecognized path value, but that validation now lives in
// service.FriendshipRequestService.GetAllByType, so GetAll fits here
// alongside Accept.
func (frh *FriendshipRequestHandler) acceptFriendRequest(ctx context.Context, in FriendRequestIDInput) (dto.FriendshipResponse, error) {
	return frh.svc.Accept(ctx, in.ProfileID, in.FriendRequestID)
}

func (frh *FriendshipRequestHandler) getFriendRequests(ctx context.Context, in GetAllFriendRequestsInput) ([]dto.FriendshipRequestResponse, error) {
	return frh.svc.GetAllByType(ctx, in.ProfileID, in.RequestType)
}

func (frh *FriendshipRequestHandler) cancelFriendRequest(ctx context.Context, in FriendRequestIDInput) error {
	return frh.svc.Cancel(ctx, in.ProfileID, in.FriendRequestID)
}

func (frh *FriendshipRequestHandler) ignoreFriendRequest(ctx context.Context, in FriendRequestIDInput) error {
	return frh.svc.Ignore(ctx, in.ProfileID, in.FriendRequestID)
}

func (frh *FriendshipRequestHandler) blockFriendRequest(ctx context.Context, in BlockFriendRequestInput) (dto.FriendshipRequestResponse, error) {
	return frh.svc.HandleBlockCommand(ctx, in.ProfileID, in.FriendRequestID, in.Command)
}

func (frh *FriendshipRequestHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[FriendRequestIDInput, dto.FriendshipResponse]{
			OperationID: "accept-friend-request",
			Method:      http.MethodPost,
			Path:        fmt.Sprintf("/api/v1/friend-requests/%s/{friendRequestID}", appconstant.ReceivedFriendRequest),
			Summary:     "Accept a received friend request",
			Tags:        []string{"friend-requests"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			HandlerFunc: frh.acceptFriendRequest,
		}),
		endpoint.New(endpoint.Endpoint[GetAllFriendRequestsInput, []dto.FriendshipRequestResponse]{
			OperationID: "get-friend-requests",
			Method:      http.MethodGet,
			Path:        fmt.Sprintf("/api/v1/friend-requests/{%s}", appconstant.PathFriendRequestType),
			Summary:     "Get all friend requests (sent or received)",
			Tags:        []string{"friend-requests"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: frh.getFriendRequests,
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[FriendRequestIDInput]{
			OperationID: "cancel-friend-request",
			Method:      http.MethodDelete,
			Path:        fmt.Sprintf("/api/v1/friend-requests/%s/{friendRequestID}", appconstant.SentFriendRequest),
			Summary:     "Cancel a sent friend request",
			Tags:        []string{"friend-requests"},
			Secured:     true,
			HandlerFunc: frh.cancelFriendRequest,
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[FriendRequestIDInput]{
			OperationID: "ignore-friend-request",
			Method:      http.MethodDelete,
			Path:        fmt.Sprintf("/api/v1/friend-requests/%s/{friendRequestID}", appconstant.ReceivedFriendRequest),
			Summary:     "Ignore a received friend request",
			Tags:        []string{"friend-requests"},
			Secured:     true,
			HandlerFunc: frh.ignoreFriendRequest,
		}),
		endpoint.New(endpoint.Endpoint[BlockFriendRequestInput, dto.FriendshipRequestResponse]{
			OperationID: "block-friend-request",
			Method:      http.MethodPatch,
			Path:        fmt.Sprintf("/api/v1/friend-requests/%s/{friendRequestID}", appconstant.ReceivedFriendRequest),
			Summary:     "Block or unblock a friend request sender",
			Tags:        []string{"friend-requests"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: frh.blockFriendRequest,
		}),
	}
}
