package api

import (
	"beers/backend/internal/config"
	"beers/backend/internal/s3client"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mime"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type CheckinMetadata struct {
	ID             string `json:"id"`
	Beer           string `json:"beer"`
	Brewery        string `json:"brewery"`
	BreweryCountry string `json:"brewery_country"`
	Comment        string `json:"comment"`
	Rating         string `json:"rating"`
	Venue          string `json:"venue"`
	City           string `json:"city"`
	State          string `json:"state"`
	Country        string `json:"country"`
	LatLng         string `json:"latlng"`
	Date           string `json:"date"`
	Style          string `json:"style"`
	ABV            string `json:"abv"`
}

type Image struct {
	URL      string          `json:"url"`
	Key      string          `json:"key"`
	Metadata CheckinMetadata `json:"metadata"`
}

type ImageResponse struct {
	Images  []Image `json:"images"`
	HasMore bool    `json:"has_more"`
}

var rfc2047Decoder = new(mime.WordDecoder)

func decodeRFC2047Maybe(s string) string {
	if s == "" || !strings.Contains(s, "=?") {
		return s
	}
	decoded, err := rfc2047Decoder.DecodeHeader(s)
	if err != nil {
		log.Printf("rfc2047 decode error for %q: %v", s, err)
		return s
	}
	return decoded
}

func parseMonthFromLastKey(lastKey string) (time.Time, error) {
	// expected format: YYYY/MM/...
	parts := strings.Split(lastKey, "/")
	if len(parts) < 2 {
		return time.Time{}, errors.New("invalid lastKey format")
	}
	return time.Parse("2006/01", parts[0]+"/"+parts[1])
}

func monthPrefix(t time.Time) string { return t.Format("2006/01/") }

// listMonthObjects drains every page for the given prefix so months with more
// than one page (1000 objects) are fully returned instead of silently truncated.
func listMonthObjects(
	ctx context.Context,
	client s3client.S3Client,
	bucket, prefix string,
) ([]types.Object, error) {
	var objects []types.Object
	token := ""
	for {
		out, err := s3client.ListObjects(ctx, client, bucket, prefix, token)
		if err != nil {
			return nil, err
		}
		objects = append(objects, out.Contents...)
		if out.IsTruncated == nil || !*out.IsTruncated || out.NextContinuationToken == nil {
			break
		}
		token = *out.NextContinuationToken
	}
	return objects, nil
}

func findFirstNonEmptyMonth(
	ctx context.Context,
	client s3client.S3Client,
	bucket string,
	start time.Time,
	maxBack int,
) ([]types.Object, time.Time, error) {
	cur := start
	for i := 0; i < maxBack; i++ {
		prefix := monthPrefix(cur)
		objects, err := listMonthObjects(ctx, client, bucket, prefix)
		if err != nil {
			return nil, time.Time{}, fmt.Errorf("list %s: %w", prefix, err)
		}
		if len(objects) > 0 {
			return objects, cur, nil
		}
		cur = cur.AddDate(0, -1, 0)
	}
	return nil, time.Time{}, nil
}

// hasOlderMonth reports whether any month within maxBack months before start
// contains at least one object. It uses a cheap existence check per month so it
// mirrors the load lookback window without draining full pages.
func hasOlderMonth(
	ctx context.Context,
	client s3client.S3Client,
	bucket string,
	start time.Time,
	maxBack int,
) (bool, error) {
	cur := start
	for i := 0; i < maxBack; i++ {
		exists, err := s3client.ObjectExistsWithPrefix(ctx, client, bucket, monthPrefix(cur))
		if err != nil {
			return false, err
		}
		if exists {
			return true, nil
		}
		cur = cur.AddDate(0, -1, 0)
	}
	return false, nil
}

func newCheckinMetadata(m map[string]string) CheckinMetadata {
	if m == nil {
		m = map[string]string{}
	}
	return CheckinMetadata{
		ID:             m["id"],
		Beer:           decodeRFC2047Maybe(m["beer"]),
		Brewery:        decodeRFC2047Maybe(m["brewery"]),
		BreweryCountry: decodeRFC2047Maybe(m["brewery_country"]),
		Comment:        decodeRFC2047Maybe(m["comment"]),
		Rating:         m["rating"],
		Venue:          decodeRFC2047Maybe(m["venue"]),
		City:           decodeRFC2047Maybe(m["city"]),
		State:          decodeRFC2047Maybe(m["state"]),
		Country:        decodeRFC2047Maybe(m["country"]),
		LatLng:         m["latlng"],
		Date:           m["date"],
		Style:          decodeRFC2047Maybe(m["style"]),
		ABV:            m["abv"],
	}
}

func GetImages(client s3client.S3Client, cfg *config.AppConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		lastKey := r.URL.Query().Get("lastKey")

		var startFrom time.Time
		if lastKey == "" {
			startFrom = time.Now()
		} else {
			t, err := parseMonthFromLastKey(lastKey)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": "Invalid lastKey format"})
				return
			}
			// start from the previous month so we don't repeat the current one
			startFrom = t.AddDate(0, -1, 0)
		}

		// find most recent month with content
		objects, monthFound, err := findFirstNonEmptyMonth(
			ctx,
			client,
			cfg.BucketName,
			startFrom,
			12, // check up to 12 months back
		)
		if err != nil {
			log.Printf("find month error: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Error listing objects"})
			return
		}
		if len(objects) == 0 {
			// no images at all in the backward window
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(ImageResponse{Images: []Image{}, HasMore: false})
			return
		}

		// collect keys to process
		keys := make([]types.Object, 0, len(objects))
		for _, obj := range objects {
			// ensure to only include images in webp format
			if obj.Key == nil || !strings.Contains(*obj.Key, "/WEBP/") {
				continue
			}
			keys = append(keys, obj)
		}

		// worker pool to limit concurrent HeadObject calls
		const workers = 4
		type item struct {
			img Image
			ok  bool
		}
		results := make(chan item, len(keys))
		wg := sync.WaitGroup{}
		jobs := make(chan types.Object)

		worker := func() {
			defer wg.Done()

			for obj := range jobs {
				key := *obj.Key

				meta, err := s3client.GetObjectMetadata(
					ctx,
					client,
					cfg.BucketName,
					key,
				)
				if err != nil {
					log.Printf("error getting metadata %s: %v", key, err)
					results <- item{ok: false}
					continue
				}

				md := newCheckinMetadata(meta.Metadata)

				imageURL, err := url.JoinPath(cfg.PublicURL, key)
				if err != nil {
					log.Printf("failed to join URL %q and %q: %v", cfg.PublicURL, key, err)
					results <- item{ok: false}
					continue
				}

				results <- item{
					img: Image{
						URL:      imageURL,
						Key:      key,
						Metadata: md,
					},
					ok: true,
				}
			}
		}

		wg.Add(workers)
		for i := 0; i < workers; i++ {
			go worker()
		}
		for _, obj := range keys {
			jobs <- obj
		}
		close(jobs)
		wg.Wait()
		close(results)

		images := make([]Image, 0, len(keys))
		for res := range results {
			if res.ok {
				images = append(images, res.img)
			}
		}

		// sorting
		dateLayout := "2006-01-02 15:04:05"
		sort.SliceStable(images, func(i, j int) bool {
			ti, errI := time.Parse(dateLayout, images[i].Metadata.Date)
			tj, errJ := time.Parse(dateLayout, images[j].Metadata.Date)

			if errI != nil || errJ != nil {
				// fallback to key sort
				return images[i].Key > images[j].Key
			}

			return ti.After(tj)
		})

		// probe earlier months using the same window as the load so a gap of
		// empty months does not stop pagination prematurely
		prevMonth := monthFound.AddDate(0, -1, 0)
		hasMore, err := hasOlderMonth(ctx, client, cfg.BucketName, prevMonth, 12)
		if err != nil {
			log.Printf("has_more probe error: %v", err)
			hasMore = false
		}

		resp := ImageResponse{
			Images:  images,
			HasMore: hasMore,
		}

		w.Header().Set("Content-Type", "application/json; charset=UTF-8")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("JSON encode error: %v", err)
		}
	}
}
