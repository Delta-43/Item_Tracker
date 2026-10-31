# syntax=docker/dockerfile:1

# Build stages run on the build machine's own architecture and cross-compile,
# so multi-arch images build without emulation.
FROM --platform=$BUILDPLATFORM node:24-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS build
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY web/embed.go ./web/
COPY --from=web /src/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/itemtracker ./cmd/itemtracker \
 && mkdir -p /out/data

FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/itemtracker /itemtracker
COPY --from=build --chown=65532:65532 /out/data /data
ENV ITEMTRACKER_ADDR=:4242 \
    ITEMTRACKER_DATA=/data
VOLUME ["/data"]
EXPOSE 4242
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD ["/itemtracker", "healthcheck"]
ENTRYPOINT ["/itemtracker"]
