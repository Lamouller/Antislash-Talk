import React from 'react';
import { useLicense, type FeatureFlags, requiresEnterprise, getFeatureDescription } from '../../lib/licensing';
import { Button } from './Button';

interface FeatureGateProps {
  feature: keyof FeatureFlags;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export function FeatureGate({ 
  feature, 
  children, 
  fallback, 
  showUpgradePrompt = true 
}: FeatureGateProps) {
  const { hasFeature, upgradeUrl } = useLicense();

  // If user has access to the feature, render children
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // If feature requires enterprise and user wants upgrade prompt
  if (requiresEnterprise(feature) && showUpgradePrompt) {
    return (
      <div className="border-2 border-dashed border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-6 text-center">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-orange-100 rounded-full">
          <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          🚀 Enterprise Feature
        </h3>
        
        <p className="text-gray-600 mb-4">
          {getFeatureDescription(feature)}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => window.open(upgradeUrl, '_blank')}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium px-6 py-2"
          >
            ⚡ Upgrade to Enterprise
          </Button>
          
          <Button
            onClick={() => window.open('https://antislash.studio/enterprise', '_blank')}
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            📋 View All Features
          </Button>
        </div>
        
        <p className="text-xs text-gray-500 mt-3">
          💡 Or continue using our powerful local features with the Community edition
        </p>
      </div>
    );
  }

  // Render fallback or nothing
  return fallback ? <>{fallback}</> : null;
}

// Convenience component for inline feature checks
export function EnterpriseOnly({ children }: { children: React.ReactNode }) {
  const { isEnterprise } = useLicense();
  return isEnterprise() ? <>{children}</> : null;
}

// Badge component to mark enterprise features
export function EnterpriseBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-200 ${className}`}>
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
      </svg>
      Enterprise
    </span>
  );
}

// Coming Soon badge for features in development
export function ComingSoonBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200 ${className}`}>
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
      Coming Soon
    </span>
  );
}

// Feature comparison component
export function FeatureComparison() {
  const { license, upgradeUrl } = useLicense();
  
  const features = [
    { name: 'Local Transcription', community: true, enterprise: true, icon: '🎙️' },
    { name: 'Basic Meeting Management', community: true, enterprise: true, icon: '📋' },
    { name: 'Simple Exports (JSON/TXT)', community: true, enterprise: true, icon: '📄' },
    { name: 'Self-Hosted Deployment', community: true, enterprise: true, icon: '🏠' },
    { name: 'Cloud AI Providers', community: false, enterprise: true, icon: '☁️' },
    { name: 'Advanced Analytics', community: false, enterprise: true, icon: '📊' },
    { name: 'Team Collaboration', community: false, enterprise: true, icon: '👥' },
    { name: 'SSO Authentication', community: false, enterprise: true, icon: '🔐' },
    { name: 'Priority Support', community: false, enterprise: true, icon: '🚀' },
    { name: 'Custom Integrations', community: false, enterprise: true, icon: '🔌' },
    { name: 'White-Label Branding', community: false, enterprise: true, icon: '🎨' },
    { name: 'Compliance Features', community: false, enterprise: true, icon: '🛡️' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Feature Comparison</h3>
        <p className="text-sm text-gray-600 mt-1">
          Compare Community and Enterprise editions
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feature
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Community
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Enterprise
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {features.map((feature, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center">
                    <span className="mr-2">{feature.icon}</span>
                    {feature.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {feature.community ? (
                    <span className="text-green-600">✅</span>
                  ) : (
                    <span className="text-gray-300">❌</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {feature.enterprise ? (
                    <span className="text-green-600">✅</span>
                  ) : (
                    <span className="text-gray-300">❌</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {license.type === 'community' && (
        <div className="px-6 py-4 bg-orange-50 border-t border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-800">
                Ready to unlock all features?
              </p>
              <p className="text-xs text-orange-600">
                Get priority support, cloud AI, and advanced analytics
              </p>
            </div>
            <Button
              onClick={() => window.open(upgradeUrl, '_blank')}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm px-4 py-2"
            >
              Upgrade Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 