
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Coupon = require('../../models/couponSchema');

const getcheckoutPage = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');
    const userId = req.session.user;

    const addressesDoc = await Address.findOne({ UserId: userId }).lean();
    const addresses = (addressesDoc && addressesDoc.address) ? addressesDoc.address.filter(a => a.isActive !== false) : [];

    const userCart = await Cart.findOne({ userId: userId }).populate('items.productId').lean();

    if (!userCart || !userCart.items || userCart.items.length === 0) {
      return res.redirect('/cart'); // Redirect empty cart to cart page
    }

    // Check for blocked/unavailable products
    for (const item of userCart.items) {
      if (!item.productId || item.productId.isBlocked) {
        return res.redirect('/cart?error=Some items in your cart are currently unavailable.');
      }
    }

    let subTotal = 0;
    const cartItems = userCart.items.map(ci => {
      const prod = ci.productId || {};
      const unitPrice = Number(ci.price ?? prod.salePrice ?? prod.price ?? 0);
      const qty = Number(ci.quantity ?? 1);
      const itemTotal = Number(ci.totalPrice ?? Math.round(unitPrice * qty));
      subTotal += itemTotal;
      return {
        product: prod,
        quantity: qty,
        unitPrice,
        itemTotal
      };
    });

    // Coupon logic
    let discount = 0;
    let appliedCoupon = null;

    if (req.session.coupon) {
      const coupon = await Coupon.findOne({ name: req.session.coupon.code });
      if (coupon && coupon.expireOn > new Date() && subTotal >= coupon.minimumPrice && !coupon.userId.includes(userId)) {
        discount = (subTotal * Number(coupon.offerPrice)) / 100;
        appliedCoupon = req.session.coupon.code;
      } else {
        // Coupon invalid or expired, clear session
        req.session.coupon = null;
      }
    }


    // Fetch available coupons
    const availableCoupons = await Coupon.find({
      isList: true,
      expireOn: { $gt: new Date() },
      userId: { $ne: userId } // User hasn't used it
    }).lean();

    const taxes = Math.round(subTotal * 0.12); //  12% taxes
    const shipping = subTotal > 500 ? 0 : 50;
    const total = Math.max(0, subTotal - discount + taxes + shipping);

    return res.render('checkout', {
      addresses,
      cartItems,
      subTotal,
      discount,
      taxes,
      shipping,
      total,
      appliedCoupon,
      availableCoupons
    });
  } catch (err) {
    console.error('getcheckoutPage error:', err);
    return res.redirect('/pageNotFound');
  }
};


module.exports = {
  getcheckoutPage
};

