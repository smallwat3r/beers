package api

import (
	"beers/backend/internal/config"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type MockS3Client struct {
	GetObjectFunc func(
		ctx context.Context,
		params *s3.GetObjectInput,
		optFns ...func(*s3.Options),
	) (*s3.GetObjectOutput, error)
}

func (m *MockS3Client) GetObject(
	ctx context.Context,
	params *s3.GetObjectInput,
	optFns ...func(*s3.Options),
) (*s3.GetObjectOutput, error) {
	return m.GetObjectFunc(ctx, params, optFns...)
}

const testManifest = `[
	{
		"key": "2025/11/08/WEBP/image1.webp",
		"id": "123",
		"beer": "Test Beer",
		"brewery": "Brasserie de l'Être",
		"date": "Sat, 08 Nov 2025 12:00:00 +0000"
	},
	{
		"key": "2025/11/07/WEBP/image2.webp",
		"id": "124",
		"beer": "Other Beer",
		"date": "Fri, 07 Nov 2025 12:00:00 +0000"
	}
]`

func manifestClient(t *testing.T, body string) *MockS3Client {
	return &MockS3Client{
		GetObjectFunc: func(
			ctx context.Context,
			params *s3.GetObjectInput,
			optFns ...func(*s3.Options),
		) (*s3.GetObjectOutput, error) {
			if got, want := *params.Key, "index.json"; got != want {
				t.Errorf("Key = %q, want %q", got, want)
			}
			return &s3.GetObjectOutput{Body: io.NopCloser(strings.NewReader(body))}, nil
		},
	}
}

func TestGetImages(t *testing.T) {
	cfg := &config.AppConfig{
		BucketName: "test-bucket",
		PublicURL:  "https://test.com",
	}

	handler := GetImages(manifestClient(t, testManifest), cfg)

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
	if img.URL != "https://test.com/2025/11/08/WEBP/image1.webp" {
		t.Errorf("unexpected image URL: %s", img.URL)
	}
	if img.Metadata.ID != "123" {
		t.Errorf("expected ID 123, got %q", img.Metadata.ID)
	}
	if img.Metadata.Beer != "Test Beer" {
		t.Errorf("expected Beer %q, got %q", "Test Beer", img.Metadata.Beer)
	}
	if img.Metadata.Brewery != "Brasserie de l'Être" {
		t.Errorf("unexpected Brewery: %q", img.Metadata.Brewery)
	}
}

func TestGetImagesCachesManifest(t *testing.T) {
	cfg := &config.AppConfig{BucketName: "b", PublicURL: "https://test.com"}

	calls := 0
	client := &MockS3Client{
		GetObjectFunc: func(
			ctx context.Context,
			params *s3.GetObjectInput,
			optFns ...func(*s3.Options),
		) (*s3.GetObjectOutput, error) {
			calls++
			return &s3.GetObjectOutput{Body: io.NopCloser(strings.NewReader(testManifest))}, nil
		},
	}

	handler := GetImages(client, cfg)
	for i := 0; i < 3; i++ {
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
		if rr.Code != http.StatusOK {
			t.Fatalf("request %d: status = %v", i, rr.Code)
		}
	}

	if calls != 1 {
		t.Errorf("expected 1 manifest fetch across requests, got %d", calls)
	}
}

func TestGetImagesErrorWithoutCache(t *testing.T) {
	cfg := &config.AppConfig{BucketName: "b", PublicURL: "https://test.com"}

	client := &MockS3Client{
		GetObjectFunc: func(
			ctx context.Context,
			params *s3.GetObjectInput,
			optFns ...func(*s3.Options),
		) (*s3.GetObjectOutput, error) {
			return nil, errors.New("boom")
		},
	}

	handler := GetImages(client, cfg)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %v, want %v", rr.Code, http.StatusInternalServerError)
	}
}
