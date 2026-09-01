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

type TriggerExpenseBillParsingInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	ExpenseBillID  uuid.UUID `path:"expenseBillID"`
}

// Routes returns every route ExpenseBillHandler exposes via
// endpoint.Endpoint / endpoint.NoBodyEndpoint, for registration via
// endpoint.RegisterAll.
func (geh *ExpenseBillHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[PresignedSaveExpenseBillInput, dto.PresignedExpenseBillResponse]{
			OperationID: "presigned-save-expense-bill",
			Method:      http.MethodPost,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/bills",
			Summary:     "Get a presigned URL to upload an expense bill",
			Tags:        []string{"expense-bills"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in PresignedSaveExpenseBillInput) (dto.PresignedExpenseBillResponse, error) {
				request := dto.PresignedExpenseBillRequest{
					ProfileID:      in.ProfileID,
					GroupExpenseID: in.GroupExpenseID,
					Filename:       in.Body.Filename,
				}

				return geh.expenseBillService.SavePresigned(ctx, request)
			},
		}),
		endpoint.New(endpoint.Endpoint[TriggerExpenseBillParsingInput, dto.ExpenseBillResponse]{
			OperationID: "trigger-expense-bill-parsing",
			Method:      http.MethodPut,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/bills/{expenseBillID}",
			Summary:     "Trigger parsing of an uploaded expense bill",
			Tags:        []string{"expense-bills"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in TriggerExpenseBillParsingInput) (dto.ExpenseBillResponse, error) {
				return geh.expenseBillService.TriggerParsing(ctx, in.ProfileID, in.GroupExpenseID, in.ExpenseBillID)
			},
		}),
	}
}
