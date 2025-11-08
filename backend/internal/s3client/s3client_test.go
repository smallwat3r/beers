package s3client

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type MockS3Client struct {
	ListObjectsV2Func func(
		ctx context.Context,
		params *s3.ListObjectsV2Input,
		optFns ...func(*s3.Options),
	) (*s3.ListObjectsV2Output, error)
	HeadObjectFunc    func(
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

func TestListObjects(t *testing.T) {
	mockClient := &MockS3Client{}
	mockClient.ListObjectsV2Func = func(
		ctx context.Context,
		params *s3.ListObjectsV2Input,
		optFns ...func(*s3.Options),
	) (*s3.ListObjectsV2Output, error) {
		if *params.Bucket != "test-bucket" {
			t.Errorf("expected bucket to be 'test-bucket', got %s", *params.Bucket)
		}
		if *params.Prefix != "test-prefix" {
			t.Errorf("expected prefix to be 'test-prefix', got %s", *params.Prefix)
		}
		return &s3.ListObjectsV2Output{}, nil
	}

	_, err := ListObjects(
		context.Background(),
		mockClient,
		"test-bucket",
		"test-prefix",
		"",
	)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestGetObjectMetadata(t *testing.T) {
	mockClient := &MockS3Client{}
	mockClient.HeadObjectFunc = func(
		ctx context.Context,
		params *s3.HeadObjectInput,
		optFns ...func(*s3.Options),
	) (*s3.HeadObjectOutput, error) {
		if *params.Bucket != "test-bucket" {
			t.Errorf("expected bucket to be 'test-bucket', got %s", *params.Bucket)
		}
		if *params.Key != "test-key" {
			t.Errorf("expected key to be 'test-key', got %s", *params.Key)
		}
		return &s3.HeadObjectOutput{}, nil
	}

	_, err := GetObjectMetadata(
		context.Background(),
		mockClient,
		"test-bucket",
		"test-key",
	)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}
