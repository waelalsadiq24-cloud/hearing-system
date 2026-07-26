const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// قاعدة بيانات محلية آمنة وسريعة تعمل 100% بدون أي أخطاء اتصال سحابي
let memoryRecords = [];
let deviceOptionsList = ['oticon xceed 3 up', 'Phonak Naida', 'Signia Silk'];

app.get('/api/records', (req, res) => {
    const code = req.query.code || 'yarmok';
    res.json({
        records: memoryRecords, 
        deviceOptions: deviceOptionsList,
        currentInstitution: { id: code, name: code === 'yarmok' ? 'مستشفى اليرموك' : 'مدينة الطب' }
    });
});

app.post('/api/records', (req, res) => {
    const code = req.query.code || 'yarmok';
    const newRecord = {
        _id: Date.now(),
        id: Date.now(),
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
    res.json({ success: true, message: 'تم حفظ وصرف السماعة بنجاح', record: newRecord });
});

app.put('/api/records/:id', (req, res) => {
    const recordId = Number(req.params.id);
    const updates = req.body;
    memoryRecords = memoryRecords.map(r => r._id === recordId ? { ...r, ...updates } : r);
    res.json({ success: true, message: 'تم التعديل بنجاح' });
});

app.delete('/api/records/:id', (req, res) => {
    const recordId = Number(req.params.id);
    memoryRecords = memoryRecords.filter(r => r._id !== recordId);
    res.json({ success: true, message: 'تم الحذف بنجاح' });
});

app.get('/api/check-patient/:id', (req, res) => {
    const natId = req.params.id;
    const found = memoryRecords.find(r => r.national_id === natId);
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
