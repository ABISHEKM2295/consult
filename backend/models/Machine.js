const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
    machineId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['running', 'idle', 'maintenance'],
        default: 'idle'
    },
    party: {
        type: String,
        default: ''
    },
    color: {
        type: String,
        default: ''
    },
    lotNo: {
        type: String,
        default: ''
    },
    quantity: {
        type: String,
        default: ''
    },
    stage: {
        type: String,
        default: ''
    },
    efficiency: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    runtime: {
        type: String,
        default: ''
    },
    startTime: {
        type: Date
    },
    hourlyUtilityCost: {
        type: Number,
        default: 50.0 // Base default cost for power/steam/water per hour
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Machine', machineSchema);
