import { defineAuth } from '@aws-amplify/backend';
import { getEnvironmentConfig } from '../.config/environment';

const envConfig = getEnvironmentConfig();

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: "CODE",
      verificationEmailSubject: `Welcome to LIVWW.AI ${envConfig.stage.toUpperCase()}!`,
      verificationEmailBody: (createCode) =>
        `Your verification code for ${envConfig.stage} environment is ${createCode()}`,
      userInvitation: {
        emailSubject: `Your LIVWW.AI ${envConfig.stage.toUpperCase()} Access`,
        emailBody: (user, code) =>
          `Welcome to LIVWW.AI ${envConfig.stage} environment! Username: ${user()}, Temporary password: ${code()}`
      },
    },
  },
  userAttributes: {
    "custom:operatorId": {
      dataType: "String",
      mutable: true,
    },
    "custom:facilityName": {
      dataType: "String",
      mutable: true,
    },
    "custom:role": {
      dataType: "String",
      mutable: true,
    },
    "custom:branchName": {
      dataType: "String",
      mutable: true,
    },
    "custom:locationName": {
      dataType: "String",
      mutable: true,
    },
    "custom:department": {
      dataType: "String",
      mutable: true,
    },
    "custom:operatorLocation": {
      dataType: "String",
      mutable: true,
    },
    "custom:environment": {
      dataType: "String",
      mutable: false, // Immutable environment tag
    }
  },
  groups: ['Administrators', 'Doctors', 'Nurses', 'Operator', 'Auditor'],
  accountRecovery: 'EMAIL_ONLY',
});
