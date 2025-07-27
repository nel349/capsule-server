import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
import usersRouter from './routes/users';
import capsulesRouter from './routes/capsules';
import gamesRouter from './routes/games';
import socialRouter from './routes/social';
import transactionsRouter from './routes/transactions';
import schedulerRouter from './routes/scheduler';

// Import utilities
import { testDatabaseConnection } from './utils/supabase';
import { RevealSchedulerService } from './services/revealSchedulerService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://capsulex.com', 'https://app.capsulex.com'] // Update with your domains
        : '*', // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testDatabaseConnection();

    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbConnected ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
    });
  }
});

// API Routes
app.use('/api/users', usersRouter);
app.use('/api/capsules', capsulesRouter);
app.use('/api/games', gamesRouter);
app.use('/api/social', socialRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/scheduler', schedulerRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection on startup
    const dbConnected = await testDatabaseConnection();

    if (!dbConnected) {
      console.error('❌ Database connection failed. Please check your Supabase configuration.');
      process.exit(1);
    }

    console.log('✅ Database connection successful');

    // Start the reveal scheduler service
    try {
      RevealSchedulerService.start();
      console.log('✅ Reveal scheduler service started');
    } catch (error) {
      console.error('❌ Failed to start reveal scheduler:', error);
    }

    app.listen(PORT, () => {
      console.log(`🚀 CapsuleX Backend API running on port ${PORT}`);
      console.log(`📖 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 Solana cluster: ${process.env.SOLANA_CLUSTER || 'development'}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏰ Reveal scheduler: ${RevealSchedulerService.getStatus().isRunning ? 'RUNNING' : 'STOPPED'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  RevealSchedulerService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  RevealSchedulerService.stop();
  process.exit(0);
});

// Start the server only if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
