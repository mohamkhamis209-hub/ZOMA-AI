/* أساس نقل البيانات بين الأجهزة. صيغة النقل هي نفسها صيغة النسخة الاحتياطية. */
const ZomaTransfer = {
  createPayload: () => ZomaDB.exportAll(),
  restorePayload: data => ZomaDB.importAll(data)
};
