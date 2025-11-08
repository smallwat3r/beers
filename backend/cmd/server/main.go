package main

import (
	"beers/backend/internal/api"
	"beers/backend/internal/config"
	"beers/backend/internal/s3client"
	"log"
	"net/http"
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

	http.Handle("/api/images", api.GetImages(s3Client, cfg))

	fs := http.FileServer(http.Dir("../frontend/dist"))
	http.Handle("/", fs)

	log.Println("Server starting on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
