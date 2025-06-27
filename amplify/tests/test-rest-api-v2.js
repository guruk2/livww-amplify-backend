/**
 * LIVWW.AI Backend REST API Test Suite v2.1 (Corrected Scope & URL Handling)
 * 
 * Fixes the ReferenceError for testRunIdSuffix and ensures correct URL construction.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// --- Configuration ---
const outputsPath = path.join(__dirname, '../../amplify_outputs.json');
let outputs;
try {
  outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));
} catch (error) {
  console.error(`FATAL: Could not read amplify_outputs.json at ${outputsPath}`);
  console.error('Ensure the file exists and the backend is deployed.');
  process.exit(1);
}

const API_BASE_URL = (process.env.API_BASE_URL || outputs.custom?.ApiEndpoint)?.replace(/\/$/, ''); 
if (!API_BASE_URL) {
  console.error('FATAL: API Endpoint URL not found.'); process.exit(1);
}
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const REGION = outputs.custom?.Region || 'ap-south-1';

// --- Test Setup ---
const timestamp = new Date().toISOString();
// **FIX: Declare testIdSuffix in the global scope**
const testIdSuffix = randomUUID().substring(0, 8); 
function generateTestData(index) {
    // Function content remains the same as previous version...
    // (Generates recordOne, recordTwo, invalidRecord using testIdSuffix)
    const uniqueId = `${testIdSuffix}-${index}`;
    return {
      recordOne: {
        id: `test-rec-${uniqueId}-001`,
        livwise_record_id: `Apollo-BLR-${timestamp.replace(/\D/g, '')}-${uniqueId}-1`,
        test_center: { facility_name: "Apollo", branch_name: "Bengaluru", location_code: "Jayanagar" },
        operator_details: { operator_id: `OP-${uniqueId}-001`, operator_name: "Dr. Jane Smith" },
        patient_details: {
          patient_id: `PT-${uniqueId}-001`, patient_mrn: `MRN${uniqueId}123`, first_name: "John", last_name: `Doe-${uniqueId}`,
          dob: "1985-03-15", gender: "Male", mobile: "+919876543210", email: `john.doe.${uniqueId}@example.com`, consent_to_store_health_info: true,
          address: { address_1: "123 Wellness Way", address_2: "Apt 4B", address_city: "Bengaluru", address_state: "Karnataka", address_pincode: "560078" }
        },
        observations: {
          diagnostics: { diagnostic_category: "Cardiovascular", diagnostic_code: "BP_ADULT", diagnostic_name: "Adult Blood Pressure" },
          patient_vitals: [ { vital_type: "systolic_mmhg", observed_value: 120, unit_of_measure: "mmHg" }, { vital_type: "diastolic_mmhg", observed_value: 80, unit_of_measure: "mmHg" }, { vital_type: "pulse_rate_bpm", observed_value: 72, unit_of_measure: "bpm" } ],
          s3_object_url: "https://example.com/placeholder.txt", diagnostic_status: "success", exception_message: null, test_duration_minutes: 5, observation_notes: "Patient was calm during measurement."
        },
        operator_notes: "Standard procedure followed.", created_at: new Date(Date.now() - index * 1000).toISOString()
      },
      recordTwo: {
          id: `test-rec-${uniqueId}-002`, livwise_record_id: `Manipal-MUM-${timestamp.replace(/\D/g, '')}-${uniqueId}-2`,
          test_center: { facility_name: "Manipal", branch_name: "Mumbai", location_code: "Andheri" },
          operator_details: { operator_id: `OP-${uniqueId}-002`, operator_name: "Dr. Robert Johnson" },
          patient_details: {
            patient_id: `PT-${uniqueId}-002`, patient_mrn: `MRN${uniqueId}456`, first_name: "Jane", last_name: `Smith-${uniqueId}`,
            dob: "1990-07-22", gender: "Female", mobile: "+919876543211", email: `jane.smith.${uniqueId}@example.com`, consent_to_store_health_info: true,
            address: { address_1: "456 Health Avenue", address_2: "Block C", address_city: "Mumbai", address_state: "Maharashtra", address_pincode: "400053" }
          },
          observations: {
            diagnostics: { diagnostic_category: "Respiratory & Oxygenation", diagnostic_code: "SPO2", diagnostic_name: "Pulse Oximetry" },
            patient_vitals: [ { vital_type: "spo2_percent", observed_value: 98, unit_of_measure: "%" }, { vital_type: "pulse_rate_bpm", observed_value: 75, unit_of_measure: "bpm" } ],
            s3_object_url: "https://example.com/placeholder2.txt", diagnostic_status: "success", exception_message: null, test_duration_minutes: 3, observation_notes: "Normal oxygen levels."
          },
          operator_notes: "Routine checkup completed.", created_at: new Date(Date.now() - index * 1000 - 500).toISOString()
      },
      invalidRecord: {
        id: `test-rec-${uniqueId}-invalid`, livwise_record_id: `Invalid-${timestamp.replace(/\D/g, '')}-${uniqueId}`,
        created_at: timestamp
      }
    };
}
// **FIX: Generate test data *after* testIdSuffix is defined**
const testDataInstance = generateTestData(1); 

// --- Test Case Definitions ---
// Definitions remain the same as previous version...
// Ensure paths do NOT start with '/'... Ensure dynamic IDs from testDataInstance are used correctly
const testCases = {
  verifyAuthRequired: {
    name: "[Auth] Verify API requires authentication",
    path: 'records', 
    method: 'GET', auth: false, expectError: true, expectedStatus: 401,
    description: "Ensures endpoints are protected and return 401 without a valid token."
  },
  syncSingleValid: {
    name: "[Sync] Sync a single valid medical record",
    path: 'records', 
    method: 'POST', data: { records: [testDataInstance.recordOne], deviceId: "TEST-DEV-001", operatorId: "TEST-OP-001" },
    description: "Tests the basic successful synchronization of one record."
  },
  syncMultipleValid: {
    name: "[Sync] Sync multiple valid medical records",
    path: 'records', 
    method: 'POST', data: { records: [generateTestData(2).recordOne, generateTestData(3).recordTwo], deviceId: "TEST-DEV-002", operatorId: "TEST-OP-002" },
    description: "Tests batch synchronization with multiple valid records."
  },
  syncWithInvalid: {
    name: "[Sync] Sync batch with one invalid record",
    path: 'records', 
    method: 'POST', data: { records: [generateTestData(4).recordOne, generateTestData(4).invalidRecord], deviceId: "TEST-DEV-003", operatorId: "TEST-OP-003" }, // Use unique invalid record
    expectPartialError: true,
    description: "Tests how the API handles batches containing invalid records."
  },
  syncEmptyArray: {
    name: "[Sync] Attempt to sync an empty records array",
    path: 'records', 
    method: 'POST', data: { records: [], deviceId: "TEST-DEV-004", operatorId: "TEST-OP-004" },
    expectError: true, expectedStatus: 400,
    description: "Ensures the API rejects requests with an empty records array."
  },
  syncMissingDeviceId: {
    name: "[Sync] Attempt to sync without a deviceId",
    path: 'records', 
    method: 'POST', data: { records: [testDataInstance.recordOne], operatorId: "TEST-OP-005" },
    expectError: true, expectedStatus: 400,
    description: "Ensures the API validates the presence of the deviceId."
  },
  getAllRecords: {
    name: "[GET Records] Retrieve all medical records (paginated)",
    path: 'records?limit=10', 
    method: 'GET', dependsOn: ['syncSingleValid', 'syncMultipleValid'],
    description: "Tests retrieving a list of records, including pagination basics."
  },
  getSpecificRecord: {
    name: "[GET Records] Retrieve a single specific medical record by ID",
    path: `records/${testDataInstance.recordOne.id}`, // Use dynamic ID
    method: 'GET', dependsOn: ['syncSingleValid'],
    description: "Tests retrieving a single record using its unique ID."
  },
  getNonExistentRecord: {
    name: "[GET Records] Attempt to retrieve a non-existent record",
    path: 'records/non-existent-record-id', 
    method: 'GET', expectError: true, expectedStatus: 404,
    description: "Ensures the API returns 404 for records that do not exist."
  },
  getAllPatients: {
    name: "[GET Patients] Retrieve all unique patients",
    path: 'patients', 
    method: 'GET', dependsOn: ['syncSingleValid', 'syncMultipleValid'],
    description: "Tests retrieving a list of all unique patients from the records."
  },
  getSpecificPatient: {
    name: "[GET Patients] Retrieve details for a specific patient by ID",
    path: `patients/${testDataInstance.recordOne.patient_details.patient_id}`, // Use dynamic ID
    method: 'GET', dependsOn: ['syncSingleValid'],
    description: "Tests retrieving the details of a single patient using their ID."
  },
  getNonExistentPatient: {
    name: "[GET Patients] Attempt to retrieve a non-existent patient",
    path: 'patients/non-existent-patient-id', 
    method: 'GET', expectError: true, expectedStatus: 404,
    description: "Ensures the API returns 404 for patient IDs not found in records."
  },
  getRecordsForPatient: {
    name: "[GET Patient Records] Retrieve all records for a specific patient",
    path: `patients/${testDataInstance.recordOne.patient_details.patient_id}/records`, // Use dynamic ID
    method: 'GET', dependsOn: ['syncSingleValid'],
    preHook: async () => {
      console.log('Waiting 3 seconds for GSI consistency...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    },
    description: "Tests retrieving all records associated with a specific patient ID using the GSI."
  },
  getRecordsByFacility: {
    name: "[Filter] Retrieve records filtered by facility name",
    path: `records?facilityName=${testDataInstance.recordOne.test_center.facility_name}`, 
    method: 'GET', dependsOn: ['syncSingleValid'],
    description: "Tests server-side filtering of records based on facility name."
  },
  getRecordsWithPaginationLimit: {
    name: "[Pagination] Retrieve records with a specific limit",
    path: 'records?limit=1', 
    method: 'GET', dependsOn: ['syncSingleValid', 'syncMultipleValid'],
    description: "Tests the 'limit' query parameter for pagination."
  }
};


// --- Test Execution Logic ---
// Function runTest remains the same as previous version...
async function runTest(testName, testConfig) {
  console.log(`\n🚀 Running test: ${testConfig.name || testName}`);
  if(testConfig.description) console.log(`   ${testConfig.description}`);
  if (testConfig.dependsOn) console.log(`   (Depends on: ${testConfig.dependsOn.join(', ')})`);

  if (testConfig.preHook && typeof testConfig.preHook === 'function') {
      await testConfig.preHook();
  }

  const result = { testName, name: testConfig.name || testName, status: 'PENDING', response: null, error: null, statusCode: null, duration: 0 };
  
  try {
    if (testConfig.auth !== false && !AUTH_TOKEN) {
      result.status = 'SKIPPED'; result.error = 'Missing AUTH_TOKEN';
      console.error(`   ❌ SKIPPED: ${result.error}`); return result;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (testConfig.auth !== false) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    
    const fullUrl = `${API_BASE_URL}/${testConfig.path}`; 

    const requestConfig = { method: testConfig.method, url: fullUrl, headers, data: testConfig.data, timeout: 20000 };
    
    console.log(`   -> ${testConfig.method} ${fullUrl}`);
    if (testConfig.data) console.log(`      Payload: ${JSON.stringify(testConfig.data).substring(0, 80)}...`);
    
    const startTime = Date.now();
    let response;
    
    try {
      response = await axios(requestConfig);
      result.duration = (Date.now() - startTime) / 1000;
      result.statusCode = response.status; result.response = response.data;
      console.log(`   <- ${response.status} ${response.statusText} (${result.duration.toFixed(2)}s)`);
      
      if (testConfig.expectError) {
        result.status = 'FAILED'; result.error = `Expected error but got ${response.status}`;
        console.error(`   ❌ FAILED: ${result.error}`);
      } else if (testConfig.expectPartialError) {
        if (response.data?.failed_records > 0) {
          result.status = 'PASSED'; console.log(`   ✅ PASSED (with expected partial failures: ${response.data.failed_records})`);
        } else {
          result.status = 'FAILED'; result.error = 'Expected partial errors but got none.';
          console.error(`   ❌ FAILED: ${result.error}`);
        }
      } else if (response.status >= 200 && response.status < 300) {
          result.status = 'PASSED'; console.log(`   ✅ PASSED`);
      } else {
          result.status = 'FAILED'; result.error = `Unexpected status: ${response.status}`;
          console.error(`   ❌ FAILED: ${result.error}`);
      }

    } catch (error) { // Axios errors
      result.duration = (Date.now() - startTime) / 1000;
      result.statusCode = error.response?.status || null;
      result.error = error.response?.data || { message: error.message };
      console.error(`   <- Error Status: ${result.statusCode || 'No Response'} (${result.duration.toFixed(2)}s)`);
      if(error.response?.data) console.error(`      Error Details: ${JSON.stringify(result.error)}`);
      else console.error(`      Error Message: ${error.message}`);

      if (testConfig.expectError && (!testConfig.expectedStatus || result.statusCode === testConfig.expectedStatus)) {
        result.status = 'PASSED'; console.log(`   ✅ PASSED (with expected error)`);
      } else {
        result.status = 'FAILED'; console.error(`   ❌ FAILED: Unexpected error.`);
      }
    }
  } catch (setupError) { // Test runner errors
    result.status = 'ERROR'; result.error = { message: `Test runner error: ${setupError.message}` };
    console.error(`   💥 ERROR executing test: ${setupError.message}`);
  }
  
  return result;
}

// Function runAllTests remains the same as previous version...
// **FIX is only needed in the test execution part (runTest) and setup**
async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║          LIVWW.AI Backend REST API Test Suite         ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`API Endpoint: ${API_BASE_URL}`);
  console.log(`Region: ${REGION}`);
  console.log(`Test Run ID Suffix: ${testIdSuffix}`); // Now accessible
  console.log(`Authentication Token: ${AUTH_TOKEN ? 'Loaded' : 'NOT FOUND - Set AUTH_TOKEN env var!'}`);
  console.log('─────────────────────────────────────────────────────────');

  if (!AUTH_TOKEN && Object.values(testCases).some(tc => tc.auth !== false)) {
      console.error("\nFATAL: AUTH_TOKEN is required. Exiting."); process.exit(1);
  }

  const allResults = [];
  const testOrder = Object.keys(testCases);

  for (const testName of testOrder) {
    const result = await runTest(testName, testCases[testName]);
    allResults.push(result);
  }

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║                     Test Summary                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  let passed = 0, failed = 0, skipped = 0, errors = 0;
  allResults.forEach(r => {
    const dur = r.duration ? `(${r.duration.toFixed(2)}s)` : '';
    let icon = '❓';
    switch(r.status){ case 'PASSED': passed++; icon='✅'; break; case 'FAILED': failed++; icon='❌'; break; case 'SKIPPED': skipped++; icon='⏭️'; break; case 'ERROR': errors++; icon='💥'; break; }
    console.log(`${icon} ${r.name}: ${r.status} ${dur}`);
    if(r.status==='FAILED'||r.status==='ERROR') console.log(`      └─ Error: ${JSON.stringify(r.error).substring(0,150)}...`);
  });
  console.log('─────────────────────────────────────────────────────────');
  console.log(`TOTAL: ${allResults.length} | ✅ PASSED: ${passed} | ❌ FAILED: ${failed} | ⏭️ SKIPPED: ${skipped} | 💥 ERRORS: ${errors}`);
  console.log('─────────────────────────────────────────────────────────');
  
  const resultsTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFilename = `livww-api-test-results-${resultsTimestamp}.json`;
  // **FIX: Use the globally declared testIdSuffix**
  const finalReport = { testRunIdSuffix, timestamp: new Date().toISOString(), apiEndpoint: API_BASE_URL, region: REGION, summary: { total: allResults.length, passed, failed, skipped, errors }, results: allResults };
  try { fs.writeFileSync(resultsFilename, JSON.stringify(finalReport, null, 2)); console.log(`\n📄 Detailed results saved to: ${resultsFilename}`); } catch (e) { console.error(`\n⚠️ Failed to save results: ${e.message}`); }
  
  return (failed + errors) === 0;
}


// --- Execute Tests ---
runAllTests().then(success => process.exit(success ? 0 : 1)).catch(error => { console.error('\n💥 Critical error:', error); process.exit(1); });
