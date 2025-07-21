import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiKey } from '../../lib/schemas';
import toast from 'react-hot-toast';
import { useLocalTranscription } from '../../hooks/useLocalTranscription';

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
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Model Settings */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-bold">Model Settings</h2>
            <p className="mt-1 text-sm text-gray-500">Choose the AI models for different tasks.</p>
          </div>
          <div className="p-6 pt-0 space-y-6">
             {/* LLM */}
            <SettingSelectRow
              title="Primary LLM"
              selectedProvider={selectedLlmProvider}
              setSelectedProvider={(p) => setSelectedLlmProvider(p as LlmProvider)}
              providers={Object.keys(llmModels)}
              selectedModel={selectedLlmModel}
              setSelectedModel={setSelectedLlmModel}
              models={llmModels}
            />
             {/* Transcription */}
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
             {/* TTS */}
            <SettingSelectRow
              title="Text-to-Speech"
              selectedProvider={selectedTtsProvider}
              setSelectedProvider={(p) => setSelectedTtsProvider(p as SttTtsProvider)}
              providers={Object.keys(ttsModels)}
              selectedModel={selectedTtsModel}
              setSelectedModel={setSelectedTtsModel}
              models={ttsModels}
            />
          </div>
        </Card>

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
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">🔬 Device Performance</h2>
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
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Device Class</div>
                    <div className="font-semibold capitalize text-lg">
                      {benchmark.deviceClass === 'high-end' && '🚀 High-End'}
                      {benchmark.deviceClass === 'mid-range' && '⚡ Mid-Range'}
                      {benchmark.deviceClass === 'low-end' && '💻 Low-End'}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-gray-600">WebGPU Support</div>
                    <div className="font-semibold text-lg">
                      {benchmark.webGPUSupported ? '✅ Supported' : '❌ Not Available'}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Estimated Memory</div>
                    <div className="font-semibold text-lg">{benchmark.estimatedMemoryGB}GB</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-gray-600">CPU Cores</div>
                    <div className="font-semibold text-lg">{benchmark.cpuCores}</div>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600">🎯</span>
                    <div>
                      <div className="font-semibold text-green-800">Recommended Model</div>
                      <div className="text-green-700">
                        {transcriptionModels.local.find(m => m.id === benchmark.recommendedModel)?.name || benchmark.recommendedModel}
                      </div>
                      <div className="text-sm text-green-600 mt-1">
                        Optimized for your {benchmark.deviceClass} device
                        {benchmark.webGPUSupported && ' with Apple Silicon GPU acceleration'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Local Processing Info */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">🔒</span>
                    <h3 className="font-semibold text-green-900">100% Local Processing</h3>
                  </div>
                  <p className="text-sm text-green-700 mb-2">
                    Your recommended model runs completely locally for maximum privacy:
                  </p>
                  <ul className="text-xs text-green-600 space-y-1 ml-4">
                    <li>• 🔒 Zero data sent to external servers</li>
                    <li>• ⚡ No internet required after model download</li>
                    <li>• 🆓 No API costs or usage limits</li>
                    <li>• 🛡️ Complete privacy and security</li>
                    <li>• 🎯 Optimized for your device capabilities</li>
                  </ul>
                  <div className="mt-3 text-xs text-green-500">
                    💡 Want advanced features? Voxtral is available as a cloud option with API key!
                  </div>
                </div>
              </div>
            )}
            
            {!benchmark && !isBenchmarking && (
              <div className="text-gray-600">
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
  );
}

function PromptTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void; }) {
    return (
        <div>
            <label className="block text-sm font-medium mb-1">{label}</label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full p-2 border rounded bg-white"
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
      <h3 className="text-lg font-medium">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div>
          <label className="block text-sm font-medium mb-1">Provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => {
              const newProvider = e.target.value;
              setSelectedProvider(newProvider);
              setSelectedModel(models[newProvider][0].id);
            }}
            className="w-full p-2 border rounded bg-white"
          >
            {providers.map((p: string) => (
              <option key={p} value={p} className="capitalize">
                {p === 'local' ? 'Local (Browser)' : p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Model</label>
          <select
            value={selectedModel || ''}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full p-2 border rounded bg-white"
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
        <p className="text-sm text-gray-600">{selectedModelDesc}</p>
        {isLocal && selectedModelData && (
          <div className="text-xs text-gray-500 space-y-1">
            {selectedModelData.size && (
              <div>📦 <strong>Size:</strong> {selectedModelData.size}</div>
            )}
            {selectedModelData.languages && (
              <div>🌍 <strong>Languages:</strong> {selectedModelData.languages}</div>
            )}
            {selectedProvider === 'local' && (
              <div className="text-blue-600">
                ℹ️ <strong>Privacy:</strong> Runs entirely in your browser. No data sent to external servers.
              </div>
            )}
            {selectedProvider === 'local' && (
              <div className="space-y-2">
                <div className="text-amber-600 bg-amber-50 p-2 rounded">
                  💡 <strong>Tip:</strong> Start with "Moonshine Tiny" (50MB, English) or "Whisper Tiny" (39MB, multilingual). 
                  For longer audio, try "Distil-Whisper Large v3.5" (756MB). If AI fails, use cloud transcription (OpenAI/Google).
                </div>
                <div className="text-blue-600 bg-blue-50 p-2 rounded">
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
      <label className="block text-sm font-medium">{providerInfo.name}</label>
      {providerInfo.description && (
        <p className="text-xs text-gray-500 mt-1">{providerInfo.description}</p>
      )}
      <div className="flex items-center space-x-2 mt-2">
        <input
          type="password"
          placeholder={providerInfo.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <Button onClick={onSave} disabled={!value}>Save</Button>
      </div>
    </div>
  );
}