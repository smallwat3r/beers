package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	os.Setenv("BUCKET_NAME", "test-bucket")
	os.Setenv("R2_ACCOUNT_ID", "test-account-id")
	os.Setenv("R2_ACCESS_KEY_ID", "test-access-key-id")
	os.Setenv("R2_SECRET_ACCESS_KEY", "test-secret-access-key")
	os.Setenv("R2_PUBLIC_URL", "https://test.com")

	cfg, err := Load()
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if cfg.BucketName != "test-bucket" {
		t.Errorf("expected BucketName to be 'test-bucket', got %s", cfg.BucketName)
	}
	if cfg.AccountID != "test-account-id" {
		t.Errorf("expected AccountID to be 'test-account-id', got %s", cfg.AccountID)
	}
	if cfg.AccessKeyID != "test-access-key-id" {
		t.Errorf("expected AccessKeyID to be 'test-access-key-id', got %s", cfg.AccessKeyID)
	}
	if cfg.SecretAccessKey != "test-secret-access-key" {
		t.Errorf("expected SecretAccessKey to be 'test-secret-access-key', got %s", cfg.SecretAccessKey)
	}
	if cfg.PublicURL != "https://test.com" {
		t.Errorf("expected PublicURL to be 'https://test.com', got %s", cfg.PublicURL)
	}

	os.Unsetenv("BUCKET_NAME")
	_, err = Load()
	if err == nil {
		t.Errorf("expected an error, but got nil")
	}
}
