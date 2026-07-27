const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
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

app.get('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const currentInst = institutions[code] || institutions['yarmok'];

    try {
        const db = await getDB();
        const records = await db.collection('records')
            .find({ institution_id: code })
            .sort({ _id: -1 })
            .toArray();

        const formattedRecords = records.map(r => ({
            ...r,
            _id: r._id.toString()
        }));

        res.json({ records: formattedRecords, currentInstitution: currentInst });
    } catch (e) {
        res.json({ records: [] });
    }
});

app.post('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const currentInst = institutions[code] || institutions['yarmok'];
    const body = req.body;

    const newRecord = {
        national_id: String(body.national_id || '-'),
        patient_name: String(body.patient_name || 'غير معروف'),
        mother_name: String(body.mother_name || '-'),
        birth_year: String(body.birth_year || '-'),
        is_student: String(body.is_student || 'yes'),
        device_details: String(body.device_details || 'oticon xceed 3 up'),
        serial_number: String(body.serial_number || '0000'),
        date: String(body.date || new Date().toISOString().split('T')[0]),
        institution_id: code,
        institution_name: currentInst.name
    };

    try {
        const db = await getDB();
        await db.collection('records').insertOne(newRecord);
        res.json({ success: true, message: 'تم الحفظ بنجاح' });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/records/update', async (req, res) => {
    const { id, field, value } = req.body;
    try {
        const db = await getDB();
        if (id && id.length === 24) {
            await db.collection('records').updateOne({ _id: new ObjectId(id) }, { $set: { [field]: value } });
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// المسار الأساسي لاستقبال الدفعات
app.post('/api/import-csv', async (req, res) => {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) return.json({ success: false });

    const code = req.query.code || 'yarmok';
    const currentInst = institutions[code] || institutions['yarmok'];

    let formattedRecords = records.map(r => ({
        national_id: String(r.national_id || '-'),
        patient_name: String(r.patient_name || 'غير معروف'),
        mother_name: String(r.mother_name || '-'),
        birth_year: String(r.birth_year || '-'),
        is_student: 'yes',
        device_details: String(r.device_details || 'oticon xceed 3 up'),
        serial_number: String(r.serial_number || '0000'),
        date: String(r.date || new Date().toISOString().split('T')[0]),
        institution_id: code,
        institution_name: currentInst.name
    }));

    try {
        const db = await getDB();
        if (formattedRecords.length > 0) {
            await db.collection('records').insertMany(formattedRecords, { ordered: false });
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: true });
    }
});

app.post('/api/clear-records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    try {
        const db = await getDB();
        await db.collection('records').deleteMany({ institution_id: code });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: true });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
