const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// استخدام مجلد مؤقت آمن للاستضافة السحابية أو المجلد المحلي
const DATA_DIR = process.env.RENDER ? '/tmp' : __dirname;
const DB_FILE = path.join(DATA_DIR, 'database.json');

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { 
            devices: [], 
            deviceOptions: ['سماعة خلف الأذن BTE', 'سماعة داخل الأذن ITE', 'سماعة مخفية CIC', 'سماعة رقمية متطورة'] 
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(data);
    if (!db.deviceOptions) {
        db.deviceOptions = ['سماعة خلف الأذن BTE', 'سماعة داخل الأذن ITE', 'سماعة مخفية CIC', 'سماعة رقمية متطورة'];
    }
    return db;
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const institutionsDB = {
    'medicity': { id: 'medicity', name: 'مدينة الطب' },
    'yarmok': { id: 'yarmok', name: 'مستشفى اليرموك' }
};

function institutionAuth(req, res, next) {
    const code = req.query.code || req.headers['institution-code'] || 'yarmok';
    req.institution = institutionsDB[code] || institutionsDB['yarmok'];
    next();
}

app.use(institutionAuth);

app.get('/api/records', (req, res) => {
    const db = readDB();
    res.json({
        currentInstitution: req.institution,
        records: db.devices,
        deviceOptions: db.deviceOptions
    });
});

app.post('/api/devices-options', (req, res) => {
    const { device } = req.body;
    if (!device) return res.status(400).json({ error: "اسم السماعة مفقود" });

    const db = readDB();
    if (!db.deviceOptions.includes(device)) {
        db.deviceOptions.push(device);
        writeDB(db);
    }
    res.json({ success: true, deviceOptions: db.deviceOptions });
});

app.delete('/api/devices-options', (req, res) => {
    const { device } = req.body;
    if (!device) return res.status(400).json({ error: "اسم السماعة مفقود" });

    const db = readDB();
    db.deviceOptions = db.deviceOptions.filter(item => item !== device);
    writeDB(db);
    res.json({ success: true, deviceOptions: db.deviceOptions });
});

app.get('/api/check-patient/:nationalId', (req, res) => {
    const nationalId = req.params.nationalId;
    const db = readDB();
    const existingRecord = db.devices.find(item => item.national_id === nationalId);

    if (!existingRecord) {
        return res.json({ received: false, message: "المريض لم يستلم أي سماعة مسبقاً، متاح للصرف." });
    }

    if (existingRecord.institution_id === req.institution.id) {
        return res.json({
            received: true,
            isSameInstitution: true,
            data: existingRecord,
            message: `المريض استلم سماعة مسبقاً من مؤسستكم (${existingRecord.institution_name}) بتاريخ ${existingRecord.date}`
        });
    } else {
        return res.json({
            received: true,
            isSameInstitution: false,
            message: `عذراً، المريض استلم سماعة مسبقاً من مؤسسة أخرى (${existingRecord.institution_name}) ولا يمكن صرف سماعة أخرى له.`
        });
    }
});

app.post('/api/records', (req, res) => {
    const { national_id, patient_name, mother_name, birth_day, birth_month, birth_year, device_details, serial_number } = req.body;

    if (!national_id) {
        return res.status(400).json({ error: "الرقم الوطني مفقود." });
    }

    const db = readDB();
    const alreadyReceived = db.devices.find(item => item.national_id === national_id);
    if (alreadyReceived) {
        return res.status(400).json({ error: `فشل الصرف: المريض مسجل بأنه استلم سماعة مسبقاً من (${alreadyReceived.institution_name}).` });
    }

    if (device_details && !db.deviceOptions.includes(device_details)) {
        db.deviceOptions.push(device_details);
    }

    const birth_date_formatted = (birth_day && birth_month && birth_year) 
        ? `${birth_day}/${birth_month}/${birth_year}` 
        : (birth_year || '-');

    const newRecord = {
        id: Date.now(),
        national_id,
        patient_name: patient_name || "غير محدد",
        mother_name: mother_name || "-",
        birth_year: birth_date_formatted,
        device_details: device_details || "غير محدد",
        serial_number: serial_number || "-",
        institution_id: req.institution.id,       
        institution_name: req.institution.name, 
        date: new Date().toISOString().split('T')[0]
    };

    db.devices.push(newRecord);
    writeDB(db);

    res.json({ success: true, message: `تم تسجيل الصرف بنجاح لصالح ${req.institution.name}`, data: newRecord });
});

app.put('/api/records/:id', (req, res) => {
    const recordId = Number(req.params.id);
    const db = readDB();
    const index = db.devices.findIndex(item => item.id === recordId);

    if (index === -1) {
        return res.status(404).json({ success: false, error: "السجل غير موجود" });
    }

    if (db.devices[index].institution_id !== req.institution.id) {
        return res.status(403).json({ success: false, error: "عذراً، لا يمكنك تعديل سجل يتبع لمؤسسة أخرى." });
    }

    const { patient_name, mother_name, national_id, birth_year, device_details, serial_number, date } = req.body;
    
    db.devices[index].patient_name = patient_name !== undefined ? patient_name : db.devices[index].patient_name;
    db.devices[index].mother_name = mother_name !== undefined ? mother_name : db.devices[index].mother_name;
    db.devices[index].national_id = national_id !== undefined ? national_id : db.devices[index].national_id;
    db.devices[index].birth_year = birth_year !== undefined ? birth_year : db.devices[index].birth_year;
    
    if (device_details !== undefined) {
        db.devices[index].device_details = device_details;
        if (device_details && !db.deviceOptions.includes(device_details)) {
            db.deviceOptions.push(device_details);
        }
    }

    db.devices[index].serial_number = serial_number !== undefined ? serial_number : db.devices[index].serial_number;
    db.devices[index].date = date !== undefined ? date : db.devices[index].date;

    writeDB(db);
    res.json({ success: true, message: "تم تحديث السجل بنجاح" });
});

app.delete('/api/records/:id', (req, res) => {
    const recordId = Number(req.params.id);
    const db = readDB();
    
    const index = db.devices.findIndex(item => item.id === recordId);
    if (index === -1) {
        return res.status(404).json({ success: false, error: "السجل غير موجود" });
    }

    if (db.devices[index].institution_id !== req.institution.id) {
        return res.status(403).json({ success: false, error: "عذراً، لا يمكنك حذف سجل يتبع لمؤسسة أخرى." });
    }

    db.devices.splice(index, 1);
    writeDB(db);

    res.json({ success: true, message: "تم حذف السجل بنجاح" });
});

// ضبط المنفذ ليتوافق مع منصة Render أوتوماتيكياً
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});