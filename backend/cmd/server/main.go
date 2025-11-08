package main

import (
	"beers/backend/internal/api"
	"beers/backend/internal/config"
	"beers/backend/internal/s3client"
	"context"
	"golang.org/x/time/rate"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

const addr = ":8080"

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("error loading configuration: %v", err)
	}

	s3Client, err := s3client.New(context.Background(), cfg)
	if err != nil {
		log.Fatalf("error creating S3 client: %v", err)
	}

	mux := http.NewServeMux()

	limiter := rate.NewLimiter(1, 3)
	mux.Handle("/api/images", rateLimiter(limiter, api.GetImages(s3Client, cfg)))
	mux.Handle("/", staticHandler())

	log.Printf("server starting on %s...", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func staticHandler() http.Handler {
	ex, err := os.Executable()
	if err != nil {
		log.Fatalf("error getting executable path: %v", err)
	}

	exPath := filepath.Dir(ex)
	distPath := filepath.Join(exPath, "dist")

	return http.FileServer(http.Dir(distPath))
}

func rateLimiter(limiter *rate.Limiter, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !limiter.Allow() {
			http.Error(
				w,
				http.StatusText(http.StatusTooManyRequests),
				http.StatusTooManyRequests,
			)
			return
		}
		next.ServeHTTP(w, r)
	})
}
