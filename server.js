const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

const institutions = {
    'yarmok': { id: 'yarmok', name: 'مستشفى اليرموك' },
    'medcity': { id: 'medcity', name: 'مدينة الطب' },
    'tibb': { id: 'tibb', name: 'مدينة الطب' }
};

// جلب السجلات من السحابة
app.get('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const currentInst = institutions[code] || institutions['yarmok'];

    try {
        const db = await getDB();
        const records = await db.collection('records')
            .find({ institution_id: code })
            .sort({ date: -1 })
            .toArray();

        const formattedRecords = records.map(r => ({
            ...r,
            _id: r._id.toString()
        }));

        let devices = await db.collection('devices').findOne({ code: code });
        let deviceOptions = devices ? devices.options : ['oticon xceed 3 up', 'oticon get', 'oticon ria2 105', 'oticon ria2 85', 'Signia Silk'];

        res.json({
            records: formattedRecords,
            deviceOptions: deviceOptions,
            currentInstitution: currentInst
        });
    } catch (e) {
        res.json({ records: [], deviceOptions: ['oticon xceed 3 up'], currentInstitution: currentInst });
    }
});

// حفظ سجل فردي جديد
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
        date: body.date || new Date().toISOString(),
        institution_id: code,
        institution_name: currentInst.name
    };

    try {
        const db = await getDB();
        await db.collection('records').insertOne(newRecord);
        res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح في السحابة' });
    } catch (e) {
        res.status(500).json({ success: false, error: 'فشل الحفظ في السحابة' });
    }
});

// تعديل سجل
app.post('/api/records/update', async (req, res) => {
    const { id, field, value, patient_name } = req.body;
    if (!field) return res.status(400).json({ success: false });

    try {
        const db = await getDB();
        let query = {};
        if (id && id.length === 24) {
            try { query = { _id: new ObjectId(id) }; } catch (err) { query = { patient_name: patient_name }; }
        } else {
            query = { patient_name: patient_name };
        }

        await db.collection('records').updateOne(query, { $set: { [field]: value } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// استيراد الدفعات الصغيرة
app.post('/api/import-csv', async (req, res) => {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
        return res.json({ success: false, error: 'بيانات غير صالحة' });
    }

    const code = req.query.code || 'yarmok';
    const currentInst = institutions[code] || institutions['yarmok'];

    let formattedRecords = records.map(r => ({
        national_id: String(r.national_id || 'غير متوفر'),
        patient_name: String(r.patient_name || 'غير معروف'),
        mother_name: String(r.mother_name || '-'),
        birth_year: String(r.birth_year || '-'),
        is_student: 'yes',
        device_details: String(r.device_details || 'oticon xceed 3 up'),
        serial_number: String(r.serial_number || '0000'),
        date: r.date || new Date().toISOString(),
        institution_id: code,
        institution_name: currentInst.name
    }));

    try {
        const db = await getDB();
        await db.collection('records').insertMany(formattedRecords, { ordered: false });
        res.json({ success: true, count: formattedRecords.length });
    } catch (e) {
        res.status(500).json({ success: false, error: 'فشل التخزين' });
    }
});

// حذف السجلات
async function handleClearRecords(req, res) {
    const code = req.query.code || 'yarmok';
    try {
        const db = await getDB();
        await db.collection('records').deleteMany({ institution_id: code });
        res.json({ success: true, message: 'تم الحذف بنجاح' });
    } catch (e) {
        res.status(500).json({ success: false, error: 'فشل الحذف' });
    }
}

app.delete('/api/clear-records', handleClearRecords);
app.post('/api/clear-records', handleClearRecords);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
