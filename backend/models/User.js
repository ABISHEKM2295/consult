const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username:   { type: String, required: true, unique: true, trim: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['admin', 'operator', 'client'], default: 'operator' },
  clientName: { type: String, default: '' },  // only relevant for role=client
  email:      { type: String, default: '' },
  active:     { type: Boolean, default: true },
}, { timestamps: true });

// Hash password before save — Mongoose 9: async hooks must NOT call next()
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});


userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
