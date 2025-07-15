# Supabase Setup Guide - CapsuleX

## 🚀 **Step 1: Create Supabase Project**

### **Go to Supabase Dashboard**
1. Visit [supabase.com](https://supabase.com)
2. Sign in with GitHub/Google
3. Click "New Project"

### **Project Configuration**
```
Project Name: capsulex-backend
Organization: (your organization)
Database Password: (generate strong password - save it!)
Region: (choose closest to your users)
Pricing Plan: Free (for development)
```

### **Save Project Details**
After creation, save these values:
```
Project URL: https://xxx.supabase.co
API Key (anon): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
API Key (service_role): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Database Password: (the one you generated)
```

## 🗄️ **Step 2: Set Up Database Schema**

### **Run SQL Setup Script**
1. Go to **SQL Editor** in Supabase dashboard
2. Create "New Query"
3. Copy and paste contents of `/scripts/setup-database.sql`
4. Click **Run** to execute

### **Verify Tables Created**
Go to **Table Editor** and confirm these tables exist:
- ✅ `users` (5 columns)
- ✅ `social_connections` (8 columns)  
- ✅ `capsules` (15 columns)
- ✅ `reveal_queue` (9 columns)
- ✅ `sol_transactions` (11 columns)

## 🔐 **Step 3: Configure Row Level Security**

### **Verify RLS Policies**
Go to **Authentication > Policies** and confirm:
- ✅ Users table: 2 policies (view own, update own)
- ✅ Social connections: 1 policy (manage own)
- ✅ Capsules: 4 policies (view own, view public, create own, update own)
- ✅ SOL transactions: 1 policy (view own)

### **Test Database Access**
In SQL Editor, run:
```sql
-- Test basic functionality
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM capsules;
SELECT 'Database setup successful!' as status;
```

## 🔑 **Step 4: Set Up Service Role Access**

### **API Keys Configuration**
You'll need both keys:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # For frontend
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # For backend
```

### **Service Role Usage**
- **Backend API**: Uses `service_role` key (bypasses RLS)
- **Mobile App**: Uses `anon` key (enforces RLS)

## 🧪 **Step 5: Test Database Connection**

### **Create Test Script**
Create `/scripts/test-database.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xxx.supabase.co';
const supabaseKey = 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  // Test table access
  const { data, error } = await supabase
    .from('users')
    .select('count(*)')
    .limit(1);
  
  if (error) {
    console.error('❌ Connection failed:', error);
  } else {
    console.log('✅ Connection successful!', data);
  }
}

testConnection();
```

## 📊 **Step 6: Set Up Database Functions (Optional)**

### **Utility Functions**
Add these to SQL Editor for enhanced functionality:

```sql
-- Function to get user's SOL balance from transactions
CREATE OR REPLACE FUNCTION get_user_sol_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(
      CASE 
        WHEN transaction_type = 'onramp' THEN sol_amount
        WHEN transaction_type = 'capsule_fee' THEN -sol_amount
        WHEN transaction_type = 'refund' THEN sol_amount
        ELSE 0
      END
    )
    FROM sol_transactions 
    WHERE user_id = p_user_id AND status = 'completed'),
    0
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has required social connections
CREATE OR REPLACE FUNCTION user_has_required_social(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user has active Twitter connection
  RETURN EXISTS (
    SELECT 1 FROM social_connections 
    WHERE user_id = p_user_id 
    AND platform = 'twitter' 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get pending reveals for scheduler
CREATE OR REPLACE FUNCTION get_pending_reveals()
RETURNS TABLE (
  queue_id UUID,
  capsule_id UUID,
  user_id UUID,
  wallet_address TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rq.queue_id,
    rq.capsule_id,
    c.user_id,
    u.wallet_address,
    rq.scheduled_for
  FROM reveal_queue rq
  JOIN capsules c ON rq.capsule_id = c.capsule_id
  JOIN users u ON c.user_id = u.user_id
  WHERE rq.status = 'pending'
  AND rq.scheduled_for <= NOW()
  ORDER BY rq.scheduled_for ASC;
END;
$$ LANGUAGE plpgsql;
```

## 🔄 **Step 7: Set Up Real-time Subscriptions (Optional)**

### **Enable Realtime for Tables**
In Supabase dashboard:
1. Go to **Database > Replication**
2. Enable realtime for:
   - ✅ `capsules` (for reveal notifications)
   - ✅ `sol_transactions` (for payment status)

### **Test Realtime Connection**
```typescript
// Listen for capsule reveals
supabase
  .channel('capsule-reveals')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'capsules' },
    (payload) => console.log('Capsule updated:', payload)
  )
  .subscribe();
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. RLS Policy Errors**
```
Error: new row violates row-level security policy
```
**Solution**: Check if using `service_role` key for backend operations

#### **2. UUID Generation Errors**
```
Error: function uuid_generate_v4() does not exist
```
**Solution**: Ensure UUID extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### **3. Connection Timeouts**
**Solution**: Check project URL and API keys are correct

### **Verify Setup Checklist**
- [ ] Supabase project created
- [ ] Database schema deployed (`setup-database.sql`)
- [ ] All 5 tables exist with correct columns
- [ ] RLS policies active and correct
- [ ] API keys saved securely
- [ ] Test connection successful
- [ ] Utility functions created (optional)
- [ ] Realtime enabled (optional)

## 🎯 **Next Steps**

Once Supabase is set up:
1. ✅ **Database ready** - All tables and policies in place
2. 🚀 **Move to backend setup** - Initialize Node.js project
3. 🔌 **Test integration** - Connect backend to Supabase
4. 📱 **Mobile integration** - Connect Expo app to Supabase

## 📝 **Environment Variables to Add**

Save these for the backend setup:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Database setup complete! Ready for backend development.** 🚀