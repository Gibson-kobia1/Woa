import test from 'node:test';
import assert from 'node:assert/strict';

import applicationsHandler from '../api/applications';
import adminLinksHandler from '../api/admin-links';
import validateAdminLinkHandler from '../api/admin-links/validate';

const createMockResponse = () => {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    headers,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headers['content-type'] = 'application/json; charset=utf-8';
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    end(payload?: unknown) {
      this.body = payload;
      return this;
    },
    body: undefined as unknown,
  };
};

test('GET /api/applications returns application/json', async () => {
  const res = createMockResponse();
  await applicationsHandler({ method: 'GET', url: '/api/applications?limit=2', query: { limit: '2' }, headers: {} } as any, res as any);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'] || '', /application\/json/);
});

test('POST /api/applications returns application/json', async () => {
  const res = createMockResponse();
  await applicationsHandler({ method: 'POST', url: '/api/applications', body: { phone: '+254700000000', firstName: 'Ada', lastName: 'Lovelace' }, headers: {} } as any, res as any);
  assert.equal(res.statusCode, 201);
  assert.match(res.headers['content-type'] || '', /application\/json/);
});

test('GET /api/admin-links returns application/json', async () => {
  const res = createMockResponse();
  await adminLinksHandler({ method: 'GET', url: '/api/admin-links', headers: {} } as any, res as any);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'] || '', /application\/json/);
});

test('POST /api/admin-links returns application/json', async () => {
  const res = createMockResponse();
  await adminLinksHandler({ method: 'POST', url: '/api/admin-links', body: { durationMinutes: 30 }, headers: {} } as any, res as any);
  assert.equal(res.statusCode, 201);
  assert.match(res.headers['content-type'] || '', /application\/json/);
});

test('POST /api/admin-links/validate returns application/json', async () => {
  const res = createMockResponse();
  await validateAdminLinkHandler({ method: 'POST', url: '/api/admin-links/validate', body: { token: 'demo-token' }, headers: {} } as any, res as any);
  assert.equal(res.statusCode, 401);
  assert.match(res.headers['content-type'] || '', /application\/json/);
});
