-- Ensure the meetingrecordings bucket is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('meetingrecordings', 'meetingrecordings', true)
ON CONFLICT (id) DO UPDATE SET public = true; 