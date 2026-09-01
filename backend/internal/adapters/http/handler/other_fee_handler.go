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

type OtherFeeHandler struct {
	otherFeeSvc service.OtherFeeService
}

func NewOtherFeeHandler(
	otherFeeSvc service.OtherFeeService,
) *OtherFeeHandler {
	return &OtherFeeHandler{
		otherFeeSvc,
	}
}

type AddOtherFeeInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	Body           struct {
		Name              string                        `json:"name" minLength:"3"`
		Amount            httpapi.Decimal               `json:"amount" required:"true"`
		CalculationMethod expenses.FeeCalculationMethod `json:"calculationMethod" enum:"EQUAL_SPLIT,ITEMIZED_SPLIT"`
	}
}

type UpdateOtherFeeInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	OtherFeeID     uuid.UUID `path:"otherFeeID"`
	Body           struct {
		Name              string                        `json:"name" minLength:"3"`
		Amount            httpapi.Decimal               `json:"amount" required:"true"`
		CalculationMethod expenses.FeeCalculationMethod `json:"calculationMethod" enum:"EQUAL_SPLIT,ITEMIZED_SPLIT"`
	}
}

type RemoveOtherFeeInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	OtherFeeID     uuid.UUID `path:"otherFeeID"`
}

type GetFeeCalculationMethodsInput struct {
	httpapi.AuthInput
}

// Routes returns every route OtherFeeHandler exposes via endpoint.Endpoint /
// endpoint.NoBodyEndpoint, for registration via endpoint.RegisterAll.
func (geh *OtherFeeHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.New(endpoint.Endpoint[AddOtherFeeInput, dto.OtherFeeResponse]{
			OperationID: "add-other-fee",
			Method:      http.MethodPost,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/fees",
			Summary:     "Add a fee to a group expense",
			Tags:        []string{"other-fees"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in AddOtherFeeInput) (dto.OtherFeeResponse, error) {
				request := dto.NewOtherFeeRequest{
					UserProfileID:     in.ProfileID,
					GroupExpenseID:    in.GroupExpenseID,
					Name:              in.Body.Name,
					Amount:            in.Body.Amount.Decimal,
					CalculationMethod: in.Body.CalculationMethod,
				}

				return geh.otherFeeSvc.Add(ctx, request)
			},
		}),
		endpoint.New(endpoint.Endpoint[UpdateOtherFeeInput, dto.OtherFeeResponse]{
			OperationID: "update-other-fee",
			Method:      http.MethodPut,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/fees/{otherFeeID}",
			Summary:     "Update a fee on a group expense",
			Tags:        []string{"other-fees"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in UpdateOtherFeeInput) (dto.OtherFeeResponse, error) {
				request := dto.UpdateOtherFeeRequest{
					UserProfileID:     in.ProfileID,
					ID:                in.OtherFeeID,
					GroupExpenseID:    in.GroupExpenseID,
					Name:              in.Body.Name,
					Amount:            in.Body.Amount.Decimal,
					CalculationMethod: in.Body.CalculationMethod,
				}

				return geh.otherFeeSvc.Update(ctx, request)
			},
		}),
		endpoint.New(endpoint.Endpoint[GetFeeCalculationMethodsInput, []dto.FeeCalculationMethodInfo]{
			OperationID: "get-fee-calculation-methods",
			Method:      http.MethodGet,
			Path:        "/api/v1/group-expenses/fee-calculation-methods",
			Summary:     "Get available fee calculation methods",
			Tags:        []string{"other-fees"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in GetFeeCalculationMethodsInput) ([]dto.FeeCalculationMethodInfo, error) {
				return geh.otherFeeSvc.GetCalculationMethods(), nil
			},
		}),
		endpoint.NewNoBody(endpoint.NoBodyEndpoint[RemoveOtherFeeInput]{
			OperationID: "remove-other-fee",
			Method:      http.MethodDelete,
			Path:        "/api/v1/group-expenses/{groupExpenseID}/fees/{otherFeeID}",
			Summary:     "Remove a fee from a group expense",
			Tags:        []string{"other-fees"},
			Secured:     true,
			ServiceFunc: func(ctx context.Context, in RemoveOtherFeeInput) error {
				return geh.otherFeeSvc.Remove(ctx, in.GroupExpenseID, in.OtherFeeID, in.ProfileID)
			},
		}),
	}
}
