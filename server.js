const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

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

    try {
        const db = await getDB();
        const records = await db.collection('records').find({}).sort({ date: -1 }).toArray();
        
        let devices = await db.collection('devices').findOne({ code: code });
        let deviceOptions = devices ? devices.options : ['oticon xceed 3 up', 'oticon get', 'oticon ria2 105', 'oticon ria2 85', 'oticon kit 75', 'Signia Silk', 'Interton BTE Gan290'];

        res.json({
            records: records,
            deviceOptions: deviceOptions,
            currentInstitution: currentInst
        });
    } catch (e) {
        res.json({ records: memoryRecords, deviceOptions: ['oticon xceed 3 up'], currentInstitution: currentInst });
    }
});

app.post('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    const currentInst = institutions[code] || institutions['yarmok'];
    const body = req.body;

    if (!body.national_id || !body.patient_name || !body.device_details || !body.serial_number) {
        return res.status(400).json({ success: false, error: 'يرجى تعبئة الحقول المطلوبة' });
    }

    const newRecord = {
        national_id: body.national_id,
        patient_name: body.patient_name,
        mother_name: body.mother_name || '-',
        birth_year: body.birth_year || '-',
        is_student: body.is_student || 'yes',
        device_details: body.device_details,
        serial_number: body.serial_number,
        date: new Date().toISOString(),
        institution_id: code,
        institution_name: currentInst.name
    };

    try {
        const db = await getDB();
        await db.collection('records').insertOne(newRecord);
        memoryRecords.unshift(newRecord);
        res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح' });
    } catch (e) {
        memoryRecords.unshift(newRecord);
        res.json({ success: true, message: 'تم الحفظ محلياً بنجاح' });
    }
});

app.get('/api/check-patient/:id', async (req, res) => {
    const nationalId = req.params.id;
    try {
        const db = await getDB();
        const record = await db.collection('records').findOne({ national_id: nationalId }, { sort: { date: -1 } });
        if (record) {
            res.json({ found: true, record: record });
        } else {
            res.json({ found: false });
        }
    } catch (e) {
        const record = memoryRecords.find(r => r.national_id === nationalId);
        if (record) {
            res.json({ found: true, record: record });
        } else {
            res.json({ found: false });
        }
    }
});

app.post('/api/import-csv', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.json({ success: false, error: 'لا توجد بيانات صالحة للاستيراد' });
        }

        const code = req.query.code || 'yarmok';
        const currentInst = institutions[code] || institutions['yarmok'];

        let formattedRecords = records.map(r => ({
            national_id: r.national_id || 'غير متوفر',
            patient_name: r.patient_name || 'غير معروف',
            mother_name: r.mother_name || '-',
            birth_year: r.birth_year || '-',
            is_student: 'yes',
            device_details: r.device_details || 'oticon xceed 3 up',
            serial_number: r.serial_number || '0000',
            date: new Date().toISOString(),
            institution_id: code,
            institution_name: currentInst.name
        }));

        const db = await getDB();
        const collection = db.collection('records');
        await collection.insertMany(formattedRecords);
        memoryRecords.unshift(...formattedRecords);

        res.json({ success: true, count: formattedRecords.length });
    } catch (e) {
        console.error("Import error:", e);
        res.status(500).json({ success: false, error: 'خطأ في معالجة السجلات بالسيرفر' });
    }
});

app.delete('/api/clear-records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    try {
        const db = await getDB();
        memoryRecords = memoryRecords.filter(r => r.institution_id !== code);
        await db.collection('records').deleteMany({ institution_id: code });
        res.json({ success: true, message: 'تم حذف كافة السجلات بنجاح' });
    } catch (e) {
        res.status(500).json({ success: false, error: 'فشل حذف السجلات' });
    }
});

// استخدام مسار الحذف الأصلي المدعوم كلياً مع دعم ObjectId والنصوص
app.delete('/api/records/:id', async (req, res) => {
    const recordId = req.params.id;
    try {
        const db = await getDB();
        let query = {};
        if (ObjectId.isValid(recordId)) {
            query = { _id: new ObjectId(recordId) };
        } else {
            query = { _id: recordId };
        }
        
        const result = await db.collection('records').deleteOne(query);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: 'فشل حذف السجل' });
    }
});

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
