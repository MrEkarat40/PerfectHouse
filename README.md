# Perfect House Property - Facebook Import

เว็บบ้านมือสองจากข้อมูล Facebook Page

## ผลการนำเข้า
- โพสต์ทั้งหมดจากไฟล์: 300
- นำเข้าเป็นประกาศขายบ้าน: 212
- กรองออก: 85
- รูปภาพใช้ URL จาก Facebook API ในฟิลด์ `coverImage` และ `images`

## โครงสร้าง
- `data/properties.json` ข้อมูลบ้าน
- `data/properties.js` ใช้ให้เปิดไฟล์ local ได้
- `data/import-report.json` รายงานการนำเข้า
- `data/excluded-posts.json` รายการโพสต์ที่ถูกกรองออก
- `property.html?id=FB0001` หน้ารายละเอียดบ้าน

## หมายเหตุ
รูปจาก Facebook เป็น URL จาก API อาจหมดอายุได้ในอนาคต หากต้องการ production ระยะยาว ควรดาวน์โหลดรูปมาเก็บใน hosting ของเว็บเอง
