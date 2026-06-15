// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package main

import "testing"

func TestIsUUID(t *testing.T) {
	cases := []struct {
		input string
		want  bool
	}{
		{"f47ac10b-58cc-4372-a567-0e02b2c3d479", true},
		{"F47AC10B-58CC-4372-A567-0E02B2C3D479", true},
		{"some_handle", false},
		{"f47ac10b-58cc-4372-a567-0e02b2c3d47", false}, // too short
		{"", false},
	}
	for _, c := range cases {
		if got := isUUID(c.input); got != c.want {
			t.Errorf("isUUID(%q) = %v, want %v", c.input, got, c.want)
		}
	}
}
