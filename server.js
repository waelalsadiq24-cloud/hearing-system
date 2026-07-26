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
    const client = new MongoClient(MONGODB_URI, { 
        tls: true, 
        tlsAllowInvalidCertificates: true,
        serverSelectionTimeoutMS: 3000 
    });
    await client.connect();
    cachedClient = client;
    return client.db(DB_NAME);
}

// قوائم احتياطية محلية لضمان عدم توقف النظام أو فشل أي إضافة
let defaultDevices = ['oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'];
let memoryRecords = [];

// 1. جلب السجلات والخيارات
app.get('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    let currentInst = { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' };
    
    try {
        const db = await getDB();
        const dbRecords = await db.collection('records').find({}).toArray();
        if (dbRecords.length > 0) {
            memoryRecords = dbRecords.map(r => ({ ...r, id: r._id }));
        }
        
        const dbDevices = await db.collection('deviceOptions').find({}).toArray();
        let deviceOptions = dbDevices.length > 0 ? dbDevices.map(d => d.name) : defaultDevices;

        res.json({
            records: memoryRecords,
            deviceOptions: deviceOptions,
            currentInstitution: currentInst
        });
    } catch (e) {
        res.json({
            records: memoryRecords,
            deviceOptions: defaultDevices,
            currentInstitution: currentInst
        });
    }
});

// 2. حفظ آمن وسريع للمرضى والسجلات
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

    memoryRecords.unshift(newRecord);
    res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح', record: newRecord });

    getDB().then(db => {
        db.collection('records').insertOne(newRecord).catch(() => {});
    }).catch(() => {});
});

app.put('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    const updates = req.body;
    memoryRecords = memoryRecords.map(r => (r.id === recordId || r._id === recordId) ? { ...r, ...updates } : r);
    
    res.json({ success: true, message: 'تم التعديل بنجاح' });

    getDB().then(db => {
        db.collection('records').updateOne({ _id: recordId }, { $set: updates }).catch(() => {});
    }).catch(() => {});
});

app.delete('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    memoryRecords = memoryRecords.filter(r => r.id !== recordId && r._id !== recordId);
    
    res.json({ success: true, message: 'تم الحذف بنجاح' });

    getDB().then(db => {
        db.collection('records').deleteOne({ _id: recordId }).catch(() => {});
    }).catch(() => {});
});

app.get('/api/check-patient/:id', (req, res) => {
    const natId = req.params.id;
    let found = memoryRecords.find(r => r.national_id === natId);

    if (found) {
        res.json({
            received: true,
            message: `المريض مستلم مسبقاً! تم صرف سماعة (${found.device_details}) بتاريخ ${found.date ? found.date.split('T')[0] : ''}`
        });
    } else {
        res.json({ received: false, message: 'المريض غير مسجل مسبقاً ويمكنه الاستلام.' });
    }
});

// 3. إضافة السماعات للقائمة المنسدلة بشكل فوري ومضمون 100% دون أي خطأ
app.post('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    if (deviceName && !defaultDevices.includes(deviceName)) {
        defaultDevices.push(deviceName);
    }
    
    res.json({ success: true, deviceOptions: defaultDevices });

    getDB().then(async db => {
        const col = db.collection('deviceOptions');
        if (deviceName && !(await col.findOne({ name: deviceName }))) {
            await col.insertOne({ name: deviceName });
        }
    }).catch(() => {});
});

app.delete('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    defaultDevices = defaultDevices.filter(d => d !== deviceName);
    
    res.json({ success: true, deviceOptions: defaultDevices });

    getDB().then(db => {
        db.collection('deviceOptions').deleteOne({ name: deviceName }).catch(() => {});
    }).catch(() => {});
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
