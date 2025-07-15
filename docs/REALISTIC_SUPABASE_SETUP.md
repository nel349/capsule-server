# Realistic Supabase Setup - CapsuleX

## 📋 **Based on Cultivest's Proven Approach**

### **Simple Setup Steps:**

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create project: "capsulex-backend"
   - Save URL and service role key

2. **Copy SQL Schema**
   - Take our `/scripts/setup-database.sql`
   - Paste in Supabase SQL Editor
   - Run it

3. **Set Environment Variables**
   ```env
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
   ```

4. **Use Simple Backend Pattern**
   ```typescript
   // utils/supabase.ts (same as Cultivest)
   import { createClient } from '@supabase/supabase-js';
   
   export const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!,
     {
       auth: { autoRefreshToken: false, persistSession: false }
     }
   );
   ```

## 🎯 **Key Differences from Complex Setup**

### **What Cultivest Actually Does:**
- ✅ **Service role only** - Backend uses service_role key (bypasses RLS)
- ✅ **Simple queries** - Direct SQL queries, no complex policies
- ✅ **Basic types** - Simple TypeScript interfaces
- ✅ **Pragmatic security** - Application-level authorization, not database-level
- ✅ **Fast iteration** - No complex RLS policies to debug

### **What My Original Guide Had (Overly Complex):**
- ❌ Complex RLS policies
- ❌ Multiple authentication modes
- ❌ Utility functions in database
- ❌ Realtime subscriptions
- ❌ Over-engineered security

## 📊 **Simplified CapsuleX Schema**

Based on Cultivest pattern, here's what we actually need:

```sql
-- Simple schema based on Cultivest approach
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  auth_type TEXT NOT NULL, -- 'privy' or 'wallet'
  privy_user_id TEXT UNIQUE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE social_connections (
  connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  platform TEXT NOT NULL, -- 'twitter', 'farcaster'
  platform_username TEXT,
  access_token TEXT, -- encrypted at app level
  refresh_token TEXT, -- encrypted at app level
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE capsules (
  capsule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  content_encrypted TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  reveal_date TIMESTAMP WITH TIME ZONE NOT NULL,
  revealed_at TIMESTAMP WITH TIME ZONE NULL,
  posted_to_x BOOLEAN DEFAULT FALSE,
  x_post_id TEXT NULL,
  on_chain_tx TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Keep it simple - no complex RLS, no utility functions
-- Application handles authorization, not database
```

## 🚀 **Implementation Pattern**

### **Backend Utils (Copy from Cultivest)**
```typescript
// utils/supabase.ts
export const supabase = createClient(url, serviceKey, config);

// utils/database.ts  
export const createUser = async (userData) => {
  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single();
  return { data, error };
};

export const getCapsules = async (userId) => {
  const { data, error } = await supabase
    .from('capsules')
    .select('*')
    .eq('user_id', userId);
  return { data, error };
};
```

### **API Routes (Copy Cultivest Pattern)**
```typescript
// app/api/capsules/create.ts
import { supabase } from '../../../utils/supabase';

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('capsules')
      .insert(req.body)
      .select()
      .single();
      
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

## ✅ **What You Need to Do**

Since you said you completed the setup:

1. **Verify your Supabase has our tables**:
   - users
   - social_connections  
   - capsules
   - reveal_queue
   - sol_transactions

2. **Get your environment variables**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
   ```

3. **Ready for backend setup** - We'll use the Cultivest pattern!

**Is your database ready with the tables?** Let's move to setting up the Node.js backend structure! 🚀