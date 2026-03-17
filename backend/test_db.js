const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://ashokj23cse_db_user:Eia29gfsPMYeLIdN@cluster0.fs5onst.mongodb.net/?appName=Cluster0')
    .then(async () => {
        const db = require('./models/Inventory');
        const count = await db.countDocuments();
        const docs = await db.find().limit(2);
        console.log('Inventory Count:', count);
        console.log(JSON.stringify(docs, null, 2));
        process.exit(0);
    })
    .catch(console.error);
