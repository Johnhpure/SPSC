import { getDb } from '../db';
import { pinhaopinService } from '../services/pinhaopin';
import { geminiImageService } from '../services/gemini-image';
import { geminiTextService } from '../services/gemini-text';

export interface TaskPayload {
    goodsId?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    prompt?: string;
    // ... params
}

export class TaskQueue {
    private isRunning = false;
    private pollInterval = 2000;

    constructor() {
        this.startWorker();
    }

    async add(type: 'image_opt' | 'cat_rec' | 'sync', payload: any) {
        const db = await getDb();
        await db.run(
            `INSERT INTO tasks (type, payload, status) VALUES (?, ?, 'pending')`,
            type, JSON.stringify(payload)
        );
    }

    private async startWorker() {
        if (this.isRunning) return;
        this.isRunning = true;

        setInterval(async () => {
            await this.processNext();
        }, this.pollInterval);
    }

    private async processNext() {
        const db = await getDb();
        const task: any = await db.get(`SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`);

        if (!task) return;

        // Mark processing
        await db.run(`UPDATE tasks SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, task.id);

        try {
            const payload = JSON.parse(task.payload);
            let result: any = {};

            switch (task.type) {
                case 'sync':
                    try {
                        // Use new getProductList (pageNumber=0, pageSize=100)
                        const res = await pinhaopinService.getProductList(0, 100);
                        const list = res.content || [];

                        // Upsert products to DB
                        for (const item of list) {
                            // Map fields from new API (assumed)
                            // item.id, item.title, item.categoryId, item.categoryName, item.mainImage
                            await db.run(`
                                INSERT INTO products (platform_id, title, category_id, category_name, image_url, status)
                                VALUES (?, ?, ?, ?, ?, 'pending')
                                ON CONFLICT(platform_id) DO UPDATE SET
                                    title=excluded.title,
                                    image_url=excluded.image_url
                            `, item.id, item.title, item.categoryId || '', item.categoryName || '', item.mainImage || '', 'pending');
                        }
                        result = { synced: list.length };
                    } catch (e: any) {
                        if (e.message && e.message.includes('No access token')) {
                            throw new Error('Synchronization failed: Please login again.');
                        }
                        throw e;
                    }
                    break;

                case 'image_opt':
                    const optUrl = await geminiImageService.optimizeImage(payload.imageUrl, payload.prompt);
                    await db.run(`UPDATE products SET opt_image_url = ? WHERE platform_id = ?`, optUrl, payload.goodsId);
                    result = { optUrl };
                    break;

                case 'cat_rec':
                    const recs = await geminiTextService.recommendCategory(payload.title, payload.description);
                    await db.run(`UPDATE products SET opt_category_name = ? WHERE platform_id = ?`, recs.join(','), payload.goodsId);
                    result = { recommendations: recs };
                    break;
            }

            await db.run(`UPDATE tasks SET status = 'completed', result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, JSON.stringify(result), task.id);

        } catch (error: any) {
            console.error(`Task ${task.id} failed:`, error);
            await db.run(`UPDATE tasks SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, error.message, task.id);
        }
    }
}

export const taskQueue = new TaskQueue();
