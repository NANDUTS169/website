const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

const DEFAULT_LIMIT = 10;

function buildMatch(query) {
  const match = {};
  if (query.status) match.status = query.status;
  if (query.paymentStatus) match.paymentStatus = query.paymentStatus;
  if (query.search && query.search.trim()) {
    const s = new RegExp(query.search.trim(), 'i');
    match.$or = [
      { orderId: s },
      { 'shippingAddress.name': s }
    ];
  }
  return match;
}


const listOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || 1));
    const limit = Math.max(5, parseInt(req.query.limit || DEFAULT_LIMIT));
    const sortBy = req.query.sortBy || 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

    const match = buildMatch(req.query);

    const pipeline = [
      { $match: match },
      { $sort: { [sortBy]: sortDir } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit }
          ],
          total: [
            { $count: 'count' }
          ]
        }
      }
    ];

    const agg = await Order.aggregate(pipeline);

    const orders = (agg[0].data || []);
    const total = (agg[0].total[0] && agg[0].total[0].count) || 0;
    const pages = Math.ceil(total / limit) || 1;

    const populated = await Order.populate(orders, [
      { path: 'userId', select: 'name email phone' },
      { path: 'orderedItems.product', select: 'name sku' }
    ]);

    res.render('admin-orders', {
      orders: populated,
      page,
      pages,
      total,
      query: req.query
    });

  } catch (err) {
    console.error('listOrders err', err);
    return res.redirect('/admin/pageerror');
  }
};



const getOrderDetail = async (req, res) => {

  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.redirect('/admin/orderlist');

    const order = await Order.findById(id)
      .populate('userId', 'name email phone walletBalance')
      .populate('orderedItems.product', 'name sku stock')
      .lean();

    if (!order) return res.redirect('/admin/orderlist');

    res.render('admin-order-detail', { order });
  } catch (err) {
    console.error('getOrderDetail err', err);
    return res.redirect('/admin/pageerror');
  }
};



const updateStatus = async (req, res) => {

  try {
    const orderId = req.params.id;
    const { status, note } = req.body;
    const valid = ['Pending','Processing','Shipped','Delivered','Cancelled','Return Requested','Returned'];
    if (!valid.includes(status)) return res.json({ ok:false, msg:'Invalid status' });

    const order = await Order.findById(orderId);
    if (!order) return res.json({ ok:false, msg:'Order not found' });

    const prevStatus = order.status;
    order.status = status;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status, note: note || '', at: new Date() });

    if (['Cancelled','Returned'].includes(status) && !['Cancelled','Returned'].includes(prevStatus)) {
      for (const it of order.orderedItems) {
        if (it.product) {
          await Product.findByIdAndUpdate(it.product, { $inc: { stock: it.quantity } }).catch(e=>console.error(e));
        }
      }
    }

    await order.save();
    return res.json({ ok:true, msg:'Status updated' });
  } catch (err) {
    console.error('updateStatus err', err);
    return res.status(500).json({ ok:false, msg:'Server error' });
  }
};



const verifyReturn = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { action, productId, refundTo } = req.body;
    if (!['approve','reject'].includes(action)) return res.json({ ok:false, msg:'Invalid action' });

    const order = await Order.findById(orderId).populate('userId').populate('orderedItems.product');
    if (!order) return res.json({ ok:false, msg:'Order not found' });

    const item = order.orderedItems.find(it => String(it.product._id) === String(productId));
    if (!item) return res.json({ ok:false, msg:'Item not found in order' });

    if (action === 'reject') {
      item.returnRequested = false;
      item.returnReason = '';
      await order.save();
      return res.json({ ok:true, msg:'Return rejected' });
    }

    item.returnVerified = true; 
    if (item.product && item.quantity) {
      await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: item.quantity } }).catch(e=>console.error(e));
    }

    const refundAmount = (item.price || 0) * (item.quantity || 1);

    if (refundTo === 'wallet') {
      order.userId.walletBalance = (order.userId.walletBalance || 0) + refundAmount;
      await order.userId.save();
      order.walletRefunded = true;
    } else {
      order.paymentStatus = 'Refunded';
    }

    const allReturned = order.orderedItems.every(it => it.returnVerified);
    if (allReturned) order.status = 'Returned';

    await order.save();
    return res.json({ ok:true, msg:'Return approved', refundAmount });
  } catch (err) {
    console.error('verifyReturn err', err);
    return res.status(500).json({ ok:false, msg:'Server error' });
  }
};


module.exports = {
    listOrders,
    getOrderDetail,
    updateStatus,
    verifyReturn

}