// Application constants

export const APP_NAME = 'Antislash Talk';
export const APP_VERSION = '2.0.0';
export const APP_DESCRIPTION = 'AI-Powered Meeting Transcription & Analysis';

export const TRANSCRIPTION_PROVIDERS = [
  { id: 'local', name: 'Local (Whisper)', icon: '🔒' },
  { id: 'mistral', name: 'Mistral Voxtral', icon: '🎯' },
  { id: 'openai', name: 'OpenAI Whisper', icon: '🤖' },
  { id: 'google', name: 'Google Gemini', icon: '🧠' },
] as const;

export const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_RECORDING_DURATION = 60 * 60; // 1 hour in seconds

