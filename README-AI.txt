Trợ lý AI trong EduGDTX
=======================
Các tính năng AI (trợ lý ôn tập cho học sinh, AI gợi ý nhận xét, AI soạn câu hỏi) CẦN có khóa API của Anthropic (Claude) do chính trung tâm đăng ký và tự trả phí sử dụng. EduGDTX không đi kèm sẵn khóa API nào.

Cách bật:
 1. Đăng ký và lấy khóa API tại https://console.anthropic.com
 2. Trước khi chạy "npm start", đặt biến môi trường ANTHROPIC_API_KEY:
      Windows (cmd):   set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx && npm start
      Windows (PowerShell): $env:ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"; npm start
      macOS/Linux:     ANTHROPIC_API_KEY=sk-ant-xxxxxxxx npm start
 3. Trang "Quản lý" của admin sẽ hiện "🤖 Trợ lý AI: Đã bật" khi cấu hình đúng.

Nếu không cấu hình, các nút AI vẫn hiện trên giao diện nhưng sẽ báo lỗi rõ ràng khi bấm, không ảnh hưởng tới các chức năng khác của web.

Mỗi lượt gọi AI sẽ tính phí trên tài khoản Anthropic của trung tâm theo giá hiện hành của họ.
