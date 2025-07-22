import { z } from 'zod';

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().nullable(),
  email: z.string().email(),
  preferred_llm: z.string().nullable(),
  preferred_llm_model: z.string().nullable(),
  preferred_transcription_provider: z.string().nullable(),
  preferred_transcription_model: z.string().nullable(),
  preferred_tts_provider: z.string().nullable(),
  preferred_tts_model: z.string().nullable(),
  auto_transcribe_after_recording: z.boolean().nullable(),
  preferred_language: z.enum(['fr', 'en']).nullable().default('fr'),
  updated_at: z.string().datetime().nullable(),
});

export const ApiKeySchema = z.object({
  id: z.number(),
  user_id: z.string().uuid(),
  provider: z.string(),
  encrypted_key: z.string(),
  created_at: z.string().datetime(),
});

export const MeetingParticipantSchema = z.object({
  count: z.number(),
});

export const MeetingSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  created_at: z.string().datetime(),
  duration: z.number(),
  status: z.enum(['processing', 'completed', 'failed']),
  recording_url: z.string().url().nullable(),
  transcript: z.any().nullable(),
  summary: z.string().nullable(),
  transcription_provider: z.string().nullable(),
  transcription_model: z.string().nullable(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type Meeting = z.infer<typeof MeetingSchema>;