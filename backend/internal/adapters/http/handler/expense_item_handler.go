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

type ExpenseItemHandler struct {
	expenseItemSvc service.ExpenseItemService
}

func NewExpenseItemHandler(
	expenseItemSvc service.ExpenseItemService,
) *ExpenseItemHandler {
	return &ExpenseItemHandler{
		expenseItemSvc,
	}
}

type AddExpenseItemInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	Body           struct {
		Name     string          `json:"name" minLength:"3"`
		Amount   httpapi.Decimal `json:"amount" required:"true"`
		Quantity int             `json:"quantity" minimum:"1"`
	}
}

type UpdateExpenseItemInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	ExpenseItemID  uuid.UUID `path:"expenseItemID"`
	Body           struct {
		Name     string          `json:"name" minLength:"3"`
		Amount   httpapi.Decimal `json:"amount" required:"true"`
		Quantity int             `json:"quantity" minimum:"1"`
	}
}

type RemoveExpenseItemInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	ExpenseItemID  uuid.UUID `path:"expenseItemID"`
}

type SyncExpenseItemParticipantsInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	ExpenseItemID  uuid.UUID `path:"expenseItemID"`
	Body           struct {
		Participants []struct {
			ProfileID uuid.UUID `json:"profileId"`
			Weight    int       `json:"weight,omitempty"`
		} `json:"participants"`
	}
}

// Routes returns every route ExpenseItemHandler exposes via
// endpoint.NoBodyEndpoint, for registration via endpoint.RegisterAll.
func (geh *ExpenseItemHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[AddExpenseItemInput]{
			OperationID: "add-expense-item",
			Method:      http.MethodPost,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/items",
			Summary:     "Add an item to a group expense",
			Tags:        []string{"expense-items"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in AddExpenseItemInput) error {
				request := dto.NewExpenseItemRequest{
					UserProfileID:  in.ProfileID,
					GroupExpenseID: in.GroupExpenseID,
					Name:           in.Body.Name,
					Amount:         in.Body.Amount.Decimal,
					Quantity:       in.Body.Quantity,
				}

				return geh.expenseItemSvc.Add(ctx, request)
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[UpdateExpenseItemInput]{
			OperationID: "update-expense-item",
			Method:      http.MethodPut,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}",
			Summary:     "Update an expense item",
			Tags:        []string{"expense-items"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in UpdateExpenseItemInput) error {
				request := dto.UpdateExpenseItemRequest{
					UserProfileID:  in.ProfileID,
					ID:             in.ExpenseItemID,
					GroupExpenseID: in.GroupExpenseID,
					Name:           in.Body.Name,
					Amount:         in.Body.Amount.Decimal,
					Quantity:       in.Body.Quantity,
				}

				return geh.expenseItemSvc.Update(ctx, request)
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[RemoveExpenseItemInput]{
			OperationID: "remove-expense-item",
			Method:      http.MethodDelete,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}",
			Summary:     "Remove an expense item",
			Tags:        []string{"expense-items"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in RemoveExpenseItemInput) error {
				return geh.expenseItemSvc.Remove(ctx, in.GroupExpenseID, in.ExpenseItemID, in.ProfileID)
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[SyncExpenseItemParticipantsInput]{
			OperationID: "sync-expense-item-participants",
			Method:      http.MethodPut,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}/participants",
			Summary:     "Sync participants of an expense item",
			Tags:        []string{"expense-items"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in SyncExpenseItemParticipantsInput) error {
				participants := make([]dto.ItemParticipantRequest, 0, len(in.Body.Participants))
				for _, p := range in.Body.Participants {
					participants = append(participants, dto.ItemParticipantRequest{
						ProfileID: p.ProfileID,
						Weight:    p.Weight,
					})
				}

				request := dto.SyncItemParticipantsRequest{
					ProfileID:      in.ProfileID,
					ID:             in.ExpenseItemID,
					GroupExpenseID: in.GroupExpenseID,
					Participants:   participants,
				}

				return geh.expenseItemSvc.SyncParticipants(ctx, request)
			},
		}),
	}
}
