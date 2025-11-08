package api

import (
	"beers/backend/internal/config"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type MockS3Client struct {
	ListObjectsV2Func func(
		ctx context.Context,
		params *s3.ListObjectsV2Input,
		optFns ...func(*s3.Options),
	) (*s3.ListObjectsV2Output, error)
	HeadObjectFunc func(
		ctx context.Context,
		params *s3.HeadObjectInput,
		optFns ...func(*s3.Options),
	) (*s3.HeadObjectOutput, error)
}

func (m *MockS3Client) ListObjectsV2(
	ctx context.Context,
	params *s3.ListObjectsV2Input,
	optFns ...func(*s3.Options),
) (*s3.ListObjectsV2Output, error) {
	return m.ListObjectsV2Func(ctx, params, optFns...)
}

func (m *MockS3Client) HeadObject(
	ctx context.Context,
	params *s3.HeadObjectInput,
	optFns ...func(*s3.Options),
) (*s3.HeadObjectOutput, error) {
	return m.HeadObjectFunc(ctx, params, optFns...)
}

func TestGetImages(t *testing.T) {
	cfg := &config.AppConfig{
		BucketName: "test-bucket",
		PublicURL:  "https://test.com",
	}

	mockClient := &MockS3Client{
		ListObjectsV2Func: func(
			ctx context.Context,
			params *s3.ListObjectsV2Input,
			optFns ...func(*s3.Options),
		) (*s3.ListObjectsV2Output, error) {
			return &s3.ListObjectsV2Output{
				Contents: []types.Object{
					{Key: aws.String("2025/11/image1.jpg")},
					{Key: aws.String("2025/11/image2.jpg")},
				},
			}, nil
		},
		HeadObjectFunc: func(
			ctx context.Context,
			params *s3.HeadObjectInput,
			optFns ...func(*s3.Options),
		) (*s3.HeadObjectOutput, error) {
			return &s3.HeadObjectOutput{
				Metadata: map[string]string{
					"id":   "123",
					"beer": "Test Beer",
					"date": "2025-11-08 12:00:00",
				},
			}, nil
		},
	}

	handler := GetImages(mockClient, cfg)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("status = %v, want %v", status, http.StatusOK)
	}

	var resp ImageResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}

	if got := len(resp.Images); got != 2 {
		t.Fatalf("expected 2 images, got %d", got)
	}

	img := resp.Images[0]
	if img.URL != "https://test.com/2025/11/image1.jpg" {
		t.Errorf("unexpected image URL: %s", img.URL)
	}
	if img.Metadata.ID != "123" {
		t.Errorf("expected ID 123, got %q", img.Metadata.ID)
	}
	if img.Metadata.Beer != "Test Beer" {
		t.Errorf("expected Beer %q, got %q", "Test Beer", img.Metadata.Beer)
	}
}

func TestDecodeRFC2047Maybe(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "no encoding",
			input:    "Hello World",
			expected: "Hello World",
		},
		{
			name:     "rfc2047 encoding",
			input:    "=?UTF-8?Q?Hello_=E2=82=AC_World?=",
			expected: "Hello € World",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := decodeRFC2047Maybe(tt.input); got != tt.expected {
				t.Errorf(
					"decodeRFC2047Maybe() = %v, want %v",
					got,
					tt.expected,
				)
			}
		})
	}
}

func TestParseMonthFromLastKey(t *testing.T) {
	tests := []struct {
		name      string
		lastKey   string
		expected  time.Time
		expectErr bool
	}{
		{
			name:      "valid lastKey",
			lastKey:   "2025/11/image.jpg",
			expected:  time.Date(2025, time.November, 1, 0, 0, 0, 0, time.UTC),
			expectErr: false,
		},
		{
			name:      "invalid lastKey",
			lastKey:   "2025-11-image.jpg",
			expectErr: true,
		},
		{
			name:      "empty lastKey",
			lastKey:   "",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseMonthFromLastKey(tt.lastKey)
			if (err != nil) != tt.expectErr {
				t.Fatalf("parseMonthFromLastKey() error = %v, expectErr %v", err, tt.expectErr)
			}
			if !tt.expectErr && !got.Equal(tt.expected) {
				t.Errorf("parseMonthFromLastKey() = %v, want %v", got, tt.expected)
			}
		})
	}
}
