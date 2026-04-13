# CLAUDE.md — otel-tester

## Purpose

Portable observability testing lab. Spins up a full OTel stack via Docker Compose and routes signals to any backend by swapping a `.env` file. Not an application — a signal generator and collector harness.

## Architecture

| Layer | Component | Role |
|---|---|---|
| Signal generators | OTel Demo, otelgen, flog, k6 | Produce traces/metrics/logs |
| Collector | otelcollector (contrib) | Receive, process, export |
| Backends | Elastic, Grafana Cloud, Datadog, Local (Jaeger+Prometheus) | Targets |

The Collector config lives in `collector/config.yaml` (and `config-datadog.yaml` for the Datadog pipeline). Backend selection is purely env-driven — no code changes needed.

## Key Files

```
docker-compose.yml          — Main compose, all services
collector/config.yaml       — OTel Collector pipeline (OTLP, filelog, exporters)
collector/config-datadog.yaml — Datadog-specific collector config
envs/.env.*                 — One file per backend (debug, local, elastic, grafana, datadog)
k6/scripts/                 — Load test scenarios (smoke, load, spike)
grafana/provisioning/       — Grafana datasources and dashboards auto-provisioning
prometheus/                 — Prometheus scrape config
```

## Common Operations

```bash
# Start with local backends (Jaeger + Prometheus + Grafana)
docker compose --env-file envs/.env.local up

# Start with debug output only
docker compose --env-file envs/.env.debug up

# Run a specific k6 scenario
docker compose --env-file envs/.env.local run k6 run /scripts/load.js

# Tail collector logs
docker compose logs -f otelcol
```

## Conventions

- **`.env` files** : ne jamais committer de credentials réels — utiliser `.env.example` comme template
- **Collector config** : conserver la structure `receivers → processors → exporters → pipelines`
- **k6 scripts** : chaque scénario doit définir ses propres `options` (VUs, durée, thresholds)
- **Backends** : toute modification de routing doit rester dans `envs/` et `collector/config.yaml`, pas dans `docker-compose.yml`

## Pitfalls

- Le `filelog` receiver surveille un fichier généré par `flog` — le chemin est monté via volume dans compose, ne pas changer sans adapter les deux.
- Les backends cloud nécessitent des variables d'environnement positionnées **avant** le `docker compose up` (ou éditées dans le `.env` correspondant).
- Le profil Datadog utilise un config collector séparé (`config-datadog.yaml`) — ne pas fusionner avec `config.yaml` sans vérifier la compatibilité des exporters.
