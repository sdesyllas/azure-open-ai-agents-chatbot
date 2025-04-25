import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AIController } from './server/ai-controller';
import multer from 'multer';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON request bodies
app.use(express.json());

// Initialize the AI controller
const aiController = new AIController();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // Limit to 100MB file size
});

/**
 * API endpoints for AI operations
 */
// Fetch agents endpoint
app.get('/api/agents', (req, res) => {
  aiController.getAgents(req, res);
});

// Chat endpoint
app.post('/api/chat', (req, res) => {
  aiController.handleChat(req, res);
});

// Chat with file upload endpoint
app.post('/api/chat-with-file', upload.single('file'), (req, res) => {
  aiController.handleChatWithFile(req, res);
});

// Chat with multiple file uploads endpoint
app.post('/api/chat-with-files', upload.array('files', 5), (req, res) => {
  aiController.handleChatWithFiles(req, res);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
