const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// إعدادات استقبال البيانات بحجم كبير لملفات الـ CSV والـ JSON الضخمة
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// تقديم الملفات الثابتة من المجلد الحالي
app.use(express.static(path.join(__dirname)));

// مسار ملف قاعدة البيانات المحلية
const dbFilePath = path.join(__dirname, 'database.json');

// دالة مساعدة لقراءة البيانات
function readDatabase() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const data = fs.readFileSync(dbFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading database:', err);
  }
  return [];
}

// دالة مساعدة لحفظ البيانات
function saveDatabase(data) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving database:', err);
    return false;
  }
}

// دالة لتحويل كود المؤسسة إلى اسمها العربي الرسمي
function getInstitutionFullName(code) {
  if (code === 'medcity' || code === 'tibb') {
    return 'مدينة الطب';
  }
  return 'مستشفى اليرموك';
}

// مسار رئيسي لتشغيل الواجهة
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// مسار استرجاع وجلب السجلات مع وضع اسم المؤسسة تلقائياً
app.get('/api/records', (req, res) => {
  try {
    const code = req.query.code || 'yarmok';
    const institutionName = getInstitutionFullName(code);
    
    let records = readDatabase();
    
    // التأكد من أن كل سجل يمتلك اسم المؤسسة الصحيح
    records = records.map(record => ({
      ...record,
      institution_name: record.institution_name || institutionName
    }));

    res.json({ success: true, records: records });
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({ success: false, records: [] });
  }
});

// مسار إضافة سجل مفرد
app.post('/api/records', (req, res) => {
  try {
    const code = req.query.code || 'yarmok';
    const newRecord = req.body;
    newRecord.institution_name = getInstitutionFullName(code);

    let currentRecords = readDatabase();
    currentRecords.unshift(newRecord);
    saveDatabase(currentRecords);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// مسار استقبال واستيراد دفعات الـ CSV مع ربطها باسم المؤسسة
app.post('/api/import-chunk-safe', (req, res) => {
  try {
    const code = req.query.code || 'yarmok';
    const institutionName = getInstitutionFullName(code);
    const incomingBody = req.body;
    let incomingRecords = [];
    
    if (Array.isArray(incomingBody)) {
      incomingRecords = incomingBody;
    } else if (incomingBody && Array.isArray(incomingBody.records)) {
      incomingRecords = incomingBody.records;
    }

    // تعيين اسم المؤسسة لكل السجلات المستوردة
    incomingRecords = incomingRecords.map(record => ({
      ...record,
      institution_name: institutionName
    }));

    let currentRecords = readDatabase();
    if (incomingRecords.length > 0) {
      currentRecords = currentRecords.concat(incomingRecords);
      saveDatabase(currentRecords);
    }
    
    res.json({ 
      success: true, 
      message: 'Chunk imported and saved successfully',
      receivedCount: incomingRecords.length 
    });
  } catch (error) {
    console.error('Error handling import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// مسار تفريغ / مسح السجلات
app.post('/api/clear-records', (req, res) => {
  try {
    saveDatabase([]); // تفريغ الملف
    res.json({ success: true, message: 'Records cleared successfully' });
  } catch (error) {
    console.error('Error clearing records:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// مسار تجريبي لفحص حالة الخادم
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running successfully', timestamp: new Date() });
});

// تحديد المنفذ الخاص بالسحابة أو المنفذ المحلي الافتراضي
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running smoothly on port ${PORT}`);
});
