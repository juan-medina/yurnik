// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package middleware

import (
	"sync"
	"time"
)

// VelocityLimiter enforces a minimum interval between actions for a given
// key (typically a user ID), with an escalating cooldown for repeat
// offenders. A first too-fast request gets a cooldown of minInterval; each
// further request made before the cooldown expires doubles it, up to
// maxPenalty. Good behaviour (a request that respects the current cooldown)
// gradually forgives prior violations.
//
// All state is kept in memory — this is a single-process server, so no
// shared store is needed. A background goroutine evicts entries for keys
// that have been idle for a while, so the map does not grow without bound.
type VelocityLimiter struct {
	mu          sync.Mutex
	entries     map[string]*velocityEntry
	minInterval time.Duration
	maxPenalty  time.Duration
}

type velocityEntry struct {
	lastRequest  time.Time
	penaltyUntil time.Time
	violations   int
}

// NewVelocityLimiter creates a VelocityLimiter and starts its background
// cleanup goroutine, which runs for the lifetime of the process.
func NewVelocityLimiter(minInterval, maxPenalty time.Duration) *VelocityLimiter {
	v := &VelocityLimiter{
		entries:     make(map[string]*velocityEntry),
		minInterval: minInterval,
		maxPenalty:  maxPenalty,
	}
	go v.cleanupLoop()
	return v
}

// Allow reports whether the action for key may proceed now. If not, it
// returns the duration the caller should wait before retrying.
func (v *VelocityLimiter) Allow(key string) (bool, time.Duration) {
	v.mu.Lock()
	defer v.mu.Unlock()

	now := time.Now()
	e, ok := v.entries[key]
	if !ok {
		e = &velocityEntry{}
		v.entries[key] = e
	}

	if now.Before(e.penaltyUntil) {
		e.violations++
		penalty := v.penaltyFor(e.violations)
		e.penaltyUntil = now.Add(penalty)
		e.lastRequest = now
		return false, penalty
	}

	if !e.lastRequest.IsZero() && now.Sub(e.lastRequest) < v.minInterval {
		e.violations++
		penalty := v.penaltyFor(e.violations)
		e.penaltyUntil = now.Add(penalty)
		e.lastRequest = now
		return false, penalty
	}

	if e.violations > 0 {
		e.violations--
	}
	e.lastRequest = now
	return true, 0
}

// penaltyFor returns minInterval doubled (violations-1) times, capped at
// maxPenalty.
func (v *VelocityLimiter) penaltyFor(violations int) time.Duration {
	const maxShift = 16 // avoids overflow long before maxPenalty is reached
	shift := violations - 1
	if shift < 0 {
		shift = 0
	}
	if shift > maxShift {
		shift = maxShift
	}
	penalty := v.minInterval * time.Duration(int64(1)<<uint(shift))
	if penalty > v.maxPenalty {
		penalty = v.maxPenalty
	}
	return penalty
}

// cleanupLoop periodically evicts entries that have been idle (and are not
// currently under a cooldown) for longer than idleTimeout.
func (v *VelocityLimiter) cleanupLoop() {
	const (
		interval    = 10 * time.Minute
		idleTimeout = time.Hour
	)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		v.mu.Lock()
		for key, e := range v.entries {
			if now.After(e.penaltyUntil) && now.Sub(e.lastRequest) > idleTimeout {
				delete(v.entries, key)
			}
		}
		v.mu.Unlock()
	}
}
