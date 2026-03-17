const mongoose = require('mongoose');

const ORDER_STAGES = [
  'order_received', 'yarn_sourced', 'knitting', 'fabric_received',
  'pre_qc', 'reversed', 'lab_dip', 'dyeing', 'post_qc', 'drying', 'delivered'
];

const stageHistorySchema = new mongoose.Schema({
  stage:     { type: String },
  enteredAt: { type: Date, default: Date.now },
  notes:     { type: String, default: '' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNo:         { type: String, sparse: true },
  clientName:      { type: String, required: true, trim: true },
  fabricType:      { type: String, required: true },
  yarnSpec:        { type: String, default: '' },
  targetColor:     { type: String, required: true },
  colorRef:        { type: String, default: '' },
  quantity:        { type: Number, required: true, min: 1 },
  deadline:        { type: Date },
  currentStage:    { type: String, enum: ORDER_STAGES, default: 'order_received' },
  stageHistory:    { type: [stageHistorySchema], default: [] },
  notes:           { type: String, default: '' },
  status:          { type: String, enum: ['active', 'overdue', 'completed'], default: 'active' },
  assignedMachine: { type: String, default: '' },
  linkedBatchId:   { type: String, default: '' },
}, { timestamps: true });

// NO pre-save hooks — order number is generated in the route handler
// This avoids all Express 5 / Mongoose async hook conflicts

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
