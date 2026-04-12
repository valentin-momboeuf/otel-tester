import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  vus: __ENV.K6_VUS ? parseInt(__ENV.K6_VUS) : 20,
  duration: __ENV.K6_DURATION || '5m',
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.15'],
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
  const headers = { traceparent: traceparentHeader() };

  // Browse homepage
  let res = http.get(`${BASE_URL}/`, { headers });
  check(res, { 'homepage 200': (r) => r.status === 200 });
  sleep(randomIntBetween(1, 3));

  // List products
  res = http.get(`${BASE_URL}/api/products`, { headers: { traceparent: traceparentHeader() } });
  check(res, { 'products 200': (r) => r.status === 200 });

  if (res.status === 200) {
    const products = res.json();
    if (products && products.length > 0) {
      const product = products[randomIntBetween(0, products.length - 1)];

      // View product detail
      res = http.get(`${BASE_URL}/api/products/${product.id}`, {
        headers: { traceparent: traceparentHeader() },
      });
      check(res, { 'product detail 200': (r) => r.status === 200 });
      sleep(randomIntBetween(1, 2));

      // Add to cart
      res = http.post(
        `${BASE_URL}/api/cart`,
        JSON.stringify({
          item: { productId: product.id, quantity: randomIntBetween(1, 3) },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            traceparent: traceparentHeader(),
          },
        }
      );
      check(res, { 'add to cart': (r) => r.status === 200 || r.status === 204 });
    }
  }

  sleep(randomIntBetween(1, 3));

  // View cart
  res = http.get(`${BASE_URL}/api/cart`, { headers: { traceparent: traceparentHeader() } });
  check(res, { 'view cart': (r) => r.status === 200 });

  sleep(randomIntBetween(2, 5));
}
