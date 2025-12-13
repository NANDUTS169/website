# Project Fixes Summary

## Date: 2025-12-13

### Issues Fixed

#### 1. OTP Resend Button - Timer Control ✅
**Problem:** The "Resend OTP" button was always active, allowing users to spam OTP requests immediately.

**Solution:**
- Added `disabled` attribute to resend buttons in both OTP pages
- Modified timer logic to enable the button only when timer expires (after 60 seconds)
- Button is disabled again when OTP is resent, restarting the timer

**Files Modified:**
- `/views/user/verifyotp.ejs` - Added ID and disabled state to resend button, updated timer logic
- `/views/user/forgotPass-otp.ejs` - Added ID and disabled state to resend button, updated timer logic

**Frontend Changes:**
```javascript
// Button is now disabled by default
<button type="button" id="resendBtn" ... disabled>Resend OTP</button>

// Timer enables button only when expired
function startTimer() {
    const resendBtn = document.getElementById("resendBtn");
    resendBtn.disabled = true; // Disable when timer starts
    
    // ... timer logic ...
    
    if (timer <= 0) {
        resendBtn.disabled = false; // Enable when timer expires
    }
}
```

#### 2. Backend Rate Limiting for OTP ✅
**Problem:** No server-side protection against OTP spam.

**Solution:**
- Added session-based rate limiting with 60-second cooldown
- Tracks `lastOtpTime` in session
- Returns error if user tries to resend before cooldown expires

**Files Modified:**
- `/controllers/user/userController.js` - Added rate limiting to `resendotp` function
- `/controllers/user/profileController.js` - Added rate limiting to `resendOtp` function

**Backend Changes:**
```javascript
// Rate limiting logic
const now = Date.now();
const lastOtpTime = req.session.lastOtpTime || 0;
const timeDiff = (now - lastOtpTime) / 1000;

if (timeDiff < 60) {
    const remainingTime = Math.ceil(60 - timeDiff);
    return res.status(429).json({
        success: false, 
        message: `Please wait ${remainingTime} seconds before requesting a new OTP`
    });
}

req.session.lastOtpTime = now; // Update timestamp
```

#### 3. Session Handling Consistency ✅
**Problem:** Session data was inconsistent across the application:
- Login stored full user object in `req.session.user`
- Auth middleware expected `req.session.user` to be just an ID
- This mismatch caused authentication failures

**Solution:**
- Standardized session to store only user ID in `req.session.user`
- Updated app.js middleware to fetch full user data from DB and store in `res.locals.user`
- This ensures consistency across all routes and middleware

**Files Modified:**
- `/controllers/user/userController.js`:
  - `login` function - Now stores only user ID
  - `verifyOtp` function - Now stores only user ID
  - `loadHomepage` function - Uses `res.locals.user` instead of `req.session.user`
- `/app.js` - Updated middleware to fetch user data from database
- `/middlewares/auth.js` - Already expected user ID (no changes needed)

**Session Pattern:**
```javascript
// OLD (Inconsistent)
req.session.user = {
    _id: findUser._id,
    name: findUser.name,
    email: findUser.email,
    isLoggedIn: true
};

// NEW (Consistent)
req.session.user = findUser._id; // Store only ID in session

// Middleware fetches full user data for views
app.use(async (req,res,next) => {
    if(req.session.user) {
        const userData = await User.findById(req.session.user);
        res.locals.user = userData; // Full user data for templates
    }
    next();
});
```

#### 4. Bug Fix ✅
**Problem:** In `userController.js` resendotp function, used undefined variable `response` instead of `res`.

**Solution:** Fixed to use correct `res` variable.

### Benefits of These Fixes

1. **Security**: Rate limiting prevents OTP spam and potential abuse
2. **User Experience**: Clear timer indication prevents user confusion
3. **Consistency**: Uniform session handling prevents authentication bugs
4. **Reliability**: Proper error handling and validation

### Testing Recommendations

1. **OTP Resend Timer**:
   - Verify button is disabled on page load
   - Confirm button enables after 60 seconds
   - Test that button disables again after clicking resend

2. **Rate Limiting**:
   - Try to resend OTP before 60 seconds (should show error message)
   - Verify OTP can be resent after cooldown period

3. **Session Handling**:
   - Test login flow
   - Test signup with OTP verification
   - Test forgot password flow
   - Verify user data displays correctly across all pages
   - Check cart and wishlist functionality with user session

4. **Edge Cases**:
   - Test OTP expiration
   - Test invalid OTP entry
   - Test session timeout
   - Test blocked user scenarios

### Notes

- All changes maintain backward compatibility
- No database schema changes required
- Session-based rate limiting (client-specific, resets on logout)
- For production, consider Redis-based rate limiting for scalability
