package main

import (
	"beers/backend/internal/api"
	"beers/backend/internal/config"
	"beers/backend/internal/s3client"
	"log"
	"net/http"
	"golang.org/x/time/rate"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Error loading configuration: %v", err)
	}

	s3Client, err := s3client.New(cfg)
	if err != nil {
		log.Fatalf("Error creating S3 client: %v", err)
	}

	limiter := rate.NewLimiter(1, 3)

	http.Handle("/api/images", rateLimiter(limiter, api.GetImages(s3Client, cfg)))

	fs := http.FileServer(http.Dir("../frontend/dist"))
	http.Handle("/", fs)

	log.Println("Server starting on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
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
