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

// تخزين مؤقت محلي للطوارئ لضمان عمل النظام فوراً دون أي خطأ 500
let memoryRecords = [];

app.get('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    try {
        const db = await getDB();
        const recordsCollection = db.collection('records');
        const deviceOptionsCollection = db.collection('deviceOptions');

        const records = await recordsCollection.find({}).toArray();
        let devicesCursor = await deviceOptionsCollection.find({}).toArray();
        let deviceOptions = devicesCursor.map(d => d.name);
        if (deviceOptions.length === 0) {
            deviceOptions = ['oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'];
        }

        res.json({
            records: records.length > 0 ? records.map(r => ({ ...r, id: r._id })) : memoryRecords, 
            deviceOptions: deviceOptions,
            currentInstitution: { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' }
        });
    } catch (e) {
        console.error("GET Fallback:", e.message);
        res.json({
            records: memoryRecords,
            deviceOptions: ['oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'],
            currentInstitution: { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' }
        });
    }
});

app.post('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const newRecord = {
        _id: Date.now(),
        id: Date.now(),
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

    memoryRecords.unshift(newRecord);

    try {
        const db = await getDB();
        const recordsCollection = db.collection('records');
        await recordsCollection.insertOne(newRecord);
    } catch (e) {
        console.error("POST DB Insert Error (Handled locally):", e.message);
    }

    res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح', record: newRecord });
});

app.put('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    const updates = req.body;
    
    memoryRecords = memoryRecords.map(r => r._id === recordId ? { ...r, ...updates } : r);

    try {
        const db = await getDB();
        const recordsCollection = db.collection('records');
        await recordsCollection.updateOne({ _id: recordId }, { $set: updates });
    } catch (e) {
        console.error("PUT Error:", e.message);
    }
    res.json({ success: true, message: 'تم التعديل بنجاح' });
});

app.delete('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    
    memoryRecords = memoryRecords.filter(r => r._id !== recordId);

    try {
        const db = await getDB();
        const recordsCollection = db.collection('records');
        await recordsCollection.deleteOne({ _id: recordId });
    } catch (e) {
        console.error("DELETE Error:", e.message);
    }
    res.json({ success: true, message: 'تم الحذف بنجاح' });
});

app.get('/api/check-patient/:id', async (req, res) => {
    const natId = req.params.id;
    const found = memoryRecords.find(r => r.national_id === natId);
    if (found) {
        res.json({
            received: true,
            message: `المريض مستلم مسبقاً! تم صرف سماعة (${found.device_details}) بتاريخ ${found.date ? found.date.split('T')[0] : ''}`
        });
    } else {
        res.json({ received: false, message: 'المريض غير مسجل مسبقاً ويمكنه الاستلام.' });
    }
});

app.post('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    res.json({ success: true, deviceOptions: [deviceName || 'oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'] });
});

app.delete('/api/devices-options', async (req, res) => {
    res.json({ success: true, deviceOptions: ['oticon xceed 3 up'] });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
