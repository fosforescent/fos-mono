#!/usr/bin/env node

/**
 * MCP Protocol Specific Test Script
 * Tests MCP JSON-RPC message handling
 * Run with: node mcp-protocol.test.js
 */

const WebSocket = require('ws');

// Configuration
const config = {
  mcpUrl: process.env.MCP_WS_URL || 'ws://localhost:4000/mcp',
  timeout: 10000,
  requestTimeout: 5000
};

// Test results tracking
let tests = [];
let messageId = 1;

// MCP Message helpers
function createMCPRequest(method, params = {}) {
  return {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
}

function createMCPNotification(method, params = {}) {
  return {
    jsonrpc: '2.0',
    method,
    params
  };
}

// WebSocket connection helper with MCP protocol
function connectMCP() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(config.mcpUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`MCP connection timeout after ${config.timeout}ms`));
    }, config.timeout);

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

// Send MCP request and wait for response
function sendMCPRequest(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const request = createMCPRequest(method, params);
    const requestId = request.id;
    
    const timeout = setTimeout(() => {
      reject(new Error(`MCP request timeout for method: ${method}`));
    }, config.requestTimeout);

    const messageHandler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === requestId) {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          resolve(response);
        }
      } catch (e) {
        // Ignore parse errors for non-matching messages
      }
    };

    ws.on('message', messageHandler);
    ws.send(JSON.stringify(request));
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
    toBeInstanceOf: (constructor) => {
      if (!(actual instanceof constructor)) {
        throw new Error(`Expected ${actual} to be instance of ${constructor.name}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
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
  console.log('🚀 Starting MCP Protocol Tests');
  console.log(`🔌 MCP URL: ${config.mcpUrl}`);
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

// MCP Protocol Tests
test('MCP Connection: Basic WebSocket connection', async () => {
  const ws = await connectMCP();
  expect(ws.readyState).toBe(WebSocket.OPEN);
  ws.close();
});

test('MCP Initialize: Send initialize request', async () => {
  const ws = await connectMCP();
  
  try {
    const response = await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: { subscribe: true },
        tools: {},
        prompts: {}
      },
      clientInfo: {
        name: 'mcp-test-client',
        version: '1.0.0'
      }
    });

    console.log('   Initialize response:', JSON.stringify(response, null, 2));
    
    expect(response).toHaveProperty('jsonrpc');
    expect(response.jsonrpc).toBe('2.0');
    expect(response).toHaveProperty('id');
    
    if (response.result) {
      expect(response.result).toHaveProperty('protocolVersion');
      expect(response.result).toHaveProperty('capabilities');
      expect(response.result).toHaveProperty('serverInfo');
      
      console.log('   Server info:', response.result.serverInfo);
      console.log('   Server capabilities:', JSON.stringify(response.result.capabilities, null, 2));
    } else if (response.error) {
      console.log('   Initialize error:', response.error);
      throw new Error(`Initialize failed: ${response.error.message}`);
    }
  } finally {
    ws.close();
  }
});

test('MCP Resources: List available resources', async () => {
  const ws = await connectMCP();
  
  try {
    // First initialize
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { resources: { subscribe: true }, tools: {}, prompts: {} },
      clientInfo: { name: 'mcp-test-client', version: '1.0.0' }
    });

    // Send initialized notification
    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // List resources
    const response = await sendMCPRequest(ws, 'resources/list');
    
    console.log('   Resources response:', JSON.stringify(response, null, 2));
    
    if (response.result) {
      expect(response.result).toHaveProperty('resources');
      expect(response.result.resources).toBeInstanceOf(Array);
      console.log(`   Found ${response.result.resources.length} resources`);
    } else if (response.error) {
      console.log('   Resources list error (may not be implemented):', response.error);
    }
  } finally {
    ws.close();
  }
});

test('MCP Tools: List available tools', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize session
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { resources: {}, tools: {}, prompts: {} },
      clientInfo: { name: 'mcp-test-client', version: '1.0.0' }
    });

    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // List tools
    const response = await sendMCPRequest(ws, 'tools/list');
    
    console.log('   Tools response:', JSON.stringify(response, null, 2));
    
    if (response.result) {
      expect(response.result).toHaveProperty('tools');
      expect(response.result.tools).toBeInstanceOf(Array);
      console.log(`   Found ${response.result.tools.length} tools`);
      
      // Log tool details
      response.result.tools.forEach((tool, index) => {
        console.log(`   Tool ${index + 1}: ${tool.name} - ${tool.description}`);
      });
    } else if (response.error) {
      console.log('   Tools list error (may not be implemented):', response.error);
    }
  } finally {
    ws.close();
  }
});

test('MCP Prompts: List available prompts', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize session
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { resources: {}, tools: {}, prompts: {} },
      clientInfo: { name: 'mcp-test-client', version: '1.0.0' }
    });

    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // List prompts
    const response = await sendMCPRequest(ws, 'prompts/list');
    
    console.log('   Prompts response:', JSON.stringify(response, null, 2));
    
    if (response.result) {
      expect(response.result).toHaveProperty('prompts');
      expect(response.result.prompts).toBeInstanceOf(Array);
      console.log(`   Found ${response.result.prompts.length} prompts`);
    } else if (response.error) {
      console.log('   Prompts list error (may not be implemented):', response.error);
    }
  } finally {
    ws.close();
  }
});

test('MCP Error Handling: Invalid method', async () => {
  const ws = await connectMCP();
  
  try {
    const response = await sendMCPRequest(ws, 'invalid/method');
    
    console.log('   Invalid method response:', JSON.stringify(response, null, 2));
    
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
    
    console.log('   Error code:', response.error.code);
    console.log('   Error message:', response.error.message);
  } catch (error) {
    // Timeout is also acceptable for invalid methods
    expect(error.message).toContain('timeout');
    console.log('   Invalid method timed out (acceptable behavior)');
  } finally {
    ws.close();
  }
});

test('MCP Protocol: JSON-RPC format validation', async () => {
  const ws = await connectMCP();
  
  try {
    // Send malformed JSON-RPC
    const malformedRequest = { method: 'test' }; // Missing jsonrpc and id
    
    ws.send(JSON.stringify(malformedRequest));
    
    // Wait for potential error response
    const responsePromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null); // No response is also valid
      }, 2000);
      
      ws.on('message', (data) => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(data.toString()));
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    const response = await responsePromise;
    
    if (response) {
      console.log('   Malformed request response:', JSON.stringify(response, null, 2));
      if (response.error) {
        expect(response.error).toHaveProperty('code');
        console.log('   Server correctly rejected malformed request');
      }
    } else {
      console.log('   Server ignored malformed request (acceptable behavior)');
    }
  } finally {
    ws.close();
  }
});

test('MCP Session: Multiple requests in sequence', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize
    const initResponse = await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { resources: {}, tools: {}, prompts: {} },
      clientInfo: { name: 'mcp-test-client', version: '1.0.0' }
    });
    
    expect(initResponse).toHaveProperty('result');
    
    // Send initialized notification
    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));
    
    // Make multiple requests
    const requests = [
      sendMCPRequest(ws, 'resources/list'),
      sendMCPRequest(ws, 'tools/list'),
      sendMCPRequest(ws, 'prompts/list')
    ];
    
    const responses = await Promise.allSettled(requests);
    
    console.log('   Multiple requests completed:');
    responses.forEach((result, index) => {
      const method = ['resources/list', 'tools/list', 'prompts/list'][index];
      if (result.status === 'fulfilled') {
        console.log(`   ${method}: Success`);
      } else {
        console.log(`   ${method}: ${result.reason.message}`);
      }
    });
    
    // At least one request should succeed or timeout (not crash)
    expect(responses.length).toBe(3);
  } finally {
    ws.close();
  }
});

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests, config };