import { EnvironmentConfig } from '../.config/environment';

export class ResourceNaming {
    constructor(private config: EnvironmentConfig) { }

    // Generate resource name with environment prefix
    resource(name: string): string {
        return `${this.config.naming.prefix}${this.config.naming.separator}${name}`;
    }

    // Generate table name
    table(name: string): string {
        return this.resource(`${name}${this.config.naming.separator}table`);
    }

    // Generate bucket name (must be globally unique)
    bucket(name: string): string {
        const timestamp = Date.now().toString().slice(-6);
        return `${this.config.naming.prefix}${this.config.naming.separator}${name}${this.config.naming.separator}${timestamp}`.toLowerCase();
    }

    // Generate function name
    function(name: string): string {
        return this.resource(`${name}${this.config.naming.separator}function`);
    }

    // Generate API name
    api(name: string): string {
        return this.resource(`${name}${this.config.naming.separator}api`);
    }

    // Generate role name
    role(name: string): string {
        return this.resource(`${name}${this.config.naming.separator}role`);
    }

    // Generate policy name
    policy(name: string): string {
        return this.resource(`${name}${this.config.naming.separator}policy`);
    }

    // Generate alarm name
    alarm(name: string): string {
        return this.resource(`${name}${this.config.naming.separator}alarm`);
    }

    // Generate stack name
    stack(name: string): string {
        return this.resource(`${name}${this.config.naming.separator}stack`);
    }
}
