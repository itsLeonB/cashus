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

type ProfileTransferMethodHandler struct {
	svc service.ProfileTransferMethodService
}

type AddProfileTransferMethodInput struct {
	httpapi.AuthInput
	Body struct {
		TransferMethodID uuid.UUID `json:"transferMethodId"`
		AccountName      string    `json:"accountName" minLength:"3"`
		AccountNumber    string    `json:"accountNumber" minLength:"3"`
	}
}

// add builds the service request from in and delegates to svc.Add. Pulled
// out of the Routes() ServiceFunc closure since it's more than a plain
// passthrough (it assembles dto.NewProfileTransferMethodRequest first),
// matching handler.AuthHandler.logout's reasoning for extracting non-trivial
// NoBodyEndpoint logic into a private method.
func (ptmh *ProfileTransferMethodHandler) add(ctx context.Context, in AddProfileTransferMethodInput) error {
	req := dto.NewProfileTransferMethodRequest{
		ProfileID:        in.ProfileID,
		TransferMethodID: in.Body.TransferMethodID,
		AccountName:      in.Body.AccountName,
		AccountNumber:    in.Body.AccountNumber,
	}

	return ptmh.svc.Add(ctx, req)
}

type GetAllOwnedProfileTransferMethodsInput struct {
	httpapi.AuthInput
}

// Routes returns the ProfileTransferMethodHandler routes that share
// protectedMW, for registration via endpoint.RegisterAll.
// GetAllByFriendProfileIDRoutes is registered separately because it's
// rate-limited with profilesMW rather than protectedMW.
func (ptmh *ProfileTransferMethodHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[GetAllOwnedProfileTransferMethodsInput, []dto.ProfileTransferMethodResponse]{
			OperationID: "get-all-owned-profile-transfer-methods",
			Method:      http.MethodGet,
			Path:        "/api/v1/profile/transfer-methods",
			Summary:     "Get all transfer methods owned by current profile",
			Tags:        []string{"profile-transfer-methods"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in GetAllOwnedProfileTransferMethodsInput) ([]dto.ProfileTransferMethodResponse, error) {
				return ptmh.svc.GetAllByProfileID(ctx, in.ProfileID)
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[AddProfileTransferMethodInput]{
			OperationID: "add-profile-transfer-method",
			Method:      http.MethodPost,
			Path:        "/api/v1/profile/transfer-methods",
			Summary:     "Add a transfer method to profile",
			Tags:        []string{"profile-transfer-methods"},
			Secured:     true,
			ServiceFunc: ptmh.add,
		}),
	}
}

type GetAllProfileTransferMethodsByFriendProfileIDInput struct {
	httpapi.AuthInput
	FriendProfileID uuid.UUID `path:"profileID"`
}

// GetAllByFriendProfileIDRoutes returns
// get-all-profile-transfer-methods-by-friend-profile-id on its own, so
// routes/api_routes.go can register it with profilesMW instead of sharing
// Routes()'s protectedMW group: it's rate-limited like
// FriendshipRequestHandler.SendRoutes and ProfileHandler.SearchRoutes, using
// the same shared limiter instance. This route returns a real response body
// (the friend's transfer methods), so it fits endpoint.Endpoint, not
// endpoint.NoBodyEndpoint.
func (ptmh *ProfileTransferMethodHandler) GetAllByFriendProfileIDRoutes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[GetAllProfileTransferMethodsByFriendProfileIDInput, []dto.ProfileTransferMethodResponse]{
			OperationID: "get-all-profile-transfer-methods-by-friend-profile-id",
			Method:      http.MethodGet,
			Path:        "/api/v1/profiles/{profileID}/transfer-methods",
			Summary:     "Get all transfer methods of a friend profile",
			Tags:        []string{"profile-transfer-methods"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in GetAllProfileTransferMethodsByFriendProfileIDInput) ([]dto.ProfileTransferMethodResponse, error) {
				return ptmh.svc.GetAllByFriendProfileID(ctx, in.ProfileID, in.FriendProfileID)
			},
		}),
	}
}
