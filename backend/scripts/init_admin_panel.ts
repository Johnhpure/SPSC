/**
 * Gemini 管理后台数据库初始化脚本
 * 
 * 功能：
 * 1. 读取并执行迁移 SQL 文件
 * 2. 创建所有必要的表和索引
 * 3. 插入默认配置数据
 * 
 * 使用方法：
 * npx ts-node backend/scripts/init_admin_panel.ts
 */

import { getDb } from '../src/db';
import fs from 'fs';
import path from 'path';

async function initAdminPanel() {
  console.log('🚀 开始初始化 Gemini 管理后台...\n');
  
  try {
    // 获取数据库连接
    const db = await getDb();
    console.log('✓ 数据库连接成功');
    
    // 读取迁移 SQL 文件
    const migrationPath = path.join(__dirname, '../migrations/admin_panel.sql');
    console.log(`📄 读取迁移文件: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`迁移文件不存在: ${migrationPath}`);
    }
    
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('✓ 迁移文件读取成功');
    
    // 执行迁移 SQL
    console.log('⚙️  执行数据库迁移...');
    await db.exec(migrationSql);
    console.log('✓ 数据库迁移执行成功');
    
    // 验证表是否创建成功
    console.log('\n📊 验证数据库表...');
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'gemini_%'
      ORDER BY name
    `);
    
    console.log('已创建的表:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    
    // 验证默认配置
    const config = await db.get('SELECT * FROM gemini_configs WHERE id = 1');
    if (config) {
      console.log('\n⚙️  默认配置:');
      console.log(`  - Base URL: ${config.base_url}`);
      console.log(`  - 文本模型: ${config.default_text_model}`);
      console.log(`  - 视觉模型: ${config.default_vision_model}`);
      console.log(`  - 图像生成模型: ${config.default_image_gen_model}`);
    }
    
    console.log('\n✅ Gemini 管理后台初始化完成！');
    console.log('\n📝 下一步:');
    console.log('  1. 在 .env 文件中配置 ENCRYPTION_SECRET');
    console.log('  2. 通过管理后台添加 API Key');
    console.log('  3. 配置 Base URL（如需使用代理）');
    
  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    process.exit(1);
  }
}

// 执行初始化
initAdminPanel()
  .then(() => {
    console.log('\n🎉 脚本执行完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 脚本执行出错:', error);
    process.exit(1);
  });
