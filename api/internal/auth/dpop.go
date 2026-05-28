// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package auth

import (
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
)

// CreateDPoPProof builds a DPoP proof JWT (ES256) as required by AT Proto OAuth.
// nonce is optional; pass "" on the first attempt.
// accessToken is optional; pass "" for OAuth flow requests (PAR, token exchange).
// For resource requests (PDS calls), pass the access token so the ath claim is included.
// https://www.ietf.org/rfc/rfc9449.html
func CreateDPoPProof(priv *ecdsa.PrivateKey, method, endpoint, nonce string) (string, error) {
	return createDPoPProof(priv, method, endpoint, nonce, "")
}

// CreateDPoPProofWithToken builds a DPoP proof JWT that includes the ath claim.
// Required for resource requests (PDS calls) when using DPoP-bound OAuth tokens.
func CreateDPoPProofWithToken(priv *ecdsa.PrivateKey, method, endpoint, nonce, accessToken string) (string, error) {
	return createDPoPProof(priv, method, endpoint, nonce, accessToken)
}

func createDPoPProof(priv *ecdsa.PrivateKey, method, endpoint, nonce, accessToken string) (string, error) {
	pub := &priv.PublicKey

	// JWK for P-256 — coordinates padded to 32 bytes each.
	xBytes := make([]byte, 32)
	yBytes := make([]byte, 32)
	pub.X.FillBytes(xBytes)
	pub.Y.FillBytes(yBytes)

	header := map[string]interface{}{
		"alg": "ES256",
		"typ": "dpop+jwt",
		"jwk": map[string]string{
			"kty": "EC",
			"crv": "P-256",
			"x":   base64.RawURLEncoding.EncodeToString(xBytes),
			"y":   base64.RawURLEncoding.EncodeToString(yBytes),
		},
	}

	jtiRaw := make([]byte, 16)
	if _, err := rand.Read(jtiRaw); err != nil {
		return "", fmt.Errorf("rand: %w", err)
	}

	payload := map[string]interface{}{
		"jti": base64.RawURLEncoding.EncodeToString(jtiRaw),
		"htm": method,
		"htu": endpoint,
		"iat": time.Now().Unix(),
	}
	if nonce != "" {
		payload["nonce"] = nonce
	}
	// ath is required for resource requests — it binds the proof to the access token.
	if accessToken != "" {
		hash := sha256.Sum256([]byte(accessToken))
		payload["ath"] = base64.RawURLEncoding.EncodeToString(hash[:])
	}

	return signES256JWT(header, payload, priv)
}

// signES256JWT constructs and signs a JWT with ES256 (ECDSA P-256 + SHA-256).
// Used for DPoP proofs where the header carries a non-standard "jwk" field.
func signES256JWT(header, payload map[string]interface{}, priv *ecdsa.PrivateKey) (string, error) {
	hBytes, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	pBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	hEnc := base64.RawURLEncoding.EncodeToString(hBytes)
	pEnc := base64.RawURLEncoding.EncodeToString(pBytes)
	input := hEnc + "." + pEnc

	hash := sha256.Sum256([]byte(input))
	r, s, err := ecdsa.Sign(rand.Reader, priv, hash[:])
	if err != nil {
		return "", fmt.Errorf("sign: %w", err)
	}

	// JWS signature format for ES256: R || S, each padded to 32 bytes.
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])

	return input + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}
