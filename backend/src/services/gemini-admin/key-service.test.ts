/**
 * AdminKeyService 单元测试
 * 
 * 测试 API Key 管理服务的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdminKeyService } from './key-service';
import { getDb } from '../../db';

describe('AdminKeyService', () => {
  let service: AdminKeyService;

  beforeEach(async () => {
    service = new AdminKeyService();
    
    // 清空测试数据
    const db = await getDb();
    await db.run('DELETE FROM gemini_api_keys');
  });

  afterEach(async () => {
    // 清理测试数据
    const db = await getDb();
    await db.run('DELETE FROM gemini_api_keys');
  });

  describe('密钥列表', () => {
    it('应该返回空列表当没有密钥时', async () => {
      const keys = await service.listKeys();
      expect(keys).toEqual([]);
    });

    it('应该返回所有密钥并脱敏显示', async () => {
      await service.addKey('测试密钥1', 'AIzaSyTest1234567890abcdefghijklmno');
      await service.addKey('测试密钥2', 'AIzaSyTest2234567890abcdefghijklmno');
      
      const keys = await service.listKeys();
      
      expect(keys.length).toBe(2);
      expect(keys[0]!.keyValue).toBe('AIza...lmno');
      expect(keys[1]!.keyValue).toBe('AIza...lmno');
    });

    it('应该按优先级和创建时间排序', async () => {
      await service.addKey('低优先级', 'AIzaSyTest1234567890abcdefghijklmno', 200);
      await service.addKey('高优先级', 'AIzaSyTest2234567890abcdefghijklmno', 50);
      await service.addKey('中优先级', 'AIzaSyTest3234567890abcdefghijklmno', 100);
      
      const keys = await service.listKeys();
      
      expect(keys[0]!.name).toBe('高优先级');
      expect(keys[1]!.name).toBe('中优先级');
      expect(keys[2]!.name).toBe('低优先级');
    });
  });

  describe('添加密钥', () => {
    it('应该成功添加单个密钥', async () => {
      const key = await service.addKey(
        '测试密钥',
        'AIzaSyTest1234567890abcdefghijklmno'
      );
      
      expect(key.id).toBeDefined();
      expect(key.name).toBe('测试密钥');
      expect(key.keyValue).toBe('AIza...lmno');
      expect(key.isActive).toBe(true);
      expect(key.priority).toBe(100);
      expect(key.usageCount).toBe(0);
    });

    it('应该支持自定义优先级', async () => {
      const key = await service.addKey(
        '高优先级密钥',
        'AIzaSyTest1234567890abcdefghijklmno',
        10
      );
      
      expect(key.priority).toBe(10);
    });

    it('应该拒绝空密钥', async () => {
      await expect(
        service.addKey('空密钥', '')
      ).rejects.toThrow('API Key 不能为空');
    });

    it('应该拒绝格式无效的密钥', async () => {
      await expect(
        service.addKey('无效密钥', 'invalid-key-format')
      ).rejects.toThrow('API Key 格式无效');
    });

    it('应该拒绝不以 AIza 开头的密钥', async () => {
      await expect(
        service.addKey('错误前缀', 'BIzaSyTest1234567890abcdefghijklmno')
      ).rejects.toThrow('API Key 格式无效');
    });

    it('应该拒绝长度不足的密钥', async () => {
      await expect(
        service.addKey('太短', 'AIzaShort')
      ).rejects.toThrow('API Key 格式无效');
    });
  });

  describe('批量添加密钥', () => {
    it('应该成功批量添加多个密钥', async () => {
      const keys = await service.addMultipleKeys([
        { name: '密钥1', keyValue: 'AIzaSyTest1234567890abcdefghijklmno' },
        { name: '密钥2', keyValue: 'AIzaSyTest2234567890abcdefghijklmno' },
        { name: '密钥3', keyValue: 'AIzaSyTest3234567890abcdefghijklmno' }
      ]);
      
      expect(keys.length).toBe(3);
      expect(keys[0]!.name).toBe('密钥1');
      expect(keys[1]!.name).toBe('密钥2');
      expect(keys[2]!.name).toBe('密钥3');
    });

    it('应该支持批量添加时设置不同优先级', async () => {
      const keys = await service.addMultipleKeys([
        { name: '密钥1', keyValue: 'AIzaSyTest1234567890abcdefghijklmno', priority: 10 },
        { name: '密钥2', keyValue: 'AIzaSyTest2234567890abcdefghijklmno', priority: 20 }
      ]);
      
      expect(keys[0]!.priority).toBe(10);
      expect(keys[1]!.priority).toBe(20);
    });

    it('批量添加失败时应该回滚所有操作', async () => {
      await expect(
        service.addMultipleKeys([
          { name: '有效密钥', keyValue: 'AIzaSyTest1234567890abcdefghijklmno' },
          { name: '无效密钥', keyValue: 'invalid-key' }
        ])
      ).rejects.toThrow();
      
      // 验证没有任何密钥被添加
      const keys = await service.listKeys();
      expect(keys.length).toBe(0);
    });
  });

  describe('更新密钥', () => {
    it('应该成功更新密钥名称', async () => {
      const added = await service.addKey('原名称', 'AIzaSyTest1234567890abcdefghijklmno');
      const updated = await service.updateKey(added.id, { name: '新名称' });
      
      expect(updated.name).toBe('新名称');
    });

    it('应该成功更新密钥优先级', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      const updated = await service.updateKey(added.id, { priority: 50 });
      
      expect(updated.priority).toBe(50);
    });

    it('应该成功更新密钥状态', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      const updated = await service.updateKey(added.id, { isActive: false });
      
      expect(updated.isActive).toBe(false);
    });

    it('应该支持同时更新多个字段', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      const updated = await service.updateKey(added.id, {
        name: '新名称',
        priority: 30,
        isActive: false
      });
      
      expect(updated.name).toBe('新名称');
      expect(updated.priority).toBe(30);
      expect(updated.isActive).toBe(false);
    });

    it('应该拒绝更新不存在的密钥', async () => {
      await expect(
        service.updateKey(99999, { name: '新名称' })
      ).rejects.toThrow('密钥 ID 99999 不存在');
    });

    it('应该拒绝没有更新字段的请求', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      
      await expect(
        service.updateKey(added.id, {})
      ).rejects.toThrow('没有要更新的字段');
    });
  });

  describe('删除密钥', () => {
    it('应该成功删除存在的密钥', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      
      await service.deleteKey(added.id);
      
      const keys = await service.listKeys();
      expect(keys.length).toBe(0);
    });

    it('应该拒绝删除不存在的密钥', async () => {
      await expect(
        service.deleteKey(99999)
      ).rejects.toThrow('密钥 ID 99999 不存在');
    });

    it('删除后再次删除应该失败（幂等性）', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      
      await service.deleteKey(added.id);
      
      await expect(
        service.deleteKey(added.id)
      ).rejects.toThrow(`密钥 ID ${added.id} 不存在`);
    });
  });

  describe('切换密钥状态', () => {
    it('应该成功禁用密钥', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      const toggled = await service.toggleKeyStatus(added.id, false);
      
      expect(toggled.isActive).toBe(false);
    });

    it('应该成功启用密钥', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      await service.toggleKeyStatus(added.id, false);
      const toggled = await service.toggleKeyStatus(added.id, true);
      
      expect(toggled.isActive).toBe(true);
    });
  });

  describe('密钥轮询策略', () => {
    beforeEach(async () => {
      // 添加测试密钥
      await service.addKey('密钥1', 'AIzaSyTest1234567890abcdefghijklmno', 100);
      await service.addKey('密钥2', 'AIzaSyTest2234567890abcdefghijklmno', 50);
      await service.addKey('密钥3', 'AIzaSyTest3234567890abcdefghijklmno', 150);
    });

    it('优先级策略应该返回优先级最高的密钥', async () => {
      const key = await service.getNextKey({ type: 'priority' });
      expect(key.name).toBe('密钥2'); // priority = 50
    });

    it('轮询策略应该返回最久未使用的密钥', async () => {
      const key1 = await service.getNextKey({ type: 'round-robin' });
      await service.recordKeyUsage(key1.id, true);
      
      const key2 = await service.getNextKey({ type: 'round-robin' });
      expect(key2.id).not.toBe(key1.id);
    });

    it('最少使用策略应该返回使用次数最少的密钥', async () => {
      const keys = await service.listKeys();
      await service.recordKeyUsage(keys[0]!.id, true);
      await service.recordKeyUsage(keys[0]!.id, true);
      
      const key = await service.getNextKey({ type: 'least-used' });
      expect(key.id).not.toBe(keys[0]!.id);
    });

    it('随机策略应该返回一个可用密钥', async () => {
      const key = await service.getNextKey({ type: 'random' });
      expect(key).toBeDefined();
      expect(key.isActive).toBe(true);
    });

    it('应该不返回已禁用的密钥', async () => {
      const keys = await service.listKeys();
      
      // 禁用所有密钥除了一个
      await service.toggleKeyStatus(keys[0]!.id, false);
      await service.toggleKeyStatus(keys[1]!.id, false);
      
      const key = await service.getNextKey({ type: 'priority' });
      expect(key.id).toBe(keys[2]!.id);
    });

    it('没有可用密钥时应该抛出错误', async () => {
      const keys = await service.listKeys();
      
      // 禁用所有密钥
      for (const k of keys) {
        await service.toggleKeyStatus(k.id, false);
      }
      
      await expect(
        service.getNextKey({ type: 'priority' })
      ).rejects.toThrow('没有可用的 API Key');
    });

    it('getNextKey 应该返回完整的未脱敏密钥', async () => {
      const key = await service.getNextKey({ type: 'priority' });
      
      // 应该是完整密钥，不是脱敏的
      expect(key.keyValue).toMatch(/^AIzaSyTest/);
      expect(key.keyValue).not.toContain('...');
    });
  });

  describe('记录密钥使用', () => {
    it('应该记录成功的使用', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      
      await service.recordKeyUsage(added.id, true);
      
      const keys = await service.listKeys();
      expect(keys[0]!.usageCount).toBe(1);
      expect(keys[0]!.successCount).toBe(1);
      expect(keys[0]!.failureCount).toBe(0);
      expect(keys[0]!.lastUsedAt).toBeDefined();
    });

    it('应该记录失败的使用', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      
      await service.recordKeyUsage(added.id, false);
      
      const keys = await service.listKeys();
      expect(keys[0]!.usageCount).toBe(1);
      expect(keys[0]!.successCount).toBe(0);
      expect(keys[0]!.failureCount).toBe(1);
    });

    it('应该累计多次使用', async () => {
      const added = await service.addKey('测试', 'AIzaSyTest1234567890abcdefghijklmno');
      
      await service.recordKeyUsage(added.id, true);
      await service.recordKeyUsage(added.id, true);
      await service.recordKeyUsage(added.id, false);
      
      const keys = await service.listKeys();
      expect(keys[0]!.usageCount).toBe(3);
      expect(keys[0]!.successCount).toBe(2);
      expect(keys[0]!.failureCount).toBe(1);
    });
  });
});
