-- Script de migração do banco de dados
-- Adapta Aí - Notificações Telegram, Status de Candidaturas e Canais Personalizados

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN
    CREATE TYPE application_status AS ENUM (
      'enviado', 'em_processo', 'oferta', 'rejeitado', 'desistiu'
    );
  END IF;
END $$;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS status application_status DEFAULT 'enviado';

ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS telegram_channels TEXT[] DEFAULT '{}';

ALTER TYPE job_source ADD VALUE IF NOT EXISTS 'telegram';
