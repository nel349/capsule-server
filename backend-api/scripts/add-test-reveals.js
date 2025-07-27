#!/usr/bin/env node

/**
 * Script to add test reveal queue items for testing the scheduler
 * Usage: node scripts/add-test-reveals.js
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addTestReveals() {
  console.log('🧪 Adding test reveal queue items...');

  const now = new Date();
  const pastDate = new Date('2024-01-01T10:00:00.000Z');
  const futureDate1 = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes from now
  const futureDate2 = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

  // First, create test users
  const testUsers = [
    {
      user_id: uuidv4(),
      wallet_address: 'TestWallet1111111111111111111111111111',
      auth_type: 'wallet'
    },
    {
      user_id: uuidv4(),
      wallet_address: 'TestWallet2222222222222222222222222222',
      auth_type: 'wallet'
    },
    {
      user_id: uuidv4(),
      wallet_address: 'TestWallet3333333333333333333333333333',
      auth_type: 'wallet'
    }
  ];

  console.log('👥 Creating test users...');
  for (const user of testUsers) {
    const { error } = await supabase
      .from('users')
      .upsert(user, { onConflict: 'user_id' });
    
    if (error) {
      console.error(`❌ Error creating user ${user.user_id}:`, error);
    } else {
      console.log(`✅ Created test user: ${user.wallet_address}`);
    }
  }

  // Create test capsules
  const testCapsules = [
    {
      capsule_id: uuidv4(),
      user_id: testUsers[0].user_id,
      content_encrypted: 'U2FsdGVkX19test123past',
      content_hash: 'hash123',
      reveal_date: pastDate.toISOString(),
      on_chain_tx: 'test-tx-past-123',
      status: 'pending',
      is_gamified: false,
      sol_fee_amount: 0.00005
    },
    {
      capsule_id: uuidv4(),
      user_id: testUsers[1].user_id,
      content_encrypted: 'U2FsdGVkX19test456future1',
      content_hash: 'hash456',
      reveal_date: futureDate1.toISOString(),
      on_chain_tx: 'test-tx-future1-456',
      status: 'pending',
      is_gamified: true,
      sol_fee_amount: 0.00005
    },
    {
      capsule_id: uuidv4(),
      user_id: testUsers[2].user_id,
      content_encrypted: 'U2FsdGVkX19test789future2',
      content_hash: 'hash789',
      reveal_date: futureDate2.toISOString(),
      on_chain_tx: 'test-tx-future2-789',
      status: 'pending',
      is_gamified: false,
      sol_fee_amount: 0.00005
    }
  ];

  console.log('📦 Creating test capsules...');
  for (const capsule of testCapsules) {
    const { error } = await supabase
      .from('capsules')
      .upsert(capsule, { onConflict: 'capsule_id' });
    
    if (error) {
      console.error(`❌ Error creating capsule ${capsule.capsule_id}:`, error);
    } else {
      console.log(`✅ Created test capsule: ${capsule.capsule_id}`);
    }
  }

  // Create reveal queue items
  const revealQueueItems = [
    {
      capsule_id: testCapsules[0].capsule_id,
      scheduled_for: pastDate.toISOString(),
      status: 'pending',
      attempts: 0,
      max_attempts: 3
    },
    {
      capsule_id: testCapsules[1].capsule_id,
      scheduled_for: futureDate1.toISOString(),
      status: 'pending',
      attempts: 0,
      max_attempts: 3
    },
    {
      capsule_id: testCapsules[2].capsule_id,
      scheduled_for: futureDate2.toISOString(),
      status: 'pending',
      attempts: 1,
      max_attempts: 3
    },
    // Add a failed item for testing retry functionality
    {
      capsule_id: uuidv4(),
      scheduled_for: pastDate.toISOString(),
      status: 'failed',
      attempts: 3,
      max_attempts: 3,
      error_message: 'Test failed reveal for retry testing'
    }
  ];

  console.log('⏰ Adding reveal queue items...');
  for (const item of revealQueueItems) {
    const { error } = await supabase
      .from('reveal_queue')
      .insert(item);
    
    if (error) {
      console.error(`❌ Error adding reveal queue item for ${item.capsule_id}:`, error);
    } else {
      console.log(`✅ Added reveal queue item: ${item.capsule_id} (${item.status})`);
    }
  }

  // Display summary
  console.log('\n📊 Test Data Summary:');
  console.log(`📅 Past date (should process immediately): ${pastDate.toISOString()}`);
  console.log(`📅 Future date 1 (2 min): ${futureDate1.toISOString()}`);
  console.log(`📅 Future date 2 (5 min): ${futureDate2.toISOString()}`);
  
  // Query current reveal queue
  const { data: queueData, error: queueError } = await supabase
    .from('reveal_queue')
    .select('*')
    .order('scheduled_for', { ascending: true });

  if (queueError) {
    console.error('❌ Error querying reveal queue:', queueError);
  } else {
    console.log('\n📋 Current Reveal Queue:');
    queueData.forEach((item, index) => {
      console.log(`${index + 1}. ${item.capsule_id} - ${item.status} - ${item.scheduled_for} (attempts: ${item.attempts}/${item.max_attempts})`);
    });
  }

  console.log('\n🔧 Next Steps:');
  console.log('1. Check scheduler status: GET /api/scheduler/status');
  console.log('2. Trigger manual processing: POST /api/scheduler/trigger');
  console.log('3. Check pending reveals: GET /api/scheduler/pending');
  console.log('4. Monitor server logs for processing');
  
  process.exit(0);
}

// Run the script
addTestReveals().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});