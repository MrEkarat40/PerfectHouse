# Perfect House Production Static Website

เว็บขายบ้าน Perfect House พร้อมข้อมูลทรัพย์ตัวอย่าง

## จุดสำคัญ
- ทุกหน้าที่เกี่ยวกับบ้านใช้ข้อมูลจาก `data/properties.json`
- มีรูปบ้าน 100 รูปใน `assets/images/`
- ค้นหาและฟิลเตอร์ใช้งานได้จริงด้วย JavaScript
- รายการโปรดและเปรียบเทียบใช้ localStorage
- ทุกเมนูและทุกปุ่มสำคัญเชื่อมไปหน้าจริง
- พร้อมอัปขึ้น GitHub Pages / Netlify / Vercel / Hosting

## วิธีเปิด
เปิด `index.html` หรืออัปทั้งโฟลเดอร์ขึ้นโฮสติ้ง

## หมายเหตุ
ฟอร์มเป็น demo ฝั่งหน้าเว็บ หากใช้งาน production จริงให้ต่อ backend, Email, LINE, CRM หรือ Database


## แก้ไขเพิ่มเติมในเวอร์ชัน PNG
- รูปบ้านใช้ `.png` ทั้งหมดเพื่อให้แสดงผลแน่นอนกว่า SVG
- มี `data/properties.js` สำหรับเปิดไฟล์แบบ local โดยไม่ติดปัญหา fetch JSON
