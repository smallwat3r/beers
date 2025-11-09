package s3client

import (
	"beers/backend/internal/config"
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Client interface {
	ListObjectsV2(
		ctx context.Context,
		params *s3.ListObjectsV2Input,
		optFns ...func(*s3.Options),
	) (*s3.ListObjectsV2Output, error)

	HeadObject(
		ctx context.Context,
		params *s3.HeadObjectInput,
		optFns ...func(*s3.Options),
	) (*s3.HeadObjectOutput, error)
}

func NewS3Client(ctx context.Context, bucketRegion string) (*s3.Client, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	r2Resolver := aws.EndpointResolverWithOptionsFunc(
		func(service, region string, _ ...interface{}) (aws.Endpoint, error) {
			return aws.Endpoint{
				URL:               fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID),
				HostnameImmutable: true,
				Source:            aws.EndpointSourceCustom,
			}, nil
		},
	)

	awsCfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithEndpointResolverWithOptions(r2Resolver),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		),
		awsconfig.WithRegion(bucketRegion),
	)
	if err != nil {
		return nil, err
	}

	return s3.NewFromConfig(awsCfg), nil
}

func ListObjects(
	ctx context.Context,
	client S3Client,
	bucketName, prefix, continuationToken string,
) (*s3.ListObjectsV2Output, error) {
	input := &s3.ListObjectsV2Input{
		Bucket:  aws.String(bucketName),
		MaxKeys: aws.Int32(1000), // fetch more objects to sort by month
		Prefix:  aws.String(prefix),
	}

	if continuationToken != "" {
		input.ContinuationToken = aws.String(continuationToken)
	}

	return client.ListObjectsV2(ctx, input)
}

func GetObjectMetadata(
	ctx context.Context,
	client S3Client,
	bucketName, objectKey string,
) (*s3.HeadObjectOutput, error) {
	input := &s3.HeadObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
	}

	return client.HeadObject(ctx, input)
}
