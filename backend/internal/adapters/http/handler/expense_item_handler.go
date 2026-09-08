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
		Name string `json:"name" minLength:"3"`
		// Amount uses NonZeroDecimal, not PositiveDecimal (CASH-16): see
		// AddOtherFeeInput.Body.Amount's comment (other_fee_handler.go) -
		// the same "!= 0, negative allowed" rule and reasoning apply to
		// expense items.
		Amount   httpapi.NonZeroDecimal `json:"amount" required:"true"`
		Quantity int                    `json:"quantity" minimum:"1"`
	}
}

type UpdateExpenseItemInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	ExpenseItemID  uuid.UUID `path:"expenseItemID"`
	Body           struct {
		Name string `json:"name" minLength:"3"`
		// Amount: see AddExpenseItemInput.Body.Amount's comment.
		Amount   httpapi.NonZeroDecimal `json:"amount" required:"true"`
		Quantity int                    `json:"quantity" minimum:"1"`
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
		// Participants' Weight minimum mirrors
		// AllocationService.AllocateAmounts's "weight cannot be negative"
		// rule (backend/internal/domain/service/expense/allocation_service.go,
		// CASH-16). No minItems here: syncing to an empty participant list
		// is a legitimate, intentional state (e.g. clearing participants
		// before confirming an expense), not an error. AllocateAmounts
		// still rejects an empty slice, but only as an internal
		// division-by-zero guard, not as a rule mirrored from this schema -
		// see that method's comment.
		Participants []struct {
			ProfileID uuid.UUID `json:"profileId"`
			Weight    int       `json:"weight,omitempty" minimum:"0"`
		} `json:"participants"`
	}
}

// Routes returns every route ExpenseItemHandler exposes via
// endpoint.NoBodyEndpoint, for registration via endpoint.RegisterAll.
func (geh *ExpenseItemHandler) addExpenseItem(ctx context.Context, in AddExpenseItemInput) error {
	request := dto.NewExpenseItemRequest{
		UserProfileID:  in.ProfileID,
		GroupExpenseID: in.GroupExpenseID,
		Name:           in.Body.Name,
		Amount:         in.Body.Amount.Decimal,
		Quantity:       in.Body.Quantity,
	}

	return geh.expenseItemSvc.Add(ctx, request)
}

func (geh *ExpenseItemHandler) updateExpenseItem(ctx context.Context, in UpdateExpenseItemInput) error {
	request := dto.UpdateExpenseItemRequest{
		UserProfileID:  in.ProfileID,
		ID:             in.ExpenseItemID,
		GroupExpenseID: in.GroupExpenseID,
		Name:           in.Body.Name,
		Amount:         in.Body.Amount.Decimal,
		Quantity:       in.Body.Quantity,
	}

	return geh.expenseItemSvc.Update(ctx, request)
}

func (geh *ExpenseItemHandler) removeExpenseItem(ctx context.Context, in RemoveExpenseItemInput) error {
	return geh.expenseItemSvc.Remove(ctx, in.GroupExpenseID, in.ExpenseItemID, in.ProfileID)
}

func (geh *ExpenseItemHandler) syncExpenseItemParticipants(ctx context.Context, in SyncExpenseItemParticipantsInput) error {
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
}

func (geh *ExpenseItemHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[AddExpenseItemInput]{
			OperationID: "add-expense-item",
			Method:      http.MethodPost,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/items",
			Summary:     "Add an item to a group expense",
			Tags:        []string{"expense-items"},
			Secured:     true,
			HandlerFunc: geh.addExpenseItem,
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[UpdateExpenseItemInput]{
			OperationID: "update-expense-item",
			Method:      http.MethodPut,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}",
			Summary:     "Update an expense item",
			Tags:        []string{"expense-items"},
			Secured:     true,
			HandlerFunc: geh.updateExpenseItem,
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[RemoveExpenseItemInput]{
			OperationID: "remove-expense-item",
			Method:      http.MethodDelete,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}",
			Summary:     "Remove an expense item",
			Tags:        []string{"expense-items"},
			Secured:     true,
			HandlerFunc: geh.removeExpenseItem,
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[SyncExpenseItemParticipantsInput]{
			OperationID: "sync-expense-item-participants",
			Method:      http.MethodPut,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}/participants",
			Summary:     "Sync participants of an expense item",
			Tags:        []string{"expense-items"},
			Secured:     true,
			HandlerFunc: geh.syncExpenseItemParticipants,
		}),
	}
}
