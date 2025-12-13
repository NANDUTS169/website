const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');

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

    const discount = 0;
    const taxes = Math.round(totalPrice * 0.12);
    const shipping = totalPrice > 500 ? 0 : 50;
    const finalAmount = totalPrice - discount + taxes + shipping;

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
      couponApplied: false
    });

    let savedOrder;
    try {
      savedOrder = await newOrder.save();
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
      return { name, unit, qty, itemTotal: unit * qty, product: prod };
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

module.exports = {
  placeOrder,
  getOrderSuccess,
  getOrderDetails,
  cancelOrder,
  getInvoice,
  getOrderStatuses,
  listOrders,

};
