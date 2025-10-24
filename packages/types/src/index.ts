// 🎙️ Antislash Talk - Shared Types
// Central type definitions used across all packages

export * from './database';
export * from './app';

// Common types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

export type TranscriptionProvider = 'local' | 'mistral' | 'openai' | 'google';
export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

