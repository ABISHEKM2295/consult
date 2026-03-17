const mongoose = require('mongoose');

const labDipSchema = new mongoose.Schema({
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNo:    { type: String },
  attemptNo:  { type: Number, default: 1 },
  recipe: {
    dyes:      [{ name: String, qty: String, percentage: Number }],
    chemicals: [{ name: String, qty: String }],
  },
  labResult: {
    L:       { type: Number },   // CIE L* of actual
    a:       { type: Number },   // CIE a* of actual
    b:       { type: Number },   // CIE b* of actual
    deltaE:  { type: Number },   // vs target L*a*b*
  },
  targetLab: {
    L:       { type: Number },
    a:       { type: Number },
    b:       { type: Number },
  },
  colorHex:  { type: String, default: '#888888' }, // for swatch display
  status:    {
    type: String,
    enum: ['pending', 'client_review', 'approved', 'rejected', 'locked'],
    default: 'pending',
  },
  clientFeedback: { type: String, default: '' },
  approvedBy:     { type: String },
  approvedAt:     { type: Date },
  lockedAt:       { type: Date },
  lockedForProduction: { type: Boolean, default: false },
  notes:     { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('LabDip', labDipSchema);
