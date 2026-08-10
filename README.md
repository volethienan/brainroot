# Brainroot — Chống Não Tàn 🧠

Ứng dụng web luyện phản xạ nói, tư duy có cấu trúc và khả năng phản biện bằng các chủ đề ngẫu nhiên. Brainroot kết hợp danh sách chủ đề có sẵn với Google Gemini để tạo nội dung mới, cung cấp gợi ý nghiên cứu và đánh giá bài nói từ bản ghi âm.

## Tính năng chính

- **Quay chủ đề luân phiên:** xen kẽ giữa chủ đề có sẵn và chủ đề do Gemini tạo, không làm thay đổi danh sách gốc.
- **Danh mục đa dạng:** tài chính, khởi nghiệp, công nghệ, thể hình, dinh dưỡng, năng suất, lịch sử, văn học và chế độ tổng hợp.
- **Phản xạ nhanh:** nhận chủ đề và bắt đầu nói ngay trong thời lượng đã chọn.
- **Tư duy sâu:** dành một khoảng thời gian tìm hiểu trước khi chuyển sang phần trình bày.
- **Gợi ý nghiên cứu:** Gemini cung cấp định nghĩa ngắn, từ khóa và câu hỏi phản biện cho chủ đề hiện tại.
- **Ghi âm trực tiếp:** sử dụng `MediaRecorder` của trình duyệt, hỗ trợ thời lượng nói từ 1 đến 10 phút.
- **Nhận xét bài nói:** đánh giá độ rõ ràng, cấu trúc, lập luận và cách truyền đạt theo rubric 1–5 có mô tả.
- **Feedback có căn cứ:** hiển thị chất lượng audio, độ tin cậy, điểm mạnh, ưu tiên cải thiện, vấn đề lập luận và nội dung cần kiểm chứng.
- **Phím tắt:** `Space` để quay, `Enter` để bắt đầu và `Esc` để đóng cửa sổ hiện tại.

## Luồng hoạt động

```text
Chọn chế độ và danh mục
        ↓
Quay chủ đề
        ↓
Xem gợi ý nghiên cứu nếu cần
        ↓
Tìm hiểu trước — chỉ ở chế độ Tư duy sâu
        ↓
Ghi âm bài nói
        ↓
Gemini phân tích và trả về feedback có cấu trúc
```

## Công nghệ sử dụng

- **Frontend:** HTML, CSS và JavaScript thuần.
- **Backend:** Node.js ES Modules với HTTP server tích hợp.
- **AI:** Google Gemini API.
- **Audio:** Web MediaRecorder API.
- **Triển khai:** Vercel Node.js Function/Server.

Project không sử dụng framework frontend hoặc dependency npm bên ngoài.

## Yêu cầu hệ thống

- Node.js `20.6` trở lên để hỗ trợ tùy chọn `--env-file`.
- Trình duyệt hiện đại hỗ trợ `navigator.mediaDevices.getUserMedia` và `MediaRecorder`.
- Gemini API key có quyền sử dụng các model được cấu hình.
- Kết nối HTTPS khi sử dụng micro trên môi trường production.

## Cài đặt và chạy local

```bash
git clone https://github.com/volethienan/brainroot.git
cd brainroot
npm start
```

Ứng dụng mặc định chạy tại:

```text
http://127.0.0.1:3000
```

Không mở trực tiếp `web_brainroot.html` nếu muốn sử dụng các tính năng Gemini. Frontend cần gọi các API được cung cấp bởi `server.mjs`.

## Cấu hình môi trường

Project đọc cấu hình từ file `.env` khi chạy bằng `npm start`.

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
GEMINI_HINT_MODEL=gemini-3.5-flash-lite
GEMINI_SPEECH_MODEL=gemini-3.6-flash
PORT=3000
```

| Biến | Bắt buộc | Giá trị mặc định | Mục đích |
|---|---:|---|---|
| `GEMINI_API_KEY` | Có | Không có | Xác thực yêu cầu tới Gemini API. |
| `GEMINI_MODEL` | Không | `gemini-3.6-flash` | Tạo danh sách chủ đề mới. |
| `GEMINI_HINT_MODEL` | Không | `gemini-3.5-flash-lite` | Tạo gợi ý nghiên cứu và phản biện. |
| `GEMINI_SPEECH_MODEL` | Không | Theo `GEMINI_MODEL` | Phân tích audio và nhận xét bài nói. |
| `PORT` | Không | `3000` | Cổng HTTP khi chạy local. |

File `.env` hiện được track trong Git theo chủ đích của project. Khi sử dụng repository có nhiều thành viên hoặc quyền truy cập rộng, cần bảo đảm phạm vi và chính sách của API key phù hợp với môi trường đó.

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm start` | Nạp `.env` và khởi động HTTP server. |
| `npm run check` | Kiểm tra cú pháp của `server.mjs` và `server.ts`. |

## API nội bộ

### `POST /api/topics`

Tạo bộ đệm chủ đề mới bằng Gemini.

```json
{
  "mode": "cuff",
  "categoryId": "cong-nghe",
  "existingTopics": ["AI tạo sinh"]
}
```

### `POST /api/hint`

Tạo định nghĩa, từ khóa nghiên cứu và câu hỏi phản biện cho một chủ đề.

```json
{
  "topic": "Ảnh hưởng của AI tạo sinh đến giáo dục",
  "categoryId": "cong-nghe",
  "mode": "deep"
}
```

### `POST /api/speech-feedback`

Gửi audio trực tiếp trong request body để Gemini phân tích.

Query parameters:

| Tham số | Mô tả |
|---|---|
| `topic` | Chủ đề của bài nói. |
| `categoryId` | Mã danh mục. |
| `duration` | Thời lượng dự kiến, tính bằng giây. |

Các định dạng audio được hỗ trợ: WebM, OGG, MP4, WAV và MPEG. Kích thước request tối đa là 12 MB.

## Rubric nhận xét bài nói

Gemini chấm bốn tiêu chí trên thang 1–5:

| Tiêu chí | Trọng số | Nội dung đánh giá |
|---|---:|---|
| Rõ ràng | 30% | Luận điểm, cách dùng từ và mức độ dễ hiểu. |
| Cấu trúc | 25% | Trọng tâm, thứ tự ý, chuyển ý và kết thúc. |
| Lập luận | 25% | Quan hệ giữa kết luận, lý do, bằng chứng, giả định và giới hạn. |
| Truyền đạt | 20% | Tốc độ, ngắt nghỉ, từ đệm, nhấn ý và độ dễ nghe. |

Điểm tổng `/100` được backend tính từ bốn tiêu chí và chỉ nên được xem là chỉ báo tham khảo. Hệ thống không đánh giá giọng vùng miền, giới tính, tuổi hoặc chất giọng cá nhân.

## Cấu trúc project

```text
brainroot/
├── .env                 # Cấu hình runtime
├── .gitignore           # Quy tắc loại trừ file khỏi Git
├── package.json         # Scripts và metadata Node.js
├── README.md            # Tài liệu project
├── server.mjs           # HTTP handler, API và tích hợp Gemini
├── server.ts            # Entry tương thích Vercel
└── web_brainroot.html   # Giao diện và logic frontend
```

## Triển khai lên Vercel

1. Import repository GitHub vào Vercel.
2. Chọn nhánh triển khai, mặc định là `main`.
3. Bảo đảm runtime nhận được các biến cấu hình Gemini cần thiết.
4. Deploy project.

`server.ts` re-export handler từ `server.mjs` để Vercel nhận diện entry Node.js. Không cần frontend build command hoặc output directory riêng.

Sau mỗi thay đổi cấu hình runtime, tạo deployment mới để bảo đảm phiên bản mới nhận đúng giá trị.

## Quyền riêng tư và giới hạn

- Audio được giữ trong bộ nhớ để gửi tới Gemini và không được lưu thành file trên server.
- Nếu người dùng đóng màn hình trước khi hết thời gian, bản ghi hiện tại bị hủy.
- Nhận xét AI có thể sai hoặc thiếu ngữ cảnh; các mệnh đề được đánh dấu cần kiểm chứng không phải kết luận rằng người nói sai.
- Điểm số phụ thuộc vào chất lượng micro, tiếng ồn, độ dài bài nói và khả năng nhận diện audio của model.

## Kiểm tra trước khi deploy

```bash
npm run check
npm start
```

Sau khi server khởi động, mở `http://127.0.0.1:3000` và kiểm tra lần lượt chức năng quay chủ đề, gợi ý, ghi âm và nhận xét bài nói.
