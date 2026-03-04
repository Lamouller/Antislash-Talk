import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🧹 Starting cleanup of expired audio files...')

    // Find meetings with expired audio files
    const { data: expiredMeetings, error: queryError } = await supabase
      .from('meetings')
      .select('id, recording_url, audio_expires_at, title')
      .not('recording_url', 'is', null)
      .not('audio_expires_at', 'is', null)
      .lt('audio_expires_at', new Date().toISOString())

    if (queryError) {
      console.error('Error querying expired meetings:', queryError)
      throw queryError
    }

    if (!expiredMeetings || expiredMeetings.length === 0) {
      console.log('✅ No expired audio files found')
      return new Response(JSON.stringify({
        success: true,
        message: 'No expired audio files found',
        deletedCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`🗑️ Found ${expiredMeetings.length} expired audio files to delete`)

    let deletedCount = 0
    let errors: string[] = []

    // Delete each expired audio file
    for (const meeting of expiredMeetings) {
      try {
        console.log(`🗂️ Deleting audio for meeting: ${meeting.title} (${meeting.id})`)

        // Delete from storage
        const { error: deleteError } = await supabase.storage
          .from('meetingrecordings')
          .remove([meeting.recording_url])

        if (deleteError) {
          console.error(`❌ Failed to delete ${meeting.recording_url}:`, deleteError)
          errors.push(`Meeting ${meeting.id}: ${deleteError.message}`)
          continue
        }

        // Update database to remove recording_url
        const { error: updateError } = await supabase
          .from('meetings')
          .update({
            recording_url: null,
            // Keep audio_expires_at for audit trail
          })
          .eq('id', meeting.id)

        if (updateError) {
          console.error(`❌ Failed to update meeting ${meeting.id}:`, updateError)
          errors.push(`Meeting ${meeting.id} DB update: ${updateError.message}`)
          continue
        }

        deletedCount++
        console.log(`✅ Successfully deleted audio for meeting ${meeting.id}`)

      } catch (error) {
        console.error(`❌ Unexpected error processing meeting ${meeting.id}:`, error)
        errors.push(`Meeting ${meeting.id}: ${error.message}`)
      }
    }

    const result = {
      success: true,
      message: `Cleanup completed. Deleted ${deletedCount} of ${expiredMeetings.length} expired audio files`,
      deletedCount,
      totalExpired: expiredMeetings.length,
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('🎯 Cleanup summary:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Fatal error in cleanup function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
};

// Start server if this file is the main entry point
if (import.meta.main) {
  Deno.serve(handler);
} 