const axios = require("axios");
const fs = require("fs");

// Configuration - Update this with your actual API Gateway URL after deployment
const API_BASE_URL =
  process.env.API_BASE_URL ||
  "https://rn6yuqh2ab.execute-api.ap-south-1.amazonaws.com/api/";
const AUTH_TOKEN =
  "eyJraWQiOiIwaVptelNYdngzZkdtNklrVWxtS1ZTQyt1dmtFRWNleVwvWFZSQ3VWYzR1ST0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMTAzM2RjYS02MDMxLTcwY2QtNmJmYi01MTdmZGQ3MGJiMTYiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZ2VuZGVyIjoiTWFsZSIsImN1c3RvbTpicmFuY2hOYW1lIjoiQXAtQmVuZ2FsdXJ1IiwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmFwLXNvdXRoLTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGgtMV9WVmZ1Y0E1QzkiLCJjb2duaXRvOnVzZXJuYW1lIjoiMTEwMzNkY2EtNjAzMS03MGNkLTZiZmItNTE3ZmRkNzBiYjE2IiwicHJlZmVycmVkX3VzZXJuYW1lIjoidmluYXkxMDAxIiwiZ2l2ZW5fbmFtZSI6IlZpbmF5Iiwib3JpZ2luX2p0aSI6IjI1MzgwMGRkLTUzOTktNGU3MC1hYzUxLTI5YjY4NGVhMzI2NSIsImF1ZCI6ImNnMXRsZmFpdm41dnF0N2tybmVsdnJncjEiLCJldmVudF9pZCI6ImQ2NGU3Y2FiLWRlNTktNDg2Ni04Zjg2LWQwZDE3MmMxMjgyYyIsImN1c3RvbTpsb2NhdGlvbk5hbWUiOiJCZW5nYWx1cnUiLCJ0b2tlbl91c2UiOiJpZCIsImN1c3RvbTpvcGVyYXRvckxvY2F0aW9uIjoiQmVuZ2FsdXJ1IiwiYXV0aF90aW1lIjoxNzUwMjQ4NzE3LCJuYW1lIjoiVmluYXkiLCJjdXN0b206ZmFjaWxpdHlOYW1lIjoiQXBvbGxvIiwiY3VzdG9tOm9wZXJhdG9ySWQiOiJPUC0xMDAxIiwiZXhwIjoxNzUwMjUyMzE3LCJpYXQiOjE3NTAyNDg3MTcsImZhbWlseV9uYW1lIjoiRCIsImp0aSI6ImVjN2ViYjcyLTI1ZjctNDBmNC1hMTU2LTJhMjIzNjBhYTA4YiIsImVtYWlsIjoidGVzdEBsaXZ3dy5haSJ9.L0r3l1NvjgbkpSV3VK9NcViLhxxBq8OxvEBm1yp2Z_IlVhrTu-3ClFsreD3nVq6uGx6d3HagX_rCtXthVxpILv1nIZucDAGkwTVhRwABFFazmCF68ocXwyKeQA8xCn8oKDcVn06BUvs5bWuBfhz2WBJ5MFS7JTg0imjglsSA3FwFnQUd7NIx37OXCYBKN1eUBgtAq0NmoA3iLAb_OxfW8tUYcsThxXAh2khGh4MtNMq7_2w1J7y5qycxGuaFx4qbE54Dq12Tb7k48xxqlerKPIbuAKpDj1CjEkHR8yVZNtiJSxlLfIw8lcZ3E61aCfXvENKnijqZxRxIInMOHHwjMg";
// Sample test record template
const createTestRecord = (
  id,
  patientId = "PT-001",
  facilityName = "Apollo Hospitals",
  createdAt = new Date().toISOString()
) => ({
  id: id,
  livwise_record_id: `LIVW_BLR_${new Date().toISOString().replace(/[:.]/g, "")}_${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
  facility_name: facilityName,
  branch_name: "Bengaluru",
  location_code: "Jayanagar",
  operator_details: {
    operator_id: "LIVW-OP-250610-G7B2",
    operator_name: "Dr. Jane Smith",
  },
  patient_details: {
    patient_id: patientId,
    patient_mrn: `MRN${Math.floor(Math.random() * 10000)}`,
    first_name: "John",
    last_name: "Doe",
    dob: "1985-03-15",
    gender: "Male",
    mobile: "919876543210",
    email: "john.doe@example.com",
    consent_to_store_health_info: true,
    address_1: "123 Wellness Way",
    address_2: "Apt 4B",
    address_city: "Bengaluru",
    address_state: "Karnataka",
    address_pincode: "560078",
  },
  observations: [
    {
      diagnostic_category: "Cardiovascular",
      diagnostic_code: "BPADULT",
      diagnostic_name: "Adult Blood Pressure",
      diagnostic_status: "success",
      test_duration_minutes: 5,
      observation_notes: "Patient was calm during measurement.",
      patient_vitals: [
        {
          vital_type: "systolic_mmhg",
          observed_value: 120,
          unit_of_measure: "mmHg",
        },
        {
          vital_type: "diastolic_mmhg",
          observed_value: 80,
          unit_of_measure: "mmHg",
        },
        {
          vital_type: "pulse_rate_bpm",
          observed_value: 72,
          unit_of_measure: "bpm",
        },
      ],
      raw_data: {
        device_readings: [120, 118, 122, 119, 121],
        measurement_timestamp: createdAt,
        device_calibration: "auto",
        measurement_duration: "300s",
      },
    },
  ],
  operator_notes: "Standard procedure followed.",
  created_at: createdAt,
});

// Get date strings for testing
const today = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];
const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];
const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];

// Comprehensive test cases
const testCases = {
  // Test 1: Sync with latitude and longitude
  syncWithLocation: {
    name: "[Location] Sync medical records with latitude/longitude",
    endpoint: `${API_BASE_URL}records`,
    method: "POST",
    data: {
      records: [createTestRecord("test-rec-001-location")],
      deviceId: "DEVICE-001-BLR",
      operatorId: "LIVW-OP-250610-G7B2",
      latitude: 12.9716,
      longitude: 77.5946,
    },
  },

  // Test 2: Sync without location (backward compatibility)
  syncWithoutLocation: {
    name: "[Backward Compatibility] Sync medical records without location",
    endpoint: `${API_BASE_URL}records`,
    method: "POST",
    data: {
      records: [createTestRecord("test-rec-002-no-location")],
      deviceId: "DEVICE-002-BLR",
      operatorId: "LIVW-OP-250610-G7B2",
    },
  },

  // Test 3: Batch sync with location for export testing
  batchSyncForExport: {
    name: "[Export Setup] Sync multiple records for export testing",
    endpoint: `${API_BASE_URL}records`,
    method: "POST",
    data: {
      records: [
        createTestRecord(
          "export-test-001",
          "PT-EXPORT-A",
          "Apollo Hospitals",
          `${yesterday}T10:30:00Z`
        ),
        createTestRecord(
          "export-test-002",
          "PT-EXPORT-B",
          "Manipal Hospitals",
          `${yesterday}T11:30:00Z`
        ),
        createTestRecord(
          "export-test-003",
          "PT-EXPORT-C",
          "Apollo Hospitals",
          `${yesterday}T12:30:00Z`
        ),
        createTestRecord(
          "export-test-004",
          "PT-EXPORT-D",
          "BGS Global",
          `${threeDaysAgo}T09:30:00Z`
        ),
        createTestRecord(
          "export-test-005",
          "PT-EXPORT-E",
          "Apollo Hospitals",
          `${threeDaysAgo}T14:30:00Z`
        ),
      ],
      deviceId: "DEVICE-EXPORT-TEST",
      operatorId: "LIVW-OP-250610-G7B2",
      latitude: 12.9345,
      longitude: 77.6094,
    },
  },

  // Test 4: Edge case - Zero coordinates
  syncWithZeroCoordinates: {
    name: "[Edge Case] Sync with zero latitude/longitude",
    endpoint: `${API_BASE_URL}records`,
    method: "POST",
    data: {
      records: [createTestRecord("test-rec-006-zero-coords")],
      deviceId: "DEVICE-004-BLR",
      operatorId: "LIVW-OP-250610-G7B2",
      latitude: 0,
      longitude: 0,
    },
  },

  // Test 5: Invalid coordinates (should fail validation)
  syncWithInvalidCoordinates: {
    name: "[Validation] Sync with invalid coordinates (should fail)",
    endpoint: `${API_BASE_URL}records`,
    method: "POST",
    expectFailure: true,
    data: {
      records: [createTestRecord("test-rec-007-invalid-coords")],
      deviceId: "DEVICE-005-BLR",
      operatorId: "LIVW-OP-250610-G7B2",
      latitude: 999, // Invalid latitude
      longitude: -999, // Invalid longitude
    },
  },

  // Test 6: Missing required fields
  syncMissingDeviceId: {
    name: "[Validation] Sync without deviceId (should fail)",
    endpoint: `${API_BASE_URL}records`,
    method: "POST",
    expectFailure: true,
    data: {
      records: [createTestRecord("test-rec-008-missing-device")],
      operatorId: "LIVW-OP-250610-G7B2",
      latitude: 12.9716,
      longitude: 77.5946,
    },
  },

  // Test 7: Empty records array
  syncEmptyRecords: {
    name: "[Validation] Sync with empty records array (should fail)",
    endpoint: `${API_BASE_URL}records`,
    method: "POST",
    expectFailure: true,
    data: {
      records: [],
      deviceId: "DEVICE-006-BLR",
      operatorId: "LIVW-OP-250610-G7B2",
      latitude: 12.9716,
      longitude: 77.5946,
    },
  },

  // Test 8: Get all records
  getAllRecords: {
    name: "[GET] Retrieve all medical records",
    endpoint: `${API_BASE_URL}records?limit=10`,
    method: "GET",
  },

  // Test 9: Get records with facility filter
  getRecordsByFacility: {
    name: "[GET] Retrieve records by facility",
    endpoint: `${API_BASE_URL}records?facilityName=Apollo Hospitals&limit=5`,
    method: "GET",
  },

  // Test 10: Authentication test (no token)
  testAuthRequired: {
    name: "[Auth] Verify authentication is required",
    endpoint: `${API_BASE_URL}records`,
    method: "GET",
    skipAuth: true,
    expectFailure: true,
  },

  // ============ EXPORT TESTS ============

  // Test 11: Export single date (yesterday)
  exportSingleDate: {
    name: "[Export] Export medical records for yesterday",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    data: {
      date: yesterday,
    },
  },

  // Test 12: Export date range
  exportDateRange: {
    name: "[Export] Export medical records for date range",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    data: {
      startDate: oneWeekAgo,
      endDate: yesterday,
    },
  },

  // Test 13: Export for specific facility
  exportByFacility: {
    name: "[Export] Export records for specific facility",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    data: {
      date: yesterday,
      facilityName: "Apollo Hospitals",
    },
  },

  // Test 14: Export with no parameters (should default to yesterday)
  exportDefault: {
    name: "[Export] Export with no parameters (default behavior)",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    data: {},
  },

  // Test 15: Export for today (should have no or few records)
  exportToday: {
    name: "[Export] Export records for today (likely empty)",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    data: {
      date: today,
    },
  },

  // Test 16: Export with invalid date format (should fail)
  exportInvalidDate: {
    name: "[Export Validation] Export with invalid date format (should fail)",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    expectFailure: true,
    data: {
      date: "invalid-date-format",
    },
  },

  // Test 17: Export with future date
  exportFutureDate: {
    name: "[Export Edge Case] Export for future date",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    data: {
      date: "2025-12-31",
    },
  },

  // Test 18: Export with invalid date range (end before start)
  exportInvalidDateRange: {
    name: "[Export Validation] Export with invalid date range (should fail)",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    expectFailure: true,
    data: {
      startDate: yesterday,
      endDate: oneWeekAgo, // End date before start date
    },
  },

  // Test 19: Export for non-existent facility
  exportNonExistentFacility: {
    name: "[Export Edge Case] Export for non-existent facility",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    data: {
      date: yesterday,
      facilityName: "Non-Existent Hospital",
    },
  },

  // Test 20: Export authentication test (no token)
  exportAuthRequired: {
    name: "[Export Auth] Verify export requires authentication",
    endpoint: `${API_BASE_URL}export`,
    method: "POST",
    skipAuth: true,
    expectFailure: true,
    data: {
      date: yesterday,
    },
  },
};

// Function to run a test case
async function runTestCase(testName, testConfig) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running test: ${testConfig.name || testName}`);
  console.log(`${"=".repeat(60)}`);

  try {
    const headers = {
      "Content-Type": "application/json",
    };

    // Add auth token unless explicitly skipped
    if (!testConfig.skipAuth) {
      if (!AUTH_TOKEN) {
        console.error("ERROR: No AUTH_TOKEN provided.");
        return {
          testName,
          status: "FAILED",
          error: "Missing authentication token",
        };
      }
      headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
    }

    const requestConfig = {
      method: testConfig.method,
      url: testConfig.endpoint,
      headers,
      data: testConfig.data,
      timeout: 60000, // 60 second timeout for export operations
    };

    console.log(`📡 Making ${testConfig.method} request to:`);
    console.log(`   ${testConfig.endpoint}`);

    if (testConfig.data) {
      console.log(`📦 Request payload preview:`);
      const preview = JSON.stringify(testConfig.data, null, 2);
      console.log(
        preview.length > 500
          ? preview.substring(0, 500) + "...\n   [truncated]"
          : preview
      );
    }

    const startTime = new Date();
    const response = await axios(requestConfig);
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    console.log(`✅ Response Status: ${response.status}`);
    console.log(`⏱️  Response Time: ${duration.toFixed(2)} seconds`);

    // Show response preview
    const responsePreview = JSON.stringify(response.data, null, 2);
    console.log(`📋 Response Data:`);
    console.log(
      responsePreview.length > 800
        ? responsePreview.substring(0, 800) + "...\n   [truncated]"
        : responsePreview
    );

    // Special handling for export responses
    if (testConfig.endpoint.includes("/export") && response.data) {
      const exportData = response.data;
      if (exportData.results) {
        console.log(`📊 Export Summary:`);
        console.log(
          `   Processed Dates: ${exportData.processedDates || "N/A"}`
        );
        console.log(
          `   Successful Exports: ${exportData.successfulExports || 0}`
        );
        console.log(`   Failed Exports: ${exportData.failedExports || 0}`);

        if (exportData.results.length > 0) {
          exportData.results.forEach((result, index) => {
            if (result.s3Location) {
              console.log(
                `   📁 Export ${index + 1}: ${result.recordsCount} records → ${result.s3Location}`
              );
            }
          });
        }
      }
    }

    // Check if we expected this test to fail
    if (testConfig.expectFailure) {
      console.log(`⚠️  WARNING: Expected this test to fail, but it succeeded!`);
    }

    return {
      testName,
      status: "PASSED",
      response: response.data,
      duration,
      statusCode: response.status,
    };
  } catch (error) {
    const isExpectedFailure = testConfig.expectFailure;
    const statusIcon = isExpectedFailure ? "✅" : "❌";
    const statusText = isExpectedFailure ? "EXPECTED FAILURE" : "FAILED";

    console.log(`${statusIcon} ${statusText}`);
    console.log(`📝 Error Details:`);

    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   Message: ${error.message}`);
    }

    return {
      testName,
      status: isExpectedFailure ? "EXPECTED_FAILURE" : "FAILED",
      error: error.response?.data || error.message,
      statusCode: error.response?.status || "Unknown",
      duration: 0,
    };
  }
}

// Run all tests
async function testRestApi() {
  console.log(`
🧪 LIVWW.AI REST API TEST Suite (with Export Testing)
=====================================================
📅 Started: ${new Date().toISOString()}
🔗 API Base URL: ${API_BASE_URL}
🔑 Auth Token: ${AUTH_TOKEN ? "Provided" : "Missing"}
📆 Test Dates:
   Today: ${today}
   Yesterday: ${yesterday} 
   3 Days Ago: ${threeDaysAgo}
   1 Week Ago: ${oneWeekAgo}
  `);

  const results = [];
  let passedTests = 0;
  let failedTests = 0;
  let expectedFailures = 0;

  // Run test cases one after another
  for (const [testName, testConfig] of Object.entries(testCases)) {
    const result = await runTestCase(testName, testConfig);
    results.push(result);

    if (result.status === "PASSED") {
      passedTests++;
    } else if (result.status === "EXPECTED_FAILURE") {
      expectedFailures++;
    } else {
      failedTests++;
    }

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Summary of results
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 TEST SUMMARY`);
  console.log(`${"=".repeat(60)}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`⚠️  Expected Failures: ${expectedFailures}`);
  console.log(`📈 Total: ${results.length}`);
  console.log(
    `📊 Success Rate: ${(((passedTests + expectedFailures) / results.length) * 100).toFixed(1)}%`
  );

  // Group results by category
  const syncTests = results.filter(
    (r) => r.testName.includes("sync") || r.testName.includes("batch")
  );
  const getTests = results.filter(
    (r) => r.testName.includes("get") || r.testName.includes("Auth")
  );
  const exportTests = results.filter(
    (r) => r.testName.includes("export") || r.testName.includes("Export")
  );

  console.log(`\n📋 Results by Category:`);
  console.log(
    `   🔄 Sync Tests: ${syncTests.filter((r) => r.status === "PASSED").length}/${syncTests.length} passed`
  );
  console.log(
    `   📖 GET Tests: ${getTests.filter((r) => r.status === "PASSED" || r.status === "EXPECTED_FAILURE").length}/${getTests.length} passed`
  );
  console.log(
    `   📦 Export Tests: ${exportTests.filter((r) => r.status === "PASSED" || r.status === "EXPECTED_FAILURE").length}/${exportTests.length} passed`
  );

  console.log(`\n📋 Detailed Results:`);
  results.forEach((result) => {
    const icon =
      result.status === "PASSED"
        ? "✅"
        : result.status === "EXPECTED_FAILURE"
          ? "⚠️"
          : "❌";
    const duration = result.duration ? ` (${result.duration.toFixed(2)}s)` : "";
    console.log(`   ${icon} ${result.testName}: ${result.status}${duration}`);

    if (result.status === "FAILED") {
      const errorMsg =
        typeof result.error === "string"
          ? result.error
          : JSON.stringify(result.error);
      console.log(
        `      Error: ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? "..." : ""}`
      );
    }
  });

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `rest-api-test-results-${timestamp}.json`;
  fs.writeFileSync(
    filename,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        apiBaseUrl: API_BASE_URL,
        testDates: {
          today,
          yesterday,
          threeDaysAgo,
          oneWeekAgo,
        },
        summary: {
          total: results.length,
          passed: passedTests,
          failed: failedTests,
          expectedFailures: expectedFailures,
          successRate:
            (((passedTests + expectedFailures) / results.length) * 100).toFixed(
              1
            ) + "%",
          categories: {
            sync: syncTests.length,
            get: getTests.length,
            export: exportTests.length,
          },
        },
        results: results,
      },
      null,
      2
    )
  );

  console.log(`\n💾 Results saved to: ${filename}`);
  console.log(`🏁 Test execution completed at ${new Date().toISOString()}`);
}

// Run the tests
testRestApi().catch((error) => {
  console.error("❌ Critical error during test execution:", error);
  process.exit(1);
});
