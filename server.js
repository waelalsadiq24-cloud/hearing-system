// مسار البحث المحسّن والمرن لواجهة المرضى
app.get('/api/check-eligibility', (req, res) => {
  try {
    const searchName = (req.query.name || '').trim();
    const searchMother = (req.query.mother || '').trim();
    const searchId = (req.query.id || '').trim();

    const db = readDatabase();
    
    const foundPatient = db.find(p => {
      // دعم جميع الاحتمالات الممكنة لأسماء الحقول في قاعدة البيانات
      const pName = (p.name || p.patientName || p.fullName || '').trim();
      const pMother = (p.mother || p.motherName || p.mName || '').trim();
      const pId = (p.nationalId || p.id || p.civilId || '').toString().trim();

      const matchId = searchId && pId && pId === searchId;
      
      // مطابقة مرنة للاسم واسم الأم (تتجاهل الفروقات البسيطة)
      const matchName = searchName && pName.includes(searchName);
      const matchMother = searchMother && pMother.includes(searchMother);

      return matchId || (matchName && matchMother) || (searchName && pName.includes(searchName) && !searchMother);
    });

    if (foundPatient) {
      res.json({
        found: true,
        name: foundPatient.name || foundPatient.patientName || 'مريض',
        status: foundPatient.status || 'مستحق لصرف المعينة السمعية الجديدة',
        device: foundPatient.device || foundPatient.hearingAid || 'غير متوفر',
        lastDate: foundPatient.dispenseDate || foundPatient.date || 'غير متوفر'
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('Error in check-eligibility:', error);
    res.status(500).json({ found: false });
  }
});
