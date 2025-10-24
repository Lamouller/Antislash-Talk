

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";






CREATE TYPE "public"."stripe_order_status" AS ENUM (
    'pending',
    'completed',
    'canceled'
);


ALTER TYPE "public"."stripe_order_status" OWNER TO "postgres";


CREATE TYPE "public"."stripe_subscription_status" AS ENUM (
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);


ALTER TYPE "public"."stripe_subscription_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_default_deepgram_key"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO user_api_keys (user_id, service, api_key)
  VALUES (NEW.id, 'deepgram', '0adfb28b3269b392c01ac047af06391a49a27ff6');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_default_deepgram_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."combine_transcript_chunks"("meeting_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  combined_text text;
BEGIN
  SELECT string_agg(content, ' ' ORDER BY chunk_index)
  INTO combined_text
  FROM meeting_transcripts
  WHERE meeting_id = meeting_id_param;
  
  RETURN COALESCE(combined_text, '');
END;
$$;


ALTER FUNCTION "public"."combine_transcript_chunks"("meeting_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_user_tokens"("user_id" "uuid", "amount" integer, "reason" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT get_user_token_balance(deduct_user_tokens.user_id) INTO current_balance;
  
  -- Check if user has enough tokens
  IF current_balance < amount THEN
    RETURN FALSE;
  END IF;
  
  -- Insert usage transaction
  INSERT INTO user_tokens (
    user_id,
    amount,
    transaction_type,
    transaction_id
  ) VALUES (
    deduct_user_tokens.user_id,
    -amount,
    'usage',
    reason
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."deduct_user_tokens"("user_id" "uuid", "amount" integer, "reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_storage_path"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return user_id::text || '/';
end;
$$;


ALTER FUNCTION "public"."get_user_storage_path"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_token_balance"("user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO balance
  FROM user_tokens
  WHERE user_tokens.user_id = get_user_token_balance.user_id;
  
  RETURN balance;
END;
$$;


ALTER FUNCTION "public"."get_user_token_balance"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_meeting_views"("meeting_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Try to update existing record
  UPDATE meeting_analytics
  SET 
    views = views + 1,
    last_viewed_at = now(),
    updated_at = now()
  WHERE meeting_id = meeting_id_param;
  
  -- If no record exists, insert one
  IF NOT FOUND THEN
    INSERT INTO meeting_analytics (meeting_id, views, last_viewed_at)
    VALUES (meeting_id_param, 1, now());
  END IF;
END;
$$;


ALTER FUNCTION "public"."increment_meeting_views"("meeting_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_reports_generated"("meeting_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Try to update existing record
  UPDATE meeting_analytics
  SET 
    reports_generated = reports_generated + 1,
    updated_at = now()
  WHERE meeting_id = meeting_id_param;
  
  -- If no record exists, insert one
  IF NOT FOUND THEN
    INSERT INTO meeting_analytics (meeting_id, reports_generated)
    VALUES (meeting_id_param, 1);
  END IF;
END;
$$;


ALTER FUNCTION "public"."increment_reports_generated"("meeting_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_storage_config"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Storage configuration will be handled by the Supabase platform
  -- This function exists as a placeholder for future storage initialization needs
  return;
end;
$$;


ALTER FUNCTION "public"."initialize_storage_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_audio_mime_type"("mime_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
begin
  return mime_type = any(array[
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/webm',
    'audio/wav'
  ]);
end;
$$;


ALTER FUNCTION "public"."is_valid_audio_mime_type"("mime_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_increment_reports_generated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM increment_reports_generated(NEW.meeting_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_increment_reports_generated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_meeting_transcription"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update the meetings table with combined transcripts
  UPDATE meetings
  SET transcription = combine_transcript_chunks(NEW.meeting_id)
  WHERE id = NEW.meeting_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_meeting_transcription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_recording_folder"("folder_path" "text", "user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Extract the first folder name from path and compare with user ID
  return (regexp_split_to_array(folder_path, '/'))[1] = user_id::text;
end;
$$;


ALTER FUNCTION "public"."validate_recording_folder"("folder_path" "text", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_recording_upload"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if meeting exists and user has access
  IF NOT EXISTS (
    SELECT 1 FROM meetings
    WHERE id = NEW.meeting_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Meeting not found or access denied';
  END IF;
  
  -- Validate chunk index is positive
  IF NEW.chunk_index < 0 THEN
    RAISE EXCEPTION 'Chunk index must be non-negative';
  END IF;
  
  -- Validate audio URL is not empty
  IF NEW.audio_url IS NULL OR length(trim(NEW.audio_url)) = 0 THEN
    RAISE EXCEPTION 'Audio URL cannot be empty';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_recording_upload"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "encrypted_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "reports_generated" integer DEFAULT 0 NOT NULL,
    "last_viewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meeting_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_audio_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "chunk_index" integer NOT NULL,
    "audio_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meeting_audio_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "name" "text",
    "voice_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meeting_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meeting_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_to_tags" (
    "meeting_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meeting_to_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_transcripts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "chunk_index" integer NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meeting_transcripts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "recording_url" "text",
    "duration" integer,
    "status" "text" DEFAULT 'recording'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "transcript" "jsonb",
    "summary" "text",
    CONSTRAINT "meetings_status_check" CHECK (("status" = ANY (ARRAY['recording'::"text", 'processing'::"text", 'completed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "preferred_llm" "text",
    "preferred_llm_model" "text",
    "preferred_transcription_model" "text",
    "preferred_tts_model" "text",
    "preferred_transcription_provider" "text",
    "preferred_tts_provider" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "format" "text" DEFAULT 'summary'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reports_format_check" CHECK (("format" = ANY (ARRAY['summary'::"text", 'detailed'::"text", 'action_items'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_customers" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."stripe_customers" OWNER TO "postgres";


ALTER TABLE "public"."stripe_customers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stripe_customers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stripe_orders" (
    "id" bigint NOT NULL,
    "checkout_session_id" "text" NOT NULL,
    "payment_intent_id" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "amount_subtotal" bigint NOT NULL,
    "amount_total" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "payment_status" "text" NOT NULL,
    "status" "public"."stripe_order_status" DEFAULT 'pending'::"public"."stripe_order_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."stripe_orders" OWNER TO "postgres";


ALTER TABLE "public"."stripe_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stripe_orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stripe_subscriptions" (
    "id" bigint NOT NULL,
    "customer_id" "text" NOT NULL,
    "subscription_id" "text",
    "price_id" "text",
    "current_period_start" bigint,
    "current_period_end" bigint,
    "cancel_at_period_end" boolean DEFAULT false,
    "payment_method_brand" "text",
    "payment_method_last4" "text",
    "status" "public"."stripe_subscription_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."stripe_subscriptions" OWNER TO "postgres";


ALTER TABLE "public"."stripe_subscriptions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stripe_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."stripe_user_orders" WITH ("security_invoker"='true') AS
 SELECT "c"."customer_id",
    "o"."id" AS "order_id",
    "o"."checkout_session_id",
    "o"."payment_intent_id",
    "o"."amount_subtotal",
    "o"."amount_total",
    "o"."currency",
    "o"."payment_status",
    "o"."status" AS "order_status",
    "o"."created_at" AS "order_date"
   FROM ("public"."stripe_customers" "c"
     LEFT JOIN "public"."stripe_orders" "o" ON (("c"."customer_id" = "o"."customer_id")))
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."deleted_at" IS NULL) AND ("o"."deleted_at" IS NULL));


ALTER TABLE "public"."stripe_user_orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."stripe_user_subscriptions" WITH ("security_invoker"='true') AS
 SELECT "c"."customer_id",
    "s"."subscription_id",
    "s"."status" AS "subscription_status",
    "s"."price_id",
    "s"."current_period_start",
    "s"."current_period_end",
    "s"."cancel_at_period_end",
    "s"."payment_method_brand",
    "s"."payment_method_last4"
   FROM ("public"."stripe_customers" "c"
     LEFT JOIN "public"."stripe_subscriptions" "s" ON (("c"."customer_id" = "s"."customer_id")))
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."deleted_at" IS NULL) AND ("s"."deleted_at" IS NULL));


ALTER TABLE "public"."stripe_user_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "service" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "mic_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "transaction_id" "text",
    "transaction_type" "text" DEFAULT 'purchase'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_tokens_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['purchase'::"text", 'usage'::"text", 'refund'::"text"])))
);


ALTER TABLE "public"."user_tokens" OWNER TO "postgres";


ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_provider_key" UNIQUE ("user_id", "provider");



ALTER TABLE ONLY "public"."meeting_analytics"
    ADD CONSTRAINT "meeting_analytics_meeting_id_key" UNIQUE ("meeting_id");



ALTER TABLE ONLY "public"."meeting_analytics"
    ADD CONSTRAINT "meeting_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_audio_chunks"
    ADD CONSTRAINT "meeting_audio_chunks_meeting_id_chunk_index_key" UNIQUE ("meeting_id", "chunk_index");



ALTER TABLE ONLY "public"."meeting_audio_chunks"
    ADD CONSTRAINT "meeting_audio_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_participants"
    ADD CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_tags"
    ADD CONSTRAINT "meeting_tags_name_user_id_key" UNIQUE ("name", "user_id");



ALTER TABLE ONLY "public"."meeting_tags"
    ADD CONSTRAINT "meeting_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_to_tags"
    ADD CONSTRAINT "meeting_to_tags_pkey" PRIMARY KEY ("meeting_id", "tag_id");



ALTER TABLE ONLY "public"."meeting_transcripts"
    ADD CONSTRAINT "meeting_transcripts_meeting_id_chunk_index_key" UNIQUE ("meeting_id", "chunk_index");



ALTER TABLE ONLY "public"."meeting_transcripts"
    ADD CONSTRAINT "meeting_transcripts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_customer_id_key" UNIQUE ("customer_id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."stripe_orders"
    ADD CONSTRAINT "stripe_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_customer_id_key" UNIQUE ("customer_id");



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_service_key" UNIQUE ("user_id", "service");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_tokens"
    ADD CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("id");



CREATE INDEX "meeting_participants_meeting_id_idx" ON "public"."meeting_participants" USING "btree" ("meeting_id");



CREATE INDEX "meetings_user_id_idx" ON "public"."meetings" USING "btree" ("user_id");



CREATE INDEX "reports_meeting_id_idx" ON "public"."reports" USING "btree" ("meeting_id");



CREATE INDEX "reports_user_id_idx" ON "public"."reports" USING "btree" ("user_id");



CREATE INDEX "user_tokens_user_id_idx" ON "public"."user_tokens" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "add_deepgram_key_trigger" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."add_default_deepgram_key"();



CREATE OR REPLACE TRIGGER "report_created_trigger" AFTER INSERT ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_increment_reports_generated"();



CREATE OR REPLACE TRIGGER "update_meeting_transcription_trigger" AFTER INSERT OR UPDATE ON "public"."meeting_transcripts" FOR EACH ROW EXECUTE FUNCTION "public"."update_meeting_transcription"();



CREATE OR REPLACE TRIGGER "update_user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."meeting_analytics"
    ADD CONSTRAINT "meeting_analytics_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_audio_chunks"
    ADD CONSTRAINT "meeting_audio_chunks_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_participants"
    ADD CONSTRAINT "meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_participants"
    ADD CONSTRAINT "meeting_participants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_tags"
    ADD CONSTRAINT "meeting_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_to_tags"
    ADD CONSTRAINT "meeting_to_tags_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_to_tags"
    ADD CONSTRAINT "meeting_to_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."meeting_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_transcripts"
    ADD CONSTRAINT "meeting_transcripts_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tokens"
    ADD CONSTRAINT "user_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Allow users to delete their own API keys" ON "public"."api_keys" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to insert their own API keys" ON "public"."api_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to read their own API keys" ON "public"."api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to update their own API keys" ON "public"."api_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own tags" ON "public"."meeting_tags" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own meetings" ON "public"."meetings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own reports" ON "public"."reports" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete participants in own meetings" ON "public"."meeting_participants" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_participants"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own API keys" ON "public"."user_api_keys" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own tags" ON "public"."meeting_tags" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own meetings" ON "public"."meetings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own reports" ON "public"."reports" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert participants in own meetings" ON "public"."meeting_participants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_participants"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own API keys" ON "public"."api_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own API keys" ON "public"."user_api_keys" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own audio chunks" ON "public"."meeting_audio_chunks" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_audio_chunks"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own settings" ON "public"."user_settings" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own transcripts" ON "public"."meeting_transcripts" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_transcripts"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage tags for their meetings" ON "public"."meeting_to_tags" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_to_tags"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own meetings" ON "public"."meetings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own reports" ON "public"."reports" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update participants in own meetings" ON "public"."meeting_participants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_participants"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own API keys" ON "public"."api_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own API keys" ON "public"."user_api_keys" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own settings" ON "public"."user_settings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tags" ON "public"."meeting_tags" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view analytics for their meetings" ON "public"."meeting_analytics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_analytics"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own meetings" ON "public"."meetings" FOR SELECT USING (true);



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own reports" ON "public"."reports" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own tokens" ON "public"."user_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view participants in own meetings" ON "public"."meeting_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_participants"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own API keys" ON "public"."api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own API keys" ON "public"."user_api_keys" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own audio chunks" ON "public"."meeting_audio_chunks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_audio_chunks"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own customer data" ON "public"."stripe_customers" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their own order data" ON "public"."stripe_orders" FOR SELECT TO "authenticated" USING ((("customer_id" IN ( SELECT "stripe_customers"."customer_id"
   FROM "public"."stripe_customers"
  WHERE (("stripe_customers"."user_id" = "auth"."uid"()) AND ("stripe_customers"."deleted_at" IS NULL)))) AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their own settings" ON "public"."user_settings" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscription data" ON "public"."stripe_subscriptions" FOR SELECT TO "authenticated" USING ((("customer_id" IN ( SELECT "stripe_customers"."customer_id"
   FROM "public"."stripe_customers"
  WHERE (("stripe_customers"."user_id" = "auth"."uid"()) AND ("stripe_customers"."deleted_at" IS NULL)))) AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their own tags" ON "public"."meeting_tags" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own transcripts" ON "public"."meeting_transcripts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_transcripts"."meeting_id") AND ("meetings"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_audio_chunks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_to_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_transcripts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_tokens" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































































































































GRANT ALL ON FUNCTION "public"."add_default_deepgram_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_default_deepgram_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_default_deepgram_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."combine_transcript_chunks"("meeting_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."combine_transcript_chunks"("meeting_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."combine_transcript_chunks"("meeting_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."deduct_user_tokens"("user_id" "uuid", "amount" integer, "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_user_tokens"("user_id" "uuid", "amount" integer, "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_user_tokens"("user_id" "uuid", "amount" integer, "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_storage_path"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_storage_path"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_storage_path"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_token_balance"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_token_balance"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_token_balance"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_meeting_views"("meeting_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_meeting_views"("meeting_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_meeting_views"("meeting_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_reports_generated"("meeting_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_reports_generated"("meeting_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_reports_generated"("meeting_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_storage_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_storage_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_storage_config"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_audio_mime_type"("mime_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_audio_mime_type"("mime_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_audio_mime_type"("mime_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_increment_reports_generated"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_increment_reports_generated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_increment_reports_generated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_meeting_transcription"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_meeting_transcription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meeting_transcription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_recording_folder"("folder_path" "text", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_recording_folder"("folder_path" "text", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_recording_folder"("folder_path" "text", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_recording_upload"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_recording_upload"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_recording_upload"() TO "service_role";





















GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_analytics" TO "anon";
GRANT ALL ON TABLE "public"."meeting_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_audio_chunks" TO "anon";
GRANT ALL ON TABLE "public"."meeting_audio_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_audio_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_participants" TO "anon";
GRANT ALL ON TABLE "public"."meeting_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_participants" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_tags" TO "anon";
GRANT ALL ON TABLE "public"."meeting_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_tags" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_to_tags" TO "anon";
GRANT ALL ON TABLE "public"."meeting_to_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_to_tags" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_transcripts" TO "anon";
GRANT ALL ON TABLE "public"."meeting_transcripts" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_transcripts" TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_customers" TO "anon";
GRANT ALL ON TABLE "public"."stripe_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_customers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stripe_customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stripe_customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stripe_customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_orders" TO "anon";
GRANT ALL ON TABLE "public"."stripe_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stripe_orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stripe_orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stripe_orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stripe_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stripe_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stripe_subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_user_orders" TO "anon";
GRANT ALL ON TABLE "public"."stripe_user_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_user_orders" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."stripe_user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tokens" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
