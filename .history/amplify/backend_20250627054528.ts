import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';

// Import configuration (create these files as provided in previous answer)
import { getEnvironmentConfig } from './.config/environment';
import { ResourceNaming } from './utils/naming';

// Import resources
import { auth } from './auth/resource';
import { storage } from './storage/resource';
import { syncMedicalData } from './functions/syncMedicalData/resource';
import { getMedicalRecords } from './functions/getMedicalRecords/resource';
import { getPatientDetails } from './functions/getPatientDetails/resource';
import { exportDailyRecords } from './functions/exportDailyRecords/resource';

// Get environment configuration
const envConfig = getEnvironmentConfig();
const naming = new ResourceNaming(envConfig);

console.log(`🚀 Deploying LivWW Backend to ${envConfig.stage.toUpperCase()} environment`);

// Define backend first without API to prevent circular dependencies
const backend = defineBackend({
  auth,
  storage,
  syncMedicalData,
  getMedicalRecords,
  getPatientDetails,
  exportDailyRecords
});

// Access the underlying CDK Stack for the functions
const functionStack = Stack.of(backend.syncMedicalData.resources.lambda);

// Use tags instead of trying to set stackName
cdk.Tags.of(functionStack).add('Environment', envConfig.stage);
cdk.Tags.of(functionStack).add('Project', 'LivWW-AI');
cdk.Tags.of(functionStack).add('Version', envConfig.app.version);
cdk.Tags.of(functionStack).add('ManagedBy', 'AWS-Amplify');
cdk.Tags.of(functionStack).add('StackType', naming.stack('livww-backend'));

// ==================== DYNAMODB TABLES ====================

// Create a DynamoDB table for medical records
const medicalRecordsTable = new dynamodb.Table(functionStack, 'MedicalRecordsTable', {
  tableName: naming.table('medical-records'),
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: envConfig.resources.dynamodb.billingMode,
  timeToLiveAttribute: 'ttl',
  removalPolicy: envConfig.resources.dynamodb.removalPolicy,
  pointInTimeRecovery: envConfig.resources.dynamodb.pointInTimeRecovery,
  stream: envConfig.stage === 'production' ? dynamodb.StreamViewType.NEW_AND_OLD_IMAGES : undefined
});

// Add secondary indexes for queries with top-level attributes
medicalRecordsTable.addGlobalSecondaryIndex({
  indexName: 'patient-id-index',
  partitionKey: { name: 'patientId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING }
});

medicalRecordsTable.addGlobalSecondaryIndex({
  indexName: 'facility-date-index',
  partitionKey: { name: 'facility_name', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING }
});

medicalRecordsTable.addGlobalSecondaryIndex({
  indexName: 'operator-id-index',
  partitionKey: { name: 'operatorId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING }
});

// Create a DynamoDB table for idempotency
const idempotencyTable = new dynamodb.Table(functionStack, 'IdempotencyTable', {
  tableName: naming.table('idempotency'),
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: envConfig.resources.dynamodb.billingMode,
  timeToLiveAttribute: 'expiration',
  removalPolicy: envConfig.resources.dynamodb.removalPolicy,
});

// ==================== S3 BUCKETS ====================

// Create an S3 bucket for medical data
const medicalDataBucket = new s3.Bucket(functionStack, 'MedicalDataBucket', {
  bucketName: naming.bucket('medical-data'),
  versioned: envConfig.resources.s3.versioned,
  lifecycleRules: [
    {
      id: 'MedicalDataLifecycle',
      expiration: cdk.Duration.days(envConfig.resources.s3.lifecycleRules.expirationDays),
      transitions: envConfig.resources.s3.lifecycleRules.transitionToIA ? [
        {
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(envConfig.resources.s3.lifecycleRules.transitionToIA)
        },
        ...(envConfig.resources.s3.lifecycleRules.transitionToGlacier ? [{
          storageClass: s3.StorageClass.GLACIER,
          transitionAfter: cdk.Duration.days(envConfig.resources.s3.lifecycleRules.transitionToGlacier)
        }] : [])
      ] : []
    }
  ],
  removalPolicy: envConfig.resources.s3.removalPolicy,
  autoDeleteObjects: envConfig.resources.s3.autoDeleteObjects,
  serverAccessLogsPrefix: 'access-logs/',
  enforceSSL: true
});

// Create export S3 bucket for daily exports
const exportBucket = new s3.Bucket(functionStack, 'DailyExportBucket', {
  bucketName: naming.bucket('daily-exports'),
  versioned: envConfig.resources.s3.versioned,
  lifecycleRules: [
    {
      id: 'ExportDataLifecycle',
      expiration: cdk.Duration.days(envConfig.resources.s3.lifecycleRules.expirationDays),
      transitions: envConfig.resources.s3.lifecycleRules.transitionToIA ? [
        {
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(envConfig.resources.s3.lifecycleRules.transitionToIA)
        }
      ] : []
    }
  ],
  removalPolicy: envConfig.resources.s3.removalPolicy,
  autoDeleteObjects: envConfig.resources.s3.autoDeleteObjects,
  enforceSSL: true
});

// ==================== MESSAGING & MONITORING ====================

// Create a Dead-Letter Queue
const syncDlq = new sqs.Queue(functionStack, 'SyncDLQ', {
  queueName: naming.resource('sync-dlq'),
  removalPolicy: envConfig.resources.dynamodb.removalPolicy
});

// Create an SNS Topic for alerts
const alertTopic = new sns.Topic(functionStack, 'AlertTopic', {
  topicName: naming.resource('alerts'),
});

// ==================== SCHEDULED EVENTS ====================

// Create scheduled export rule (daily at 2 AM UTC)
const dailyExportRule = new events.Rule(functionStack, 'DailyExportSchedule', {
  ruleName: naming.resource('daily-export-schedule'),
  schedule: events.Schedule.cron({
    minute: '0',
    hour: '2',
    day: '*',
    month: '*',
    year: '*'
  }),
  description: `Daily medical records export for ${envConfig.stage} environment`
});

// Add Lambda target to the rule
dailyExportRule.addTarget(new targets.LambdaFunction(backend.exportDailyRecords.resources.lambda));

// ==================== PERMISSIONS ====================

// Grant permissions to Lambda functions
medicalRecordsTable.grantReadWriteData(backend.syncMedicalData.resources.lambda);
idempotencyTable.grantReadWriteData(backend.syncMedicalData.resources.lambda);
medicalDataBucket.grantReadWrite(backend.syncMedicalData.resources.lambda);

// Read-only permissions for GET functions
medicalRecordsTable.grantReadData(backend.getMedicalRecords.resources.lambda);
medicalRecordsTable.grantReadData(backend.getPatientDetails.resources.lambda);

// Export function permissions
medicalRecordsTable.grantReadData(backend.exportDailyRecords.resources.lambda);
exportBucket.grantReadWrite(backend.exportDailyRecords.resources.lambda);

// ==================== ENVIRONMENT VARIABLES ====================

// Update Lambda functions with environment-specific settings
const lambdaFunctions = [
  backend.syncMedicalData,
  backend.getMedicalRecords,
  backend.getPatientDetails,
  backend.exportDailyRecords
];

const functionNames = ['sync-medical-data', 'get-medical-records', 'get-patient-details', 'export-daily-records'];

lambdaFunctions.forEach((func, index) => {
  const functionName = functionNames[index];

  // Set environment variables
  func.addEnvironment('ENVIRONMENT', envConfig.stage);
  func.addEnvironment('LOG_LEVEL', envConfig.stage === 'production' ? 'INFO' : 'DEBUG');
  func.addEnvironment('REGION', envConfig.env.region);

  // Configure log retention
  new logs.LogGroup(functionStack, `${functionName}LogGroup`, {
    logGroupName: `/aws/lambda/${naming.function(functionName)}`,
    retention: logs.RetentionDays.ONE_MONTH,
    removalPolicy: envConfig.resources.dynamodb.removalPolicy
  });
});

// Set environment variables for functions
backend.syncMedicalData.addEnvironment('DYNAMODB_TABLE', medicalRecordsTable.tableName);
backend.syncMedicalData.addEnvironment('S3_BUCKET', medicalDataBucket.bucketName);
backend.syncMedicalData.addEnvironment('IDEMPOTENCY_TABLE', idempotencyTable.tableName);

backend.getMedicalRecords.addEnvironment('DYNAMODB_TABLE', medicalRecordsTable.tableName);
backend.getPatientDetails.addEnvironment('DYNAMODB_TABLE', medicalRecordsTable.tableName);

// Export function environment variables
backend.exportDailyRecords.addEnvironment('DYNAMODB_TABLE', medicalRecordsTable.tableName);
backend.exportDailyRecords.addEnvironment('EXPORT_S3_BUCKET', exportBucket.bucketName);

// ==================== API GATEWAY ====================

// Create API Gateway in the function stack to avoid circular dependencies
const api = new apigw.RestApi(functionStack, 'MedicalRestApi', {
  restApiName: naming.api('livww-medical'),
  description: `LivWW Medical Records API - ${envConfig.stage}`,
  deployOptions: {
    stageName: 'api',
    description: `${envConfig.stage} deployment`,
    metricsEnabled: envConfig.resources.monitoring.enableDetailedMetrics,
    dataTraceEnabled: envConfig.stage !== 'production',
    tracingEnabled: true
  },
  defaultCorsPreflightOptions: {
    allowOrigins: apigw.Cors.ALL_ORIGINS,
    allowMethods: apigw.Cors.ALL_METHODS,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token']
  }
});

// Create Cognito authorizer
const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(functionStack, 'CognitoAuthorizer', {
  authorizerName: naming.resource('cognito-authorizer'),
  cognitoUserPools: [backend.auth.resources.userPool]
});

const authorizationOptions = {
  authorizer: cognitoAuthorizer,
  authorizationType: apigw.AuthorizationType.COGNITO
};

// Define API endpoints
const recordsResource = api.root.addResource('records');
recordsResource.addMethod('POST',
  new apigw.LambdaIntegration(backend.syncMedicalData.resources.lambda, {
    requestTemplates: {
      'application/json': '{"statusCode": 200}'
    }
  }),
  authorizationOptions
);

recordsResource.addMethod('GET',
  new apigw.LambdaIntegration(backend.getMedicalRecords.resources.lambda),
  authorizationOptions
);

const recordResource = recordsResource.addResource('{id}');
recordResource.addMethod('GET',
  new apigw.LambdaIntegration(backend.getMedicalRecords.resources.lambda),
  authorizationOptions
);

const patientsResource = api.root.addResource('patients');
patientsResource.addMethod('GET',
  new apigw.LambdaIntegration(backend.getPatientDetails.resources.lambda),
  authorizationOptions
);

const patientResource = patientsResource.addResource('{id}');
patientResource.addMethod('GET',
  new apigw.LambdaIntegration(backend.getPatientDetails.resources.lambda),
  authorizationOptions
);

const patientRecordsResource = patientResource.addResource('records');
patientRecordsResource.addMethod('GET',
  new apigw.LambdaIntegration(backend.getMedicalRecords.resources.lambda),
  authorizationOptions
);

// Add export endpoint for manual exports
const exportResource = api.root.addResource('export');
exportResource.addMethod('POST',
  new apigw.LambdaIntegration(backend.exportDailyRecords.resources.lambda),
  authorizationOptions
);

// ==================== MONITORING & ALARMS ====================

// Set up monitoring and alarms
const lambdaErrorAlarm = new cloudwatch.Alarm(functionStack, 'SyncLambdaErrorAlarm', {
  alarmName: naming.alarm('sync-lambda-errors'),
  metric: backend.syncMedicalData.resources.lambda.metricErrors({
    period: cdk.Duration.minutes(5)
  }),
  threshold: envConfig.resources.monitoring.alarmThreshold.errorCount,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  alarmDescription: `High error rate for syncMedicalData Lambda in ${envConfig.stage}`,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
});

lambdaErrorAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

// Add export function monitoring
const exportErrorAlarm = new cloudwatch.Alarm(functionStack, 'ExportLambdaErrorAlarm', {
  alarmName: naming.alarm('export-lambda-errors'),
  metric: backend.exportDailyRecords.resources.lambda.metricErrors({
    period: cdk.Duration.minutes(5)
  }),
  threshold: envConfig.resources.monitoring.alarmThreshold.errorCount,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  alarmDescription: `High error rate for exportDailyRecords Lambda in ${envConfig.stage}`,
});

exportErrorAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

// Correct API Gateway metrics usage
const apiErrorAlarm = new cloudwatch.Alarm(functionStack, 'ApiGatewayErrorAlarm', {
  alarmName: naming.alarm('api-gateway-errors'),
  // Use proper API Gateway metrics method with correct parameters
  metric: api.metric('4XXError', {
    period: cdk.Duration.minutes(5),
    statistic: 'Sum'
  }),
  threshold: envConfig.resources.monitoring.alarmThreshold.errorCount,
  evaluationPeriods: 2,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  alarmDescription: `High 4XX error rate for API Gateway in ${envConfig.stage}`,
});

apiErrorAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

// ==================== OUTPUTS ====================

// Export important resource identifiers
backend.addOutput({
  custom: {
    Environment: envConfig.stage,
    MedicalRecordsTableName: medicalRecordsTable.tableName,
    MedicalDataBucketName: medicalDataBucket.bucketName,
    ExportBucketName: exportBucket.bucketName,
    ApiEndpoint: api.url,
    Region: functionStack.region,
    AlertTopicArn: alertTopic.topicArn,
    StackName: functionStack.stackName // Read the actual stack name
  }
});

console.log(`✅ ${envConfig.stage.toUpperCase()} backend configuration complete`);
console.log(`📋 Stack Name: ${functionStack.stackName}`); // Read the actual stack name
console.log(`🗃️  DynamoDB Table: ${medicalRecordsTable.tableName}`);
console.log(`🪣 Medical Data Bucket: ${medicalDataBucket.bucketName}`);
console.log(`🪣 Export Bucket: ${exportBucket.bucketName}`);
console.log(`🚀 API Endpoint: ${api.url}`);

export default backend;