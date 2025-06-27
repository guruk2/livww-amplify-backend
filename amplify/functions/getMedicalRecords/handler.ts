// amplify/functions/getMedicalRecords/handler.ts
import { createSuccessResponse, createErrorResponse } from '../common/responses';
import { DynamoDBClient, ScanCommandInput, QueryCommandInput } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocument.from(ddbClient);

export const handler = async (event: any) => {
  try {
    const tableName = process.env.DYNAMODB_TABLE;
    if (!tableName) {
      return createErrorResponse(500, 'Missing environment configuration');
    }

    // Handle single record request
    if (event.pathParameters?.id && !event.path.includes('/patients/')) {
      const result = await ddbDocClient.get({
        TableName: tableName,
        Key: { id: event.pathParameters.id }
      });
      return result.Item 
        ? createSuccessResponse(result.Item)
        : createErrorResponse(404, 'Record not found');
    }

    // Handle patient records request
    if (event.pathParameters?.id && event.path.includes('/patients/')) {
      const queryParams: QueryCommandInput = {
        TableName: tableName,
        IndexName: 'patient-id-index',
        KeyConditionExpression: 'patientId = :patientId',
        ExpressionAttributeValues: {
          ':patientId': event.pathParameters.id
        }
      };
      
      const result = await ddbDocClient.query(queryParams);
      return createSuccessResponse(result.Items || []);
    }

    // Handle general records query
    const scanParams: ScanCommandInput = {
      TableName: tableName,
      Limit: event.queryStringParameters?.limit 
        ? parseInt(event.queryStringParameters.limit)
        : 50,
      ExclusiveStartKey: event.queryStringParameters?.nextToken
        ? JSON.parse(Buffer.from(event.queryStringParameters.nextToken, 'base64').toString())
        : undefined
    };

    if (event.queryStringParameters?.facilityName) {
      scanParams.FilterExpression = 'facility_name = :facilityName';
      scanParams.ExpressionAttributeValues = {
        ':facilityName': event.queryStringParameters.facilityName
      };
    }

    if (event.queryStringParameters?.startDate && event.queryStringParameters?.endDate) {
      const filter = 'created_at BETWEEN :startDate AND :endDate';
      scanParams.FilterExpression = scanParams.FilterExpression
        ? `${scanParams.FilterExpression} AND ${filter}`
        : filter;
      scanParams.ExpressionAttributeValues = {
        ...scanParams.ExpressionAttributeValues,
        ':startDate': event.queryStringParameters.startDate,
        ':endDate': event.queryStringParameters.endDate
      };
    }

    const result = await ddbDocClient.scan(scanParams);
    return createSuccessResponse({
      records: result.Items || [],
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
      count: result.Items?.length || 0,
      scannedCount: result.ScannedCount || 0
    });

  } catch (error) {
    console.error('Error retrieving records:', error);
    return createErrorResponse(500, 
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};