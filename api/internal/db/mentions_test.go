// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import "testing"

func TestParseMentions(t *testing.T) {
	tests := []struct {
		name string
		text string
		max  int
		want []MentionToken
	}{
		{
			name: "no mentions",
			text: "great game, loved it",
			max:  10,
			want: nil,
		},
		{
			name: "single mention",
			text: "hey @jdoe check this out",
			max:  10,
			want: []MentionToken{{Handle: "jdoe", StartOffset: 4, Length: 5}},
		},
		{
			name: "multiple mentions",
			text: "@bob and @alice should play this",
			max:  10,
			want: []MentionToken{
				{Handle: "bob", StartOffset: 0, Length: 4},
				{Handle: "alice", StartOffset: 9, Length: 6},
			},
		},
		{
			name: "offset accounts for multi-byte runes before the mention",
			text: "café @jdoe",
			max:  10,
			want: []MentionToken{{Handle: "jdoe", StartOffset: 5, Length: 5}},
		},
		{
			name: "cap truncates extra mentions",
			text: "@a @b @c",
			max:  2,
			want: []MentionToken{
				{Handle: "a", StartOffset: 0, Length: 2},
				{Handle: "b", StartOffset: 3, Length: 2},
			},
		},
		{
			name: "duplicate handle keeps both occurrences",
			text: "@bob and also @bob",
			max:  10,
			want: []MentionToken{
				{Handle: "bob", StartOffset: 0, Length: 4},
				{Handle: "bob", StartOffset: 14, Length: 4},
			},
		},
		{
			name: "bare @ with no handle is not a mention",
			text: "email me @ noon",
			max:  10,
			want: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseMentions(tt.text, tt.max)
			if len(got) != len(tt.want) {
				t.Fatalf("ParseMentions(%q) = %v, want %v", tt.text, got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("token %d: got %+v, want %+v", i, got[i], tt.want[i])
				}
			}
		})
	}
}
