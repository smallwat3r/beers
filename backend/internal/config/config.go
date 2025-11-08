package config

import (
	"fmt"
	"os"
)

type AppConfig struct {
	BucketName      string
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	PublicURL       string
}

func Load() (*AppConfig, error) {
	cfg := &AppConfig{
		BucketName:      os.Getenv("BUCKET_NAME"),
		AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		PublicURL:       os.Getenv("R2_PUBLIC_URL"),
	}

	if cfg.BucketName == "" {
		return nil, fmt.Errorf("environment variable BUCKET_NAME is not set")
	}
	if cfg.AccountID == "" {
		return nil, fmt.Errorf("environment variable R2_ACCOUNT_ID is not set")
	}
	if cfg.AccessKeyID == "" {
		return nil, fmt.Errorf("environment variable R2_ACCESS_KEY_ID is not set")
	}
	if cfg.SecretAccessKey == "" {
		return nil, fmt.Errorf("environment variable R2_SECRET_ACCESS_KEY is not set")
	}
	if cfg.PublicURL == "" {
		return nil, fmt.Errorf("environment variable R2_PUBLIC_URL is not set")
	}

	return cfg, nil
}
