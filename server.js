const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://waelalsadiq24_db_user:2tbFWqOTp3XcDtA@cluster0.gribvlx.mongodb.net/?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true";
const DB_NAME = "hearingSystemDB";

let cachedClient = null;
async function getDB() {
    if (cachedClient) return cachedClient.db(DB_NAME);
    const client = new MongoClient(MONGODB_URI, { tls: true, tlsAllowInvalidCertificates: true, serverSelectionTimeoutMS: 5000 });
    await client.connect();
    cachedClient = client;
    return client.db(DB_NAME);
}

let defaultDevices = ['oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'];

// جلب السجلات مباشرة من قاعدة البيانات السحابية لضمان عدم اختفائها أبداً
app.get('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    let currentInst = { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' };
    
    try {
        const db = await getDB();
        const dbRecords = await db.collection('records').find({}).toArray();
        const records = dbRecords.map(r => ({ ...r, id: r._id }));

        const dbDevices = await db.collection('deviceOptions').find({}).toArray();
        const deviceOptions = dbDevices.length > 0 ? dbDevices.map(d => d.name) : defaultDevices;

        res.json({
            records: records,
            deviceOptions: deviceOptions,
            currentInstitution: currentInst
        });
    } catch (e) {
        res.json({
            records: [],
            deviceOptions: defaultDevices,
            currentInstitution: currentInst
        });
    }
});

// حفظ مباشر وثابت في قاعدة البيانات
app.post('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const recordId = Date.now();
    const newRecord = {
        _id: recordId,
        id: recordId,
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

    try {
        const db = await getDB();
        await db.collection('records').insertOne(newRecord);
        res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح وثبات', record: newRecord });
    } catch (e) {
        res.status(500).json({ success: false, error: 'فشل الحفظ في قاعدة البيانات' });
    }
});

app.put('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    const updates = req.body;
    
    try {
        const db = await getDB();
        await db.collection('records').updateOne({ _id: recordId }, { $set: updates });
        res.json({ success: true, message: 'تم التعديل بنجاح' });
    } catch (e) {
        res.status(500).json({ success: false, error: 'فشل التعديل' });
    }
});

app.delete('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    
    try {
        const db = await getDB();
        await db.collection('records').deleteOne({ _id: recordId });
        res.json({ success: true, message: 'تم الحذف بنجاح' });
    } catch (e) {
        res.status(500).json({ success: false, error: 'فشل الحذف' });
    }
});

app.get('/api/check-patient/:id', async (req, res) => {
    const natId = req.params.id;
    try {
        const db = await getDB();
        const found = await db.collection('records').findOne({ national_id: natId });

        if (found) {
            res.json({
                received: true,
                message: `المريض مستلم مسبقاً! تم صرف سماعة (${found.device_details}) بتاريخ ${found.date ? found.date.split('T')[0] : ''}`
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
        const col = db.collection('deviceOptions');
        if (deviceName && !(await col.findOne({ name: deviceName }))) {
            await col.insertOne({ name: deviceName });
        }
        const devices = await col.find({}).toArray();
        let list = devices.length > 0 ? devices.map(d => d.name) : defaultDevices;
        res.json({ success: true, deviceOptions: list });
    } catch (e) {
        res.json({ success: false, deviceOptions: defaultDevices });
    }
});

app.delete('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    try {
        const db = await getDB();
        const col = db.collection('deviceOptions');
        await col.deleteOne({ name: deviceName });
        const devices = await col.find({}).toArray();
        let list = devices.length > 0 ? devices.map(d => d.name) : defaultDevices;
        res.json({ success: true, deviceOptions: list });
    } catch (e) {
        res.json({ success: false, deviceOptions: defaultDevices });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
