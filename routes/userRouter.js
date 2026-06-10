const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const profileController = require("../controllers/user/profileController");
const productController = require("../controllers/user/productController");
const passport = require("../config/passport");
const { userAuth } = require('../middlewares/auth');
const { uploadProductImages, uploadProfileImage } = require('../helpers/multer');
const cartController = require('../controllers/user/cartController')
const wishlistController = require("../controllers/user/wishlistController");
const checkoutController = require("../controllers/user/checkoutController");
const orderController = require("../controllers/user/orderController");
const addressController = require("../controllers/user/addressController");
const couponController = require("../controllers/user/couponController");

router.get("/", userController.loadHomepage);

// Login Management
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);

// Sign up Mangement
router.get("/signup", userController.loadsignup);
router.post("/signup", userController.signup);
router.post("/verifyotp", userController.verifyOtp);
router.post("/resendotp", userController.resendotp);
router.get("/auth/google", passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get("/auth/google/callback", passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    if (req.user.isBlocked) {
        return res.render("login", { message: "User is blocked by the admin" })
    }
    req.session.user = req.user._id;
    res.redirect("/")
});
router.get("/logout", userController.logout);

// Profile Mangement
router.get("/forgot-password", profileController.getForgotPassPage);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPassPage);
router.post("/resend-forgot-otp", profileController.resendOtp);
router.post("/reset-password", profileController.postNewPassword);
router.get("/userProfile", userAuth, profileController.getUserProfile);
router.post("/update-profile", userAuth, uploadProfileImage.single('profileImage'), profileController.updateUserProfile);
router.post("/change-password", userAuth, profileController.changePassword);

// Address Management

router.post('/addresses', userAuth, addressController.addAddress);
router.patch('/addresses/:addressId/soft-delete', userAuth, addressController.deleteAddress);
router.patch('/addresses/:addressId', userAuth, addressController.updateAddress);


// product management

router.get("/products", productController.getUserProductList);
router.get("/productdetails/:id", productController.getProductDetailPage);

// Wishlist Mangement

router.get("/wishlist", userAuth, wishlistController.getWishlist);
router.post("/wishlist/add", userAuth, wishlistController.addToWishlist);
router.post("/wishlist/remove", userAuth, wishlistController.removeFromWishlist);

// Cart Management
router.get('/cart', userAuth, cartController.cart);
router.post('/addToCart', userAuth, cartController.addToCart);
router.post('/cart/update', userAuth, cartController.updateCartItem);
router.delete('/cart/remove/:itemId', userAuth, cartController.removeFromCart);

// Coupon Management
router.post("/apply-coupon", userAuth, couponController.applyCoupon);
router.post("/remove-coupon", userAuth, couponController.removeCoupon);

// Checkout & Order Management
router.get("/checkout", userAuth, checkoutController.getcheckoutPage);
router.post('/place-order', userAuth, orderController.placeOrder);
router.post('/create-razorpay-order', userAuth, orderController.createRazorpayOrder);
router.post('/verify-razorpay-payment', userAuth, orderController.verifyRazorpayPayment);
router.get('/orderSuccess/:orderId', userAuth, orderController.getOrderSuccess);
router.get('/orders', userAuth, orderController.listOrders);
router.get('/order/:orderId', userAuth, orderController.getOrderDetails);
router.post('/order/:orderId/cancel', userAuth, orderController.cancelOrder);
router.get('/order/:orderId/invoice', userAuth, orderController.getInvoice);
router.get('/orderFailure/:orderId', userAuth, orderController.getOrderFailure);
router.post('/retry-razorpay-payment', userAuth, orderController.retryRazorpayPayment);
router.get('/orders/statuses', userAuth, orderController.getOrderStatuses);
router.post('/order/:orderId/item/:itemId/cancel', userAuth, orderController.cancelOrderItem);
router.post('/order/:orderId/return', userAuth, orderController.returnOrder);
router.post('/order/:orderId/cancel-entire', userAuth, orderController.cancelEntireOrder);


// Error Management
router.get("/pageNotFound", userController.pageNotFound);


module.exports = router;