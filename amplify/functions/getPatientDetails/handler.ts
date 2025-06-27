// amplify/functions/getPatientDetails/handler.ts
import { createSuccessResponse, createErrorResponse } from '../common/responses';
import { DynamoDBClient, ScanCommandInput, QueryCommandInput } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const doc = DynamoDBDocument.from(client);

export const handler = async (event: any) => {
  try {
    const table = process.env.DYNAMODB_TABLE!;
    console.log('GetPatientDetails event:', JSON.stringify(event)); // Add logging

    // Handle single patient request
    if (event.pathParameters?.id) {
      const patientId = event.pathParameters.id;
      console.log(`Querying for patientId: ${patientId}`);

      const q: QueryCommandInput = {
        TableName: table,
        IndexName: 'patient-id-index',
        // **FIX: Use the correct flat attribute name and ExpressionAttributeNames**
        KeyConditionExpression: '#pk = :id', 
        ExpressionAttributeNames: { '#pk': 'patientId' }, // Use 'patientId' as defined in backend.ts GSI
        ExpressionAttributeValues: { ':id': patientId },
        Limit: 1
      };

      console.log('Query Params:', JSON.stringify(q)); // Log query params
      const r = await doc.query(q);
      console.log('Query Result:', JSON.stringify(r)); // Log query result

      if (!r.Items?.length) {
        console.log(`Patient not found for ID: ${patientId}`);
        return createErrorResponse(404, 'Patient not found');
      }
      
      console.log(`Patient found: ${patientId}`);
      // Ensure patient_details exists before returning
      if (!r.Items[0].patient_details) {
          console.error(`Record found for patient ${patientId}, but missing patient_details field.`);
          return createErrorResponse(500, 'Internal data inconsistency: patient details missing.');
      }
      return createSuccessResponse(r.Items[0].patient_details);
    }

    // Handle list all patients request
    console.log('Scanning for all patients...');
    const params: ScanCommandInput = { 
        TableName: table, 
        ProjectionExpression: 'patient_details, patientId' // Include patientId to ensure uniqueness check works
    }; 
    const out = await doc.scan(params);
    const seen = new Set<string>();
    const list: any[] = [];
    out.Items?.forEach(i => {
      const p = i.patient_details;
      // Use the top-level patientId for uniqueness check if available, otherwise fallback
      const uniquePatientId = i.patientId || p?.patient_id; 
      if (p && uniquePatientId && !seen.has(uniquePatientId)) {
        list.push(p);
        seen.add(uniquePatientId);
      }
    });
    console.log(`Found ${list.length} unique patients.`);
    return createSuccessResponse({ patients: list, count: list.length });

  } catch (e: any) {
    console.error('Error in getPatientDetails:', e);
    return createErrorResponse(500, e.message || 'Internal Server Error');
  }
};
