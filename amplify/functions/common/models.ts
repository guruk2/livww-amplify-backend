export interface SyncEvent {
  records: LivwiseRecord[];
  deviceId: string;
  operatorId?: string;
  latitude?: number;
  longitude?: number;
}

export interface LivwiseRecord {
  id: string;
  livwise_record_id: string;
  facility_name: string;
  branch_name: string;
  location_code: string;
  operator_details: OperatorDetails;
  patient_details: PatientDetails;
  observations: Observation[];
  operator_notes?: string;
  created_at: string;
  sync_metadata?: SyncMetadata;
}

export interface SyncMetadata {
  device_id: string;
  operator_id?: string;
  synced_at: string;
  sync_status: 'PENDING' | 'SYNCED' | 'ERROR';
  latitude?: number;
  longitude?: number;
}

export interface OperatorDetails {
  operator_id: string;
  operator_name: string;
}

export interface PatientDetails {
  patient_id: string;
  patient_mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  mobile: string;
  email?: string;
  consent_to_store_health_info: boolean;
  address_1: string;
  address_2?: string;
  address_city: string;
  address_state: string;
  address_pincode: string;
  patient_photo?: string; // S3 URL for patient photo
  patient_photo_blob?: string; // Base64 blob data (temporary, will be uploaded to S3)
}

export interface Observation {
  diagnostic_category: string;
  diagnostic_code: string;
  diagnostic_name: string;
  patient_vitals: PatientVital[];
  s3_object_url?: string;
  diagnostic_status: string;
  exception_message?: string;
  test_duration_minutes: number;
  observation_notes?: string;
  raw_data?: RawDataItem[] | any; // Support both new format and legacy
}

export interface RawDataItem {
  data: string; // Base64 encoded data
  raw_format: string; // 'mp3', 'jpg', 'png', 'wav', etc.
  raw_size: number; // File size in bytes
  filename?: string; // Original filename if provided
}

export interface PatientVital {
  vital_type: string;
  observed_value: number;
  unit_of_measure: string;
}

// Legacy interfaces for backward compatibility
export interface TestCenter {
  facility_name: string;
  branch_name: string;
  location_code: string;
}

export interface Address {
  address_1: string;
  address_2?: string;
  address_city: string;
  address_state: string;
  address_pincode: string;
}

export interface Observations {
  diagnostics: Diagnostics;
  patient_vitals: PatientVital[];
  s3_object_url?: string;
  diagnostic_status: string;
  exception_message?: string;
  test_duration_minutes: number;
  observation_notes?: string;
  raw_data?: RawDataItem[] | any;
}

export interface Diagnostics {
  diagnostic_category: string;
  diagnostic_code: string;
  diagnostic_name: string;
}
export interface SyncEvent {
  records: LivwiseRecord[];
  deviceId: string;
  operatorId?: string;
  latitude?: number;
  longitude?: number;
}

export interface LivwiseRecord {
  id: string;
  livwise_record_id: string;
  facility_name: string;
  branch_name: string;
  location_code: string;
  operator_details: OperatorDetails;
  patient_details: PatientDetails;
  observations: Observation[];
  operator_notes?: string;
  created_at: string;
  sync_metadata?: SyncMetadata;
}

export interface SyncMetadata {
  device_id: string;
  operator_id?: string;
  synced_at: string;
  sync_status: 'PENDING' | 'SYNCED' | 'ERROR';
  latitude?: number;
  longitude?: number;
}

export interface OperatorDetails {
  operator_id: string;
  operator_name: string;
}

export interface PatientDetails {
  patient_id: string;
  patient_mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  mobile: string;
  email?: string;
  consent_to_store_health_info: boolean;
  address_1: string;
  address_2?: string;
  address_city: string;
  address_state: string;
  address_pincode: string;
  patient_photo?: string; // S3 URL for patient photo
  patient_photo_blob?: string; // Base64 blob data (temporary, will be uploaded to S3)
}

export interface Observation {
  diagnostic_category: string;
  diagnostic_code: string;
  diagnostic_name: string;
  patient_vitals: PatientVital[];
  s3_object_url?: string;
  diagnostic_status: string;
  exception_message?: string;
  test_duration_minutes: number;
  observation_notes?: string;
  raw_data?: RawDataItem[] | any; // Support both new format and legacy
}

export interface RawDataItem {
  data: string; // Base64 encoded data
  raw_format: string; // 'mp3', 'jpg', 'png', 'wav', etc.
  raw_size: number; // File size in bytes
  filename?: string; // Original filename if provided
}

export interface PatientVital {
  vital_type: string;
  observed_value: number;
  unit_of_measure: string;
}

// Legacy interfaces for backward compatibility
export interface TestCenter {
  facility_name: string;
  branch_name: string;
  location_code: string;
}

export interface Address {
  address_1: string;
  address_2?: string;
  address_city: string;
  address_state: string;
  address_pincode: string;
}

export interface Observations {
  diagnostics: Diagnostics;
  patient_vitals: PatientVital[];
  s3_object_url?: string;
  diagnostic_status: string;
  exception_message?: string;
  test_duration_minutes: number;
  observation_notes?: string;
  raw_data?: RawDataItem[] | any;
}

export interface Diagnostics {
  diagnostic_category: string;
  diagnostic_code: string;
  diagnostic_name: string;
}
