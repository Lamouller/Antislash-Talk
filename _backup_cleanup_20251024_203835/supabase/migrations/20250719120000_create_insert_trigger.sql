create trigger on_new_meeting_for_transcription
  after insert on public.meetings
  for each row
  execute function public.trigger_transcription_webhook(); 