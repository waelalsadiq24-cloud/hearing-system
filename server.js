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

// مسار استرجاع وجلب السجلات المخزنة حقيقياً
app.get('/api/records', (req, res) => {
  try {
    const records = readDatabase();
    res.json({ success: true, data: records });
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// مسار استقبال واستيراد ملفات الـ CSV وحفظها بشكل دائم
app.post('/api/import-chunk-safe', (req, res) => {
  try {
    const incomingData = req.body;
    let currentRecords = readDatabase();
    
    // دمج أو استبدال البيانات حسب الحاجة
    if (Array.isArray(incomingData)) {
      currentRecords = currentRecords.concat(incomingData);
    } else if (incomingData) {
      currentRecords.push(incomingData);
    }
    
    saveDatabase(currentRecords);
    
    res.json({ 
      success: true, 
      message: 'Chunk imported and saved successfully',
      receivedCount: Array.isArray(incomingData) ? incomingData.length : 1 
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
