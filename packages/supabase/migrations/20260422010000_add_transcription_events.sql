-- Telemetry table for transcription flow refactor (phase 14)
-- Each row = one event logged by a client during a recording session

CREATE TABLE IF NOT EXISTS public.transcription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,           -- groups events of the same recording
  event_type text NOT NULL,           -- 'ws_reconnect', 'vad_drop', 'provider_transition', 'stream_count', 'segment_dedup_hit', ...
  payload jsonb NOT NULL DEFAULT '{}',
  client_meta jsonb NOT NULL DEFAULT '{}', -- platform, version, flags actifs
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transcription_events_session ON public.transcription_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transcription_events_user ON public.transcription_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcription_events_type ON public.transcription_events(event_type, created_at DESC);

ALTER TABLE public.transcription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own events"
  ON public.transcription_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own events"
  ON public.transcription_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
