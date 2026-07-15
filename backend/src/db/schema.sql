CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cv_base (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  full_name TEXT NOT NULL,
  contact JSONB NOT NULL,
  summary TEXT NOT NULL,
  experience JSONB NOT NULL,
  education JSONB NOT NULL,
  skills JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  keywords TEXT[] DEFAULT '{}',
  excluded_companies TEXT[] DEFAULT '{}',
  min_relevance_score INT DEFAULT 40,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE job_source AS ENUM ('remotar','vagascombr','empregaju','solides');

CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  source job_source NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  modality TEXT,
  state TEXT,
  summary TEXT,
  keywords TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  url TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now(),
  relevance_score INT,
  UNIQUE(source, external_id)
);

CREATE TABLE active_job_areas (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  vagascombr_slug TEXT NOT NULL UNIQUE,
  remotar_category_ids INT[] NOT NULL DEFAULT '{}',
  solides_query TEXT NOT NULL DEFAULT '',
  source_label TEXT,
  created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed: preserva o comportamento atual (só tecnologia) até que áreas novas
-- sejam ativadas sob demanda pelo jobAreaResolver.
INSERT INTO active_job_areas (label, vagascombr_slug, remotar_category_ids, solides_query, source_label)
VALUES ('Tecnologia', 'tecnologia', '{4,7,13,14,8,9}', '', 'seed-default')
ON CONFLICT (vagascombr_slug) DO NOTHING;

CREATE TABLE cv_adaptations (
  id SERIAL PRIMARY KEY,
  job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cv_base_id INT REFERENCES cv_base(id) ON DELETE SET NULL,
  adapted_content JSONB NOT NULL,
  match_score INT,
  match_notes TEXT,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cv_adaptation_id INT REFERENCES cv_adaptations(id),
  pdf_path TEXT,
  approved_at TIMESTAMPTZ DEFAULT now(),
  opened_url TEXT
);
