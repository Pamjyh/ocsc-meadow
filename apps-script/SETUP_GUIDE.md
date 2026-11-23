# คู่มือติดตั้งหลังบ้าน Google Drive + Google Sheets (ใช้เวลาประมาณ 5 นาที)

เว็บ **ทุ่งหญ้าเตรียมสอบ ก.พ. (OCSC Meadow)** ใช้ Google Drive เป็นคลังเนื้อหา/ไฟล์ PDF และใช้ Google Sheets เป็นฐานข้อมูลข้อสอบโต้ตอบ + บันทึกความคืบหน้า โดยไม่มีค่าใช้จ่ายรายเดือน

---

## ขั้นที่ 1: สร้าง Google Apps Script
1. เปิด [script.google.com](https://script.google.com) แล้วคลิก **New project (โปรเจกต์ใหม่)**
2. ตั้งชื่อโปรเจกต์ว่า `OCSC Meadow API`
3. ลบโค้ดเดิมในไฟล์ `Code.gs` ทั้งหมด แล้วคัดลอกโค้ดจากไฟล์ `apps-script/Code.gs` ในโปรเจกต์นี้ไปวางแทน
4. กด **Save** (ไอคอนแผ่นดิสก์ หรือ `Ctrl+S` / `Cmd+S`)

---

## ขั้นที่ 2: รันคำสั่งสร้างโฟลเดอร์และฐานข้อมูลอัตโนมัติ
1. ที่แถบด้านบน เลือกชื่อฟังก์ชัน **`setupDriveStructure`** แล้วกดปุ่ม **Run (เรียกใช้)**
2. ระบบจะขออนุญาตเข้าถึง Google Drive, Google Docs และ Google Sheets ของคุณ → กด **Review permissions** → เลือกบัญชี Google → กด **Advanced** → **Go to OCSC Meadow API (unsafe)** → **Allow**
3. เมื่อรันเสร็จ ดูที่ **Execution log** ด้านล่าง จะเห็นลิงก์ของ:
   - โฟลเดอร์หลัก `OCSC_Meadow_Data`
   - โฟลเดอร์ `01_Study_Content` (แยก 4 วิชาพร้อมเอกสารตัวอย่าง)
   - โฟลเดอร์ `02_PDF_Exams` (แยก 4 วิชาสำหรับอัปโหลดไฟล์ PDF)
   - ไฟล์ฐานข้อมูล `OCSC_Meadow_DB` (Google Sheets มี 4 แท็บ: `Config`, `Exams`, `Questions`, `UserProgress`)

---

## ขั้นที่ 3: เผยแพร่เป็น Web App
1. คลิกปุ่ม **Deploy (ทำให้ใช้งานได้)** มุมขวาบน → เลือก **New deployment (การทำให้ใช้งานได้รายการใหม่)**
2. คลิกไอคอนฟันเฟืองข้าง Select type → เลือก **Web app (เว็บแอป)**
3. ตั้งค่าดังนี้:
   - **Description:** `v1`
   - **Execute as:** `Me` (บัญชีของคุณ)
   - **Who has access:** `Anyone` (ทุกคนที่มีลิงก์)
4. กด **Deploy** แล้วคัดลอก **Web app URL** (ลงท้ายด้วย `/exec`) เก็บไว้

---

## ขั้นที่ 4: เชื่อมต่อกับ GitHub Pages
1. นำโฟลเดอร์โปรเจกต์ `ocsc-meadow` อัปขึ้น GitHub Repository ของคุณ
2. ไปที่หน้า Repository บน GitHub → **Settings** → **Pages** → ตรง **Build and deployment / Source** เลือก **`GitHub Actions`**
3. ไปที่ **Settings** → **Secrets and variables** → **Actions** → แท็บ **Variables** → กด **New repository variable**
   - **Name:** `VITE_GAS_URL`
   - **Value:** วาง Web app URL จากขั้นที่ 3
4. กดแท็บ **Actions** → เลือก workflow `Deploy OCSC Meadow to GitHub Pages` → กด **Run workflow** (หรือ push commit ใหม่) รอประมาณ 1–2 นาที เว็บจะออนไลน์ทันที

---

## ขั้นที่ 5: วิธีเพิ่มเนื้อหาและข้อสอบได้ไม่จำกัด

### 1. เพิ่มบทเรียนอ่านบนเว็บ (`01_Study_Content/`)
- สร้างหรือวางไฟล์ **Google Docs** ในโฟลเดอร์วิชานั้นๆ (เช่น `01_คิดวิเคราะห์_คณิต`)
- ตั้งชื่อขึ้นต้นด้วยตัวเลขเพื่อเรียงลำดับ เช่น `01_อนุกรม`, `02_ร้อยละและตารางข้อมูล`
- **เคล็ดลับสัญลักษณ์คณิตศาสตร์:** แนะนำพิมพ์สัญลักษณ์ Unicode โดยตรง (`≥ ≤ ≠ × ÷ √ ² ³ →`) เพื่อให้อ่านคมชัดและโหลดเร็วที่สุดบนมือถือทุกเครื่อง

### 2. เพิ่มข้อสอบโต้ตอบไม่จำกัดชุด (`OCSC_Meadow_DB`)
- เปิดไฟล์ Google Sheet `OCSC_Meadow_DB`:
  - **แท็บ `Config`:** แก้วันสอบจริง (`examDateIso`), ชื่อผู้เรียน (`learnerName`), ข้อความให้กำลังใจ หรือเกณฑ์ผ่าน (`pass_analytical`, `pass_english`, `pass_law`)
  - **แท็บ `Exams`:** เพิ่มแถวใหม่เพื่อสร้างชุดที่ 2, 3, ... โดยตั้ง `id` ไม่ซ้ำ (เช่น `exam_math_02`), เลือก `subjectCode` (`analytical_math`, `analytical_thai`, `english`, `law`) และตั้ง `published = TRUE`
  - **แท็บ `Questions`:** เพิ่มข้อสอบที่ผูกกับ `examId` นั้นๆ พร้อมตัวเลือก `A–D`, คำตอบที่ถูก (`correctChoice`) และเฉลยละเอียด (`explanationMd`)
  - **กรณีโจทย์มีตารางซับซ้อนหรือรูปภาพ:** สามารถแคปรูปตารางอัปโหลดขึ้น Drive (ตั้งแชร์แบบ Anyone with the link: Viewer) แล้วนำลิงก์มาวางในคอลัมน์ `imageUrl` หรือเขียนตารางแบบ Markdown (`| ... |`) ใน `promptMd` ได้เลย

### 3. เพิ่มชุดข้อสอบ PDF (`02_PDF_Exams/`)
- แนะนำให้คลิกขวาที่โฟลเดอร์ `02_PDF_Exams` → **Share** → ตั้งเป็น **Anyone with the link (Viewer)** เพื่อให้หน้าเว็บแสดงตัวอย่าง PDF (`iframe`) ได้บนทุกเครื่องโดยไม่ติดล็อกอิน
- อัปโหลดไฟล์ `.pdf` ลงในโฟลเดอร์วิชาที่ต้องการ ตั้งชื่อนำหน้าด้วยตัวเลข เช่น `01_ตะลุยโจทย์ตารางข้อมูล.pdf`

> **หมายเหตุเรื่อง Cache:** หลังเพิ่มเนื้อหาใหม่ใน Drive/Sheet ระบบจะรีเฟรชอัตโนมัติภายใน 5 นาที หรือเปิดลิงก์ `<Web App URL>?action=clearCache` เพื่อล้างแคชทันทีได้ครับ
