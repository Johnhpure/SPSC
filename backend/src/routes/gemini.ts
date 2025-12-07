import { Router, Request, Response } from 'express';
import { Logger } from '../services/gemini/logger';
import { 
  getTextService, 
  getImageService, 
  getFileService, 
  getStreamService 
} from '../services/gemini-admin/service-factory';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = Router();
const logger = Logger.getInstance();

// 配置文件上传
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

// 获取服务实例（带日志拦截）
const textService = getTextService();
const imageService = getImageService();
const fileService = getFileService();
const streamService = getStreamService();

/**
 * POST /api/gemini/text
 * 文本生成端点
 * 
 * Body:
 * - prompt: string (必需) - 文本提示
 * - options?: TextGenerationOptions - 生成选项
 */
router.post('/text', async (req: Request, res: Response) => {
  try {
    const { prompt, options } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'prompt is required and must be a string',
      });
    }

    logger.info( 'Text generation request', { prompt: prompt.substring(0, 100) });

    const result = await textService.generateText(prompt, options);

    res.json({
      success: true,
      data: {
        text: result,
      },
    });
  } catch (error: any) {
    logger.error( 'Text generation failed', { error: error.message });
    res.status(500).json({
      error: 'Text generation failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/gemini/text/categories
 * 类目推荐端点
 * 
 * Body:
 * - title: string (必需) - 产品标题
 * - description: string (必需) - 产品描述
 */
router.post('/text/categories', async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'title and description are required',
      });
    }

    logger.info( 'Category recommendation request', { title });

    const categories = await textService.recommendCategories(title, description);

    res.json({
      success: true,
      data: {
        categories,
      },
    });
  } catch (error: any) {
    logger.error( 'Category recommendation failed', { error: error.message });
    res.status(500).json({
      error: 'Category recommendation failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/gemini/text/analyze
 * 产品分析端点
 * 
 * Body:
 * - title: string (必需) - 产品标题
 * - description: string (必需) - 产品描述
 * - imageUrl?: string - 产品图像URL
 */
router.post('/text/analyze', async (req: Request, res: Response) => {
  try {
    const { title, description, imageUrl } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'title and description are required',
      });
    }

    logger.info( 'Product analysis request', { title });

    const analysis = await textService.analyzeProduct(title, description, imageUrl);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    logger.error( 'Product analysis failed', { error: error.message });
    res.status(500).json({
      error: 'Product analysis failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/gemini/image/analyze
 * 图像分析端点
 * 
 * Body (multipart/form-data):
 * - image: File (可选) - 图像文件
 * - imageUrl: string (可选) - 图像URL
 * - prompt: string (必需) - 分析提示
 * - options?: ImageAnalysisOptions - 分析选项
 * 
 * 注意：image 和 imageUrl 必须提供其中之一
 */
router.post('/image/analyze', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { imageUrl, prompt, options } = req.body;
    const imageFile = req.file;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'prompt is required and must be a string',
      });
    }

    if (!imageFile && !imageUrl) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Either image file or imageUrl must be provided',
      });
    }

    logger.info( 'Image analysis request', { 
      hasFile: !!imageFile, 
      hasUrl: !!imageUrl 
    });

    let imageSource: string | Buffer;

    if (imageFile) {
      // 读取上传的文件
      imageSource = await fs.readFile(imageFile.path);
      // 清理临时文件
      await fs.unlink(imageFile.path).catch(() => {});
    } else {
      imageSource = imageUrl;
    }

    const parsedOptions = options ? JSON.parse(options) : undefined;
    const analysis = await imageService.analyzeImage(imageSource, prompt, parsedOptions);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    logger.error( 'Image analysis failed', { error: error.message });
    res.status(500).json({
      error: 'Image analysis failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/gemini/image/generate
 * 图像生成端点
 * 
 * Body:
 * - prompt: string (必需) - 图像生成提示
 * - options?: ImageGenerationOptions - 生成选项
 * - saveToFile?: boolean - 是否保存到文件系统
 */
router.post('/image/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, options, saveToFile } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'prompt is required and must be a string',
      });
    }

    logger.info( 'Image generation request', { prompt: prompt.substring(0, 100) });

    const images = await imageService.generateImage(prompt, options);

    // 如果需要保存到文件
    if (saveToFile) {
      const uploadsDir = path.join(__dirname, '../../uploads');
      
      for (const image of images) {
        const timestamp = Date.now();
        const filename = `generated_${timestamp}.png`;
        const filepath = path.join(uploadsDir, filename);
        
        const buffer = Buffer.from(image.imageBytes, 'base64');
        await fs.writeFile(filepath, buffer);
        
        image.savedPath = filepath;
        image.url = `/uploads/${filename}`;
      }
    }

    res.json({
      success: true,
      data: {
        images,
      },
    });
  } catch (error: any) {
    logger.error( 'Image generation failed', { error: error.message });
    res.status(500).json({
      error: 'Image generation failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/gemini/image/optimize
 * 产品图像优化端点
 * 
 * Body:
 * - imageUrl: string (必需) - 产品图像URL
 * - productInfo: ProductInfo (必需) - 产品信息
 */
router.post('/image/optimize', async (req: Request, res: Response) => {
  try {
    const { imageUrl, productInfo } = req.body;

    if (!imageUrl || !productInfo) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'imageUrl and productInfo are required',
      });
    }

    logger.info( 'Image optimization request', { imageUrl });

    const optimizedUrl = await imageService.optimizeProductImage(imageUrl, productInfo);

    res.json({
      success: true,
      data: {
        optimizedUrl,
      },
    });
  } catch (error: any) {
    logger.error( 'Image optimization failed', { error: error.message });
    res.status(500).json({
      error: 'Image optimization failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/gemini/stream
 * 流式生成端点
 * 
 * Query:
 * - prompt: string (必需) - 文本提示
 * - model?: string - 模型名称
 * - maxOutputTokens?: number - 最大输出token数
 */
router.get('/stream', async (req: Request, res: Response) => {
  try {
    const { prompt, model, maxOutputTokens, temperature } = req.query;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'prompt query parameter is required',
      });
    }

    logger.info( 'Stream generation request', { prompt: prompt.substring(0, 100) });

    const options: any = {};
    if (model) options.model = model as string;
    if (maxOutputTokens) options.maxOutputTokens = parseInt(maxOutputTokens as string);
    if (temperature) options.temperature = parseFloat(temperature as string);

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await streamService.streamToSSE(res, prompt, options);
  } catch (error: any) {
    logger.error( 'Stream generation failed', { error: error.message });
    
    // 如果响应头还未发送，返回错误
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Stream generation failed',
        message: error.message,
      });
    }
  }
});

/**
 * POST /api/gemini/files
 * 文件上传端点
 * 
 * Body (multipart/form-data):
 * - file: File (必需) - 要上传的文件
 * - displayName?: string - 显示名称
 */
router.post('/files', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { displayName } = req.body;

    if (!file) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'file is required',
      });
    }

    logger.info( 'File upload request', { 
      filename: file.originalname,
      size: file.size 
    });

    const options: any = {
      mimeType: file.mimetype,
    };
    if (displayName) options.displayName = displayName;

    const uploadedFile = await fileService.uploadFile(file.path, options);

    // 清理临时文件
    await fs.unlink(file.path).catch(() => {});

    res.json({
      success: true,
      data: uploadedFile,
    });
  } catch (error: any) {
    logger.error( 'File upload failed', { error: error.message });
    res.status(500).json({
      error: 'File upload failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/gemini/files
 * 文件列表端点
 * 
 * Query:
 * - pageSize?: number - 每页数量
 * - pageToken?: string - 分页token
 */
router.get('/files', async (req: Request, res: Response) => {
  try {
    const { pageSize, pageToken } = req.query;

    const options: any = {};
    if (pageSize) options.pageSize = parseInt(pageSize as string);
    if (pageToken) options.pageToken = pageToken as string;

    logger.info( 'File list request', options);

    const fileList = await fileService.listFiles(options);

    res.json({
      success: true,
      data: fileList,
    });
  } catch (error: any) {
    logger.error( 'File list failed', { error: error.message });
    res.status(500).json({
      error: 'File list failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/gemini/files/:fileName
 * 获取文件信息端点
 * 
 * Params:
 * - fileName: string (必需) - 文件名称
 */
router.get('/files/:fileName', async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'fileName is required',
      });
    }

    logger.info( 'Get file info request', { fileName });

    const fileInfo = await fileService.getFile(fileName);

    res.json({
      success: true,
      data: fileInfo,
    });
  } catch (error: any) {
    logger.error( 'Get file info failed', { error: error.message });
    res.status(500).json({
      error: 'Get file info failed',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/gemini/files/:fileName
 * 删除文件端点
 * 
 * Params:
 * - fileName: string (必需) - 文件名称
 */
router.delete('/files/:fileName', async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'fileName is required',
      });
    }

    logger.info( 'Delete file request', { fileName });

    await fileService.deleteFile(fileName);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    logger.error( 'Delete file failed', { error: error.message });
    res.status(500).json({
      error: 'Delete file failed',
      message: error.message,
    });
  }
});

export default router;

