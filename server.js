// مسار الفحص والبحث الشامل للأسماء
app.get('/api/check-eligibility', (req, res) => {
  try {
    const searchName = (req.query.name || '').trim();
    const searchMother = (req.query.mother || '').trim();

    const db = readDatabase();
    
    // طباعة أول سجل في السيرفر لترى أسماء الحقول الحقيقية في الكونسول
    if (db.length > 0) {
      console.log("مفاتيح الحقول في قاعدة البيانات:", Object.keys(db[0]));
    }

    const foundPatient = db.find(p => {
      // جمع كل قيم السجل في نص واحد للبحث المرن المباشر
      const allValues = Object.values(p).join(' ');
      
      const matchName = searchName && allValues.includes(searchName);
      const matchMother = searchMother && allValues.includes(searchMother);

      return matchName && matchMother;
    });

    if (foundPatient) {
      res.json({
        found: true,
        name: foundPatient['اسم المريض'] || foundPatient.name || searchName,
        status: 'مستحق لصرف المعينة السمعية الجديدة',
        device: foundPatient['تفاصيل السماعة'] || foundPatient.device || 'غير متوفر',
        lastDate: foundPatient['تاريخ الصرف'] || foundPatient.date || 'غير متوفر'
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('Error in check-eligibility:', error);
    res.status(500).json({ found: false });
  }
});
