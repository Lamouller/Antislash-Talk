// Application-specific types

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  audio_url?: string;
  transcript?: string;
  summary?: string;
  provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  provider: string;
  key_prefix: string;
  created_at: string;
  user_id: string;
}

