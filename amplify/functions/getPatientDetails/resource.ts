import { defineFunction } from '@aws-amplify/backend';

export const getPatientDetails = defineFunction({
  name: 'getPatientDetails',
  entry: './handler.ts',
  environment: {
    NODE_OPTIONS: '--enable-source-maps'
  },
  timeoutSeconds: 30,
  memoryMB: 256
});
