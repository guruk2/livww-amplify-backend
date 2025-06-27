const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const fs = require("fs");
const path = require("path");

// Load configuration from amplify_outputs.json
let USER_POOL_ID, CLIENT_ID, REGION;
try {
  const outputsPath = path.join(__dirname, "../../amplify_outputs.json");
  const outputs = JSON.parse(fs.readFileSync(outputsPath, "utf8"));
  USER_POOL_ID = outputs.auth.user_pool_id;
  CLIENT_ID = outputs.auth.user_pool_client_id;
  REGION = outputs.auth.aws_region || "ap-south-1";
  console.log(`Loaded configuration from amplify_outputs.json`);
} catch (error) {
  console.warn(
    `Could not load configuration from amplify_outputs.json: ${error.message}`
  );
  console.warn("Using fallback configuration. You should update these values.");
  USER_POOL_ID = "ap-south-1_VVfucA5C9";
  CLIENT_ID = "cg1tlfaivn5vqt7krnelvrgr1";
  REGION = "ap-south-1";
}

// User credentials - Update these with your actual user credentials
const USERNAME = "test@livww.ai";
const PASSWORD = "Test@09876";
const NEW_PASSWORD = "Test@098765"; // Must meet Cognito password policy

async function getJwtToken() {
  try {
    console.log("Authenticating with Cognito...");
    console.log(`User Pool ID: ${USER_POOL_ID}`);
    console.log(`Client ID: ${CLIENT_ID}`);
    console.log(`Region: ${REGION}`);

    const client = new CognitoIdentityProviderClient({ region: REGION });

    // Step 1: Initial authentication
    const authResponse = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: USERNAME,
          PASSWORD: PASSWORD,
        },
      })
    );

    // Check if password change is required
    if (authResponse.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      console.log("New password required. Responding to challenge...");

      // Step 2: Respond to the challenge with a new password
      const challengeResponse = await client.send(
        new RespondToAuthChallengeCommand({
          ChallengeName: "NEW_PASSWORD_REQUIRED",
          ClientId: CLIENT_ID,
          Session: authResponse.Session,
          ChallengeResponses: {
            USERNAME: USERNAME,
            NEW_PASSWORD: NEW_PASSWORD,
          },
        })
      );

      console.log("Password changed successfully!");

      // Return the tokens from the challenge response
      return {
        idToken: challengeResponse.AuthenticationResult.IdToken,
        accessToken: challengeResponse.AuthenticationResult.AccessToken,
        refreshToken: challengeResponse.AuthenticationResult.RefreshToken,
      };
    } else if (authResponse.AuthenticationResult) {
      // Normal login (no challenge)
      return {
        idToken: authResponse.AuthenticationResult.IdToken,
        accessToken: authResponse.AuthenticationResult.AccessToken,
        refreshToken: authResponse.AuthenticationResult.RefreshToken,
      };
    } else {
      throw new Error("No authentication result or challenge returned");
    }
  } catch (error) {
    console.error("Authentication failed:", error.message);
    throw error;
  }
}

// Run the function
getJwtToken()
  .then((tokens) => {
    console.log("Authentication successful");
    console.log(
      "ID Token (first 20 chars):",
      tokens.idToken.substring(0, 20) + "..."
    );

    // Save token to file for later use
    fs.writeFileSync(".auth_token", tokens.idToken);
    console.log("Token saved to .auth_token file");

    // Set environment variable commands
    console.log("\nSet token with one of these commands:");
    console.log("\nWindows CMD:");
    console.log(`set AUTH_TOKEN=${tokens.idToken}`);
    console.log("\nWindows PowerShell:");
    console.log(`$env:AUTH_TOKEN="${tokens.idToken}"`);
    console.log("\nLinux/macOS:");
    console.log(`export AUTH_TOKEN="${tokens.idToken}"`);

    // Print test command
    console.log("\nRun tests with:");
    console.log("node amplify/tests/test-rest-api.js");
  })
  .catch((error) => {
    console.error("Failed to get token:", error.message);
    console.log("\nPossible Solutions:");
    console.log("1. Check your USER_POOL_ID and CLIENT_ID values");
    console.log(
      "2. Ensure the USER_PASSWORD_AUTH flow is enabled for your app client"
    );
    console.log("3. Verify the username and password are correct");
    process.exit(1);
  });
