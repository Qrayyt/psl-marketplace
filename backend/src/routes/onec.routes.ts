import { Router, Request, Response } from 'express';
import express from 'express';
import { requireBasicAuth, requireOnecSession } from '../middleware/onec-auth';
import {
  checkauthHandler,
  initHandler,
  fileHandler,
  importHandler,
  queryHandler,
  successHandler,
} from '../controllers/onec-exchange.controller';

const router = Router();

// Парсер raw-body для режима file (1С шлёт бинарный чанк, не JSON)
const rawParser = express.raw({
  type: () => true,
  limit: '10mb',
});

// CommerceML endpoint: один URL, 5 режимов + 1 доп. для sale.
// 1С обращается: GET/POST /api/1c/exchange?type=<catalog|sale>&mode=<...>
//
// checkauth: Basic Auth -> cookie
// init, file, import, query, success: cookie (после checkauth)
router.all('/exchange', async (req: Request, res: Response) => {
  const mode = String(req.query.mode || '').trim();

  switch (mode) {
    case 'checkauth':
      // Basic Auth - первая фаза
      return requireBasicAuth(req, res, () => checkauthHandler(req, res));

    case 'init':
      return requireOnecSession(req, res, () => initHandler(req, res));

    case 'file':
      // В этом режиме тело - raw байты. POST.
      if (req.method !== 'POST') {
        res.status(405).type('text/plain').send('failure\nPOST required');
        return;
      }
      return requireOnecSession(req, res, () => {
        rawParser(req, res, (err?: unknown) => {
          if (err) {
            res.status(400).type('text/plain').send('failure\nInvalid body');
            return;
          }
          fileHandler(req, res);
        });
      });

    case 'import':
      return requireOnecSession(req, res, () => importHandler(req, res));

    case 'query':
      return requireOnecSession(req, res, () => queryHandler(req, res));

    case 'success':
      return requireOnecSession(req, res, () => successHandler(req, res));

    default:
      res.status(400).type('text/plain; charset=utf-8').send(`failure\nUnknown mode: ${mode}`);
      return;
  }
});

export default router;
