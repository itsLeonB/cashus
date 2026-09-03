package provider

import (
	"testing"

	adminConfig "github.com/itsLeonB/cashback/internal/core/config/admin"
	"github.com/stretchr/testify/assert"
)

// TestProvideAdminConfig_ReadsGlobalAtCallTime guards against a regression
// to wire.Value(adminConfig.Global): that binding would capture the pointer
// once, via a package-level var initializer that runs at package-init time
// — before any cmd/*/main.go has called config.Load() to populate it —
// permanently freezing the injected value at nil. ProvideAdminConfig must
// instead read the package var live, on every call, so it observes whatever
// admin.Global holds by the time wire's generated code actually invokes it.
func TestProvideAdminConfig_ReadsGlobalAtCallTime(t *testing.T) {
	original := adminConfig.Global
	defer func() { adminConfig.Global = original }()

	adminConfig.Global = nil
	assert.Nil(t, ProvideAdminConfig(), "expected nil before config.Load() populates the global, matching real startup order")

	cfg := &adminConfig.Config{}
	adminConfig.Global = cfg
	assert.Same(t, cfg, ProvideAdminConfig(), "expected the provider to observe a global set after this call was defined, not a value captured earlier")
}
