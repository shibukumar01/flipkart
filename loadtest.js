const http = require('http');

// Helper to make a single order request
function sendOrderRequest(index) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      customer: {
        name: `Test User ${index}`,
        phone: '9876543210',
        address: 'MG Road, Bangalore',
        pincode: '560001'
      },
      items: [
        { id: 'prod-1', name: 'Apple iPhone 15', price: 65999, qty: 1 }
      ],
      totalAmount: 65999,
      paymentMethod: 'UPI'
    });

    const startTime = Date.now();
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        if (res.statusCode === 201 || res.statusCode === 200) {
          resolve({ success: true, duration, statusCode: res.statusCode });
        } else {
          resolve({ success: false, duration, statusCode: res.statusCode, error: `HTTP ${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, duration: Date.now() - startTime, error: err.code || err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, duration: Date.now() - startTime, error: 'TIMEOUT' });
    });

    req.write(payload);
    req.end();
  });
}

// Function to run a concurrent batch
async function runConcurrentBatch(concurrency) {
  console.log(`\n======================================================`);
  console.log(`>>> Testing Concurrency Level: ${concurrency} simultaneous orders`);
  console.log(`======================================================`);

  const startTime = Date.now();
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    promises.push(sendOrderRequest(i));
  }

  const results = await Promise.all(promises);
  const totalTime = (Date.now() - startTime) / 1000;

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((a, b) => a + b.duration, 0) / results.length;
  const maxDuration = Math.max(...results.map(r => r.duration));
  const minDuration = Math.min(...results.map(r => r.duration));

  // Error breakdown
  const errorMap = {};
  results.filter(r => !r.success).forEach(r => {
    errorMap[r.error] = (errorMap[r.error] || 0) + 1;
  });

  console.log(`Results for ${concurrency} concurrent orders:`);
  console.log(`  ✓ Successful Orders : ${successful} / ${concurrency} (${((successful/concurrency)*100).toFixed(1)}%)`);
  console.log(`  ✗ Failed / Rejected : ${failed} / ${concurrency}`);
  console.log(`  ⏱ Total Batch Time  : ${totalTime.toFixed(2)}s`);
  console.log(`  ⚡ Req / Sec (RPS)  : ${(concurrency / totalTime).toFixed(1)} req/s`);
  console.log(`  📊 Latency Min/Avg/Max: ${minDuration}ms / ${avgDuration.toFixed(1)}ms / ${maxDuration}ms`);

  if (failed > 0) {
    console.log(`  ⚠️ Failure Details   :`, JSON.stringify(errorMap));
  }

  return { concurrency, successful, failed, totalTime, avgDuration, errorMap };
}

// Staged ramp-up test
async function startStressTest() {
  console.log("Starting Progressive Load Test on Flipkart Clone Order API...\nTarget: http://127.0.0.1:5000/api/orders");

  // Ramping up concurrency levels: 100 -> 500 -> 1000 -> 2500 -> 5000 -> 10000 -> 20000
  const stages = [100, 500, 1000, 2500, 5000, 10000, 20000];
  const summaryReport = [];

  for (const concurrency of stages) {
    const res = await runConcurrentBatch(concurrency);
    summaryReport.push(res);

    // If more than 30% of requests failed or timed out, we've identified the breaking point
    if (res.failed / concurrency > 0.3) {
      console.log(`\n💥 [CRASH / BREAKING POINT DETECTED] at ~${concurrency} simultaneous orders.`);
      console.log(`Server started dropping connections or exhausting TCP sockets.`);
      break;
    }

    // Cooling period between batches
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log("\n======================================================");
  console.log("            FINAL LOAD TEST SUMMARY REPORT            ");
  console.log("======================================================");
  console.table(summaryReport.map(s => ({
    "Simultaneous Orders": s.concurrency,
    "Success Rate (%)": `${((s.successful / s.concurrency) * 100).toFixed(1)}%`,
    "Failed Count": s.failed,
    "Avg Latency (ms)": `${s.avgDuration.toFixed(0)} ms`,
    "Total Time (s)": `${s.totalTime.toFixed(2)} s`
  })));

  process.exit(0);
}

// Give server 1.5s to be ready before firing
setTimeout(startStressTest, 1500);
