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

type ExpenseBillHandler struct {
	expenseBillService service.ExpenseBillService
}

func NewExpenseBillHandler(expenseBillService service.ExpenseBillService) *ExpenseBillHandler {
	return &ExpenseBillHandler{expenseBillService}
}

type PresignedSaveExpenseBillInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	Body           struct {
		Filename string `json:"fileName" minLength:"3"`
	}
}

type PresignedSaveExpenseBillOutput struct {
	Body dto.PresignedExpenseBillResponse
}

// RegisterPresignedSave registers POST /api/v1/group-expenses/{groupExpenseID}/bills on the Huma API.
func (geh *ExpenseBillHandler) RegisterPresignedSave(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "presigned-save-expense-bill",
		Method:        http.MethodPost,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/bills",
		Summary:       "Get a presigned URL to upload an expense bill",
		Tags:          []string{"expense-bills"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *PresignedSaveExpenseBillInput) (*PresignedSaveExpenseBillOutput, error) {
		request := dto.PresignedExpenseBillRequest{
			ProfileID:      in.ProfileID,
			GroupExpenseID: in.GroupExpenseID,
			Filename:       in.Body.Filename,
		}

		res, err := geh.expenseBillService.SavePresigned(ctx, request)
		if err != nil {
			return nil, err
		}

		return &PresignedSaveExpenseBillOutput{Body: res}, nil
	})
}

type TriggerExpenseBillParsingInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	ExpenseBillID  uuid.UUID `path:"expenseBillID"`
}

type TriggerExpenseBillParsingOutput struct{}

// RegisterTriggerParsing registers PUT /api/v1/group-expenses/{groupExpenseID}/bills/{expenseBillID} on the Huma API.
func (geh *ExpenseBillHandler) RegisterTriggerParsing(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "trigger-expense-bill-parsing",
		Method:        http.MethodPut,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/bills/{expenseBillID}",
		Summary:       "Trigger parsing of an uploaded expense bill",
		Tags:          []string{"expense-bills"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *TriggerExpenseBillParsingInput) (*TriggerExpenseBillParsingOutput, error) {
		if err := geh.expenseBillService.TriggerParsing(ctx, in.GroupExpenseID, in.ExpenseBillID); err != nil {
			return nil, err
		}

		return &TriggerExpenseBillParsingOutput{}, nil
	})
}
