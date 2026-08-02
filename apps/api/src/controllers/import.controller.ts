import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { HttpError } from '../middleware/error.middleware';
import {
  parseFile,
  validateRows,
  importValidRows,
  generateTemplate,
  RowValidation,
} from '../services/import.service';

// ============================================
// Multer configuration (file upload memory'da)
// ============================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'application/csv',
      'text/plain', // csv sometimes comes as this
    ];
    const isAllowed =
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(xlsx|xls|csv)$/i);

    if (isAllowed) cb(null, true);
    else cb(new Error('Faqat Excel (.xlsx, .xls) yoki CSV fayl qabul qilinadi'));
  },
});

// Export middleware — routes'da ishlatiladi
export const uploadMiddleware = upload.single('file');

// ============================================
// Controllers
// ============================================

/**
 * GET /api/import/template
 * Bo'sh Excel shablon yuklab olish (yoki namuna bilan)
 * Query: ?examples=true|false
 */
export async function downloadTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const withExamples = req.query.examples !== 'false';
    const buffer = generateTemplate(withExamples);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="marketflow-shablon${withExamples ? '-namuna' : ''}.xlsx"`,
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/preview
 * Fayl yuklaydi, parse va validate qiladi, natijani qaytaradi (import qilmasdan)
 */
export async function previewImport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new HttpError(400, 'Fayl yuklanmadi');

    const rows = parseFile(req.file.buffer, req.file.originalname);

    if (rows.length === 0) {
      throw new HttpError(400, 'Faylda hech qanday satr topilmadi');
    }

    if (rows.length > 1000) {
      throw new HttpError(
        400,
        `Juda ko'p satr (${rows.length}). Maksimum 1000 ta ruxsat`,
      );
    }

    const preview = validateRows(rows);

    res.json(preview);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/execute
 * Yuborilgan validatsiya qilingan satrlarni import qiladi
 * Body: { rows: RowValidation[] }
 */
export async function executeImport(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = req.body as { rows: RowValidation[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new HttpError(400, 'rows massivi bo\'sh');
    }

    // Faqat valid'larni import qilamiz (frontend bu tekshiruvni ham qilishi kerak)
    const validRows = rows.filter((r) => r.isValid);

    if (validRows.length === 0) {
      throw new HttpError(400, 'Import qilinadigan valid satr yo\'q');
    }

    const organizationId = req.organization!.id;
    const userId = req.user!.userId;

    const result = await importValidRows(validRows, organizationId, userId);

    res.json(result);
  } catch (err) {
    next(err);
  }
}
