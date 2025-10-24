/**
 * 📄 Licensing & Feature Gating System
 * Handles Community vs Enterprise feature access
 */

export type LicenseType = 'community' | 'enterprise';

export interface LicenseConfig {
  type: LicenseType;
  features: FeatureFlags;
  metadata?: {
    organizationId?: string;
    licenseKey?: string;
    expiryDate?: Date;
    supportLevel?: 'community' | 'standard' | 'premium';
  };
}

export interface FeatureFlags {
  // Core Features (Always Available)
  localTranscription: boolean;
  basicMeetingManagement: boolean;
  simpleExports: boolean;
  selfHostedDeployment: boolean;
  
  // Enterprise Features
  cloudAIProviders: boolean;
  advancedAnalytics: boolean;
  teamCollaboration: boolean;
  ssoAuthentication: boolean;
  prioritySupport: boolean;
  customIntegrations: boolean;
  whiteLabelBranding: boolean;
  complianceFeatures: boolean;
  multiTenantArchitecture: boolean;
  advancedUserManagement: boolean;
  
  // Premium AI Features
  enhancedTranscription: boolean;
  aiSummarization: boolean;
  sentimentAnalysis: boolean;
  actionItemExtraction: boolean;
  speakerDiarization: boolean;
  realTimeTranscription: boolean;
  
  // Export & Integration Features
  advancedExports: boolean; // PDF, DOCX, etc.
  apiAccess: boolean;
  webhooks: boolean;
  zapierIntegration: boolean;
  slackIntegration: boolean;
  teamsIntegration: boolean;
  
  // Analytics & Reporting
  usageAnalytics: boolean;
  performanceMetrics: boolean;
  customReports: boolean;
  dataRetentionControls: boolean;
}

// Default Community License Features
export const COMMUNITY_FEATURES: FeatureFlags = {
  // Core Features - Always Available
  localTranscription: true,
  basicMeetingManagement: true,
  simpleExports: true,
  selfHostedDeployment: true,
  
  // Enterprise Features - Disabled
  cloudAIProviders: false,
  advancedAnalytics: false,
  teamCollaboration: false,
  ssoAuthentication: false,
  prioritySupport: false,
  customIntegrations: false,
  whiteLabelBranding: false,
  complianceFeatures: false,
  multiTenantArchitecture: false,
  advancedUserManagement: false,
  
  // Premium AI Features - Limited
  enhancedTranscription: false,
  aiSummarization: false,
  sentimentAnalysis: false,
  actionItemExtraction: false,
  speakerDiarization: false,
  realTimeTranscription: false,
  
  // Export & Integration - Basic Only
  advancedExports: false,
  apiAccess: false,
  webhooks: false,
  zapierIntegration: false,
  slackIntegration: false,
  teamsIntegration: false,
  
  // Analytics - Disabled
  usageAnalytics: false,
  performanceMetrics: false,
  customReports: false,
  dataRetentionControls: false,
};

// Enterprise License Features (All Enabled)
export const ENTERPRISE_FEATURES: FeatureFlags = {
  // Core Features
  localTranscription: true,
  basicMeetingManagement: true,
  simpleExports: true,
  selfHostedDeployment: true,
  
  // Enterprise Features - All Enabled
  cloudAIProviders: true,
  advancedAnalytics: true,
  teamCollaboration: true,
  ssoAuthentication: true,
  prioritySupport: true,
  customIntegrations: true,
  whiteLabelBranding: true,
  complianceFeatures: true,
  multiTenantArchitecture: true,
  advancedUserManagement: true,
  
  // Premium AI Features - All Enabled
  enhancedTranscription: true,
  aiSummarization: true,
  sentimentAnalysis: true,
  actionItemExtraction: true,
  speakerDiarization: true,
  realTimeTranscription: true,
  
  // Export & Integration - All Enabled
  advancedExports: true,
  apiAccess: true,
  webhooks: true,
  zapierIntegration: true,
  slackIntegration: true,
  teamsIntegration: true,
  
  // Analytics - All Enabled
  usageAnalytics: true,
  performanceMetrics: true,
  customReports: true,
  dataRetentionControls: true,
};

class LicenseManager {
  private static instance: LicenseManager;
  private currentLicense: LicenseConfig;

  private constructor() {
    // Initialize with Community License by default
    this.currentLicense = {
      type: 'community',
      features: COMMUNITY_FEATURES,
    };
    
    // Try to load license from localStorage or environment
    this.loadLicenseConfig();
  }

  public static getInstance(): LicenseManager {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager();
    }
    return LicenseManager.instance;
  }

  private loadLicenseConfig(): void {
    try {
      // Check for enterprise license key in environment variables
      const enterpriseLicenseKey = import.meta.env.VITE_ENTERPRISE_LICENSE_KEY;
      
      if (enterpriseLicenseKey) {
        this.setEnterpriseLicense(enterpriseLicenseKey);
        return;
      }

      // Check localStorage for license config
      const storedLicense = localStorage.getItem('antislash_license_config');
      if (storedLicense) {
        const parsed = JSON.parse(storedLicense) as LicenseConfig;
        this.currentLicense = parsed;
        return;
      }

      // Default to community license
      this.setCommunityLicense();
    } catch (error) {
      console.warn('Failed to load license config, defaulting to Community:', error);
      this.setCommunityLicense();
    }
  }

  public setCommunityLicense(): void {
    this.currentLicense = {
      type: 'community',
      features: COMMUNITY_FEATURES,
    };
    this.saveLicenseConfig();
  }

  public setEnterpriseLicense(licenseKey: string, organizationId?: string): void {
    // In a real implementation, you'd validate the license key with your backend
    this.currentLicense = {
      type: 'enterprise',
      features: ENTERPRISE_FEATURES,
      metadata: {
        licenseKey,
        organizationId,
        supportLevel: 'premium',
      },
    };
    this.saveLicenseConfig();
  }

  private saveLicenseConfig(): void {
    try {
      localStorage.setItem('antislash_license_config', JSON.stringify(this.currentLicense));
    } catch (error) {
      console.warn('Failed to save license config:', error);
    }
  }

  public getCurrentLicense(): LicenseConfig {
    return this.currentLicense;
  }

  public hasFeature(feature: keyof FeatureFlags): boolean {
    return this.currentLicense.features[feature];
  }

  public isEnterprise(): boolean {
    return this.currentLicense.type === 'enterprise';
  }

  public isCommunity(): boolean {
    return this.currentLicense.type === 'community';
  }

  public getUpgradeUrl(): string {
    return 'https://antislash.studio/enterprise';
  }

  public getSupportUrl(): string {
    return this.isEnterprise() 
      ? 'https://support.antislash.studio'
      : 'https://github.com/Lamouller/Antislash-Talk/issues';
  }
}

// Export singleton instance
export const licenseManager = LicenseManager.getInstance();

// Convenience hooks for React components
export function useLicense() {
  return {
    license: licenseManager.getCurrentLicense(),
    hasFeature: (feature: keyof FeatureFlags) => licenseManager.hasFeature(feature),
    isEnterprise: () => licenseManager.isEnterprise(),
    isCommunity: () => licenseManager.isCommunity(),
    upgradeUrl: licenseManager.getUpgradeUrl(),
    supportUrl: licenseManager.getSupportUrl(),
  };
}

// Feature gate component helpers
export function requiresEnterprise(feature: keyof FeatureFlags): boolean {
  return ENTERPRISE_FEATURES[feature] && !COMMUNITY_FEATURES[feature];
}

export function getFeatureDescription(feature: keyof FeatureFlags): string {
  const descriptions: Record<keyof FeatureFlags, string> = {
    localTranscription: 'Process audio locally with Whisper and Moonshine models',
    basicMeetingManagement: 'Create, view, and organize your meetings',
    simpleExports: 'Export transcripts as JSON or TXT files',
    selfHostedDeployment: 'Deploy on your own infrastructure',
    
    cloudAIProviders: 'Access OpenAI, Mistral, Google Cloud, and Anthropic APIs',
    advancedAnalytics: 'Detailed insights and performance metrics',
    teamCollaboration: 'Share meetings and collaborate with team members',
    ssoAuthentication: 'Single Sign-On with SAML and OAuth providers',
    prioritySupport: '24/7 priority support with SLA guarantees',
    customIntegrations: 'Custom API integrations and webhooks',
    whiteLabelBranding: 'Remove Antislash branding and use your own',
    complianceFeatures: 'GDPR, SOC2, and HIPAA compliance tools',
    multiTenantArchitecture: 'Separate workspaces for different organizations',
    advancedUserManagement: 'Role-based access control and permissions',
    
    enhancedTranscription: 'Higher accuracy with cloud AI models',
    aiSummarization: 'AI-generated meeting summaries and key points',
    sentimentAnalysis: 'Analyze speaker emotions and meeting tone',
    actionItemExtraction: 'Automatically identify and track action items',
    speakerDiarization: 'Identify and separate different speakers',
    realTimeTranscription: 'Live transcription during meetings',
    
    advancedExports: 'Export to PDF, DOCX, and other professional formats',
    apiAccess: 'Full REST API access for custom integrations',
    webhooks: 'Real-time notifications for events',
    zapierIntegration: 'Connect with 5000+ apps via Zapier',
    slackIntegration: 'Native Slack integration for teams',
    teamsIntegration: 'Microsoft Teams integration',
    
    usageAnalytics: 'Track usage patterns and system performance',
    performanceMetrics: 'Detailed performance and quality metrics',
    customReports: 'Generate custom reports and dashboards',
    dataRetentionControls: 'Configure data retention and deletion policies',
  };
  
  return descriptions[feature] || 'Feature description not available';
} 