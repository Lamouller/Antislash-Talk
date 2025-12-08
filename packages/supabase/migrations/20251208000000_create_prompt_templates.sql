-- Enable moddatetime extension
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Create prompt_templates table
CREATE TABLE IF NOT EXISTS public.prompt_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('summary', 'title', 'system', 'transcript')),
    content TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own prompt templates" ON public.prompt_templates;
CREATE POLICY "Users can view their own prompt templates"
    ON public.prompt_templates FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own prompt templates" ON public.prompt_templates;
CREATE POLICY "Users can insert their own prompt templates"
    ON public.prompt_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own prompt templates" ON public.prompt_templates;
CREATE POLICY "Users can update their own prompt templates"
    ON public.prompt_templates FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own prompt templates" ON public.prompt_templates;
CREATE POLICY "Users can delete their own prompt templates"
    ON public.prompt_templates FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_updated_at ON public.prompt_templates;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.prompt_templates
    FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);

-- Grant permissions
GRANT ALL ON TABLE public.prompt_templates TO authenticated;
GRANT ALL ON TABLE public.prompt_templates TO service_role;
