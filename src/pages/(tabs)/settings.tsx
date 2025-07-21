import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiKey } from '../../lib/schemas';
import toast from 'react-hot-toast';
import { useLocalTranscription } from '../../hooks/useLocalTranscription';
import { useLicense, licenseManager } from '../../lib/licensing';
import { FeatureGate, EnterpriseBadge, FeatureComparison } from '../../components/ui/FeatureGate';
import { Settings } from 'lucide-react';

type LlmProvider = 'openai' | 'anthropic' | 'google' | 'mistral';
type SttTtsProvider = 'openai' | 'google' | 'mistral' | 'local';

interface Model {
  id: string;
  name: string;
  description: string;
  size?: string;
  languages?: string;
}

const llmModels: Record<LlmProvider, Model[]> = {
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'Latest flagship model from OpenAI.',
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o mini',
      description: 'Affordable, intelligent small model.',
    },
  ],
  anthropic: [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      description: 'Most intelligent model.',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      description: 'Fastest model.',
    },
  ],
  google: [
    {
      id: 'gemini-1.5-pro-latest',
      name: 'Gemini 1.5 Pro',
      description: 'Best model for scaling across a wide range of tasks.',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fast and versatile performance across a diverse variety of tasks.',
    },
  ],
  mistral: [
    {
      id: 'mistral-large-latest',
      name: 'Mistral Large',
      description: 'Top-tier reasoning for high-complexity tasks.',
    },
    {
      id: 'mistral-small-latest',
      name: 'Mistral Small',
      description: 'Cost-efficient reasoning for simple tasks.',
    },
  ],
};

const transcriptionModels: Record<SttTtsProvider, Model[]> = {
  openai: [
    {
      id: 'whisper-1',
      name: 'Whisper',
      description: 'Powerful speech-to-text model.',
    },
  ],
  google: [
    {
      id: 'gemini-1.5-pro-latest',
      name: 'Gemini 1.5 Pro',
      description: 'Transcription via the main model.',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Faster transcription with Gemini Flash.',
    },
  ],
  mistral: [
    {
      id: 'voxtral-small',
      name: 'Voxtral Small 🎯 ⚡',
      description: 'Revolutionary multimodal model with superior transcription, Q&A, and semantic understanding. Best quality option.',
    },
    {
      id: 'voxtral-mini',
      name: 'Voxtral Mini 💨',
      description: 'Lightweight version of Voxtral with fast transcription and built-in understanding capabilities.',
    },
  ],
  local: [
    {
      id: 'onnx-community/moonshine-tiny-ONNX',
      name: 'Moonshine Tiny 🌙 ULTRA-LÉGER',
      description: 'Moonshine by Useful Sensors. Ultra-compact 27M parameters, only 50MB. Fast and efficient for English.',
      size: '50MB',
      languages: 'English only'
    },
    {
      id: 'Xenova/whisper-tiny',
      name: 'Whisper Tiny ✅ CLASSIQUE',
      description: 'OpenAI Whisper Tiny. Ultra-light AI model, perfect for mobile devices. Best balance of speed and accuracy.',
      size: '39MB',
      languages: '99 languages (including French)'
    },

    {
      id: 'onnx-community/moonshine-base-ONNX',
      name: 'Moonshine Base 🌙 ÉQUILIBRÉ',
      description: 'Moonshine Base with 61M parameters. More accurate than tiny while remaining lightweight.',
      size: '125MB',
      languages: 'English only'
    },
    {
      id: 'Xenova/whisper-base',
      name: 'Whisper Base ✅ 💪 BON CHOIX',
      description: 'Balanced model offering better quality than tiny while remaining lightweight.',
      size: '74MB',
      languages: '99 languages (including French)'
    },
    {
      id: 'distil-whisper/distil-large-v3.5',
      name: 'Distil-Whisper Large v3.5 🚀 PERFORMANT',
      description: 'Distilled Whisper Large. 1.5x faster than original with similar accuracy. Great for longer audio.',
      size: '756MB',
      languages: '99 languages (including French)'
    },
    {
      id: 'Xenova/whisper-small',
      name: 'Whisper Small ⚠️ LOURD',
      description: 'Higher quality transcription, suitable for desktop use. May fail on some devices.',
      size: '244MB',
      languages: '99 languages (including French)'
    },
    {
      id: 'Xenova/whisper-medium',
      name: 'Whisper Medium ⚠️ TRÈS LOURD',
      description: 'High-quality transcription with excellent accuracy. Often fails in browser.',
      size: '769MB',
      languages: '99 languages (including French)'
    },
    {
      id: 'Xenova/whisper-large-v2',
      name: 'Whisper Large v2 🚫 ÉVITER',
      description: 'Top-tier accuracy but too heavy for browser use. Will likely fail.',
      size: '1.5GB',
      languages: '99 languages (including French)'
    }
  ]
};

const ttsModels: Record<SttTtsProvider, Model[]> = {
  openai: [
    { id: 'tts-1', name: 'TTS-1', description: 'Optimized for real-time.' },
    { id: 'tts-1-hd', name: 'TTS-1-HD', description: 'Optimized for quality.' },
  ],
  google: [ 
    { id: 'gemini-2.5-flash-preview-tts', name: 'Gemini 2.5 Flash TTS', description: 'Specialized TTS model.' },
  ],
  mistral: [
    { 
      id: 'mistral-tts', 
      name: 'Mistral TTS (Coming Soon)', 
      description: 'Advanced text-to-speech from Mistral AI. Currently not available.'
    }
  ],
  local: [
    { 
      id: 'browser-tts', 
      name: 'Browser TTS', 
      description: 'Uses your device\'s built-in text-to-speech. No internet required.',
      size: 'Built-in',
      languages: 'Multiple languages (device dependent)'
    }
  ]
};

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { runBenchmark, benchmark } = useLocalTranscription();
  const [loading, setLoading] = useState(true);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [apiKeys, setApiKeys] = useState<Partial<ApiKey>[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // LLM State
  const [selectedLlmProvider, setSelectedLlmProvider] = useState<LlmProvider>('openai');
  const [selectedLlmModel, setSelectedLlmModel] = useState<string | null>(null);

  // Transcription State
  const [preferredTranscriptionProvider, setPreferredTranscriptionProvider] = useState<SttTtsProvider>('openai');
  const [preferredTranscriptionModel, setPreferredTranscriptionModel] = useState<string | null>(null);
  
  // TTS State
  const [selectedTtsProvider, setSelectedTtsProvider] = useState<SttTtsProvider>('openai');
  const [selectedTtsModel, setSelectedTtsModel] = useState<string | null>(null);

  // Prompt State
  const [promptTitle, setPromptTitle] = useState('');
  const [promptSummary, setPromptSummary] = useState('');
  const [promptTranscript, setPromptTranscript] = useState('');

  const [apiKeyInputs, setApiKeyInputs] = useState({ openai: '', anthropic: '', google: '', mistral: '' });

  const { license, hasFeature, isEnterprise, upgradeUrl } = useLicense();
  
  useEffect(() => {
    fetchProfileAndKeys();
  }, []);

  useEffect(() => {
    if(!loading) setHasChanges(true);
  }, [selectedLlmProvider, selectedLlmModel, preferredTranscriptionProvider, preferredTranscriptionModel, selectedTtsProvider, selectedTtsModel, promptTitle, promptSummary, promptTranscript]);
  

  async function fetchProfileAndKeys() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`*`)
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Set initial state from profile
      const llmProvider = profileData.preferred_llm as LlmProvider || 'openai';
      setSelectedLlmProvider(llmProvider);
      setSelectedLlmModel(profileData.preferred_llm_model || llmModels[llmProvider][0].id);

      const sttProvider = profileData.preferred_transcription_provider as SttTtsProvider || 'openai';
      setPreferredTranscriptionProvider(sttProvider);
      setPreferredTranscriptionModel(profileData.preferred_transcription_model || transcriptionModels[sttProvider][0].id);

      const ttsProvider = profileData.preferred_tts_provider as SttTtsProvider || 'openai';
      setSelectedTtsProvider(ttsProvider);
      setSelectedTtsModel(profileData.preferred_tts_model || ttsModels[ttsProvider][0].id);

      // Set prompt state from profile or defaults
      setPromptTitle(profileData.prompt_title || 'Generate a short, descriptive title for the meeting in French.');
      setPromptSummary(profileData.prompt_summary || 'Provide a concise one-paragraph summary of the key discussion points and decisions, in French.');
      setPromptTranscript(profileData.prompt_transcript || `A detailed, diarized transcript. Here's how to identify speakers:
- **Priority 1:** If a speaker introduces themselves or is named (e.g., "Hello, this is Marc," "Paul, what do you think?"), use that name as their identifier for all their speech segments.
- **Priority 2:** If names are not mentioned, use generic identifiers like "Locuteur_01", "Locuteur_02", etc.
- **Crucial Rule:** If you only detect one distinct voice throughout the recording, all text must be attributed to a single speaker (e.g., "Locuteur_01" or their identified name). Do NOT invent a second speaker.
- - Ensure each speech segment is correctly attributed to the speaker.`);
      
      const { data: keysData, error: keysError } = await supabase
        .from('api_keys')
        .select('provider, id')
        .eq('user_id', user.id);

      if (keysError) throw keysError;
      setApiKeys(keysData || []);

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      // Wait a tick before enabling saves to prevent instant "hasChanges" on load
      setTimeout(() => setHasChanges(false), 0);
    }
  }

  const handleApiKeySave = async (provider: string) => {
    const key = apiKeyInputs[provider as keyof typeof apiKeyInputs];
    if (!key) return toast.error('Please enter an API key.');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('api_keys')
      .upsert({ user_id: user.id, provider, encrypted_key: key }, { onConflict: 'user_id, provider' });

    if (error) return toast.error(error.message);
    toast.success(`${provider} API key saved!`);
    setApiKeyInputs(prev => ({ ...prev, [provider]: '' }));
    setApiKeys(prev => [...prev, { provider }]);
  };

  async function handleSaveModelSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const updates = {
      id: user.id,
      email: user.email,
      updated_at: new Date().toISOString(),
      preferred_llm: selectedLlmProvider,
      preferred_llm_model: selectedLlmModel,
      preferred_transcription_provider: preferredTranscriptionProvider,
      preferred_transcription_model: preferredTranscriptionModel,
      preferred_tts_provider: selectedTtsProvider,
      preferred_tts_model: selectedTtsModel,
      prompt_title: promptTitle,
      prompt_summary: promptSummary,
      prompt_transcript: promptTranscript,
    };

    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) return toast.error(error.message);
    
    toast.success('Settings saved!');
    setHasChanges(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/auth/login');
  }

  // Run benchmark automatically when local provider is selected
  useEffect(() => {
    if (preferredTranscriptionProvider === 'local' && !benchmark && !isBenchmarking) {
      handleRunBenchmark();
    }
  }, [preferredTranscriptionProvider, benchmark, isBenchmarking]);

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const result = await runBenchmark();
      console.log('Benchmark completed:', result);
    } catch (error) {
      console.error('Benchmark failed:', error);
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Get recommended models based on benchmark
  const getRecommendedModels = () => {
    if (!benchmark) return transcriptionModels.local;
    
    const recommended: Model[] = [];
    const allModels = transcriptionModels.local;
    
    // Always include the recommended model first
    const recommendedModel = allModels.find(m => m.id === benchmark.recommendedModel);
    if (recommendedModel) {
      recommended.push({
        ...recommendedModel,
        name: recommendedModel.name + ' 🎯 RECOMMANDÉ'
      });
    }
    
    // Add other compatible models based on device class
    if (benchmark.deviceClass === 'high-end') {
      // High-end: can handle most models
      allModels.forEach(model => {
        if (model.id !== benchmark.recommendedModel) {
          recommended.push(model);
        }
      });
    } else if (benchmark.deviceClass === 'mid-range') {
      // Mid-range: exclude the heaviest models
      allModels.forEach(model => {
        if (model.id !== benchmark.recommendedModel && 
            !model.id.includes('large') && 
            !model.id.includes('medium')) {
          recommended.push(model);
        }
      });
    } else {
      // Low-end: only lightweight models
      allModels.forEach(model => {
        if (model.id !== benchmark.recommendedModel && 
            (model.id.includes('tiny') || model.id.includes('moonshine'))) {
          recommended.push(model);
        }
      });
    }
    
    return recommended;
  };

  if (loading) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900">
      <div className="relative overflow-hidden pt-8 pb-16">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-indigo-600/10"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-lg mb-6">
              <Settings className="w-5 h-5 text-blue-500 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Application Settings</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent mb-4">
              Settings
            </h1>
            <div className="flex items-center justify-center gap-3">
              {isEnterprise() ? (
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium shadow-lg">
                  🚀 Enterprise Edition
                </span>
              ) : (
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium shadow-lg">
                  🆓 Community Edition
                </span>
              )}
            </div>
          </div>

          <div className="space-y-8">

          {!isEnterprise() && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    🚀 Want more features?
                  </h3>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Upgrade to Enterprise for cloud AI, team collaboration, and priority support
                  </p>
                </div>
                <button
                  onClick={() => window.open(upgradeUrl, '_blank')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Upgrade
                </button>
              </div>
            </div>
          )}

          {/* License Information */}
          <div className="mb-8 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📄 License Information
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">License Type</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {license.type === 'enterprise' ? '💼 Enterprise' : '🆓 Community (MIT)'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Support Level</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {license.metadata?.supportLevel === 'premium' ? '🚀 Priority Support' : '👥 Community Support'}
                </div>
              </div>
              {license.metadata?.organizationId && (
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Organization</div>
                  <div className="font-medium text-gray-900 dark:text-white">{license.metadata.organizationId}</div>
                </div>
              )}
              {license.metadata?.licenseKey && (
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">License Key</div>
                  <div className="font-mono text-sm text-gray-700 dark:text-gray-300">
                    {license.metadata.licenseKey.slice(0, 8)}...{license.metadata.licenseKey.slice(-4)}
                  </div>
                </div>
              )}
            </div>
            {!isEnterprise() && (
              <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  📋 Want to see what Enterprise includes? 
                  <a href={upgradeUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                    View comparison →
                  </a>
                </div>
              </div>
            )}
          </div>

                     {/* Existing Transcription Settings */}
           <Card>
             <div className="p-6">
               <h2 className="text-xl font-bold">🎙️ Model Settings</h2>
               <p className="mt-1 text-sm text-gray-500">Choose the AI models for different tasks.</p>
               
               {/* Show enterprise status */}
               <div className="mt-4 mb-6 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                 <div className="flex items-center justify-between">
                   <div className="text-sm">
                     <span className="font-medium text-gray-900 dark:text-white">License: </span>
                     {isEnterprise() ? (
                       <span className="text-blue-600 dark:text-blue-400 font-medium">💼 Enterprise</span>
                     ) : (
                       <span className="text-gray-600 dark:text-gray-300">🆓 Community (MIT)</span>
                     )}
                   </div>
                   {!isEnterprise() && (
                     <button
                       onClick={() => window.open(upgradeUrl, '_blank')}
                       className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                     >
                       Upgrade
                     </button>
                   )}
                 </div>
               </div>
             </div>
             
             <div className="p-6 pt-0 space-y-6">
               {/* Transcription */}
               <div>
                 <SettingSelectRow
                   title="Transcription Settings"
                   selectedProvider={preferredTranscriptionProvider}
                   setSelectedProvider={(p) => setPreferredTranscriptionProvider(p as SttTtsProvider)}
                   providers={['openai', 'google', 'mistral', 'local']}
                   selectedModel={preferredTranscriptionModel}
                   setSelectedModel={setPreferredTranscriptionModel}
                   models={{
                     ...transcriptionModels,
                     local: preferredTranscriptionProvider === 'local' ? getRecommendedModels() : transcriptionModels.local
                   }}
                 />
                 
                 {/* Feature gate for cloud providers */}
                 {preferredTranscriptionProvider !== 'local' && (
                   <FeatureGate feature="cloudAIProviders">
                     <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg">
                       <p className="text-sm text-green-800 dark:text-green-200">
                         🎉 Enterprise cloud AI features enabled!
                       </p>
                     </div>
                   </FeatureGate>
                 )}
               </div>

               {/* LLM with enterprise gating */}
               <FeatureGate feature="cloudAIProviders" showUpgradePrompt={false}>
                 <SettingSelectRow
                   title="Primary LLM"
                   selectedProvider={selectedLlmProvider}
                   setSelectedProvider={(p) => setSelectedLlmProvider(p as LlmProvider)}
                   providers={Object.keys(llmModels)}
                   selectedModel={selectedLlmModel}
                   setSelectedModel={setSelectedLlmModel}
                   models={llmModels}
                 />
               </FeatureGate>

               {/* TTS with enterprise gating */}
               <FeatureGate feature="cloudAIProviders" showUpgradePrompt={false}>
                 <SettingSelectRow
                   title="Text-to-Speech"
                   selectedProvider={selectedTtsProvider}
                   setSelectedProvider={(p) => setSelectedTtsProvider(p as SttTtsProvider)}
                   providers={Object.keys(ttsModels)}
                   selectedModel={selectedTtsModel}
                   setSelectedModel={setSelectedTtsModel}
                   models={ttsModels}
                 />
               </FeatureGate>
             </div>
           </Card>

           {/* Enterprise Features */}
           <FeatureGate feature="advancedAnalytics">
             <Card>
               <div className="p-6">
                 <h3 className="text-lg font-semibold text-gray-900">📊 Advanced Analytics</h3>
                 <p className="text-sm text-gray-500 mt-1">Enterprise analytics and monitoring</p>
                 <div className="mt-4 grid md:grid-cols-2 gap-4">
                   <label className="flex items-center space-x-2">
                     <input type="checkbox" className="rounded border-gray-300" />
                     <span className="text-sm text-gray-700">Enable usage analytics</span>
                   </label>
                   <label className="flex items-center space-x-2">
                     <input type="checkbox" className="rounded border-gray-300" />
                     <span className="text-sm text-gray-700">Performance monitoring</span>
                   </label>
                 </div>
               </div>
             </Card>
           </FeatureGate>

           <FeatureGate feature="teamCollaboration">
             <Card>
               <div className="p-6">
                 <h3 className="text-lg font-semibold text-gray-900">👥 Team Collaboration</h3>
                 <p className="text-sm text-gray-500 mt-1">Enterprise team features</p>
                 <div className="mt-4 space-y-3">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Default Sharing
                     </label>
                     <select className="w-full p-2 border border-gray-300 rounded-lg">
                       <option value="private">🔒 Private</option>
                       <option value="team">👥 Team Only</option>
                       <option value="organization">🏢 Organization</option>
                     </select>
                   </div>
                 </div>
               </div>
             </Card>
           </FeatureGate>

          {/* Feature Comparison Table */}
          <div className="mt-8">
            <FeatureComparison />
          </div>

          {/* Prompt Settings */}
          <Card>
            <div className="p-6">
                <h2 className="text-xl font-bold">Prompt Settings</h2>
                <p className="mt-1 text-sm text-gray-500">Customize the prompts used for AI analysis. These will be used by the transcription function.</p>
            </div>
            <div className="p-6 pt-0 space-y-4">
                <PromptTextarea label="Title Prompt" value={promptTitle} onChange={setPromptTitle} />
                <PromptTextarea label="Summary Prompt" value={promptSummary} onChange={setPromptSummary} />
                <PromptTextarea label="Transcript & Diarization Prompt" value={promptTranscript} onChange={setPromptTranscript} />
            </div>
          </Card>
          
          {/* API Keys */}
          <Card>
            <div className="p-6">
                <h2 className="text-xl font-bold">API Keys</h2>
                <p className="mt-1 text-sm text-gray-500">Keys are stored securely and never exposed on the client-side.</p>
            </div>
            <div className="p-6 pt-0 space-y-4">
              {Object.keys(apiKeyInputs).map(p => 
                <ApiKeyInputRow 
                  key={p}
                  provider={p}
                  hasKey={apiKeys.some(k => k.provider === p)}
                  value={apiKeyInputs[p as keyof typeof apiKeyInputs]}
                  onChange={v => setApiKeyInputs(prev => ({...prev, [p]: v}))}
                  onSave={() => handleApiKeySave(p)}
                />
              )}
            </div>
          </Card>
          
          {/* Device Performance Section */}
          {preferredTranscriptionProvider === 'local' && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">🔬 Device Performance</h2>
                <button
                  onClick={handleRunBenchmark}
                  disabled={isBenchmarking}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isBenchmarking ? '🔄 Testing...' : '🔬 Run Test'}
                </button>
              </div>
              
              {benchmark && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Device Class</div>
                      <div className="font-semibold capitalize text-lg text-gray-900 dark:text-white">
                        {benchmark.deviceClass === 'high-end' && '🚀 High-End'}
                        {benchmark.deviceClass === 'mid-range' && '⚡ Mid-Range'}
                        {benchmark.deviceClass === 'low-end' && '💻 Low-End'}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">WebGPU Support</div>
                      <div className="font-semibold text-lg text-gray-900 dark:text-white">
                        {benchmark.webGPUSupported ? '✅ Supported' : '❌ Not Available'}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Estimated Memory</div>
                      <div className="font-semibold text-lg text-gray-900 dark:text-white">{benchmark.estimatedMemoryGB}GB</div>
                    </div>
                    <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">CPU Cores</div>
                      <div className="font-semibold text-lg text-gray-900 dark:text-white">{benchmark.cpuCores}</div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700/50">
                    <div className="flex items-start space-x-2">
                      <span className="text-green-600 dark:text-green-400">🎯</span>
                      <div>
                        <div className="font-semibold text-green-800 dark:text-green-200">Recommended Model</div>
                        <div className="text-green-700 dark:text-green-300">
                          {transcriptionModels.local.find(m => m.id === benchmark.recommendedModel)?.name || benchmark.recommendedModel}
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                          Optimized for your {benchmark.deviceClass} device
                          {benchmark.webGPUSupported && ' with Apple Silicon GPU acceleration'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Local Processing Info */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700/50">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">🔒</span>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200">100% Local Processing</h3>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                      Your recommended model runs completely locally for maximum privacy:
                    </p>
                    <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-4">
                      <li>• 🔒 Zero data sent to external servers</li>
                      <li>• ⚡ No internet required after model download</li>
                      <li>• 🆓 No API costs or usage limits</li>
                      <li>• 🛡️ Complete privacy and security</li>
                      <li>• 📱 Optimized for your device capabilities</li>
                    </ul>
                    <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                      💡 Want advanced features? Voxtral is available as a cloud option with API key!
                    </div>
                  </div>
                </div>
              )}
              
              {!benchmark && !isBenchmarking && (
                <div className="text-gray-600 dark:text-gray-400">
                  Run a performance test to get personalized model recommendations for your device.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center">
              <Button onClick={handleSaveModelSettings} disabled={!hasChanges || loading}>
                  {hasChanges ? 'Save Changes' : 'Saved'}
              </Button>
              <Button onClick={handleLogout} variant="danger">Logout</Button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void; }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">{label}</label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
            />
        </div>
    );
}


function SettingSelectRow({ title, selectedProvider, setSelectedProvider, providers, selectedModel, setSelectedModel, models }: {
  title: string;
  selectedProvider: string;
  setSelectedProvider: (provider: string) => void;
  providers: string[];
  selectedModel: string | null;
  setSelectedModel: (model: string) => void;
  models: Record<string, Model[]>;
}) {
  const selectedModelData = models[selectedProvider]?.find((m: Model) => m.id === selectedModel);
  const selectedModelDesc = selectedModelData?.description || '';
  const isLocal = selectedProvider === 'local';

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => {
              const newProvider = e.target.value;
              setSelectedProvider(newProvider);
              setSelectedModel(models[newProvider][0].id);
            }}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {providers.map((p: string) => (
              <option key={p} value={p} className="capitalize">
                {p === 'local' ? 'Local (Browser)' : p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Model</label>
          <select
            value={selectedModel || ''}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            disabled={!selectedProvider}
          >
            {selectedProvider && models[selectedProvider].map((m: Model) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.size && `(${m.size})`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedModelDesc}</p>
        {isLocal && selectedModelData && (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            {selectedModelData.size && (
              <div>📦 <strong>Size:</strong> {selectedModelData.size}</div>
            )}
            {selectedModelData.languages && (
              <div>🌍 <strong>Languages:</strong> {selectedModelData.languages}</div>
            )}
            {selectedProvider === 'local' && (
              <div className="text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 p-2 rounded">
                ℹ️ <strong>Privacy:</strong> Runs entirely in your browser. No data sent to external servers.
              </div>
            )}
            {selectedProvider === 'local' && (
              <div className="space-y-2">
                <div className="text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-2 rounded">
                  💡 <strong>Tip:</strong> Start with "Moonshine Tiny" (50MB, English) or "Whisper Tiny" (39MB, multilingual). 
                  For longer audio, try "Distil-Whisper Large v3.5" (756MB). If AI fails, use cloud transcription (OpenAI/Google).
                </div>
                <div className="text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 p-2 rounded">
                  🍎 <strong>Apple Silicon Performance:</strong> Your app automatically detects and uses WebGPU to leverage your M1/M2/M3/M4 chip's GPU for ultra-fast transcription. No configuration needed!
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ApiKeyInputRow({ provider, hasKey, value, onChange, onSave }: {
  provider: string;
  hasKey: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const getProviderInfo = (provider: string) => {
    switch (provider) {
      case 'mistral':
        return {
          name: '🎯 Mistral (Voxtral)',
          description: 'For revolutionary Voxtral audio models with semantic understanding',
          placeholder: hasKey ? '•••••••••••••••• Saved (Voxtral Ready)' : 'Enter Mistral API key for Voxtral models'
        };
      case 'openai':
        return {
          name: '🤖 OpenAI',
          description: 'For GPT models and Whisper transcription',
          placeholder: hasKey ? '•••••••••••••••• Saved' : 'Enter OpenAI API key'
        };
      case 'anthropic':
        return {
          name: '🧠 Anthropic (Claude)',
          description: 'For advanced reasoning and analysis tasks',
          placeholder: hasKey ? '•••••••••••••••• Saved' : 'Enter Anthropic API key'
        };
      case 'google':
        return {
          name: '🌟 Google AI',
          description: 'For Gemini models and multimodal capabilities',
          placeholder: hasKey ? '•••••••••••••••• Saved' : 'Enter Google AI API key'
        };
      default:
        return {
          name: provider.charAt(0).toUpperCase() + provider.slice(1),
          description: '',
          placeholder: hasKey ? '•••••••••••••••• Saved' : 'Enter your API key'
        };
    }
  };

  const providerInfo = getProviderInfo(provider);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 dark:text-white">{providerInfo.name}</label>
      {providerInfo.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{providerInfo.description}</p>
      )}
      <div className="flex items-center space-x-2 mt-2">
        <input
          type="password"
          placeholder={providerInfo.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <Button onClick={onSave} disabled={!value}>Save</Button>
      </div>
    </div>
  );
}