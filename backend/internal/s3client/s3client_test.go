package s3client

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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
	if m.ListObjectsV2Func == nil {
		panic("ListObjectsV2Func not set on MockS3Client")
	}
	return m.ListObjectsV2Func(ctx, params, optFns...)
}

func (m *MockS3Client) HeadObject(
	ctx context.Context,
	params *s3.HeadObjectInput,
	optFns ...func(*s3.Options),
) (*s3.HeadObjectOutput, error) {
	if m.HeadObjectFunc == nil {
		panic("HeadObjectFunc not set on MockS3Client")
	}
	return m.HeadObjectFunc(ctx, params, optFns...)
}

func TestListObjects(t *testing.T) {
	mockClient := &MockS3Client{
		ListObjectsV2Func: func(
			ctx context.Context,
			params *s3.ListObjectsV2Input,
			optFns ...func(*s3.Options),
		) (*s3.ListObjectsV2Output, error) {
			if got, want := aws.ToString(params.Bucket), "test-bucket"; got != want {
				t.Errorf("Bucket = %q, want %q", got, want)
			}
			if got, want := aws.ToString(params.Prefix), "test-prefix"; got != want {
				t.Errorf("Prefix = %q, want %q", got, want)
			}
			if got, want := aws.ToInt32(params.MaxKeys), int32(1000); got != want {
				t.Errorf("MaxKeys = %d, want %d", got, want)
			}
			if params.ContinuationToken != nil {
				t.Errorf("ContinuationToken = %q, want nil", aws.ToString(params.ContinuationToken))
			}
			return &s3.ListObjectsV2Output{}, nil
		},
	}

	_, err := ListObjects(
		context.Background(),
		mockClient,
		"test-bucket",
		"test-prefix",
		"",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGetObjectMetadata(t *testing.T) {
	mockClient := &MockS3Client{
		HeadObjectFunc: func(
			ctx context.Context,
			params *s3.HeadObjectInput,
			optFns ...func(*s3.Options),
		) (*s3.HeadObjectOutput, error) {
			if got, want := aws.ToString(params.Bucket), "test-bucket"; got != want {
				t.Errorf("Bucket = %q, want %q", got, want)
			}
			if got, want := aws.ToString(params.Key), "test-key"; got != want {
				t.Errorf("Key = %q, want %q", got, want)
			}
			return &s3.HeadObjectOutput{}, nil
		},
	}

	_, err := GetObjectMetadata(
		context.Background(),
		mockClient,
		"test-bucket",
		"test-key",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
