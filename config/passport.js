const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      scope: ["profile", "email"], // Ensure email is included in the scope
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log("Google profile:", profile); // Debugging: Log the entire profile
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user); // User already exists, return the user
        } else {
          // Create a new user
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value, // Access the first email in the array
            googleId: profile.id,
          });

          await user.save(); // Save the new user to the database
          return done(null, user); // Return the newly created user
        }
      } catch (error) {
        console.log("passport error", error);
        return done(error, null);
      }
    }
  )
);

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id); // Serialize user by their ID
});

// Deserialize user
passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user); // Deserialize user by their ID
    })
    .catch((err) => {
      done(err, null);
    });
});

module.exports = passport;