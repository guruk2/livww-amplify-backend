
import { Stack } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';

// Define a function that takes required resources and creates the API
export function createApi(params: {
  scope: Stack, 
  userPool: cognito.IUserPool,
  syncMedicalDataFunction: lambda.IFunction,
  getMedicalRecordsFunction: lambda.IFunction,
  getPatientDetailsFunction: lambda.IFunction
}) {
  const { scope, userPool, syncMedicalDataFunction, getMedicalRecordsFunction, getPatientDetailsFunction } = params;
  
  // Create a REST API using API Gateway
  const api = new apigw.RestApi(scope, 'MedicalRestApi', {
    restApiName: 'livwwApi',
    deployOptions: {
      stageName: 'api'
    },
    defaultCorsPreflightOptions: {
      allowOrigins: apigw.Cors.ALL_ORIGINS,
      allowMethods: apigw.Cors.ALL_METHODS
    }
  });

  // Create a Cognito authorizer for protected endpoints
  const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(scope, 'CognitoAuthorizer', {
    cognitoUserPools: [userPool]
  });

  // Define authorization options for protected endpoints
  const authorizationOptions = {
    authorizer: cognitoAuthorizer,
    authorizationType: apigw.AuthorizationType.COGNITO
  };

  // === MEDICAL RECORDS ENDPOINTS ===
  const recordsResource = api.root.addResource('records');

  // POST /records - Sync medical records (formerly GraphQL mutation)
  recordsResource.addMethod('POST', 
    new LambdaIntegration(syncMedicalDataFunction), 
    authorizationOptions
  );

  // GET /records - Get all medical records for authorized user
  recordsResource.addMethod('GET', 
    new LambdaIntegration(getMedicalRecordsFunction), 
    authorizationOptions
  );

  // GET /records/{id} - Get specific medical record
  const recordResource = recordsResource.addResource('{id}');
  recordResource.addMethod('GET', 
    new LambdaIntegration(getMedicalRecordsFunction), 
    authorizationOptions
  );

  // === PATIENT ENDPOINTS ===
  const patientsResource = api.root.addResource('patients');

  // GET /patients - Get all patients
  patientsResource.addMethod('GET', 
    new LambdaIntegration(getPatientDetailsFunction), 
    authorizationOptions
  );

  // GET /patients/{id} - Get patient by ID
  const patientResource = patientsResource.addResource('{id}');
  patientResource.addMethod('GET', 
    new LambdaIntegration(getPatientDetailsFunction), 
    authorizationOptions
  );

  // GET /patients/{id}/records - Get records for specific patient
  const patientRecordsResource = patientResource.addResource('records');
  patientRecordsResource.addMethod('GET', 
    new LambdaIntegration(getMedicalRecordsFunction), 
    authorizationOptions
  );

  return api;
}

// Export resource function (not direct API instance)
export const api = {
  resource: createApi
};
