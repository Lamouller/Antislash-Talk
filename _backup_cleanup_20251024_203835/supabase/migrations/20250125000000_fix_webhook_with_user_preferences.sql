-- Drop the old trigger and function to ensure a clean slate
drop trigger if exists on_new_meeting_for_transcription on public.meetings;
drop function if exists public.trigger_transcription_webhook();

-- Create the definitive function that retrieves user preferences and passes them to Netlify
create or replace function public.trigger_transcription_webhook()
returns trigger as $$
declare
  user_provider text;
  user_model text;
begin
  -- Get user preferences from profiles table
  select 
    coalesce(preferred_transcription_provider, 'openai') as provider,
    coalesce(preferred_transcription_model, 'whisper-1') as model
  into user_provider, user_model
  from public.profiles
  where id = new.user_id;

  -- If no preferences found, use defaults
  if user_provider is null then
    user_provider := 'openai';
  end if;
  if user_model is null then
    user_model := 'whisper-1';
  end if;

  -- Call Netlify webhook with all required data
  perform extensions.http_post(
    'https://talk-2-web.netlify.app/.netlify/functions/transcribe',
    jsonb_build_object(
      'meeting_id', new.id,
      'user_id', new.user_id,
      'provider', user_provider,
      'model', user_model
    )::text,
    'application/json'
  );
  
  return new;
end;
$$ language plpgsql security definer;

-- Re-create the trigger to fire ONLY on the UPDATE to 'pending' state
create trigger on_new_meeting_for_transcription
  after update on public.meetings
  for each row
  when (old.status is distinct from 'pending' and new.status = 'pending')
  execute function public.trigger_transcription_webhook(); 