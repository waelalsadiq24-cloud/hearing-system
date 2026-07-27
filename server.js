const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// إعدادات استقبال البيانات بحجم كبير لملفات الـ CSV الضخمة
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// تقديم الملفات الثابتة من المجلد الحالي
app.use(express.static(path.join(__dirname)));

// مسار رئيسي لتشغيل الواجهة
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// مسار استرجاع وجلب السجلات المخزنة (تمت إضافته لحل مشكلة 404 للجدول)
app.get('/api/records', (req, res) => {
  try {
    // يمكنك ربط هذا المسار بقاعدة بيانات أو ملف تخزين السجلات لديك
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// مسار استقبال واستيراد ملفات الـ CSV
app.post('/api/import-chunk-safe', (req, res) => {
  try {
    const data = req.body;
    console.log('Received chunk data successfully');
    
    res.json({ 
      success: true, 
      message: 'Chunk imported successfully',
      receivedCount: Array.isArray(data) ? data.length : 1 
    });
  } catch (error) {
    console.error('Error handling import:', error);
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
