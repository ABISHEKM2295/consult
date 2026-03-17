const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');

// Inline stages so this file never depends on the export property
const ORDER_STAGES = [
  'order_received', 'yarn_sourced', 'knitting', 'fabric_received',
  'pre_qc', 'reversed', 'lab_dip', 'dyeing', 'post_qc', 'drying', 'delivered'
];

// ── GET /api/orders ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { clientName, stage, status, search } = req.query;
    const q = {};
    if (clientName) q.clientName = new RegExp(clientName, 'i');
    if (stage)      q.currentStage = stage;
    if (status)     q.status = status;
    if (search)     q.$or = [
      { clientName: new RegExp(search, 'i') },
      { targetColor: new RegExp(search, 'i') },
      { orderNo: new RegExp(search, 'i') },
    ];

    // Re-check overdue on read
    const orders = await Order.find(q).sort({ createdAt: -1 });
    const now = new Date();
    orders.forEach(o => {
      if (o.deadline && now > o.deadline && o.status === 'active') {
        o.status = 'overdue';
      }
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders/stats ────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const orders = await Order.find({});
    const now = new Date();
    const byStage = {};
    ORDER_STAGES.forEach(s => { byStage[s] = 0; });
    orders.forEach(o => { byStage[o.currentStage] = (byStage[o.currentStage] || 0) + 1; });
    const overdue = orders.filter(o => o.deadline && now > o.deadline && o.status !== 'completed').length;
    res.json({
      total:     orders.length,
      active:    orders.filter(o => o.status === 'active').length,
      overdue,
      completed: orders.filter(o => o.status === 'completed').length,
      byStage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/orders ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };

    // Generate order number if not provided
    if (!body.orderNo) {
      const count = await Order.countDocuments();
      body.orderNo = `ORD-${String(count + 1).padStart(4, '0')}`;
    }

    // Set initial status based on deadline
    if (body.deadline && new Date() > new Date(body.deadline)) {
      body.status = 'overdue';
    } else {
      body.status = 'active';
    }

    const order = new Order(body);
    order.stageHistory.push({ stage: 'order_received', enteredAt: new Date(), notes: 'Order created' });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ── PUT /api/orders/:id/advance ──────────────────────────────
router.put('/:id/advance', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const currentIdx = ORDER_STAGES.indexOf(order.currentStage);
    if (currentIdx >= ORDER_STAGES.length - 1)
      return res.status(400).json({ error: 'Order is already at final stage (delivered)' });

    const nextStage = ORDER_STAGES[currentIdx + 1];
    order.currentStage = nextStage;
    order.stageHistory.push({ stage: nextStage, enteredAt: new Date(), notes: req.body.notes || '' });
    if (nextStage === 'delivered') order.status = 'completed';
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/orders/:id ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /api/orders/:id ───────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
