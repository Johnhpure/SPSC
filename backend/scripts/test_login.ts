/**
 * 测试登录流程
 * 用法: ts-node backend/scripts/test_login.ts
 */

import { pinhaopinService } from '../src/services/pinhaopin';
import { CONFIG } from '../src/config';

async function testLogin() {
    console.log('=== 测试登录流程 ===\n');
    console.log('环境:', CONFIG.MOCK_MODE ? 'Mock 模式' : '真实环境');
    console.log('API Base:', CONFIG.PINHAOPIN_API_BASE);
    console.log('');

    try {
        // 步骤1: 发送验证码
        console.log('步骤1: 发送验证码...');
        const phone = '18616754743';
        await pinhaopinService.sendSms(phone);
        console.log('✓ 验证码发送成功\n');

        // 步骤2: 登录（需要手动输入验证码）
        console.log('步骤2: 登录...');
        console.log('请输入收到的验证码（Mock 模式下使用 8888）:');
        
        // Mock 模式测试
        if (CONFIG.MOCK_MODE) {
            const code = '8888';
            console.log('使用 Mock 验证码:', code);
            const result = await pinhaopinService.loginBySms(phone, code);
            console.log('✓ 登录成功!');
            console.log('返回数据:', JSON.stringify(result, null, 2));
        } else {
            console.log('真实环境需要手动输入验证码，请修改代码中的 code 变量');
            // const code = '123456'; // 替换为实际收到的验证码
            // const result = await pinhaopinService.loginBySms(phone, code);
            // console.log('✓ 登录成功!');
            // console.log('返回数据:', JSON.stringify(result, null, 2));
        }

    } catch (error: any) {
        console.error('✗ 测试失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
    }
}

testLogin();
