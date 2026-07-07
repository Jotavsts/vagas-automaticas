CREATE TABLE cv_base (
  id SERIAL PRIMARY KEY,
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
  keywords TEXT[] DEFAULT '{}',
  excluded_companies TEXT[] DEFAULT '{}',
  min_relevance_score INT DEFAULT 40,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE job_source AS ENUM ('arbeitnow','weworkremotely','remoteok','remotar');
CREATE TYPE job_status AS ENUM ('new','adapted','approved','discarded');

CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  source job_source NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  url TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now(),
  status job_status DEFAULT 'new',
  relevance_score INT,
  UNIQUE(source, external_id)
);

CREATE TABLE cv_adaptations (
  id SERIAL PRIMARY KEY,
  job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
  adapted_content JSONB NOT NULL,
  match_score INT,
  match_notes TEXT,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
  cv_adaptation_id INT REFERENCES cv_adaptations(id),
  pdf_path TEXT,
  approved_at TIMESTAMPTZ DEFAULT now(),
  opened_url TEXT
);
