package main

import (
	"beers/backend/internal/api"
	"beers/backend/internal/config"
	"beers/backend/internal/s3client"
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/time/rate"
)

// ipRateLimiter keeps a token-bucket limiter per client IP so one client cannot
// exhaust the budget of others. Stale entries are evicted periodically to keep
// memory bounded.
type ipRateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiterEntry
	rate     rate.Limit
	burst    int
	ttl      time.Duration
}

type ipLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newIPRateLimiter(r rate.Limit, burst int, ttl time.Duration) *ipRateLimiter {
	l := &ipRateLimiter{
		limiters: make(map[string]*ipLimiterEntry),
		rate:     r,
		burst:    burst,
		ttl:      ttl,
	}
	go l.cleanupLoop()
	return l
}

// maxLimiterEntries caps the per-IP map so a flood of distinct client IPs
// cannot grow memory unboundedly between TTL sweeps. Evicted entries simply
// get a fresh bucket on their next request.
const maxLimiterEntries = 10000

func (l *ipRateLimiter) allow(ip string, now time.Time) bool {
	l.mu.Lock()
	entry, ok := l.limiters[ip]
	if !ok {
		if len(l.limiters) >= maxLimiterEntries {
			for k := range l.limiters {
				delete(l.limiters, k)
				break
			}
		}
		entry = &ipLimiterEntry{limiter: rate.NewLimiter(l.rate, l.burst)}
		l.limiters[ip] = entry
	}
	entry.lastSeen = now
	limiter := entry.limiter
	l.mu.Unlock()
	return limiter.Allow()
}

func (l *ipRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(l.ttl)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-l.ttl)
		l.mu.Lock()
		for ip, entry := range l.limiters {
			if entry.lastSeen.Before(cutoff) {
				delete(l.limiters, ip)
			}
		}
		l.mu.Unlock()
	}
}

// clientIP extracts the originating IP. The app runs behind Cloudflare, where
// the only trustworthy value is CF-Connecting-IP: X-Forwarded-For is appended
// to (not replaced) by the proxy, so its first entry is client-controlled and
// only the last entry, added by the nearest trusted hop, can be believed.
// Falls back to the transport remote address when not proxied.
func clientIP(r *http.Request) string {
	if ip := r.Header.Get("CF-Connecting-IP"); ip != "" {
		return strings.TrimSpace(ip)
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[len(parts)-1])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func rateLimit(next http.Handler) http.Handler {
	// allow short bursts (initial gallery load fans out a few requests) while
	// capping sustained throughput per client
	limiter := newIPRateLimiter(rate.Limit(5), 10, 10*time.Minute)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !limiter.allow(clientIP(r), time.Now()) {
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
	s3Client, err := s3client.NewS3Client(ctx, cfg)
	if err != nil {
		log.Fatalf("Error creating S3 client: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/api/images", rateLimit(api.GetImages(s3Client, cfg)))
	mux.Handle("/", staticHandler())

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
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

// securityHeaders applies a conservative set of response headers to every
// request. nosniff also hardens the JSON error paths, which do not always set an
// explicit Content-Type. The CSP allows the bundled assets and remote images
// (served from the R2 public URL over https) while blocking framing and plugins.
func securityHeaders(next http.Handler) http.Handler {
	const csp = "default-src 'self'; img-src 'self' https: data:; " +
		"style-src 'self' 'unsafe-inline'; script-src 'self'; " +
		"object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Content-Security-Policy", csp)
		next.ServeHTTP(w, r)
	})
}

func staticHandler() http.Handler {
	ex, err := os.Executable()
	if err != nil {
		log.Fatalf("error getting executable path: %v", err)
	}

	exPath := filepath.Dir(ex)
	distPath := filepath.Join(exPath, "dist")

	fs := http.FileServer(http.Dir(distPath))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Vite emits content-hashed asset filenames, so they can be cached
		// indefinitely; the HTML entry point must stay revalidated so clients
		// never pin a stale SPA against fresh assets.
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		fs.ServeHTTP(w, r)
	})
}
