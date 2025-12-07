/**
 * 数据库初始化脚本
 * 手动运行以创建所有必需的表
 */

import { getDb } from '../src/db/index';

async function main() {
  console.log('开始初始化数据库...');
  
  try {
    // 触发数据库初始化
    await getDb();
    console.log('✓ 数据库初始化成功');
    process.exit(0);
  } catch (error) {
    console.error('✗ 数据库初始化失败:', error);
    process.exit(1);
  }
}

main();
