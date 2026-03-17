const express = require('express');
const router  = express.Router();
const LabDip  = require('../models/LabDip');
const Order   = require('../models/Order');

// ── GET /api/labdips?orderId= ────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.orderId) q.orderId = req.query.orderId;
    if (req.query.status)  q.status  = req.query.status;
    const dips = await LabDip.find(q).sort({ createdAt: -1 }).populate('orderId', 'orderNo clientName targetColor');
    res.json(dips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/labdips/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const dip = await LabDip.findById(req.params.id).populate('orderId');
    if (!dip) return res.status(404).json({ error: 'Lab dip not found' });
    res.json(dip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/labdips ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    // Auto-set attempt number
    const existing = await LabDip.countDocuments({ orderId: req.body.orderId });
    const dip = new LabDip({ ...req.body, attemptNo: existing + 1 });

    // Fetch orderNo from Order
    if (req.body.orderId) {
      const order = await Order.findById(req.body.orderId);
      if (order) dip.orderNo = order.orderNo;
    }
    await dip.save();
    res.status(201).json(dip);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PUT /api/labdips/:id ─────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const dip = await LabDip.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dip) return res.status(404).json({ error: 'Lab dip not found' });
    res.json(dip);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PUT /api/labdips/:id/approve ────────────────────────────
router.put('/:id/approve', async (req, res) => {
  try {
    const dip = await LabDip.findById(req.params.id);
    if (!dip) return res.status(404).json({ error: 'Lab dip not found' });
    dip.status     = 'approved';
    dip.approvedBy = req.body.approvedBy || 'Admin';
    dip.approvedAt = new Date();
    dip.clientFeedback = req.body.feedback || 'Approved';
    await dip.save();
    res.json(dip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/labdips/:id/reject ─────────────────────────────
router.put('/:id/reject', async (req, res) => {
  try {
    const dip = await LabDip.findById(req.params.id);
    if (!dip) return res.status(404).json({ error: 'Lab dip not found' });
    dip.status = 'rejected';
    dip.clientFeedback = req.body.feedback || 'Rejected — needs revision';
    await dip.save();
    res.json(dip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/labdips/:id/lock ────────────────────────────────
router.put('/:id/lock', async (req, res) => {
  try {
    const dip = await LabDip.findById(req.params.id);
    if (!dip) return res.status(404).json({ error: 'Lab dip not found' });
    if (dip.status !== 'approved')
      return res.status(400).json({ error: 'Only approved lab dips can be locked' });
    dip.status  = 'locked';
    dip.lockedForProduction = true;
    dip.lockedAt = new Date();
    // Unlock other dips for same order
    await LabDip.updateMany(
      { orderId: dip.orderId, _id: { $ne: dip._id }, status: 'locked' },
      { status: 'approved', lockedForProduction: false }
    );
    await dip.save();
    res.json(dip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/labdips/:id ──────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const dip = await LabDip.findByIdAndDelete(req.params.id);
    if (!dip) return res.status(404).json({ error: 'Lab dip not found' });
    res.json({ message: 'Lab dip deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
