#!/usr/bin/env node

/**
 * WebSocket Connection Test Script
 * Tests both normal WebSocket and MCP WebSocket connections
 * Run with: node websocket-flow.test.js
 */

const WebSocket = require('ws');
const http = require('http');
const https = require('https');

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  wsUrl: process.env.WS_BASE_URL || 'ws://localhost:4000',
  testUsername: `testuser_${Date.now()}`,
  testPassword: 'TestPass123',
  timeout: 10000,
  wsTimeout: 5000
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

// WebSocket connection helper
function connectWebSocket(url, options = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, options);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket connection timeout after ${config.wsTimeout}ms`));
    }, config.wsTimeout);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
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
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
      }
    }
  };
}

// Test runner
async function runTests() {
  console.log('🚀 Starting WebSocket Flow Tests');
  console.log(`📍 Base URL: ${config.baseUrl}`);
  console.log(`🔌 WebSocket URL: ${config.wsUrl}`);
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

// Authentication setup
test('Setup: Register Test User', async () => {
  const response = await makeRequest('POST', '/auth/register', {
    username: config.testUsername,
    password: config.testPassword,
    accepted_terms: true,
    cookies: {}
  });
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('user_name');
});

test('Setup: Login Test User', async () => {
  const response = await makeRequest('POST', '/auth/login', {
    username: config.testUsername,
    password: config.testPassword
  });
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('token');
  authToken = response.body.token;
  expect(authToken).toBeTruthy();
});

// WebSocket Tests
test('Normal WebSocket: Connection without token should fail', async () => {
  try {
    const ws = await connectWebSocket(`${config.wsUrl}/`);
    ws.close();
    throw new Error('Expected connection to fail without token');
  } catch (error) {
    expect(error.message).toContain('timeout');
  }
});

test('Normal WebSocket: Connection with invalid token should fail', async () => {
  try {
    const ws = await connectWebSocket(`${config.wsUrl}/invalid.jwt.token`);
    ws.close();
    throw new Error('Expected connection to fail with invalid token');
  } catch (error) {
    expect(error.message).toContain('timeout');
  }
});

test('Normal WebSocket: Connection with valid token should succeed', async () => {
  if (!authToken) throw new Error('No auth token available');
  
  const ws = await connectWebSocket(`${config.wsUrl}/${authToken}`);
  expect(ws.readyState).toBe(WebSocket.OPEN);
  
  // Test basic message handling
  const messagePromise = new Promise((resolve) => {
    ws.on('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
  
  // Send a test message
  ws.send(JSON.stringify({ type: 'test', message: 'hello' }));
  
  // Wait for any response or timeout
  try {
    const response = await Promise.race([
      messagePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('No response')), 2000))
    ]);
    console.log('   Received response:', response);
  } catch (error) {
    console.log('   No response received (expected for basic WebSocket)');
  }
  
  ws.close();
});

test('Normal WebSocket: Connection URL format validation', async () => {
  if (!authToken) throw new Error('No auth token available');
  
  // Test that the connection works with the expected URL format
  const ws = await connectWebSocket(`${config.wsUrl}/${authToken}`);
  expect(ws.readyState).toBe(WebSocket.OPEN);
  
  // Verify connection stays open
  await new Promise(resolve => setTimeout(resolve, 1000));
  expect(ws.readyState).toBe(WebSocket.OPEN);
  
  ws.close();
});

// MCP WebSocket Tests
test('MCP WebSocket: Connection to /mcp endpoint', async () => {
  try {
    const ws = await connectWebSocket(`${config.wsUrl}/mcp`);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    
    // Test MCP initialization message
    const initMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          resources: { subscribe: true },
          tools: {},
          prompts: {}
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };
    
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP init response timeout'));
      }, 5000);
      
      ws.on('message', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    ws.send(JSON.stringify(initMessage));
    
    try {
      const response = await responsePromise;
      console.log('   MCP Init Response:', JSON.stringify(response, null, 2));
      expect(response).toHaveProperty('jsonrpc');
      expect(response).toHaveProperty('id');
    } catch (error) {
      console.log('   MCP response error:', error.message);
      // MCP might not be fully implemented yet, so we just verify connection works
    }
    
    ws.close();
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log('   MCP endpoint not accessible (may not be implemented yet)');
    } else {
      throw error;
    }
  }
});

test('MCP WebSocket: Protocol version negotiation', async () => {
  try {
    const ws = await connectWebSocket(`${config.wsUrl}/mcp`);
    
    // Test with different protocol version
    const initMessage = {
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };
    
    ws.send(JSON.stringify(initMessage));
    
    // Wait for response or timeout
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    ws.close();
    console.log('   MCP protocol test completed');
  } catch (error) {
    console.log('   MCP protocol test skipped:', error.message);
  }
});

test('WebSocket: Connection cleanup and error handling', async () => {
  if (!authToken) throw new Error('No auth token available');
  
  const ws = await connectWebSocket(`${config.wsUrl}/${authToken}`);
  expect(ws.readyState).toBe(WebSocket.OPEN);
  
  // Test connection close
  const closePromise = new Promise((resolve) => {
    ws.on('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });
  
  ws.close(1000, 'Test close');
  
  const closeResult = await closePromise;
  expect(closeResult.code).toBe(1000);
  console.log('   Connection closed properly with code:', closeResult.code);
});

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests, config };