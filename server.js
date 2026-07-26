const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://waelalsadiq24_db_user:2tbFWqOTp3XcDtA@cluster0.gribvlx.mongodb.net/?retryWrites=true&w=majority";
const DB_NAME = "hearingSystemDB";

let client;

async function getDB() {
    if (!client || !client.topology || !client.topology.isConnected()) {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
    }
    return client.db(DB_NAME);
}

app.get('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    try {
        const database = await getDB();
        const institutionsCollection = database.collection('institutions');
        const recordsCollection = database.collection('records');
        const deviceOptionsCollection = database.collection('deviceOptions');

        let currentInst = await institutionsCollection.findOne({ id: code });
        if (!currentInst) {
            currentInst = { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' };
        }

        const records = await recordsCollection.find({}).toArray();
        const devicesCursor = await deviceOptionsCollection.find({}).toArray();
        const deviceOptions = devicesCursor.map(d => d.name);

        res.json({
            records: records.map(r => ({ ...r, id: r._id })), 
            deviceOptions: deviceOptions,
            currentInstitution: currentInst
        });
    } catch (e) {
        console.error("DETAILED SERVER ERROR:", e);
        res.status(500).json({ error: 'خطأ تفصيلي: ' + e.message });
    }
});

app.post('/api/records', async (req, res) => {
    const code = req.query.code || 'yarmok';
    try {
        const database = await getDB();
        const institutionsCollection = database.collection('institutions');
        const recordsCollection = database.collection('records');

        let currentInst = await institutionsCollection.findOne({ id: code });
        if (!currentInst) {
            currentInst = { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : (code === 'medicity' ? 'مدينة الطب' : code) };
        }

        const newRecord = {
            _id: Date.now(),
            national_id: req.body.national_id,
            patient_name: req.body.patient_name,
            mother_name: req.body.mother_name || '',
            birth_year: req.body.birth_year || '',
            device_details: req.body.device_details,
            serial_number: req.body.serial_number,
            date: new Date().toISOString(),
            institution_id: currentInst.id,
            institution_name: currentInst.name
        };

        await recordsCollection.insertOne(newRecord);
        res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح في السحاب', record: { ...newRecord, id: newRecord._id } });
    } catch (e) {
        console.error("DETAILED SERVER ERROR:", e);
        res.status(500).json({ error: 'خطأ أثناء الحفظ: ' + e.message });
    }
});

app.put('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    const updates = req.body;
    try {
        const database = await getDB();
        const recordsCollection = database.collection('records');
        
        const result = await recordsCollection.updateOne(
            { _id: recordId },
            { $set: updates }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: 'السجل غير موجود' });
        }

        res.json({ success: true, message: 'تم تعديل السجل وحفظه بنجاح' });
    } catch (e) {
        console.error("DETAILED SERVER ERROR:", e);
        res.status(500).json({ error: 'خطأ أثناء التعديل: ' + e.message });
    }
});

app.delete('/api/records/:id', async (req, res) => {
    const recordId = Number(req.params.id);
    try {
        const database = await getDB();
        const recordsCollection = database.collection('records');
        
        const result = await recordsCollection.deleteOne({ _id: recordId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: 'السجل غير موجود' });
        }
        res.json({ success: true, message: 'تم الحذف بنجاح' });
    } catch (e) {
        console.error("DETAILED SERVER ERROR:", e);
        res.status(500).json({ error: 'خطأ أثناء الحذف: ' + e.message });
    }
});

app.get('/api/check-patient/:id', async (req, res) => {
    const natId = req.params.id;
    try {
        const database = await getDB();
        const recordsCollection = database.collection('records');
        
        const existing = await recordsCollection.findOne({ national_id: natId });
        if (existing) {
            res.json({
                received: true,
                message: `المريض مستلم مسبقاً! تم صرف سماعة (${existing.device_details}) بتاريخ ${existing.date ? existing.date.split('T')[0] : ''} عن طريق (${existing.institution_name || 'جهة أخرى'})`
            });
        } else {
            res.json({
                received: false,
                message: 'المريض غير مسجل مسبقاً ويمكنه استلام السماعة الطبية بنجاح.'
            });
        }
    } catch (e) {
        console.error("DETAILED SERVER ERROR:", e);
        res.status(500).json({ error: 'خطأ أثناء فحص المريض: ' + e.message });
    }
});

app.post('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    if (!deviceName) return res.status(400).json({ success: false, error: 'اسم السماعة مطلوب' });

    try {
        const database = await getDB();
        const deviceOptionsCollection = database.collection('deviceOptions');

        const existing = await deviceOptionsCollection.findOne({ name: deviceName });
        if (!existing) {
            await deviceOptionsCollection.insertOne({ name: deviceName });
        }
        const devicesCursor = await deviceOptionsCollection.find({}).toArray();
        res.json({ success: true, deviceOptions: devicesCursor.map(d => d.name) });
    } catch (e) {
        console.error("DETAILED SERVER ERROR:", e);
        res.status(500).json({ error: 'خطأ في إضافة السماعة: ' + e.message });
    }
});

app.delete('/api/devices-options', async (req, res) => {
    const deviceName = req.body.device;
    try {
        const database = await getDB();
        const deviceOptionsCollection = database.collection('deviceOptions');

        await deviceOptionsCollection.deleteOne({ name: deviceName });
        const devicesCursor = await deviceOptionsCollection.find({}).toArray();
        res.json({ success: true, deviceOptions: devicesCursor.map(d => d.name) });
    } catch (e) {
        console.error("DETAILED SERVER ERROR:", e);
        res.status(500).json({ error: 'خطأ في حذف السماعة: ' + e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
