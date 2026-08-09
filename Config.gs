// =======================================================
// ⚙️ CONFIGURATION: ตั้งค่าระบบฐานข้อมูลและสิทธิ์ (อัปเดต ID เล่มจริง)
// =======================================================
const CONFIG = {
  // 1. ID ของ Google Sheet เล่มจริงของคุณ
  SPREADSHEET_ID: "1Y9HJEviyobNXSCd1ejPld0t0MgYLXvOF_p_JGggY8Ek",
  
  // 2. ชื่อแท็บใน Google Sheet ที่ใช้เก็บข้อมูล 
  SHEET_NAME: "Theses",
  
  // 3. รหัสโฟลเดอร์ PDF ใน Google Drive สำหรับจัดเก็บไฟล์เล่มวิทยานิพนธ์
  PDF_FOLDER_ID: "1WE2Yy0vfibOMoTP6O7Mk8fbQF7QweD58",
  
  // 4. รหัสโฟลเดอร์ รูปหน้าปก (หากมี)
  COVER_FOLDER_ID: "1HHgEN7iE3xeRMW-LulkT-17qjYG95XI3",
  
  // 5. โทเค็น Telegram Bot (ถ้าต้องการใช้งานส่งแจ้งเตือนในอนาคต)
  TELEGRAM_BOT_TOKEN: "YOUR_TELEGRAM_BOT_TOKEN_HERE"
};

/**
 * ฟังก์ชันดึงแท็บชีตฐานข้อมูลแบบปลอดภัย (Safe Database Connection)
 * @return {Sheet} Google Sheet Object
 */
function getDatabaseSheet() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    // Fallback: หากหาแท็บตามชื่อที่กำหนดไม่เจอ ให้ดึงแท็บแรกสุดของสเปรดชีตมาใช้แทนทันทีเพื่อความปลอดภัย
    if (!sheet) {
      sheet = ss.getSheets()[0];
      Logger.log("Fallback: ไม่พบแท็บชื่อ '" + CONFIG.SHEET_NAME + "' ระบบสลับไปใช้แท็บแรกสุดแล้ว");
    }
    return sheet;
  } catch (error) {
    Logger.log("Error in getDatabaseSheet: " + error.toString());
    throw new Error("ไม่สามารถเปิดใช้งาน Google Sheet ได้ กรุณาเช็คการตั้งค่าสิทธิ์แชร์ไฟล์ หรือตรวจเช็ค ID สเปรดชีตใน Config.gs");
  }
}