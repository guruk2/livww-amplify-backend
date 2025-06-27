// amplify/functions/syncMedicalData/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const syncMedicalData = defineFunction({
  name: 'syncMedicalData',
  entry: './handler.ts',
  environment: {
    NODE_OPTIONS: '--enable-source-maps'
  },
  timeoutSeconds: 60, // Increased to handle larger batches
  memoryMB: 512
});
