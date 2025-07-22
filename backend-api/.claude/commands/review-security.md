# Security Code Review

Please perform a comprehensive security review of the codebase with focus on:

## Authentication & Authorization

- Check JWT token handling in `src/middleware/auth.ts`
- Verify proper user authentication flows in `src/routes/users.ts`
- Ensure no sensitive data (tokens, passwords) is logged or returned in API responses

## Database Security

- Review all database queries for SQL injection vulnerabilities
- Check that all database operations use parameterized queries
- Verify proper input validation before database operations
- Ensure sensitive data (access_tokens, refresh_tokens) is properly handled

## API Security

- Check all route handlers for proper input validation
- Verify CORS configuration is appropriate for environment
- Ensure proper error handling that doesn't leak sensitive information
- Check for proper rate limiting considerations

## Environment & Secrets

- Verify no secrets are hardcoded in the codebase
- Check that all environment variables are properly documented
- Ensure `.env` is in `.gitignore`

## Dependencies

- Review `package.json` for any known vulnerable dependencies
- Check for unused dependencies that should be removed

Provide a summary of findings and specific recommendations for any security improvements needed.
