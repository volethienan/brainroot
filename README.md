# Brainroot Topic Spinner

Ứng dụng quay luân phiên giữa hai nguồn: một lượt từ danh sách có sẵn, một lượt từ Gemini, rồi lặp lại. Các chủ đề Gemini được giữ trong bộ đệm riêng và không sửa mảng danh sách gốc.

Sau khi quay, nút 💡 **Gợi ý** dùng Gemini để cung cấp định nghĩa ngắn, từ khóa nghiên cứu và ba câu hỏi phản biện cho chủ đề hiện tại. Kết quả được cache trong phiên để không gọi lại API khi mở cùng một chủ đề.

Khi bắt đầu phần **Nói**, trình duyệt sẽ xin quyền micro và ghi âm trong thời gian hẹn giờ. Hết giờ, bản ghi được gửi trực tiếp tới Gemini để đánh giá độ rõ ràng, cấu trúc, lập luận và cách truyền đạt theo thang 1–5 có mô tả; ứng dụng không lưu audio thành file trên server. Điểm tổng 100 chỉ là chỉ báo tham khảo được tính từ bốn tiêu chí. Phản hồi nêu chất lượng audio và độ tin cậy, ưu tiên một hoặc hai điểm cần luyện, chỉ gắn vấn đề lập luận khi có bằng chứng rõ và coi thông tin chưa chắc là mệnh đề cần kiểm chứng thay vì kết luận sai. Nếu đóng màn hình trước khi hết giờ, bản ghi bị hủy và không được gửi phân tích.

## Chạy ứng dụng

1. Mở file `.env` đã có trong project.
2. Điền cấu hình Gemini cần dùng.
3. Chạy `npm start`.
4. Mở `http://127.0.0.1:3000`.

Không mở trực tiếp `web_brainroot.html` nếu muốn dùng tính năng tạo chủ đề bằng Gemini. Khóa API chỉ được đọc bởi `server.mjs` và không được gửi xuống trình duyệt.

## Deploy lên Vercel

Vercel tự nhận `server.ts` ở thư mục gốc làm Node server entry. File này nạp server hiện có từ `server.mjs`, nên không cần đặt Build Command hoặc Output Directory.

Project hiện track file `.env` trong Git theo chủ đích của chủ project. Nếu sử dụng Vercel Environment Variables thay cho file này, tối thiểu cần cấu hình `GEMINI_API_KEY` rồi deploy lại project.
