# Lint and Fix Code Quality

Please run a comprehensive code quality check and automatically fix all issues:

1. **Run ESLint check**: Execute `npm run lint` to identify all linting issues
2. **Auto-fix ESLint issues**: Run `npm run lint:fix` to automatically resolve fixable issues
3. **Format with Prettier**: Run `npm run format` to ensure consistent code formatting
4. **Type check**: Run `npm run build` to verify TypeScript compilation
5. **Report results**: Summarize what was fixed and any remaining issues that need manual attention

**Security focus**: Pay special attention to:
- No `console.log` statements left in production code (should be `console.error` or proper logging)
- No hardcoded secrets or API keys
- No `eval()` or dangerous dynamic code execution
- Proper input validation in API routes
- No unused variables that could indicate incomplete code

If any issues require manual intervention, provide specific guidance on how to fix them.