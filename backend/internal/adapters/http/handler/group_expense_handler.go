package handler

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	"github.com/itsLeonB/cashback/internal/domain/dto"
	"github.com/itsLeonB/cashback/internal/domain/entity/expenses"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
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

type GetAllGroupExpensesInput struct {
	httpapi.AuthInput
	Status    expenses.ExpenseStatus    `query:"status"`
	Ownership expenses.ExpenseOwnership `query:"ownership"`
}

type GetGroupExpenseDetailsInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
}

type ConfirmGroupExpenseDraftInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	DryRun         bool      `query:"dry-run"`
}

type GetRecentGroupExpensesInput struct {
	httpapi.AuthInput
}

type DeleteGroupExpenseInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
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

// Routes returns every route groupExpenseHandler exposes via
// endpoint.Endpoint / endpoint.NoBodyEndpoint, for registration via
// endpoint.RegisterAll.
func (geh *groupExpenseHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[CreateGroupExpenseDraftInput, dto.GroupExpenseResponse]{
			OperationID: "create-group-expense-draft",
			Method:      http.MethodPost,
			Path:        "/api/v1/group-expenses",
			Summary:     "Create a draft group expense",
			Tags:        []string{"group-expenses"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in CreateGroupExpenseDraftInput) (dto.GroupExpenseResponse, error) {
				request := dto.NewDraftRequest{
					UserProfileID: in.ProfileID,
					Description:   in.Body.Description,
					Currency:      in.Body.Currency,
				}

				return geh.groupExpenseService.CreateDraft(ctx, request)
			},
		}),
		endpoint.New(endpoint.Endpoint[GetAllGroupExpensesInput, []dto.GroupExpenseResponse]{
			OperationID: "get-group-expenses",
			Method:      http.MethodGet,
			Path:        "/api/v1/group-expenses",
			Summary:     "Get all group expenses",
			Tags:        []string{"group-expenses"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in GetAllGroupExpensesInput) ([]dto.GroupExpenseResponse, error) {
				ownership := in.Ownership
				if ownership == "" {
					ownership = expenses.OwnedExpense
				}

				return geh.groupExpenseService.GetAll(ctx, in.ProfileID, ownership, in.Status)
			},
		}),
		endpoint.New(endpoint.Endpoint[GetGroupExpenseDetailsInput, dto.GroupExpenseResponse]{
			OperationID: "get-group-expense-details",
			Method:      http.MethodGet,
			Path:        "/api/v1/group-expenses/{groupExpenseID}",
			Summary:     "Get group expense details",
			Tags:        []string{"group-expenses"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in GetGroupExpenseDetailsInput) (dto.GroupExpenseResponse, error) {
				return geh.groupExpenseService.GetDetails(ctx, in.GroupExpenseID, in.ProfileID)
			},
		}),
		endpoint.New(endpoint.Endpoint[ConfirmGroupExpenseDraftInput, dto.ExpenseConfirmationResponse]{
			OperationID: "confirm-group-expense-draft",
			Method:      http.MethodPatch,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/confirmed",
			Summary:     "Confirm a draft group expense",
			Tags:        []string{"group-expenses"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in ConfirmGroupExpenseDraftInput) (dto.ExpenseConfirmationResponse, error) {
				return geh.groupExpenseService.ConfirmDraft(ctx, in.GroupExpenseID, in.ProfileID, in.DryRun)
			},
		}),
		endpoint.New(endpoint.Endpoint[GetRecentGroupExpensesInput, []dto.GroupExpenseResponse]{
			OperationID: "get-recent-group-expenses",
			Method:      http.MethodGet,
			Path:        "/api/v1/group-expenses/recent",
			Summary:     "Get recent group expenses",
			Tags:        []string{"group-expenses"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in GetRecentGroupExpensesInput) ([]dto.GroupExpenseResponse, error) {
				return geh.groupExpenseService.GetRecent(ctx, in.ProfileID)
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[DeleteGroupExpenseInput]{
			OperationID: "delete-group-expense",
			Method:      http.MethodDelete,
			Path:        "/api/v1/group-expenses/{groupExpenseID}",
			Summary:     "Delete a group expense",
			Tags:        []string{"group-expenses"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in DeleteGroupExpenseInput) error {
				return geh.groupExpenseService.Delete(ctx, in.ProfileID, in.GroupExpenseID)
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[SyncGroupExpenseParticipantsInput]{
			OperationID: "sync-group-expense-participants",
			Method:      http.MethodPut,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/participants",
			Summary:     "Sync participants of a group expense",
			Tags:        []string{"group-expenses"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in SyncGroupExpenseParticipantsInput) error {
				request := dto.ExpenseParticipantsRequest{
					ParticipantProfileIDs: in.Body.ParticipantProfileIDs,
					ProxyByProfileIDs:     in.Body.ProxyByProfileIDs,
					PayerProfileID:        in.Body.PayerProfileID,
					UserProfileID:         in.ProfileID,
					GroupExpenseID:        in.GroupExpenseID,
				}

				return geh.groupExpenseService.SyncParticipants(ctx, request)
			},
		}),
	}
}
