import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createSuccessResponse, createErrorResponse } from '../common/responses';

// Define proper TypeScript interfaces
interface ExportEvent {
  date?: string; // Format: YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  facilityName?: string;
}

interface DailyRecordsSummary {
  date: string;
  totalRecords: number;
  facilitiesCount: number;
  operatorsCount: number;
  patientsCount: number;
  testCategoriesCount: number;
  recordsByFacility: Record<string, number>;
  recordsByCategory: Record<string, number>;
}

// Define export result types
interface ExportResultSuccess {
  date: string;
  recordsCount: number;
  s3Location: string;
  summary: DailyRecordsSummary;
}

interface ExportResultError {
  date: string;
  status: 'error';
  error: string;
}

// Union type for export results
type ExportResult = ExportResultSuccess | ExportResultError;

const ddb = new DynamoDBClient({});
const ddbDoc = DynamoDBDocument.from(ddb, { 
  marshallOptions: { removeUndefinedValues: true } 
});
const s3 = new S3Client({});

export const handler = async (event: any) => {
  try {
    console.log('Export daily records event:', JSON.stringify(event));
    
    const body = event.body ? JSON.parse(event.body) : event;
    const { date, startDate, endDate, facilityName }: ExportEvent = body;
    
    const table = process.env.DYNAMODB_TABLE!;
    const exportBucket = process.env.EXPORT_S3_BUCKET!;
    
    // Determine date range
    const dateRange = determineDateRange(date, startDate, endDate);
    console.log('Processing date range:', dateRange);
    
    // Properly typed export results array
    const exportResults: ExportResult[] = [];
    
    for (const targetDate of dateRange) {
      try {
        // Query records for the specific date
        const records = await getRecordsForDate(table, targetDate, facilityName);
        
        if (records.length === 0) {
          console.log(`No records found for date: ${targetDate}`);
          continue;
        }
        
        // Group records by facility and create daily export
        const dailyExport = createDailyExport(targetDate, records);
        
        // Upload to S3
        const s3Key = generateS3Key(targetDate, facilityName);
        await uploadToS3(exportBucket, s3Key, dailyExport);
        
        // Create summary
        const summary = createDailySummary(targetDate, records);
        
        // Push success result with proper typing
        exportResults.push({
          date: targetDate,
          recordsCount: records.length,
          s3Location: `s3://${exportBucket}/${s3Key}`,
          summary
        });
        
        console.log(`Successfully exported ${records.length} records for ${targetDate}`);
        
      } catch (dateError: any) {
        console.error(`Error processing date ${targetDate}:`, dateError);
        // Push error result with proper typing
        exportResults.push({
          date: targetDate,
          status: 'error',
          error: dateError.message
        });
      }
    }
    
    return createSuccessResponse({
      message: 'Daily export completed',
      processedDates: dateRange.length,
      successfulExports: exportResults.filter((r): r is ExportResultSuccess => !('error' in r)).length,
      failedExports: exportResults.filter((r): r is ExportResultError => 'error' in r).length,
      results: exportResults
    });
    
  } catch (error: any) {
    console.error('Critical error in daily export:', error);
    return createErrorResponse(500, error.message);
  }
};

/**
 * Determines the date range to process
 */
function determineDateRange(date?: string, startDate?: string, endDate?: string): string[] {
  if (date) {
    return [date];
  }
  
  if (startDate && endDate) {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }
  
  // Default: yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return [yesterday.toISOString().split('T')[0]];
}

/**
 * Queries DynamoDB for records on a specific date
 */
async function getRecordsForDate(table: string, date: string, facilityName?: string): Promise<any[]> {
  const startDateTime = `${date}T00:00:00Z`;
  const endDateTime = `${date}T23:59:59Z`;
  
  const scanParams: any = {
    TableName: table,
    FilterExpression: 'created_at BETWEEN :startDate AND :endDate',
    ExpressionAttributeValues: {
      ':startDate': startDateTime,
      ':endDate': endDateTime
    }
  };
  
  // Add facility filter if specified
  if (facilityName) {
    scanParams.FilterExpression += ' AND facility_name = :facilityName';
    scanParams.ExpressionAttributeValues[':facilityName'] = facilityName;
  }
  
  const records: any[] = [];
  let lastEvaluatedKey;
  
  do {
    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }
    
    const result = await ddbDoc.scan(scanParams);
    
    if (result.Items) {
      records.push(...result.Items);
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  return records;
}

/**
 * Creates a structured daily export object
 */
function createDailyExport(date: string, records: any[]): any {
  // Group records by facility
  const recordsByFacility = records.reduce((acc, record) => {
    const facility = record.facility_name || 'Unknown';
    if (!acc[facility]) {
      acc[facility] = [];
    }
    acc[facility].push(record);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Group records by test category
  const recordsByCategory = records.reduce((acc, record) => {
    const category = record.observations?.[0]?.diagnostic_category || 'Unknown';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(record);
    return acc;
  }, {} as Record<string, any[]>);
  
  return {
    export_metadata: {
      export_date: new Date().toISOString(),
      target_date: date,
      total_records: records.length,
      facilities_count: Object.keys(recordsByFacility).length,
      categories_count: Object.keys(recordsByCategory).length,
      format_version: '1.0'
    },
    summary: {
      records_by_facility: Object.keys(recordsByFacility).reduce((acc, facility) => {
        acc[facility] = recordsByFacility[facility].length;
        return acc;
      }, {} as Record<string, number>),
      records_by_category: Object.keys(recordsByCategory).reduce((acc, category) => {
        acc[category] = recordsByCategory[category].length;
        return acc;
      }, {} as Record<string, number>)
    },
    data: {
      records_by_facility: recordsByFacility,
      records_by_category: recordsByCategory,
      all_records: records
    }
  };
}

/**
 * Creates a summary for the daily export
 */
function createDailySummary(date: string, records: any[]): DailyRecordsSummary {
  const facilities = new Set(records.map(r => r.facility_name));
  const operators = new Set(records.map(r => r.operator_details?.operator_id));
  const patients = new Set(records.map(r => r.patient_details?.patient_id));
  const categories = new Set(records.map(r => r.observations?.[0]?.diagnostic_category));
  
  const recordsByFacility = records.reduce((acc, record) => {
    const facility = record.facility_name || 'Unknown';
    acc[facility] = (acc[facility] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const recordsByCategory = records.reduce((acc, record) => {
    const category = record.observations?.[0]?.diagnostic_category || 'Unknown';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    date,
    totalRecords: records.length,
    facilitiesCount: facilities.size,
    operatorsCount: operators.size,
    patientsCount: patients.size,
    testCategoriesCount: categories.size,
    recordsByFacility,
    recordsByCategory
  };
}

/**
 * Generates S3 key for the export file
 */
function generateS3Key(date: string, facilityName?: string): string {
  const [year, month, day] = date.split('-');
  const facilityPart = facilityName ? `/${facilityName.toLowerCase().replace(/\s+/g, '-')}` : '';
  return `daily-exports/${year}/${month}${facilityPart}/livww-records-${date}.json`;
}

/**
 * Uploads the daily export to S3
 */
async function uploadToS3(bucket: string, key: string, data: any): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
    Metadata: {
      'export-type': 'daily-records',
      'export-date': new Date().toISOString(),
      'record-count': data.export_metadata.total_records.toString()
    }
  });
  
  await s3.send(command);
  console.log(`Uploaded daily export to s3://${bucket}/${key}`);
}
