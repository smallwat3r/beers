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
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func rateLimit(next http.Handler) http.Handler {
	limiter := rate.NewLimiter(1, 3)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !limiter.Allow() {
			http.Error(w, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Error loading config: %v", err)
	}

	ctx := context.Background()
	s3Client, err := s3client.NewS3Client(ctx, cfg.BucketRegion)
	if err != nil {
		log.Fatalf("Error creating S3 client: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/api/images", rateLimit(api.GetImages(ctx, s3Client, cfg)))
	mux.Handle("/", staticHandler())

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	go func() {
		log.Printf("Server starting on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not listen on %s: %v\n", cfg.Port, err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exiting")
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
