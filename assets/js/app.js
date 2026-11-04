// Khởi tạo Supabase Client
const SUPABASE_URL = 'https://shwkrrcvbmbrjzxgoiwt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3dBkTWNW_4xgzeZzTSa0ig_RFkSjO0a';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentEmployeesData = [];

// 1. Xử lý sự kiện Đăng nhập
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const alertDiv = document.getElementById('login-alert');

  alertDiv.innerHTML = '<div class="alert alert-info py-2">Đang xác thực...</div>';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    alertDiv.innerHTML = `<div class="alert alert-danger py-2">${error.message}</div>`;
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

// 3. Kiểm tra Session Đăng nhập
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    document.getElementById('login-section').classList.add('d-none');
    document.getElementById('app-section').classList.remove('d-none');
    document.getElementById('user-info').innerText = `Tài khoản: ${session.user.email}`;
    
    // Tải danh sách nhân sự
    loadEmployees();
  } else {
    document.getElementById('login-section').classList.remove('d-none');
    document.getElementById('app-section').classList.add('d-none');
  }
}

// 4. Tải danh sách nhân sự từ Supabase (Được bảo vệ bởi RLS)
async function loadEmployees() {
  const tbody = document.getElementById('employee-table-body');
  const { data, error } = await supabaseClient
    .from('employees')
    .select('*')
    .order('employee_code', { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">Lỗi tải dữ liệu: ${error.message}</td></tr>`;
    return;
  }

  currentEmployeesData = data;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Chưa có dữ liệu nhân sự nào trong hệ thống.</td></tr>`;
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

// 5. Chức năng Xuất file Excel
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

// Chạy kiểm tra đăng nhập ngay khi tải trang
checkAuth();
