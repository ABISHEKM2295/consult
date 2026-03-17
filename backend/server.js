const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully [API Server]'))
    .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Import Routes
const batchRoutes     = require('./routes/batches');
const scheduleRoutes  = require('./routes/schedules');
const inventoryRoutes = require('./routes/inventory');
const machineRoutes   = require('./routes/machines');
const inspectionRoutes= require('./routes/inspections');
const alertRoutes     = require('./routes/alerts');
const orderRoutes     = require('./routes/orders');
const labDipRoutes    = require('./routes/labdips');
const authRoutes      = require('./routes/auth');

// Mount Routes
app.use('/api/batches',     batchRoutes);
app.use('/api/schedules',   scheduleRoutes);
app.use('/api/inventory',   inventoryRoutes);
app.use('/api/machines',    machineRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/alerts',      alertRoutes);
app.use('/api/orders',      orderRoutes);
app.use('/api/labdips',     labDipRoutes);
app.use('/api/auth',        authRoutes);

// Root Route
app.get('/', (req, res) => {
    res.json({
        message: 'Premier Textile Dyers API',
        version: '2.0.0',
        endpoints: {
            batches:     '/api/batches',
            schedules:   '/api/schedules',
            inventory:   '/api/inventory',
            machines:    '/api/machines',
            inspections: '/api/inspections',
            alerts:      '/api/alerts',
            orders:      '/api/orders',
            labdips:     '/api/labdips',
            auth:        '/api/auth',
        }
    });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            message: 'Route not found',
            status: 404
        }
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API available at http://localhost:${PORT}`);
});
