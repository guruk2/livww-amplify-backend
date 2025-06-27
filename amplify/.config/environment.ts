import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';

export enum Stage {
    STAGING = 'staging',
    PRODUCTION = 'production',
    DEVELOPMENT = 'development'
}

export interface EnvironmentConfig {
    stage: Stage;
    env: {
        account?: string;
        region: string;
    };
    app: {
        name: string;
        description: string;
        version: string;
    };
    resources: {
        dynamodb: {
            billingMode: dynamodb.BillingMode;
            removalPolicy: cdk.RemovalPolicy;
            pointInTimeRecovery: boolean;
            ttlDays: number;
        };
        s3: {
            versioned: boolean;
            removalPolicy: cdk.RemovalPolicy;
            autoDeleteObjects: boolean;
            lifecycleRules: {
                expirationDays: number;
                transitionToIA?: number;
                transitionToGlacier?: number;
            };
        };
        lambda: {
            memoryMB: number;
            timeoutSeconds: number;
            logRetentionDays: number;
        };
        monitoring: {
            enableDetailedMetrics: boolean;
            alarmThreshold: {
                errorCount: number;
                durationMs: number;
            };
        };
    };
    naming: {
        prefix: string;
        separator: string;
    };
}

// Staging Environment Configuration
export const stagingConfig: EnvironmentConfig = {
    stage: Stage.STAGING,
    env: {
        region: 'ap-south-1'
    },
    app: {
        name: 'livww-backend',
        description: 'LivWW AI Medical Records Backend - Staging',
        version: '2.0.0'
    },
    resources: {
        dynamodb: {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            pointInTimeRecovery: false,
            ttlDays: 90
        },
        s3: {
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            lifecycleRules: {
                expirationDays: 90
            }
        },
        lambda: {
            memoryMB: 512,
            timeoutSeconds: 60,
            logRetentionDays: 14
        },
        monitoring: {
            enableDetailedMetrics: true,
            alarmThreshold: {
                errorCount: 5,
                durationMs: 10000
            }
        }
    },
    naming: {
        prefix: 'livww-staging',
        separator: '-'
    }
};

// Production Environment Configuration
export const productionConfig: EnvironmentConfig = {
    stage: Stage.PRODUCTION,
    env: {
        region: 'ap-south-1'
    },
    app: {
        name: 'livww-backend',
        description: 'LivWW AI Medical Records Backend - Production',
        version: '2.0.0'
    },
    resources: {
        dynamodb: {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
            ttlDays: 2555 // 7 years
        },
        s3: {
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
            lifecycleRules: {
                expirationDays: 2555,
                transitionToIA: 30,
                transitionToGlacier: 90
            }
        },
        lambda: {
            memoryMB: 1024,
            timeoutSeconds: 900,
            logRetentionDays: 365
        },
        monitoring: {
            enableDetailedMetrics: true,
            alarmThreshold: {
                errorCount: 1,
                durationMs: 5000
            }
        }
    },
    naming: {
        prefix: 'livww-prod',
        separator: '-'
    }
};

// Get configuration based on environment
export function getEnvironmentConfig(): EnvironmentConfig {
    const stage = process.env.AMPLIFY_ENV || process.env.NODE_ENV || 'staging';

    switch (stage.toLowerCase()) {
        case 'production':
        case 'prod':
            return productionConfig;
        case 'staging':
        case 'stage':
            return stagingConfig;
        default:
            console.warn(`Unknown stage '${stage}', defaulting to staging`);
            return stagingConfig;
    }
}