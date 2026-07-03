// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package db_test

import (
	"context"
	"testing"

	"github.com/juan-medina/yurnik/internal/db"
)

func TestInclusions(t *testing.T) {
	ctx := context.Background()
	pool := connectTestDB(t)

	// Create test users
	user1 := createTestUserNamed(t, pool, "1")
	user2 := createTestUserNamed(t, pool, "2")

	// Verify initially empty
	inc1, err := db.ListInclusions(ctx, pool, user1)
	if err != nil {
		t.Fatalf("ListInclusions: %v", err)
	}
	if len(inc1) != 0 {
		t.Fatalf("expected 0, got %d", len(inc1))
	}

	// Insert inclusions
	if err := db.InsertInclusion(ctx, pool, user1, "game1.exe"); err != nil {
		t.Fatalf("InsertInclusion: %v", err)
	}
	if err := db.InsertInclusion(ctx, pool, user1, "game2.exe"); err != nil {
		t.Fatalf("InsertInclusion: %v", err)
	}
	// Insert for user 2 to ensure scoping
	if err := db.InsertInclusion(ctx, pool, user2, "game3.exe"); err != nil {
		t.Fatalf("InsertInclusion: %v", err)
	}

	// Test IsIncluded
	isInc, err := db.IsIncluded(ctx, pool, user1, "game1.exe")
	if err != nil || !isInc {
		t.Errorf("IsIncluded(game1.exe) = %v, %v; want true, nil", isInc, err)
	}
	isInc, err = db.IsIncluded(ctx, pool, user1, "game3.exe")
	if err != nil || isInc {
		t.Errorf("IsIncluded(game3.exe) = %v, %v; want false, nil", isInc, err)
	}

	// Test ListInclusions (alphabetical)
	inc1, err = db.ListInclusions(ctx, pool, user1)
	if err != nil {
		t.Fatalf("ListInclusions: %v", err)
	}
	want := []db.Inclusion{{ExeName: "game1.exe"}, {ExeName: "game2.exe"}}
	if len(inc1) != len(want) || inc1[0].ExeName != want[0].ExeName || inc1[1].ExeName != want[1].ExeName {
		t.Errorf("ListInclusions user1 mismatch: want %v, got %v", want, inc1)
	}

	// Test Idempotency
	if err := db.InsertInclusion(ctx, pool, user1, "game1.exe"); err != nil {
		t.Fatalf("InsertInclusion duplicate failed: %v", err)
	}

	// Test Delete
	if err := db.DeleteInclusion(ctx, pool, user1, "game1.exe"); err != nil {
		t.Fatalf("DeleteInclusion: %v", err)
	}
	
	isInc, _ = db.IsIncluded(ctx, pool, user1, "game1.exe")
	if isInc {
		t.Errorf("game1.exe should be deleted")
	}
}
