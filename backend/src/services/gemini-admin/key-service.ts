import { getDb } from '../../db';
import { encryptionService } from './encryption';

/**
 * API Key 数据接口
 */
export interface ApiKey {
  id: number;
  name: string;
  keyValue: string;
  isActive: boolean;
  priority: number;
  usageCount: number;
  successCount: number;
  failureCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * 密钥轮询策略接口
 */
export interface KeyRotationStrategy {
  type: 'round-robin' | 'priority' | 'random' | 'least-used';
}

/**
 * API Key 管理服务
 * 负责管理多个 API Key 及其使用策略
 */
export class AdminKeyService {
  /**
   * 获取所有 API Key 列表（脱敏显示）
   */
  async listKeys(): Promise<ApiKey[]> {
    const db = await getDb();
    const rows = await db.all(`
      SELECT 
        id, key_name, key_value, is_active, priority,
        usage_count, success_count, failure_count,
        last_used_at, created_at
      FROM gemini_api_keys
      ORDER BY priority ASC, created_at DESC
    `);

    return (rows as any[]).map((row: any) => ({
      id: row.id,
      name: row.key_name,
      keyValue: encryptionService.maskKey(encryptionService.decrypt(row.key_value)),
      isActive: row.is_active === 1,
      priority: row.priority,
      usageCount: row.usage_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at
    }));
  }

  /**
   * 添加单个 API Key
   * @param name 密钥备注名称
   * @param keyValue 密钥原始值
   * @param priority 优先级（可选，默认 100）
   */
  async addKey(name: string, keyValue: string, priority: number = 100): Promise<ApiKey> {
    // 验证密钥格式
    this.validateKeyFormat(keyValue);

    const db = await getDb();
    const encryptedKey = encryptionService.encrypt(keyValue);

    const result = await db.run(`
      INSERT INTO gemini_api_keys (key_name, key_value, priority)
      VALUES (?, ?, ?)
    `, [name, encryptedKey, priority]);

    const insertedId = (result as any).insertId || (result as any).lastID;
    if (!insertedId) {
      throw new Error('添加密钥失败');
    }

    // 返回新添加的密钥（脱敏）
    const row: any = await db.get(`
      SELECT 
        id, key_name, key_value, is_active, priority,
        usage_count, success_count, failure_count,
        last_used_at, created_at
      FROM gemini_api_keys
      WHERE id = ?
    `, [insertedId]);

    return {
      id: row.id,
      name: row.key_name,
      keyValue: encryptionService.maskKey(keyValue),
      isActive: row.is_active === 1,
      priority: row.priority,
      usageCount: row.usage_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at
    };
  }

  /**
   * 批量添加多个 API Key（原子操作）
   * @param keys 密钥数组，每个包含 name 和 keyValue
   */
  async addMultipleKeys(keys: Array<{ name: string; keyValue: string; priority?: number }>): Promise<ApiKey[]> {
    // 验证所有密钥格式
    for (const key of keys) {
      this.validateKeyFormat(key.keyValue);
    }

    const db = await getDb();
    const addedKeys: ApiKey[] = [];

    try {
      // 开始事务
      await db.run('BEGIN TRANSACTION');

      for (const key of keys) {
        const encryptedKey = encryptionService.encrypt(key.keyValue);
        const priority = key.priority ?? 100;

        const result = await db.run(`
          INSERT INTO gemini_api_keys (key_name, key_value, priority)
          VALUES (?, ?, ?)
        `, [key.name, encryptedKey, priority]);

        const insertedId = (result as any).insertId || (result as any).lastID;
        if (!insertedId) {
          throw new Error(`添加密钥 "${key.name}" 失败`);
        }

        addedKeys.push({
          id: insertedId,
          name: key.name,
          keyValue: encryptionService.maskKey(key.keyValue),
          isActive: true,
          priority: priority,
          usageCount: 0,
          successCount: 0,
          failureCount: 0,
          lastUsedAt: null,
          createdAt: new Date().toISOString()
        });
      }

      // 提交事务
      await db.run('COMMIT');
      return addedKeys;
    } catch (error) {
      // 回滚事务
      await db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * 更新 API Key
   * @param id 密钥 ID
   * @param updates 要更新的字段
   */
  async updateKey(id: number, updates: Partial<Omit<ApiKey, 'id' | 'createdAt'>>): Promise<ApiKey> {
    const db = await getDb();

    // 构建更新语句
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push('key_name = ?');
      updateValues.push(updates.name);
    }

    if (updates.keyValue !== undefined) {
      this.validateKeyFormat(updates.keyValue);
      updateFields.push('key_value = ?');
      updateValues.push(encryptionService.encrypt(updates.keyValue));
    }

    if (updates.isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(updates.isActive ? 1 : 0);
    }

    if (updates.priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(updates.priority);
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateValues.push(id);

    await db.run(`
      UPDATE gemini_api_keys
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    // 返回更新后的密钥
    const row: any = await db.get(`
      SELECT 
        id, key_name, key_value, is_active, priority,
        usage_count, success_count, failure_count,
        last_used_at, created_at
      FROM gemini_api_keys
      WHERE id = ?
    `, [id]);

    if (!row) {
      throw new Error(`密钥 ID ${id} 不存在`);
    }

    return {
      id: row.id,
      name: row.key_name,
      keyValue: encryptionService.maskKey(encryptionService.decrypt(row.key_value)),
      isActive: row.is_active === 1,
      priority: row.priority,
      usageCount: row.usage_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at
    };
  }

  /**
   * 删除 API Key
   * @param id 密钥 ID
   */
  async deleteKey(id: number): Promise<void> {
    const db = await getDb();

    // 检查密钥是否存在
    const existing = await db.get('SELECT id FROM gemini_api_keys WHERE id = ?', [id]);
    if (!existing) {
      throw new Error(`密钥 ID ${id} 不存在`);
    }

    await db.run('DELETE FROM gemini_api_keys WHERE id = ?', [id]);
  }

  /**
   * 切换密钥启用状态
   * @param id 密钥 ID
   * @param isActive 是否启用
   */
  async toggleKeyStatus(id: number, isActive: boolean): Promise<ApiKey> {
    return this.updateKey(id, { isActive });
  }

  /**
   * 根据策略获取下一个可用密钥
   * @param strategy 轮询策略
   */
  async getNextKey(strategy: KeyRotationStrategy): Promise<ApiKey> {
    const db = await getDb();

    let row: any;

    switch (strategy.type) {
      case 'round-robin':
        // 轮询策略：选择最久未使用的密钥
        row = await db.get(`
          SELECT 
            id, key_name, key_value, is_active, priority,
            usage_count, success_count, failure_count,
            last_used_at, created_at
          FROM gemini_api_keys
          WHERE is_active = 1
          ORDER BY 
            CASE WHEN last_used_at IS NULL THEN 0 ELSE 1 END,
            last_used_at ASC,
            priority ASC
          LIMIT 1
        `);
        break;

      case 'priority':
        // 优先级策略：选择优先级最高（数字最小）的密钥
        row = await db.get(`
          SELECT 
            id, key_name, key_value, is_active, priority,
            usage_count, success_count, failure_count,
            last_used_at, created_at
          FROM gemini_api_keys
          WHERE is_active = 1
          ORDER BY priority ASC, created_at DESC
          LIMIT 1
        `);
        break;

      case 'random':
        // 随机策略：随机选择一个密钥
        const allKeys: any = await db.all(`
          SELECT 
            id, key_name, key_value, is_active, priority,
            usage_count, success_count, failure_count,
            last_used_at, created_at
          FROM gemini_api_keys
          WHERE is_active = 1
        `);
        if (allKeys.length === 0) {
          throw new Error('没有可用的 API Key');
        }
        row = allKeys[Math.floor(Math.random() * allKeys.length)];
        break;

      case 'least-used':
        // 最少使用策略：选择使用次数最少的密钥
        row = await db.get(`
          SELECT 
            id, key_name, key_value, is_active, priority,
            usage_count, success_count, failure_count,
            last_used_at, created_at
          FROM gemini_api_keys
          WHERE is_active = 1
          ORDER BY usage_count ASC, priority ASC
          LIMIT 1
        `);
        break;

      default:
        throw new Error(`不支持的轮询策略: ${strategy.type}`);
    }

    if (!row) {
      throw new Error('没有可用的 API Key');
    }

    return {
      id: row.id,
      name: row.key_name,
      keyValue: encryptionService.decrypt(row.key_value), // 返回解密后的完整密钥用于 API 调用
      isActive: row.is_active === 1,
      priority: row.priority,
      usageCount: row.usage_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at
    };
  }

  /**
   * 记录密钥使用情况
   * @param id 密钥 ID
   * @param success 是否成功
   */
  async recordKeyUsage(id: number, success: boolean): Promise<void> {
    const db = await getDb();

    await db.run(`
      UPDATE gemini_api_keys
      SET 
        usage_count = usage_count + 1,
        success_count = success_count + ?,
        failure_count = failure_count + ?,
        last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [success ? 1 : 0, success ? 0 : 1, id]);
  }

  /**
   * 验证 API Key 格式
   * @param keyValue 密钥值
   */
  private validateKeyFormat(keyValue: string): void {
    if (!keyValue || keyValue.trim().length === 0) {
      throw new Error('API Key 不能为空');
    }

    // Gemini API Key 格式验证：以 'AIza' 开头，长度在 35-45 字符之间
    if (!/^AIza[A-Za-z0-9_-]{31,41}$/.test(keyValue)) {
      throw new Error('API Key 格式无效，应以 "AIza" 开头，长度在 35-45 字符之间');
    }
  }
}

// 导出单例实例
export const adminKeyService = new AdminKeyService();

/**
 * 获取密钥服务单例
 */
export function getAdminKeyService(): AdminKeyService {
  return adminKeyService;
}
