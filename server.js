// مسار البحث العام للمرضى (أونلاين)
app.get('/api/public-search', async (req, res) => {
    const searchQuery = req.query.q;
    if (!searchQuery) {
        return res.json({ found: false });
    }

    try {
        // [تعديل هنا]: استبدل هذا الجزء بطريقة البحث الخاصة بقاعدة بياناتك الحالية
        // مثال افتراضي للبحث بالاسم أو الرقم الوطني في قاعدة البيانات:
        /*
        const patient = await PatientModel.findOne({
            $or: [
                { nationalId: searchQuery },
                { name: { $regex: searchQuery, $options: 'i' } }
            ]
        });
        */

        // نموذج محاكاة للنتيجة (ضع كود قاعدة بياناتك الفعلي هنا):
        const patient = null; // استبدلها بنتيجة البحث الفعلية من قاعدة بياناتك

        if (patient) {
            res.json({
                found: true,
                patient: {
                    name: patient.name,
                    status: patient.isEligible ? 'مستحق للصماعة الجديدة' : 'غير مستحق حالياً',
                    lastDate: patient.lastDispenseDate
                }
            });
        } else {
            res.json({ found: false });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ found: false, error: 'Server error' });
    }
});
