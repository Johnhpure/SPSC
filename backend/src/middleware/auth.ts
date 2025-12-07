/**
 * 权限验证中间件
 * 提供身份验证和权限检查功能
 */

import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/index';

/**
 * 扩展 Express Request 类型以包含用户信息
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isAdmin?: boolean;
    }
  }
}

/**
 * 记录操作审计日志
 * @param userId 用户 ID
 * @param operationType 操作类型
 * @param operationDetails 操作详情（JSON 字符串）
 */
export async function recordAuditLog(
  userId: string,
  operationType: string,
  operationDetails?: any
): Promise<void> {
  try {
    const db = await getDb();
    await db.run(
      `INSERT INTO gemini_admin_operations (user_id, operation_type, operation_details)
       VALUES (?, ?, ?)`,
      userId,
      operationType,
      operationDetails ? JSON.stringify(operationDetails) : null
    );
  } catch (error) {
    console.error('Failed to record audit log:', error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 身份验证中间件
 * 验证用户是否已登录
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // 从 cookie 中获取 token（Pinhaopin 平台的认证 token）
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '请先登录',
      },
    });
    return;
  }

  // 简单验证：token 存在即认为已登录
  // 实际项目中可以调用 Pinhaopin API 验证 token 有效性
  // 这里为了简化，假设有 token 就是已登录用户
  req.userId = token; // 使用 token 作为 userId（简化处理）

  next();
}

/**
 * 管理员权限验证中间件
 * 验证用户是否具有管理员权限
 * 必须在 requireAuth 之后使用
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // 检查是否已通过身份验证
  if (!req.userId) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '请先登录',
      },
    });
    return;
  }

  // 简化处理：所有已登录用户都视为管理员
  // 实际项目中应该查询用户角色或权限表
  req.isAdmin = true;

  next();
}

/**
 * 管理后台独立认证中间件
 * 使用 Authorization header 进行认证，与主前端的 cookie 认证分离
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  // 从 Authorization header 获取 token
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '请先登录管理后台',
      },
    });
    return;
  }

  const token = authHeader.substring(7); // 移除 "Bearer " 前缀

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '无效的认证令牌',
      },
    });
    return;
  }

  // 简化处理：token 存在即认为是管理员
  // 实际项目中应该验证 token 的有效性和权限
  req.userId = token;
  req.isAdmin = true;

  next();
}

/**
 * 审计日志中间件
 * 自动记录敏感操作的审计日志
 * 必须在 requireAuth 之后使用
 */
export function auditLog(operationType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId || 'anonymous';
    const operationDetails = {
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query,
      ip: req.ip,
    };

    try {
      await recordAuditLog(userId, operationType, operationDetails);
    } catch (error) {
      console.error('Audit log failed:', error);
      // 继续执行，不因审计日志失败而中断请求
    }

    next();
  };
}
