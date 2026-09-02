package admin

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	dto "github.com/itsLeonB/cashback/internal/domain/dto/monetization"
	service "github.com/itsLeonB/cashback/internal/domain/service/monetization"
	"github.com/itsLeonB/cashback/internal/endpoint"
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

type GetPlanVersionListInput struct {
	httpapi.AdminAuthInput
}

type GetPlanVersionInput struct {
	httpapi.AdminAuthInput
	PlanVersionID uuid.UUID `path:"planVersionID"`
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

type DeletePlanVersionInput struct {
	httpapi.AdminAuthInput
	PlanVersionID uuid.UUID `path:"planVersionID"`
}

// Routes returns every route PlanVersionHandler exposes via
// endpoint.Endpoint, for registration via endpoint.RegisterAll.
func (pvh *PlanVersionHandler) getAdminPlanVersions(ctx context.Context, in GetPlanVersionListInput) ([]dto.PlanVersionResponse, error) {
	return pvh.svc.GetList(ctx)
}

func (pvh *PlanVersionHandler) createAdminPlanVersion(ctx context.Context, in CreatePlanVersionInput) (dto.PlanVersionResponse, error) {
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

	return pvh.svc.Create(ctx, request)
}

func (pvh *PlanVersionHandler) getAdminPlanVersion(ctx context.Context, in GetPlanVersionInput) (dto.PlanVersionResponse, error) {
	return pvh.svc.GetOne(ctx, in.PlanVersionID)
}

func (pvh *PlanVersionHandler) updateAdminPlanVersion(ctx context.Context, in UpdatePlanVersionInput) (dto.PlanVersionResponse, error) {
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

	return pvh.svc.Update(ctx, request)
}

func (pvh *PlanVersionHandler) deleteAdminPlanVersion(ctx context.Context, in DeletePlanVersionInput) (dto.PlanVersionResponse, error) {
	return pvh.svc.Delete(ctx, in.PlanVersionID)
}

func (pvh *PlanVersionHandler) Routes() []endpoint.Registrable {
	return []endpoint.Registrable{
		endpoint.NewList(endpoint.ListEndpoint[GetPlanVersionListInput, dto.PlanVersionResponse]{
			OperationID: "get-admin-plan-versions",
			Method:      http.MethodGet,
			Path:        "/admin/v1/plan-versions",
			Summary:     "Get all plan versions",
			Tags:        []string{"admin-plan-versions"},
			Secured:     true,
			HandlerFunc: pvh.getAdminPlanVersions,
		}),
		endpoint.New(endpoint.Endpoint[CreatePlanVersionInput, dto.PlanVersionResponse]{
			OperationID: "create-admin-plan-version",
			Method:      http.MethodPost,
			Path:        "/admin/v1/plan-versions",
			Summary:     "Create a plan version",
			Tags:        []string{"admin-plan-versions"},
			SuccessCode: http.StatusCreated,
			Secured:     true,
			HandlerFunc: pvh.createAdminPlanVersion,
		}),
		endpoint.New(endpoint.Endpoint[GetPlanVersionInput, dto.PlanVersionResponse]{
			OperationID: "get-admin-plan-version",
			Method:      http.MethodGet,
			Path:        "/admin/v1/plan-versions/{planVersionID}",
			Summary:     "Get a plan version by ID",
			Tags:        []string{"admin-plan-versions"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: pvh.getAdminPlanVersion,
		}),
		endpoint.New(endpoint.Endpoint[UpdatePlanVersionInput, dto.PlanVersionResponse]{
			OperationID: "update-admin-plan-version",
			Method:      http.MethodPut,
			Path:        "/admin/v1/plan-versions/{planVersionID}",
			Summary:     "Update a plan version",
			Tags:        []string{"admin-plan-versions"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: pvh.updateAdminPlanVersion,
		}),
		endpoint.New(endpoint.Endpoint[DeletePlanVersionInput, dto.PlanVersionResponse]{
			OperationID: "delete-admin-plan-version",
			Method:      http.MethodDelete,
			Path:        "/admin/v1/plan-versions/{planVersionID}",
			Summary:     "Delete a plan version",
			Tags:        []string{"admin-plan-versions"},
			SuccessCode: http.StatusOK,
			Secured:     true,
			HandlerFunc: pvh.deleteAdminPlanVersion,
		}),
	}
}
