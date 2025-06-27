import { defineFunction } from '@aws-amplify/backend';

export const getMedicalRecords = defineFunction({
  name: 'getMedicalRecords',
  entry: './handler.ts',
  environment: {
    NODE_OPTIONS: '--enable-source-maps'
  },
  timeoutSeconds: 30,
  memoryMB: 256
});
