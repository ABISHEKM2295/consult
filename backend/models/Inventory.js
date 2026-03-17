const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    category: {
        type: String,
        enum: ['Dye', 'Chemical'],
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    minThreshold: {
        type: Number,
        default: 100
    },
    maxCapacity: {
        type: Number,
        default: 500
    },
    weeklyUsage: {
        sun: { type: Number, default: 0 },
        mon: { type: Number, default: 0 },
        tue: { type: Number, default: 0 },
        wed: { type: Number, default: 0 },
        thu: { type: Number, default: 0 },
        fri: { type: Number, default: 0 }
    },
    status: {
        type: String,
        enum: ['ok', 'low', 'critical'],
        default: 'ok'
    },
    stockLevel: {
        type: Number,
        default: 100
    },
    costPerKg: {
        type: Number,
        default: 15.0 // Base default cost
    }
}, {
    timestamps: true
});

// Auto-calculate status and stockLevel before saving
inventorySchema.pre('save', async function () {
    this.stockLevel = Math.round((this.stock / this.maxCapacity) * 100);

    if (this.stockLevel <= 20) {
        this.status = 'critical';
    } else if (this.stockLevel <= 50) {
        this.status = 'low';
    } else {
        this.status = 'ok';
    }
});

module.exports = mongoose.model('Inventory', inventorySchema);
