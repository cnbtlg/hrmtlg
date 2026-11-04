// ==========================================================================
// TLG HRM - APPLICATION LOGIC & PORTAL MANAGEMENT
// ==========================================================================

// Chuyển đổi giao diện giữa ESS, MSS và HRM Admin
function switchPortal(portal) {
    document.querySelectorAll('.portal-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`portal-${portal.toLowerCase()}`).classList.remove('hidden');

    const btnEss = document.getElementById('btn-ess');
    const btnMss = document.getElementById('btn-mss');
    const btnHrm = document.getElementById('btn-hrm');

    const activeClass = 'bg-blue-600 text-white shadow';
    const inactiveClass = 'text-slate-300 hover:text-white';

    btnEss.className = `px-4 py-1.5 rounded-md text-sm font-semibold transition ${portal === 'ESS' ? activeClass : inactiveClass}`;
    btnMss.className = `px-4 py-1.5 rounded-md text-sm font-semibold transition ${portal === 'MSS' ? activeClass : inactiveClass}`;
    btnHrm.className = `px-4 py-1.5 rounded-md text-sm font-semibold transition ${portal === 'HRM' ? activeClass : inactiveClass}`;

    document.getElementById('portal-badge').innerText = `Giao diện: ${portal}`;

    // Nếu vào phân hệ HRM Admin thì load danh sách pháp nhân và nhân sự
    if (portal === 'HRM') {
        loadLegalEntities();
        loadEmployees();
    }
}

// Kiểm tra kết nối Database Supabase khi tải trang
async function checkConnection() {
    try {
        const { data, error } = await _supabase.from('legal_entities').select('*');
        if (error) throw error;

        document.getElementById('db-status').innerText = 'Kết nối HRM thành công!';
        document.getElementById('db-status').className = 'ml-2 font-bold text-emerald-600';
    } catch (err) {
        console.error(err);
        document.getElementById('db-status').innerText = 'Lỗi kết nối Database!';
        document.getElementById('db-status').className = 'ml-2 font-bold text-rose-600';
    }
}

// Truy xuất danh mục pháp nhân (legal_entities) cho trang HRM Admin
async function loadLegalEntities() {
    const tbody = document.getElementById('entities-table-body');
    try {
        const { data, error } = await _supabase.from('legal_entities').select('*').order('entity_id');
        if (error) throw error;

        if (data && data.length > 0) {
            tbody.innerHTML = data.map(item => `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-3 font-mono text-slate-500">${item.entity_id}</td>
                    <td class="p-3 font-bold text-blue-600">${item.entity_code}</td>
                    <td class="p-3 font-medium text-slate-800">${item.entity_name}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Chưa có dữ liệu pháp nhân.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-rose-500">Lỗi khi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

// Truy xuất danh sách nhân sự kết hợp hợp đồng và pháp nhân
async function loadEmployees() {
    const tbody = document.getElementById('employees-table-body');
    try {
        const { data, error } = await _supabase
            .from('employee_contracts')
            .select(`
                *,
                employees ( * ),
                legal_entities ( entity_code, entity_name )
            `)
            .eq('is_active', true)
            .order('employee_id');

        if (error) throw error;

        window._tlgEmployees = data; // Lưu cache để xem chi tiết modal

        if (data && data.length > 0) {
            tbody.innerHTML = data.map((item, index) => `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-3 font-mono font-bold text-blue-600">${item.employees?.employee_id}</td>
                    <td class="p-3 font-medium text-slate-800">${item.employees?.full_name}</td>
                    <td class="p-3"><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded font-bold text-xs">${item.legal_entities?.entity_code}</span></td>
                    <td class="p-3 text-slate-700">${item.job_title}</td>
                    <td class="p-3 text-slate-600">${item.department_name}</td>
                    <td class="p-3">
                        <button onclick="viewEmployeeDetail(${index})" class="px-3 py-1 bg-blue-50 text-blue-600 rounded font-semibold hover:bg-blue-100 text-xs">Xem Chi Tiết</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Chưa có dữ liệu nhân sự.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500">Lỗi khi tải dữ liệu nhân sự: ${err.message}</td></tr>`;
    }
}

// Xem chi tiết hồ sơ nhân sự dạng Modal
function viewEmployeeDetail(index) {
    const item = window._tlgEmployees[index];
    const emp = item.employees || {};
    const content = document.getElementById('modal-content');

    content.innerHTML = `
        <div><span class="text-slate-500">Mã nhân viên:</span> <p class="font-bold text-slate-800">${emp.employee_id || 'N/A'}</p></div>
        <div><span class="text-slate-500">Họ và tên:</span> <p class="font-bold text-slate-800">${emp.full_name || 'N/A'}</p></div>
        <div><span class="text-slate-500">Ngày sinh:</span> <p class="font-semibold text-slate-800">${emp.date_of_birth || 'N/A'}</p></div>
        <div><span class="text-slate-500">Giới tính:</span> <p class="font-semibold text-slate-800">${emp.gender || 'N/A'}</p></div>
        <div><span class="text-slate-500">Số điện thoại di động:</span> <p class="font-semibold text-slate-800">${emp.mobile_phone || emp.phone_number || 'N/A'}</p></div>
        <div><span class="text-slate-500">Email cá nhân / Công ty:</span> <p class="font-semibold text-slate-800">${emp.email_personal || emp.email || 'N/A'}</p></div>
        <div><span class="text-slate-500">Số CCCD / CMND:</span> <p class="font-semibold text-slate-800">${emp.id_card_number || 'N/A'}</p></div>
        <div><span class="text-slate-500">Mã số thuế:</span> <p class="font-semibold text-slate-800">${emp.tax_code || 'N/A'}</p></div>
        <div class="col-span-2"><span class="text-slate-500">Địa chỉ thường trú:</span> <p class="font-semibold text-slate-800">${emp.permanent_address || 'N/A'} (${emp.permanent_province || ''})</p></div>
        <div><span class="text-slate-500">Pháp nhân công tác:</span> <p class="font-semibold text-blue-600">${item.legal_entities?.entity_name || 'N/A'}</p></div>
        <div><span class="text-slate-500">Chức danh / Vị trí:</span> <p class="font-semibold text-slate-800">${item.job_title || 'N/A'}</p></div>
    `;

    document.getElementById('employee-modal').classList.remove('hidden');
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.add('hidden');
}

// Khởi chạy khi tải xong DOM
document.addEventListener('DOMContentLoaded', () => {
    checkConnection();
});
