import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { CONFIG } from './config';
import { getDb } from './db';
import { taskQueue } from './queue';
import { pinhaopinService } from './services/pinhaopin';
import { GeminiClientManager } from './services/gemini/client-manager';
import geminiRouter from './routes/gemini';
import geminiAdminRouter from './routes/gemini-admin';
import adminAuthRouter from './routes/admin-auth';
import path from 'path';

const app = express();

// 初始化 Gemini Client Manager
try {
    if (CONFIG.GEMINI_API_KEY) {
        GeminiClientManager.getInstance().initialize(CONFIG.GEMINI_API_KEY);
        console.log('Gemini API initialized successfully');
    } else {
        console.warn('GEMINI_API_KEY not found in environment variables. Gemini features will not be available.');
    }
} catch (error: any) {
    console.error('Failed to initialize Gemini API:', error.message);
}

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/exports', express.static(path.join(__dirname, '../exports')));

// Routes

// Gemini API 路由
app.use('/api/gemini', geminiRouter);

// Gemini 管理后台路由
app.use('/api/gemini-admin', geminiAdminRouter);

// 管理员认证路由
app.use('/api/admin', adminAuthRouter);

// 1. Diagnostics (Product List)
app.get('/api/products', async (req, res) => {
    try {
        // Fetch from external API
        const data = await pinhaopinService.getProductList(0, 50);
        res.json(data.content || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/categories', async (req, res) => {
    const cats = await pinhaopinService.getCategories();
    res.json(cats);
});

app.get('/api/keywords', async (req, res) => {
    const kws = await pinhaopinService.getRecommendKeywords();
    res.json(kws);
});

// Authentication
// 注意：登录接口已移至前端直接调用拼好拼平台 API
// 前端会直接调用 https://shop.pinhaopin.com/gateway/session/send-sms 和 login-by-mobile
// 浏览器会自动管理 Set-Cookie: token=xxx; HttpOnly

// 2. Sync
app.post('/api/sync', async (req, res) => {
    await taskQueue.add('sync', {});
    res.json({ message: 'Sync task started' });
});

// 3. Batch Optimize (Image)
app.post('/api/batch/optimize-image', async (req, res) => {
    const { productIds, prompt } = req.body; // array of platform_ids
    const db = await getDb();

    for (const pid of productIds) {
        const p: any = await db.get('SELECT * FROM products WHERE platform_id = ?', pid);
        if (p) {
            await taskQueue.add('image_opt', { goodsId: pid, imageUrl: p.image_url, prompt });
        }
    }
    res.json({ message: `Queued ${productIds.length} image optimization tasks` });
});

// 4. Batch Categorize
app.post('/api/batch/categorize', async (req, res) => {
    const { productIds } = req.body;
    const db = await getDb();

    for (const pid of productIds) {
        const p: any = await db.get('SELECT * FROM products WHERE platform_id = ?', pid);
        if (p) {
            await taskQueue.add('cat_rec', { goodsId: pid, title: p.title, description: p.title }); // Use title as desc if missing
        }
    }
    res.json({ message: `Queued ${productIds.length} categorization tasks` });
});

// 5. Apply Updates (Push to Mall)
app.post('/api/apply-updates', async (req, res) => {
    const { productIds } = req.body;
    const db = await getDb();
    const token = 'mock-token'; // TODO: Get from session/header

    let successCount = 0;

    for (const pid of productIds) {
        const p: any = await db.get('SELECT * FROM products WHERE platform_id = ?', pid);
        if (p) {
            // Construct update payload
            const updateData: any = {};
            if (p.opt_image_url) updateData.image_url = p.opt_image_url;
            if (p.opt_category_id) updateData.category_id = p.opt_category_id;

            if (Object.keys(updateData).length > 0) {
                // Token is now handled internally by the service
                await pinhaopinService.updateGoods(pid, updateData);
                await db.run(`UPDATE products SET status = 'synced' WHERE platform_id = ?`, pid);
                successCount++;
            }
        }
    }
    res.json({ message: `Applied updates for ${successCount} products` });
});

// 6. Task Status
app.get('/api/tasks', async (req, res) => {
    const db = await getDb();
    const tasks = await db.all('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 50');
    res.json(tasks);
});

// Start Server
app.listen(CONFIG.PORT, () => {
    console.log(`Server running on http://localhost:${CONFIG.PORT}`);
    console.log(`Mock Mode: ${CONFIG.MOCK_MODE}`);
});
