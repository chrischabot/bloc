# Deploying to production

Concrete walkthrough taking Bloc from `pnpm dev` to a hardened production deployment.

For the reference architecture and the full pre-flight checklist, see [Self-hosting › Production deployment](../self-hosting/05-production-deployment.md). This guide picks one path (Kubernetes + managed Postgres + Cloudflare R2) and shows it end-to-end.

## 1. Provision managed Postgres

Any Postgres 16+ provider works (RDS, Cloud SQL, Crunchy, Neon). Provision:

- 4 vCPU / 16 GB RAM minimum.
- `max_connections >= 200`.
- SSL required.
- One read replica.

Grab the connection string with `?sslmode=require`.

## 2. Provision Redis

ElastiCache, Memorystore, Upstash. Any single-node instance is fine for < 5k users. Note the `rediss://` URL.

## 3. Provision MeiliSearch

One node. Easiest: Meili Cloud, or a dedicated VM running their Docker image. Set `MEILI_MASTER_KEY` to a 32-byte random string.

## 4. Provision an S3-compatible bucket

R2, S3, Tigris, Backblaze. Configure:

- CORS allowing `PUT`, `POST`, `GET` from your web app's origin.
- Lifecycle: `tmp/*` expire in 24 h, `exports/*` expire in 30 d.
- IAM principal with `GetObject` / `PutObject` / `DeleteObject` / `ListBucket`.

## 5. Build the images

```bash
docker build -t bloc-api    -f apps/api/Dockerfile .
docker build -t bloc-web    -f apps/web/Dockerfile .
docker build -t bloc-worker -f apps/worker/Dockerfile .
```

Push to your registry.

## 6. Kubernetes manifests

Three deployments:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bloc-api
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: api
          image: registry/bloc-api:vX.Y.Z
          envFrom: [{ secretRef: { name: bloc-env } }]
          ports: [{ containerPort: 3001 }]
          readinessProbe: { httpGet: { path: /ready,  port: 3001 } }
          livenessProbe:  { httpGet: { path: /health, port: 3001 } }
          resources:
            requests: { cpu: 500m, memory: 1Gi }
            limits:   { cpu: '2',  memory: 2Gi }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bloc-web
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: web
          image: registry/bloc-web:vX.Y.Z
          envFrom: [{ secretRef: { name: bloc-env } }]
          ports: [{ containerPort: 3000 }]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bloc-worker
spec:
  replicas: 2
  template:
    spec:
      terminationGracePeriodSeconds: 90
      containers:
        - name: worker
          image: registry/bloc-worker:vX.Y.Z
          envFrom: [{ secretRef: { name: bloc-env } }]
          ports: [{ containerPort: 3002 }]
```

The Secret `bloc-env` holds every variable from [Configuration](../self-hosting/02-configuration.md).

## 7. Service + Ingress

Expose API + Web behind one Ingress. WebSocket needs `Upgrade: websocket` passed through; on nginx-ingress that means:

```yaml
nginx.ingress.kubernetes.io/proxy-read-timeout: '300'
nginx.ingress.kubernetes.io/upstream-hash-by:  'x-bloc-session-id'
```

For pure REST routes, sticky sessions aren't required.

## 8. Migrate the DB

Run once before the first API replica goes up:

```bash
kubectl run bloc-migrate --rm -i --tty \
  --image registry/bloc-api:vX.Y.Z \
  --env-from=secret/bloc-env \
  --command -- pnpm db:migrate
```

## 9. Observability

- Scrape `/metrics` on API and worker via your Prometheus.
- Point all three processes' `OTEL_EXPORTER_OTLP_ENDPOINT` at your OTel collector.
- Ship stdout logs to Loki / Datadog / whatever.

See [Reporting › Setting up](../reporting/01-setting-up.md).

## 10. Smoke test

```bash
curl https://api.example.com/health
curl -H "Authorization: Bearer $BLOC_TOKEN" \
     -H "Notion-Version: 2025-09-03" \
     https://api.example.com/v1/users/me
```

Browser: open `https://app.example.com`, sign in, create a page, share it, refresh.

## 11. Backup

Configure `wal-g` or `pgbackrest` against the managed Postgres. Run a restore drill within the first week — that's the only way to be sure your backups work.

See [Backups & recovery](../self-hosting/07-backups-and-recovery.md).

## 12. Lock down

- Restrict the API's outbound network: webhooks should be allowed, everything else can stay closed.
- Block the `/metrics` endpoint from the public Ingress; expose it only inside the cluster.
- Set `NODE_ENV=production` everywhere. Bloc refuses to start otherwise with the dev defaults.

You're live.
