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
	envs := map[string]*string{
		"BUCKET_NAME":          nil,
		"R2_ACCOUNT_ID":        nil,
		"R2_ACCESS_KEY_ID":     nil,
		"R2_SECRET_ACCESS_KEY": nil,
		"R2_PUBLIC_URL":        nil,
	}

	// populate map and check missing
	for key := range envs {
		val := os.Getenv(key)
		if val == "" {
			return nil, fmt.Errorf("environment variable %s is not set", key)
		}
		envs[key] = &val
	}

	return &AppConfig{
		BucketName:      *envs["BUCKET_NAME"],
		AccountID:       *envs["R2_ACCOUNT_ID"],
		AccessKeyID:     *envs["R2_ACCESS_KEY_ID"],
		SecretAccessKey: *envs["R2_SECRET_ACCESS_KEY"],
		PublicURL:       *envs["R2_PUBLIC_URL"],
	}, nil
}
