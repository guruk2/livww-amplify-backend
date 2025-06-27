import { z } from 'zod';

export const PatientVitalSchema = z.object({
  vital_type: z.string().min(1),
  observed_value: z.number(),
  unit_of_measure: z.string().optional(),
});

export const RawDataItemSchema = z.object({
  data: z.string().optional(), // Base64 encoded data
  raw_format: z.string().optional(), // File format
  raw_size: z.number().positive(), // File size in bytes
  filename: z.string().optional(), // Original filename
});

export const ObservationSchema = z.object({
  diagnostic_category: z.string().min(1),
  diagnostic_code: z.string().min(1),
  diagnostic_name: z.string().min(1),
  patient_vitals: z.array(PatientVitalSchema).min(1),
  s3_object_url: z.string().url().optional().nullable(),
  diagnostic_status: z.string().optional(),
  exception_message: z.string().optional().nullable(),
  test_duration_minutes: z.number().int().positive(),
  observation_notes: z.string().optional(),
  raw_data: z.union([
    z.array(RawDataItemSchema), // New format
    z.any() // Legacy format
  ]).optional(),
});

export const SyncMetadataSchema = z.object({
  device_id: z.string().min(1),
  operator_id: z.string().optional(),
  synced_at: z.string().datetime(),
  sync_status: z.enum(['PENDING', 'SYNCED', 'ERROR']),
  latitude: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),
  longitude: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),
});

export const LivwiseRecordSchema = z.object({
  id: z.string().min(1),
  livwise_record_id: z.string().min(1),
  facility_name: z.string().min(1),
  branch_name: z.string().min(1),
  location_code: z.string().min(1),
  operator_details: z.object({
    operator_id: z.string().min(1),
    operator_name: z.string().min(1),
  }),
  patient_details: z.object({
    patient_id: z.string().min(1),
    patient_mrn: z.string().min(1),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: z.enum(['Male', 'Female', 'Other']),
    mobile: z.string().min(10),
    email: z.string().email().optional(),
    consent_to_store_health_info: z.boolean(),
    address_1: z.string().min(1),
    address_2: z.string().optional(),
    address_city: z.string().min(1),
    address_state: z.string().min(1),
    address_pincode: z.string().regex(/^\d{5,6}$/),
    patient_photo: z.string().url().optional(), // S3 URL
    patient_photo_blob: z.string().optional(), // Base64 blob (temporary)
  }),
  observations: z.array(ObservationSchema).min(1),
  operator_notes: z.string().optional(),
  created_at: z.string().datetime(),
  sync_metadata: SyncMetadataSchema.optional(),
}).passthrough();

export const SyncEventSchema = z.object({
  records: z.array(z.any()).min(1),
  deviceId: z.string().min(1),
  operatorId: z.string().optional(),
  latitude: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),
  longitude: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),
});
