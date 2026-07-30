// مسار البحث الشامل في جميع حقول وقيم قاعدة البيانات
app.get('/api/check-eligibility', (req, res) => {
  try {
    const searchName = (req.query.name || '').trim();
    const searchMother = (req.query.mother || '').trim();
    const searchId = (req.query.id || '').trim();

    const db = readDatabase();
    console.log("بحث عن:", { searchName, searchMother, searchId }, "عدد السجلات:", db.length);

    const foundPatient = db.find(p => {
      // تحويل كامل السجل إلى نص للبحث بداخله عن الاسم واسم الأم بشكل مضمون
      const recordString = JSON.stringify(p);
      
      const matchName = searchName && recordString.includes(searchName);
      const matchMother = searchMother && recordString.includes(searchMother);
      const matchId = searchId && (recordString.includes(searchId));

      if (searchId && searchName) {
        return matchId || (matchName && matchMother);
      } else if (searchName && searchMother) {
        return matchName && matchMother;
      } else if (searchName) {
        return matchName;
      } else if (searchId) {
        return matchId;
      }
      return false;
    });

    if (foundPatient) {
      res.json({
        found: true,
        name: foundPatient.name || foundPatient.patientName || foundPatient.fullName || searchName,
        status: foundPatient.status || 'مستحق لصرف المعينة السمعية الجديدة',
        device: foundPatient.device || foundPatient.hearingAid || foundPatient.details || 'غير متوفر',
        lastDate: foundPatient.dispenseDate || foundPatient.date || foundPatient.time || 'غير متوفر'
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('Error in check-eligibility:', error);
    res.status(500).json({ found: false });
  }
});
