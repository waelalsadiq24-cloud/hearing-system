const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname)));

const dbFilePath = path.join(__dirname, 'database.json');

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

function saveDatabase(data) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving database:', err);
    return false;
  }
}

function getInstitutionFullName(code) {
  if (code === 'medcity' || code === 'tibb') {
    return 'مدينة الطب';
  }
  return 'مستشفى اليرموك';
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/records', (req, res) => {
  try {
    const code = req.query.code || 'yarmok';
    const institutionName = getInstitutionFullName(code);
    let records = readDatabase();
    
    records = records.map((record, index) => ({
      ...record,
      id: index,
      institution_name: record.institution_name || institutionName
    }));

    res.json({ success: true, records: records });
  } catch (error) {
    res.status(500).json({ success: false, records: [] });
  }
});

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// مسار التحديث المباشر والدائم في قاعدة البيانات المحلية
app.post('/api/records/update', (req, res) => {
  try {
    const { index, field, value } = req.body;
    let records = readDatabase();
    
    if (records[index] !== undefined) {
      records[index][field] = value;
      const saved = saveDatabase(records);
      if (saved) {
        return res.json({ success: true });
      }
    }
    res.status(404).json({ success: false, error: 'Record not found' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

    incomingRecords = incomingRecords.map(record => ({
      ...record,
      institution_name: institutionName
    }));

    let currentRecords = readDatabase();
    if (incomingRecords.length > 0) {
      currentRecords = currentRecords.concat(incomingRecords);
      saveDatabase(currentRecords);
    }
    
    res.json({ success: true, receivedCount: incomingRecords.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clear-records', (req, res) => {
  try {
    saveDatabase([]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running smoothly on port ${PORT}`);
});
