const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

// Load configuration from amplify_outputs.json
const outputsPath = path.join(__dirname, "../../amplify_outputs.json");
const outputs = JSON.parse(fs.readFileSync(outputsPath, "utf8"));

// Configuration - Replace with your actual API Gateway URL from Amplify outputs
const API_BASE_URL =
  process.env.API_BASE_URL || outputs.custom.ApiEndpoint.replace(/\/$/, "");
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const REGION = outputs.custom.Region || "ap-south-1";
// Test setup
const timestamp = new Date().toISOString();
const testId = randomUUID().substring(0, 8);
// Sample test data aligned with the schema from types.ts and models.ts
const testCases = {
  syncMedicalRecords: {
    endpoint: `${API_BASE_URL}/records`,
    method: "POST",
    data: {
      records: [
        {
          id: "test-record-001",
          livwise_record_id: "Apollo_Bangalore_Jayanagar_20250428033500",
          test_center: {
            facility_name: "Apollo",
            branch_name: "Bangalore",
            location_code: "Jayanagar",
          },
          operator_details: {
            operator_id: "OP-001",
            operator_name: "Dr. Jane Smith",
          },
          patient_details: {
            patient_id: "PT-001",
            patient_mrn: "MRN001",
            first_name: "Guru",
            last_name: "charan",
            dob: "1980-01-01",
            gender: "Male",
            mobile: "+919876543210",
            email: "teste@example.com",
            consent_to_store_health_info: true,
            address: {
              address_1: "123 Main St",
              address_2: "Apt 4B",
              address_city: "Bangalore",
              address_state: "Karnataka",
              address_pincode: "560001",
            },
          },
          observations: {
            diagnostics: {
              diagnostic_category: "Cardiovascular",
              diagnostic_code: "BP_ADULT",
              diagnostic_name: "Adult Blood Pressure",
            },
            patient_vitals: [
              {
                vital_type: "SYSTOLIC",
                observed_value: 120,
                unit_of_measure: "mmHg",
              },
              {
                vital_type: "DIASTOLIC",
                observed_value: 80,
                unit_of_measure: "mmHg",
              },
            ],
            diagnostic_status: "COMPLETED",
            test_duration_minutes: 5,
            observation_notes: "Normal blood pressure readings",
          },
          operator_notes: "Routine checkup",
          created_at: new Date().toISOString(),
        },
      ],
      deviceId: "DEV-001",
      operatorId: "OP-001",
    },
  },
  getAllRecords: {
    endpoint: `${API_BASE_URL}/records`,
    method: "GET",
  },
  getSingleRecord: {
    endpoint: `${API_BASE_URL}/records/test-record-001`,
    method: "GET",
  },
  getAllPatients: {
    endpoint: `${API_BASE_URL}/patients`,
    method: "GET",
  },
  getPatientRecords: {
    endpoint: `${API_BASE_URL}/patients/PT-001/records`,
    method: "GET",
  },
  // Additional filtering test for records
  getRecordsWithFilter: {
    endpoint: `${API_BASE_URL}/records?facilityName=Apollo&limit=10`,
    method: "GET",
  },
};

// Function to run a test case
async function runTestCase(testName, testConfig) {
  console.log(`\nRunning test: ${testName}`);

  try {
    if (!AUTH_TOKEN) {
      console.error(
        "ERROR: No AUTH_TOKEN provided. Set the environment variable with your JWT token."
      );
      return {
        testName,
        status: "FAILED",
        error: "Missing authentication token",
      };
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    };

    const requestConfig = {
      method: testConfig.method,
      url: testConfig.endpoint,
      headers,
      data: testConfig.data,
    };

    console.log(
      `Making ${testConfig.method} request to ${testConfig.endpoint}`
    );
    if (testConfig.data) {
      console.log(
        "Request payload sample:",
        JSON.stringify(testConfig.data).substring(0, 100) + "..."
      );
    }

    const startTime = new Date();
    const response = await axios(requestConfig);
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    console.log("Response Status:", response.status);
    console.log("Response Time:", duration.toFixed(2), "seconds");
    console.log(
      "Response Data:",
      JSON.stringify(response.data, null, 2).substring(0, 300) + "..."
    );

    return {
      testName,
      status: "PASSED",
      response: response.data,
      duration,
    };
  } catch (error) {
    console.error("Error Status:", error.response?.status || "Unknown");
    console.error(
      "Error Details:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );

    return {
      testName,
      status: "FAILED",
      error: error.response?.data || error.message,
      statusCode: error.response?.status || "Unknown",
    };
  }
}

// Run all tests
async function testRestApi() {
  console.log("Starting tests for LIVWW.AI REST API...");
  console.log("Using API Endpoint:", API_BASE_URL);
  console.log("Auth Token Available:", AUTH_TOKEN ? "Yes" : "No");
  console.log("Current Date/Time:", new Date().toISOString());

  const results = [];

  // Run test cases one after another
  for (const [testName, testConfig] of Object.entries(testCases)) {
    results.push(await runTestCase(testName, testConfig));
  }

  // Summary of test results
  console.log("\nTest Summary:");
  results.forEach((result) => {
    console.log(
      `- ${result.testName}: ${result.status} ${result.duration ? `(${result.duration.toFixed(2)}s)` : ""}`
    );
    if (result.status === "FAILED") {
      console.log(
        `  Error: ${JSON.stringify(result.error).substring(0, 100)}...`
      );
    }
  });

  const passedTests = results.filter((r) => r.status === "PASSED").length;
  console.log(
    `\nTotal Tests: ${results.length}, Passed: ${passedTests}, Failed: ${results.length - passedTests}`
  );

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(
    `rest-api-test-results-${timestamp}.json`,
    JSON.stringify(results, null, 2)
  );
  console.log(`Results saved to rest-api-test-results-${timestamp}.json`);
}

// Run the tests
testRestApi();
