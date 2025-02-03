const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const passport = require("../config/passport");

// const passport = require('passport');

router.get("/",userController.loadHomepage);
router.get("/signup",userController.loadsignup);
router.post("/signup",userController.signup);

router.get("/login",userController.loadLogin);
router.post("/login",userController.login)

router.get("/productdetail",userController.productdetail);
router.post("/verifyotp",userController.verifyOtp);
router.post("/resendotp",userController.resendotp);

router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}));
router.get("/auth/google/callback",passport.authenticate('google',{failureRedirect:'/signup'}),(req,res) => {
    res.redirect("/")
});

router.get("/logout",userController.logout);


router.get("/pageNotFound",userController.pageNotFound);


module.exports = router;

