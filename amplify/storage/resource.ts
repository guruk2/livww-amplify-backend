// amplify/storage/resource.ts
import { defineStorage } from '@aws-amplify/backend';
import { auth } from '../auth/resource';

export const storage = defineStorage({
  name: 'livwwMedicalStorage',
  access: (allow) => ({
    // Medical records access rules
    'medical-records/*': [
      allow.authenticated.to(['read']),
      allow.groups(['Administrators']).to(['read', 'write', 'delete']),
      allow.groups(['Doctors', 'Nurses']).to(['read']),
      allow.groups(['Auditor']).to(['read']) 
    ],
    // Device uploads with user isolation using Cognito identity ID
    'device-uploads/${cognitoIdentityId}/*': [
      allow.authenticated.to(['read', 'write']),
      allow.groups(['Administrators']).to(['read', 'write', 'delete'])
    ],
    // Public read access for authenticated users
    'public/*': [
      allow.authenticated.to(['read'])
    ],
    // Audit logs access for compliance
    'audit-logs/*': [
      allow.groups(['Administrators']).to(['read', 'write', 'delete']),
      allow.groups(['Auditor']).to(['read'])
    ]
  })
});
