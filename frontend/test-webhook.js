#!/usr/bin/env node

// Simple webhook test script to verify Stripe webhook handling
const express = require('express');
const app = express();

// Mock webhook payload for testing
const testWebhookPayload = {
  id: 'evt_test_webhook',
  object: 'event',
  api_version: '2024-10-28.acacia',
  created: 1234567890,
  data: {
    object: {
      id: 'cs_test_checkout_session',
      object: 'checkout.session',
      customer: 'cus_test_customer',
      payment_status: 'paid',
      status: 'complete',
      metadata: {
        type: 'subscription',
        userId: '1',
        priceId: 'price_test'
      }
    }
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: 'req_test',
    idempotency_key: null
  },
  type: 'checkout.session.completed'
};

// Token purchase test payload
const tokenPurchasePayload = {
  id: 'evt_test_token_purchase',
  object: 'event',
  api_version: '2024-10-28.acacia',
  created: 1234567890,
  data: {
    object: {
      id: 'cs_test_token_checkout',
      object: 'checkout.session',
      customer: 'cus_test_customer',
      payment_intent: 'pi_test_payment_intent',
      payment_status: 'paid',
      status: 'complete',
      metadata: {
        type: 'token_purchase',
        userId: '1',
        tokenAmount: '1000',
        purchaseId: 'purchase_test_123'
      }
    }
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: 'req_test',
    idempotency_key: null
  },
  type: 'checkout.session.completed'
};

// Test functions
async function testWebhookEndpoint(payload, description) {
  console.log(`\n🧪 Testing: ${description}`);
  
  try {
    const response = await fetch('http://localhost:4000/subscription/webhook/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test_signature_would_be_here'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.text();
    console.log(`✅ Response Status: ${response.status}`);
    console.log(`📄 Response Body: ${result}`);
    
    if (response.status === 200) {
      console.log(`✨ ${description} - SUCCESS`);
    } else {
      console.log(`❌ ${description} - FAILED`);
    }
  } catch (error) {
    console.log(`💥 ${description} - ERROR: ${error.message}`);
  }
}

async function testAllWebhooks() {
  console.log('🎯 Starting Stripe Webhook Tests...');
  console.log('📡 Testing endpoint: http://localhost:4000/subscription/webhook/');
  
  // Wait a moment for server to be ready
  console.log('⏱️  Waiting 2 seconds for server...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test subscription checkout
  await testWebhookEndpoint(testWebhookPayload, 'Subscription Checkout Completed');
  
  // Test token purchase
  await testWebhookEndpoint(tokenPurchasePayload, 'Token Purchase Completed');
  
  // Test invoice paid
  const invoicePaidPayload = {
    ...testWebhookPayload,
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_test_invoice',
        object: 'invoice',
        customer: 'cus_test_customer',
        status: 'paid',
        amount_paid: 2000,
        currency: 'usd'
      }
    }
  };
  await testWebhookEndpoint(invoicePaidPayload, 'Invoice Paid');
  
  // Test payment failed
  const paymentFailedPayload = {
    ...testWebhookPayload,
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_test_invoice_failed',
        object: 'invoice',
        customer: 'cus_test_customer',
        status: 'open',
        amount_due: 2000,
        currency: 'usd'
      }
    }
  };
  await testWebhookEndpoint(paymentFailedPayload, 'Payment Failed');
  
  console.log('\n🏁 Webhook testing complete!');
}

// Test webhook forwarding with Stripe CLI
function testStripeForwarding() {
  console.log('\n🔄 To test with real Stripe events, run:');
  console.log('stripe listen --forward-to localhost:4000/subscription/webhook/');
  console.log('\n🧪 To trigger test events, run:');
  console.log('stripe trigger checkout.session.completed');
  console.log('stripe trigger invoice.paid');
  console.log('stripe trigger payment_intent.succeeded');
  console.log('\n📝 Check the console output above for webhook processing results');
}

// Run tests
if (require.main === module) {
  testAllWebhooks().then(() => {
    testStripeForwarding();
  });
}

module.exports = {
  testWebhookEndpoint,
  testAllWebhooks
};