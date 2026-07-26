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
    const client = new MongoClient(MONGODB_URI, { tls: true, tlsAllowInvalidCertificates: true, serverSelectionTimeoutMS: 3000 });
    await client.connect();
    cachedClient = client;
    return client.db(DB_NAME);
}

// ذاكرة محلية سريعة جداً للاستجابة الفورية للمستخدم
let memoryRecords = [];
let deviceOptionsList = ['oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'];
let isLoadedFromCloud = false;

// جلب البيانات أول مرة فقط من السحاب وتخزينها محلياً لسرعة فائقة
async function syncFromCloud() {
    try {
        const db = await getDB();
        const dbRecords = await db.collection('records').find({}).toArray();
        if (dbRecords.length > 0) {
            memoryRecords = dbRecords.map(r => ({ ...r, id: r._id }));
        }
        const dbDevices = await db.collection('deviceOptions').find({}).toArray();
        if (dbDevices.length > 0) {
            deviceOptionsList = dbDevices.map(d => d.name);
        }
        isLoadedFromCloud = true;
    } catch (e) {}
}
syncFromCloud();

// جلب السجلات فوراً من الذاكرة المحلية (بدون أي انتظار للسيرفر)
app.get('/api/records', (req, res) => {
    const code = req.query.code || 'yarmok';
    let currentInst = { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' };
    
    res.json({
        records: memoryRecords,
        deviceOptions: deviceOptionsList,
        currentInstitution: currentInst
    });
});

// حفظ فوري بالذاكرة والظهور بلحظتها، والمزامنة بالسحاب في الخلفية بصمت
app.post('/api/records', (req, res) => {
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

    // إرسال الرد للمستخدم فوراً (سرعة قصوى)
    res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح', record: newRecord });

    // الحفظ في قاعدة البيانات السحابية في الخلفية دون تعطيل المستخدم
    getDB().then(db => {
        db.collection('records').insertOne(newRecord).catch(() => {});
    }).catch(() => {});
});

app.put('/api/records/:id', (req, res) => {
    const recordId = Number(req.params.id);
    const updates = req.body;
    memoryRecords = memoryRecords.map(r => (r.id === recordId || r._id === recordId) ? { ...r, ...updates } : r);
    
    res.json({ success: true, message: 'تم التعديل بنجاح' });

    getDB().then(db => {
        db.collection('records').updateOne({ _id: recordId }, { $set: updates }).catch(() => {});
    }).catch(() => {});
});

app.delete('/api/records/:id', (req, res) => {
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

app.post('/api/devices-options', (req, res) => {
    const deviceName = req.body.device;
    if (deviceName && !deviceOptionsList.includes(deviceName)) {
        deviceOptionsList.push(deviceName);
    }
    res.json({ success: true, deviceOptions: deviceOptionsList });
});

app.delete('/api/devices-options', (req, res) => {
    const deviceName = req.body.device;
    deviceOptionsList = deviceOptionsList.filter(d => d !== deviceName);
    res.json({ success: true, deviceOptions: deviceOptionsList });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
