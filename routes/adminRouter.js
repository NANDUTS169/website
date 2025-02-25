const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require("../controllers/admin/categoryController");
const {userAuth,adminAuth} = require("../middlewares/auth");


// Admin login
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout)
// Customer Mangement
router.get("/users",adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);
router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory);

router.get("/dashboard", (req, res) => {
    res.redirect("/admin/");
});



router.get("/pageerror",adminController.pageerror);



module.exports = router;

