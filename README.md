# เตรียมสอบ ก.พ. (OCSC Meadow)

เว็บอ่านหนังสือและฝึกทำข้อสอบ **ก.พ. ภาค ก ระดับปริญญาตรี** ส่วนตัว ออกแบบให้โหลดไว ใช้งานสบายตาทั้งบนคอมพิวเตอร์และมือถือทุกขนาดหน้าจอ

## จุดเด่นของระบบ
- **บรรยากาศทุ่งหญ้า 24 ชั่วโมง:** ฉากท้องฟ้าและทุ่งหญ้าเคลื่อนไหวแบบนุ่มนวลเปลี่ยนสีตามเวลาจริงของประเทศไทย (`Asia/Bangkok`) พร้อมปรับธีม Liquid Glass สว่าง/มืดอัตโนมัติ และมีปุ่ม **โหมดนิ่ง** สำหรับตอนต้องการสมาธิสูงสุด
- **ครบโครงสร้างสอบ ก.พ. ภาค ก ป.ตรี:** แสดงทั้งสรุปเกณฑ์ผ่านทางการ **3 วิชาหลัก** (คิดวิเคราะห์ ≥ 60% รวมคณิต+ไทย, ภาษาอังกฤษ ≥ 50%, กฎหมายและข้าราชการที่ดี ≥ 60%) และแยกหมวดอ่าน/ฝึก **4 หมวด**
- **คลังเนื้อหาและข้อสอบ 2 ระบบไม่ซ้ำกัน:**
  - **คลังเนื้อหาอ่านบนเว็บ:** อ่านในหน้ากระดาษถนอมสายตา ปรับขนาดตัวอักษรได้ คั่นหน้า และติ๊กอ่านจบแล้ว (ดึงจาก Google Docs ใน Drive)
  - **ข้อสอบโต้ตอบ (Interactive):** เลือกได้ทั้งโหมดจับเวลา (บันทึกอัตโนมัติกลับมาทำต่อได้) และโหมดฝึกหัด พร้อมเฉลยละเอียดทุกข้อและตัวกรองทบทวนเฉพาะข้อที่ผิด (จัดการผ่าน Google Sheets)
  - **ข้อสอบ PDF:** เปิดดูในหน้าเว็บ ดาวน์โหลด ติ๊กทำแล้ว และจดโน้ตส่วนตัว (ดึงจาก Google Drive)
- **ตัวช่วยวางแผน:** การ์ดนับถอยหลังวันสอบจริง (พ.ศ.) + นาฬิกา Pomodoro ลอยติดหน้าจอทุกหน้า
- **0ms Local-First + Auto-Sync:** บันทึกความคืบหน้าทันทีในเบราว์เซอร์และซิงก์อัตโนมัติขึ้น Google Sheets ด้วย LWW merge

## เริ่มใช้งานบนเครื่อง (Local Development)

```bash
npm install
npm test
npm run dev
```

หากต้องการเชื่อมกับ Google Apps Script บนเครื่อง ให้คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่า `VITE_GAS_URL`

## การติดตั้งหลังบ้านและอัปขึ้น GitHub Pages
อ่านขั้นตอนครบจบใน 5 นาทีได้ที่ [`apps-script/SETUP_GUIDE.md`](./apps-script/SETUP_GUIDE.md)

## โครงสร้างโปรเจกต์
```text
ocsc-meadow/
├── apps-script/
│   ├── Code.gs              # Google Apps Script API + setupDriveStructure()
│   └── SETUP_GUIDE.md       # คู่มือติดตั้งหลังบ้านและ GitHub Pages
├── .github/workflows/
│   └── deploy.yml           # GitHub Actions (test -> typecheck -> build -> deploy)
├── public/                  # ภาพฉากทุ่งหญ้าที่แยกเลเยอร์สำหรับ WebGL
└── src/
    ├── data/                # ชุดเนื้อหาและข้อสอบตั้งต้น (Starter Pack)
    ├── domain/              # โมเดล, เกณฑ์คะแนน ก.พ., LWW merge, XSS sanitizer, เวลาท้องฟ้า
    ├── features/            # Dashboard, Study Reader, Exams Hub & Runner, Pomodoro, Meadow WebGL
    ├── services/            # Router, localStorage, API client, Data repository
    ├── styles/              # Design tokens, Light/Dark Liquid Glass, responsive CSS
    └── ui/                  # TopNav (Desktop capsule + Mobile bottom tab bar), LiquidGlassIcon
```
