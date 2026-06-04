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

// filterWebpObjects keeps only the WEBP image objects, which are the only ones
// the gallery renders. "Has images" is defined by this set everywhere so a month
// never counts as non-empty unless it would actually produce a page.
func filterWebpObjects(objs []types.Object) []types.Object {
	webp := make([]types.Object, 0, len(objs))
	for _, obj := range objs {
		if obj.Key == nil || !strings.Contains(*obj.Key, "/WEBP/") {
			continue
		}
		webp = append(webp, obj)
	}
	return webp
}

// findFirstMonthWithImages walks backwards up to maxBack months and returns the
// WEBP objects of the first month that contains any. Defining "has images" by
// WEBP presence (not any object) means the caller never receives a month that
// would filter down to an empty page.
func findFirstMonthWithImages(
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
		if webp := filterWebpObjects(objects); len(webp) > 0 {
			return webp, cur, nil
		}
		cur = cur.AddDate(0, -1, 0)
	}
	return nil, time.Time{}, nil
}

// hasOlderMonth reports whether any month within maxBack months before start
// contains WEBP images, mirroring the load definition so has_more never promises
// a page that resolves to empty.
func hasOlderMonth(
	ctx context.Context,
	client s3client.S3Client,
	bucket string,
	start time.Time,
	maxBack int,
) (bool, error) {
	objects, _, err := findFirstMonthWithImages(ctx, client, bucket, start, maxBack)
	if err != nil {
		return false, err
	}
	return len(objects) > 0, nil
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

// metadataCache memoizes per-object checkin metadata. R2 objects are immutable
// here, so a cache hit avoids a HeadObject round-trip entirely. It is bounded to
// keep memory in check, evicting an arbitrary batch when full (any entry is safe
// to drop since values never change).
type metadataCache struct {
	mu      sync.RWMutex
	entries map[string]CheckinMetadata
	max     int
}

func newMetadataCache(max int) *metadataCache {
	return &metadataCache{entries: make(map[string]CheckinMetadata, max), max: max}
}

func (c *metadataCache) get(key string) (CheckinMetadata, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	md, ok := c.entries[key]
	return md, ok
}

func (c *metadataCache) set(key string, md CheckinMetadata) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.entries[key]; !ok && len(c.entries) >= c.max {
		evict := c.max / 10
		if evict < 1 {
			evict = 1
		}
		for k := range c.entries {
			delete(c.entries, k)
			evict--
			if evict == 0 {
				break
			}
		}
	}
	c.entries[key] = md
}

func GetImages(client s3client.S3Client, cfg *config.AppConfig) http.HandlerFunc {
	cache := newMetadataCache(5000)
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

		// find the most recent month that has WEBP images to render
		keys, monthFound, err := findFirstMonthWithImages(
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
		if len(keys) == 0 {
			// no images at all in the backward window
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(ImageResponse{Images: []Image{}, HasMore: false})
			return
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
				key := *obj.Key

				imageURL, err := url.JoinPath(cfg.PublicURL, key)
				if err != nil {
					log.Printf("failed to join URL %q and %q: %v", cfg.PublicURL, key, err)
					results <- item{ok: false}
					continue
				}

				md, ok := cache.get(key)
				if !ok {
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
					md = newCheckinMetadata(meta.Metadata)
					cache.set(key, md)
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
