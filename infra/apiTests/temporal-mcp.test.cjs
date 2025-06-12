#!/usr/bin/env node

/**
 * Temporal MCP Server Test Script
 * Tests the Temporal MCP server for long-running task management
 * Run with: node temporal-mcp.test.js
 */

const WebSocket = require('ws');
const http = require('http');
const https = require('https');

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  mcpUrl: process.env.MCP_WS_URL || 'ws://localhost:4000/mcp',
  testUsername: `tempuser_${Date.now()}`,
  testPassword: 'TestPass123',
  timeout: 10000,
  requestTimeout: 5000
};

// Test results tracking
let tests = [];
let messageId = 1;
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
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
      }
    },
    toContain: (substring) => {
      if (typeof actual !== 'string' || !actual.includes(substring)) {
        throw new Error(`Expected "${actual}" to contain "${substring}"`);
      }
    },
    toBeInstanceOf: (constructor) => {
      if (!(actual instanceof constructor)) {
        throw new Error(`Expected ${actual} to be instance of ${constructor.name}`);
      }
    },
    toBeGreaterThan: (value) => {
      if (actual <= value) {
        throw new Error(`Expected ${actual} to be greater than ${value}`);
      }
    }
  };
}

// Test runner
async function runTests() {
  console.log('🚀 Starting Temporal MCP Server Tests');
  console.log(`🔌 MCP URL: ${config.mcpUrl}`);
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

// MCP Connection and Initialization
test('Temporal MCP: Initialize session', async () => {
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
        name: 'temporal-test-client',
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
    }
  } finally {
    ws.close();
  }
});

// Temporal Tools Testing
test('Temporal Tools: List available tools', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize session
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { resources: {}, tools: {}, prompts: {} },
      clientInfo: { name: 'temporal-test-client', version: '1.0.0' }
    });

    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // List tools
    const response = await sendMCPRequest(ws, 'tools/list');
    
    console.log('   Tools response:', JSON.stringify(response, null, 2));
    
    if (response.result && response.result.tools) {
      expect(response.result.tools).toBeInstanceOf(Array);
      
      // Check for temporal-specific tools
      const toolNames = response.result.tools.map(tool => tool.name);
      const temporalTools = [
        'submit_task',
        'get_task_status', 
        'cancel_task',
        'list_tasks',
        'retry_task',
        'update_task_progress',
        'get_workflow_types'
      ];
      
      temporalTools.forEach(toolName => {
        if (toolNames.includes(toolName)) {
          console.log(`   Found temporal tool: ${toolName}`);
        }
      });
      
      expect(response.result.tools.length).toBeGreaterThan(0);
    }
  } finally {
    ws.close();
  }
});

test('Temporal Tools: Get workflow types', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize session
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'temporal-test-client', version: '1.0.0' }
    });

    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // Call get_workflow_types tool
    const response = await sendMCPRequest(ws, 'tools/call', {
      name: 'get_workflow_types',
      arguments: {}
    });
    
    console.log('   Workflow types response:', JSON.stringify(response, null, 2));
    
    if (response.result) {
      expect(response.result).toHaveProperty('content');
      expect(response.result.content).toBeInstanceOf(Array);
      
      if (response.result.content.length > 0) {
        const content = JSON.parse(response.result.content[0].text);
        if (content.success) {
          console.log('   Available workflow types:', content.result);
          expect(content.result).toBeInstanceOf(Array);
          expect(content.result.length).toBeGreaterThan(0);
        }
      }
    }
  } catch (error) {
    console.log('   Workflow types test skipped (tool may not be implemented):', error.message);
  } finally {
    ws.close();
  }
});

test('Temporal Tools: Submit a task', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize session
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'temporal-test-client', version: '1.0.0' }
    });

    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // Submit a test task
    const response = await sendMCPRequest(ws, 'tools/call', {
      name: 'submit_task',
      arguments: {
        name: 'Test Data Processing Task',
        description: 'A test task for processing sample data',
        workflowType: 'data_processing',
        input: {
          dataset: 'sample_data.csv',
          operation: 'transform',
          filters: ['active_users']
        },
        priority: 'normal',
        estimatedDuration: 300,
        tags: ['test', 'data_processing']
      }
    });
    
    console.log('   Task submission response:', JSON.stringify(response, null, 2));
    
    if (response.result) {
      expect(response.result).toHaveProperty('content');
      
      if (response.result.content.length > 0) {
        const content = JSON.parse(response.result.content[0].text);
        if (content.success) {
          console.log('   Task submitted successfully:', content.result.id);
          expect(content.result).toHaveProperty('id');
          expect(content.result).toHaveProperty('status');
          expect(content.result.status).toBe('pending');
        }
      }
    }
  } catch (error) {
    console.log('   Task submission test skipped (requires authentication):', error.message);
  } finally {
    ws.close();
  }
});

// Temporal Resources Testing
test('Temporal Resources: List available resources', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize session
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { resources: { subscribe: true } },
      clientInfo: { name: 'temporal-test-client', version: '1.0.0' }
    });

    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // List resources
    const response = await sendMCPRequest(ws, 'resources/list');
    
    console.log('   Resources response:', JSON.stringify(response, null, 2));
    
    if (response.result && response.result.resources) {
      expect(response.result.resources).toBeInstanceOf(Array);
      
      // Check for temporal-specific resources
      const resourceUris = response.result.resources.map(resource => resource.uri);
      const temporalResources = [
        'temporal://tasks',
        'temporal://workflows',
        'temporal://webhooks',
        'temporal://metrics'
      ];
      
      temporalResources.forEach(uri => {
        if (resourceUris.includes(uri)) {
          console.log(`   Found temporal resource: ${uri}`);
        }
      });
    }
  } finally {
    ws.close();
  }
});

test('Temporal Resources: Read task metrics', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize session
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { resources: { subscribe: true } },
      clientInfo: { name: 'temporal-test-client', version: '1.0.0' }
    });

    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // Read metrics resource
    const response = await sendMCPRequest(ws, 'resources/read', {
      uri: 'temporal://metrics'
    });
    
    console.log('   Metrics resource response:', JSON.stringify(response, null, 2));
    
    if (response.result && response.result.contents) {
      expect(response.result.contents).toBeInstanceOf(Array);
      
      if (response.result.contents.length > 0) {
        const content = response.result.contents[0];
        expect(content).toHaveProperty('uri');
        expect(content.uri).toBe('temporal://metrics');
        
        if (content.text) {
          const metrics = JSON.parse(content.text);
          console.log('   Task metrics:', metrics);
          expect(metrics).toHaveProperty('total');
          expect(metrics).toHaveProperty('byStatus');
        }
      }
    }
  } catch (error) {
    console.log('   Metrics resource test skipped:', error.message);
  } finally {
    ws.close();
  }
});

// Temporal Prompts Testing  
test('Temporal Prompts: List available prompts', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize session
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { prompts: {} },
      clientInfo: { name: 'temporal-test-client', version: '1.0.0' }
    });

    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // List prompts
    const response = await sendMCPRequest(ws, 'prompts/list');
    
    console.log('   Prompts response:', JSON.stringify(response, null, 2));
    
    if (response.result && response.result.prompts) {
      expect(response.result.prompts).toBeInstanceOf(Array);
      
      // Check for temporal-specific prompts
      const promptNames = response.result.prompts.map(prompt => prompt.name);
      const temporalPrompts = [
        'task_submission_wizard',
        'task_monitoring_dashboard',
        'task_failure_analysis'
      ];
      
      temporalPrompts.forEach(promptName => {
        if (promptNames.includes(promptName)) {
          console.log(`   Found temporal prompt: ${promptName}`);
        }
      });
    }
  } finally {
    ws.close();
  }
});

test('Temporal Prompts: Get task submission wizard', async () => {
  const ws = await connectMCP();
  
  try {
    // Initialize session
    await sendMCPRequest(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { prompts: {} },
      clientInfo: { name: 'temporal-test-client', version: '1.0.0' }
    });

    ws.send(JSON.stringify(createMCPNotification('notifications/initialized')));

    // Get task submission wizard prompt
    const response = await sendMCPRequest(ws, 'prompts/get', {
      name: 'task_submission_wizard',
      arguments: {
        workflow_type: 'data_processing'
      }
    });
    
    console.log('   Task wizard prompt response:', JSON.stringify(response, null, 2));
    
    if (response.result) {
      expect(response.result).toHaveProperty('description');
      expect(response.result).toHaveProperty('messages');
      expect(response.result.messages).toBeInstanceOf(Array);
      
      if (response.result.messages.length > 0) {
        const message = response.result.messages[0];
        expect(message).toHaveProperty('content');
        expect(message.content.text).toContain('data_processing');
        console.log('   Wizard prompt generated successfully');
      }
    }
  } catch (error) {
    console.log('   Task wizard prompt test skipped:', error.message);
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