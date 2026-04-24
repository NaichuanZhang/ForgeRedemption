-- Vector search RPC: returns top-k library hits by cosine distance
CREATE OR REPLACE FUNCTION search_library(query_embedding vector(1536), match_count int DEFAULT 3)
RETURNS TABLE (topic TEXT, content TEXT, distance FLOAT) AS $$
  SELECT topic, content, embedding <=> query_embedding AS distance
  FROM library
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
