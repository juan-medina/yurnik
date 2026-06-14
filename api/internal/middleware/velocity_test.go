// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package middleware_test

import (
	"testing"
	"time"

	"github.com/juan-medina/yurnik/internal/middleware"
)

func TestVelocityLimiter_AllowsFirstRequest(t *testing.T) {
	v := middleware.NewVelocityLimiter(20*time.Second, 5*time.Minute)

	if ok, _ := v.Allow("user-1"); !ok {
		t.Fatal("expected first request to be allowed")
	}
}

func TestVelocityLimiter_RejectsSecondRequestTooSoon(t *testing.T) {
	v := middleware.NewVelocityLimiter(20*time.Second, 5*time.Minute)

	v.Allow("user-1")
	ok, retryAfter := v.Allow("user-1")
	if ok {
		t.Fatal("expected immediate second request to be rejected")
	}
	if retryAfter <= 0 {
		t.Fatalf("expected positive retryAfter, got %v", retryAfter)
	}
}

func TestVelocityLimiter_EscalatesOnRepeatedViolations(t *testing.T) {
	v := middleware.NewVelocityLimiter(20*time.Second, 5*time.Minute)

	v.Allow("user-1")
	_, first := v.Allow("user-1")
	_, second := v.Allow("user-1")

	if second <= first {
		t.Errorf("expected escalating penalty, got first=%v second=%v", first, second)
	}
}

func TestVelocityLimiter_PenaltyCappedAtMax(t *testing.T) {
	v := middleware.NewVelocityLimiter(20*time.Second, 1*time.Minute)

	v.Allow("user-1")
	var last time.Duration
	for i := 0; i < 10; i++ {
		_, last = v.Allow("user-1")
	}
	if last > 1*time.Minute {
		t.Errorf("expected penalty capped at 1m, got %v", last)
	}
}

func TestVelocityLimiter_IndependentKeys(t *testing.T) {
	v := middleware.NewVelocityLimiter(20*time.Second, 5*time.Minute)

	v.Allow("user-1")
	v.Allow("user-1") // user-1 now in cooldown

	if ok, _ := v.Allow("user-2"); !ok {
		t.Fatal("expected a different key to be unaffected by user-1's cooldown")
	}
}
