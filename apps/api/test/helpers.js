import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import '../src/models/index.js';

let mongod;

export const testConfig = loadConfig({
  NODE_ENV: 'test',
  MONGODB_URI: 'set-by-memory-server',
  JWT_SECRET: 'test-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
  BCRYPT_COST: '4',
  WEB_DIST_PATH: '/nonexistent',
});

export async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Build indexes (e.g. unique email) before tests run
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

export async function stopDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export const makeApp = () => createApp(testConfig);

/** Reads one cookie's value from a supertest response. */
export function cookieValue(res, name) {
  const cookies = res.headers['set-cookie'] ?? [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split(';')[0].slice(name.length + 1)) : undefined;
}

export const newUser = (overrides = {}) => ({
  email: 'rider@example.com',
  password: 'correct-horse-battery',
  name: 'Test Rider',
  ...overrides,
});
