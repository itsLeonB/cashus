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

type AddProfileTransferMethodOutput struct{}

// RegisterAdd registers POST /api/v1/profile/transfer-methods on the Huma API.
func (ptmh *ProfileTransferMethodHandler) RegisterAdd(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "add-profile-transfer-method",
		Method:        http.MethodPost,
		Path:          "/api/v1/profile/transfer-methods",
		Summary:       "Add a transfer method to profile",
		Tags:          []string{"profile-transfer-methods"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *AddProfileTransferMethodInput) (*AddProfileTransferMethodOutput, error) {
		req := dto.NewProfileTransferMethodRequest{
			ProfileID:        in.ProfileID,
			TransferMethodID: in.Body.TransferMethodID,
			AccountName:      in.Body.AccountName,
			AccountNumber:    in.Body.AccountNumber,
		}

		if err := ptmh.svc.Add(ctx, req); err != nil {
			return nil, err
		}

		return &AddProfileTransferMethodOutput{}, nil
	})
}

type GetAllOwnedProfileTransferMethodsInput struct {
	httpapi.AuthInput
}

type GetAllOwnedProfileTransferMethodsOutput struct {
	Body httpapi.Envelope[[]dto.ProfileTransferMethodResponse]
}

// RegisterGetAllOwned registers GET /api/v1/profile/transfer-methods on the Huma API.
func (ptmh *ProfileTransferMethodHandler) RegisterGetAllOwned(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-all-owned-profile-transfer-methods",
		Method:        http.MethodGet,
		Path:          "/api/v1/profile/transfer-methods",
		Summary:       "Get all transfer methods owned by current profile",
		Tags:          []string{"profile-transfer-methods"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAllOwnedProfileTransferMethodsInput) (*GetAllOwnedProfileTransferMethodsOutput, error) {
		res, err := ptmh.svc.GetAllByProfileID(ctx, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetAllOwnedProfileTransferMethodsOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}

type GetAllProfileTransferMethodsByFriendProfileIDInput struct {
	httpapi.AuthInput
	FriendProfileID uuid.UUID `path:"profileID"`
}

type GetAllProfileTransferMethodsByFriendProfileIDOutput struct {
	Body httpapi.Envelope[[]dto.ProfileTransferMethodResponse]
}

// RegisterGetAllByFriendProfileID registers GET /api/v1/profiles/{profileID}/transfer-methods on the Huma API.
func (ptmh *ProfileTransferMethodHandler) RegisterGetAllByFriendProfileID(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-all-profile-transfer-methods-by-friend-profile-id",
		Method:        http.MethodGet,
		Path:          "/api/v1/profiles/{profileID}/transfer-methods",
		Summary:       "Get all transfer methods of a friend profile",
		Tags:          []string{"profile-transfer-methods"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAllProfileTransferMethodsByFriendProfileIDInput) (*GetAllProfileTransferMethodsByFriendProfileIDOutput, error) {
		res, err := ptmh.svc.GetAllByFriendProfileID(ctx, in.ProfileID, in.FriendProfileID)
		if err != nil {
			return nil, err
		}

		return &GetAllProfileTransferMethodsByFriendProfileIDOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}
