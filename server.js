const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// إعدادات استقبال البيانات بحجم كبير لملفات الـ CSV
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// تقديم الملفات الثابتة من المجلد الحالي
app.use(express.static(path.join(__dirname)));

// مسار رئيسي لتشغيل الصفحة
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// مسار تجريبي أو لحفظ السجلات
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running successfully', timestamp: new Date() });
});

// تحديد المنفذ الخاص بالسحابة أو المنفذ المحلي الافتراضي
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running smoothly on port ${PORT}`);
});
