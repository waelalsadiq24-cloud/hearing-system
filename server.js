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

// مسار رئيسي لتشغيل الواجهة
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// مسار استرجاع وجلب السجلات (موافق تماماً لتوقعات الواجهة { records: [...] })
app.get('/api/records', (req, res) => {
  try {
    const records = readDatabase();
    res.json({ success: true, records: records });
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({ success: false, records: [] });
  }
});

// مسار إضافة سجل مفرد (من زر صرف سماعة جديدة)
app.post('/api/records', (req, res) => {
  try {
    const newRecord = req.body;
    let currentRecords = readDatabase();
    currentRecords.unshift(newRecord); // إضافة السجل الجديد في المقدمة
    saveDatabase(currentRecords);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// مسار استقبال واستيراد دفعات الـ CSV
app.post('/api/import-chunk-safe', (req, res) => {
  try {
    const incomingBody = req.body;
    let incomingRecords = [];
    
    // دعم الاستقبال سواء أرسلت الواجهة مباشرة أو داخل كائن records
    if (Array.isArray(incomingBody)) {
      incomingRecords = incomingBody;
    } else if (incomingBody && Array.isArray(incomingBody.records)) {
      incomingRecords = incomingBody.records;
    }

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
