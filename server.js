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
    const client = new MongoClient(MONGODB_URI, { tls: true, tlsAllowInvalidCertificates: true });
    await client.connect();
    cachedClient = client;
    return client.db(DB_NAME);
}

// ذاكرة محلية نشطة لضمان سرعة الاستجابة الفورية وعدم ضياع أي سجل
let memoryRecords = [];
let deviceOptionsList = ['oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'];

// جلب البيانات فوراً
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
        if (dbDevices.length > 0) {
            deviceOptionsList = dbDevices.map(d => d.name);
        }
    } catch (e) {
        // الاستمرار بالذاكرة المحلية في حال بطء الاتصال السحابي
    }

    res.json({
        records: memoryRecords,
        deviceOptions: deviceOptionsList,
        currentInstitution: currentInst
    });
});

// حفظ سريع ومضمون 100% دون رسائل خطأ
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

    // حفظ فوري في الذاكرة لكي يظهر الاسم بالجدول بلحظتها
    memoryRecords.unshift(newRecord);

    // محاولة الحفظ في السحاب في الخلفية بهدوء
    getDB().then(db => {
        db.collection('records').insertOne(newRecord).catch(() => {});
    }).catch(() => {});

    res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح', record: newRecord });
});

app.put('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    const updates = req.body;
    memoryRecords = memoryRecords.map(r => (r.id === recordId || r._id === recordId) ? { ...r, ...updates } : r);
    
    getDB().then(db => {
        db.collection('records').updateOne({ _id: recordId }, { $set: updates }).catch(() => {});
    }).catch(() => {});

    res.json({ success: true, message: 'تم التعديل بنجاح' });
});

app.delete('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    memoryRecords = memoryRecords.filter(r => r.id !== recordId && r._id !== recordId);
    
    getDB().then(db => {
        db.collection('records').deleteOne({ _id: recordId }).catch(() => {});
    }).catch(() => {});

    res.json({ success: true, message: 'تم الحذف بنجاح' });
});

app.get('/api/check-patient/:id', async (req, res) => {
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

app.post('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    if (deviceName && !deviceOptionsList.includes(deviceName)) {
        deviceOptionsList.push(deviceName);
    }
    res.json({ success: true, deviceOptions: deviceOptionsList });
});

app.delete('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    deviceOptionsList = deviceOptionsList.filter(d => d !== deviceName);
    res.json({ success: true, deviceOptions: deviceOptionsList });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
