const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// Load configuration from amplify_outputs.json
const outputsPath = path.join(__dirname, '../../amplify_outputs.json');
const outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || outputs.custom.ApiEndpoint.replace(/\/$/, '');
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const REGION = outputs.custom.Region || 'ap-south-1';

// Test setup
const testId = randomUUID().substring(0, 8);
const testCases = {
  syncMedicalRecords: {
    endpoint: `${API_BASE_URL}/records`,
    method: 'POST',
    data: { /* … your payload … */ }
  },
  getAllRecords: {
    endpoint: `${API_BASE_URL}/records`,
    method: 'GET'
  },
  // … other tests …
};

async function runTestCase(testName, testConfig) {
  console.log(`\nRunning test: ${testName}`);

  if (!AUTH_TOKEN) {
    console.error('ERROR: No AUTH_TOKEN provided.');
    return { testName, status: 'FAILED', error: 'Missing AUTH_TOKEN' };
  }

  const { method, endpoint, data } = testConfig;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };

  // --- Build curl command ---
  const headerFlags = Object.entries(headers)
    .map(([k, v]) => `-H "${k}: ${v}"`)
    .join(' ');
  const dataFlag = data
    ? `--data-raw '${JSON.stringify(data)}'`
    : '';
  const curlCmd = `curl "${endpoint}" -X ${method} ${headerFlags} ${dataFlag}`.trim();

  console.log('Equivalent curl:');
  console.log(curlCmd);
  // --------------------------------

  const requestConfig = { method, url: endpoint, headers, data };

  try {
    const start = Date.now();
    const response = await axios(requestConfig);
    const duration = (Date.now() - start) / 1000;

    console.log('Response Status:', response.status);
    console.log('Response Time:', `${duration.toFixed(2)}s`);
    console.log('Response Data:', JSON.stringify(response.data, null, 2).slice(0, 300) + '...');

    return { testName, status: 'PASSED', response: response.data, duration };
  } catch (err) {
    const status = err.response?.status || 'Unknown';
    const errData = err.response?.data || err.message;
    console.error('Error Status:', status);
    console.error('Error Details:', JSON.stringify(errData, null, 2));

    return {
      testName,
      status: 'FAILED',
      statusCode: status,
      error: errData,
    };
  }
}

async function testRestApi() {
  console.log('Starting tests on', API_BASE_URL);
  const results = [];
  for (const [name, cfg] of Object.entries(testCases)) {
    results.push(await runTestCase(name, cfg));
  }

  console.log('\nTest Summary:');
  results.forEach(r => {
    console.log(`- ${r.testName}: ${r.status}${r.duration ? ` (${r.duration.toFixed(2)}s)` : ''}`);
    if (r.status === 'FAILED') console.log(`  Error: ${JSON.stringify(r.error).slice(0,100)}...`);
  });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = `rest-api-test-results-${ts}.json`;
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${outFile}`);
}

testRestApi();
