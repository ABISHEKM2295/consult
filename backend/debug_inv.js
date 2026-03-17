require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Inventory = require('./models/Inventory');
        console.log('Deleting all...');
        await Inventory.deleteMany({});
        console.log('Inserting one item...');
        const res = await Inventory.create({
            name: 'TEST Item',
            category: 'Dye',
            stock: 100
        });
        console.log('Inserted:', res);
        const count = await Inventory.countDocuments();
        console.log('Total count:', count);
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}
test();
