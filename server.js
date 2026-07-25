const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// دالة مساعدة لقراءة قاعدة البيانات
function readDatabase() {
    try {
        if (!fs.existsSync('./database.json')) {
            const initialData = {
                institutions: [
                    { id: 'yarmok', name: 'مستشفى اليرموك' },
                    { id: 'medicity', name: 'مدينة الطب' }
                ],
                records: [],
                deviceOptions: ['oticon xceed3 up', 'Phonak Naida', 'Signia Silk']
            };
            fs.writeFileSync('./database.json', JSON.stringify(initialData, null, 2));
        }
        return JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    } catch (e) {
        console.error('Error reading database:', e);
        return { institutions: [], records: [], deviceOptions: [] };
    }
}

// دالة مساعدة لحفظ قاعدة البيانات
function writeDatabase(data) {
    fs.writeFileSync('./database.json', JSON.stringify(data, null, 2));
}

// جلب السجلات والخيارات بناءً على كود المؤسسة
app.get('/api/records', (req, res) => {
    const code = req.query.code || 'yarmok';
    const db = readDatabase();
    
    let currentInst = db.institutions.find(i => i.id === code);
    if (!currentInst) {
        currentInst = { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' };
    }

    res.json({
        records: db.records || [],
        deviceOptions: db.deviceOptions || [],
        currentInstitution: currentInst
    });
});

// إضافة سجل جديد (صرف سماعة)
app.post('/api/records', (req, res) => {
    const code = req.query.code || 'yarmok';
    const db = readDatabase();

    let currentInst = db.institutions.find(i => i.id === code);
    if (!currentInst) {
        currentInst = { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' };
    }

    const newRecord = {
        id: Date.now(),
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

    if (!db.records) db.records = [];
    db.records.push(newRecord);
    writeDatabase(db);

    res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح', record: newRecord });
});

// تعديل السجل مباشرة عند النقر المزدوج والضغط على Enter (محدث ومباشر بدون قيود)
app.put('/api/records/:id', (req, res) => {
    const recordId = req.params.id;
    const updates = req.body;
    
    const db = readDatabase();
    if (!db.records) db.records = [];

    let record = db.records.find(r => r.id == recordId);
    
    if (!record) {
        return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }

    // تحديث الحقول المرسلة فوراً
    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            record[key] = updates[key];
        }
    });

    writeDatabase(db);
    res.json({ success: true, message: 'تم تعديل السجل وحفظه بنجاح' });
});

// حذف سجل
app.delete('/api/records/:id', (req, res) => {
    const recordId = req.params.id;
    const db = readDatabase();
    
    if (!db.records) db.records = [];
    const index = db.records.findIndex(r => r.id == recordId);
    
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }

    db.records.splice(index, 1);
    writeDatabase(db);
    res.json({ success: true, message: 'تم الحذف بنجاح' });
});

// فحص الاستحقاق بالرقم الوطني
app.get('/api/check-patient/:id', (req, res) => {
    const natId = req.params.id;
    const db = readDatabase();
    
    const records = db.records || [];
    const existing = records.find(r => r.national_id === natId);

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
});

// إضافة خيار سماعة جديد
app.post('/api/devices-options', (req, res) => {
    const deviceName = req.body.device;
    if (!deviceName) return res.status(400).json({ success: false, error: 'اسم السماعة مطلوب' });

    const db = readDatabase();
    if (!db.deviceOptions) db.deviceOptions = [];

    if (!db.deviceOptions.includes(deviceName)) {
        db.deviceOptions.push(deviceName);
        writeDatabase(db);
    }
    res.json({ success: true, deviceOptions: db.deviceOptions });
});

// حذف خيار سماعة
app.delete('/api/devices-options', (req, res) => {
    const deviceName = req.body.device;
    const db = readDatabase();
    
    if (!db.deviceOptions) db.deviceOptions = [];
    db.deviceOptions = db.deviceOptions.filter(d => d !== deviceName);
    writeDatabase(db);
    
    res.json({ success: true, deviceOptions: db.deviceOptions });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
