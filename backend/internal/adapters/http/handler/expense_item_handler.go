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
		Amount   httpapi.Decimal `json:"amount"`
		Quantity int             `json:"quantity" minimum:"1"`
	}
}

type AddExpenseItemOutput struct{}

// RegisterAdd registers POST /api/v1/group-expenses/{groupExpenseID}/items on the Huma API.
func (geh *ExpenseItemHandler) RegisterAdd(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "add-expense-item",
		Method:        http.MethodPost,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/items",
		Summary:       "Add an item to a group expense",
		Tags:          []string{"expense-items"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *AddExpenseItemInput) (*AddExpenseItemOutput, error) {
		request := dto.NewExpenseItemRequest{
			UserProfileID:  in.ProfileID,
			GroupExpenseID: in.GroupExpenseID,
			Name:           in.Body.Name,
			Amount:         in.Body.Amount.Decimal,
			Quantity:       in.Body.Quantity,
		}

		if err := geh.expenseItemSvc.Add(ctx, request); err != nil {
			return nil, err
		}

		return &AddExpenseItemOutput{}, nil
	})
}

type UpdateExpenseItemInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	ExpenseItemID  uuid.UUID `path:"expenseItemID"`
	Body           struct {
		Name     string          `json:"name" minLength:"3"`
		Amount   httpapi.Decimal `json:"amount"`
		Quantity int             `json:"quantity" minimum:"1"`
	}
}

type UpdateExpenseItemOutput struct{}

// RegisterUpdate registers PUT /api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID} on the Huma API.
func (geh *ExpenseItemHandler) RegisterUpdate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "update-expense-item",
		Method:        http.MethodPut,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}",
		Summary:       "Update an expense item",
		Tags:          []string{"expense-items"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *UpdateExpenseItemInput) (*UpdateExpenseItemOutput, error) {
		request := dto.UpdateExpenseItemRequest{
			UserProfileID:  in.ProfileID,
			ID:             in.ExpenseItemID,
			GroupExpenseID: in.GroupExpenseID,
			Name:           in.Body.Name,
			Amount:         in.Body.Amount.Decimal,
			Quantity:       in.Body.Quantity,
		}

		if err := geh.expenseItemSvc.Update(ctx, request); err != nil {
			return nil, err
		}

		return &UpdateExpenseItemOutput{}, nil
	})
}

type RemoveExpenseItemInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	ExpenseItemID  uuid.UUID `path:"expenseItemID"`
}

type RemoveExpenseItemOutput struct{}

// RegisterRemove registers DELETE /api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID} on the Huma API.
func (geh *ExpenseItemHandler) RegisterRemove(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "remove-expense-item",
		Method:        http.MethodDelete,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}",
		Summary:       "Remove an expense item",
		Tags:          []string{"expense-items"},
		DefaultStatus: http.StatusNoContent,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *RemoveExpenseItemInput) (*RemoveExpenseItemOutput, error) {
		if err := geh.expenseItemSvc.Remove(ctx, in.GroupExpenseID, in.ExpenseItemID, in.ProfileID); err != nil {
			return nil, err
		}

		return &RemoveExpenseItemOutput{}, nil
	})
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

type SyncExpenseItemParticipantsOutput struct{}

// RegisterSyncParticipants registers PUT /api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}/participants on the Huma API.
func (geh *ExpenseItemHandler) RegisterSyncParticipants(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "sync-expense-item-participants",
		Method:        http.MethodPut,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/items/{expenseItemID}/participants",
		Summary:       "Sync participants of an expense item",
		Tags:          []string{"expense-items"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *SyncExpenseItemParticipantsInput) (*SyncExpenseItemParticipantsOutput, error) {
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

		if err := geh.expenseItemSvc.SyncParticipants(ctx, request); err != nil {
			return nil, err
		}

		return &SyncExpenseItemParticipantsOutput{}, nil
	})
}
