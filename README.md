# otel-tester

[![OTel Compatible](https://img.shields.io/badge/OpenTelemetry-compatible-blueviolet?logo=opentelemetry)](https://opentelemetry.io/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

A portable observability testing lab. Run a full OpenTelemetry stack with realistic microservices, synthetic signal generators, and load testing — then point it at any backend by swapping one `.env` file.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        docker compose                               │
│                                                                     │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  OTel Demo   │  │  otelgen │  │   flog   │  │   k6 + OTel    │  │
│  │ (microsvcs)  │  │(on-demand│  │ (writes  │  │  (load tests)  │  │
│  │              │  │ synth)   │  │  to file) │  │                │  │
│  └──────┬───────┘  └────┬─────┘  └────┬──────┘  └───────┬────────┘  │
│         │ OTLP          │ OTLP        │ file             │ OTLP     │
│         ▼               ▼             ▼                  ▼          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              OTel Collector (contrib)                         │   │
│  │  receivers: otlp, filelog                                    │   │
│  │  processors: batch, resource                                 │   │
│  │  exporters: otlphttp | datadog | prometheus | debug          │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              ▼
                    Target Backend (via .env)
          ┌────────┬────────┬─────────┬───────┬───────┐
          │Elastic │Grafana │Datadog  │Local  │Debug  │
          │  APM   │ Cloud  │         │Jaeger │stdout │
          │        │        │         │+Prom  │       │
          └────────┴────────┴─────────┴───────┴───────┘
```

## Quickstart

```bash
# Clone
git clone https://github.com/VMMusic/otel-tester.git
cd otel-tester

# Start with debug output (all telemetry to collector stdout)
docker compose --env-file envs/.env.debug up

# Or start with local backends (Jaeger + Prometheus + Grafana)
docker compose --env-file envs/.env.local up
```

With the local profile, access:
- **Frontend**: http://localhost:8080
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **Locust (load generator)**: http://localhost:8089

## Switching Backends

Change the backend by pointing to a different `.env` file — no config changes needed:

| Backend | Command | Notes |
|---------|---------|-------|
| **Debug** | `docker compose --env-file envs/.env.debug up` | All signals to stdout |
| **Local** | `docker compose --env-file envs/.env.local up` | Jaeger + Prometheus + Grafana |
| **Elastic** | `docker compose --env-file envs/.env.elastic up` | Set `ELASTIC_APM_ENDPOINT` and `ELASTIC_APM_TOKEN` |
| **Grafana Cloud** | `docker compose --env-file envs/.env.grafana up` | Set `GRAFANA_OTLP_ENDPOINT` and `GRAFANA_API_TOKEN` |
| **Datadog** | `docker compose --env-file envs/.env.datadog up` | Set `DD_API_KEY`, uses native exporter |

For cloud backends, set the required credentials as environment variables or edit the `.env` file directly.

## Signal Generators

### OTel Demo (always on)
The [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo) app runs automatically with a built-in Locust load generator. It produces realistic traces, metrics, and logs from ~15 microservices.

### flog (always on)
Generates Apache Combined log format lines every 5 seconds. The Collector ingests these via the `filelog` receiver, simulating legacy application log ingestion.

### otelgen (on-demand)
Synthetic trace generator for targeted signal testing:

```bash
docker compose --profile generators run otelgen
```

### k6 Load Testing (on-demand)
Load tests with W3C `traceparent` propagation:

```bash
# Smoke test (5 VUs, 30s)
docker compose --profile load-test run k6

# Load test (20 VUs, 5m)
K6_SCRIPT=load.js docker compose --profile load-test run k6

# Spike test (ramps 10→100→0)
K6_SCRIPT=spike.js docker compose --profile load-test run k6

# Custom intensity
K6_VUS=100 K6_DURATION=10m docker compose --profile load-test run k6
```

## Environment Variables

See [`.env.example`](.env.example) for a fully documented template with all available variables.

Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `COLLECTOR_CONFIG` | Collector config file | `config.yaml` |
| `OTLP_ENDPOINT` | OTLP HTTP exporter endpoint | `http://localhost:4318` |
| `TRACES_EXPORTERS` | Traces pipeline exporters (YAML array) | `[debug]` |
| `METRICS_EXPORTERS` | Metrics pipeline exporters (YAML array) | `[debug]` |
| `LOGS_EXPORTERS` | Logs pipeline exporters (YAML array) | `[debug]` |
| `DEBUG_VERBOSITY` | Debug exporter detail level | `basic` |
| `COMPOSE_PROFILES` | Active docker compose profiles | (none) |
| `K6_SCRIPT` | k6 test script to run | `smoke.js` |
| `K6_VUS` | k6 virtual users override | (per-script default) |
| `K6_DURATION` | k6 duration override | (per-script default) |

## Project Structure

```
otel-tester/
├── docker-compose.yml              # Full stack orchestration
├── collector/
│   ├── config.yaml                 # Collector: OTLP + filelog → env-driven exporters
│   └── config-datadog.yaml         # Collector: Datadog-specific exporter config
├── envs/
│   ├── .env.example                # Template with all variables
│   ├── .env.debug                  # Debug/stdout backend
│   ├── .env.local                  # Jaeger + Prometheus + Grafana
│   ├── .env.elastic                # Elastic APM
│   ├── .env.grafana                # Grafana Cloud (Tempo + Mimir + Loki)
│   └── .env.datadog                # Datadog
├── k6/scripts/
│   ├── smoke.js                    # Light validation (5 VUs, 30s)
│   ├── load.js                     # Sustained load (20 VUs, 5m)
│   └── spike.js                    # Traffic spike simulation
├── prometheus/
│   └── prometheus.yml              # Scrapes collector metrics endpoint
├── grafana/provisioning/
│   └── datasources/datasources.yml # Auto-provisions Jaeger + Prometheus
├── .env.example                    # Root-level variable reference
└── .gitignore
```
