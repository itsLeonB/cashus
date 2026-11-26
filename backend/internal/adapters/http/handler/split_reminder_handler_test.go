package handler

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	httpapi "github.com/itsLeonB/cashback/internal/adapters/http/huma"
	adapters "github.com/itsLeonB/cashback/internal/adapters/repository"
	"github.com/itsLeonB/cashback/internal/appconstant"
	"github.com/itsLeonB/cashback/internal/domain/service"
	"github.com/itsLeonB/cashback/internal/endpoint"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func reminderRouter(h *SplitReminderHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set(appconstant.ContextProfileID.String(), c.GetHeader("X-Test-Profile")) })
	api := humagin.New(router, httpapi.NewConfig())
	endpoint.RegisterAll(api, h.Routes())
	return router
}
func reminderRequest(router *gin.Engine, method, path, body, key, actor string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-Profile", actor)
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response
}
func TestSendSplitReminderRejectsInvalidInput(t *testing.T) {
	router := reminderRouter(&SplitReminderHandler{Repository: service.NewSplitReminderService(nil)})
	for _, body := range []string{`{"description":""}`, `{"description":"meal","mealDate":"2025-02-30"}`, `{"description":"meal","mealDate":"0000-01-01"}`} {
		response := reminderRequest(router, "POST", "/api/v1/friendships/11111111-1111-1111-1111-111111111111/split-reminders", body, uuid.NewString(), uuid.NewString())
		assert.Equal(t, 422, response.Code, response.Body.String())
	}
}

func TestSplitRemindersHTTPPostgres(t *testing.T) {
	dsn := os.Getenv("SPLIT_REMINDER_TEST_DSN")
	if dsn == "" {
		t.Skip("set SPLIT_REMINDER_TEST_DSN to run real Postgres HTTP tests")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	schema := "sr_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	require.NoError(t, db.Exec("CREATE SCHEMA "+schema).Error)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
	db, err = gorm.Open(postgres.Open(dsn+" search_path="+schema), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err = db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { db.Exec("DROP SCHEMA " + schema + " CASCADE"); _ = sqlDB.Close() })
	require.NoError(t, db.Exec(`CREATE TABLE friendships(id uuid PRIMARY KEY,profile_id1 uuid,profile_id2 uuid,type text,created_at timestamptz,updated_at timestamptz)`).Error)
	migration, err := os.ReadFile("../../../adapters/db/postgres/migrations/20260905090000_create_split_reminders.sql")
	require.NoError(t, err)
	up := strings.Split(string(migration), "-- +goose Down")[0]
	require.NoError(t, db.Exec(up).Error)
	actor, recipient, outsider, friendship := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	require.NoError(t, db.Exec("INSERT INTO friendships(id,profile_id1,profile_id2,type) VALUES(?,?,?,'REAL')", friendship, actor, recipient).Error)
	router := reminderRouter(&SplitReminderHandler{Repository: service.NewSplitReminderService(adapters.NewSplitReminderRepository(db))})
	path := "/api/v1/friendships/" + friendship + "/split-reminders"
	key := uuid.NewString()
	send := reminderRequest(router, "POST", path, `{"description":"  Shared\t meal  "}`, key, actor)
	require.Equal(t, 201, send.Code, send.Body.String())
	var envelope struct {
		Data struct {
			ID          string `json:"id"`
			Description string `json:"description"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(send.Body.Bytes(), &envelope))
	assert.Equal(t, "Shared meal", envelope.Data.Description)
	replay := reminderRequest(router, "POST", path, `{"description":"Shared meal"}`, key, actor)
	assert.Equal(t, 201, replay.Code, replay.Body.String())
	assert.JSONEq(t, send.Body.String(), replay.Body.String())
	assert.Equal(t, 409, reminderRequest(router, "POST", path, `{"description":"other"}`, key, actor).Code)
	assert.Equal(t, 409, reminderRequest(router, "POST", path, `{"description":"SHARED meal","mealDate":null}`, uuid.NewString(), actor).Code)
	assert.Equal(t, 200, reminderRequest(router, "GET", path, "", "", recipient).Code)
	assert.Equal(t, 404, reminderRequest(router, "GET", path, "", "", outsider).Code)
	retrieve := "/api/v1/split-reminders/" + envelope.Data.ID
	assert.Equal(t, 200, reminderRequest(router, "GET", retrieve, "", "", recipient).Code)
	assert.Equal(t, 404, reminderRequest(router, "GET", retrieve, "", "", outsider).Code)
	assert.Equal(t, 422, reminderRequest(router, "POST", path, `{"description":"meal"}`, "", actor).Code)
	var wg sync.WaitGroup
	codes := make(chan int, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			codes <- reminderRequest(router, "POST", path, `{"description":"concurrent meal"}`, uuid.NewString(), actor).Code
		}()
	}
	wg.Wait()
	close(codes)
	created := 0
	for code := range codes {
		if code == 201 {
			created++
		} else {
			assert.Equal(t, 409, code)
		}
	}
	assert.Equal(t, 1, created)
	// Merging an anonymous placeholder into an existing real friendship must
	// retain the real friendship's reminder and its sender-scoped replay key.
	require.NoError(t, db.Exec("CREATE TABLE user_profiles(id uuid PRIMARY KEY,user_id uuid)").Error)
	require.NoError(t, db.Exec("INSERT INTO user_profiles(id,user_id) VALUES(?,?),(?,?)", actor, uuid.NewString(), recipient, uuid.NewString()).Error)
	anonProfile, mergeFriendship := uuid.NewString(), uuid.NewString()
	require.NoError(t, db.Exec("INSERT INTO user_profiles(id) VALUES(?)", anonProfile).Error)
	require.NoError(t, db.Exec("INSERT INTO friendships(id,profile_id1,profile_id2,type) VALUES(?,?,?,'ANON')", mergeFriendship, actor, anonProfile).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return adapters.NewFriendshipRepository(tx).RepointFriendships(context.Background(), uuid.MustParse(anonProfile), uuid.MustParse(recipient))
	}))
	assert.Equal(t, 200, reminderRequest(router, "GET", retrieve, "", "", actor).Code)
	assert.Equal(t, 201, reminderRequest(router, "POST", path, `{"description":"Shared meal"}`, key, actor).Code)
	// Same key must replay once even when requests overlap.
	replayCodes := make(chan int, 8)
	replayKey := uuid.NewString()
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			replayCodes <- reminderRequest(router, "POST", path, `{"description":"replay race","mealDate":"2026-01-01"}`, replayKey, actor).Code
		}()
	}
	wg.Wait()
	close(replayCodes)
	for code := range replayCodes {
		assert.Equal(t, 201, code)
	}
	assert.Equal(t, 201, reminderRequest(router, "POST", path, `{"description":"Shared meal","mealDate":"2026-01-01"}`, uuid.NewString(), actor).Code)
	assert.Equal(t, 201, reminderRequest(router, "POST", path, `{"description":"Shared meal"}`, uuid.NewString(), recipient).Code)
	anonID := uuid.NewString()
	require.NoError(t, db.Exec("INSERT INTO friendships(id,profile_id1,profile_id2,type) VALUES(?,?,?,'ANON')", anonID, actor, uuid.NewString()).Error)
	anonPath := "/api/v1/friendships/" + anonID + "/split-reminders"
	assert.Equal(t, 409, reminderRequest(router, "POST", anonPath, `{"description":"meal"}`, uuid.NewString(), actor).Code)
	assert.Equal(t, 404, reminderRequest(router, "POST", anonPath, `{"description":"meal"}`, uuid.NewString(), outsider).Code)
	require.NoError(t, db.Exec("DELETE FROM friendships WHERE id=?", friendship).Error)
	assert.Equal(t, 404, reminderRequest(router, "GET", retrieve, "", "", actor).Code)
	assert.Equal(t, 404, reminderRequest(router, "POST", path, `{"description":"Shared meal"}`, key, actor).Code)
	// Removal and send must serialize: no OPEN duplicate may survive removal.
	raceFriend, raceRecipient := uuid.NewString(), uuid.NewString()
	require.NoError(t, db.Exec("INSERT INTO friendships(id,profile_id1,profile_id2,type) VALUES(?,?,?,'REAL')", raceFriend, actor, raceRecipient).Error)
	racePath := "/api/v1/friendships/" + raceFriend + "/split-reminders"
	var raceSend *httptest.ResponseRecorder
	wg.Add(1)
	go func() {
		defer wg.Done()
		raceSend = reminderRequest(router, "POST", racePath, `{"description":"closure race"}`, uuid.NewString(), actor)
	}()
	require.NoError(t, db.Exec("DELETE FROM friendships WHERE id=?", raceFriend).Error)
	wg.Wait()
	assert.Contains(t, []int{201, 404}, raceSend.Code, raceSend.Body.String())
	newRaceFriend := uuid.NewString()
	require.NoError(t, db.Exec("INSERT INTO friendships(id,profile_id1,profile_id2,type) VALUES(?,?,?,'REAL')", newRaceFriend, actor, raceRecipient).Error)
	assert.Equal(t, 201, reminderRequest(router, "POST", "/api/v1/friendships/"+newRaceFriend+"/split-reminders", `{"description":"closure race"}`, uuid.NewString(), actor).Code)
	// Recreating a pair must not restore access to the old friendship ID.
	require.NoError(t, db.Exec("INSERT INTO friendships(id,profile_id1,profile_id2,type) VALUES(?,?,?,'REAL')", uuid.NewString(), actor, recipient).Error)
	assert.Equal(t, 404, reminderRequest(router, "GET", retrieve, "", "", actor).Code)
}
