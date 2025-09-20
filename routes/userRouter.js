const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const profileController = require("../controllers/user/profileController");
const productController = require("../controllers/user/productController");
const passport = require("../config/passport");
const { userAuth } = require('../middlewares/auth');
const { isUserLoggedIn } = require('../middlewares/sessionHandling');
const { uploadProductImages, uploadProfileImage } = require('../helpers/multer');
const cartController = require('../controllers/user/cartController')
const wishlistController = require("../controllers/user/wishlistController");
const checkoutController = require("../controllers/user/checkoutController");
const addressController = require("../controllers/user/addressController");

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
router.get("/userProfile",isUserLoggedIn,profileController.getUserProfile);
router.post("/update-profile",isUserLoggedIn,uploadProfileImage.single('profileImage'),profileController.updateUserProfile);
router.post("/change-password",isUserLoggedIn,profileController.changePassword);

// Address Management

router.post('/addresses',isUserLoggedIn,addressController.addAddress);
router.patch('/addresses/:addressId/soft-delete', isUserLoggedIn,addressController.deleteAddress);
router.patch('/addresses/:addressId', isUserLoggedIn,addressController.updateAddress);


// product management

router.get("/products", productController.getUserProductList);
router.get("/productdetails/:id",productController.getProductDetailPage);

// Wishlist Mangement

router.get("/wishlist", isUserLoggedIn, wishlistController.getWishlist);
router.post("/wishlist/add", isUserLoggedIn, wishlistController.addToWishlist);
router.post("/wishlist/remove", isUserLoggedIn, wishlistController.removeFromWishlist);

// Cart Management
router.get('/cart',userAuth,cartController.cart);
router.post('/addToCart',userAuth ,cartController.addToCart);
router.post('/cart/update',userAuth,cartController.updateCartItem);
router.get('/cart/remove/:productId',userAuth,cartController.removeFromCart);

// checkout Management

router.get("/checkout",userAuth,checkoutController.getcheckoutPage);

// Error Management
router.get("/pageNotFound",userController.pageNotFound);


module.exports = router;