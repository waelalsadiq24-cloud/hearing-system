// مسار البحث المتوافق تماماً مع الحقول العربية في قاعدة البيانات
app.get('/api/check-eligibility', (req, res) => {
  try {
    const searchName = (req.query.name || '').trim();
    const searchMother = (req.query.mother || '').trim();
    const searchId = (req.query.id || '').trim();

    const db = readDatabase();

    const foundPatient = db.find(p => {
      // قراءة الحقول العربية والإنجليزية معاً لضمان التطابق التام
      const pName = (p['اسم المريض'] || p.name || p.patientName || '').trim();
      const pMother = (p['اسم الأم'] || p.motherName || p.mother || '').trim();
      const pId = (p['الرقم الوطني'] || p.nationalId || p.id || '').toString().trim();

      const matchId = searchId && searchId !== '1' && pId === searchId;
      const matchName = searchName && pName.includes(searchName);
      const matchMother = searchMother && pMother.includes(searchMother);

      // إذا أدخل الرقم الوطني (غير الواحد الافتراضي) يطابق به، أو يطابق الاسم مع اسم الأم
      if (searchId && searchId !== '1' && pId) {
        return pId === searchId;
      }
      
      return matchName && matchMother;
    });

    if (foundPatient) {
      res.json({
        found: true,
        name: foundPatient['اسم المريض'] || foundPatient.name || 'مريض',
        status: foundPatient.status || 'مستحق لصرف المعينة السمعية الجديدة',
        device: foundPatient['تفاصيل السماعة'] || foundPatient.device || 'غير متوفر',
        lastDate: foundPatient['تاريخ الصرف'] || foundPatient.dispenseDate || 'غير متوفر'
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('Error in check-eligibility:', error);
    res.status(500).json({ found: false });
  }
});
