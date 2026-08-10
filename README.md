# Brainroot Topic Spinner

Ứng dụng quay luân phiên giữa hai nguồn: một lượt từ danh sách có sẵn, một lượt từ Gemini, rồi lặp lại. Các chủ đề Gemini được giữ trong bộ đệm riêng và không sửa mảng danh sách gốc.

Sau khi quay, nút 💡 **Gợi ý** dùng Gemini để cung cấp định nghĩa ngắn, từ khóa nghiên cứu và ba câu hỏi phản biện cho chủ đề hiện tại. Kết quả được cache trong phiên để không gọi lại API khi mở cùng một chủ đề.

Khi bắt đầu phần **Nói**, trình duyệt sẽ xin quyền micro và ghi âm trong thời gian hẹn giờ. Hết giờ, bản ghi được gửi trực tiếp tới Gemini để chấm độ rõ ràng, cấu trúc, lập luận và cách truyền đạt; ứng dụng không lưu audio thành file trên server. Phần nhận xét đóng vai reviewer khó tính: dựng lại chuỗi lập luận, chỉ ra lỗi logic và thông tin cần kiểm chứng, đặt câu hỏi phản biện rồi viết lại lập luận chặt chẽ hơn. Nếu đóng màn hình trước khi hết giờ, bản ghi bị hủy và không được gửi phân tích.

## Chạy ứng dụng

1. Thu hồi khóa Gemini đã từng gửi hoặc dán công khai và tạo khóa mới.
2. Sao chép `.env.example` thành `.env`.
3. Điền khóa mới vào `GEMINI_API_KEY` trong `.env`.
4. Chạy `npm start`.
5. Mở `http://127.0.0.1:3000`.

Không mở trực tiếp `web_brainroot.html` nếu muốn dùng tính năng tạo chủ đề bằng Gemini. Khóa API chỉ được đọc bởi `server.mjs` và không được gửi xuống trình duyệt.
