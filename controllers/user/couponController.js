const Coupon = require('../../models/couponSchema');
const Cart = require('../../models/cartSchema');

const applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.user;

        const coupon = await Coupon.findOne({ name: code });
        if (!coupon) {
            return res.json({ success: false, message: 'Invalid coupon code' });
        }

        if (coupon.expireOn < new Date()) {
            return res.json({ success: false, message: 'Coupon has expired' });
        }

        if (coupon.userId.includes(userId)) {
            return res.json({ success: false, message: 'You have already used this coupon' });
        }

        // Calculate subtotal to check minimum purchase
        const userCart = await Cart.findOne({ userId: userId }).populate('items.productId');
        if (!userCart) return res.json({ success: false, message: 'Cart not found' });

        let subTotal = 0;
        userCart.items.forEach(item => {
            const prod = item.productId;
            const unitPrice = Number(item.price ?? prod.salePrice ?? prod.price ?? 0);
            subTotal += (unitPrice * item.quantity);
        });

        if (subTotal < coupon.minimumPrice) {
            return res.json({ success: false, message: `Minimum purchase of ₹${coupon.minimumPrice} required` });
        }

        // Apply coupon
        const discountAmount = (subTotal * coupon.offerPrice) / 100;

        req.session.coupon = {
            code: coupon.name,
            discount: discountAmount
        };

        const discount = discountAmount;
        const taxes = Math.round(subTotal * 0.12);
        const shipping = subTotal > 500 ? 0 : 50;
        const total = Math.max(0, subTotal - discount + taxes + shipping);

        return res.json({
            success: true,
            message: 'Coupon applied successfully',
            discount,
            total,
            subTotal,
            taxes,
            shipping
        });

    } catch (err) {
        console.error('applyCoupon error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const removeCoupon = async (req, res) => {
    try {
        req.session.coupon = null;

        // Recalculate totals without discount
        const userId = req.session.user;
        const userCart = await Cart.findOne({ userId: userId }).populate('items.productId');

        let subTotal = 0;
        if (userCart) {
            userCart.items.forEach(item => {
                const prod = item.productId;
                const unitPrice = Number(item.price ?? prod.salePrice ?? prod.price ?? 0);
                subTotal += (unitPrice * item.quantity);
            });
        }

        const taxes = Math.round(subTotal * 0.12);
        const shipping = subTotal > 500 ? 0 : 50;
        const total = subTotal + taxes + shipping;

        return res.json({
            success: true,
            message: 'Coupon removed',
            subTotal,
            discount: 0,
            taxes,
            shipping,
            total
        });
    } catch (err) {
        console.error('removeCoupon error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    applyCoupon,
    removeCoupon
};
