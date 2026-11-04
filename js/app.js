// ==========================================================================
// TLG HRM - APPLICATION LOGIC & PORTAL MANAGEMENT
// ==========================================================================

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

    if (portal === 'HRM') {
        loadLegalEntities();
        loadEmployees();
    }
}

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
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-rose-500">Lỗi khi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

async function loadEmployees() {
    const tbody = document.getElementById('employees-table-body');
    try {
        const { data, error } = await _supabase
            .from('employee_contracts')
            .select(`
                *,
                employees ( * ),
                legal_entities ( entity_code, entity_name ),
                salary_structures ( * )
            `)
            .eq('is_active', true)
            .order('employee_id');

        if (error) throw error;
        window._tlgEmployees = data; // Lưu cache toàn bộ nhân sự để lọc

        renderEmployeesTable(data);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500">Lỗi khi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

// Render bảng danh sách nhân sự
function renderEmployeesTable(data) {
    const tbody = document.getElementById('employees-table-body');
    if (data && data.length > 0) {
        tbody.innerHTML = data.map((item, index) => {
            // Tìm index thực tế trong mảng gốc window._tlgEmployees
            const originalIndex = window._tlgEmployees.findIndex(e => e.contract_id === item.contract_id);
            return `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-3 font-mono font-bold text-blue-600">${item.employees?.employee_id || 'N/A'}</td>
                    <td class="p-3 font-medium text-slate-800">${item.employees?.full_name || 'N/A'}</td>
                    <td class="p-3"><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded font-bold text-xs">${item.legal_entities?.entity_code || 'N/A'}</span></td>
                    <td class="p-3 text-slate-700">${item.job_title || 'N/A'}</td>
                    <td class="p-3 text-slate-600">${item.department_name || 'N/A'}</td>
                    <td class="p-3">
                        <button onclick="viewEmployeeDetail(${originalIndex})" class="px-3 py-1 bg-blue-50 text-blue-600 rounded font-semibold hover:bg-blue-100 text-xs">Xem Chi Tiết & Lương</button>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Không tìm thấy nhân sự phù hợp.</td></tr>';
    }
}

// Xử lý tìm kiếm và lọc danh sách nhân sự
function filterEmployees() {
    const keyword = document.getElementById('search-input').value.toLowerCase().trim();
    const selectedEntity = document.getElementById('filter-entity').value;

    if (!window._tlgEmployees) return;

    const filtered = window._tlgEmployees.filter(item => {
        const empId = (item.employees?.employee_id || '').toLowerCase();
        const fullName = (item.employees?.full_name || '').toLowerCase();
        const entityCode = item.legal_entities?.entity_code || '';

        const matchKeyword = empId.includes(keyword) || fullName.includes(keyword);
        const matchEntity = selectedEntity === '' || entityCode === selectedEntity;

        return matchKeyword && matchEntity;
    });

    renderEmployeesTable(filtered);
}

// Xem chi tiết hồ sơ & biểu lương C&B trong Modal
function viewEmployeeDetail(index) {
    const item = window._tlgEmployees[index];
    const emp = item.employees || {};
    const sal = (item.salary_structures && item.salary_structures.length > 0) ? item.salary_structures[0] : {};
    const content = document.getElementById('modal-content');

    const formatMoney = (val) => val ? Number(val).toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';

    content.innerHTML = `
        <!-- Phần 1: Thông tin nhân thân -->
        <div>
            <h4 class="font-bold text-slate-700 mb-2 border-b pb-1">1. Thông Tin Định Danh & Liên Lạc</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div><span class="text-slate-500">Mã NV:</span> <strong class="text-slate-800">${emp.employee_id || 'N/A'}</strong></div>
                <div><span class="text-slate-500">Họ và tên:</span> <strong class="text-slate-800">${emp.full_name || 'N/A'}</strong></div>
                <div><span class="text-slate-500">SĐT Di động:</span> <span class="text-slate-800">${emp.mobile_phone || emp.phone_number || 'N/A'}</span></div>
                <div><span class="text-slate-500">Email:</span> <span class="text-slate-800">${emp.email || 'N/A'}</span></div>
                <div><span class="text-slate-500">Số CCCD / CMND:</span> <span class="text-slate-800">${emp.id_card_number || 'N/A'}</span></div>
                <div><span class="text-slate-500">Mã số thuế:</span> <span class="text-slate-800">${emp.tax_code || 'N/A'}</span></div>
                <div class="col-span-2"><span class="text-slate-500">Địa chỉ thường trú:</span> <span class="text-slate-800">${emp.permanent_address || 'N/A'}</span></div>
            </div>
        </div>

        <!-- Phần 2: Thông tin Hợp đồng & Công tác -->
        <div>
            <h4 class="font-bold text-slate-700 mb-2 border-b pb-1">2. Quan Hệ Công Tác & Hợp Đồng</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div><span class="text-slate-500">Pháp nhân:</span> <strong class="text-blue-600">${item.legal_entities?.entity_name || 'N/A'}</strong></div>
                <div><span class="text-slate-500">Số HĐLĐ:</span> <span class="text-slate-800">${item.contract_number || 'N/A'}</span></div>
                <div><span class="text-slate-500">Chức danh:</span> <span class="text-slate-800">${item.job_title || 'N/A'}</span></div>
                <div><span class="text-slate-500">Phòng ban:</span> <span class="text-slate-800">${item.department_name || 'N/A'}</span></div>
            </div>
        </div>

        <!-- Phần 3: Cấu trúc Lương C&B mới -->
        <div>
            <h4 class="font-bold text-slate-700 mb-2 border-b pb-1">3. Cấu Trúc Lương C&B (Tách biệt BHBB & Phúc Lợi)</h4>
            <div class="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border">
                <div>
                    <p class="font-semibold text-slate-700 mb-2">Các khoản đóng BHBB:</p>
                    <ul class="space-y-1 text-slate-600 text-xs">
                        <li>- Lương chính: <span class="font-bold text-slate-800">${formatMoney(sal.base_salary)}</span></li>
                        <li>- PC Độc hại (15%): <span class="font-bold text-slate-800">${formatMoney(sal.allowance_toxic_15)}</span></li>
                        <li>- PC Chuyên môn: <span class="font-bold text-slate-800">${formatMoney(sal.allowance_specialized_tech)}</span></li>
                        <li>- Lương năng lực: <span class="font-bold text-slate-800">${formatMoney(sal.capacity_salary)}</span></li>
                        <li>- PC Trách nhiệm/Chức vụ: <span class="font-bold text-slate-800">${formatMoney(sal.allowance_position)}</span></li>
                        <li>- PC Thâm niên: <span class="font-bold text-slate-800">${formatMoney(sal.allowance_seniority)}</span></li>
                    </ul>
                    <p class="mt-2 text-xs font-bold text-blue-700">Tổng quỹ BHBB: ${formatMoney(sal.total_bhbb_salary)}</p>
                </div>
                <div>
                    <p class="font-semibold text-slate-700 mb-2">Phúc lợi (Không đóng BHBB):</p>
                    <ul class="space-y-1 text-slate-600 text-xs">
                        <li>- Hỗ trợ ăn ca: <span class="font-bold text-slate-800">${formatMoney(sal.allowance_meal)}</span></li>
                        <li>- Hỗ trợ nhà ở: <span class="font-bold text-slate-800">${formatMoney(sal.allowance_housing)}</span></li>
                        <li>- Hỗ trợ xăng xe: <span class="font-bold text-slate-800">${formatMoney(sal.allowance_transport)}</span></li>
                        <li>- Hỗ trợ chuyên cần: <span class="font-bold text-slate-800">${formatMoney(sal.allowance_attendance)}</span></li>
                    </ul>
                    <p class="mt-8 text-xs font-bold text-emerald-700">Tổng thu nhập: ${formatMoney(sal.total_income)}</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('employee-modal').classList.remove('hidden');
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    checkConnection();
});
