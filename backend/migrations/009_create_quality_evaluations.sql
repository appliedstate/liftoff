-- Table to store quality evaluation results for analysis and potential fine-tuning
CREATE TABLE IF NOT EXISTS quality_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Inputs
  query TEXT NOT NULL,
  page_summary TEXT NOT NULL,
  widget_summary TEXT,
  ymyl_hint BOOLEAN,
  
  -- Outputs
  classification JSONB NOT NULL, -- { ymyL, purpose, contentType }
  dimensions JSONB NOT NULL,     -- Array of { dimension, score, reasoning, guidelineSections }
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_version TEXT,            -- e.g., "gpt-4.1-mini" or "finetuned-v1"
  chunks_retrieved INTEGER,       -- Number of guideline chunks used
  evaluation_time_ms INTEGER      -- How long the evaluation took
);

-- Indexes for analysis
CREATE INDEX IF NOT EXISTS idx_quality_evaluations_created_at ON quality_evaluations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_evaluations_ymyl ON quality_evaluations((classification->>'ymyL'));
CREATE INDEX IF NOT EXISTS idx_quality_evaluations_model_version ON quality_evaluations(model_version);

-- View to track guideline section usage (which sections are cited most often)
CREATE OR REPLACE VIEW guideline_section_usage AS
SELECT 
  section,
  COUNT(*) AS usage_count,
  COUNT(DISTINCT id) AS evaluation_count
FROM (
  SELECT 
    id,
    unnest(string_to_array(
      jsonb_array_elements_text(dimensions->'guidelineSections'),
      ','
    )) AS section
  FROM quality_evaluations
) AS sections
GROUP BY section
ORDER BY usage_count DESC;

-- View to track score distributions per dimension
CREATE OR REPLACE VIEW quality_score_distribution AS
SELECT 
  dimension,
  score,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY dimension), 2) AS percentage
FROM (
  SELECT 
    jsonb_array_elements(dimensions)->>'dimension' AS dimension,
    jsonb_array_elements(dimensions)->>'score' AS score
  FROM quality_evaluations
) AS scores
GROUP BY dimension, score
ORDER BY dimension, count DESC;

