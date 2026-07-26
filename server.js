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
        _id: Date.now() + Math.random(),
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

// المسار المعتمد والمستقر لمعالجة ملف الـ CSV عبر السيرفر
app.post('/api/import-csv', async (req, res) => {
    try {
        const { rawData } = req.body;
        if (!rawData) return res.json({ success: false, error: 'الملف فارغ' });

        const lines = rawData.split(/\r\n|\n/);
        let recordsList = [];
        const code = req.query.code || 'yarmok';
        const currentInst = institutions[code] || institutions['yarmok'];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i] ? lines[i].trim() : '';
            if (!line) continue;

            if (i === 0 && (line.includes('الاسم') || line.includes('المريض') || line.includes('الأم') || line.includes('الرقم'))) {
                continue;
            }

            let cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            cols = cols.map(c => (c ? c.replace(/^"|"$/g, '').trim() : ''));

            const patName = cols[0] || '';
            const momName = cols[1] || '-';
            const natId = cols[2] || 'غير متوفر';
            const birth = cols[3] || '-';
            const device = cols[4] || 'oticon xceed 3 up';
            const serial = cols[5] || '0000';

            if (patName && patName !== 'undefined' && patName !== '') {
                recordsList.push({
                    _id: Date.now() + Math.random() * 10000,
                    national_id: natId,
                    patient_name: patName,
                    mother_name: momName,
                    birth_year: birth,
                    is_student: 'yes',
                    device_details: device,
                    serial_number: serial,
                    date: new Date().toISOString(),
                    institution_id: code,
                    institution_name: currentInst.name
                });
            }
        }

        if (recordsList.length > 0) {
            const db = await getDB();
            const collection = db.collection('records');
            memoryRecords.unshift(...recordsList);
            await collection.insertMany(recordsList);
            res.json({ success: true, count: recordsList.length });
        } else {
            res.json({ success: false, error: 'لم يتم العثور على بيانات صالحة' });
        }
    } catch (e) {
        console.error("Import error:", e);
        res.status(500).json({ success: false, error: 'خطأ في معالجة الملف بالسيرفر' });
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

app.put('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id) || req.params.id;
    const updateData = req.body;
    try {
        const db = await getDB();
        await db.collection('records').updateOne({ $or: [{ id: recordId }, { _id: recordId }] }, { $set: updateData });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: true });
    }
});

app.delete('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id) || req.params.id;
    try {
        const db = await getDB();
        await db.collection('records').deleteOne({ $or: [{ id: recordId }, { _id: recordId }] });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: true });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
