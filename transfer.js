/* Direct device transfer foundation. Conversations are exported as a JSON payload;
   the UI can later pair devices with WebRTC/QR without changing the database format. */
const ZomaTransfer={createPayload:()=>ZomaDB.exportAll(),restorePayload:data=>ZomaDB.importAll(data)};
