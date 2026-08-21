package s3client

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
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
	if m.GetObjectFunc == nil {
		panic("GetObjectFunc not set on MockS3Client")
	}
	return m.GetObjectFunc(ctx, params, optFns...)
}

func TestGetObject(t *testing.T) {
	mockClient := &MockS3Client{
		GetObjectFunc: func(
			ctx context.Context,
			params *s3.GetObjectInput,
			optFns ...func(*s3.Options),
		) (*s3.GetObjectOutput, error) {
			if got, want := aws.ToString(params.Bucket), "test-bucket"; got != want {
				t.Errorf("Bucket = %q, want %q", got, want)
			}
			if got, want := aws.ToString(params.Key), "test-key"; got != want {
				t.Errorf("Key = %q, want %q", got, want)
			}
			return &s3.GetObjectOutput{Body: io.NopCloser(strings.NewReader("data"))}, nil
		},
	}

	body, err := GetObject(context.Background(), mockClient, "test-bucket", "test-key")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer body.Close()

	data, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if string(data) != "data" {
		t.Errorf("body = %q, want %q", data, "data")
	}
}
