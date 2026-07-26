const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://waelalsadiq24_db_user:2tbFWqOTp3XcDtA@cluster0.gribvlx.mongodb.net/?retryWrites=true&w=majority";
const DB_NAME = "hearingSystemDB";

let cachedClient = null;

async function getDB() {
    if (cachedClient) {
        return cachedClient.db(DB_NAME);
    }
    const client = new MongoClient(MONGODB_URI, {
        tls: true,
        tlsAllowInvalidCertificates: true
    });
    await client.connect();
    cachedClient = client;
    return client.db(DB_NAME);
}

app.get('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    try {
        const db = await getDB();
        const institutionsCollection = db.collection('institutions');
        const recordsCollection = db.collection('records');
        const deviceOptionsCollection = db.collection('deviceOptions');

        let currentInst = await institutionsCollection.findOne({ id: code });
        if (!currentInst) {
            currentInst = { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' };
        }

        const records = await recordsCollection.find({}).toArray();
        let devicesCursor = await deviceOptionsCollection.find({}).toArray();
        let deviceOptions = devicesCursor.map(d => d.name);
        if (deviceOptions.length === 0) {
            deviceOptions = ['oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'];
        }

        res.json({
            records: records.map(r => ({ ...r, id: r._id })), 
            deviceOptions: deviceOptions,
            currentInstitution: currentInst
        });
    } catch (e) {
        console.error("GET Error:", e.message);
        res.status(500).json({ error: 'خطأ في الاتصال بقاعدة البيانات' });
    }
});

app.post('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    try {
        const db = await getDB();
        const recordsCollection = db.collection('records');

        const newRecord = {
            _id: Date.now(),
            national_id: String(req.body.national_id || ''),
            patient_name: String(req.body.patient_name || ''),
            mother_name: String(req.body.mother_name || ''),
            birth_year: String(req.body.birth_year || ''),
            device_details: String(req.body.device_details || ''),
            serial_number: String(req.body.serial_number || ''),
            date: new Date().toISOString(),
            institution_id: code,
            institution_name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب'
        };

        await recordsCollection.insertOne(newRecord);
        res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح في السحاب', record: { ...newRecord, id: newRecord._id } });
    } catch (e) {
        console.error("POST Error:", e.message);
        res.status(500).json({ success: false, error: 'خطأ أثناء الحفظ في قاعدة البيانات: ' + e.message });
    }
});

app.put('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    const updates = req.body;
    try {
        const db = await getDB();
        const recordsCollection = db.collection('records');
        await recordsCollection.updateOne({ _id: recordId }, { $set: updates });
        res.json({ success: true, message: 'تم التعديل بنجاح' });
    } catch (e) {
        res.status(500).json({ success: false, error: 'خطأ أثناء التعديل' });
    }
});

app.delete('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    try {
        const db = await getDB();
        const recordsCollection = db.collection('records');
        await recordsCollection.deleteOne({ _id: recordId });
        res.json({ success: true, message: 'تم الحذف بنجاح' });
    } catch (e) {
        res.status(500).json({ success: false, error: 'خطأ أثناء الحذف' });
    }
});

app.get('/api/check-patient/:id', async (req, res) => {
    const natId = req.params.id;
    try {
        const db = await getDB();
        const recordsCollection = db.collection('records');
        const existing = await recordsCollection.findOne({ national_id: natId });
        if (existing) {
            res.json({
                received: true,
                message: `المريض مستلم مسبقاً! تم صرف سماعة (${existing.device_details}) بتاريخ ${existing.date ? existing.date.split('T')[0] : ''}`
            });
        } else {
            res.json({ received: false, message: 'المريض غير مسجل مسبقاً ويمكنه الاستلام.' });
        }
    } catch (e) {
        res.json({ received: false, message: 'المريض غير مسجل مسبقاً.' });
    }
});

app.post('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    try {
        const db = await getDB();
        const deviceOptionsCollection = db.collection('deviceOptions');
        if (deviceName) {
            const existing = await deviceOptionsCollection.findOne({ name: deviceName });
            if (!existing) {
                await deviceOptionsCollection.insertOne({ name: deviceName });
            }
        }
        const devicesCursor = await deviceOptionsCollection.find({}).toArray();
        res.json({ success: true, deviceOptions: devicesCursor.map(d => d.name) });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    try {
        const db = await getDB();
        const deviceOptionsCollection = db.collection('deviceOptions');
        await deviceOptionsCollection.deleteOne({ name: deviceName });
        const devicesCursor = await deviceOptionsCollection.find({}).toArray();
        res.json({ success: true, deviceOptions: devicesCursor.map(d => d.name) });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
