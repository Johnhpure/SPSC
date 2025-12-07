import mysql from 'mysql2/promise';
import { CONFIG } from '../config';

let pool: mysql.Pool | null = null;
let isInitialized = false;

/**
 * 获取 MySQL 连接池
 */
export function getPool(): mysql.Pool {
    if (!pool) {
        pool = mysql.createPool({
            host: CONFIG.DB_HOST,
            port: CONFIG.DB_PORT,
            user: CONFIG.DB_USER,
            password: CONFIG.DB_PASSWORD,
            database: CONFIG.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
        });
        
        console.log(`MySQL 连接池已创建: ${CONFIG.DB_HOST}:${CONFIG.DB_PORT}/${CONFIG.DB_NAME}`);
    }
    return pool;
}

/**
 * 兼容 sqlite 接口的数据库包装器
 */
export async function getDb() {
    const pool = getPool();
    
    // 初始化数据库表结构（只执行一次）
    if (!isInitialized) {
        await initSchema(pool);
        isInitialized = true;
    }
    
    // 返回兼容 sqlite 接口的对象
    return {
        async get(sql: string, ...params: any[]) {
            const [rows] = await pool.execute(sql, params);
            return Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined;
        },
        async all(sql: string, ...params: any[]) {
            const [rows] = await pool.execute(sql, params);
            return rows;
        },
        async run(sql: string, ...params: any[]) {
            const [result] = await pool.execute(sql, params);
            return result;
        },
        async exec(sql: string) {
            const statements = sql.split(';').filter(s => s.trim());
            for (const statement of statements) {
                if (statement.trim()) {
                    await pool.execute(statement);
                }
            }
        },
    };
}

async function initSchema(pool: mysql.Pool) {
    const connection = await pool.getConnection();
    
    try {
        // 创建 products 表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                platform_id VARCHAR(255) UNIQUE NOT NULL,
                title TEXT,
                category_id VARCHAR(255),
                category_name VARCHAR(255),
                image_url TEXT,
                
                opt_image_url TEXT,
                opt_category_id VARCHAR(255),
                opt_category_name VARCHAR(255),
                
                status VARCHAR(50) DEFAULT 'pending',
                diagnosis_tags TEXT,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_platform_id (platform_id),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 创建 tasks 表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                payload TEXT,
                result TEXT,
                error TEXT,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_type (type),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 创建 Gemini 管理后台相关表
        
        // 配置表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS gemini_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                base_url VARCHAR(500) NOT NULL DEFAULT 'https://generativelanguage.googleapis.com',
                model VARCHAR(100) NOT NULL DEFAULT 'gemini-2.0-flash-exp',
                api_version VARCHAR(50) DEFAULT 'v1beta',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // 插入默认配置（如果不存在）
        await connection.execute(`
            INSERT IGNORE INTO gemini_configs (id, base_url, model, api_version)
            VALUES (1, 'https://generativelanguage.googleapis.com', 'gemini-2.0-flash-exp', 'v1beta')
        `);
        
        // API Keys 表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS gemini_api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_value VARCHAR(500) NOT NULL,
                key_name VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                usage_count INT DEFAULT 0,
                last_used_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_is_active (is_active),
                INDEX idx_usage_count (usage_count)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // API 调用日志表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS gemini_call_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id VARCHAR(100) UNIQUE NOT NULL,
                service VARCHAR(100),
                method VARCHAR(100),
                model_name VARCHAR(100),
                prompt TEXT,
                response TEXT,
                status VARCHAR(50),
                error_message TEXT,
                response_time INT,
                prompt_tokens INT DEFAULT 0,
                completion_tokens INT DEFAULT 0,
                total_tokens INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_request_id (request_id),
                INDEX idx_service (service),
                INDEX idx_model_name (model_name),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 测速历史表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS gemini_benchmarks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_name VARCHAR(100) NOT NULL,
                test_prompt TEXT,
                response_time INT,
                first_token_time INT,
                tokens_per_second DECIMAL(10, 2),
                prompt_tokens INT DEFAULT 0,
                completion_tokens INT DEFAULT 0,
                total_tokens INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_model_name (model_name),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 管理员操作日志表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS gemini_admin_operations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                operation_type VARCHAR(100) NOT NULL,
                operation_details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_user_id (user_id),
                INDEX idx_operation_type (operation_type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('数据库表结构初始化完成');
    } finally {
        connection.release();
    }
}
