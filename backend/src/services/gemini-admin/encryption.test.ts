/**
 * EncryptionService 单元测试
 * 
 * 测试加密服务的核心功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from './encryption';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    // 使用测试密钥初始化
    service = new EncryptionService('test-secret-key-for-encryption');
  });

  describe('加密和解密', () => {
    it('应该成功加密文本', () => {
      const plaintext = 'AIzaSyDemoKey1234567890abcdefghijklmn';
      const encrypted = service.encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:encrypted
    });

    it('应该成功解密文本', () => {
      const plaintext = 'AIzaSyDemoKey1234567890abcdefghijklmn';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('加密相同文本应该产生不同的密文（因为 IV 随机）', () => {
      const plaintext = 'AIzaSyDemoKey1234567890abcdefghijklmn';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // 但解密后应该相同
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('应该能加密和解密空字符串', () => {
      const plaintext = '';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('应该能加密和解密包含特殊字符的文本', () => {
      const plaintext = 'AIza!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('应该能加密和解密中文文本', () => {
      const plaintext = '这是一个测试密钥：AIzaSyTest123';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('应该拒绝解密格式无效的文本', () => {
      expect(() => service.decrypt('invalid-format')).toThrow('加密文本格式无效');
      // 格式正确但内容无效的密文会在解密时抛出错误
      expect(() => service.decrypt('only:two:parts')).toThrow();
      expect(() => service.decrypt('too:many:parts:here')).toThrow();
    });

    it('应该拒绝解密被篡改的密文', () => {
      const plaintext = 'AIzaSyDemoKey1234567890abcdefghijklmn';
      const encrypted = service.encrypt(plaintext);
      
      // 篡改密文
      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:${parts[1]}:${parts[2]!.substring(0, parts[2]!.length - 2)}00`;
      
      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('密钥脱敏', () => {
    it('应该正确脱敏标准长度的 API Key', () => {
      const key = 'AIzaSyDemoKey1234567890abcdefghijklmn';
      const masked = service.maskKey(key);
      
      expect(masked).toBe('AIza...klmn');
      expect(masked).not.toContain('DemoKey');
    });

    it('应该脱敏短密钥', () => {
      const key = 'short';
      const masked = service.maskKey(key);
      
      expect(masked).toBe('***');
    });

    it('应该脱敏空字符串', () => {
      const masked = service.maskKey('');
      expect(masked).toBe('***');
    });

    it('应该脱敏恰好 8 个字符的密钥', () => {
      const key = '12345678';
      const masked = service.maskKey(key);
      
      expect(masked).toBe('***');
    });

    it('应该脱敏 9 个字符的密钥', () => {
      const key = '123456789';
      const masked = service.maskKey(key);
      
      expect(masked).toBe('1234...6789');
    });

    it('脱敏后的密钥应该不包含中间部分', () => {
      const key = 'AIzaSyDemoKey1234567890abcdefghijklmn';
      const masked = service.maskKey(key);
      
      // 确保中间部分被隐藏
      expect(masked).not.toContain('DemoKey');
      expect(masked).not.toContain('1234567890');
      expect(masked).not.toContain('abcdefghij');
    });
  });

  describe('加密往返一致性', () => {
    it('多次加密解密应该保持数据一致', () => {
      const plaintext = 'AIzaSyDemoKey1234567890abcdefghijklmn';
      
      // 第一次往返
      const encrypted1 = service.encrypt(plaintext);
      const decrypted1 = service.decrypt(encrypted1);
      expect(decrypted1).toBe(plaintext);
      
      // 第二次往返
      const encrypted2 = service.encrypt(decrypted1);
      const decrypted2 = service.decrypt(encrypted2);
      expect(decrypted2).toBe(plaintext);
      
      // 第三次往返
      const encrypted3 = service.encrypt(decrypted2);
      const decrypted3 = service.decrypt(encrypted3);
      expect(decrypted3).toBe(plaintext);
    });
  });
});
