import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
    PORT: process.env.PORT || 3000,
    PINHAOPIN_API_BASE: process.env.PINHAOPIN_API_BASE || 'https://shop.pinhaopin.com',
    GATEWAY_BASE: 'https://shop.pinhaopin.com/gateway',
    MOCK_MODE: process.env.MOCK_MODE === 'true',
    
    // Gemini API 配置
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GEMINI_DEFAULT_TEXT_MODEL: process.env.GEMINI_DEFAULT_TEXT_MODEL || 'gemini-2.0-flash',
    GEMINI_DEFAULT_IMAGE_MODEL: process.env.GEMINI_DEFAULT_IMAGE_MODEL || 'imagen-3.0-generate-002',
    GEMINI_DEFAULT_VISION_MODEL: process.env.GEMINI_DEFAULT_VISION_MODEL || 'gemini-2.0-flash',
    
    // 性能配置
    GEMINI_MAX_CONCURRENT_REQUESTS: parseInt(process.env.GEMINI_MAX_CONCURRENT_REQUESTS || '10'),
    GEMINI_REQUEST_TIMEOUT: parseInt(process.env.GEMINI_REQUEST_TIMEOUT || '30000'),
    GEMINI_MAX_RETRIES: parseInt(process.env.GEMINI_MAX_RETRIES || '3'),
    
    // 缓存配置
    GEMINI_CACHE_ENABLED: process.env.GEMINI_CACHE_ENABLED === 'true',
    GEMINI_CACHE_TTL: parseInt(process.env.GEMINI_CACHE_TTL || '3600'),
    
    // 日志配置
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // 加密配置
    ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET || '',
    
    // MySQL 数据库配置
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '3306'),
    DB_NAME: process.env.DB_NAME || 'gemini',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
};
