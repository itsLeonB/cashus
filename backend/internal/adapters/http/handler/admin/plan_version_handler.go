package admin

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
)

type PlanVersionHandler struct {
	svc service.PlanVersionService
}

type CreatePlanVersionInput struct {
	httpapi.AdminAuthInput
	Body struct {
		PlanID             uuid.UUID       `json:"planId"`
		PriceAmount        httpapi.Decimal `json:"priceAmount"`
		PriceCurrency      string          `json:"priceCurrency" minLength:"3" maxLength:"3"`
		BillingInterval    string          `json:"billingInterval" enum:"monthly,yearly"`
		BillUploadsDaily   uint            `json:"billUploadsDaily,omitempty"`
		BillUploadsMonthly uint            `json:"billUploadsMonthly,omitempty"`
		EffectiveFrom      time.Time       `json:"effectiveFrom"`
		EffectiveTo        time.Time       `json:"effectiveTo,omitempty"`
		IsDefault          bool            `json:"isDefault,omitempty"`
	}
}

type CreatePlanVersionOutput struct {
	Body dto.PlanVersionResponse
}

// RegisterCreate registers POST /admin/v1/plan-versions on the Huma API.
func (pvh *PlanVersionHandler) RegisterCreate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-admin-plan-version",
		Method:        http.MethodPost,
		Path:          "/admin/v1/plan-versions",
		Summary:       "Create a plan version",
		Tags:          []string{"admin-plan-versions"},
		DefaultStatus: http.StatusCreated,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *CreatePlanVersionInput) (*CreatePlanVersionOutput, error) {
		request := dto.NewPlanVersionRequest{
			PlanID:             in.Body.PlanID,
			PriceAmount:        in.Body.PriceAmount.Decimal,
			PriceCurrency:      in.Body.PriceCurrency,
			BillingInterval:    in.Body.BillingInterval,
			BillUploadsDaily:   in.Body.BillUploadsDaily,
			BillUploadsMonthly: in.Body.BillUploadsMonthly,
			EffectiveFrom:      in.Body.EffectiveFrom,
			EffectiveTo:        in.Body.EffectiveTo,
			IsDefault:          in.Body.IsDefault,
		}

		res, err := pvh.svc.Create(ctx, request)
		if err != nil {
			return nil, err
		}

		return &CreatePlanVersionOutput{Body: res}, nil
	})
}

type GetPlanVersionListInput struct {
	httpapi.AdminAuthInput
}

type GetPlanVersionListOutput struct {
	XTotalCount int `header:"X-Total-Count"`
	Body        []dto.PlanVersionResponse
}

// RegisterGetList registers GET /admin/v1/plan-versions on the Huma API.
func (pvh *PlanVersionHandler) RegisterGetList(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-plan-versions",
		Method:        http.MethodGet,
		Path:          "/admin/v1/plan-versions",
		Summary:       "Get all plan versions",
		Tags:          []string{"admin-plan-versions"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetPlanVersionListInput) (*GetPlanVersionListOutput, error) {
		res, err := pvh.svc.GetList(ctx)
		if err != nil {
			return nil, err
		}

		return &GetPlanVersionListOutput{XTotalCount: len(res), Body: res}, nil
	})
}

type GetPlanVersionInput struct {
	httpapi.AdminAuthInput
	PlanVersionID uuid.UUID `path:"planVersionID"`
}

type GetPlanVersionOutput struct {
	Body dto.PlanVersionResponse
}

// RegisterGetOne registers GET /admin/v1/plan-versions/{planVersionID} on the Huma API.
func (pvh *PlanVersionHandler) RegisterGetOne(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "get-admin-plan-version",
		Method:        http.MethodGet,
		Path:          "/admin/v1/plan-versions/{planVersionID}",
		Summary:       "Get a plan version by ID",
		Tags:          []string{"admin-plan-versions"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *GetPlanVersionInput) (*GetPlanVersionOutput, error) {
		res, err := pvh.svc.GetOne(ctx, in.PlanVersionID)
		if err != nil {
			return nil, err
		}

		return &GetPlanVersionOutput{Body: res}, nil
	})
}

type UpdatePlanVersionInput struct {
	httpapi.AdminAuthInput
	PlanVersionID uuid.UUID `path:"planVersionID"`
	Body          struct {
		PlanID             uuid.UUID       `json:"planId"`
		PriceAmount        httpapi.Decimal `json:"priceAmount"`
		PriceCurrency      string          `json:"priceCurrency" minLength:"3" maxLength:"3"`
		BillingInterval    string          `json:"billingInterval" enum:"monthly,yearly"`
		BillUploadsDaily   uint            `json:"billUploadsDaily,omitempty"`
		BillUploadsMonthly uint            `json:"billUploadsMonthly,omitempty"`
		EffectiveFrom      time.Time       `json:"effectiveFrom"`
		EffectiveTo        time.Time       `json:"effectiveTo,omitempty"`
		IsDefault          bool            `json:"isDefault,omitempty"`
	}
}

type UpdatePlanVersionOutput struct {
	Body dto.PlanVersionResponse
}

// RegisterUpdate registers PUT /admin/v1/plan-versions/{planVersionID} on the Huma API.
func (pvh *PlanVersionHandler) RegisterUpdate(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "update-admin-plan-version",
		Method:        http.MethodPut,
		Path:          "/admin/v1/plan-versions/{planVersionID}",
		Summary:       "Update a plan version",
		Tags:          []string{"admin-plan-versions"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *UpdatePlanVersionInput) (*UpdatePlanVersionOutput, error) {
		request := dto.UpdatePlanVersionRequest{
			ID:                 in.PlanVersionID,
			PlanID:             in.Body.PlanID,
			PriceAmount:        in.Body.PriceAmount.Decimal,
			PriceCurrency:      in.Body.PriceCurrency,
			BillingInterval:    in.Body.BillingInterval,
			BillUploadsDaily:   in.Body.BillUploadsDaily,
			BillUploadsMonthly: in.Body.BillUploadsMonthly,
			EffectiveFrom:      in.Body.EffectiveFrom,
			EffectiveTo:        in.Body.EffectiveTo,
			IsDefault:          in.Body.IsDefault,
		}

		res, err := pvh.svc.Update(ctx, request)
		if err != nil {
			return nil, err
		}

		return &UpdatePlanVersionOutput{Body: res}, nil
	})
}

type DeletePlanVersionInput struct {
	httpapi.AdminAuthInput
	PlanVersionID uuid.UUID `path:"planVersionID"`
}

type DeletePlanVersionOutput struct {
	Body dto.PlanVersionResponse
}

// RegisterDelete registers DELETE /admin/v1/plan-versions/{planVersionID} on the Huma API.
func (pvh *PlanVersionHandler) RegisterDelete(api huma.API, mw ...func(huma.Context, func(huma.Context))) {
	huma.Register(api, huma.Operation{
		OperationID:   "delete-admin-plan-version",
		Method:        http.MethodDelete,
		Path:          "/admin/v1/plan-versions/{planVersionID}",
		Summary:       "Delete a plan version",
		Tags:          []string{"admin-plan-versions"},
		DefaultStatus: http.StatusOK,
		Security:      []map[string][]string{{"BearerAuth": {}}},
		Middlewares:   mw,
	}, func(ctx context.Context, in *DeletePlanVersionInput) (*DeletePlanVersionOutput, error) {
		res, err := pvh.svc.Delete(ctx, in.PlanVersionID)
		if err != nil {
			return nil, err
		}

		return &DeletePlanVersionOutput{Body: res}, nil
	})
}
