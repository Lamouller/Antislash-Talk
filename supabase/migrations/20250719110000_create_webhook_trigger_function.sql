create or replace function public.trigger_transcription_webhook()
returns trigger as $$
begin
  perform
    http_post(
      'https://talk-2-web.netlify.app/.netlify/functions/transcribe',
      json_build_object('meeting_id', new.id)::text,
      'application/json',
      '{}'
    );
  return new;
end;
$$ language plpgsql; 