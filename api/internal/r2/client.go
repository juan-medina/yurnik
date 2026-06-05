// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package r2

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const avatarPrefix = "avatars/"

// AllowedContentTypes lists the MIME types accepted for avatar uploads.
var AllowedContentTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

// MaxAvatarBytes is the maximum accepted avatar file size.
const MaxAvatarBytes = 2 * 1024 * 1024 // 2 MB

// Client wraps an R2 bucket for direct object uploads.
type Client struct {
	s3        *s3.Client
	bucket    string
	publicURL string // e.g. https://assets.yurnik.social
}

// Config holds the R2 credentials and bucket info read from env vars.
type Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	PublicURL       string
}

// NewClient creates an R2 client from the given config.
func NewClient(cfg Config) *Client {
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)

	s3Client := s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       "auto",
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
	})

	return &Client{
		s3:        s3Client,
		bucket:    cfg.Bucket,
		publicURL: cfg.PublicURL,
	}
}

// UploadAvatar writes the avatar body directly to R2 and returns the public URL.
// The key is deterministic (avatars/<userID>) so each upload overwrites the previous.
// contentType must be one of AllowedContentTypes — callers must validate before calling.
func (c *Client) UploadAvatar(ctx context.Context, userID, contentType string, body io.Reader, size int64) (string, error) {
	key := avatarPrefix + userID

	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
		Body:          body,
	})
	if err != nil {
		return "", fmt.Errorf("upload avatar: %w", err)
	}

	// Append a timestamp so the stored URL is unique per upload. The browser
	// and CDN treat ?v=<ts> as a distinct URL, busting any cached copy of the
	// previous avatar without any client-side state.
	return fmt.Sprintf("%s/%s?v=%d", c.publicURL, key, time.Now().Unix()), nil
}
