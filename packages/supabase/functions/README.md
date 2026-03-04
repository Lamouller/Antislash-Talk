# Edge Functions - Antislash Talk

This directory contains all Supabase Edge Functions for the Antislash Talk application. These functions run on Deno runtime and handle server-side operations like transcription, file uploads, and meeting management.

## Architecture

All functions are routed through a **main router** (`main/index.ts`) that acts as a single entry point. This simplifies deployment and allows all functions to be served from one container.

```
Kong Gateway (:8000)
  ↓
/functions/v1/* → edge-runtime:9000
  ↓
main/index.ts (Router)
  ↓
├── /prepare-next-meeting → prepare-next-meeting/index.ts
├── /transcribe-with-gemini → transcribe-with-gemini/index.ts
├── /start-transcription → start-transcription/index.ts
├── /enhance-local-transcription → enhance-local-transcription/index.ts
├── /upload-async-file → upload-async-file/index.ts
└── /cleanup-expired-audio → cleanup-expired-audio/index.ts
```

## Available Functions

### 1. **transcribe-with-gemini**
**Path:** `/functions/v1/transcribe-with-gemini`
**Method:** POST
**Purpose:** Main transcription function using Google Gemini, OpenAI, or PyTorch

**Request:**
```json
{
  "meeting_id": "uuid"
}
```

**Features:**
- Supports multiple AI providers (Google Gemini, OpenAI, PyTorch local)
- Advanced speaker diarization
- Custom prompts per user or per meeting
- Multi-language support (French/English)
- Automatic participant counting

**Environment Variables:**
- `SUPABASE_URL` - Internal Supabase URL
- `SUPABASE_ANON_KEY` - Public API key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin API key
- `PYTORCH_SERVICE_URL` (optional) - PyTorch service endpoint

---

### 2. **start-transcription**
**Path:** `/functions/v1/start-transcription`
**Method:** POST
**Purpose:** Async transcription starter (triggers transcription in background)

**Request:**
```json
{
  "meeting_id": "uuid"
}
```

**Modes:**
- **Production:** Triggers Netlify webhook (if `NETLIFY_WEBHOOK_URL` is set)
- **Local:** Calls `transcribe-with-gemini` directly in background

**Environment Variables:**
- `NETLIFY_WEBHOOK_URL` (optional) - Netlify function URL for production

---

### 3. **enhance-local-transcription**
**Path:** `/functions/v1/enhance-local-transcription`
**Method:** POST
**Purpose:** Post-process browser-based transcriptions with AI

**Request:**
```json
{
  "raw_transcript": "string",
  "chunks": [
    {
      "start": 0,
      "end": 5,
      "speaker": "Speaker_01",
      "text": "Hello world"
    }
  ],
  "prompts": {
    "title": "Custom title prompt",
    "summary": "Custom summary prompt",
    "transcript": "Custom transcript prompt"
  },
  "user_id": "uuid"
}
```

**Features:**
- Enhances browser transcription with AI analysis
- Generates title, summary, and diarization
- Uses user's preferred LLM (OpenAI or Google)

---

### 4. **upload-async-file**
**Path:** `/functions/v1/upload-async-file`
**Method:** POST
**Purpose:** Server-side file upload for meeting recordings

**Request:**
```json
{
  "title": "Meeting title",
  "duration": 120,
  "audio_blob": "data:audio/webm;base64,...",
  "prompt_title": "optional custom prompt",
  "prompt_summary": "optional custom prompt",
  "prompt_transcript": "optional custom prompt"
}
```

**Features:**
- Handles large file uploads server-side
- Creates meeting record with 'uploading' status
- Updates to 'pending' to trigger webhook/transcription
- Supports custom prompts per meeting

---

### 5. **prepare-next-meeting**
**Path:** `/functions/v1/prepare-next-meeting`
**Method:** POST
**Purpose:** AI-powered meeting preparation from previous meeting

**Request:**
```json
{
  "previous_meeting_id": "uuid",
  "series_name": "Weekly Standup",
  "scheduled_date": "2026-03-10T14:00:00Z",
  "preparation_prompt_id": "optional-uuid"
}
```

**Response:**
```json
{
  "new_meeting_id": "uuid",
  "preparation_notes": "Markdown formatted prep document",
  "suggested_title": "Weekly Standup - 03/10/2026",
  "tasks_from_previous": [
    {
      "task": "Review quarterly goals",
      "responsible": "À déterminer",
      "deadline": "Non spécifiée",
      "priority": "Pending"
    }
  ]
}
```

**Features:**
- Analyzes previous meeting transcript/summary
- Generates structured preparation notes in Markdown
- Extracts tasks and action items
- Creates draft meeting with preparation
- Supports custom preparation prompts
- Multi-language (French/English)

---

### 6. **cleanup-expired-audio**
**Path:** `/functions/v1/cleanup-expired-audio`
**Method:** POST
**Purpose:** Scheduled job to delete expired audio files

**Request:** No body required (service role auth)

**Features:**
- Queries meetings with expired audio (`audio_expires_at < NOW()`)
- Deletes files from storage bucket
- Updates database to remove `recording_url`
- Returns cleanup summary

**Scheduling:**
Can be triggered via:
- Cron job: `curl -X POST http://localhost:54321/functions/v1/cleanup-expired-audio -H "apikey: $SERVICE_ROLE_KEY"`
- Supabase pg_cron (if available)
- External scheduler (GitHub Actions, etc.)

---

## Shared Components

### `_shared/cors.ts`
CORS configuration for all functions. Supports both production and local development.

**Default:** Allows all origins (`*`) for self-hosted setup
**Production:** Use `getCorsHeaders(req)` for domain-restricted CORS

---

## Environment Variables

All functions share these environment variables (configured in `docker-compose.monorepo.yml`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | ✅ | `http://kong:8000` | Internal Supabase URL |
| `SUPABASE_ANON_KEY` | ✅ | (from .env) | Public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | (from .env) | Admin API key |
| `SUPABASE_DB_URL` | ✅ | `postgresql://...` | Direct DB connection |
| `JWT_SECRET` | ✅ | (from .env) | JWT signing secret |
| `NETLIFY_WEBHOOK_URL` | ❌ | - | Netlify webhook (optional, for production) |
| `PYTORCH_SERVICE_URL` | ❌ | `http://transcription-pytorch:8000` | PyTorch service URL (optional) |

---

## Testing Functions Locally

### 1. Start the stack:
```bash
docker compose -f docker-compose.monorepo.yml up -d
```

### 2. Check Edge Runtime logs:
```bash
docker logs -f antislash-talk-edge-runtime
```

### 3. Health check:
```bash
curl http://localhost:54321/functions/v1/
```

### 4. Test a function:
```bash
# Get auth token from your app or Supabase Studio
TOKEN="your-jwt-token"

# Test transcribe-with-gemini
curl -X POST http://localhost:54321/functions/v1/transcribe-with-gemini \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meeting_id": "your-meeting-uuid"}'
```

---

## Troubleshooting

### Functions not accessible
1. Check edge-runtime container is running:
   ```bash
   docker ps | grep edge-runtime
   ```

2. Check logs for errors:
   ```bash
   docker logs antislash-talk-edge-runtime
   ```

3. Verify Kong routing in `packages/supabase/kong.yml` includes:
   ```yaml
   - name: functions-v1
     url: http://edge-runtime:9000/
     routes:
       - name: functions-v1-all
         strip_path: true
         paths:
           - /functions/v1/
   ```

### CORS errors
- Update `_shared/cors.ts` to include your origin
- Or use `Access-Control-Allow-Origin: *` for development

### Import errors
- Check `import_map.json` has correct Deno dependencies
- Verify all imports use `https://esm.sh/` or `https://deno.land/`

### Environment variables missing
- Verify `.env` file has all required variables
- Check docker-compose passes them to `edge-runtime` service
- Look for "Environment check" logs on container startup

---

## Adding a New Function

1. Create new directory: `packages/supabase/functions/my-function/`
2. Create `index.ts` with exported `handler`:
   ```typescript
   import { corsHeaders } from '../_shared/cors.ts'

   export const handler = async (req: Request) => {
     if (req.method === 'OPTIONS') {
       return new Response('ok', { headers: corsHeaders })
     }

     try {
       // Your logic here
       return new Response(JSON.stringify({ success: true }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
     } catch (error) {
       return new Response(JSON.stringify({ error: error.message }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
     }
   }

   if (import.meta.main) {
     Deno.serve(handler);
   }
   ```

3. Add to router in `main/index.ts`:
   ```typescript
   import { handler as myFunction } from '../my-function/index.ts';

   // In Deno.serve():
   if (path.endsWith('/my-function')) {
     return await myFunction(req);
   }
   ```

4. Restart edge-runtime:
   ```bash
   docker compose -f docker-compose.monorepo.yml restart edge-runtime
   ```

---

## Production Deployment

When deploying to production:

1. Set `NETLIFY_WEBHOOK_URL` for async transcription
2. Use domain-restricted CORS via `getCorsHeaders(req)`
3. Consider rate limiting at Kong level
4. Set up scheduled cleanup job for `cleanup-expired-audio`
5. Monitor function logs and errors

---

## Architecture Benefits

✅ **Single Entry Point:** All functions deployed in one container
✅ **Shared Dependencies:** Common code in `_shared/`
✅ **Easy Testing:** All functions accessible at `/functions/v1/*`
✅ **Consistent CORS:** Centralized CORS config
✅ **Environment Management:** Single set of env vars for all functions
✅ **Better Logging:** Centralized logs from main router
✅ **Fast Routing:** In-memory routing, no external HTTP calls

---

## License

Part of Antislash Talk project - See root LICENSE file.
