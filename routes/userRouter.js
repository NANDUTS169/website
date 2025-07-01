const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const profileController = require("../controllers/user/profileController");
const productController = require("../controllers/user/productController");
const passport = require("../config/passport");
const { userAuth } = require('../middlewares/auth');
const isUserLoggedIn = require('../middlewares/sessionHandling');

router.get("/",userController.loadHomepage);

// Login Management
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);

router.get("/productdetail",userController.productdetail);

// Sign up Mangement
router.get("/signup",userController.loadsignup);
router.post("/signup",userController.signup);
router.post("/verifyotp",userController.verifyOtp);
router.post("/resendotp",userController.resendotp);
router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}));
router.get("/auth/google/callback",passport.authenticate('google',{failureRedirect:'/signup'}),(req,res) => {
    if(req.user.isBlocked){
        return res.render("login",{message:"User is blocked by the admin"})
    }
    req.session.user = req.user._id;
    res.redirect("/")
});
router.get("/logout",userController.logout);

// Profile Mangement
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);
// router.get("/userProfile",userAuth,profileController.userProfile);

// product management

router.get("/products", productController.getUserProductList);
router.get("/productdetails/:id",productController.getProductDetailPage);
// router.get("/wishlist",isUserLoggedIn,userController.wishlist);


// Error Management
router.get("/pageNotFound",userController.pageNotFound);


module.exports = router;

