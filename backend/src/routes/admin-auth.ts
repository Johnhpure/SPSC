import { Router } from 'express';
import { CONFIG } from '../config';

const router = Router();

// 简单的管理员认证（实际项目中应使用数据库和加密）
const ADMIN_USERS = [
  {
    username: 'admin',
    password: 'admin123', // 实际项目中应使用 bcrypt 加密
    role: 'admin'
  }
];

/**
 * 管理员登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 查找用户
    const user = ADMIN_USERS.find(
      u => u.username === username && u.password === password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 返回用户信息（不包含密码）
    res.json({
      success: true,
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('管理员登录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '登录失败'
    });
  }
});

/**
 * 验证管理员身份
 */
router.get('/verify', async (req, res) => {
  try {
    // 这里应该验证 token 或 session
    // 简化版本直接返回成功
    res.json({
      success: true,
      user: {
        username: 'admin',
        role: 'admin'
      }
    });
  } catch (error: any) {
    console.error('验证失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '验证失败'
    });
  }
});

/**
 * 管理员登出
 */
router.post('/logout', async (req, res) => {
  try {
    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error: any) {
    console.error('登出失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '登出失败'
    });
  }
});

export default router;
