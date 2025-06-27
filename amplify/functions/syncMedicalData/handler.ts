import { SyncEvent, LivwiseRecord } from '../common/models';
import { LivwiseRecordSchema, SyncEventSchema } from '../common/validation';
import { createSuccessResponse, createErrorResponse } from '../common/responses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface SyncResult {
  id: string;
  status: 'success' | 'error';
  synced_at?: string;
  message?: string;
}

interface SyncResponse {
  device_id: string;
  operator_id?: string;
  synced_at: string;
  total_records: number;
  successful_records: number;
  failed_records: number;
  results: SyncResult[];
  latitude?: number;
  longitude?: number;
}

const ddb = new DynamoDBClient({});
const ddbDoc = DynamoDBDocument.from(ddb, {
  marshallOptions: { removeUndefinedValues: true }
});
const s3 = new S3Client({});

export const handler = async (event: any) => {
  try {
    const body = event.body ? JSON.parse(event.body) : event;

    // Validate the entire sync request first
    const syncValidation = SyncEventSchema.safeParse(body);
    if (!syncValidation.success) {
      const msg = syncValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createErrorResponse(400, `Request validation failed: ${msg}`);
    }

    const { records, deviceId, operatorId, latitude, longitude } = syncValidation.data;

    const table = process.env.DYNAMODB_TABLE!;
    const bucket = process.env.S3_BUCKET!;
    const results: SyncResult[] = [];
    const now = new Date().toISOString();

    console.log(`Starting sync operation - Device: ${deviceId}, Records: ${records.length}, Latitude: ${latitude}, Longitude: ${longitude}`);

    for (const rec of records) {
      try {
        // Transform nested test_center and address to flat structure
        const r: any = transformRecord(rec);

        // Add top-level fields for GSI queries
        r.patientId = r.patient_details.patient_id;
        r.operatorId = r.operator_details.operator_id;

        // Process patient photo if present
        if (r.patient_details?.patient_photo_blob) {
          try {
            const photoUrl = await uploadPatientPhoto(
              bucket,
              r.patient_details.patient_photo_blob,
              r.patient_details,
              operatorId || r.operator_details.operator_id,
              now
            );
            r.patient_details.patient_photo = photoUrl;
            delete r.patient_details.patient_photo_blob; // Remove blob data
            console.log(`Uploaded patient photo for ${r.patient_details.patient_id}`);
          } catch (photoError) {
            console.error(`Failed to upload patient photo for ${r.patient_details.patient_id}:`, photoError);
            // Continue processing but log the error
          }
        }

        // Validate individual record against schema
        const v = LivwiseRecordSchema.safeParse(r);
        if (!v.success) {
          const msg = v.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
          throw new Error(`Validation failed: ${msg}`);
        }

        const item = v.data;

        // Enhanced sync_metadata with location data and device info
        item.sync_metadata = {
          device_id: deviceId,
          operator_id: operatorId,
          synced_at: now,
          sync_status: 'SYNCED',
          latitude: latitude,
          longitude: longitude
        };

        // Process and upload raw_data files to S3 if present
        for (let i = 0; i < item.observations.length; i++) {
          const o = item.observations[i];

          if (o.raw_data && Array.isArray(o.raw_data)) {
            const uploadedFiles: string[] = [];

            for (let j = 0; j < o.raw_data.length; j++) {
              const rawItem = o.raw_data[j];

              try {
                const fileUrl = await uploadRawDataFile(
                  bucket,
                  rawItem,
                  item.patient_details,
                  operatorId || item.operator_details.operator_id,
                  o.diagnostic_code,
                  o.diagnostic_name,
                  now,
                  j
                );
                uploadedFiles.push(fileUrl);
                console.log(`Uploaded raw data file ${j} for observation ${i}, record ${item.id}`);
              } catch (fileError) {
                console.error(`Failed to upload raw data file ${j} for observation ${i}:`, fileError);
                // Continue with other files
              }
            }

            // Replace raw_data with S3 URLs
            if (uploadedFiles.length > 0) {
              o.s3_object_url = uploadedFiles.join(','); // Multiple URLs separated by comma
            }
            delete o.raw_data; // Remove raw data to keep DynamoDB item size manageable
          }
          // Handle legacy raw_data format (JSON object)
          else if (o.raw_data && typeof o.raw_data === 'object') {
            try {
              const key = `records/${item.id}/obs/${i}/${now}.json`;
              await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: JSON.stringify(o.raw_data),
                ContentType: 'application/json',
                Metadata: {
                  'record-id': item.id,
                  'observation-index': i.toString(),
                  'device-id': deviceId,
                  'sync-timestamp': now
                }
              }));

              o.s3_object_url = `s3://${bucket}/${key}`;
              delete o.raw_data;

              console.log(`Uploaded legacy raw data for record ${item.id}, observation ${i} to S3`);
            } catch (s3Error) {
              console.error(`Failed to upload legacy raw data for record ${item.id}, observation ${i}:`, s3Error);
              o.s3_object_url = undefined;
            }
          }
        }

        // Set TTL for automatic deletion after 7 years (2555 days)
        const ttlDays = 2555;
        item.ttl = Math.floor(Date.now() / 1000) + (ttlDays * 24 * 60 * 60);

        // Save to DynamoDB
        await ddbDoc.put({
          TableName: table,
          Item: item,
          ConditionExpression: 'attribute_not_exists(id) OR sync_metadata.sync_status <> :synced',
          ExpressionAttributeValues: {
            ':synced': 'SYNCED'
          }
        });

        results.push({
          id: item.id,
          status: 'success',
          synced_at: now
        });

        console.log(`Successfully processed record: ${item.id}`);

      } catch (err: any) {
        console.error(`Error processing record ${rec.id || 'unknown'}:`, err);
        results.push({
          id: rec.id || 'unknown',
          status: 'error',
          message: err.message
        });
      }
    }

    // Create properly typed response object
    const response: SyncResponse = {
      device_id: deviceId,
      operator_id: operatorId,
      synced_at: now,
      total_records: records.length,
      successful_records: results.filter(r => r.status === 'success').length,
      failed_records: results.filter(r => r.status === 'error').length,
      results
    };

    // Add location data if provided
    if (latitude !== undefined) {
      response.latitude = latitude;
    }
    if (longitude !== undefined) {
      response.longitude = longitude;
    }

    console.log(`Sync operation completed - Success: ${response.successful_records}, Failed: ${response.failed_records}`);

    return createSuccessResponse(response);

  } catch (err: any) {
    console.error('Critical error in sync handler:', err);
    return createErrorResponse(500, err.message);
  }
};

/**
 * Uploads patient photo to S3
 */
async function uploadPatientPhoto(
  bucket: string,
  photoBlob: string,
  patientDetails: any,
  operatorId: string,
  timestamp: string
): Promise<string> {
  // Decode base64 data
  const base64Data = photoBlob.replace(/^data:image\/[a-z]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Determine file extension from MIME type or default to jpg
  const mimeMatch = photoBlob.match(/^data:image\/([a-z]+);base64,/);
  const extension = mimeMatch ? mimeMatch[1] : 'jpg';

  // Generate safe filename
  const safePatientName = sanitizeFileName(`${patientDetails.first_name}_${patientDetails.last_name}`);
  const filename = `${safePatientName}_${patientDetails.patient_id}_${operatorId}_${timestamp.replace(/[:.]/g, '-')}.${extension}`;

  const key = `medical-records/patient_image/${filename}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: `image/${extension}`,
    Metadata: {
      'patient-id': patientDetails.patient_id,
      'patient-name': `${patientDetails.first_name} ${patientDetails.last_name}`,
      'operator-id': operatorId,
      'upload-timestamp': timestamp,
      'file-type': 'patient-photo'
    }
  }));

  return `s3://${bucket}/${key}`;
}

/**
 * Uploads raw data file to S3
 */
async function uploadRawDataFile(
  bucket: string,
  rawItem: any,
  patientDetails: any,
  operatorId: string,
  diagnosticCode: string,
  diagnosticName: string,
  timestamp: string,
  fileIndex: number
): Promise<string> {
  // Decode base64 data
  const buffer = Buffer.from(rawItem.data, 'base64');

  // Generate safe filename components
  const safePatientName = sanitizeFileName(`${patientDetails.first_name}_${patientDetails.last_name}`);
  const safeDiagnosticCode = sanitizeFileName(diagnosticCode);
  const safeDiagnosticName = sanitizeFileName(diagnosticName);
  const safeTimestamp = timestamp.replace(/[:.]/g, '-');

  // Create filename with all required components
  const filename = `${safePatientName}_${patientDetails.patient_id}_${operatorId}_${safeDiagnosticCode}_${safeDiagnosticName}_${safeTimestamp}_${fileIndex}.${rawItem.raw_format}`;

  const key = `medical-records/patient_test_images/${filename}`;

  // Determine content type based on format
  const contentType = getContentType(rawItem.raw_format);

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: {
      'patient-id': patientDetails.patient_id,
      'patient-name': `${patientDetails.first_name} ${patientDetails.last_name}`,
      'operator-id': operatorId,
      'diagnostic-code': diagnosticCode,
      'diagnostic-name': diagnosticName,
      'raw-format': rawItem.raw_format,
      'raw-size': rawItem.raw_size.toString(),
      'file-index': fileIndex.toString(),
      'upload-timestamp': timestamp,
      'file-type': 'raw-data',
      'original-filename': rawItem.filename || 'unknown'
    }
  }));

  return `s3://${bucket}/${key}`;
}

/**
 * Sanitizes filename for S3 storage
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid characters with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .toLowerCase();
}

/**
 * Gets content type based on file format
 */
function getContentType(format: string): string {
  const contentTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'mp4': 'video/mp4',
    'avi': 'video/avi',
    'mov': 'video/quicktime',
    'pdf': 'application/pdf',
    'json': 'application/json',
    'xml': 'application/xml'
  };

  return contentTypes[format.toLowerCase()] || 'application/octet-stream';
}

/**
 * Transforms nested record structure to flat structure for DynamoDB storage
 */
function transformRecord(r: any): LivwiseRecord {
  const out: any = { ...r };

  // Flatten test_center structure
  if (r.test_center) {
    out.facility_name = r.test_center.facility_name;
    out.branch_name = r.test_center.branch_name;
    out.location_code = r.test_center.location_code;
    delete out.test_center;
  }

  // Flatten patient address structure
  if (r.patient_details?.address) {
    const a = r.patient_details.address;
    out.patient_details = {
      ...r.patient_details,
      address_1: a.address_1,
      address_2: a.address_2,
      address_city: a.address_city,
      address_state: a.address_state,
      address_pincode: a.address_pincode
    };
    delete out.patient_details.address;
  }

  // Transform observations structure
  if (r.observations) {
    out.observations = Array.isArray(r.observations)
      ? r.observations.map(transformObs)
      : [transformObs(r.observations)];
  }

  return out;
}

/**
 * Transforms individual observation structure
 */
function transformObs(o: any) {
  return {
    ...o,
    // Flatten diagnostics structure if present
    ...(o.diagnostics ? {
      diagnostic_category: o.diagnostics.diagnostic_category,
      diagnostic_code: o.diagnostics.diagnostic_code,
      diagnostic_name: o.diagnostics.diagnostic_name
    } : {}),
    s3_object_url: o.s3_object_url || undefined
  };
}
