import { defineFunction } from '@aws-amplify/backend';

export const exportDailyRecords = defineFunction({
  name: 'exportDailyRecords',
  entry: './handler.ts',
  environment: {
    NODE_OPTIONS: '--enable-source-maps'
  },
  timeoutSeconds: 900, // 15 minutes for large exports
  memoryMB: 1024
});
