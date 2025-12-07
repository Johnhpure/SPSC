-- Gemini API 管理后台数据库迁移脚本
-- 创建管理后台所需的所有表和索引

-- 1. 创建配置表
CREATE TABLE IF NOT EXISTS gemini_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_url TEXT NOT NULL,
  default_text_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  default_vision_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  default_image_gen_model TEXT NOT NULL DEFAULT 'imagen-3.0-generate-002',
  timeout INTEGER NOT NULL DEFAULT 30000,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置（仅在表为空时插入）
INSERT OR IGNORE INTO gemini_configs (id, base_url) 
SELECT 1, 'https://generativelanguage.googleapis.com'
WHERE NOT EXISTS (SELECT 1 FROM gemini_configs WHERE id = 1);

-- 2. 创建 API Key 表
CREATE TABLE IF NOT EXISTS gemini_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_active_priority ON gemini_api_keys(is_active, priority);

-- 3. 创建调用日志表
CREATE TABLE IF NOT EXISTS gemini_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  service TEXT NOT NULL,
  method TEXT NOT NULL,
  model_name TEXT NOT NULL,
  api_key_id INTEGER,
  request_params TEXT,
  response_status TEXT NOT NULL,
  response_time INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  response_data TEXT,
  error_type TEXT,
  error_message TEXT,
  user_id TEXT,
  FOREIGN KEY (api_key_id) REFERENCES gemini_api_keys(id)
);

CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON gemini_call_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_call_logs_model ON gemini_call_logs(model_name);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON gemini_call_logs(response_status);
CREATE INDEX IF NOT EXISTS idx_call_logs_request_id ON gemini_call_logs(request_id);

-- 4. 创建测速结果表
CREATE TABLE IF NOT EXISTS gemini_benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_name TEXT NOT NULL,
  test_prompt TEXT NOT NULL,
  first_token_time INTEGER,
  total_response_time INTEGER NOT NULL,
  tokens_generated INTEGER,
  tokens_per_second REAL,
  success INTEGER NOT NULL,
  error_message TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_model ON gemini_benchmarks(model_name);
CREATE INDEX IF NOT EXISTS idx_benchmarks_timestamp ON gemini_benchmarks(timestamp);

-- 5. 创建操作审计表
CREATE TABLE IF NOT EXISTS gemini_admin_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  operation_details TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_ops_user ON gemini_admin_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_ops_timestamp ON gemini_admin_operations(timestamp);
