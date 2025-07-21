ALTER TABLE public.meeting_participants
ADD CONSTRAINT unique_meeting_id UNIQUE (meeting_id);
