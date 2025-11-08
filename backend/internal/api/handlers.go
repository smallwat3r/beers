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
	"path"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
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
	LatLng         string `json:"lat_lng"`
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

// findFirstNonEmptyMonth searches backward up to maxBack months starting at start
func findFirstNonEmptyMonth(ctx context.Context, client s3client.S3Client, bucket string, start time.Time, maxBack int) (*s3.ListObjectsV2Output, time.Time, error) {
	cur := start
	for i := 0; i < maxBack; i++ {
		prefix := monthPrefix(cur)
		out, err := s3client.ListObjects(ctx, client, bucket, prefix, "")
		if err != nil {
			return nil, time.Time{}, fmt.Errorf("list %s: %w", prefix, err)
		}
		if len(out.Contents) > 0 {
			return out, cur, nil
		}
		cur = cur.AddDate(0, -1, 0)
	}
	return nil, time.Time{}, nil
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

		// find most recent month with content (up to 12 months back)
		out, monthFound, err := findFirstNonEmptyMonth(
			ctx,
			client,
			cfg.BucketName,
			startFrom,
			12,
		)
		if err != nil {
			log.Printf("find month error: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Error listing objects"})
			return
		}
		if out == nil {
			// no images at all in the backward window
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(ImageResponse{Images: []Image{}, HasMore: false})
			return
		}

		// collect keys to process
		keys := make([]types.Object, 0, len(out.Contents))
		for _, obj := range out.Contents {
			if obj.Key == nil {
				continue
			}
			if *obj.Key == "latest.jpg" {
				continue  // skip sentinel
			}
			keys = append(keys, obj)
		}

		// worker pool to limit concurrent HeadObject calls
		const workers = 8
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
				meta, err := s3client.GetObjectMetadata(
					ctx,
					client,
					cfg.BucketName,
					*obj.Key,
				)
				if err != nil {
					log.Printf("metadata %s: %v", *obj.Key, err)
					results <- item{ok: false}
					continue
				}
				m := meta.Metadata
				if m == nil {
					m = map[string]string{}
				}
				md := CheckinMetadata{
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
					LatLng:         m["lat_lng"],
					Date:           m["date"],
					Style:          decodeRFC2047Maybe(m["style"]),
					ABV:            m["abv"],
				}
				// avoid accidental double slashes
				url := cfg.PublicURL
				if strings.HasSuffix(url, "/") {
					url = strings.TrimSuffix(url, "/")
				}
				results <- item{
					img: Image{
						URL:      path.Join(url, *obj.Key),
						Key:      *obj.Key,
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

		// sort by metadata date desc
		dateLayout := "2006-01-02 15:04:05"
		sort.SliceStable(images, func(i, j int) bool {
			ti, _ := time.Parse(dateLayout, images[i].Metadata.Date)
			tj, _ := time.Parse(dateLayout, images[j].Metadata.Date)
			return ti.After(tj)
		})

		// compute HasMore by probing one earlier month than the one we used
		var hasMore bool
		if _, _, probeErr := findFirstNonEmptyMonth(
			ctx,
			client,
			cfg.BucketName,
			monthFound.AddDate(0, -1, 0),
			1,
		); probeErr == nil {
			out2, _, _ := findFirstNonEmptyMonth(
				ctx,
				client,
				cfg.BucketName,
				monthFound.AddDate(0, -1, 0),
				1,
			)
			hasMore = out2 != nil && len(out2.Contents) > 0
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
