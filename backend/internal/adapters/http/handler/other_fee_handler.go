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
		Amount            httpapi.Decimal               `json:"amount"`
		CalculationMethod expenses.FeeCalculationMethod `json:"calculationMethod" enum:"EQUAL_SPLIT,ITEMIZED_SPLIT"`
	}
}

type AddOtherFeeOutput struct {
	Body dto.OtherFeeResponse
}

// RegisterAdd registers POST /api/v1/group-expenses/{groupExpenseID}/fees on the Huma API.
func (geh *OtherFeeHandler) RegisterAdd(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "add-other-fee",
		Method:        http.MethodPost,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/fees",
		Summary:       "Add a fee to a group expense",
		Tags:          []string{"other-fees"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *AddOtherFeeInput) (*AddOtherFeeOutput, error) {
		request := dto.NewOtherFeeRequest{
			UserProfileID:     in.ProfileID,
			GroupExpenseID:    in.GroupExpenseID,
			Name:              in.Body.Name,
			Amount:            in.Body.Amount.Decimal,
			CalculationMethod: in.Body.CalculationMethod,
		}

		res, err := geh.otherFeeSvc.Add(ctx, request)
		if err != nil {
			return nil, err
		}

		return &AddOtherFeeOutput{Body: res}, nil
	})
}

type UpdateOtherFeeInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	OtherFeeID     uuid.UUID `path:"otherFeeID"`
	Body           struct {
		Name              string                        `json:"name" minLength:"3"`
		Amount            httpapi.Decimal               `json:"amount"`
		CalculationMethod expenses.FeeCalculationMethod `json:"calculationMethod" enum:"EQUAL_SPLIT,ITEMIZED_SPLIT"`
	}
}

type UpdateOtherFeeOutput struct {
	Body dto.OtherFeeResponse
}

// RegisterUpdate registers PUT /api/v1/group-expenses/{groupExpenseID}/fees/{otherFeeID} on the Huma API.
func (geh *OtherFeeHandler) RegisterUpdate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "update-other-fee",
		Method:        http.MethodPut,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/fees/{otherFeeID}",
		Summary:       "Update a fee on a group expense",
		Tags:          []string{"other-fees"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *UpdateOtherFeeInput) (*UpdateOtherFeeOutput, error) {
		request := dto.UpdateOtherFeeRequest{
			UserProfileID:     in.ProfileID,
			ID:                in.OtherFeeID,
			GroupExpenseID:    in.GroupExpenseID,
			Name:              in.Body.Name,
			Amount:            in.Body.Amount.Decimal,
			CalculationMethod: in.Body.CalculationMethod,
		}

		res, err := geh.otherFeeSvc.Update(ctx, request)
		if err != nil {
			return nil, err
		}

		return &UpdateOtherFeeOutput{Body: res}, nil
	})
}

type RemoveOtherFeeInput struct {
	httpapi.AuthInput
	GroupExpenseID uuid.UUID `path:"groupExpenseID"`
	OtherFeeID     uuid.UUID `path:"otherFeeID"`
}

type RemoveOtherFeeOutput struct{}

// RegisterRemove registers DELETE /api/v1/group-expenses/{groupExpenseID}/fees/{otherFeeID} on the Huma API.
func (geh *OtherFeeHandler) RegisterRemove(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "remove-other-fee",
		Method:        http.MethodDelete,
		Path:          "/api/v1/group-expenses/{groupExpenseID}/fees/{otherFeeID}",
		Summary:       "Remove a fee from a group expense",
		Tags:          []string{"other-fees"},
		DefaultStatus: http.StatusNoContent,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *RemoveOtherFeeInput) (*RemoveOtherFeeOutput, error) {
		if err := geh.otherFeeSvc.Remove(ctx, in.GroupExpenseID, in.OtherFeeID, in.ProfileID); err != nil {
			return nil, err
		}

		return &RemoveOtherFeeOutput{}, nil
	})
}

type GetFeeCalculationMethodsInput struct {
	httpapi.AuthInput
}

type GetFeeCalculationMethodsOutput struct {
	Body []dto.FeeCalculationMethodInfo
}

// RegisterGetFeeCalculationMethods registers GET /api/v1/group-expenses/fee-calculation-methods on the Huma API.
func (geh *OtherFeeHandler) RegisterGetFeeCalculationMethods(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-fee-calculation-methods",
		Method:        http.MethodGet,
		Path:          "/api/v1/group-expenses/fee-calculation-methods",
		Summary:       "Get available fee calculation methods",
		Tags:          []string{"other-fees"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetFeeCalculationMethodsInput) (*GetFeeCalculationMethodsOutput, error) {
		return &GetFeeCalculationMethodsOutput{Body: geh.otherFeeSvc.GetCalculationMethods()}, nil
	})
}
