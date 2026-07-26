const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(__dirname));

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);
let dbConnection = null;

async function getDB() {
    if (!dbConnection) {
        await client.connect();
        dbConnection = client.db('hearing_system');
    }
    return dbConnection;
}

let memoryRecords = [];

const institutions = {
    'yarmok': { id: 'yarmok', name: 'مستشفى اليرموك' },
    'tibb': { id: 'tibb', name: 'مدينة الطب' }
};

app.get('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const currentInst = institutions[code] || institutions['yarmok'];

    let allRecords = [...memoryRecords];
    try {
        const db = await getDB();
        const dbRecords = await db.collection('records').find({}).sort({ date: -1 }).toArray();
        if (dbRecords && dbRecords.length > 0) {
            allRecords = dbRecords;
        }
    } catch (e) {}

    try {
        const db = await getDB();
        let devices = await db.collection('devices').findOne({ code: code });
        let deviceOptions = devices ? devices.options : ['oticon xceed 3 up', 'oticon get', 'oticon ria2 105', 'oticon ria2 85', 'oticon kit 75', 'Signia Silk', 'Interton BTE Gan290'];

        res.json({
            records: allRecords,
            deviceOptions: deviceOptions,
            currentInstitution: currentInst
        });
    } catch (e) {
        res.json({ records: allRecords, deviceOptions: ['oticon xceed 3 up'], currentInstitution: currentInst });
    }
});

app.post('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const currentInst = institutions[code] || institutions['yarmok'];
    const body = req.body;

    const newRecord = {
        national_id: String(body.national_id || 'غير متوفر'),
        patient_name: String(body.patient_name || 'غير معروف'),
        mother_name: String(body.mother_name || '-'),
        birth_year: String(body.birth_year || '-'),
        is_student: String(body.is_student || 'yes'),
        device_details: String(body.device_details || 'oticon xceed 3 up'),
        serial_number: String(body.serial_number || '0000'),
        date: new Date().toISOString(),
        institution_id: code,
        institution_name: currentInst.name
    };

    memoryRecords.unshift(newRecord);
    try {
        const db = await getDB();
        await db.collection('records').insertOne(newRecord);
    } catch (e) {}

    res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح' });
});

app.get('/api/check-patient/:id', async (req, res) => {
    const nationalId = req.params.id;
    try {
        const db = await getDB();
        const record = await db.collection('records').findOne({ national_id: nationalId }, { sort: { date: -1 } });
        if (record) {
            return res.json({ found: true, record: record });
        }
    } catch (e) {}
    
    const memRecord = memoryRecords.find(r => r.national_id === nationalId);
    if (memRecord) {
        res.json({ found: true, record: memRecord });
    } else {
        res.json({ found: false });
    }
});

// مسار الاستيراد المضمون الذي يحفظ في الذاكرة وقاعدة البيانات معاً
app.post('/api/import-csv', async (req, res) => {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
        return res.json({ success: false, error: 'بيانات غير صالحة' });
    }

    const code = req.query.code || 'yarmok';
    const currentInst = institutions[code] || institutions['yarmok'];

    let formattedRecords = records.map(r => ({
        national_id: String(r.national_id || 'غير متوفر'),
        patient_name: String(r.patient_name || r.name || 'غير معروف'),
        mother_name: String(r.mother_name || '-'),
        birth_year: String(r.birth_year || '-'),
        is_student: 'yes',
        device_details: String(r.device_details || 'oticon xceed 3 up'),
        serial_number: String(r.serial_number || '0000'),
        date: r.date || new Date().toISOString(),
        institution_id: code,
        institution_name: currentInst.name
    }));

    // إضافة السجلات مباشرة لمقدمة المصفوفة المحلية لضمان ظهورها الفوري
    memoryRecords.unshift(...formattedRecords);

    try {
        const db = await getDB();
        await db.collection('records').insertMany(formattedRecords);
    } catch (e) {}

    res.json({ success: true, count: formattedRecords.length });
});

async function handleClearRecords(req, res) {
    const code = req.query.code || 'yarmok';
    memoryRecords = memoryRecords.filter(r => r.institution_id !== code);
    try {
        const db = await getDB();
        await db.collection('records').deleteMany({ institution_id: code });
    } catch (e) {}
    res.json({ success: true, message: 'تم حذف كافة السجلات بنجاح' });
}

app.delete('/api/clear-records', handleClearRecords);
app.post('/api/clear-records', handleClearRecords);

async function handleSafeDelete(req, res) {
    const national_id = req.body.national_id || req.query.national_id;
    memoryRecords = memoryRecords.filter(r => String(r.national_id) !== String(national_id));
    try {
        const db = await getDB();
        await db.collection('records').deleteMany({ national_id: String(national_id) });
    } catch (e) {}
    res.json({ success: true });
}

app.delete('/api/records-safe-delete', handleSafeDelete);
app.post('/api/records-safe-delete', handleSafeDelete);

app.post('/api/devices-options', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const { device } = req.body;
    if (!device) return res.status(400).json({ success: false });

    try {
        const db = await getDB();
        let doc = await db.collection('devices').findOne({ code: code });
        let options = doc ? doc.options : ['oticon xceed 3 up', 'oticon get', 'oticon ria2 105'];
        if (!options.includes(device)) {
            options.push(device);
            await db.collection('devices').updateOne({ code: code }, { $set: { options: options } }, { upsert: true });
        }
        res.json({ success: true, options });
    } catch (e) {
        res.json({ success: true });
    }
});

app.delete('/api/devices-options', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const { device } = req.body;
    try {
        const db = await getDB();
        let doc = await db.collection('devices').findOne({ code: code });
        if (doc && doc.options) {
            let options = doc.options.filter(d => d !== device);
            await db.collection('devices').updateOne({ code: code }, { $set: { options: options } });
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: true });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
