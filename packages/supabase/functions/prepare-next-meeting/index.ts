import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'

interface PrepareNextMeetingRequest {
    previous_meeting_id: string;
    series_name?: string;
    scheduled_date?: string;
    preparation_prompt_id?: string;  // Optional: custom prompt for preparation
}

interface Task {
    task: string;
    responsible: string;
    deadline: string;
    priority?: string;
}

interface PrepareNextMeetingResponse {
    new_meeting_id: string;
    preparation_notes: string;
    suggested_title: string;
    tasks_from_previous: Task[];
}

// Default prompt for preparation generation
const DEFAULT_PREPARATION_PROMPT = `
Analyze the previous meeting transcript and summary to prepare for the next meeting.

Generate a structured preparation document in Markdown format that includes:

1. **📋 Recap of Last Meeting**
   - Brief summary of key points discussed
   - Main decisions made

2. **✅ Tasks Status from Last Meeting**
   - List each task with current status:
     * ✅ Completed tasks
     * ⏳ In progress tasks  
     * ❌ Pending tasks
   - Highlight any blocked or overdue items

3. **🎯 Suggested Topics for Next Meeting**
   - Items that need follow-up
   - Unresolved questions
   - New topics based on previous discussion

4. **📝 Proposed Agenda**
   - Ordered list of topics to cover
   - Estimated time for each topic (if relevant)

5. **👥 Action Items to Review**
   - Who should report on what
   - Questions to ask participants

Format the output in clear, professional Markdown suitable for distribution to meeting participants.
Use bullet points, checkboxes, and formatting to make it scannable.
`;

export const handler = async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const requestData: PrepareNextMeetingRequest = await req.json();
        const { previous_meeting_id, series_name, scheduled_date, preparation_prompt_id } = requestData;

        if (!previous_meeting_id) {
            throw new Error('Missing previous_meeting_id');
        }

        // Create Supabase client with user context
        const userSupabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
        );

        const { data: { user } } = await userSupabaseClient.auth.getUser();
        if (!user) throw new Error('User not found');

        // Service client for admin operations
        const serviceSupabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        // 1. Get previous meeting data
        const { data: previousMeeting, error: meetingError } = await serviceSupabaseClient
            .from('meetings')
            .select('id, title, summary, transcript, series_name, user_id')
            .eq('id', previous_meeting_id)
            .single();

        if (meetingError || !previousMeeting) {
            throw new Error(`Previous meeting not found: ${meetingError?.message}`);
        }

        if (previousMeeting.user_id !== user.id) {
            throw new Error('Unauthorized: You can only prepare meetings from your own meetings');
        }

        // 2. Get custom preparation prompt if specified
        let preparationPrompt = DEFAULT_PREPARATION_PROMPT;

        if (preparation_prompt_id) {
            const { data: customPrompt } = await serviceSupabaseClient
                .from('prompt_templates')
                .select('content')
                .eq('id', preparation_prompt_id)
                .eq('category', 'preparation')
                .eq('user_id', user.id)
                .single();

            if (customPrompt?.content) {
                preparationPrompt = customPrompt.content;
            }
        }

        // 3. Get user's preferred LLM (use transcription settings for consistency)
        const { data: profile } = await serviceSupabaseClient
            .from('profiles')
            .select('preferred_transcription_provider, preferred_transcription_model')
            .eq('id', user.id)
            .single();

        console.log('🔍 Profile LLM settings:', {
            provider: profile?.preferred_transcription_provider,
            model: profile?.preferred_transcription_model
        });

        // Use transcription provider (which is already configured in settings)
        const llmProvider = profile?.preferred_transcription_provider || 'google';
        const llmModel = profile?.preferred_transcription_model || (llmProvider === 'google' ? 'gemini-2.0-flash-exp' : 'gpt-4o');

        // 4. Get API key
        const { data: apiKeyData } = await serviceSupabaseClient
            .from('api_keys')
            .select('encrypted_key')
            .eq('user_id', user.id)
            .eq('provider', llmProvider)
            .single();

        if (!apiKeyData?.encrypted_key) {
            throw new Error(`${llmProvider} API key not found. Please configure it in settings.`);
        }

        const apiKey = apiKeyData.encrypted_key;

        // 5. Build context from previous meeting
        const previousContext = `
PREVIOUS MEETING INFORMATION:
Title: ${previousMeeting.title}
Summary: ${previousMeeting.summary || 'No summary available'}
Transcript: ${JSON.stringify(previousMeeting.transcript || [])}
`;

        const finalPrompt = `${preparationPrompt}\n\n${previousContext}`;

        console.log('🎯 Generating preparation with', llmProvider, llmModel);

        // 6. Call LLM to generate preparation
        let preparationNotes: string;

        if (llmProvider === 'openai') {
            const response = await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: llmModel,
                    messages: [{
                        role: 'user',
                        content: finalPrompt
                    }],
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${error}`);
            }

            const result = await response.json();
            preparationNotes = result.choices[0].message.content;

        } else if (llmProvider === 'google') {
            const response = await fetch(
                `${GEMINI_API_BASE_URL}/models/${llmModel}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: finalPrompt }]
                        }]
                    })
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Google API error: ${error}`);
            }

            const result = await response.json();
            preparationNotes = result.candidates[0].content.parts[0].text;

        } else {
            throw new Error(`Unsupported LLM provider: ${llmProvider}`);
        }

        // 7. Generate suggested title for new meeting
        const suggestedTitle = series_name
            ? `${series_name} - ${new Date().toLocaleDateString()}`
            : `Follow-up: ${previousMeeting.title}`;

        // 8. Create new meeting in draft status
        const newMeetingPayload = {
            user_id: user.id,
            title: suggestedTitle,
            parent_meeting_id: previous_meeting_id,
            series_name: series_name || previousMeeting.series_name || null,
            preparation_notes: preparationNotes,
            scheduled_date: scheduled_date || null,
            meeting_status: 'draft',
            status: 'pending', // For backwards compatibility with old status column
            participant_count: 1
        };

        const { data: newMeeting, error: createError } = await serviceSupabaseClient
            .from('meetings')
            .insert(newMeetingPayload)
            .select()
            .single();

        if (createError || !newMeeting) {
            throw new Error(`Failed to create new meeting: ${createError?.message}`);
        }

        console.log('✅ Created new meeting:', newMeeting.id);

        // 9. Extract tasks from preparation notes (simple regex-based extraction)
        const taskRegex = /[-*]\s*\[([ xX])\]\s*(.+?)(?:\n|$)/g;
        const tasks: Task[] = [];
        let match;

        while ((match = taskRegex.exec(preparationNotes)) !== null) {
            tasks.push({
                task: match[2].trim(),
                responsible: 'À déterminer',
                deadline: 'Non spécifiée',
                priority: match[1].toLowerCase() === 'x' ? 'Completed' : 'Pending'
            });
        }

        const response: PrepareNextMeetingResponse = {
            new_meeting_id: newMeeting.id,
            preparation_notes: preparationNotes,
            suggested_title: suggestedTitle,
            tasks_from_previous: tasks
        };

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('❌ Error in prepare-next-meeting:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
};

// Start server if this file is the main entry point
if (import.meta.main) {
    Deno.serve(handler);
}
