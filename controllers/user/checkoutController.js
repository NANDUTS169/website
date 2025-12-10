
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');

const getcheckoutPage = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');
    const userId = req.session.user;

    const addressesDoc = await Address.findOne({ UserId: userId }).lean();
    const addresses = (addressesDoc && addressesDoc.address) ? addressesDoc.address.filter(a => a.isActive !== false) : [];

    const userCart = await Cart.findOne({ userId: userId }).populate('items.productId').lean();

    if (!userCart || !userCart.items || userCart.items.length === 0) {
      return res.render('checkout', {
        addresses,
        cartItems: [],
        subTotal: 0,
        discount: 0,
        taxes: 0,
        shipping: 0,
        total: 0
      });
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

    const discount = 0; 
    const taxes = Math.round(subTotal * 0.12); //  12% taxes
    const shipping = subTotal > 500 ? 0 : 50;
    const total = subTotal - discount + taxes + shipping;

    return res.render('checkout', {
      addresses,
      cartItems,
      subTotal,
      discount,
      taxes,
      shipping,
      total
    });
  } catch (err) {
    console.error('getcheckoutPage error:', err);
    return res.redirect('/pageNotFound');
  }
};

module.exports = { 
    getcheckoutPage 
};
