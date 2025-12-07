import crypto from 'crypto';
import { CONFIG } from '../../config';

/**
 * 加密服务类
 * 使用 AES-256-GCM 算法对敏感数据进行加密和解密
 */
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor(secretKey?: string) {
    const secret = secretKey || CONFIG.ENCRYPTION_SECRET;
    if (!secret) {
      throw new Error('加密密钥未配置，请设置 ENCRYPTION_SECRET 环境变量');
    }
    // 使用 scrypt 从密钥派生固定长度的加密密钥
    this.key = crypto.scryptSync(secret, 'gemini-admin-salt', 32);
  }

  /**
   * 加密文本
   * @param text 要加密的明文
   * @returns 加密后的文本，格式为 "iv:authTag:encrypted"
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // 返回格式：iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密文本
   * @param encryptedText 加密的文本，格式为 "iv:authTag:encrypted"
   * @returns 解密后的明文
   */
  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('加密文本格式无效');
    }

    const ivHex: string = parts[0]!;
    const authTagHex: string = parts[1]!;
    const encrypted: string = parts[2]!;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    
    const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * 对 API Key 进行脱敏显示
   * @param keyValue API Key 原始值
   * @returns 脱敏后的字符串，格式为 "前4位...后4位"
   */
  maskKey(keyValue: string): string {
    if (!keyValue || keyValue.length <= 8) {
      return '***';
    }
    return `${keyValue.substring(0, 4)}...${keyValue.substring(keyValue.length - 4)}`;
  }
}

// 导出单例实例
export const encryptionService = new EncryptionService();

/**
 * 获取加密服务单例
 */
export function getEncryptionService(): EncryptionService {
  return encryptionService;
}
