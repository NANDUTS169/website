const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const razorpayInstance = require('../../helpers/razorpay');
const Coupon = require('../../models/couponSchema');
const crypto = require('crypto');


// TODO : Undrestand later
const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { addressId, paymentMethod = 'COD' } = req.body;
    if (!addressId) return res.status(400).json({ success: false, message: 'Address required' });

    const userCart = await Cart.findOne({ userId: userId }).populate('items.productId').exec();
    if (!userCart || !userCart.items || userCart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Double-check for blocked products at the moment of placing order
    for (const item of userCart.items) {
      if (!item.productId || item.productId.isBlocked) {
        return res.status(400).json({ success: false, message: 'Some items in your cart are no longer available. Please check your cart.' });
      }
    }

    const addressDoc = await Address.findOne({ UserId: userId }).lean();
    if (!addressDoc) return res.status(400).json({ success: false, message: 'No saved addresses' });
    const addr = addressDoc.address.find(a => String(a._id) === String(addressId));
    if (!addr) return res.status(400).json({ success: false, message: 'Address not found' });
    const decremented = [];
    for (const ci of userCart.items) {
      const prod = ci.productId;
      if (!prod) {
        for (const d of decremented) {
          await Product.findByIdAndUpdate(d.productId, { $inc: { quantity: d.qty } }).exec();
        }
        return res.status(400).json({ success: false, message: 'One of the products was removed from store' });
      }

      const qty = Number(ci.quantity || 1);
      if (qty <= 0) {
        for (const d of decremented) {
          await Product.findByIdAndUpdate(d.productId, { $inc: { quantity: d.qty } }).exec();
        }
        return res.status(400).json({ success: false, message: 'Invalid quantity in cart' });
      }

      const updated = await Product.findOneAndUpdate(
        { _id: prod._id, quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
        { new: true }
      ).exec();

      if (!updated) {
        for (const d of decremented) {
          await Product.findByIdAndUpdate(d.productId, { $inc: { quantity: d.qty } }).exec();
        }
        return res.status(400).json({ success: false, message: `Insufficient stock for ${prod.productName || prod.name}` });
      }

      decremented.push({ productId: prod._id, qty });
    }

    let totalPrice = 0;
    const orderedItems = userCart.items.map(ci => {
      const prod = ci.productId;
      const qty = Number(ci.quantity || 1);
      const unitPrice = Number(ci.price ?? prod.salePrice ?? prod.price ?? 0);
      const itemTotal = Number(ci.totalPrice ?? unitPrice * qty);
      totalPrice += itemTotal;
      return { product: prod._id, quantity: qty, price: unitPrice };
    });

    // Coupon Logic
    let discount = 0;
    let couponApplied = false;
    let appliedCouponCode = null;

    if (req.session.coupon) {
      const coupon = await Coupon.findOne({ name: req.session.coupon.code });
      if (coupon && coupon.expireOn > new Date() && totalPrice >= coupon.minimumPrice && !coupon.userId.includes(userId)) {
        discount = Number(coupon.offerPrice);
        couponApplied = true;
        appliedCouponCode = coupon.name;
      }
    }

    const taxes = Math.round(totalPrice * 0.12);
    const shipping = totalPrice > 500 ? 0 : 50;
    const finalAmount = Math.max(0, totalPrice - discount + taxes + shipping);

    const newOrder = new Order({
      userId,
      orderedItems,
      shippingAddress: {
        addressType: addr.addressType,
        name: addr.fullName,
        city: addr.city,
        landmark: addr.streetAddress,
        state: addr.state,
        pincode: addr.pincode,
        phone: addr.phone,
        altPhone: addr.altPhone || ''
      },
      totalPrice,
      discount,
      finalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Pending',
      status: 'Pending',
      couponApplied,
      couponCode: appliedCouponCode
    });

    let savedOrder;
    try {
      savedOrder = await newOrder.save();

      // Update coupon usage
      if (couponApplied && appliedCouponCode) {
        await Coupon.findOneAndUpdate({ name: appliedCouponCode }, { $addToSet: { userId: userId } });
        req.session.coupon = null; // Clear from session
      }

    } catch (err) {
      for (const d of decremented) {
        await Product.findByIdAndUpdate(d.productId, { $inc: { quantity: d.qty } }).exec();
      }
      console.error('placeOrder: failed to save order, rolled back stock', err);
      return res.status(500).json({ success: false, message: 'Failed to create order' });
    }

    userCart.items = [];
    await userCart.save();

    return res.json({ success: true, orderId: savedOrder.orderId, _id: savedOrder._id });
  } catch (err) {
    console.error('placeOrder error (non-transaction):', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOrderSuccess = async (req, res) => {
  try {
    console.log('getOrderSuccess called — params:', req.params);
    console.log('session user:', req.session?.user);

    const userId = req.session?.user;
    const orderIdParam = req.params.orderId;
    if (!orderIdParam) {
      console.log('No orderId param — redirecting');
      return res.redirect('/');
    }

    let order = await Order.findOne({ orderId: orderIdParam })
      .populate('orderedItems.product')
      .lean();

    if (!order) {
      console.log('Order not found with orderedItems.product — trying orderedItems.productId');
      order = await Order.findOne({ orderId: orderIdParam })
        .populate('orderedItems.productId')
        .lean();
    }

    console.log('Order fetched?', !!order);

    if (!order) {
      console.log('Order not found in DB for id:', orderIdParam);
      return res.status(404).render('orderSuccess', { orderId: orderIdParam, notFound: true, forbidden: false, order: null });
    }

    if (String(order.userId) !== String(userId)) {
      console.log('Ownership mismatch: order.userId=', order.userId, 'session.user=', userId);
      return res.status(403).render('orderSuccess', { orderId: order.orderId, notFound: false, forbidden: true, order: null });
    }

    order.displayDate = order.invoiceDate ? new Date(order.invoiceDate).toLocaleString() : new Date(order.createdAt).toLocaleString();
    order.itemsForView = (order.orderedItems || []).map(it => ({
      name: (it.product && (it.product.productName || it.product.name)) || (it.productId && (it.productId.productName || it.productId.name)) || 'Product',
      qty: it.quantity,
      unitPrice: it.price,
      itemTotal: (it.price * it.quantity)
    }));

    console.log('Rendering orderSuccess for orderId:', order.orderId);
    return res.render('orderSuccess', {
      orderId: order.orderId,
      order,
      notFound: false,
      forbidden: false
    });
  } catch (err) {
    console.error('getOrderSuccess error:', err);
    return res.redirect('/pageNotFound');
  }
};


const getOrderDetails = async (req, res) => {
  try {
    const userId = req.session?.user;
    const orderId = req.params.orderId;
    if (!orderId) return res.redirect('/');

    let order = await Order.findOne({ orderId })
      .populate('orderedItems.product')
      .lean();
    if (!order) {
      order = await Order.findOne({ orderId })
        .populate('orderedItems.productId')
        .lean();
    }

    if (!order) return res.status(404).render('orderDetails', { orderId, notFound: true });

    if (String(order.userId) !== String(userId)) {
      return res.status(403).render('orderDetails', { orderId, forbidden: true });
    }

    order.itemsForView = (order.orderedItems || []).map(it => {
      const prod = it.product || it.productId || {};
      const name = prod.productName || prod.name || 'Product';
      const unit = Number(it.price || prod.salePrice || prod.price || 0);
      const qty = Number(it.quantity || 1);
      return {
        name,
        unit,
        qty,
        itemTotal: unit * qty,
        product: prod,
        _id: it._id,
        status: it.status
      };
    });

    order.displayDate = order.invoiceDate ? new Date(order.invoiceDate).toLocaleString() : new Date(order.createdAt).toLocaleString();

    return res.render('orderDetails', {
      orderId: order.orderId,
      order,
      notFound: false,
      forbidden: false
    });
  } catch (err) {
    console.error('getOrderDetails error:', err);
    return res.redirect('/pageNotFound');
  }
};


const cancelOrder = async (req, res) => {
  try {
    const userId = req.session?.user;
    const orderId = req.params.orderId;
    const reason = req.body.reason || 'Cancelled by user';

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    if (!['Pending', 'Processing'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
    }

    order.status = 'Cancelled';
    order.returnReason = reason;
    await order.save();
    for (const it of order.orderedItems) {
      const pid = it.product || it.productId;
      if (pid) {
        await Product.findByIdAndUpdate(pid, { $inc: { quantity: it.quantity } }).catch(e => console.error('Restock failed', e));
      }
    }

    return res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    console.error('cancelOrder error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getInvoice = async (req, res) => {
  try {
    console.log('[invoice] called, params:', req.params);
    const userId = req.session?.user;
    const orderId = req.params.orderId;
    if (!orderId) {
      console.log('[invoice] missing orderId param');
      return res.status(400).send('Bad request');
    }

    let order = await Order.findOne({ orderId })
      .populate('orderedItems.product')
      .lean();
    if (!order) {
      order = await Order.findOne({ orderId }).populate('orderedItems.productId').lean();
    }
    if (!order) {
      console.log('[invoice] order not found:', orderId);
      return res.status(404).send('Order not found');
    }
    if (String(order.userId) !== String(userId)) {
      console.log('[invoice] ownership mismatch', { orderUser: order.userId, sessionUser: userId });
      return res.status(403).send('Forbidden');
    }

    // Create PDFDoc
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const filename = `invoice-${order.orderId}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);


    try {
      // --- Header --
      doc.fillColor('#444444').fontSize(30).text('Footwear', 50, 57)
        .moveDown();

      // --- Invoice Details ---
      doc.fillColor('#000000').fontSize(20).text('INVOICE', 50, 130);
      doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, 155).lineTo(550, 155).stroke();

      doc.fontSize(10).font('Helvetica-Bold').text(`Invoice Number:`, 50, 160)
        .font('Helvetica').text(order.orderId, 150, 160)
        .font('Helvetica-Bold').text(`Invoice Date:`, 50, 175)
        .font('Helvetica').text(new Date(order.invoiceDate || order.createdAt).toDateString(), 150, 175);
      // .font('Helvetica-Bold').text(`Due Date:`, 50, 190) // Optional
      // .font('Helvetica').text(..., 150, 190);

      // --- Bill To ---
      // const shipping = order.shippingAddress || {};
      // doc.font('Helvetica-Bold').text('Bill To:', 300, 160)
      //   .font('Helvetica').text(shipping.name || 'Customer', 300, 175)
      //   .text(shipping.addressType || '', 300, 190)
      //   .text(`${shipping.city || ''}, ${shipping.state || ''} - ${shipping.pincode || ''}`, 300, 205)
      //   .text(shipping.country || '', 300, 220)
      //   .moveDown();


      let y = 250;
      doc.lineWidth(0.5).rect(50, y, 500, 20).fill('#CCCCCC').stroke('#000000');
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
      doc.text('Item', 60, y + 5);
      doc.text('Quantity', 280, y + 5, { width: 60, align: 'center' });
      doc.text('Price', 350, y + 5, { width: 70, align: 'right' });
      doc.text('Total', 440, y + 5, { width: 90, align: 'right' });


      y += 20;
      let subtotal = 0;
      doc.font('Helvetica').fontSize(10);

      (order.orderedItems || []).forEach(it => {
        const prod = it.product || it.productId || {};
        const name = prod.productName || prod.name || 'Product';
        const qty = Number(it.quantity || 1);
        const unit = Number(it.price || prod.salePrice || prod.price || 0);
        const itemTotal = qty * unit;
        subtotal += itemTotal;


        doc.text(name.substring(0, 40), 60, y + 5);
        doc.text(qty.toString(), 280, y + 5, { width: 60, align: 'center' });
        doc.text(unit.toFixed(2), 350, y + 5, { width: 70, align: 'right' });
        doc.text(itemTotal.toFixed(2), 440, y + 5, { width: 90, align: 'right' });

        doc.moveTo(50, y + 20).lineTo(550, y + 20).strokeColor('#eeeeee').stroke();
        y += 25;
      });


      const discount = Number(order.discount || 0);
      const shipCost = Number(order.shipping || 0);
      const taxes = Number(order.taxes ?? Math.round((order.totalPrice || subtotal) * 0.12));
      const totalAmount = Number(order.finalAmount || (subtotal - discount + taxes + shipCost));

      y += 10;
      doc.moveTo(50, y).lineTo(550, y).lineWidth(1).strokeColor('#aaaaaa').stroke();
      y += 15;

      const summaryX = 350;
      const valueX = 440;
      const valueW = 90;

      doc.font('Helvetica').text('Subtotal:', summaryX, y, { align: 'right', width: 80 });
      doc.text(subtotal.toFixed(2), valueX, y, { align: 'right', width: valueW });
      y += 15;

      if (discount > 0) {
        doc.text('Discount:', summaryX, y, { align: 'right', width: 80 });
        doc.text('- ' + discount.toFixed(2), valueX, y, { align: 'right', width: valueW });
        y += 15;
      }

      doc.text('Tax (12%):', summaryX, y, { align: 'right', width: 80 });
      doc.text(taxes.toFixed(2), valueX, y, { align: 'right', width: valueW });
      y += 15;

      doc.text('Shipping:', summaryX, y, { align: 'right', width: 80 });
      doc.text(shipCost.toFixed(2), valueX, y, { align: 'right', width: valueW });
      y += 15;

      doc.rect(summaryX, y - 5, 200, 25).fill('#F0F0F0');
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12);
      doc.text('Total:', summaryX + 10, y, { align: 'left' });
      doc.text('Rs.' + totalAmount.toFixed(2), valueX, y, { align: 'right', width: valueW });

      // Footer
      doc.moveDown(4);
      doc.fontSize(10).font('Helvetica').text('Payment Method: ' + (order.paymentMethod || 'COD'), 50, y + 50);
      doc.font('Helvetica-Oblique').fontSize(9).text('Thank you for shopping with us!', 50, y + 65, { align: 'center', width: 500 });

      doc.end();
      console.log('[invoice] generated and streaming to client:', filename);
    } catch (pdfErr) {
      console.error('[invoice] PDF generation error:', pdfErr);
      try { doc.end(); } catch (e) { }
      if (!res.headersSent) return res.status(500).send('Invoice generation failed');
    }

  } catch (err) {
    console.error('[invoice] handler error:', err);
    if (!res.headersSent) {
      return res.status(500).send('Server error generating invoice');
    } else {
      try { res.end(); } catch (e) { }
    }
  }
};


const getOrderStatuses = async (req, res) => {
  try {
    const userId = req.session?.user;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const idsParam = req.query.ids || '';
    if (!idsParam) return res.json({ success: true, data: {} });

    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);

    const orders = await Order.find({ orderId: { $in: ids }, userId: userId }).lean();

    const map = {};
    orders.forEach(o => { map[o.orderId] = { status: o.status, finalAmount: o.finalAmount }; });

    return res.json({ success: true, data: map });
  } catch (err) {
    console.error('getOrderStatuses error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listOrders = async (req, res) => {
  try {
    const userId = req.session?.user;
    if (!userId) return res.redirect('/login');

    const q = (req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 100));
    const filter = { userId: userId };

    if (q) {
      filter.$or = [
        { orderId: { $regex: q, $options: 'i' } },
        { status: { $regex: q, $options: 'i' } }
      ];
    }

    const total = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const ordersForView = orders.map(o => {
      const items = o.orderedItems || [];
      const itemsCount = items.reduce((s, it) => s + (it.quantity || 0), 0);
      return {
        orderId: o.orderId,
        _id: o._id,
        status: o.status,
        createdAt: o.createdAt,
        finalAmount: o.finalAmount ?? o.totalPrice ?? 0,
        totalPrice: o.totalPrice ?? 0,
        itemsCount
      };
    });

    return res.render('orders', {
      orders: ordersForView,
      q,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total
    });
  } catch (err) {
    console.error('listOrders error:', err);
    return res.redirect('/pageNotFound');
  }
};

// Create Razorpay Order
const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { addressId } = req.body;
    if (!addressId) return res.status(400).json({ success: false, message: 'Address required' });

    const userCart = await Cart.findOne({ userId: userId }).populate('items.productId').exec();
    if (!userCart || !userCart.items || userCart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Check for blocked products
    for (const item of userCart.items) {
      if (!item.productId || item.productId.isBlocked) {
        return res.status(400).json({ success: false, message: 'Some items in your cart are no longer available.' });
      }
    }

    const addressDoc = await Address.findOne({ UserId: userId }).lean();
    if (!addressDoc) return res.status(400).json({ success: false, message: 'No saved addresses' });
    const addr = addressDoc.address.find(a => String(a._id) === String(addressId));
    if (!addr) return res.status(400).json({ success: false, message: 'Address not found' });

    // Calculate totals
    let totalPrice = 0;
    const orderedItems = userCart.items.map(ci => {
      const prod = ci.productId;
      const qty = Number(ci.quantity || 1);
      const unitPrice = Number(ci.price ?? prod.salePrice ?? prod.price ?? 0);
      const itemTotal = Number(ci.totalPrice ?? unitPrice * qty);
      totalPrice += itemTotal;
      return { product: prod._id, quantity: qty, price: unitPrice };
    });

    // Coupon Logic
    let discount = 0;
    let couponApplied = false;
    let appliedCouponCode = null;

    if (req.session.coupon) {
      const coupon = await Coupon.findOne({ name: req.session.coupon.code });
      if (coupon && coupon.expireOn > new Date() && totalPrice >= coupon.minimumPrice && !coupon.userId.includes(userId)) {
        discount = Number(coupon.offerPrice);
        couponApplied = true;
        appliedCouponCode = coupon.name;
      }
    }

    const taxes = Math.round(totalPrice * 0.12);
    const shipping = totalPrice > 500 ? 0 : 50;
    const finalAmount = Math.max(0, totalPrice - discount + taxes + shipping);

    // Create order in database first (with Failed status until payment is verified)
    const newOrder = new Order({
      userId,
      orderedItems,
      shippingAddress: {
        addressType: addr.addressType,
        name: addr.fullName,
        city: addr.city,
        landmark: addr.streetAddress,
        state: addr.state,
        pincode: addr.pincode,
        phone: addr.phone,
        altPhone: addr.altPhone || ''
      },
      totalPrice,
      discount,
      finalAmount,
      paymentMethod: 'Razorpay',
      paymentStatus: 'Failed',
      status: 'Failed',
      couponApplied,
      couponCode: appliedCouponCode
    });

    const savedOrder = await newOrder.save();

    // Create Razorpay order
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: finalAmount * 100, // Amount in paise
      currency: 'INR',
      receipt: savedOrder.orderId,
      notes: {
        orderId: savedOrder.orderId,
        userId: userId.toString()
      }
    });

    // Get user info for prefill (you might want to fetch from User model)
    return res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: savedOrder.orderId,
      customerName: addr.fullName,
      customerEmail: '', // Add user email if available
      customerPhone: addr.phone
    });
  } catch (err) {
    console.error('createRazorpayOrder error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create payment order: ' + (err.message || err) });
  }
};

// Verify Razorpay Payment
const verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId, addressId } = req.body;

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Payment verified - update order and reduce stock
    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Reduce stock
    const decremented = [];
    for (const item of order.orderedItems) {
      const prod = await Product.findById(item.product);
      if (!prod) {
        // Rollback
        for (const d of decremented) {
          await Product.findByIdAndUpdate(d.productId, { $inc: { quantity: d.qty } });
        }
        return res.status(400).json({ success: false, message: 'Product not found' });
      }

      const qty = Number(item.quantity || 1);
      const updated = await Product.findOneAndUpdate(
        { _id: prod._id, quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
        { new: true }
      );

      if (!updated) {
        // Rollback
        for (const d of decremented) {
          await Product.findByIdAndUpdate(d.productId, { $inc: { quantity: d.qty } });
        }
        return res.status(400).json({ success: false, message: `Insufficient stock for ${prod.productName}` });
      }

      decremented.push({ productId: prod._id, qty });
    }

    // Update order status
    order.paymentStatus = 'Completed';
    order.status = 'Processing';
    order.razorpayOrderId = razorpay_order_id;
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    // Mark coupon as used if applicable
    if (order.couponCode) {
      await Coupon.findOneAndUpdate({ name: order.couponCode }, { $addToSet: { userId: userId } });
      req.session.coupon = null;
    }

    // Clear cart
    const userCart = await Cart.findOne({ userId });
    if (userCart) {
      userCart.items = [];
      await userCart.save();
    }

    return res.json({ success: true, orderId: order.orderId, message: 'Payment verified successfully' });
  } catch (err) {
    console.error('verifyRazorpayPayment error:', err);
    return res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};

const getOrderFailure = async (req, res) => {
  try {
    const userId = req.session?.user;
    const orderId = req.params.orderId;
    if (!orderId) return res.redirect('/');

    const order = await Order.findOne({ orderId }).lean();
    if (!order) return res.status(404).render('pageNotFound');

    // Security check
    if (String(order.userId) !== String(userId)) {
      return res.redirect('/');
    }

    res.render('orderFailure', { order });
  } catch (err) {
    console.error(err);
    res.redirect('/pageNotFound');
  }
};

const retryRazorpayPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { orderId } = req.body;
    const order = await Order.findOne({ orderId: orderId, userId: userId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'Cancelled' || order.paymentStatus === 'Completed') {
      return res.status(400).json({ success: false, message: 'Order cannot be repaid' });
    }

    // Create a new Razorpay order for the remaining amount (usually full amount)
    // If previous Razorpay order is expired or valid, we generally create a new one to be safe
    // or we can check if order.razorpayOrderId is still valid. Better to create new for retry loop.

    const amountInPaise = Math.round(order.finalAmount * 100);

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.orderId,
      notes: {
        orderId: order.orderId,
        userId: userId.toString(),
        retry: 'true'
      }
    });

    // Update order with new Razorpay Order ID just in case
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.json({
      success: true,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      customerName: order.shippingAddress.name,
      customerPhone: order.shippingAddress.phone,
      customerEmail: '' // fetch if needed
    });

  } catch (err) {
    console.error('retryRazorpayPayment error:', err);
    return res.status(500).json({ success: false, message: 'Retry initialization failed' });
  }
};

// Cancel individual item in an order
const cancelOrderItem = async (req, res) => {
  try {
    const userId = req.session?.user;
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    // Find the item
    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    // Check if item can be cancelled
    if (!['Pending', 'Processing'].includes(item.status)) {
      return res.status(400).json({ success: false, message: 'Item cannot be cancelled at this stage' });
    }

    // Cancel the item
    item.status = 'Cancelled';
    item.cancellationReason = reason || 'Cancelled by user';

    // Restore stock
    const pid = item.product;
    if (pid) {
      await Product.findByIdAndUpdate(pid, { $inc: { quantity: item.quantity } })
        .catch(e => console.error('Restock failed', e));
    }

    // Check if all items are cancelled
    const allCancelled = order.orderedItems.every(it => it.status === 'Cancelled');
    if (allCancelled) {
      order.status = 'Cancelled';
    }

    await order.save();

    return res.json({ success: true, message: 'Item cancelled successfully' });
  } catch (err) {
    console.error('cancelOrderItem error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Return order (only for delivered orders)
const returnOrder = async (req, res) => {
  try {
    const userId = req.session?.user;
    const orderId = req.params.orderId;
    const { reason, itemId } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Return reason is required' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    // If itemId is provided, return specific item, otherwise return entire order
    if (itemId) {
      const item = order.orderedItems.id(itemId);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found in order' });
      }

      if (item.status !== 'Delivered') {
        return res.status(400).json({ success: false, message: 'Only delivered items can be returned' });
      }

      item.status = 'Returned';
      item.returnReason = reason;
      item.returnRequested = true;

      // Restore stock
      const pid = item.product;
      if (pid) {
        await Product.findByIdAndUpdate(pid, { $inc: { quantity: item.quantity } })
          .catch(e => console.error('Restock failed', e));
      }

      // Check if all items are returned
      const allReturned = order.orderedItems.every(it => it.status === 'Returned');
      if (allReturned) {
        order.status = 'Returned';
        order.returnReason = reason;
      }
    } else {
      // Return entire order
      if (order.status !== 'Delivered') {
        return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
      }

      order.status = 'Returned';
      order.returnReason = reason;

      // Mark all items as returned and restore stock
      for (const item of order.orderedItems) {
        item.status = 'Returned';
        item.returnReason = reason;
        item.returnRequested = true;

        const pid = item.product;
        if (pid) {
          await Product.findByIdAndUpdate(pid, { $inc: { quantity: item.quantity } })
            .catch(e => console.error('Restock failed', e));
        }
      }
    }

    await order.save();

    return res.json({ success: true, message: 'Return request submitted successfully' });
  } catch (err) {
    console.error('returnOrder error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Enhanced cancel entire order with optional reason
const cancelEntireOrder = async (req, res) => {
  try {
    const userId = req.session?.user;
    const orderId = req.params.orderId;
    const { reason } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    if (!['Pending', 'Processing'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
    }

    order.status = 'Cancelled';
    order.returnReason = reason || 'Cancelled by user';

    // Cancel all items and restore stock
    for (const item of order.orderedItems) {
      if (['Pending', 'Processing'].includes(item.status)) {
        item.status = 'Cancelled';
        item.cancellationReason = reason || 'Cancelled by user';

        const pid = item.product;
        if (pid) {
          await Product.findByIdAndUpdate(pid, { $inc: { quantity: item.quantity } })
            .catch(e => console.error('Restock failed', e));
        }
      }
    }

    await order.save();

    return res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    console.error('cancelEntireOrder error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


module.exports = {
  placeOrder,
  getOrderSuccess,
  getOrderDetails,
  cancelOrder,
  getInvoice,
  getOrderStatuses,
  listOrders,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getOrderFailure,
  retryRazorpayPayment,
  cancelOrderItem,
  returnOrder,
  cancelEntireOrder
};
