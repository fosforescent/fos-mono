#!/usr/bin/env node

/**
 * Automated Authentication Flow Test Script
 * Run with: node auth-flow.test.js
 */

const http = require('http');
const https = require('https');
const querystring = require('querystring');

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  testUsername: `testuser_${Date.now()}`,
  testPassword: 'TestPass123',
  timeout: 15000 // Increased timeout for FosStore creation
};

// Test results tracking
let tests = [];
let authToken = null;

// Utility function to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.baseUrl + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      },
      timeout: config.timeout
    };

    const requestModule = url.protocol === 'https:' ? https : http;
    const req = requestModule.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${config.timeout}ms`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test helper functions
function test(name, fn) {
  tests.push({ name, fn });
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toHaveProperty: (prop) => {
      if (!actual.hasOwnProperty(prop)) {
        throw new Error(`Expected to have property ${prop}`);
      }
    },
    toBeOneOf: (values) => {
      if (!values.includes(actual)) {
        throw new Error(`Expected ${actual} to be one of ${values.join(', ')}`);
      }
    },
    toContain: (substring) => {
      if (typeof actual !== 'string' || !actual.includes(substring)) {
        throw new Error(`Expected "${actual}" to contain "${substring}"`);
      }
    }
  };
}

// Test runner
async function runTests() {
  console.log('🚀 Starting Authentication Flow Tests');
  console.log(`📍 Base URL: ${config.baseUrl}`);
  console.log(`👤 Test Username: ${config.testUsername}`);
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      console.log(`🧪 ${name}`);
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Define tests
test('Health Check', async () => {
  const response = await makeRequest('GET', '/');
  // Health endpoint requires authentication
  expect(response.status).toBeOneOf([200, 401]);
});

test('Check Username Availability', async () => {
  const response = await makeRequest('POST', '/auth/check-username', {
    username: config.testUsername
  });
  expect(response.status).toBe(200);
});

test('Register New User', async () => {
  const response = await makeRequest('POST', '/auth/register', {
    username: config.testUsername,
    password: config.testPassword,
    accepted_terms: true,
    cookies: {}
  });
  expect(response.status).toBe(201); // Registration returns 201 Created
  expect(response.body).toHaveProperty('user_name');
  expect(response.body.user_name).toBe(config.testUsername);
});

test('Login User', async () => {
  const response = await makeRequest('POST', '/auth/login', {
    username: config.testUsername,
    password: config.testPassword
  });
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('access_token');
  expect(response.body).toHaveProperty('type');
  expect(response.body.type).toBe('Bearer');
  
  // Store token for subsequent tests
  authToken = response.body.access_token;
});

test('Verify JWT Token', async () => {
  if (!authToken) throw new Error('No auth token available');
  
  const response = await makeRequest('GET', '/auth/verify-jwt', null, {
    'Authorization': `Bearer ${authToken}`
  });
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('username');
  expect(response.body.username).toBe(config.testUsername);
});

test('Get User Profile', async () => {
  if (!authToken) throw new Error('No auth token available');
  
  const response = await makeRequest('GET', '/user/profile', null, {
    'Authorization': `Bearer ${authToken}`
  });
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('profile');
  expect(response.body).toHaveProperty('subscription');
  expect(response.body.subscription).toHaveProperty('apiCallsAvailable');
});

test('Get User Data', async () => {
  if (!authToken) throw new Error('No auth token available');
  
  const response = await makeRequest('GET', '/user/data', null, {
    'Authorization': `Bearer ${authToken}`
  });
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('data');
  expect(response.body).toHaveProperty('updated');
});

test('Test Invalid Login', async () => {
  const response = await makeRequest('POST', '/auth/login', {
    username: config.testUsername,
    password: 'WrongPassword123'
  });
  expect(response.status).toBeOneOf([401, 404]);
  expect(response.body).toHaveProperty('error');
});

test('Test Missing Credentials', async () => {
  const response = await makeRequest('POST', '/auth/login', {
    username: '',
    password: ''
  });
  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error.toLowerCase()).toContain('missing');
});

test('Test Weak Password Registration', async () => {
  const response = await makeRequest('POST', '/auth/register', {
    username: config.testUsername + '_weak',
    password: 'weak',
    accepted_terms: true,
    cookies: {}
  });
  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error.toLowerCase()).toContain('password');
});

test('Test Duplicate Username Registration', async () => {
  const response = await makeRequest('POST', '/auth/register', {
    username: config.testUsername,
    password: config.testPassword,
    accepted_terms: true,
    cookies: {}
  });
  expect(response.status).toBe(409);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error.toLowerCase()).toContain('exists');
});

test('Test Registration Without Accepting Terms', async () => {
  const response = await makeRequest('POST', '/auth/register', {
    username: config.testUsername + '_terms',
    password: config.testPassword,
    accepted_terms: false,
    cookies: {}
  });
  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error.toLowerCase()).toContain('terms');
});

test('Test Protected Endpoint Without Token', async () => {
  const response = await makeRequest('GET', '/user/profile');
  expect(response.status).toBe(401);
});

test('Test Protected Endpoint With Invalid Token', async () => {
  const response = await makeRequest('GET', '/user/profile', null, {
    'Authorization': 'Bearer invalid.jwt.token'
  });
  expect(response.status).toBe(401);
});

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests, config };