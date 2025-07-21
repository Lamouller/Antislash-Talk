import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Service Role Key is missing in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateMissingRecordingUrls() {
  console.log('Fetching meetings with missing recording_url...');

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, user_id')
    .is('recording_url', null);

  if (error) {
    console.error('Error fetching meetings:', error);
    return;
  }

  if (!meetings || meetings.length === 0) {
    console.log('No meetings found with missing recording_url.');
    return;
  }

  console.log(`Found ${meetings.length} meetings to update.`);

  for (const meeting of meetings) {
    const recordingPath = `${meeting.user_id}/${meeting.id}.webm`;
    
    console.log(`Updating meeting ${meeting.id} with URL: ${recordingPath}`);

    const { error: updateError } = await supabase
      .from('meetings')
      .update({ recording_url: recordingPath })
      .eq('id', meeting.id);

    if (updateError) {
      console.error(`Failed to update meeting ${meeting.id}:`, updateError);
    } else {
      console.log(`Successfully updated meeting ${meeting.id}.`);
    }
  }

  console.log('Update process finished.');
}

updateMissingRecordingUrls(); 