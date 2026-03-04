# Edge Functions Quick Reference

## Access URLs

All functions accessible at: `http://localhost:54321/functions/v1/{function-name}`

| Function | Endpoint | Auth Required |
|----------|----------|---------------|
| Health Check | `/functions/v1/` | ❌ No |
| Transcribe (Gemini) | `/functions/v1/transcribe-with-gemini` | ✅ User JWT |
| Start Transcription | `/functions/v1/start-transcription` | ✅ User JWT |
| Enhance Local | `/functions/v1/enhance-local-transcription` | ✅ User JWT |
| Upload File | `/functions/v1/upload-async-file` | ✅ User JWT |
| Prepare Meeting | `/functions/v1/prepare-next-meeting` | ✅ User JWT |
| Cleanup Audio | `/functions/v1/cleanup-expired-audio` | ✅ Service Role |

---

## Common Commands

### Start the stack
```bash
docker compose -f docker-compose.monorepo.yml up -d
```

### Check Edge Runtime logs
```bash
docker logs -f antislash-talk-edge-runtime
```

### Test all routes
```bash
./packages/supabase/functions/test-routes.sh
```

### Restart just Edge Runtime
```bash
docker compose -f docker-compose.monorepo.yml restart edge-runtime
```

---

## Testing with curl

### Health check
```bash
curl http://localhost:54321/functions/v1/
```

### Test function (requires auth)
```bash
# Get token from browser DevTools: localStorage.getItem('sb-access-token')
TOKEN="your-jwt-token"

curl -X POST http://localhost:54321/functions/v1/transcribe-with-gemini \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meeting_id": "your-meeting-uuid"}'
```

---

## Environment Variables

### Required (in .env)
- `JWT_SECRET` - JWT signing secret
- `ANON_KEY` - Public API key (JWT with role=anon)
- `SERVICE_ROLE_KEY` - Admin API key (JWT with role=service_role)
- `POSTGRES_PASSWORD` - Database password

### Optional
- `NETLIFY_WEBHOOK_URL` - For production async transcription
- `PYTORCH_SERVICE_URL` - For local PyTorch transcription

---

## Function Status

| Function | Status | Notes |
|----------|--------|-------|
| transcribe-with-gemini | ✅ Working | Main transcription, supports 3 providers |
| start-transcription | ✅ Working | Async starter, local mode works |
| enhance-local-transcription | ✅ Working | Post-processes browser transcription |
| upload-async-file | ✅ Working | Server-side uploads |
| prepare-next-meeting | ✅ Working | AI meeting prep |
| cleanup-expired-audio | ✅ Working | Scheduled cleanup |

---

## Troubleshooting

### "Function not found" error
- Check URL path ends with function name
- Verify edge-runtime container is running: `docker ps | grep edge`

### CORS errors
- CORS is set to allow all origins (`*`) in local mode
- Check browser DevTools Network tab for actual error

### "User not found" error
- Check Authorization header includes valid JWT
- Get token from: `localStorage.getItem('sb-access-token')`

### Import errors in logs
- Check `import_map.json` has correct dependencies
- Verify all imports use `https://esm.sh/` or `https://deno.land/`

---

## Adding a Function

1. Create `packages/supabase/functions/my-function/index.ts`
2. Export `handler` function
3. Add import in `main/index.ts`
4. Add route in `Deno.serve()` callback
5. Restart edge-runtime: `docker compose restart edge-runtime`

Template:
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

---

## Useful Logs to Check

### Startup logs
```
🚀 Edge Function Router started
📦 Available routes: ...
🔐 Environment check: ...
```

### Request logs
```
📨 Request: POST /functions/v1/transcribe-with-gemini
✅ Routing to transcribe-with-gemini handler
```

### Error logs
```
❌ Router error: ...
❌ Error stack: ...
```

---

## Production Checklist

- [ ] Set `NETLIFY_WEBHOOK_URL` for async transcription
- [ ] Switch to domain-restricted CORS (use `getCorsHeaders()`)
- [ ] Set up scheduled job for `cleanup-expired-audio`
- [ ] Add rate limiting at Kong level
- [ ] Set up monitoring/alerting
- [ ] Test all functions with production data

---

## Documentation

- **Full Documentation:** `packages/supabase/functions/README.md`
- **Fix Summary:** `EDGE_FUNCTIONS_FIX.md`
- **This Reference:** `packages/supabase/functions/QUICK_REFERENCE.md`
