import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // warm up
    { duration: '1m', target: 50 },     // ramp to spike
    { duration: '30s', target: 100 },   // spike peak
    { duration: '1m', target: 50 },     // scale down
    { duration: '30s', target: 10 },    // cool down
    { duration: '30s', target: 0 },     // ramp to zero
  ],
  thresholds: {
    http_req_duration: ['p(99)<10000'],
    http_req_failed: ['rate<0.25'],
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

  // Rapid browsing pattern during spike
  let res = http.get(`${BASE_URL}/`, { headers });
  check(res, { 'homepage 200': (r) => r.status === 200 });

  res = http.get(`${BASE_URL}/api/products`, {
    headers: { traceparent: traceparentHeader() },
  });
  check(res, { 'products 200': (r) => r.status === 200 });

  if (res.status === 200) {
    const products = res.json();
    if (products && products.length > 0) {
      const product = products[randomIntBetween(0, products.length - 1)];

      res = http.get(`${BASE_URL}/api/products/${product.id}`, {
        headers: { traceparent: traceparentHeader() },
      });
      check(res, { 'product detail': (r) => r.status === 200 });

      // Add to cart
      res = http.post(
        `${BASE_URL}/api/cart`,
        JSON.stringify({
          item: { productId: product.id, quantity: 1 },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            traceparent: traceparentHeader(),
          },
        }
      );
      check(res, { 'add to cart': (r) => r.status === 200 || r.status === 204 });

      // Checkout attempt
      res = http.post(
        `${BASE_URL}/api/checkout`,
        JSON.stringify({
          email: 'spike-test@otel-tester.dev',
          address: { streetAddress: '1 Test St', city: 'Testville', state: 'TS', country: 'US', zipCode: '00000' },
          creditCard: { creditCardNumber: '4432-8015-6152-0454', creditCardCvv: 672, creditCardExpirationYear: 2030, creditCardExpirationMonth: 1 },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            traceparent: traceparentHeader(),
          },
        }
      );
      check(res, { 'checkout': (r) => r.status === 200 || r.status === 204 });
    }
  }

  sleep(randomIntBetween(0, 2));
}
