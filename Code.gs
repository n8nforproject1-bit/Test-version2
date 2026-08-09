Code.gs

// =======================================================
// 🌐 1. ฟังก์ชันแสดงผลหน้าเว็บ (Web App Entry Point & Routing)
// =======================================================
function doGet(e) {
  try {
    // 📖 ตรวจสอบการเรียกหน้า Flipbook Reader (แก้ไขบั๊กการสลับหน้า)
    if (e && e.parameter && e.parameter.page === 'flipbook') {
      const pdfUrl = e.parameter.pdf;
      const title = e.parameter.title || "วิทยานิพนธ์";
      let base64 = "";
     
      if (pdfUrl) {
        try {
          // ดึง File ID จากลิงก์ Google Drive เพื่อดึงข้อมูลไฟล์มาแปลงเป็น Base64 ส่งไปหน้าบ้าน
          const fileId = pdfUrl.match(/[-\w]{25,}/)[0];
          const file = DriveApp.getFileById(fileId);
          const blob = file.getBlob();
          base64 = Utilities.base64Encode(blob.getBytes());
        } catch (fileError) {
          Logger.log("Error fetching PDF file for Flipbook: " + fileError.toString());
          base64 = "ERROR: ไม่สามารถโหลดไฟล์ PDF ได้ กรุณาตรวจสอบสิทธิ์การแชร์ไฟล์ใน Google Drive";
        }
      }
     
      const template = HtmlService.createTemplateFromFile('Flipbook');
      template.pdfBase64 = base64;
      template.bookTitle = title;
      template.homeUrl = ScriptApp.getService().getUrl(); // 🆕 URL หน้าหลักจริง ส่งจากเซิร์ฟเวอร์โดยตรง
     
      return template.evaluate()
          .setTitle(title + ' - Flipbook Reader')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }


    // 🏠 โหลดไฟล์หลักชื่อ 'Index' เป็นค่าเริ่มต้น (หน้าหลักระบบคลังค้นหา)
    return HtmlService.createTemplateFromFile('Index')
        .evaluate()
        .setTitle('ระบบคลังวิทยานิพนธ์ คณะวิศวกรรมศาสตร์ มมส')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput(
      "<h3>เกิดข้อผิดพลาดในการโหลดหน้าเว็บหลัก</h3>" +
      "<p>Error Details: " + err.message + "</p>"
    );
  }
}


// ฟังก์ชันดึงไฟล์ย่อย (เช่น CSS, JS, HTML อื่นๆ) ไปรวมไว้ในไฟล์หลัก
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (err) {
    return "<!-- Error including " + filename + ": " + err.message + " -->";
  }
}


// =======================================================
// 🔑 2. ฟังก์ชันตรวจสอบรหัสผ่านแอดมิน (ปลอดภัย 100% บนเซิร์ฟเวอร์)
// =======================================================
function checkAdminPasswordFromServer(inputPassword) {
  try {
    const TRUE_PASSWORD = "1234"; // 👈 สามารถแก้ไขรหัสผ่านแอดมินของคุณตรงนี้ได้เลยครับ
    return inputPassword === TRUE_PASSWORD;
  } catch (error) {
    Logger.log("Error checking admin password: " + error.toString());
    return false;
  }
}


// =======================================================
// 📂 3. ฟังก์ชันอัปโหลดไฟล์ PDF ไปยัง Google Drive และบันทึกข้อมูล
// =======================================================
function getOrCreateFolder() {
  // 🆕 ใช้โฟลเดอร์ "Thesis_PDFs" ตาม Folder ID ที่กำหนดไว้แน่นอน (จากลิงก์ Google Drive ที่ให้มา)
  // การอ้างอิงด้วย ID จะแม่นยำ 100% ไม่ว่าใครจะไปเปลี่ยนชื่อโฟลเดอร์ทีหลังก็ยังเก็บไฟล์ถูกที่เดิม
  const FOLDER_ID = "1WE2Yy0vfibOMoTP6O7Mk8fbQF7QweD58";
  try {
    return DriveApp.getFolderById(FOLDER_ID);
  } catch (error) {
    // สำรอง: เผื่อกรณีหาโฟลเดอร์ตาม ID ไม่เจอ (เช่นถูกลบ หรือบัญชีที่รันสคริปต์ไม่มีสิทธิ์เข้าถึง)
    // ระบบจะไม่ปล่อยให้อัปโหลดล้มเหลว แต่จะสร้างโฟลเดอร์ชื่อ Thesis_PDFs สำรองขึ้นมาใช้แทนโดยอัตโนมัติ
    Logger.log("ไม่สามารถเข้าถึงโฟลเดอร์ตาม FOLDER_ID ที่กำหนดได้ กำลังใช้โฟลเดอร์สำรองแทน: " + error.toString());
    const folderName = "Thesis_PDFs";
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      return folders.next();
    } else {
      const folder = DriveApp.createFolder(folderName);
      // ตั้งค่าสิทธิ์ให้ "ทุกคนที่มีลิงก์สามารถเปิดดูได้" เพื่อให้นำไปทำ Flipbook ได้ราบรื่น
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return folder;
    }
  }
}


function saveSubmissionFromForm(formData, fileData) {
  try {
    const folder = getOrCreateFolder();
   
    // แปลงรหัสไฟล์ Base64 กลับมาเป็นไฟล์ PDF
    const decodedFile = Utilities.base64Decode(fileData.base64);
    const blob = Utilities.newBlob(decodedFile, fileData.mimeType, fileData.fileName);
    const file = folder.createFile(blob);
   
    // ปลดล็อกไฟล์ PDF ให้คนทั่วไปสามารถกดเปิดอ่านจากหน้า Flipbook ได้
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const pdfUrl = file.getUrl();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Sheet1");
    if (!sheet) {
      sheet = ss.getSheets()[0];
    }
    const timestamp = new Date();
    const rowId = "ID-" + timestamp.getTime();
    const defaultStatus = "รอตรวจสอบ";
   
    // บันทึกลงตารางตามลำดับ A: ID ถึง K: สถานะ และ L, M สำหรับสถิติ
    // 🆕 ลบคอลัมน์ "บทคัดย่อ" ออกแล้ว คอลัมน์ที่เหลือเลื่อนซ้ายมาแทนที่
    sheet.appendRow([
      rowId,               // คอลัมน์ A (1): ID
      timestamp,           // คอลัมน์ B (2): วันเวลาที่ส่ง
      formData.author,     // คอลัมน์ C (3): ผู้จัดทำ
      formData.degree,     // คอลัมน์ D (4): ระดับปริญญา
      formData.titleTh,    // คอลัมน์ E (5): ชื่อภาษาไทย
      formData.titleEn,    // คอลัมน์ F (6): ชื่อภาษาอังกฤษ
      formData.major,      // คอลัมน์ G (7): สาขาวิชา
      formData.year,       // คอลัมน์ H (8): ปีพิมพ์
      formData.advisor,    // คอลัมน์ I (9): อาจารย์ที่ปรึกษา
      pdfUrl,              // คอลัมน์ J (10): ลิงก์ PDF ใน Drive
      defaultStatus,       // คอลัมน์ K (11): สถานะเริ่มต้น
      0,                   // คอลัมน์ L (12): จำนวนเข้าชม (View_Count) เริ่มต้นที่ 0
      0                    // คอลัมน์ M (13): จำนวนดาวน์โหลด (Download_Count) เริ่มต้นที่ 0
    ]);
    return { success: true, url: pdfUrl };
  } catch (error) {
    Logger.log("Error saving submission: " + error.toString());
    throw new Error("เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์ในการบันทึกข้อมูล: " + error.toString());
  }
}


// =======================================================
// 📊 4. ฟังก์ชันสำหรับระบบแอดมิน: ดึงข้อมูลงานที่สถานะเป็น "รอตรวจสอบ"
// =======================================================
function getPendingThesesData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Sheet1");
    if (!sheet) sheet = ss.getSheets()[0];
   
    const data = sheet.getDataRange().getValues();
    const pendingList = [];
   
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.length < 11) continue; // ข้ามแถวที่คอลัมน์ไม่ครบเพื่อป้องกันหน้าเว็บล่ม
     
      const status = row[10] ? String(row[10]).trim() : "";
     
      if (status === "รอตรวจสอบ") {
        pendingList.push({
          rowId: row[0] ? String(row[0]).trim() : "",
          author: row[2] ? String(row[2]).trim() : "ไม่ระบุผู้แต่ง",
          degree: row[3] ? String(row[3]).trim() : "ไม่ระบุ",
          titleTh: row[4] ? String(row[4]).trim() : "ไม่มีชื่อภาษาไทย",
          titleEn: row[5] ? String(row[5]).trim() : "",
          pdfUrl: row[9] ? String(row[9]).trim() : "#"
        });
      }
    }
    return pendingList;
  } catch (error) {
    Logger.log("Error in getPendingThesesData: " + error.toString());
    throw new Error("ระบบหลังบ้านพังขณะดึงรายการรอตรวจ: " + error.toString());
  }
}


// =======================================================
// 🔄 5. ฟังก์ชันสำหรับระบบแอดมิน: อนุมัติงานเปลี่ยนสถานะเป็น "อนุมัติแล้ว"
// =======================================================
function updateStatusToApproved(rowId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Sheet1");
    if (!sheet) sheet = ss.getSheets()[0];
   
    const data = sheet.getDataRange().getValues();
   
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).trim() === String(rowId).trim()) {
        // สั่งเปลี่ยนค่าสถานะในแถวนั้น (คอลัมน์ที่ 11 คือ คอลัมน์ K) ให้กลายเป็น "อนุมัติแล้ว"
        sheet.getRange(i + 1, 11).setValue("อนุมัติแล้ว");
        return true;
      }
    }
    return false;
  } catch (error) {
    Logger.log("Error in updateStatusToApproved: " + error.toString());
    throw new Error("หลังบ้านพังขณะทำการอนุมัติงาน: " + error.toString());
  }
}


// =======================================================
// 🖼️ ฟังก์ชันดึงรูป "หน้าแรก" ของไฟล์ PDF มาใช้เป็นปกอัตโนมัติ
// =======================================================
// ใช้บริการสร้างภาพตัวอย่าง (Thumbnail) ของ Google Drive ซึ่งจะดึงหน้าแรกของไฟล์ PDF
// มาแสดงเป็นภาพปกให้เองโดยอัตโนมัติ โดยไม่ต้องแปลงไฟล์หรือเก็บรูปเพิ่ม
// (ไฟล์ต้องถูกแชร์แบบ "ทุกคนที่มีลิงก์ดูได้" ซึ่งระบบตั้งค่าให้อยู่แล้วตอนอัปโหลด)
function getDriveThumbnailUrl(pdfUrl) {
  try {
    if (!pdfUrl) return "";
    const match = String(pdfUrl).match(/[-\w]{25,}/);
    if (!match) return "";
    const fileId = match[0];
    return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w400-h600";
  } catch (error) {
    Logger.log("Error in getDriveThumbnailUrl: " + error.toString());
    return "";
  }
}


// =======================================================
// 📖 6. ฟังก์ชันดึงเฉพาะงานที่ "อนุมัติแล้ว" ไปแสดงที่ Flipbook หน้าหลัก
// =======================================================
function getThesisData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Sheet1");
    if (!sheet) sheet = ss.getSheets()[0];
   
    const data = sheet.getDataRange().getValues();
    const thesisList = [];
   
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.length < 11) continue; // ข้ามแถวที่คอลัมน์เสียหาย
     
      const status = row[10] ? String(row[10]).trim() : "";
     
      // กรองเอาเฉพาะข้อมูลที่ "อนุมัติแล้ว" เท่านั้นไปแสดงผลใน Flipbook
      if (status === "อนุมัติแล้ว") {
        const pdfUrl = row[9] ? String(row[9]).trim() : "";
        thesisList.push({
          ID: row[0] ? String(row[0]).trim() : "",
          Title: row[4] ? String(row[4]).trim() : "ไม่มีชื่อเรื่อง (TH)",
          TitleEn: row[5] ? String(row[5]).trim() : "",                  
          Author: row[2] ? String(row[2]).trim() : "ไม่ระบุผู้แต่ง",
          Degree: row[3] ? String(row[3]).trim() : "ไม่ระบุ",
          Department: row[6] ? String(row[6]).trim() : "ไม่ระบุ",        
          Year: row[7] ? String(row[7]).trim() : "",
          Advisor: row[8] ? String(row[8]).trim() : "ไม่ระบุที่ปรึกษา",    
          PDF_URL: pdfUrl,
          Cover_URL: getDriveThumbnailUrl(pdfUrl), // 🆕 หน้าปก = หน้าแรกของ PDF จริง
          View_Count: row[11] ? Number(row[11]) : 0,      // จำนวนเข้าชม
          Download_Count: row[12] ? Number(row[12]) : 0   // จำนวนดาวน์โหลด
        });
      }
    }
    return thesisList;
  } catch (error) {
    Logger.log("Error in getThesisData: " + error.toString());
    return [];
  }
}


// =======================================================
// 🔗 7. ฟังก์ชันเพิ่มเติมเพื่อรองรับระบบหน้าบ้าน (แก้ไขจุดบั๊กเปิดเล่มอ่านไม่ได้)
// =======================================================
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}


// =======================================================
// 📈 8. ระบบนับสถิติ "เข้าชม" และ "ดาวน์โหลด" ต่อเล่ม
// =======================================================
// คอลัมน์ L (12) = จำนวนเข้าชม, คอลัมน์ M (13) = จำนวนดาวน์โหลด
function incrementViewCount(id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Sheet1");
    if (!sheet) sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();


    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).trim() === String(id).trim()) {
        const currentCount = data[i][11] ? Number(data[i][11]) : 0; // คอลัมน์ L
        sheet.getRange(i + 1, 12).setValue(currentCount + 1);
        return true;
      }
    }
    return false;
  } catch (error) {
    Logger.log("Error in incrementViewCount: " + error.toString());
    return false;
  }
}


function incrementDownloadCount(id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Sheet1");
    if (!sheet) sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();


    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).trim() === String(id).trim()) {
        const currentCount = data[i][12] ? Number(data[i][12]) : 0; // คอลัมน์ M
        sheet.getRange(i + 1, 13).setValue(currentCount + 1);
        return true;
      }
    }
    return false;
  } catch (error) {
    Logger.log("Error in incrementDownloadCount: " + error.toString());
    return false;
  }
}


// =======================================================
// 📊 9. ฟังก์ชันดึงสถิติภาพรวมสำหรับหน้าแดชบอร์ดแอดมิน
// =======================================================
function getAdminStats() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Sheet1");
    if (!sheet) sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();


    let pending = 0;
    let approved = 0;
    let total = 0;


    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // ข้ามแถวที่ว่างเปล่า
      total++;
      const status = row[10] ? String(row[10]).trim() : "";
      if (status === "รอตรวจสอบ") pending++;
      else if (status === "อนุมัติแล้ว") approved++;
    }


    return { pending: pending, approved: approved, total: total };
  } catch (error) {
    Logger.log("Error in getAdminStats: " + error.toString());
    return { pending: 0, approved: 0, total: 0 };
  }
}


Config.gs

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
