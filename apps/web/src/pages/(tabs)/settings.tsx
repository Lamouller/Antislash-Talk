import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiKey } from '../../lib/schemas';
import toast from 'react-hot-toast';
import { useLocalTranscription } from '../../hooks/useLocalTranscription';
import { useOllama } from '../../hooks/useOllama';
import { useLicense } from '../../lib/licensing';
import { FeatureGate, FeatureComparison } from '../../components/ui/FeatureGate';
import { Settings, Server as ServerIcon, Globe as GlobeIcon } from 'lucide-react';
import { checkWhisperXAvailability } from '../../lib/whisperx-client';
import { useTranslation } from 'react-i18next';

type LlmProvider = 'openai' | 'anthropic' | 'google' | 'mistral';
type SttTtsProvider = 'openai' | 'google' | 'mistral' | 'local';

interface Model {
  id: string;
  name: string;
  description: string;
  size?: string;
  languages?: string;
  requiresServer?: boolean;
  supportsDiarization?: boolean;
}

const llmModels: Record<LlmProvider, Model[]> = {
  openai: [
    {
      id: 'gpt-5',
      name: 'GPT-5 🚀 NEW',
      description: 'Latest flagship model. Superior math, science, finance & law capabilities with built-in thinking.',
    },
    {
      id: 'gpt-5-mini',
      name: 'GPT-5 mini',
      description: 'Cost-effective GPT-5 variant for everyday tasks.',
    },
    {
      id: 'gpt-4.5',
      name: 'GPT-4.5 🧠',
      description: 'Largest GPT model. Most natural interactions with reduced hallucinations.',
    },
    {
      id: 'o3',
      name: 'o3 (Reasoning) 🔬 EXPERIMENTAL',
      description: 'Advanced reasoning model. Thinks through complex problems step-by-step.',
    },
    {
      id: 'o1',
      name: 'o1 (Reasoning)',
      description: 'Reasoning-focused model for complex problem solving.',
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'Previous flagship model. Still excellent for most tasks.',
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o mini',
      description: 'Affordable, intelligent small model.',
    },
  ],
  anthropic: [
    {
      id: 'claude-sonnet-4-5-20251120',
      name: 'Claude Sonnet 4.5 🚀 NEW',
      description: 'Best model for agents, coding & computer use. State-of-the-art on SWE-bench.',
    },
    {
      id: 'claude-opus-4-5-20251120',
      name: 'Claude Opus 4.5 🧠',
      description: 'Most intelligent Anthropic model. Maximum capability with improved vision & coding.',
    },
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      description: 'Superior coding (72.7% SWE-bench) and reasoning capabilities.',
    },
    {
      id: 'claude-opus-4-20250514',
      name: 'Claude Opus 4',
      description: 'World\'s best coding model. Excels at complex reasoning and agent workflows.',
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet (Legacy)',
      description: 'Previous generation intelligent model.',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku (Legacy)',
      description: 'Previous generation fast model.',
    },
  ],
  google: [
    {
      id: 'gemini-3-flash-preview',
      name: 'Gemini 3 Flash 🚀 NEW',
      description: 'Latest frontier-class model. Fast performance rivaling larger models at fraction of cost.',
    },
    {
      id: 'gemini-3-pro-preview',
      name: 'Gemini 3 Pro 🧠',
      description: 'State-of-the-art reasoning across text, images, audio, and video.',
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash ⚡',
      description: 'Best price/performance. 1M context with thinking capabilities.',
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      description: 'Hybrid reasoning model with configurable thinking budgets.',
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      description: 'Previous model with multimodal capabilities.',
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro (Legacy)',
      description: 'Legacy stable production model.',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash (Legacy)',
      description: 'Legacy fast model for diverse tasks.',
    },
  ],
  mistral: [
    {
      id: 'mistral-large-latest',
      name: 'Mistral Large 3 🚀 NEW',
      description: 'Open-weight state-of-the-art multimodal model.',
    },
    {
      id: 'mistral-medium-latest',
      name: 'Mistral Medium 3.1 🧠',
      description: 'Frontier-class multimodal model.',
    },
    {
      id: 'mistral-small-latest',
      name: 'Mistral Small 3.2',
      description: 'Cost-efficient frontier model for everyday tasks.',
    },
    {
      id: 'codestral-latest',
      name: 'Codestral 💻',
      description: 'Specialized for code completion & fill-in-the-middle. 128k context.',
    },
    {
      id: 'devstral-small-latest',
      name: 'Devstral 🛠️',
      description: 'Frontier code agents model for software engineering tasks.',
    },
    {
      id: 'pixtral-large-latest',
      name: 'Pixtral Large 📸',
      description: 'Frontier multimodal model with excellent vision capabilities.',
    },
    {
      id: 'magistral-medium-latest',
      name: 'Magistral Medium',
      description: 'Specialized reasoning model.',
    },
  ],
};

const transcriptionModels: Record<SttTtsProvider, Model[]> = {
  openai: [
    {
      id: 'gpt-4o-transcribe',
      name: 'GPT-4o Transcribe 🚀 NEW',
      description: 'Latest transcription model based on GPT-4o. Superior accuracy with diarization support.',
    },
    {
      id: 'whisper-1',
      name: 'Whisper',
      description: 'Reliable speech-to-text model. No streaming support.',
    },
  ],
  google: [
    {
      id: 'gemini-3-flash-preview',
      name: 'Gemini 3 Flash 🚀 + Diarization 🎭',
      description: 'Latest frontier model with upgraded audio understanding + automatic speaker detection.',
      supportsDiarization: true
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash ⚡ + Diarization 🎭',
      description: 'Best price/performance. 1M context with native audio + automatic speaker detection.',
      supportsDiarization: true
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash + Diarization 🎭',
      description: 'Previous model with native audio understanding and speaker identification.',
      supportsDiarization: true
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro (Legacy)',
      description: 'High-quality transcription with good accuracy. No diarization.',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash (Legacy)',
      description: 'Fast transcription with good balance. No diarization.',
    },
  ],
  mistral: [
    {
      id: 'voxtral-mini-latest',
      name: 'Voxtral Mini 🎯',
      description: 'Optimized transcription model. Up to 30min audio. $0.002/min.',
    },
  ],
  local: [
    {
      id: 'Xenova/whisper-tiny',
      name: 'Tiny ⚡',
      description: 'Ultra-rapide (whisper.cpp). Pas de diarization.',
      size: '39MB',
      languages: '99 languages'
    },
    {
      id: 'Xenova/whisper-tiny+diarization',
      name: 'Tiny + Diarization 🎭 LIVE',
      description: 'Ultra-rapide avec identification des locuteurs. Parfait pour streaming live.',
      size: '39MB + 2.88GB',
      languages: '99 languages',
      requiresServer: false,
      supportsDiarization: true
    },
    {
      id: 'Xenova/whisper-base',
      name: 'Base ⭐',
      description: 'Meilleur compromis vitesse/qualité (whisper.cpp).',
      size: '74MB',
      languages: '99 languages'
    },
    {
      id: 'Xenova/whisper-base+diarization',
      name: 'Base + Diarization 🎭',
      description: 'Bon compromis avec identification des locuteurs.',
      size: '74MB + 2.88GB',
      languages: '99 languages',
      requiresServer: false,
      supportsDiarization: true
    },
    {
      id: 'onnx-community/moonshine-tiny-ONNX',
      name: 'Moonshine Tiny',
      description: 'Alternative ultra-compacte. Anglais uniquement.',
      size: '50MB',
      languages: 'English only'
    },
    {
      id: 'onnx-community/moonshine-base-ONNX',
      name: 'Moonshine Base',
      description: 'Alternative plus précise. Anglais uniquement.',
      size: '125MB',
      languages: 'English only'
    },
    {
      id: 'Xenova/whisper-small',
      name: 'Small',
      description: 'Qualité supérieure.',
      size: '244MB',
      languages: '99 languages'
    },
    {
      id: 'Xenova/whisper-small.fr',
      name: 'Small FR 🇫🇷',
      description: 'Optimisé français.',
      size: '244MB',
      languages: 'French + multilingual'
    },
    {
      id: 'distil-whisper/distil-large-v3',
      name: 'Large Distillé 🇫🇷',
      description: 'Haute qualité avec identification des locuteurs.',
      size: '756MB',
      languages: 'French + 99 languages',
      requiresServer: true,
      supportsDiarization: true
    },
    {
      id: 'Xenova/whisper-medium',
      name: 'Medium',
      description: 'Haute qualité multilangue.',
      size: '769MB',
      languages: '99 languages',
      requiresServer: true
    },
    {
      id: 'Xenova/whisper-medium+diarization',
      name: 'Medium + Diarization',
      description: 'Identification des locuteurs.',
      size: '769MB + 2.88GB',
      languages: '99 languages',
      requiresServer: true,
      supportsDiarization: true
    },
    {
      id: 'Xenova/whisper-large-v2',
      name: 'Large v2',
      description: 'Précision maximale.',
      size: '1.5GB',
      languages: '99 languages',
      requiresServer: true
    },
    {
      id: 'openai/whisper-large-v3',
      name: 'Large v3 + Diarization 🏆',
      description: 'Meilleur modèle avec identification des locuteurs.',
      size: '1.5GB',
      languages: '99 languages',
      requiresServer: true,
      supportsDiarization: true
    },
    {
      id: 'bofenghuang/whisper-large-v2-french',
      name: 'Large FR 🇫🇷',
      description: 'Spécialisé français.',
      size: '1.5GB',
      languages: 'French specialist',
      requiresServer: true
    }
  ]
};

const ttsModels: Record<SttTtsProvider, Model[]> = {
  openai: [
    { id: 'tts-1', name: 'TTS-1', description: 'Optimized for real-time streaming.' },
    { id: 'tts-1-hd', name: 'TTS-1-HD', description: 'Optimized for quality. Best for pre-generated audio.' },
  ],
  google: [
    { id: 'gemini-2.5-flash-native-audio', name: 'Gemini 2.5 Flash Native Audio 🚀 NEW', description: '30 HD voices in 24 languages. Enhanced audio quality.' },
    { id: 'gemini-3.0-flash-preview', name: 'Gemini 3 Flash TTS', description: 'Latest frontier model with audio generation capabilities.' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash TTS', description: 'Native multimodal audio generation.' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash TTS (Legacy)', description: 'Reliable text-to-speech generation.' },
  ],
  mistral: [
    {
      id: 'voxtral-small',
      name: 'Voxtral Small TTS 🎯',
      description: 'Voxtral can generate audio responses. Superior quality with semantic understanding.'
    },
    {
      id: 'mistral-tts',
      name: 'Mistral TTS (Coming Soon)',
      description: 'Dedicated TTS from Mistral AI. Currently not available.'
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

// Ollama LLM Models (for local title/summary generation)
// Sorted by RAM usage (lightweight first)
const ollamaModels: Model[] = [
  {
    id: 'none',
    name: '🚫 None (Rule-based)',
    description: 'Simple rule-based title and summary generation. Fast but less intelligent.',
    size: '0 MB',
    languages: 'All languages'
  },
  {
    id: 'gemma3:2b',
    name: 'Gemma 3 2B 🪶 ULTRA-LIGHT',
    description: 'Latest lightweight model from Google. Perfect for limited RAM.',
    size: '1.6 GB',
    languages: 'Multilingual'
  },
  {
    id: 'qwen3:3b',
    name: 'Qwen 3 3B 🚀 FAST',
    description: 'Latest Qwen model. Excellent speed/quality ratio with strong multilingual support.',
    size: '2 GB',
    languages: 'Multilingual (Chinese, English, French)'
  },
  {
    id: 'phi4:mini',
    name: 'Phi-4 Mini ⚡ NEW',
    description: 'Latest lightweight model from Microsoft. Improved reasoning capabilities.',
    size: '2.5 GB',
    languages: 'English, French'
  },
  {
    id: 'llama3.3:latest',
    name: 'Llama 3.3 🦙 🏆 RECOMMENDED',
    description: 'State-of-the-art from Meta. Same performance as 405B in smaller package. 8 languages.',
    size: '4 GB',
    languages: 'English, French, German, Italian, Portuguese, Hindi, Spanish, Thai'
  },
  {
    id: 'deepseek-r1:8b',
    name: 'DeepSeek-R1 8B 🧠 NEW',
    description: 'Advanced reasoning model. Excellent for complex analysis tasks.',
    size: '5 GB',
    languages: 'Multilingual'
  },
  {
    id: 'mistral-small:latest',
    name: 'Mistral Small 3.1 🇫🇷',
    description: 'Latest Mistral small model. Excellent for French with improved capabilities.',
    size: '4 GB',
    languages: 'French, English, multilingual'
  },
  {
    id: 'qwen3:7b',
    name: 'Qwen 3 7B 🎯 QUALITY',
    description: 'Larger Qwen 3 model with excellent quality. Great for detailed analysis.',
    size: '4.7 GB',
    languages: 'Multilingual (Chinese, English, French)'
  },
  {
    id: 'gemma3:9b',
    name: 'Gemma 3 9B 🇫🇷',
    description: 'Latest Google model with excellent French support. Great for detailed analysis.',
    size: '5.5 GB',
    languages: 'Multilingual, strong French performance'
  },
  {
    id: 'llama3.2:latest',
    name: 'Llama 3.2 (Legacy)',
    description: 'Previous Llama model. Still good for general use.',
    size: '2 GB',
    languages: 'Multilingual'
  },
  {
    id: 'mistral',
    name: 'Mistral 7B (Legacy)',
    description: 'Previous Mistral model. Still excellent for French.',
    size: '4 GB',
    languages: 'French, English, multilingual'
  }
];

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { runBenchmark, benchmark } = useLocalTranscription();
  const { pullModel } = useOllama();
  const [loading, setLoading] = useState(true);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [apiKeys, setApiKeys] = useState<Partial<ApiKey>[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState(false);

  // Ollama status
  const [ollamaStatus, setOllamaStatus] = useState<{
    available: boolean;
    models: string[];
    checking: boolean;
  }>({ available: false, models: [], checking: false });

  // PyTorch status
  const [pytorchStatus, setPytorchStatus] = useState<{
    available: boolean;
    diarization: boolean;
    checking: boolean;
  }>({ available: false, diarization: false, checking: false });

  // WhisperX status
  const [whisperXStatus, setWhisperXStatus] = useState<{
    available: boolean;
    diarization: boolean;
    checking: boolean;
    device: string;
  }>({ available: false, diarization: false, checking: false, device: 'cpu' });

  // Pyannote models status
  const [pyannoteModels, setPyannoteModels] = useState<Array<{
    id: string;
    name: string;
    size: string;
    description: string;
    required: boolean;
    main: boolean;
    downloaded: boolean;
  }>>([]);
  const [downloadingPyannote, setDownloadingPyannote] = useState(false);

  // LLM State
  const [selectedLlmProvider, setSelectedLlmProvider] = useState<LlmProvider>('openai');
  const [selectedLlmModel, setSelectedLlmModel] = useState<string | null>(null);

  // Transcription State
  const [preferredTranscriptionProvider, setPreferredTranscriptionProvider] = useState<SttTtsProvider>('openai');
  const [preferredTranscriptionModel, setPreferredTranscriptionModel] = useState<string | null>(null);

  // TTS State
  const [selectedTtsProvider, setSelectedTtsProvider] = useState<SttTtsProvider>('openai');
  const [selectedTtsModel, setSelectedTtsModel] = useState<string | null>(null);

  // Ollama LLM State (for local analysis)
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('none');

  // Prompt State
  const [promptTitle, setPromptTitle] = useState('');
  const [promptSummary, setPromptSummary] = useState('');
  const [promptTranscript, setPromptTranscript] = useState('');

  // Recording Behavior State
  const [autoTranscribeAfterRecording, setAutoTranscribeAfterRecording] = useState(true);

  // Streaming Transcription State
  const [enableStreamingTranscription, setEnableStreamingTranscription] = useState(false);
  const [autoGenerateSummaryAfterStreaming, setAutoGenerateSummaryAfterStreaming] = useState(false);


  // Language Preference State
  const [preferredLanguage, setPreferredLanguage] = useState<'fr' | 'en'>('fr');

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setPreferredLanguage(lng as 'fr' | 'en');
  };

  // Marketing Pages Visibility State
  const [hideMarketingPages, setHideMarketingPages] = useState(false);
  const isMarketingPagesGloballyForced = import.meta.env.VITE_HIDE_MARKETING_PAGES === 'true';

  const [apiKeyInputs, setApiKeyInputs] = useState({ openai: '', anthropic: '', google: '', mistral: '' });

  const { license, isEnterprise, upgradeUrl } = useLicense();

  // Check Ollama availability and installed models
  const checkOllamaStatus = async () => {
    if (preferredTranscriptionProvider !== 'local') return;

    setOllamaStatus(prev => ({ ...prev, checking: true }));

    try {
      const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
      const response = await fetch(`${OLLAMA_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        const installedModels = data.models?.map((m: any) => m.name.split(':')[0]) || [];

        setOllamaStatus({
          available: true,
          models: installedModels,
          checking: false,
        });
      } else {
        setOllamaStatus({ available: false, models: [], checking: false });
      }
    } catch (error) {
      setOllamaStatus({ available: false, models: [], checking: false });
    }
  };

  // Check PyTorch service availability
  const checkPyTorchStatus = async () => {
    if (preferredTranscriptionProvider !== 'local') return;

    setPytorchStatus(prev => ({ ...prev, checking: true }));

    try {
      const PYTORCH_URL = import.meta.env.VITE_PYTORCH_SERVICE_URL || 'http://localhost:8000';
      const response = await fetch(`${PYTORCH_URL}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();

        setPytorchStatus({
          available: true,
          diarization: data.models?.diarization === true,
          checking: false,
        });
      } else {
        setPytorchStatus({ available: false, diarization: false, checking: false });
      }
    } catch (error) {
      setPytorchStatus({ available: false, diarization: false, checking: false });
    }
  };

  const checkWhisperXStatus = async () => {
    if (preferredTranscriptionProvider !== 'local') return;

    setWhisperXStatus(prev => ({ ...prev, checking: true }));

    try {
      const WHISPERX_URL = import.meta.env.VITE_WHISPERX_URL || 'http://localhost:8082';
      const response = await fetch(`${WHISPERX_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();

        setWhisperXStatus({
          available: true,
          diarization: data.diarization_available === true,
          checking: false,
          device: data.device || 'cpu',
        });

        // Fetch Pyannote models list if WhisperX is available
        await fetchPyannoteModels();
      } else {
        setWhisperXStatus({ available: false, diarization: false, checking: false, device: 'cpu' });
      }
    } catch (error) {
      setWhisperXStatus({ available: false, diarization: false, checking: false, device: 'cpu' });
    }
  };

  // Download Ollama model
  const handleDownloadModel = async () => {
    if (!selectedOllamaModel || selectedOllamaModel === 'none') return;

    setDownloadingModel(true);
    const toastId = toast.loading(`📥 Downloading ${selectedOllamaModel}... This may take a few minutes.`);

    try {
      await pullModel(selectedOllamaModel);
      toast.success(`✅ ${selectedOllamaModel} downloaded successfully!`, { id: toastId });

      // Refresh status to show the new model
      await checkOllamaStatus();
    } catch (error) {
      console.error('Failed to download model:', error);
      toast.error(
        `❌ Failed to download model. Make sure Ollama is running and you have enough disk space.`,
        { id: toastId }
      );
    } finally {
      setDownloadingModel(false);
    }
  };

  // Download Pyannote models for diarization
  // Fetch Pyannote models list
  const fetchPyannoteModels = async () => {
    try {
      const response = await fetch('http://localhost:8082/pyannote-models', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.available && data.models) {
        setPyannoteModels(data.models);
      }
    } catch (error) {
      console.error('Failed to fetch Pyannote models:', error);
    }
  };

  // Download all Pyannote models at once
  const handleDownloadPyannote = async () => {
    setDownloadingPyannote(true);
    const toastId = toast.loading(`📥 Downloading all Pyannote models... This may take 5-10 minutes.`);

    try {
      const response = await fetch('http://localhost:8082/download-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'pyannote' })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      toast.success(`✅ All Pyannote models downloaded successfully!`, { id: toastId });

      // Refresh models list and WhisperX status
      await fetchPyannoteModels();
      await checkWhisperXStatus();
    } catch (error) {
      console.error('Failed to download Pyannote:', error);
      toast.error(
        `❌ Failed to download Pyannote models. Make sure WhisperX is running and you've accepted HuggingFace conditions.`,
        { id: toastId, duration: 6000 }
      );
    } finally {
      setDownloadingPyannote(false);
    }
  };

  useEffect(() => {
    fetchProfileAndKeys();
  }, []);

  // Check Ollama, PyTorch, and WhisperX status when transcription provider changes to local
  useEffect(() => {
    if (preferredTranscriptionProvider === 'local') {
      checkOllamaStatus();
      checkPyTorchStatus();
      checkWhisperXStatus();
    }
  }, [preferredTranscriptionProvider]);

  // Re-check PyTorch and WhisperX when transcription model changes (to detect SERVER models and diarization)
  useEffect(() => {
    if (preferredTranscriptionProvider === 'local' && preferredTranscriptionModel) {
      const selectedModel = transcriptionModels.local.find(m => m.id === preferredTranscriptionModel);
      if (selectedModel && (selectedModel as any).requiresServer) {
        checkPyTorchStatus();
      }
      if (selectedModel && (selectedModel as any).supportsDiarization) {
        checkWhisperXStatus();
      }
    }
  }, [preferredTranscriptionModel]);

  useEffect(() => {
    if (!loading) setHasChanges(true);
  }, [selectedLlmProvider, selectedLlmModel, preferredTranscriptionProvider, preferredTranscriptionModel, selectedTtsProvider, selectedTtsModel, promptTitle, promptSummary, promptTranscript, autoTranscribeAfterRecording, enableStreamingTranscription, autoGenerateSummaryAfterStreaming, preferredLanguage, hideMarketingPages]);


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
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      // Set initial state from profile
      const llmProvider = profileData.preferred_llm as LlmProvider || 'openai';
      setSelectedLlmProvider(llmProvider);
      setSelectedLlmModel(profileData.preferred_llm_model || llmModels[llmProvider][0].id);

      // Load Ollama model preference (stored in same column but used for local transcriptions)
      setSelectedOllamaModel(profileData.preferred_llm_model || 'none');

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

      // Set recording behavior preference
      setAutoTranscribeAfterRecording(profileData.auto_transcribe_after_recording ?? true);

      // Set streaming transcription preference
      setEnableStreamingTranscription(profileData.enable_streaming_transcription ?? false);
      setAutoGenerateSummaryAfterStreaming(profileData.auto_generate_summary_after_streaming ?? false);

      // Set language preference
      // Set language preference
      const profileLang = profileData.preferred_language || 'fr';
      setPreferredLanguage(profileLang);
      if (profileLang !== i18n.language) {
        i18n.changeLanguage(profileLang);
      }

      // Set marketing pages visibility preference
      setHideMarketingPages(profileData.hide_marketing_pages ?? false);

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
      // Fix: Always save the selected Cloud LLM model. Local LLM logic (if any) should be handled explicitly.
      preferred_llm_model: selectedLlmModel,
      preferred_transcription_provider: preferredTranscriptionProvider,
      preferred_transcription_model: preferredTranscriptionModel,
      preferred_tts_provider: selectedTtsProvider,
      preferred_tts_model: selectedTtsModel,
      prompt_title: promptTitle,
      prompt_summary: promptSummary,
      prompt_transcript: promptTranscript,
      auto_transcribe_after_recording: autoTranscribeAfterRecording,
      enable_streaming_transcription: enableStreamingTranscription,
      auto_generate_summary_after_streaming: autoGenerateSummaryAfterStreaming,
      preferred_language: preferredLanguage,
      hide_marketing_pages: hideMarketingPages,
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

  // Get ALL models with annotations based on device capabilities
  const getRecommendedModels = () => {
    if (!benchmark) return transcriptionModels.local;

    const allModels = transcriptionModels.local;

    // Annoter TOUS les modèles selon les capacités de l'appareil
    return allModels.map(model => {
      const isRecommended = model.id === benchmark.recommendedModel;
      const isHeavy = model.id.includes('large') || model.id.includes('medium');
      const requiresServer = (model as any).requiresServer === true;

      let annotation = '';

      if (isRecommended) {
        annotation = ' 🎯 RECOMMANDÉ';
      } else if (requiresServer) {
        annotation = ' (Serveur PyTorch requis)';
      } else if (benchmark.deviceClass === 'low-end' && isHeavy) {
        annotation = ' ⚠️ PEUT ÉCHOUER';
      } else if (benchmark.deviceClass === 'mid-range' && model.id.includes('large')) {
        annotation = ' ⚠️ TRÈS LOURD';
      }

      return {
        ...model,
        name: model.name + annotation
      };
    });
  };

  if (loading) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
    >
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-black tracking-tight flex items-center">
              <div className="p-2.5 bg-gray-100/80 rounded-xl mr-4">
                <Settings className="w-6 h-6 text-gray-700" />
              </div>
              {t('settings.title')}
            </h1>
            <p className="text-gray-500 text-sm mt-1 ml-14">
              {isEnterprise() ? 'Enterprise Edition' : 'Community Edition'}
            </p>
          </div>

          <div className="space-y-8">

            {/* Language Selector (New Placement) */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <GlobeIcon className="w-5 h-5" />
                {t('settings.language')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => changeLanguage('fr')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${i18n.language === 'fr'
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400'
                    }`}
                >
                  <div className="font-medium">Français</div>
                  <div className="text-sm opacity-70">Langue par défaut</div>
                </button>
                <button
                  onClick={() => changeLanguage('en')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${i18n.language === 'en'
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400'
                    }`}
                >
                  <div className="font-medium">English</div>
                  <div className="text-sm opacity-70">International</div>
                </button>
              </div>
            </Card>

            {!isEnterprise() && (
              <div className="mb-6 p-4 bg-white/40 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-800">
                      🚀 Want more features?
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Upgrade to Enterprise for cloud AI, team collaboration, and priority support
                    </p>
                  </div>
                  <button
                    onClick={() => window.open(upgradeUrl, '_blank')}
                    className="px-4 py-2 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            )}

            {/* License Information */}
            <div className="mb-8 p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                📄 License Information
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">License Type</div>
                  <div className="font-medium text-gray-900">
                    {license.type === 'enterprise' ? '💼 Enterprise' : '🆓 Community (MIT)'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Support Level</div>
                  <div className="font-medium text-gray-900">
                    {license.metadata?.supportLevel === 'premium' ? '🚀 Priority Support' : '👥 Community Support'}
                  </div>
                </div>
                {license.metadata?.organizationId && (
                  <div>
                    <div className="text-sm text-gray-600">Organization</div>
                    <div className="font-medium text-gray-900">{license.metadata.organizationId}</div>
                  </div>
                )}
                {license.metadata?.licenseKey && (
                  <div>
                    <div className="text-sm text-gray-600">License Key</div>
                    <div className="font-mono text-sm text-gray-700">
                      {license.metadata.licenseKey.slice(0, 8)}...{license.metadata.licenseKey.slice(-4)}
                    </div>
                  </div>
                )}
              </div>
              {!isEnterprise() && (
                <div className="mt-4 pt-4 border-t border-gray-200/50">
                  <div className="text-sm text-gray-600">
                    📋 Want to see what Enterprise includes?
                    <a href={upgradeUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-gray-600 hover:text-gray-600 font-medium">
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
                <div className="mt-4 mb-6 p-3 bg-gray-50/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">License: </span>
                      {isEnterprise() ? (
                        <span className="text-gray-600 font-medium">💼 Enterprise</span>
                      ) : (
                        <span className="text-gray-600">🆓 Community (MIT)</span>
                      )}
                    </div>
                    {!isEnterprise() && (
                      <button
                        onClick={() => window.open(upgradeUrl, '_blank')}
                        className="px-3 py-1 bg-gray-500 hover:bg-gray-800 text-white text-xs rounded-lg transition-colors"
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

                  {/* PyTorch Service Status (only for SERVER models) */}
                  {preferredTranscriptionProvider === 'local' && preferredTranscriptionModel && (() => {
                    const selectedModel = transcriptionModels.local.find(m => m.id === preferredTranscriptionModel);
                    return selectedModel && (selectedModel as any).requiresServer;
                  })() && (
                      <div className="mt-4 p-4 bg-white/40 rounded-xl border border-gray-200/50">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-lg">🖥️</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900">
                              PyTorch Transcription Service
                            </h3>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Server-side Whisper models (Medium, Large) with optional diarization
                            </p>
                          </div>
                        </div>

                        {pytorchStatus.checking ? (
                          <div className="mt-3 p-3 bg-gray-50/50 border border-gray-200/50 rounded-lg">
                            <p className="text-xs text-gray-600">
                              🔄 Checking PyTorch service status...
                            </p>
                          </div>
                        ) : pytorchStatus.available ? (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-xs text-gray-800">
                              ✅ <strong>PyTorch service is running!</strong>
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {pytorchStatus.diarization ? (
                                <>🎭 <strong>Diarization enabled</strong> - Speaker separation available</>
                              ) : (
                                <>
                                  ⚠️ <strong>Diarization disabled</strong> - Set HUGGINGFACE_TOKEN in docker-compose.monorepo.yml
                                  <button
                                    onClick={async () => {
                                      try {
                                        const toastId = toast.loading('📥 Downloading Pyannote models... This may take a few minutes.');
                                        const response = await fetch('http://localhost:8000/download-pyannote', {
                                          method: 'POST'
                                        });
                                        if (response.ok) {
                                          toast.success('✅ Pyannote models downloaded! Diarization enabled.', { id: toastId });
                                          await checkPyTorchStatus();
                                        } else {
                                          const error = await response.json();
                                          toast.error(`❌ ${error.detail}`, { id: toastId });
                                        }
                                      } catch (error) {
                                        toast.error('❌ Failed to download Pyannote models');
                                      }
                                    }}
                                    className="ml-2 text-xs px-2 py-1 bg-black text-white rounded hover:bg-gray-800"
                                  >
                                    📥 Download Pyannote
                                  </button>
                                </>
                              )}
                            </p>

                          </div>
                        ) : (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-xs text-gray-800 mb-2">
                              📦 <strong>Start PyTorch service:</strong>
                            </p>
                            <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block font-mono">
                              docker-compose -f docker-compose.monorepo.yml --profile pytorch up -d
                            </code>
                            <p className="text-xs text-gray-600 mt-2">
                              💡 For diarization (speaker identification), set HUGGINGFACE_TOKEN in docker-compose.monorepo.yml
                            </p>
                            <button
                              onClick={checkPyTorchStatus}
                              className="mt-2 text-xs text-gray-600 hover:underline"
                            >
                              🔄 Check again
                            </button>

                          </div>
                        )}
                      </div>
                    )}

                  {/* WhisperX Service Status (only for DIARIZATION models) */}
                  {preferredTranscriptionProvider === 'local' && preferredTranscriptionModel && (() => {
                    const selectedModel = transcriptionModels.local.find(m => m.id === preferredTranscriptionModel);
                    return selectedModel && (selectedModel as any).supportsDiarization;
                  })() && (
                      <div className="mt-4 p-4 bg-gray-50/50 rounded-xl border border-gray-200/50">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-lg">🏆</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900">
                              WhisperX Ultra-Fast Diarization
                            </h3>
                            <p className="text-xs text-gray-600 mt-0.5">
                              6x faster than PyTorch + Pyannote (30-40s vs 4min per hour)
                            </p>
                          </div>
                        </div>

                        {whisperXStatus.checking ? (
                          <div className="mt-3 p-3 bg-gray-50/50 border border-gray-200/50 rounded-lg">
                            <p className="text-xs text-gray-600">
                              🔍 Checking WhisperX service...
                            </p>
                          </div>
                        ) : whisperXStatus.available ? (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-xs text-gray-800">
                              ✅ <strong>WhisperX service is running!</strong>
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {whisperXStatus.diarization ? (
                                <>🎭 <strong>Diarization enabled</strong> - Ultra-fast speaker separation on <strong>{whisperXStatus.device.toUpperCase()}</strong></>
                              ) : (
                                <>⚠️ <strong>Diarization disabled</strong> - Download Pyannote models below</>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              ⚡ <strong>Performance:</strong> {whisperXStatus.device === 'cuda' ? '18x faster than PyTorch (GPU)' : '6x faster than PyTorch (CPU)'}
                            </p>

                            {/* Bouton pour télécharger Pyannote si diarization non disponible */}
                            {!whisperXStatus.diarization && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs text-gray-600 mb-3">
                                  🎭 <strong>Pyannote Models for Diarization:</strong>
                                </p>

                                {/* Pyannote Models List */}
                                {pyannoteModels.length > 0 ? (
                                  <div className="space-y-2">
                                    {pyannoteModels.map((model) => (
                                      <div
                                        key={model.id}
                                        className={`flex items-center justify-between p-2 rounded-lg border ${model.main
                                          ? 'bg-gray-50 border-gray-300'
                                          : 'bg-gray-50/50 border-gray-200'
                                          }`}
                                      >
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className={`text-xs font-medium ${model.main ? 'text-gray-900' : 'text-gray-700'
                                              }`}>
                                              {model.name}
                                            </span>
                                            {model.main && (
                                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-500 text-white rounded font-semibold">
                                                📦 MAIN MODEL
                                              </span>
                                            )}
                                            {!model.main && (
                                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-300 text-gray-700 rounded">
                                                🔄 AUTO
                                              </span>
                                            )}
                                            {model.downloaded && (
                                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                ✓ INSTALLED
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[10px] text-gray-600 mt-0.5">
                                            {model.description} • {model.size}
                                          </p>
                                        </div>
                                      </div>
                                    ))}

                                    {/* Big Download button if main model not downloaded */}
                                    {pyannoteModels.some(m => m.main && !m.downloaded) && (
                                      <button
                                        onClick={handleDownloadPyannote}
                                        disabled={downloadingPyannote}
                                        className="w-full mt-3 px-4 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                      >
                                        <span className="text-lg">📥</span>
                                        <span>{downloadingPyannote ? 'Downloading...' : 'Download Main Model + Dependencies (2.88 GB total)'}</span>
                                      </button>
                                    )}

                                    {/* All installed message */}
                                    {pyannoteModels.every(m => m.downloaded) && (
                                      <div className="mt-3 p-2 bg-gray-50 border border-gray-300 rounded-lg">
                                        <p className="text-xs text-gray-600 text-center font-medium">
                                          ✅ All models installed! Diarization ready.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500">
                                    Loading models list...
                                  </p>
                                )}

                                <p className="text-xs text-gray-500 mt-3">
                                  💡 Requires accepting conditions on HuggingFace first
                                </p>
                                <div className="text-xs text-gray-500 mt-1 space-y-1">
                                  <a
                                    href="https://huggingface.co/pyannote/speaker-diarization-3.1"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block hover:underline"
                                  >
                                    → Accept speaker-diarization-3.1 ↗
                                  </a>
                                  <a
                                    href="https://huggingface.co/pyannote/segmentation-3.0"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block hover:underline"
                                  >
                                    → Accept segmentation-3.0 ↗
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-xs text-gray-800 mb-2">
                              📦 <strong>Start WhisperX service (optional, but MUCH faster):</strong>
                            </p>
                            <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block font-mono">
                              docker-compose -f docker-compose.monorepo.yml --profile whisperx up -d
                            </code>
                            <p className="text-xs text-gray-600 mt-2">
                              💡 Requires HUGGINGFACE_TOKEN in docker-compose.monorepo.yml for diarization
                            </p>
                            <p className="text-xs text-gray-600 mt-2">
                              🏆 <strong>Why WhisperX?</strong> Uses faster-whisper (C++ optimized) + native diarization = 6x faster!
                            </p>
                            <button
                              onClick={checkWhisperXStatus}
                              className="mt-2 text-xs text-gray-600 hover:underline"
                            >
                              🔄 Check again
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Feature gate for cloud providers */}
                  {preferredTranscriptionProvider !== 'local' && (
                    <FeatureGate feature="cloudAIProviders">
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-800">
                          🎉 Enterprise cloud AI features enabled!
                        </p>
                      </div>
                    </FeatureGate>
                  )}

                  {/* Ollama LLM Model Selection (only for local transcriptions) */}
                  {preferredTranscriptionProvider === 'local' && (
                    <div className="mt-4 p-4 bg-white/40 rounded-xl border border-gray-200/50">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-lg">🦙</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Local LLM for Title & Summary
                          </h3>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Ollama model for generating meeting titles and summaries (100% local, no API needed)
                          </p>
                          <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-xs text-gray-800 mb-1">
                              ⚠️ <strong>RAM Required:</strong> Increase Docker memory to at least 6 GB in Docker Desktop Settings → Resources
                            </p>
                            <p className="text-xs text-gray-800">
                              ⏱️ <strong>Slow CPU?</strong> Generation can take 5-10 minutes. Use "None" for instant results or upgrade to cloud APIs.
                            </p>
                          </div>
                        </div>
                      </div>

                      <select
                        value={selectedOllamaModel}
                        onChange={(e) => {
                          setSelectedOllamaModel(e.target.value);
                          setHasChanges(true);
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                      >
                        {ollamaModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name} - {model.description}
                          </option>
                        ))}
                      </select>

                      {selectedOllamaModel !== 'none' && (
                        <>
                          {ollamaStatus.checking ? (
                            <div className="mt-3 p-3 bg-gray-50/50 border border-gray-200/50 rounded-lg">
                              <p className="text-xs text-gray-600">
                                🔄 Checking Ollama status...
                              </p>
                            </div>
                          ) : ollamaStatus.available && ollamaStatus.models.includes(selectedOllamaModel.split(':')[0]) ? (
                            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                              <p className="text-xs text-gray-800">
                                ✅ <strong>{ollamaModels.find(m => m.id === selectedOllamaModel)?.name}</strong> is ready!
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                💡 Model size: {ollamaModels.find(m => m.id === selectedOllamaModel)?.size}
                              </p>
                            </div>
                          ) : !ollamaStatus.available ? (
                            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                              <p className="text-xs text-gray-800 mb-2">
                                📦 <strong>Start Ollama service:</strong>
                              </p>
                              <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block font-mono">
                                docker-compose -f docker-compose.monorepo.yml --profile ollama up -d
                              </code>
                              <button
                                onClick={checkOllamaStatus}
                                className="mt-2 text-xs text-gray-600 hover:underline"
                              >
                                🔄 Check again
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="text-xs text-gray-800 font-semibold">
                                    📥 Model not installed
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    💾 Size: {ollamaModels.find(m => m.id === selectedOllamaModel)?.size}
                                  </p>
                                </div>
                                <button
                                  onClick={handleDownloadModel}
                                  disabled={downloadingModel}
                                  className="px-4 py-2 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white text-xs font-medium rounded-lg shadow-md hover:shadow-lg transition-all disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {downloadingModel ? (
                                    <>
                                      <span className="animate-spin">⏳</span>
                                      Downloading...
                                    </>
                                  ) : (
                                    <>
                                      <span>📥</span>
                                      Download Model
                                    </>
                                  )}
                                </button>
                              </div>
                              {downloadingModel && (
                                <p className="text-xs text-gray-600 mt-2">
                                  ⏱️ This may take several minutes depending on your internet speed...
                                </p>
                              )}
                              {!downloadingModel && (
                                <button
                                  onClick={checkOllamaStatus}
                                  className="mt-2 text-xs text-gray-500 hover:underline"
                                >
                                  🔄 Refresh status
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {selectedOllamaModel === 'none' && (
                        <div className="mt-3 p-3 bg-gray-50/50 border border-gray-200/50 rounded-lg">
                          <p className="text-xs text-gray-600">
                            ⚡ Rule-based generation active. Fast but less intelligent. Install Ollama for better results.
                          </p>
                        </div>
                      )}
                    </div>
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

            {/* Recording Behavior Settings */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-bold">🎬 Recording Behavior</h2>
                <p className="mt-1 text-sm text-gray-500">Control how the app behaves after recording audio.</p>
              </div>
              <div className="p-6 pt-0">
                <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-200/30">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">
                      Auto-transcribe after recording
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {autoTranscribeAfterRecording
                        ? "Automatically start transcription when recording stops"
                        : "Ask for confirmation before starting transcription"
                      }
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoTranscribeAfterRecording}
                      onChange={(e) => setAutoTranscribeAfterRecording(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>

                {/* Streaming Transcription Toggle */}
                <div className="mt-4 flex items-center justify-between p-4 bg-white/40 rounded-xl border border-gray-200/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        🚀 Live Streaming Transcription
                      </h3>
                      <span className="px-2 py-0.5 text-xs font-semibold bg-black text-white rounded-full">
                        NEW
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {enableStreamingTranscription
                        ? preferredTranscriptionProvider === 'google' 
                          ? "⚡ Real-time transcription with Gemini Live API + diarization enhancement"
                          : preferredTranscriptionProvider === 'openai'
                            ? "⚡ Real-time transcription with OpenAI Whisper API"
                            : "⚡ Real-time transcription with live text appearing as you speak (requires WhisperX or whisper.cpp)"
                        : "📦 Batch transcription after recording ends (standard mode)"
                      }
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {preferredTranscriptionProvider === 'google' 
                        ? "💡 Phase 1: Gemini 2.0 Live (temps réel) → Phase 2: Amélioration avec le modèle sélectionné"
                        : preferredTranscriptionProvider === 'openai'
                          ? "💡 OpenAI: Transcription cloud rapide et précise"
                          : "💡 Streaming gives instant feedback - see text appear live!"
                      }
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={enableStreamingTranscription}
                      onChange={(e) => setEnableStreamingTranscription(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>

                {/* Auto-Generate AI Summary Toggle */}
                <div className="mt-4 flex items-center justify-between p-4 bg-white/40 rounded-xl border border-gray-200/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        🤖 Auto-Generate Summary
                      </h3>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {autoGenerateSummaryAfterStreaming
                        ? "✨ Automatically generate title and summary after transcription completes."
                        : "📝 Generate title and summary manually from the meeting detail page."
                      }
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      💡 Uses your preferred LLM provider (Gemini, OpenAI, etc.)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={autoGenerateSummaryAfterStreaming}
                      onChange={(e) => setAutoGenerateSummaryAfterStreaming(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>

                <div className="mt-4 p-4 bg-gray-50/50 rounded-xl border border-gray-200/30">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      🌍 Preferred Language / Langue préférée
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Language for titles, summaries, and default prompts • Langue pour les titres, résumés et prompts par défaut
                    </p>
                    <select
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value as 'fr' | 'en')}
                      className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-black focus:shadow-lg focus:shadow-black/5"
                    >
                      <option value="fr">🇫🇷 Français</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      {preferredLanguage === 'fr'
                        ? "Les prompts seront optimisés pour chaque LLM en français"
                        : "Prompts will be optimized for each LLM in English"
                      }
                    </p>
                  </div>
                </div>

                {/* Hide Marketing Pages Toggle */}
                <div className="mt-4 flex items-center justify-between p-4 bg-white/40 rounded-xl border border-gray-200/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        🎯 Hide marketing pages
                      </h3>
                      {isMarketingPagesGloballyForced && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">
                          FORCED BY CONFIG
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {hideMarketingPages || isMarketingPagesGloballyForced
                        ? "🚀 Skip home and marketing pages - go directly to login"
                        : "📋 Show home page and full marketing content (default)"
                      }
                    </p>
                    {isMarketingPagesGloballyForced && (
                      <p className="text-xs text-gray-500 mt-1">
                        ⚙️ Marketing pages are hidden globally via VITE_HIDE_MARKETING_PAGES environment variable
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Perfect for client deployments - removes promotional content and enables direct login access
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={hideMarketingPages || isMarketingPagesGloballyForced}
                      onChange={(e) => setHideMarketingPages(e.target.checked)}
                      disabled={isMarketingPagesGloballyForced}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600 ${isMarketingPagesGloballyForced ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  </label>
                </div>
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
                    onChange={v => setApiKeyInputs(prev => ({ ...prev, [p]: v }))}
                    onSave={() => handleApiKeySave(p)}
                  />
                )}
              </div>
            </Card>

            {/* Device Performance Section */}
            {preferredTranscriptionProvider === 'local' && (
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-gray-200/50 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">🔬 Device Performance</h2>
                  <button
                    onClick={handleRunBenchmark}
                    disabled={isBenchmarking}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    {isBenchmarking ? '🔄 Testing...' : '🔬 Run Test'}
                  </button>
                </div>

                {benchmark && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded-lg">
                        <div className="text-sm text-gray-600">Device Class</div>
                        <div className="font-semibold capitalize text-lg text-gray-900">
                          {benchmark.deviceClass === 'high-end' && '🚀 High-End'}
                          {benchmark.deviceClass === 'mid-range' && '⚡ Mid-Range'}
                          {benchmark.deviceClass === 'low-end' && '💻 Low-End'}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <div className="text-sm text-gray-600">WebGPU Support</div>
                        <div className="font-semibold text-lg text-gray-900">
                          {benchmark.webGPUSupported ? '✅ Supported' : '❌ Not Available'}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <div className="text-sm text-gray-600">Estimated Memory</div>
                        <div className="font-semibold text-lg text-gray-900">{benchmark.estimatedMemoryGB}GB</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <div className="text-sm text-gray-600">CPU Cores</div>
                        <div className="font-semibold text-lg text-gray-900">{benchmark.cpuCores}</div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start space-x-2">
                        <span className="text-gray-500">🎯</span>
                        <div>
                          <div className="font-semibold text-gray-800">Recommended Model</div>
                          <div className="text-gray-600">
                            {transcriptionModels.local.find(m => m.id === benchmark.recommendedModel)?.name || benchmark.recommendedModel}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Optimized for your {benchmark.deviceClass} device
                            {benchmark.webGPUSupported && ' with Apple Silicon GPU acceleration'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Local Processing Info */}
                    <div className="bg-white/40 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">🔒</span>
                        <h3 className="font-semibold text-black">100% Local Processing</h3>
                      </div>
                      <p className="text-sm text-gray-800 mb-2">
                        Your recommended model runs completely locally for maximum privacy:
                      </p>
                      <ul className="text-xs text-gray-600 space-y-1 ml-4">
                        <li>• 🔒 Zero data sent to external servers</li>
                        <li>• ⚡ No internet required after model download</li>
                        <li>• 🆓 No API costs or usage limits</li>
                        <li>• 🛡️ Complete privacy and security</li>
                        <li>• 📱 Optimized for your device capabilities</li>
                      </ul>
                      <div className="mt-3 text-xs text-gray-600">
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
        </div>
  );
}

function PromptTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void; }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:border-black focus:shadow-lg focus:shadow-black/5"
        rows={4}
      />
    </div>
  );
}

// Backend Badge Component - Affiche plusieurs badges
function BackendBadges({ supportsDiarization, requiresServer, isCloud, provider }: { 
  supportsDiarization?: boolean; 
  requiresServer?: boolean;
  isCloud?: boolean;
  provider?: string;
}) {
  const [whisperXAvailable, setWhisperXAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // Check backend availability (only for local)
    if (!isCloud) {
      checkWhisperXAvailability().then(setWhisperXAvailable).catch(() => setWhisperXAvailable(false));
    }
  }, [isCloud]);

  const badges = [];

  // 🌐 Cloud Provider Badge
  if (isCloud) {
    const cloudInfo = provider === 'google' 
      ? { icon: '🌟', label: 'Google Cloud' }
      : provider === 'openai'
        ? { icon: '🤖', label: 'OpenAI Cloud' }
        : provider === 'mistral'
          ? { icon: '🎯', label: 'Mistral Cloud' }
          : { icon: '☁️', label: 'Cloud' };

    badges.push(
      <span key="backend" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-black text-white shadow-sm">
        {cloudInfo.icon} {cloudInfo.label}
      </span>
    );
  }
  // Local: Badge Backend - Priorité intelligente
  // 🏆 PRIORITÉ 1: WhisperX (si diarization + disponible)
  else if (supportsDiarization && whisperXAvailable) {
    badges.push(
      <span key="backend" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-black text-white shadow-sm">
        🏆 WhisperX
      </span>
    );
  }
  // 🖥️ PRIORITÉ 2: PyTorch Server (fallback pour modèles lourds)
  else if (requiresServer) {
    badges.push(
      <span key="backend" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
        <ServerIcon className="w-3 h-3 mr-1" /> PyTorch Server
      </span>
    );
  }
  // 🌐 PRIORITÉ 3: Browser (fallback ultime)
  else {
    badges.push(
      <span key="backend" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
        <GlobeIcon className="w-3 h-3 mr-1" /> Browser
      </span>
    );
  }

  // Badge Diarization (si supporté)
  if (supportsDiarization) {
    badges.push(
      <span key="diarization" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
        🎭 Diarization
      </span>
    );
  }

  return <div className="flex gap-2 flex-wrap">{badges}</div>;
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
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => {
              const newProvider = e.target.value;
              setSelectedProvider(newProvider);
              setSelectedModel(models[newProvider][0].id);
            }}
            className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:border-black focus:shadow-lg focus:shadow-black/5"
          >
            {providers.map((p: string) => (
              <option key={p} value={p} className="capitalize">
                {p === 'local' ? 'Local (Browser)' : p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Model</label>
          <select
            value={selectedModel || ''}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:border-black focus:shadow-lg focus:shadow-black/5 disabled:opacity-50"
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
        {/* Show badges for ALL providers */}
        {selectedModel && (
          <BackendBadges
            supportsDiarization={selectedModelData?.supportsDiarization}
            requiresServer={selectedModelData?.requiresServer}
            isCloud={!isLocal}
            provider={selectedProvider}
          />
        )}
        {isLocal && selectedModelData && (
          <div className="text-xs text-gray-500 space-y-1">
            {selectedModelData.size && (
              <div>📦 <strong>Size:</strong> {selectedModelData.size}</div>
            )}
            {selectedModelData.languages && (
              <div>🌍 <strong>Languages:</strong> {selectedModelData.languages}</div>
            )}
            {selectedProvider === 'local' && (
              <div className="text-gray-800 bg-gray-50 border border-gray-200 p-2 rounded">
                ℹ️ <strong>Privacy:</strong> Runs entirely in your browser. No data sent to external servers.
              </div>
            )}
            {selectedProvider === 'local' && (
              <div className="space-y-2">
                <div className="text-gray-800 bg-gray-50 border border-gray-200 p-2 rounded">
                  💡 <strong>Tip:</strong> Start with "Moonshine Tiny" (50MB, English) or "Whisper Tiny" (39MB, multilingual).
                  For French meetings with multiple speakers, use "Distil-Whisper Large v3" (756MB, French PRO) for best diarization.
                  If AI fails, use cloud transcription (OpenAI/Google).
                </div>
                <div className="text-gray-800 bg-gray-50 border border-gray-200 p-2 rounded">
                  🇫🇷 <strong>Français:</strong> Nouveaux modèles spécialisés pour le français ! "Whisper Small FR" (244MB) et "Distil-Whisper Large v3" (756MB) offrent une meilleure précision pour la transcription en français et la séparation des locuteurs.
                </div>
                <div className="text-gray-800 bg-gray-50 border border-gray-200 p-2 rounded">
                  🚀 <strong>whisper.cpp Ultra-Rapide:</strong> Si le service whisper.cpp est actif (badge violet 🚀), votre transcription sera 3-9x plus rapide ! Sinon, l'app utilise automatiquement WebGPU (Apple Silicon) ou le navigateur.
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
      <label className="block text-sm font-medium text-gray-900">{providerInfo.name}</label>
      {providerInfo.description && (
        <p className="text-xs text-gray-500 mt-1">{providerInfo.description}</p>
      )}
      <div className="flex items-center space-x-2 mt-2">
        <input
          type="password"
          placeholder={providerInfo.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 placeholder-gray-500 focus:border-black focus:shadow-lg focus:shadow-black/5"
        />
        <Button onClick={onSave} disabled={!value}>Save</Button>
      </div>
    </div>
  );
}