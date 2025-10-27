# 🎯 Client Deployment Guide - Hide Marketing Pages

This guide explains how to configure Antislash Talk for client deployments by hiding marketing/promotional pages and enabling direct login access.

## Overview

When deploying Antislash Talk for a specific client or organization, you may want to:
- Remove promotional content (home page, auth index)
- Provide direct access to login page
- Create a more focused, enterprise-like experience

Antislash Talk supports two levels of configuration:
1. **Global Configuration** (via environment variable) - Forces behavior for all users
2. **User Preference** (via Settings UI) - Allows individual users to choose

## 🚀 Quick Start

### For Client Deployments (Recommended)

Set the environment variable to force hide marketing pages for all users:

```bash
# In your .env or .env.local file
VITE_HIDE_MARKETING_PAGES=true
```

### For Self-Service Platforms

Leave the default (or set to `false`) and let users choose in their Settings:

```bash
# In your .env or .env.local file
VITE_HIDE_MARKETING_PAGES=false
```

## 📋 Configuration Options

### Option 1: Global Configuration (Environment Variable)

**When to use:**
- Client-specific deployments
- White-label installations
- Enterprise internal tools
- When you want consistent behavior for all users

**How to configure:**

1. Add to your `.env` file:
```bash
VITE_HIDE_MARKETING_PAGES=true
```

2. Rebuild and restart your application:
```bash
npm run build
# or
docker-compose down && docker-compose up -d --build
```

**Behavior:**
- `/` → Redirects to `/auth/login`
- `/auth` → Redirects to `/auth/login`
- `/auth/login` → Login page (accessible)
- `/auth/register` → Registration page (accessible)
- User setting in UI is disabled and shows "FORCED BY CONFIG" badge

### Option 2: User Preference

**When to use:**
- Multi-tenant platforms
- Community deployments
- When users need flexibility

**How users configure:**

1. Navigate to Settings → Recording Behavior section
2. Find "Hide marketing pages" toggle
3. Enable to skip marketing pages
4. Save settings

**Behavior:**
- Only applies to users who enable it
- Each user can choose their preference
- Can be overridden by global config

## 🎨 User Experience Comparison

### Standard Mode (Marketing Pages Visible)

```
/                    → Home page with features, GitHub link, marketing content
/auth                → Auth index with welcome message and feature cards
/auth/login          → Login page
/auth/register       → Registration page
```

### Client Mode (Marketing Pages Hidden)

```
/                    → Auto-redirect to /auth/login
/auth                → Auto-redirect to /auth/login
/auth/login          → Login page (direct access)
/auth/register       → Registration page (direct access)
```

## 🔧 Technical Details

### Database Schema

The user preference is stored in the `profiles` table:

```sql
ALTER TABLE public.profiles 
ADD COLUMN hide_marketing_pages BOOLEAN DEFAULT false;
```

### Priority Logic

1. **Global Environment Variable** (highest priority)
   - If `VITE_HIDE_MARKETING_PAGES=true`, marketing pages are hidden for everyone
   
2. **User Preference** (if global not set)
   - User's `hide_marketing_pages` setting is checked
   - Defaults to `false` (show marketing)

3. **Not Logged In**
   - Marketing pages shown by default
   - Can be hidden if global config is `true`

### Files Modified

- `env.example` - Added `VITE_HIDE_MARKETING_PAGES` documentation
- `packages/supabase/migrations/20251027000000_add_hide_marketing_pages.sql` - Database migration
- `apps/web/src/hooks/useMarketingPagesConfig.ts` - Configuration hook
- `apps/web/src/pages/_layout.tsx` - Routing logic
- `apps/web/src/pages/(tabs)/settings.tsx` - User interface

## 📝 Example Configurations

### Example 1: Full Client Deployment

Perfect for a single organization deployment:

```bash
# .env.local
VITE_HIDE_MARKETING_PAGES=true
VITE_SUPABASE_URL=https://your-client-instance.supabase.co
VITE_SUPABASE_ANON_KEY=your_client_key
```

### Example 2: Multi-Tenant Platform

Allow users to choose:

```bash
# .env.local
VITE_HIDE_MARKETING_PAGES=false
VITE_SUPABASE_URL=https://your-platform.supabase.co
VITE_SUPABASE_ANON_KEY=your_platform_key
```

### Example 3: Development Environment

Default behavior (show everything):

```bash
# .env.local
# VITE_HIDE_MARKETING_PAGES is not set (defaults to false)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your_dev_key
```

## 🐳 Docker Deployment

When deploying with Docker, set the environment variable in your `docker-compose.yml`:

```yaml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    environment:
      - VITE_HIDE_MARKETING_PAGES=true
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
    ports:
      - "5173:5173"
```

Or use an `.env` file with docker-compose:

```bash
# .env
VITE_HIDE_MARKETING_PAGES=true
```

```yaml
services:
  web:
    env_file:
      - .env
```

## ✅ Verification

After configuration, verify the behavior:

1. **Not logged in:**
   - Navigate to `/` → Should redirect to `/auth/login` if enabled
   - Navigate to `/auth` → Should redirect to `/auth/login` if enabled

2. **Logged in:**
   - Go to Settings → Recording Behavior
   - Check "Hide marketing pages" setting
   - If global config is true, toggle should be disabled with "FORCED BY CONFIG" badge

3. **Test both login and register:**
   - `/auth/login` should always be accessible
   - `/auth/register` should always be accessible

## 🔐 Security Considerations

- This feature only affects UI/UX routing
- Authentication and authorization remain unchanged
- Users can still register and login normally
- API endpoints are not affected

## 🐛 Troubleshooting

### Marketing pages still showing

1. Check environment variable is set correctly:
```bash
echo $VITE_HIDE_MARKETING_PAGES
```

2. Verify the app was rebuilt after changing `.env`:
```bash
npm run build
```

3. Clear browser cache and reload

### User setting not saving

1. Check database migration ran successfully
2. Verify user is logged in
3. Check browser console for errors

### Infinite redirect loop

This should not happen, but if it does:
1. Clear browser cookies/cache
2. Check `_layout.tsx` routing logic
3. Verify no conflicting redirects

## 🎯 Best Practices

1. **For Client Deployments:** Use global config (`VITE_HIDE_MARKETING_PAGES=true`)
2. **For SaaS Platforms:** Leave global config unset, let users choose
3. **Document Your Choice:** Add a comment in your `.env` file explaining the decision
4. **Test Both Modes:** Verify behavior with and without the setting before production
5. **Communication:** Inform users about the change if updating existing deployments

## 📚 Related Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
- [Authentication Setup](./AUTHENTICATION_SETUP_SUCCESS.md)

## 💡 Need Help?

- **GitHub Issues:** [Create an issue](https://github.com/Lamouller/Antislash-Talk/issues)
- **Documentation:** [Full docs](./DOCS_INDEX.md)
- **Community:** [Discussions](https://github.com/Lamouller/Antislash-Talk/discussions)

