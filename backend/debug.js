const express = require('express');
const router = express.Router();
const verifyToken = require('./middleware/verifyToken');
const supabase = require('./config/supabase');
const supabaseAdmin = require('./config/supabaseAdmin');
const logger = require('./utils/logger');

// Block all debug routes in production
router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Route not found' });
  }
  next();
});

/**
 * GET /api/debug/health
 * Check system health (no auth required)
 */
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('User')
      .select('count')
      .limit(1);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: error ? 'error' : 'connected',
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 8000
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * GET /api/debug/me
 * Debug endpoint to check authentication and user data
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user from database
    const { data: userData, error: dbError } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    // Get auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    res.json({
      tokenValid: true,
      userId: userId,
      userEmail: req.user.email,
      databaseUser: {
        exists: !!userData,
        error: dbError?.message || null,
        data: userData || null
      },
      authUser: {
        exists: !!authData?.user,
        error: authError?.message || null,
        emailConfirmed: authData?.user?.email_confirmed_at !== null
      }
    });

  } catch (err) {
    logger.error('Debug me error', { error: err.message });
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

/**
 * POST /api/debug/test-gig
 * Test gig creation with minimal data
 */
router.post('/test-gig', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const testGig = {
      title: 'Test Gig ' + Date.now(),
      description: 'This is a test gig created by the debug endpoint',
      price: 50,
      user_id: userId,
      status: 'open'
    };

    logger.info('Creating test gig', { userId, testGig });

    const { data, error } = await supabaseAdmin
      .from('Gig')
      .insert(testGig)
      .select()
      .single();

    if (error) {
      logger.error('Test gig creation failed', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      return res.status(500).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    }

    res.json({
      success: true,
      message: 'Test gig created successfully',
      gigId: data.id,
      gig: data
    });

  } catch (err) {
    logger.error('Test gig exception', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

/**
 * GET /api/debug/check-rls
 * Check RLS policies for current user
 */
router.get('/check-rls', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Test read access to own user record
    const { data: userRead, error: userError } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    // Test read access to gigs
    const { data: gigsRead, error: gigsError } = await supabase
      .from('Gig')
      .select('count')
      .limit(1);

    // Test write access to gigs
    const testGig = {
      title: 'RLS Test Gig',
      description: 'Testing RLS policies',
      price: 1,
      user_id: userId,
      status: 'open'
    };

    const { data: gigCreate, error: gigCreateError } = await supabase
      .from('Gig')
      .insert(testGig)
      .select()
      .single();

    // Clean up test gig if created
    if (gigCreate) {
      await supabase.from('Gig').delete().eq('id', gigCreate.id);
    }

    res.json({
      userId,
      rls: {
        userRead: {
          canRead: !userError,
          error: userError?.message || null
        },
        gigsRead: {
          canRead: !gigsError,
          error: gigsError?.message || null
        },
        gigsCreate: {
          canCreate: !gigCreateError,
          error: gigCreateError?.message || null
        }
      }
    });

  } catch (err) {
    logger.error('RLS check error', { error: err.message });
    res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;