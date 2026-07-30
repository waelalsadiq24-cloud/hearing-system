// مسار البحث المباشر المطابق للحقول العربية في قاعدة البيانات
app.get('/api/check-eligibility', (req, res) => {
  try {
    const searchName = (req.query.name || '').trim();
    const searchMother = (req.query.mother || '').trim();

    const db = readDatabase();

    const foundPatient = db.find(p => {
      // قراءة الحقول بحسب أسمائها العربية الدقيقة في السجلات
      const pName = (p['اسم المريض'] || '').trim();
      const pMother = (p['اسم الأم'] || '').trim();

      // مطابقة تامة للنص المدخل مع السجل
      return pName === searchName && pMother === searchMother;
    });

    if (foundPatient) {
      res.json({
        found: true,
        name: foundPatient['اسم المريض'],
        status: 'مستحق لصرف المعينة السمعية الجديدة',
        device: foundPatient['تفاصيل السماعة'] || 'غير متوفر',
        lastDate: foundPatient['تاريخ الصرف'] || 'غير متوفر'
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('Error in check-eligibility:', error);
    res.status(500).json({ found: false });
  }
});
