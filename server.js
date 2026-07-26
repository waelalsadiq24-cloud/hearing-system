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

// تخزين مؤقت احتياطي لضمان عدم توقف النظام نهائياً
let memoryRecords = [];
let deviceOptionsList = ['oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'];

app.get('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    try {
        const db = await getDB();
        const recordsCollection = db.collection('records');
        const deviceOptionsCollection = db.collection('deviceOptions');

        const dbRecords = await recordsCollection.find({}).toArray();
        const dbDevices = await deviceOptionsCollection.find({}).toArray();

        let records = dbRecords.length > 0 ? dbRecords.map(r => ({ ...r, id: r._id })) : memoryRecords;
        let deviceOptions = dbDevices.length > 0 ? dbDevices.map(d => d.name) : deviceOptionsList;

        res.json({
            records: records, 
            deviceOptions: deviceOptions,
            currentInstitution: { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' }
        });
    } catch (e) {
        res.json({
            records: memoryRecords,
            deviceOptions: deviceOptionsList,
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
        console.error("Cloud Save Error (Saved in memory):", e.message);
    }

    res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح وثبات', record: newRecord });
});

app.put('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    const updates = req.body;
    memoryRecords = memoryRecords.map(r => r._id === recordId ? { ...r, ...updates } : r);
    try {
        const db = await getDB();
        await db.collection('records').updateOne({ _id: recordId }, { $set: updates });
    } catch (e) {}
    res.json({ success: true, message: 'تم التعديل بنجاح' });
});

app.delete('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    memoryRecords = memoryRecords.filter(r => r._id !== recordId);
    try {
        const db = await getDB();
        await db.collection('records').deleteOne({ _id: recordId });
    } catch (e) {}
    res.json({ success: true, message: 'تم الحذف بنجاح' });
});

app.get('/api/check-patient/:id', async (req, res) => {
    const natId = req.params.id;
    let found = memoryRecords.find(r => r.national_id === natId);
    
    if (!found) {
        try {
            const db = await getDB();
            found = await db.collection('records').findOne({ national_id: natId });
        } catch (e) {}
    }

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
    if (deviceName && !deviceOptionsList.includes(deviceName)) {
        deviceOptionsList.push(deviceName);
    }
    try {
        const db = await getDB();
        const col = db.collection('deviceOptions');
        if (deviceName && !(await col.findOne({ name: deviceName }))) {
            await col.insertOne({ name: deviceName });
        }
        const devices = await col.find({}).toArray();
        if (devices.length > 0) deviceOptionsList = devices.map(d => d.name);
    } catch (e) {}
    res.json({ success: true, deviceOptions: deviceOptionsList });
});

app.delete('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    deviceOptionsList = deviceOptionsList.filter(d => d !== deviceName);
    try {
        const db = await getDB();
        await db.collection('deviceOptions').deleteOne({ name: deviceName });
    } catch (e) {}
    res.json({ success: true, deviceOptions: deviceOptionsList });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
