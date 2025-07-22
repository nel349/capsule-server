# Build and Test Pipeline

Please run the complete build and test pipeline for the CapsuleX backend:

1. **Clean build**: Remove any existing `dist/` folder and run a fresh build

   ```bash
   rm -rf dist && npm run build
   ```

2. **Type checking**: Verify TypeScript compilation succeeds without errors

3. **Linting**: Run `npm run lint` and report any issues

4. **Format check**: Verify code formatting with Prettier

5. **Test database connection**:
   - Start the server briefly to test database connectivity
   - Check the `/health` endpoint works properly
   - Verify Supabase connection is successful

6. **Security scan**:
   - Check for hardcoded secrets or credentials
   - Verify environment variables are properly configured
   - Ensure no sensitive data in logs

7. **Build verification**:
   - Confirm the `dist/` folder is created with expected files
   - Verify the built app can start without errors

**Report**: Provide a summary of all checks with ✅ for passed items and ❌ for any failures, along with specific instructions to fix any issues found.
