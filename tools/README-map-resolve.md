# Google Maps Exact Pin

เว็บรองรับลิงก์ Google Maps หลายแบบแล้ว เช่น:

- `https://maps.app.goo.gl/...`
- `https://www.google.com/maps/place/.../@13.862939,100.4191029,17z/...`
- URL ที่มี `!3d13.862939!4d100.4191029`
- URL ที่มี `q=13.862939,100.4191029`
- URL ที่มี `ll=13.862939,100.4191029`
- URL ที่มี `center=13.862939,100.4191029`

## ถ้าเป็นลิงก์เต็ม
เว็บจะดึงพิกัดจาก URL ได้เองผ่าน `assets/app.js`

## ถ้าเป็น maps.app.goo.gl
ต้องรัน script เพื่อ resolve short link เป็น URL เต็มก่อน:

```powershell
node tools/resolve-google-map-links.js
```

หลังรันเสร็จให้ commit ไฟล์:

```text
data/properties.json
data/properties.js
data/map-resolve-report.json
```

## ไฟล์ที่เกี่ยวข้อง

```text
assets/app.js
assets/style.css
tools/resolve-google-map-links.js
data/properties.json
data/properties.js
```
