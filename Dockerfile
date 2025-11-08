# frontend build
FROM node:20-alpine AS frontend-builder

WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend .
RUN npm run build

# backend build
FROM golang:1.25-alpine AS builder

ENV CGO_ENABLED=0 GOOS=linux GO111MODULE=on

WORKDIR /src

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend .

# copy frontend
COPY --from=frontend-builder /src/frontend/dist /src/dist

RUN go build -trimpath -mod=readonly -buildvcs=false -ldflags="-s -w" \
    -o /out/server ./cmd/server

# runtime
FROM gcr.io/distroless/static:nonroot

WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /out/server /app/server
COPY --from=builder --chown=nonroot:nonroot /src/dist /app/dist

EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["/app/server"]
