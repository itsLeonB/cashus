package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/entity/expenses"
	"github.com/itsLeonB/cashback/internal/domain/service"
)

type groupExpenseHandler struct {
	groupExpenseService service.GroupExpenseService
}

func newGroupExpenseHandler(
	groupExpenseService service.GroupExpenseService,
) *groupExpenseHandler {
	return &groupExpenseHandler{
		groupExpenseService,
	}
}

type CreateGroupExpenseDraftInput struct {
	httpapi.AuthInput
	Body struct {
		Description string `json:"description,omitempty"`
		Currency    string `json:"currency" minLength:"3" maxLength:"3"`
	}
}

type CreateGroupExpenseDraftOutput struct {
	Body httpapi.Envelope[dto.GroupExpenseResponse]
}

// RegisterCreateDraft registers POST /api/v1/group-expenses on the Huma API.
func (geh *groupExpenseHandler) RegisterCreateDraft(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-group-expense-draft",
		Method:        http.MethodPost,
		Path:          "/api/v1/group-expenses",
		Summary:       "Create a draft group expense",
		Tags:          []string{"group-expenses"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *CreateGroupExpenseDraftInput) (*CreateGroupExpenseDraftOutput, error) {
		request := dto.NewDraftRequest{
			UserProfileID: in.ProfileID,
			Description:   in.Body.Description,
			Currency:      in.Body.Currency,
		}

		res, err := geh.groupExpenseService.CreateDraft(ctx, request)
		if err != nil {
			return nil, err
		}

		return &CreateGroupExpenseDraftOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}

type GetAllGroupExpensesInput struct {
	httpapi.AuthInput
	Status    expenses.ExpenseStatus    `query:"status"`
	Ownership expenses.ExpenseOwnership `query:"ownership"`
}

type GetAllGroupExpensesOutput struct {
	Body httpapi.Envelope[[]dto.GroupExpenseResponse]
}

// RegisterGetAll registers GET /api/v1/group-expenses on the Huma API.
func (geh *groupExpenseHandler) RegisterGetAll(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-group-expenses",
		Method:        http.MethodGet,
		Path:          "/api/v1/group-expenses",
		Summary:       "Get all group expenses",
		Tags:          []string{"group-expenses"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetAllGroupExpensesInput) (*GetAllGroupExpensesOutput, error) {
		ownership := in.Ownership
		if ownership == "" {
			ownership = expenses.OwnedExpense
		}

		res, err := geh.groupExpenseService.GetAll(ctx, in.ProfileID, ownership, in.Status)
		if err != nil {
			return nil, err
		}

		return &GetAllGroupExpensesOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}

type GetGroupExpenseDetailsInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
}

type GetGroupExpenseDetailsOutput struct {
	Body httpapi.Envelope[dto.GroupExpenseResponse]
}

// RegisterGetDetails registers GET /api/v1/group-expenses/{groupExpenseID} on the Huma API.
func (geh *groupExpenseHandler) RegisterGetDetails(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-group-expense-details",
		Method:        http.MethodGet,
		Path:          "/api/v1/group-expenses/{groupExpenseID}",
		Summary:       "Get group expense details",
		Tags:          []string{"group-expenses"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetGroupExpenseDetailsInput) (*GetGroupExpenseDetailsOutput, error) {
		res, err := geh.groupExpenseService.GetDetails(ctx, in.GroupExpenseID, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetGroupExpenseDetailsOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}

type ConfirmGroupExpenseDraftInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	DryRun         bool      `query:"dry-run"`
}

type ConfirmGroupExpenseDraftOutput struct {
	Body httpapi.Envelope[dto.ExpenseConfirmationResponse]
}

// RegisterConfirmDraft registers PATCH /api/v1/group-expenses/{groupExpenseID}/confirmed on the Huma API.
func (geh *groupExpenseHandler) RegisterConfirmDraft(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "confirm-group-expense-draft",
		Method:        http.MethodPatch,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/confirmed",
		Summary:       "Confirm a draft group expense",
		Tags:          []string{"group-expenses"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *ConfirmGroupExpenseDraftInput) (*ConfirmGroupExpenseDraftOutput, error) {
		res, err := geh.groupExpenseService.ConfirmDraft(ctx, in.GroupExpenseID, in.ProfileID, in.DryRun)
		if err != nil {
			return nil, err
		}

		return &ConfirmGroupExpenseDraftOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}

type DeleteGroupExpenseInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
}

type DeleteGroupExpenseOutput struct{}

// RegisterDelete registers DELETE /api/v1/group-expenses/{groupExpenseID} on the Huma API.
func (geh *groupExpenseHandler) RegisterDelete(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "delete-group-expense",
		Method:        http.MethodDelete,
		Path:          "/api/v1/group-expenses/{groupExpenseID}",
		Summary:       "Delete a group expense",
		Tags:          []string{"group-expenses"},
		DefaultStatus: http.StatusNoContent,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *DeleteGroupExpenseInput) (*DeleteGroupExpenseOutput, error) {
		if err := geh.groupExpenseService.Delete(ctx, in.ProfileID, in.GroupExpenseID); err != nil {
			return nil, err
		}

		return &DeleteGroupExpenseOutput{}, nil
	})
}

type SyncGroupExpenseParticipantsInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	Body           struct {
		ParticipantProfileIDs []uuid.UUID             `json:"participantProfileIds" minItems:"1"`
		ProxyByProfileIDs     map[uuid.UUID]uuid.UUID `json:"proxyByProfileIds,omitempty"`
		PayerProfileID        uuid.UUID               `json:"payerProfileId"`
	}
}

type SyncGroupExpenseParticipantsOutput struct{}

// RegisterSyncParticipants registers PUT /api/v1/group-expenses/{groupExpenseID}/participants on the Huma API.
func (geh *groupExpenseHandler) RegisterSyncParticipants(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "sync-group-expense-participants",
		Method:        http.MethodPut,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/participants",
		Summary:       "Sync participants of a group expense",
		Tags:          []string{"group-expenses"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *SyncGroupExpenseParticipantsInput) (*SyncGroupExpenseParticipantsOutput, error) {
		request := dto.ExpenseParticipantsRequest{
			ParticipantProfileIDs: in.Body.ParticipantProfileIDs,
			ProxyByProfileIDs:     in.Body.ProxyByProfileIDs,
			PayerProfileID:        in.Body.PayerProfileID,
			UserProfileID:         in.ProfileID,
			GroupExpenseID:        in.GroupExpenseID,
		}

		if err := geh.groupExpenseService.SyncParticipants(ctx, request); err != nil {
			return nil, err
		}

		return &SyncGroupExpenseParticipantsOutput{}, nil
	})
}

type GetRecentGroupExpensesInput struct {
	httpapi.AuthInput
}

type GetRecentGroupExpensesOutput struct {
	Body httpapi.Envelope[[]dto.GroupExpenseResponse]
}

// RegisterGetRecent registers GET /api/v1/group-expenses/recent on the Huma API.
func (geh *groupExpenseHandler) RegisterGetRecent(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-recent-group-expenses",
		Method:        http.MethodGet,
		Path:          "/api/v1/group-expenses/recent",
		Summary:       "Get recent group expenses",
		Tags:          []string{"group-expenses"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetRecentGroupExpensesInput) (*GetRecentGroupExpensesOutput, error) {
		res, err := geh.groupExpenseService.GetRecent(ctx, in.ProfileID)
		if err != nil {
			return nil, err
		}

		return &GetRecentGroupExpensesOutput{Body: httpapi.NewEnvelope(res)}, nil
	})
}
