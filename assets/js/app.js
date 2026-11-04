/* ==========================================
   LOGIC JAVASCRIPT CHÍNH CHO HỆ THỐNG HRM
   ========================================== */

// Khởi tạo Supabase Client
const SUPABASE_URL = 'https://shwkrrcvbmbrjzxgoiwt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3dBkTWNW_4xgzeZzTSa0ig_RFkSjO0a';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentEmployeesData = [];

// 1. Xử lý sự kiện Đăng nhập
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const alertDiv = document.getElementById('login-alert');

  alertDiv.innerHTML = '<div class="alert alert-info py-2">Đang xác thực hệ thống...</div>';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    alertDiv.innerHTML = `<div class="alert alert-danger py-2">Lỗi đăng nhập: ${error.message}</div>`;
  } else {
    alertDiv.innerHTML = '';
    checkAuth();
  }
});

// 2. Xử lý sự kiện Đăng xuất
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  checkAuth();
});

// 3. Kiểm tra trạng thái Session Đăng nhập
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    document.getElementById('login-section').classList.add('d-none');
    document.getElementById('app-section').classList.remove('d-none');
    document.getElementById('user-info').innerText = `Tài khoản: ${session.user.email}`;
    
    // Tải danh sách nhân sự ngay khi vào hệ thống
    loadEmployees();
  } else {
    document.getElementById('login-section').classList.remove('d-none');
    document.getElementById('app-section').classList.add('d-none');
  }
}

// 4. Tải danh sách nhân sự từ Supabase (Được bảo vệ tuyệt đối bởi RLS)
async function loadEmployees() {
  const tbody = document.getElementById('employee-table-body');
  const { data, error } = await supabaseClient
    .from('employees')
    .select('*')
    .order('employee_code', { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Lỗi tải dữ liệu: ${error.message}</td></tr>`;
    return;
  }

  currentEmployeesData = data;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Chưa có dữ liệu nhân sự nào trong hệ thống.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  data.forEach(emp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ps-3"><span class="fw-bold text-primary">${emp.employee_code || ''}</span></td>
      <td>${emp.full_name || ''}</td>
      <td>${emp.email || ''}</td>
      <td><span class="badge bg-secondary">${emp.role || 'EMPLOYEE'}</span></td>
      <td>${emp.job_title || '-'}</td>
      <td><span class="badge ${emp.status === 'ACTIVE' ? 'bg-success' : 'bg-warning'}">${emp.status || 'ACTIVE'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 5. Xử lý Thêm nhân sự mới (Hỗ trợ định dạng mã nhân viên 5 chữ số 00000)
document.getElementById('add-employee-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  let empCode = document.getElementById('new-emp-code').value.trim();
  const fullName = document.getElementById('new-emp-name').value.trim();
  const email = document.getElementById('new-emp-email').value.trim();
  const password = document.getElementById('new-emp-password').value.trim();
  const role = document.getElementById('new-emp-role').value;
  const alertDiv = document.getElementById('add-emp-alert');

  // Chuẩn hóa mã nhân viên sang định dạng 5 chữ số nếu người dùng tự nhập dạng số (ví dụ: '1' -> '00001')
  if (empCode !== "" && /^\d+$/.test(empCode)) {
    empCode = empCode.padStart(5, '0');
  }

  alertDiv.innerHTML = '<div class="alert alert-info py-2">Đang xử lý tạo tài khoản và phân quyền...</div>';

  // Gọi Supabase Auth để đăng ký user mới, truyền metadata sang Database Trigger
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: fullName,
        role: role,
        employee_code: empCode // Truyền mã nhân viên sang trigger SQL
      }
    }
  });

  if (error) {
    alertDiv.innerHTML = `<div class="alert alert-danger py-2">Lỗi: ${error.message}</div>`;
  } else {
    alertDiv.innerHTML = `<div class="alert alert-success py-2">Thêm nhân sự thành công!</div>`;
    document.getElementById('add-employee-form').reset();
    
    // Đóng Modal và tải lại danh sách sau 1.2 giây
    setTimeout(() => {
      loadEmployees();
      alertDiv.innerHTML = '';
      const modalEl = document.getElementById('addEmployeeModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      modal.hide();
    }, 1200);
  }
});

// 6. Chức năng Xuất file Excel báo cáo danh sách nhân sự
document.getElementById('export-excel-btn').addEventListener('click', () => {
  if (!currentEmployeesData || currentEmployeesData.length === 0) {
    alert('Không có dữ liệu để xuất!');
    return;
  }

  const excelData = currentEmployeesData.map((emp, index) => ({
    "STT": index + 1,
    "Mã NV": emp.employee_code,
    "Họ và Tên": emp.full_name,
    "Email": emp.email,
    "Phân quyền (Role)": emp.role,
    "Chức danh": emp.job_title || "",
    "Trạng thái": emp.status,
    "Ngày vào làm": emp.joined_date || ""
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachNhanSu");

  XLSX.writeFile(workbook, `DanhSachNhanSu_TLG_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// Tự động kiểm tra trạng thái đăng nhập khi tải trang
checkAuth();
