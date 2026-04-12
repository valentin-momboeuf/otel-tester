import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  vus: __ENV.K6_VUS ? parseInt(__ENV.K6_VUS) : 5,
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://frontend-proxy:8080';

function generateTraceId() {
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

function generateSpanId() {
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

function traceparentHeader() {
  return `00-${generateTraceId()}-${generateSpanId()}-01`;
}

export default function () {
  const headers = {
    traceparent: traceparentHeader(),
  };

  // Browse homepage
  let res = http.get(`${BASE_URL}/`, { headers });
  check(res, { 'homepage 200': (r) => r.status === 200 });

  sleep(randomIntBetween(1, 3));

  // Browse product
  res = http.get(`${BASE_URL}/api/products`, { headers: { traceparent: traceparentHeader() } });
  check(res, { 'products 200': (r) => r.status === 200 });

  sleep(randomIntBetween(1, 2));

  // Get cart
  res = http.get(`${BASE_URL}/api/cart`, {
    headers: { traceparent: traceparentHeader() },
  });
  check(res, { 'cart 200': (r) => r.status === 200 });

  sleep(randomIntBetween(1, 2));
}
