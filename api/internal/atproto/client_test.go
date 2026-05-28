// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package atproto

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newTestClient returns a Client wired to a test server — no DPoP key so tests
// use plain Bearer auth, matching what app passwords return.
func newTestClient(t *testing.T, handler http.Handler) *Client {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return New(srv.URL, srv.Client(), nil)
}

// --- CreateRecord ---

func TestCreateRecord_success(t *testing.T) {
	srv := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/xrpc/com.atproto.repo.createRecord" {
			t.Errorf("path = %s, want /xrpc/com.atproto.repo.createRecord", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Errorf("Authorization = %q, want Bearer tok", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"uri": "at://did:plc:abc/app.agon.journey/xyz",
			"cid": "bafyreiabc123",
		})
	}))

	result, err := srv.CreateRecord(context.Background(), "tok", Record{
		Collection: "app.agon.journey",
		Repo:       "did:plc:abc",
		Record:     map[string]string{"$type": "app.agon.journey"},
	})
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}
	if result.URI != "at://did:plc:abc/app.agon.journey/xyz" {
		t.Errorf("URI = %q, want at://did:plc:abc/app.agon.journey/xyz", result.URI)
	}
	if result.CID != "bafyreiabc123" {
		t.Errorf("CID = %q, want bafyreiabc123", result.CID)
	}
}

func TestCreateRecord_serverError(t *testing.T) {
	srv := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}))

	_, err := srv.CreateRecord(context.Background(), "tok", Record{
		Collection: "app.agon.journey",
		Repo:       "did:plc:abc",
		Record:     map[string]string{},
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// TestCreateRecord_dpopNonceRetry verifies that the client retries with a
// DPoP nonce when the server responds with use_dpop_nonce.
func TestCreateRecord_dpopNonceRetry(t *testing.T) {
	attempts := 0
	srv := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts == 1 {
			// First attempt: demand a nonce.
			w.Header().Set("DPoP-Nonce", "test-nonce-123")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "use_dpop_nonce"})
			return
		}
		// Second attempt: succeed.
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"uri": "at://did:plc:abc/app.agon.journey/xyz",
			"cid": "bafyreiabc123",
		})
	}))

	result, err := srv.CreateRecord(context.Background(), "tok", Record{
		Collection: "app.agon.journey",
		Repo:       "did:plc:abc",
		Record:     map[string]string{},
	})
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}
	if attempts != 2 {
		t.Errorf("attempts = %d, want 2", attempts)
	}
	if !strings.HasPrefix(result.URI, "at://") {
		t.Errorf("URI = %q, want at:// prefix", result.URI)
	}
}

// --- DeleteRecord ---

func TestDeleteRecord_success(t *testing.T) {
	srv := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/xrpc/com.atproto.repo.deleteRecord" {
			t.Errorf("path = %s, want /xrpc/com.atproto.repo.deleteRecord", r.URL.Path)
		}
		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if payload["repo"] != "did:plc:abc" {
			t.Errorf("repo = %q, want did:plc:abc", payload["repo"])
		}
		if payload["collection"] != "app.agon.journey" {
			t.Errorf("collection = %q, want app.agon.journey", payload["collection"])
		}
		if payload["rkey"] != "xyz" {
			t.Errorf("rkey = %q, want xyz", payload["rkey"])
		}
		w.WriteHeader(http.StatusOK)
	}))

	err := srv.DeleteRecord(context.Background(), "tok", "at://did:plc:abc/app.agon.journey/xyz")
	if err != nil {
		t.Fatalf("DeleteRecord: %v", err)
	}
}

func TestDeleteRecord_invalidURI(t *testing.T) {
	c := New("http://unused", nil, nil)
	err := c.DeleteRecord(context.Background(), "tok", "not-an-at-uri")
	if err == nil {
		t.Fatal("expected error for invalid URI, got nil")
	}
}

func TestDeleteRecord_serverError(t *testing.T) {
	srv := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))

	err := srv.DeleteRecord(context.Background(), "tok", "at://did:plc:abc/app.agon.journey/xyz")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- GetRecord ---

func TestGetRecord_success(t *testing.T) {
	srv := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/xrpc/com.atproto.repo.getRecord" {
			t.Errorf("path = %s, want /xrpc/com.atproto.repo.getRecord", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("repo") != "did:plc:abc" {
			t.Errorf("repo = %q, want did:plc:abc", q.Get("repo"))
		}
		if q.Get("collection") != "app.agon.journey" {
			t.Errorf("collection = %q, want app.agon.journey", q.Get("collection"))
		}
		if q.Get("rkey") != "xyz" {
			t.Errorf("rkey = %q, want xyz", q.Get("rkey"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"gameTitle": "Elden Ring"})
	}))

	var out map[string]string
	err := srv.GetRecord(context.Background(), "at://did:plc:abc/app.agon.journey/xyz", &out)
	if err != nil {
		t.Fatalf("GetRecord: %v", err)
	}
	if out["gameTitle"] != "Elden Ring" {
		t.Errorf("gameTitle = %q, want Elden Ring", out["gameTitle"])
	}
}

func TestGetRecord_serverError(t *testing.T) {
	srv := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))

	var out map[string]string
	err := srv.GetRecord(context.Background(), "at://did:plc:abc/app.agon.journey/xyz", &out)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- parseATURI ---

func TestParseATURI(t *testing.T) {
	cases := []struct {
		uri        string
		repo       string
		collection string
		rkey       string
		wantErr    bool
	}{
		{
			uri:        "at://did:plc:abc/app.agon.journey/xyz",
			repo:       "did:plc:abc",
			collection: "app.agon.journey",
			rkey:       "xyz",
		},
		{
			uri:        "at://did:plc:abc123/app.agon.player/3jzfszdy",
			repo:       "did:plc:abc123",
			collection: "app.agon.player",
			rkey:       "3jzfszdy",
		},
		{uri: "not-at-uri", wantErr: true},
		{uri: "at://did:plc:abc", wantErr: true},
		{uri: "at://did:plc:abc/app.agon.journey", wantErr: true},
		{uri: "at://did:plc:abc/app.agon.journey/", wantErr: true},
	}

	for _, tc := range cases {
		repo, collection, rkey, err := parseATURI(tc.uri)
		if tc.wantErr {
			if err == nil {
				t.Errorf("parseATURI(%q): expected error, got nil", tc.uri)
			}
			continue
		}
		if err != nil {
			t.Errorf("parseATURI(%q): unexpected error: %v", tc.uri, err)
			continue
		}
		if repo != tc.repo {
			t.Errorf("parseATURI(%q): repo = %q, want %q", tc.uri, repo, tc.repo)
		}
		if collection != tc.collection {
			t.Errorf("parseATURI(%q): collection = %q, want %q", tc.uri, collection, tc.collection)
		}
		if rkey != tc.rkey {
			t.Errorf("parseATURI(%q): rkey = %q, want %q", tc.uri, rkey, tc.rkey)
		}
	}
}
