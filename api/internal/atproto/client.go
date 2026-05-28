// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Package atproto provides a thin client for writing and deleting records on a
// Bluesky PDS. It covers only the operations Agōn needs — CreateRecord,
// DeleteRecord, and GetRecord — and nothing else.
package atproto

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/juan-medina/agon/internal/auth"
)

const defaultPDS = "https://bsky.social"

// Client writes and deletes AT Proto records on a PDS on behalf of a user.
// The accessToken must already be a valid Bluesky OAuth access token for the
// given DID. Token refresh is the caller's responsibility.
// dpopPriv is the ECDSA P-256 key used to sign DPoP proofs — required for
// OAuth tokens issued with dpop_bound_access_tokens: true.
type Client struct {
	pds        string
	httpClient *http.Client
	dpopPriv   *ecdsa.PrivateKey
}

// New returns a Client targeting the given PDS URL.
// Pass an empty string to use the default (https://bsky.social).
// dpopPriv is the same key loaded from keys/dpop.pem at startup.
func New(pds string, httpClient *http.Client, dpopPriv *ecdsa.PrivateKey) *Client {
	if pds == "" {
		pds = defaultPDS
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{pds: pds, httpClient: httpClient, dpopPriv: dpopPriv}
}

// withPDS returns a copy of the client targeting a different PDS URL.
func (c *Client) withPDS(pds string) *Client {
	return &Client{pds: pds, httpClient: c.httpClient, dpopPriv: c.dpopPriv}
}

// ResolvePDS resolves the user's actual PDS URL from their DID document via
// the PLC directory. OAuth tokens are scoped to the user's PDS, not to the
// authorization server (entryway), so record writes must go to the PDS.
func ResolvePDS(ctx context.Context, did string) (string, error) {
	url := "https://plc.directory/" + did
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("atproto: resolve PDS build request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("atproto: resolve PDS request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("atproto: resolve PDS %d: %s", resp.StatusCode, b)
	}

	var doc struct {
		Service []struct {
			ID              string `json:"id"`
			Type            string `json:"type"`
			ServiceEndpoint string `json:"serviceEndpoint"`
		} `json:"service"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return "", fmt.Errorf("atproto: resolve PDS decode: %w", err)
	}

	for _, svc := range doc.Service {
		if svc.Type == "AtprotoPersonalDataServer" || strings.HasSuffix(svc.ID, "#atproto_pds") {
			if svc.ServiceEndpoint != "" {
				return strings.TrimRight(svc.ServiceEndpoint, "/"), nil
			}
		}
	}
	return "", fmt.Errorf("atproto: no PDS service found in DID document for %s", did)
}

// Record is the payload passed to CreateRecord.
type Record struct {
	// Collection is the NSID of the lexicon, e.g. "app.agon.journey".
	Collection string `json:"collection"`
	// Repo is the DID of the user whose repo the record is written into.
	Repo string `json:"repo"`
	// Record is the record body — any JSON-serialisable value.
	Record any `json:"record"`
}

// CreateResult is returned by CreateRecord on success.
type CreateResult struct {
	// URI is the at:// URI of the newly created record.
	URI string `json:"uri"`
	// CID is the content-addressed identifier of the record.
	CID string `json:"cid"`
}

// doRequest executes an HTTP request with DPoP auth, retrying once if the
// server responds with a use_dpop_nonce error demanding a fresh nonce.
func (c *Client) doRequest(ctx context.Context, method, endpoint, accessToken string, body []byte) (*http.Response, error) {
	return c.doRequestWithNonce(ctx, method, endpoint, accessToken, body, "")
}

func (c *Client) doRequestWithNonce(ctx context.Context, method, endpoint, accessToken string, body []byte, nonce string) (*http.Response, error) {
	var dpopProof string
	if c.dpopPriv != nil {
		var err error
		dpopProof, err = auth.CreateDPoPProofWithToken(c.dpopPriv, method, endpoint, nonce, accessToken)
		if err != nil {
			return nil, fmt.Errorf("atproto: dpop proof: %w", err)
		}
	}

	var bodyReader *bytes.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("atproto: build request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	if dpopProof != "" {
		req.Header.Set("Authorization", "DPoP "+accessToken)
		req.Header.Set("DPoP", dpopProof)
	} else {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}

	// If the server demands a DPoP nonce, retry once with it.
	if resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnauthorized {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var errResp struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(respBody, &errResp)

		if errResp.Error == "use_dpop_nonce" && nonce == "" {
			newNonce := resp.Header.Get("DPoP-Nonce")
			if newNonce != "" {
				return c.doRequestWithNonce(ctx, method, endpoint, accessToken, body, newNonce)
			}
		}

		// Not a nonce issue — return a response with the body restored.
		resp.Body = io.NopCloser(bytes.NewReader(respBody))
		resp.ContentLength = int64(len(respBody))
		return resp, nil
	}

	return resp, nil
}

// CreateRecord writes a record to the PDS and returns its AT URI and CID.
func (c *Client) CreateRecord(ctx context.Context, accessToken string, rec Record) (CreateResult, error) {
	body, err := json.Marshal(rec)
	if err != nil {
		return CreateResult{}, fmt.Errorf("atproto: marshal record: %w", err)
	}

	endpoint := c.pds + "/xrpc/com.atproto.repo.createRecord"
	resp, err := c.doRequest(ctx, http.MethodPost, endpoint, accessToken, body)
	if err != nil {
		return CreateResult{}, fmt.Errorf("atproto: create record: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return CreateResult{}, fmt.Errorf("atproto: create record %d: %s", resp.StatusCode, b)
	}

	var result CreateResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return CreateResult{}, fmt.Errorf("atproto: decode create response: %w", err)
	}
	return result, nil
}

// DeleteRecord removes a record from the PDS by its AT URI.
// uri must be a fully-qualified at:// URI, e.g. at://did:plc:abc/app.agon.journey/xyz.
func (c *Client) DeleteRecord(ctx context.Context, accessToken, uri string) error {
	repo, collection, rkey, err := parseATURI(uri)
	if err != nil {
		return fmt.Errorf("atproto: delete record: %w", err)
	}

	payload := map[string]string{
		"repo":       repo,
		"collection": collection,
		"rkey":       rkey,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("atproto: marshal delete payload: %w", err)
	}

	endpoint := c.pds + "/xrpc/com.atproto.repo.deleteRecord"
	resp, err := c.doRequest(ctx, http.MethodPost, endpoint, accessToken, body)
	if err != nil {
		return fmt.Errorf("atproto: delete record: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("atproto: delete record %d: %s", resp.StatusCode, b)
	}
	return nil
}

// GetRecord fetches a record from the PDS by its AT URI and decodes it into out.
// uri must be a fully-qualified at:// URI.
func (c *Client) GetRecord(ctx context.Context, uri string, out any) error {
	repo, collection, rkey, err := parseATURI(uri)
	if err != nil {
		return fmt.Errorf("atproto: get record: %w", err)
	}

	endpoint := c.pds + "/xrpc/com.atproto.repo.getRecord"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("atproto: build get request: %w", err)
	}
	q := req.URL.Query()
	q.Set("repo", repo)
	q.Set("collection", collection)
	q.Set("rkey", rkey)
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("atproto: get record: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("atproto: get record %d: %s", resp.StatusCode, b)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("atproto: decode get response: %w", err)
	}
	return nil
}

// parseATURI splits an at:// URI into repo, collection, and rkey.
// Expected form: at://<repo>/<collection>/<rkey>
func parseATURI(uri string) (repo, collection, rkey string, err error) {
	const prefix = "at://"
	if len(uri) <= len(prefix) || uri[:len(prefix)] != prefix {
		return "", "", "", fmt.Errorf("invalid AT URI: %q", uri)
	}
	rest := uri[len(prefix):]
	slash1 := indexOf(rest, '/')
	if slash1 < 0 {
		return "", "", "", fmt.Errorf("invalid AT URI (no collection): %q", uri)
	}
	repo = rest[:slash1]
	rest = rest[slash1+1:]
	slash2 := indexOf(rest, '/')
	if slash2 < 0 {
		return "", "", "", fmt.Errorf("invalid AT URI (no rkey): %q", uri)
	}
	collection = rest[:slash2]
	rkey = rest[slash2+1:]
	if rkey == "" {
		return "", "", "", fmt.Errorf("invalid AT URI (empty rkey): %q", uri)
	}
	return repo, collection, rkey, nil
}

func indexOf(s string, b byte) int {
	for i := range s {
		if s[i] == b {
			return i
		}
	}
	return -1
}
