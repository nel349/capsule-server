# CapsuleX Backend API - Development Guide

## Project Overview
CapsuleX backend API built with Node.js, TypeScript, Express, and Supabase. Handles time capsule creation, user authentication, social media integration, and SOL transactions.

## Key Commands
- `npm run dev`: Start development server with hot reload
- `npm run build`: Build TypeScript to dist/ folder  
- `npm run start`: Start production server (requires build first)
- `npm run lint`: Check code with ESLint
- `npm run lint:fix`: Auto-fix ESLint issues
- `npm run format`: Format code with Prettier

## Important Files
- `src/app.ts`: Main Express application and server setup
- `src/utils/supabase.ts`: Supabase client and database types
- `src/utils/database.ts`: Database operation functions
- `src/middleware/auth.ts`: JWT authentication middleware
- `src/routes/`: API route handlers (users, capsules, social, transactions)
- `.env`: Environment variables (DO NOT commit this file)
- `scripts/setup-database.sql`: Database schema for Supabase

## Code Style & Standards
- **TypeScript**: Strict mode enabled, use proper typing
- **ESLint + Prettier**: Configured for security and consistency
- **No console.log**: Use proper error handling, console.error for errors only
- **Security first**: No hardcoded secrets, validate all inputs, use parameterized queries
- **Error handling**: Always return proper API responses with success/error structure

## API Response Format
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}
```

## Database Tables
- `users`: User accounts (wallet + Privy auth)
- `social_connections`: Twitter/social media connections
- `capsules`: Time capsules with encrypted content
- `reveal_queue`: Automated reveal processing
- `sol_transactions`: SOL payment tracking

## Environment Setup
1. Copy `.env.example` to `.env`
2. Set up Supabase project and get credentials
3. Run database schema from `../scripts/setup-database.sql`
4. Configure JWT_SECRET for authentication

## Security Requirements
- All routes except public ones require authentication
- Sensitive tokens (access_token, refresh_token) are never returned in API responses
- Input validation on all user inputs
- Rate limiting considerations for production
- Proper CORS configuration per environment

## Testing
- Health check endpoint: `GET /health`
- Database connectivity test included in health check
- Use custom slash commands for comprehensive testing:
  - `/project:build-and-test`: Full build and test pipeline
  - `/project:db-check`: Database health verification
  - `/project:lint-and-fix`: Code quality fixes
  - `/project:review-security`: Security code review

## Important Notes
- This is a defensive security-focused backend - no malicious code allowed
- Always run linting and type checking before commits
- Database uses Row Level Security (RLS) - backend uses service_role to bypass
- JWT tokens expire in 7 days
- Default SOL fee for capsules: 0.00005 SOL