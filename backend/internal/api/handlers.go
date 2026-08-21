package api

import (
	"beers/backend/internal/config"
	"beers/backend/internal/s3client"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"
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
	Images []Image `json:"images"`
}

// manifestRecord is one entry of the bucket's index.json: the object key plus
// the decoded checkin metadata, flattened. The uploader writes the manifest
// sorted newest first, so no re-sorting happens here.
type manifestRecord struct {
	Key string `json:"key"`
	CheckinMetadata
}

const manifestKey = "index.json"
const manifestTTL = 5 * time.Minute

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=UTF-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func loadManifest(
	ctx context.Context,
	client s3client.S3Client,
	cfg *config.AppConfig,
) ([]Image, error) {
	body, err := s3client.GetObject(ctx, client, cfg.BucketName, manifestKey)
	if err != nil {
		return nil, fmt.Errorf("get %s: %w", manifestKey, err)
	}
	defer body.Close()

	var records []manifestRecord
	if err := json.NewDecoder(body).Decode(&records); err != nil {
		return nil, fmt.Errorf("decode %s: %w", manifestKey, err)
	}

	images := make([]Image, 0, len(records))
	for _, rec := range records {
		imageURL, err := url.JoinPath(cfg.PublicURL, rec.Key)
		if err != nil {
			log.Printf("failed to join URL %q and %q: %v", cfg.PublicURL, rec.Key, err)
			continue
		}
		images = append(images, Image{URL: imageURL, Key: rec.Key, Metadata: rec.CheckinMetadata})
	}
	return images, nil
}

// GetImages serves the whole gallery from the bucket's manifest, cached in
// memory and refreshed at most every manifestTTL. When a refresh fails but a
// previous copy exists, the stale copy is served so a transient R2 error never
// blanks the gallery.
func GetImages(client s3client.S3Client, cfg *config.AppConfig) http.HandlerFunc {
	var mu sync.Mutex
	var cached []Image
	var fetchedAt time.Time

	// ponytail: one mutex serialises refreshes, concurrent requests during a
	// refresh wait on it; fine for one fetch per 5 minutes
	getImages := func(ctx context.Context) ([]Image, error) {
		mu.Lock()
		defer mu.Unlock()
		if cached != nil && time.Since(fetchedAt) < manifestTTL {
			return cached, nil
		}
		images, err := loadManifest(ctx, client, cfg)
		if err != nil {
			if cached != nil {
				log.Printf("manifest refresh failed, serving stale copy: %v", err)
				return cached, nil
			}
			return nil, err
		}
		cached = images
		fetchedAt = time.Now()
		return images, nil
	}

	return func(w http.ResponseWriter, r *http.Request) {
		images, err := getImages(r.Context())
		if err != nil {
			log.Printf("manifest load error: %v", err)
			writeJSONError(w, http.StatusInternalServerError, "Error loading manifest")
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=UTF-8")
		w.Header().Set("Cache-Control", "public, max-age=300")
		if err := json.NewEncoder(w).Encode(ImageResponse{Images: images}); err != nil {
			log.Printf("JSON encode error: %v", err)
		}
	}
}
