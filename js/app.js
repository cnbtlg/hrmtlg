// ==========================================================================
// TLG HRM - FULL APPLICATION LOGIC & ADVANCED AND/OR FILTERS
// ==========================================================================

window._tlgSession = {
    role: 'MSS_ADMIN_CB', 
    employeeId: '00608',
    fullName: 'Tam Thanh Tuấn',
    scope: 'ALL'
};

function formatDateVN(dateStr) {
    if (!dateStr) return 'N/A';
    const cleanDate = String(dateStr).split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

function changeMockRole(roleVal) {
    window._tlgSession.role = roleVal;
    if (roleVal === 'MSS_ADMIN_CB' || roleVal === 'ESS_608') {
        window._tlgSession.employeeId = '00608';
        window._tlgSession.fullName = 'Tam Thanh Tuấn';
    } else {
        window._tlgSession.employeeId = '00001';
        window._tlgSession.fullName = 'Nguyễn Duy Phương';
    }

    const roleLabels = {
        'MSS_ADMIN_CB': '00608 - Tam Thanh Tuấn (C&B Admin / Toàn quyền)',
        'MSS_MANAGER_DIRECT': 'Quản lý Trực tiếp (Cây cấp 1)',
        'MSS_MANAGER_SKIP': 'Quản lý Cấp cao (Cây đệ quy đa cấp)',
        'MSS_ADMIN_LK': 'Admin Nhà máy LK (Luyện Kim)',
        'MSS_ADMIN_MD': 'Admin Nhà máy MD (Môi Trường)',
        'MSS_ADMIN_LOGISTICS': 'Admin Đội xe Vận tải',
        'ESS_608': '00608 - Tam Thanh Tuấn (ESS Cá nhân)'
    };
    document.getElementById('current-user-role-label').innerText = roleLabels[roleVal] || roleVal;
    alert(`Đã chuyển ngữ cảnh quyền thành: ${roleLabels[roleVal]}`);
}

function switchPortal(portal) {
    if (portal === 'MSS' && window._tlgSession.role === 'ESS_608' && window._tlgSession.role !== 'MSS_ADMIN_CB') {
        alert('Tài khoản ESS cá nhân không có quyền truy cập phân hệ Quản lý (MSS)!');
        return;
    }
    if (portal === 'HRM' && window._tlgSession.role !== 'MSS_ADMIN_CB' && window._tlgSession.role !== 'HRM') {
        alert('Chỉ duy nhất C&B Admin (NV 00608) hoặc System Admin mới có quyền mở phân hệ Quản trị hệ thống!');
        return;
    }

    document.querySelectorAll('.portal-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`portal-${portal.toLowerCase()}`).classList.remove('hidden');

    const btnEss = document.getElementById('btn-ess');
    const btnMss = document.getElementById('btn-mss');
    const btnHrm = document.getElementById('btn-hrm');

    const activeClass = 'bg-blue-600 text-white shadow';
    const inactiveClass = 'text-slate-300 hover:text-white';

    btnEss.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition ${portal === 'ESS' ? activeClass : inactiveClass}`;
    btnMss.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition ${portal === 'MSS' ? activeClass : inactiveClass}`;
    btnHrm.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition ${portal === 'HRM' ? activeClass : inactiveClass}`;

    document.getElementById('portal-badge').innerText = `Giao diện: ${portal}`;

    if (portal === 'HRM') {
        loadEmployees();
    } else if (portal === 'MSS') {
        loadMSSLeaveRequests();
        loadMSSProposals();
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
        window._tlgEmployees = data;
        renderEmployeesTable(data);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500">Lỗi tải Master Data: ${err.message}</td></tr>`;
    }
}

function renderEmployeesTable(data) {
    const tbody = document.getElementById('employees-table-body');
    if (data && data.length > 0) {
        tbody.innerHTML = data.map((item) => {
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
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Không tìm thấy nhân sự phù hợp với điều kiện lọc.</td></tr>';
    }
}

// BỘ LỌC NÂNG CAO KẾT HỢP TOÁN TỬ AND / OR
function applyAdvancedFilter() {
    if (!window._tlgEmployees) return;

    const keyword = document.getElementById('adv-keyword').value.toLowerCase().trim();
    const selectedEntity = document.getElementById('adv-entity').value;
    const operator = document.getElementById('adv-operator').value; // 'AND' hoặc 'OR'
    const deptKeyword = document.getElementById('adv-department').value.toLowerCase().trim();

    const filtered = window._tlgEmployees.filter(item => {
        const empId = (item.employees?.employee_id || '').toLowerCase();
        const fullName = (item.employees?.full_name || '').toLowerCase();
        const entityCode = item.legal_entities?.entity_code || '';
        const deptName = (item.department_name || '').toLowerCase();

        const matchKeyword = (keyword === '' || empId.includes(keyword) || fullName.includes(keyword));
        const matchEntity = (selectedEntity === '' || entityCode === selectedEntity);
        const matchDept = (deptKeyword === '' || deptName.includes(deptKeyword));

        if (keyword === '' && selectedEntity === '' && deptKeyword === '') {
            return true;
        }

        if (operator === 'AND') {
            let pass = true;
            if (keyword !== '' && !matchKeyword) pass = false;
            if (selectedEntity !== '' && !matchEntity) pass = false;
            if (deptKeyword !== '' && !matchDept) pass = false;
            return pass;
        } else {
            let pass = false;
            if (keyword !== '' && matchKeyword) pass = true;
            if (selectedEntity !== '' && matchEntity) pass = true;
            if (deptKeyword !== '' && matchDept) pass = true;
            return pass;
        }
    });

    renderEmployeesTable(filtered);
}

function resetAdvancedFilter() {
    document.getElementById('adv-keyword').value = '';
    document.getElementById('adv-entity').value = '';
    document.getElementById('adv-operator').value = 'AND';
    document.getElementById('adv-department').value = '';
    renderEmployeesTable(window._tlgEmployees);
}

function viewEmployeeDetail(index) {
    const item = window._tlgEmployees[index];
    const emp = item.employees || {};
    const sal = (item.salary_structures && item.salary_structures.length > 0) ? item.salary_structures[0] : {};
    const content = document.getElementById('modal-content');
    const formatMoney = (val) => val ? Number(val).toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';

    const baseSal = Number(sal.base_salary || 0);
    const posAllow = Number(sal.allowance_position || 0);
    const toxicAllow = Number(sal.allowance_toxic_15 || 0);
    const specAllow = Number(sal.allowance_specialized_tech || 0);
    const capSal = Number(sal.capacity_salary || 0);
    const senAllow = Number(sal.allowance_seniority || 0);

    const totalBHBB = baseSal + posAllow + toxicAllow + specAllow + capSal + senAllow;

    const mealAllow = Number(sal.allowance_meal || 0);
    const houseAllow = Number(sal.allowance_housing || 0);
    const transAllow = Number(sal.allowance_transport || 0);
    const attAllow = Number(sal.allowance_attendance || 0);

    const totalIncome = totalBHBB + mealAllow + houseAllow + transAllow + attAllow;

    content.innerHTML = `
        <div>
            <h4 class="font-bold text-slate-700 mb-2 border-b pb-1 text-sm">1. Thông Tin Định Danh & Liên Lạc</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div><span class="text-slate-500">Mã NV:</span> <strong class="text-slate-800">${emp.employee_id || 'N/A'}</strong></div>
                <div><span class="text-slate-500">Họ và tên:</span> <strong class="text-slate-800">${emp.full_name || 'N/A'}</strong></div>
                <div><span class="text-slate-500">Ngày sinh:</span> <span class="text-slate-800">${formatDateVN(emp.date_of_birth)}</span></div>
                <div><span class="text-slate-500">SĐT Di động:</span> <span class="text-slate-800">${emp.mobile_phone || 'N/A'}</span></div>
                <div><span class="text-slate-500">Email:</span> <span class="text-slate-800">${emp.email || 'N/A'}</span></div>
                <div><span class="text-slate-500">Số CCCD:</span> <span class="text-slate-800">${emp.id_card_number || 'N/A'}</span></div>
                <div><span class="text-slate-500">Mã số thuế:</span> <span class="text-slate-800">${emp.tax_code || 'N/A'}</span></div>
                <div class="col-span-2"><span class="text-slate-500">Địa chỉ:</span> <span class="text-slate-800">${emp.permanent_address || 'N/A'}</span></div>
            </div>
        </div>
        <div>
            <h4 class="font-bold text-slate-700 mb-2 border-b pb-1 text-sm">2. Quan Hệ Công Tác & Hợp Đồng</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div><span class="text-slate-500">Pháp nhân:</span> <strong class="text-blue-600">${item.legal_entities?.entity_name || 'N/A'}</strong></div>
                <div><span class="text-slate-500">Số HĐLĐ:</span> <span class="text-slate-800">${item.contract_number || 'N/A'}</span></div>
                <div><span class="text-slate-500">Chức danh:</span> <span class="text-slate-800">${item.job_title || 'N/A'}</span></div>
                <div><span class="text-slate-500">Phòng ban:</span> <span class="text-slate-800">${item.department_name || 'N/A'}</span></div>
            </div>
        </div>
        <div>
            <h4 class="font-bold text-slate-700 mb-2 border-b pb-1 text-sm">3. Cơ Cấu Lương C&B Chi Tiết</h4>
            <div class="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border">
                <div class="space-y-2 border-r pr-3">
                    <p class="font-semibold text-slate-700 text-xs uppercase">Các khoản tính đóng BHBB:</p>
                    <ul class="space-y-1 text-slate-600 text-xs">
                        <li>- Lương chính: <span class="font-bold text-slate-800">${formatMoney(baseSal)}</span></li>
                        <li>- PC Trách nhiệm: <span class="font-bold text-slate-800">${formatMoney(posAllow)}</span></li>
                        ${toxicAllow > 0 ? `<li>- PC Độc hại (15%): <span class="font-bold text-slate-800">${formatMoney(toxicAllow)}</span></li>` : ''}
                    </ul>
                    <div class="pt-2 border-t">
                        <span class="text-xs font-semibold text-blue-700">TỔNG CĂN CỨ ĐÓNG BHBB:</span>
                        <strong class="block text-sm text-blue-900 font-bold">${formatMoney(totalBHBB)}</strong>
                    </div>
                </div>
                <div class="space-y-2 pl-1">
                    <p class="font-semibold text-slate-700 text-xs uppercase">Khoản Phúc lợi:</p>
                    <ul class="space-y-1 text-slate-600 text-xs">
                        <li>- Phụ cấp nhà ở: <span class="font-bold text-slate-800">${formatMoney(houseAllow)}</span></li>
                        <li>- Phụ cấp xăng xe: <span class="font-bold text-slate-800">${formatMoney(transAllow)}</span></li>
                        <li>- Phụ cấp chuyên cần: <span class="font-bold text-slate-800">${formatMoney(attAllow)}</span></li>
                    </ul>
                    <div class="pt-2 border-t">
                        <span class="text-xs font-semibold text-emerald-700">TỔNG THU NHẬP (3P):</span>
                        <strong class="block text-sm text-emerald-900 font-bold">${formatMoney(totalIncome)}</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('employee-modal').classList.remove('hidden');
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.add('hidden');
}

// ==========================================================================
// CÔNG CỤ EXPORT / IMPORT EXCEL & TẢI FILE MẪU CHUẨN
// ==========================================================================

function downloadExcelTemplate() {
    const templateData = [{
        "Mã NV": "00609",
        "Họ và Tên": "Nguyễn Văn A",
        "Ngày Sinh (DD-MM-YYYY)": "15-05-1990",
        "Giới Tính": "Nam",
        "Điện Thoại": "0901234567",
        "Email": "anv@tlmetals.vn",
        "Số CCCD": "079090012345",
        "Mã Số Thuế": "8281234567",
        "Địa Chỉ": "123 Nguyễn Trãi, Quận 5, TP.HCM",
        "Pháp Nhân (TL/MD/KT/XM)": "TL",
        "Số HĐLĐ": "00609-1/HDLD-TL",
        "Chức Danh": "Kỹ thuật viên vận hành",
        "Phòng Ban": "Xưởng Luyện Kim",
        "Lương Chính (BHBB)": 15000000,
        "PC Trách Nhiệm": 2000000,
        "PC Độc Hại 15%": 1500000,
        "PC Nhà Ở": 800000,
        "PC Xăng Xe": 500000,
        "PC Chuyên Cần": 500000
    }];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template_MasterData");
    XLSX.writeFile(workbook, "TLG_HRM_Import_Template.xlsx");
}

function exportMasterDataExcel() {
    if (!window._tlgEmployees || window._tlgEmployees.length === 0) {
        alert('Không có dữ liệu nhân sự để xuất Excel!');
        return;
    }

    const exportData = window._tlgEmployees.map(item => {
        const emp = item.employees || {};
        const sal = (item.salary_structures && item.salary_structures.length > 0) ? item.salary_structures[0] : {};
        return {
            "Mã NV": emp.employee_id || '',
            "Họ và Tên": emp.full_name || '',
            "Ngày Sinh": formatDateVN(emp.date_of_birth),
            "Giới Tính": emp.gender || '',
            "Điện Thoại": emp.mobile_phone || '',
            "Email": emp.email || '',
            "Số CCCD": emp.id_card_number || '',
            "Mã Số Thuế": emp.tax_code || '',
            "Địa Chỉ": emp.permanent_address || '',
            "Pháp Nhân": item.legal_entities?.entity_code || '',
            "Số HĐLĐ": item.contract_number || '',
            "Chức Danh": item.job_title || '',
            "Phòng Ban": item.department_name || '',
            "Lương Chính (BHBB)": sal.base_salary || 0,
            "PC Trách Nhiệm": sal.allowance_position || 0,
            "PC Độc Hại 15%": sal.allowance_toxic_15 || 0,
            "PC Nhà Ở": sal.allowance_housing || 0,
            "PC Xăng Xe": sal.allowance_transport || 0,
            "PC Chuyên Cần": sal.allowance_attendance || 0
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TLG_MasterData_CB");
    
    const dateStr = formatDateVN(new Date().toISOString().slice(0, 10));
    XLSX.writeFile(workbook, `TLG_HRM_MasterData_${dateStr}.xlsx`);
}

function importMasterDataExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet);

            if (!jsonRows || jsonRows.length === 0) {
                alert('File Excel không có dữ liệu!');
                return;
            }

            if (confirm(`Đã đọc thành công ${jsonRows.length} dòng từ file Excel. Bạn có muốn đồng bộ dữ liệu không?`)) {
                let countSuccess = 0;
                for (let row of jsonRows) {
                    const empId = String(row["Mã NV"] || '').trim();
                    if (!empId) continue;

                    let rawDob = row["Ngày Sinh (DD-MM-YYYY)"] || row["Ngày Sinh"] || '';
                    let dbDob = null;
                    if (rawDob) {
                        const p = String(rawDob).split('-');
                        if (p.length === 3 && p[0].length === 2) {
                            dbDob = `${p[2]}-${p[1]}-${p[0]}`;
                        } else {
                            dbDob = rawDob;
                        }
                    }

                    await _supabase.from('employees').upsert({
                        employee_id: empId,
                        full_name: row["Họ và Tên"] || '',
                        date_of_birth: dbDob,
                        gender: row["Giới Tính"] || 'Nam',
                        mobile_phone: String(row["Điện Thoại"] || ''),
                        email: row["Email"] || '',
                        id_card_number: String(row["Số CCCD"] || ''),
                        tax_code: String(row["Mã Số Thuế"] || ''),
                        permanent_address: row["Địa Chỉ"] || ''
                    }, { onConflict: 'employee_id' });

                    countSuccess++;
                }

                alert(`Đã đồng bộ thành công ${countSuccess} hồ sơ nhân sự!`);
                loadEmployees();
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi import file Excel: ' + err.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

// ==========================================================================
// MODULE QUẢN LÝ ĐỀ XUẤT LƯƠNG 3P & TRÌNH KÝ HĐLĐ (MSS)
// ==========================================================================

function openProposalModal() {
    if (window._tlgSession.role === 'ESS_608') {
        alert('Tài khoản ESS cá nhân không có quyền tạo đề xuất!');
        return;
    }
    document.getElementById('proposal-modal').classList.remove('hidden');
    loadProposalTargetEmployees();
}

function closeProposalModal() {
    document.getElementById('proposal-modal').classList.add('hidden');
}

function toggleProposalFields() {
    const type = document.getElementById('prop-type').value;
    const secSalary = document.getElementById('section-salary-3p');
    const secContract = document.getElementById('section-contract');

    if (type === 'SALARY_3P') {
        secSalary.classList.remove('hidden');
        secContract.classList.add('hidden');
    } else {
        secSalary.classList.add('hidden');
        secContract.classList.remove('hidden');
    }
}

async function loadProposalTargetEmployees() {
    const select = document.getElementById('prop-target-emp');
    const isSuperAdmin = (window._tlgSession.role === 'MSS_ADMIN_CB' || window._tlgSession.role === 'HRM' || window._tlgSession.employeeId === '00608');

    try {
        let query = _supabase.from('employee_contracts').select(`
            employee_id,
            department_name,
            employees ( employee_id, full_name )
        `).eq('is_active', true);

        if (!isSuperAdmin) {
            const { data: treeData } = await _supabase.rpc('get_managed_employee_ids', { root_manager_id: window._tlgSession.employeeId });
            const allowedIds = treeData ? treeData.map(t => t.employee_id) : [];
            query = query.in('employee_id', allowedIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
            select.innerHTML = '<option value="">-- Chọn nhân viên trong cây quản lý --</option>' + 
                data.map(item => {
                    const emp = item.employees;
                    if (!emp) return '';
                    return `<option value="${emp.employee_id}">${emp.employee_id} - ${emp.full_name} (${item.department_name || 'N/A'})</option>`;
                }).join('');
        } else {
            select.innerHTML = '<option value="">Không có nhân sự thuộc phạm vi quản lý</option>';
        }
    } catch (err) {
        console.error("Lỗi nạp danh sách:", err);
    }
}

async function submitProposal(event) {
    event.preventDefault();
    const type = document.getElementById('prop-type').value;
    const targetEmpId = document.getElementById('prop-target-emp').value;
    const reason = document.getElementById('prop-reason').value;

    const payload = {
        proposal_type: type,
        employee_id: targetEmpId,
        proposed_by: window._tlgSession.employeeId,
        reason: reason,
        status: 'PENDING'
    };

    if (type === 'SALARY_3P') {
        payload.proposed_base_salary = Number(document.getElementById('prop-base-salary').value || 0);
        payload.proposed_allowance_position = Number(document.getElementById('prop-allowance-pos').value || 0);
    } else {
        payload.contract_type = document.getElementById('prop-contract-type').value;
        payload.effective_date = document.getElementById('prop-effective-date').value || null;
    }

    try {
        const { error } = await _supabase.from('hr_proposals').insert([payload]);
        if (error) throw error;

        alert('Tạo đề xuất / trình ký thành công!');
        document.getElementById('proposal-form').reset();
        closeProposalModal();
        loadMSSProposals();
    } catch (err) {
        alert('Lỗi tạo đề xuất: ' + err.message);
    }
}

async function loadMSSProposals() {
    const tbody = document.getElementById('mss-proposals-body');
    if (!tbody) return;

    const isSuperAdmin = (window._tlgSession.role === 'MSS_ADMIN_CB' || window._tlgSession.role === 'HRM' || window._tlgSession.employeeId === '00608');

    try {
        let query = _supabase.from('hr_proposals').select(`*, employees ( full_name, employee_id )`).order('created_at', { ascending: false });

        if (!isSuperAdmin) {
            const { data: treeData } = await _supabase.rpc('get_managed_employee_ids', { root_manager_id: window._tlgSession.employeeId });
            const allowedIds = treeData ? treeData.map(t => t.employee_id) : [];
            allowedIds.push(window._tlgSession.employeeId);
            query = query.in('employee_id', allowedIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
            tbody.innerHTML = data.map(item => {
                const formatMoney = (val) => val ? Number(val).toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';
                const isSalary = item.proposal_type === 'SALARY_3P';
                
                let detailsStr = '';
                if (isSalary) {
                    detailsStr = `Lương chính mới: <strong>${formatMoney(item.proposed_base_salary)}</strong><br>PC Trách nhiệm: <strong>${formatMoney(item.proposed_allowance_position)}</strong>`;
                } else {
                    detailsStr = `HĐLĐ trình ký: <strong>${item.contract_type}</strong><br>Hiệu lực: <strong>${formatDateVN(item.effective_date)}</strong>`;
                }

                let actionButtons = '';
                if (item.status === 'PENDING' && isSuperAdmin) {
                    actionButtons = `
                        <button onclick="approveProposal(${item.proposal_id})" class="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700">Duyệt & Cập nhật</button>
                        <button onclick="rejectProposal(${item.proposal_id})" class="px-2 py-1 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700">Từ chối</button>
                    `;
                } else if (item.status === 'APPROVED') {
                    actionButtons = `<span class="text-xs font-bold text-emerald-600">[Đã duyệt & Áp dụng]</span>`;
                } else {
                    actionButtons = `<span class="text-xs font-bold text-slate-400">Đang chờ C&B duyệt</span>`;
                }

                const badgeType = isSalary 
                    ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">Điều chỉnh Lương 3P</span>'
                    : '<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-bold">Trình ký HĐLĐ</span>';

                return `
                    <tr class="border-b hover:bg-slate-50">
                        <td class="p-3">${badgeType}</td>
                        <td class="p-3 font-mono font-bold text-slate-800">${item.employees?.employee_id} - ${item.employees?.full_name}</td>
                        <td class="p-3 text-xs text-slate-700">${detailsStr}</td>
                        <td class="p-3 text-xs text-slate-600">${item.reason}</td>
                        <td class="p-3"><span class="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">${item.status}</span></td>
                        <td class="p-3 space-x-1">${actionButtons}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Không có đề xuất nào trong phạm vi của bạn.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500">Lỗi tải đề xuất: ${err.message}</td></tr>`;
    }
}

async function approveProposal(proposalId) {
    if (confirm('Xác nhận duyệt đề xuất này? Dữ liệu sẽ tự động cập nhật vào hệ thống.')) {
        try {
            const { error } = await _supabase.from('hr_proposals').update({ status: 'APPROVED' }).eq('proposal_id', proposalId);
            if (error) throw error;
            alert('Đã phê duyệt đề xuất thành công!');
            loadMSSProposals();
        } catch (err) {
            alert('Lỗi phê duyệt: ' + err.message);
        }
    }
}

async function rejectProposal(proposalId) {
    if (confirm('Xác nhận từ chối đề xuất này?')) {
        try {
            const { error } = await _supabase.from('hr_proposals').update({ status: 'REJECTED' }).eq('proposal_id', proposalId);
            if (error) throw error;
            alert('Đã từ chối đề xuất!');
            loadMSSProposals();
        } catch (err) {
            alert('Lỗi khi từ chối: ' + err.message);
        }
    }
}

// ==========================================================================
// QUẢN LÝ PHÉP NĂM (MSS / ESS)
// ==========================================================================

function openLeaveModal() {
    document.getElementById('leave-modal').classList.remove('hidden');
    loadEmployeeLeaveBalance();
}

function closeLeaveModal() {
    document.getElementById('leave-modal').classList.add('hidden');
}

async function loadEmployeeLeaveBalance() {
    try {
        const { data, error } = await _supabase.from('leave_balances').select('*').eq('employee_id', window._tlgSession.employeeId).eq('year', 2026).limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
            const b = data[0];
            document.getElementById('lbl-annual').innerText = b.annual_leave_standard || 12;
            document.getElementById('lbl-seniority').innerText = b.seniority_leave || 0;
            document.getElementById('lbl-carried').innerText = b.carried_over_leave || 0;
            document.getElementById('lbl-used').innerText = b.leave_used || 0;
        }
    } catch (err) {
        console.error("Lỗi tải số dư phép:", err);
    }
}

async function submitLeaveRequest(event) {
    event.preventDefault();
    const startDate = document.getElementById('leave-start').value;
    const endDate = document.getElementById('leave-end').value;
    const reason = document.getElementById('leave-reason').value;

    try {
        const { error } = await _supabase.from('leave_requests').insert([{
            employee_id: window._tlgSession.employeeId,
            leave_type: 'ANNUAL',
            start_date: startDate,
            end_date: endDate,
            total_days: 1.0,
            reason: reason,
            status: 'PENDING'
        }]);

        if (error) throw error;
        alert('Gửi đơn xin nghỉ phép cá nhân thành công!');
        document.getElementById('leave-form').reset();
        closeLeaveModal();
    } catch (err) {
        alert('Lỗi khi gửi đơn: ' + err.message);
    }
}

async function loadMSSLeaveRequests() {
    const tbody = document.getElementById('mss-leave-requests-body');
    const scopeDesc = document.getElementById('mss-scope-desc');
    
    const role = window._tlgSession.role;
    const isSuperAdmin = (role === 'MSS_ADMIN_CB' || role === 'HRM' || window._tlgSession.employeeId === '00608');

    scopeDesc.innerText = `Quyền hiện tại: ${role} ${isSuperAdmin ? '(C&B Admin - Toàn tập đoàn)' : '(Giới hạn cây quản lý)'}`;

    try {
        let query = _supabase.from('leave_requests').select(`*, employees ( full_name, employee_id )`).order('created_at', { ascending: false });

        if (!isSuperAdmin) {
            const { data: treeData } = await _supabase.rpc('get_managed_employee_ids', { root_manager_id: window._tlgSession.employeeId });
            const allowedIds = treeData ? treeData.map(t => t.employee_id) : [];
            allowedIds.push(window._tlgSession.employeeId);
            query = query.in('employee_id', allowedIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
            tbody.innerHTML = data.map(item => {
                const isPending = item.status === 'PENDING';
                const isApproved = item.status === 'APPROVED';
                const isRejected = item.status === 'REJECTED';
                const isFinalized = item.is_finalized === true;

                let actionButtons = '';
                if (isPending) {
                    actionButtons = `
                        <button onclick="updateLeaveStatus(${item.request_id}, 'APPROVED')" class="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700">Duyệt</button>
                        <button onclick="updateLeaveStatus(${item.request_id}, 'REJECTED')" class="px-2 py-1 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700">Từ chối</button>
                    `;
                } else if ((isApproved || isRejected) && !isFinalized) {
                    actionButtons = `
                        <button onclick="updateLeaveStatus(${item.request_id}, 'PENDING')" class="px-2 py-1 bg-slate-600 text-white rounded text-xs font-semibold hover:bg-slate-700">Gỡ</button>
                        <button onclick="finalizeLeaveRequest(${item.request_id})" class="px-2 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700">Chốt</button>
                    `;
                } else if (isFinalized && isSuperAdmin) {
                    actionButtons = `
                        <button onclick="forceUnapproveLeave(${item.request_id})" class="px-2 py-1 bg-purple-600 text-white rounded text-xs font-semibold hover:bg-purple-700">Gỡ (C&B)</button>
                        <button onclick="deleteLeaveRequest(${item.request_id})" class="px-2 py-1 bg-rose-800 text-white rounded text-xs font-semibold hover:bg-rose-900">Xóa</button>
                    `;
                }

                const statusBadges = {
                    'PENDING': '<span class="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">Chờ duyệt</span>',
                    'APPROVED': '<span class="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-bold">Đã duyệt</span>',
                    'REJECTED': '<span class="px-2 py-1 bg-rose-100 text-rose-800 rounded text-xs font-bold">Từ chối</span>'
                };

                return `
                    <tr class="border-b hover:bg-slate-50">
                        <td class="p-3 font-mono font-bold text-blue-600">${item.employees?.employee_id || item.employee_id}</td>
                        <td class="p-3 font-medium text-slate-800">${item.employees?.full_name || 'N/A'}</td>
                        <td class="p-3"><span class="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold">${item.leave_type}</span></td>
                        <td class="p-3 text-slate-600 text-xs">${formatDateVN(item.start_date)} đến ${formatDateVN(item.end_date)}</td>
                        <td class="p-3 text-slate-600">${item.reason}</td>
                        <td class="p-3">${statusBadges[item.status] || item.status} ${isFinalized ? '<br><span class="text-[10px] text-blue-600 font-bold">[Hoàn tất]</span>' : ''}</td>
                        <td class="p-3 space-x-1">${actionButtons}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">Không có đơn nghỉ phép nào.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-rose-500">Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

async function openAdminLeaveRegisterModal() {
    if (window._tlgSession.role === 'ESS_608') {
        alert('Tài khoản ESS cá nhân không có quyền đăng ký phép thay!');
        return;
    }
    document.getElementById('admin-leave-modal').classList.remove('hidden');
    
    const select = document.getElementById('admin-target-emp');
    const isSuperAdmin = (window._tlgSession.role === 'MSS_ADMIN_CB' || window._tlgSession.role === 'HRM' || window._tlgSession.employeeId === '00608');

    try {
        let query = _supabase.from('employee_contracts').select(`
            employee_id,
            department_name,
            legal_entities ( entity_code ),
            employees ( employee_id, full_name )
        `).eq('is_active', true);

        if (!isSuperAdmin) {
            const { data: treeData } = await _supabase.rpc('get_managed_employee_ids', { root_manager_id: window._tlgSession.employeeId });
            const allowedIds = treeData ? treeData.map(t => t.employee_id) : [];
            query = query.in('employee_id', allowedIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
            select.innerHTML = '<option value="">-- Chọn nhân viên cấp dưới --</option>' + 
                data.map(item => {
                    const emp = item.employees;
                    if (!emp) return '';
                    return `<option value="${emp.employee_id}">${emp.employee_id} - ${emp.full_name} (${item.department_name || 'N/A'})</option>`;
                }).join('');
        } else {
            select.innerHTML = '<option value="">Không có nhân sự nào trong cây quản lý</option>';
        }
    } catch (err) {
        console.error(err);
    }
}

function closeAdminLeaveModal() {
    document.getElementById('admin-leave-modal').classList.add('hidden');
}

async function submitAdminLeaveRequest(event) {
    event.preventDefault();
    const targetEmpId = document.getElementById('admin-target-emp').value;
    const startDate = document.getElementById('admin-leave-start').value;
    const endDate = document.getElementById('admin-leave-end').value;
    const reason = document.getElementById('admin-leave-reason').value;

    try {
        const { error } = await _supabase.from('leave_requests').insert([{
            employee_id: targetEmpId,
            leave_type: 'ANNUAL',
            start_date: startDate,
            end_date: endDate,
            total_days: 1.0,
            reason: `[Đăng ký thay bởi ${window._tlgSession.employeeId}] ${reason}`,
            status: 'APPROVED'
        }]);

        if (error) throw error;
        alert('Đăng ký phép thay thành công!');
        document.getElementById('admin-leave-form').reset();
        closeAdminLeaveModal();
        loadMSSLeaveRequests();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

async function updateLeaveStatus(requestId, newStatus) {
    try {
        const { error } = await _supabase.from('leave_requests').update({ status: newStatus, approved_by: window._tlgSession.employeeId, approved_at: new Date().toISOString() }).eq('request_id', requestId);
        if (error) throw error;
        alert(`Đã cập nhật trạng thái đơn.`);
        loadMSSLeaveRequests();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

async function finalizeLeaveRequest(requestId) {
    try {
        const { error } = await _supabase.from('leave_requests').update({ is_finalized: true }).eq('request_id', requestId);
        if (error) throw error;
        alert('Đã chốt hoàn tất đơn.');
        loadMSSLeaveRequests();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

async function forceUnapproveLeave(requestId) {
    try {
        const { error } = await _supabase.from('leave_requests').update({ status: 'PENDING', is_finalized: false }).eq('request_id', requestId);
        if (error) throw error;
        alert('Đã gỡ duyệt thành công!');
        loadMSSLeaveRequests();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

async function deleteLeaveRequest(requestId) {
    if (confirm('Xác nhận xóa đơn?')) {
        try {
            const { error } = await _supabase.from('leave_requests').delete().eq('request_id', requestId);
            if (error) throw error;
            alert('Đã xóa đơn!');
            loadMSSLeaveRequests();
        } catch (err) {
            alert('Lỗi: ' + err.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkConnection();
});
