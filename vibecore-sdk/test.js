const VibeCore = require('./index');

async function runTest() {
  console.log('🏁 Starting VibeCore SDK Cache Hit Test...');

  // Initialize VibeCore SDK pointing to local proxy server
  // Using a mock key for offline/local simulation
  const vc = new VibeCore({
    apiKey: 'vc-test-key-mock-123456',
    baseUrl: 'http://localhost:3001'
  });

  const params = {
    model: 'auto',
    messages: [
      { role: 'user', content: 'What is the speed of light in vacuum? Could you please keep it short?' }
    ]
  };

  try {
    // Request 1: Cache Miss / Cold start
    console.log('\n📡 Sending Request 1 (Cache Miss expectation)...');
    const start1 = Date.now();
    const res1 = await vc.chat.completions.create(params);
    const latency1 = Date.now() - start1;

    console.log('✅ Response 1 Received:');
    console.log(`💬 Content: "${res1.choices[0].message.content.trim()}"`);
    console.log(`⏱️  Latency: ${latency1}ms`);
    console.log(`🤖 Model used: ${res1.model}`);

    // Request 2: Cache Hit (Exact matching cache)
    console.log('\n📡 Sending Request 2 (Cache Hit expectation)...');
    const start2 = Date.now();
    const res2 = await vc.chat.completions.create(params);
    const latency2 = Date.now() - start2;

    console.log('✅ Response 2 Received:');
    console.log(`💬 Content: "${res2.choices[0].message.content.trim()}"`);
    console.log(`⏱️  Latency: ${latency2}ms`);
    console.log(`🤖 Model used: ${res2.model}`);

    if (latency2 < latency1) {
      console.log('\n🎉 Cache hit successfully saved latency and resources!');
    } else {
      console.log('\n⚠️ Cache hit latency was similar to miss. Check Redis status.');
    }
  } catch (error) {
    console.error('\n❌ SDK Test Failed with error:', error.message);
    console.log('Ensure the VibeCore backend server is active at http://localhost:3001 and your Redis environment is set up.');
  }
}

runTest();
