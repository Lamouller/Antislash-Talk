/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Core Supabase config
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // App behaviour
  readonly VITE_HIDE_MARKETING_PAGES?: string;

  // Optional service URLs
  readonly VITE_OLLAMA_URL?: string;
  readonly VITE_WHISPERX_URL?: string;
  readonly VITE_PYTORCH_SERVICE_URL?: string;

  // Feature flags — transcription refactor (phase 0+)
  // All optional: undefined means "not set" → falls through to default (false)
  readonly VITE_FLAG_NEW_TRANSCRIPTION_FLOW?: string;
  readonly VITE_FLAG_NORMALIZED_TIMESTAMPS?: string;
  readonly VITE_FLAG_SPEAKER_LOCK_DEDUP?: string;
  readonly VITE_FLAG_WS_RECONNECT?: string;
  readonly VITE_FLAG_CLIENT_VAD?: string;
  readonly VITE_FLAG_UNIFIED_MIC_STREAM?: string;
  readonly VITE_FLAG_PROVIDER_MUTEX?: string;
  readonly VITE_FLAG_MIC_ROUTE_HANDLING?: string;

  // VAD tuning (read as strings, parsed at use site)
  readonly VITE_VAD_THRESHOLD_DB?: string;
  readonly VITE_VAD_SILENCE_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
