// frontend/src/components/ProjectTable.js
import React, { useState } from 'react';
import {
  FaCheckCircle, FaTimesCircle, FaBuilding, FaUser, FaEdit, FaTrash,
  FaClock, FaCheck, FaBan, FaChevronDown, FaChevronUp, FaEllipsisH,
  FaRegFileAlt, FaTasks, FaMoneyBillWave
} from 'react-icons/fa'; // Thêm icons

// Helper function để định dạng tiền tệ
const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return <span className="text-gray-400">-</span>;
  // Chia cho 1 triệu nếu cần, hoặc giữ nguyên tùy thuộc vào dữ liệu gốc
  // Giả sử giá trị đã là Triệu đồng
  return value.toLocaleString('vi-VN');
};

// Helper function để định dạng ngày
const formatDate = (dateString) => {
  if (!dateString) return <span className="text-gray-400">-</span>;
  try {
    return new Date(dateString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return <span className="text-gray-400">Invalid Date</span>;
  }
};

// Helper function để cắt ngắn text
const truncateText = (text, maxLength = 50) => {
  if (!text) return <span className="text-gray-400">-</span>;
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

// Component Skeleton Row
const SkeletonRow = ({ isCategory, columns }) => (
  <tr>
    {columns.map((col, index) => (
      <td key={index} className={`${col.stickyClass || ''} ${col.alignClass || ''}`}>
        <div className={`skeleton h-5 ${col.skeletonWidth || 'w-3/4'} ${col.alignClass === 'text-center' ? 'mx-auto' : ''} ${col.alignClass === 'text-right' ? 'ml-auto' : ''}`}></div>
      </td>
    ))}
  </tr>
);


function ProjectTable({
  filteredProjects,
  isCategory,
  user,
  isSubmitting,
  openEditModal,
  approveProject,
  rejectProject,
  deleteProject,
  allocateProject,
  assignProject,
  allocateWaves,
  setAllocateWaves,
  assignPersons,
  setAssignPersons,
  isLoading,
  totalPages,
  currentPage,
  setCurrentPage,
  allocationWavesList,
  totalProjectsCount = 0, // Thêm tổng số project để hiển thị phân trang
}) {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Định nghĩa cấu trúc cột để dễ quản lý
  const columns = [
    { key: 'serial', label: 'STT', stickyClass: 'sticky-col-1', alignClass: 'text-center', widthClass: 'w-[70px]', mobile: true, skeletonWidth: 'w-8' },
    { key: 'name', label: 'Tên công trình', stickyClass: 'sticky-col-2', widthClass: 'min-w-[280px]', mobile: true, skeletonWidth: 'w-48' },
    { key: 'allocatedUnit', label: 'Chi nhánh', widthClass: 'min-w-[180px]', mobile: false, skeletonWidth: 'w-32' },
    { key: 'type', label: 'Loại CT', widthClass: 'min-w-[130px]', mobile: false, skeletonWidth: 'w-20' },
    ...(isCategory ? [
      { key: 'scale', label: 'Quy mô', widthClass: 'min-w-[150px]', mobile: false, skeletonWidth: 'w-24' },
      { key: 'location', label: 'Địa điểm XD', widthClass: 'min-w-[220px]', mobile: false, skeletonWidth: 'w-40' },
      { key: 'initialValue', label: 'Giá trị PB (Tr)', alignClass: 'text-right', widthClass: 'min-w-[140px]', mobile: false, skeletonWidth: 'w-20' },
    ] : []),
    { key: 'enteredBy', label: 'Người nhập', widthClass: 'min-w-[130px]', mobile: false, skeletonWidth: 'w-24' },
    ...(isCategory ? [
      { key: 'allocationWave', label: 'Phân bổ đợt', widthClass: 'min-w-[150px]', mobile: false, skeletonWidth: 'w-28' },
      { key: 'estimator', label: 'NV lập HSDT', widthClass: 'min-w-[150px]', mobile: false, skeletonWidth: 'w-28' },
    ] : []),
    { key: 'supervisor', label: 'NV/LĐ theo dõi', widthClass: 'min-w-[150px]', mobile: false, skeletonWidth: 'w-28' },
    ...(isCategory ? [
      { key: 'durationDays', label: 'Số ngày TH', alignClass: 'text-center', widthClass: 'min-w-[100px]', mobile: false, skeletonWidth: 'w-16' },
      { key: 'startDate', label: 'Ngày BĐ HSDT', alignClass: 'text-center', widthClass: 'min-w-[130px]', mobile: false, skeletonWidth: 'w-24' },
      { key: 'completionDate', label: 'Ngày HT HSDT', alignClass: 'text-center', widthClass: 'min-w-[130px]', mobile: false, skeletonWidth: 'w-24' },
    ] : []),
    ...(!isCategory ? [
      { key: 'reportDate', label: 'Ngày báo cáo', alignClass: 'text-center', widthClass: 'min-w-[130px]', mobile: false, skeletonWidth: 'w-24' },
      { key: 'inspectionDate', label: 'Ngày kiểm tra', alignClass: 'text-center', widthClass: 'min-w-[130px]', mobile: false, skeletonWidth: 'w-24' },
    ] : []),
    { key: 'taskDescription', label: 'Nội dung CV/ Sửa chữa', widthClass: 'min-w-[300px]', mobile: false, skeletonWidth: 'w-56' },
    ...(isCategory ? [
      { key: 'contractValue', label: 'Giá trị GK (Tr)', alignClass: 'text-right', widthClass: 'min-w-[140px]', mobile: false, skeletonWidth: 'w-20' },
      { key: 'constructionUnit', label: 'Đơn vị thi công', widthClass: 'min-w-[180px]', mobile: false, skeletonWidth: 'w-32' },
      { key: 'progress', label: 'Tiến độ TC', widthClass: 'min-w-[200px]', mobile: false, skeletonWidth: 'w-36' },
      { key: 'feasibility', label: 'Khả năng TH', widthClass: 'min-w-[200px]', mobile: false, skeletonWidth: 'w-36' },
    ] : []),
    ...(!isCategory ? [
      { key: 'paymentDate', label: 'Ngày TT', alignClass: 'text-center', widthClass: 'min-w-[130px]', mobile: false, skeletonWidth: 'w-24' },
      { key: 'paymentValue', label: 'Giá trị TT (Tr)', alignClass: 'text-right', widthClass: 'min-w-[140px]', mobile: false, skeletonWidth: 'w-20' },
    ] : []),
    { key: 'notes', label: 'Ghi chú', widthClass: 'min-w-[250px]', mobile: false, skeletonWidth: 'w-48' },
    { key: 'status', label: 'Trạng thái', alignClass: 'text-center', widthClass: 'min-w-[140px]', mobile: true, skeletonWidth: 'w-24' },
    { key: 'actions', label: 'Hành động', stickyClass: 'sticky-col-last', alignClass: 'text-center', widthClass: 'min-w-[320px]', mobile: true, skeletonWidth: 'w-40' }, // Tăng min-width nếu cần
  ];

  const renderStatusBadge = (project) => (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap
      ${project.status === 'Chờ duyệt' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
        project.status === 'Đã duyệt' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
        project.status === 'Từ chối' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
      title={project.status} // Thêm title cho tooltip mặc định
    >
      {project.status === 'Chờ duyệt' && <FaClock className="status-icon" />}
      {project.status === 'Đã duyệt' && <FaCheck className="status-icon" />}
      {project.status === 'Từ chối' && <FaBan className="status-icon" />}
      {project.status}
       {project.pendingEdit && (
         <span className="ml-1 px-1.5 py-0.5 bg-orange-200 text-orange-700 dark:bg-orange-700 dark:text-orange-100 text-[10px] rounded-full">YC Sửa</span>
       )}
       {project.pendingDelete && (
         <span className="ml-1 px-1.5 py-0.5 bg-pink-200 text-pink-700 dark:bg-pink-700 dark:text-pink-100 text-[10px] rounded-full">YC Xóa</span>
       )}
    </span>
  );

   // Tính toán thông tin phân trang
   const itemsPerPage = filteredProjects.length; // Số lượng item trên trang hiện tại
   const startItem = totalProjectsCount > 0 ? (currentPage - 1) * 10 + 1 : 0; // Giả sử limit là 10
   const endItem = totalProjectsCount > 0 ? startItem + itemsPerPage - 1 : 0;


  return (
    <div className="card mt-8">
      <div className="table-container">
        <table className="table-fixed">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`${col.stickyClass || ''} ${col.alignClass || ''} ${col.widthClass || ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} isCategory={isCategory} columns={columns} />)
            ) : filteredProjects.length === 0 ? (
                <tr>
                    <td colSpan={columns.length} className="text-center py-12 text-gray-500 dark:text-gray-400 text-lg font-medium">
                        Không tìm thấy công trình nào phù hợp.
                    </td>
                </tr>
            ): (
              filteredProjects.map((project) => (
                <React.Fragment key={project._id}>
                  {/* Desktop Row */}
                  <tr
                    className={`hidden md:table-row expandable-row ${expandedRows[project._id] ? 'row-selected' : ''}`}
                    onMouseEnter={() => setHoveredRow(project._id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {/* Render các cột cho desktop */}
                    {columns.map((col) => (
                      <td
                        key={`${project._id}-${col.key}`}
                        className={`${col.stickyClass || ''} ${col.alignClass || ''} ${col.widthClass || ''}`}
                        style={{ backgroundColor: hoveredRow === project._id && !expandedRows[project._id] && !col.stickyClass?.includes('sticky-col-last') ? '#EFF6FF' : undefined }} // Chỉ highlight hover khi không expand và không phải cột action
                      >
                        {col.key === 'serial' && (isCategory ? project.categorySerialNumber : project.minorRepairSerialNumber)}
                        {col.key === 'name' && <span className="font-semibold text-blue-700 dark:text-blue-400">{project.name}</span>}
                        {col.key === 'type' && (isCategory ? 'Danh mục' : 'Sửa chữa nhỏ')}
                        {col.key === 'initialValue' && formatCurrency(project.initialValue)}
                        {col.key === 'startDate' && formatDate(project.startDate)}
                        {col.key === 'completionDate' && formatDate(project.completionDate)}
                        {col.key === 'reportDate' && formatDate(project.reportDate)}
                        {col.key === 'inspectionDate' && formatDate(project.inspectionDate)}
                        {col.key === 'taskDescription' && <div title={project.taskDescription}>{truncateText(project.taskDescription)}</div>}
                        {col.key === 'contractValue' && formatCurrency(project.contractValue)}
                        {col.key === 'progress' && <div title={project.progress}>{truncateText(project.progress)}</div>}
                        {col.key === 'feasibility' && <div title={project.feasibility}>{truncateText(project.feasibility)}</div>}
                        {col.key === 'paymentDate' && formatDate(project.paymentDate)}
                        {col.key === 'paymentValue' && formatCurrency(project.paymentValue)}
                        {col.key === 'notes' && <div title={project.notes}>{truncateText(project.notes)}</div>}
                        {col.key === 'status' && renderStatusBadge(project)}
                        {col.key === 'actions' && (
                           <div
                              className={`flex items-center justify-center gap-1 py-1 ${col.stickyClass ? (expandedRows[project._id] ? 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-50' : hoveredRow === project._id ? 'bg-blue-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800') : ''} ${col.stickyClass && project.isEvenRow ? (expandedRows[project._id] ? 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-50' : hoveredRow === project._id ? 'bg-blue-50 dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-900') : ''} transition-colors duration-150`}
                              onClick={(e) => e.stopPropagation()} // Ngăn click vào action làm expand row
                            >
                            {/* === Action Buttons Logic === */}
                            {user?.permissions?.approve && project.status === 'Chờ duyệt' && (
                              <>
                                <div className="action-btn-wrapper">
                                  <button onClick={() => approveProject(project._id)} className="action-btn text-green-500" disabled={isSubmitting}><FaCheckCircle size={16} /></button>
                                  <span className="tooltip">Duyệt</span>
                                </div>
                                <div className="action-btn-wrapper">
                                  <button onClick={() => rejectProject(project._id)} className="action-btn text-orange-500" disabled={isSubmitting}><FaTimesCircle size={16} /></button>
                                  <span className="tooltip">Từ chối</span>
                                </div>
                              </>
                            )}
                             {user?.permissions?.edit && (project.status !== 'Đã duyệt' || (project.status === 'Đã duyệt' && (project.enteredBy === user.username || user.role === 'admin' || user.permissions.approve))) && (
                              <div className="action-btn-wrapper">
                                <button onClick={() => openEditModal(project)} className="action-btn text-blue-500" disabled={isSubmitting}><FaEdit size={15} /></button>
                                <span className="tooltip">Sửa</span>
                              </div>
                             )}
                             {user?.permissions?.delete && (project.status !== 'Đã duyệt' || (project.status === 'Đã duyệt' && (project.enteredBy === user.username || user.role === 'admin' || user.permissions.approve))) && (
                              <div className="action-btn-wrapper">
                                <button onClick={() => deleteProject(project._id)} className="action-btn text-red-500" disabled={isSubmitting}><FaTrash size={15} /></button>
                                <span className="tooltip">Xóa</span>
                              </div>
                             )}
                              {isCategory && user?.permissions?.edit && project.status === 'Đã duyệt' && (
                                <>
                                  {/* Allocate Action */}
                                  <div className="flex items-center ml-1">
                                    <select
                                      value={allocateWaves[project._id] || ''}
                                      onChange={(e) => setAllocateWaves((prev) => ({ ...prev, [project._id]: e.target.value }))}
                                      className="form-select text-xs py-1 px-2 w-24 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                                      disabled={isSubmitting}
                                    >
                                      <option value="">-- Đợt PB --</option>
                                      {allocationWavesList.map((wave) => (<option key={wave._id} value={wave.name}>{wave.name}</option>))}
                                    </select>
                                    <div className="action-btn-wrapper ml-1">
                                      <button onClick={() => allocateProject(project._id)} className="action-btn text-purple-500" disabled={isSubmitting || !allocateWaves[project._id]}><FaBuilding size={15} /></button>
                                      <span className="tooltip">Phân bổ đợt</span>
                                    </div>
                                  </div>
                                  {/* Assign Action */}
                                  <div className="flex items-center ml-1">
                                    <input
                                      type="text"
                                      placeholder="Người PT"
                                      value={assignPersons[project._id] || ''}
                                      onChange={(e) => setAssignPersons((prev) => ({ ...prev, [project._id]: e.target.value }))}
                                      className="form-input text-xs py-1 px-2 w-24 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                                      disabled={isSubmitting}
                                    />
                                    <div className="action-btn-wrapper ml-1">
                                      <button onClick={() => assignProject(project._id)} className="action-btn text-teal-500" disabled={isSubmitting || !assignPersons[project._id]?.trim()}><FaUser size={15} /></button>
                                      <span className="tooltip">Phân công</span>
                                    </div>
                                  </div>
                                </>
                              )}
                          </div>
                        )}
                        {/* Render giá trị mặc định cho các cột khác */}
                        {!['serial', 'name', 'type', 'initialValue', 'startDate', 'completionDate', 'reportDate', 'inspectionDate', 'taskDescription', 'contractValue', 'progress', 'feasibility', 'paymentDate', 'paymentValue', 'notes', 'status', 'actions'].includes(col.key) && (
                            <span>{project[col.key] || <span className="text-gray-400">-</span>}</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Mobile Row */}
                  <tr className="md:hidden expandable-row" onClick={() => toggleRow(project._id)}>
                      {/* Mobile Header Cell: STT, Name, Status, Expand Icon */}
                      <td colSpan={columns.length} className="mobile-header-cell">
                          <div className="flex items-center space-x-2">
                              <span className="font-bold text-blue-600 dark:text-blue-400 w-8 text-center">
                                  {isCategory ? project.categorySerialNumber : project.minorRepairSerialNumber}
                              </span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate flex-1 pr-2">
                                  {project.name}
                              </span>
                          </div>
                          <div className="flex items-center space-x-2">
                             {renderStatusBadge(project)}
                             <span className="text-gray-500 dark:text-gray-400">
                               {expandedRows[project._id] ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
                             </span>
                          </div>
                      </td>
                  </tr>
                   {/* Mobile Expandable Content */}
                   {expandedRows[project._id] && (
                      <tr className="md:hidden">
                           <td colSpan={columns.length} className="mobile-expand-cell">
                               <div className="expandable-content">
                                  <table>
                                      <tbody>
                                        {/* Lặp qua các cột KHÔNG phải mobile header để hiển thị chi tiết */}
                                        {columns.filter(col => !col.mobile && project[col.key] != null && project[col.key] !== '').map(col => (
                                            <tr key={`${project._id}-detail-${col.key}`}>
                                                <td>{col.label}</td>
                                                <td>
                                                   {['initialValue', 'contractValue', 'paymentValue'].includes(col.key) ? formatCurrency(project[col.key]) :
                                                   ['startDate', 'completionDate', 'reportDate', 'inspectionDate', 'paymentDate'].includes(col.key) ? formatDate(project[col.key]) :
                                                   project[col.key]}
                                                </td>
                                            </tr>
                                        ))}
                                      </tbody>
                                  </table>
                               </div>
                               {/* Mobile Action Cell */}
                               <div className="mobile-action-cell">
                                  {/* Copy logic action buttons từ desktop vào đây */}
                                  {user?.permissions?.approve && project.status === 'Chờ duyệt' && (
                                    <>
                                      <button onClick={(e)=>{e.stopPropagation(); approveProject(project._id)}} className="action-btn text-green-500" disabled={isSubmitting}><FaCheckCircle size={18} /></button>
                                      <button onClick={(e)=>{e.stopPropagation(); rejectProject(project._id)}} className="action-btn text-orange-500" disabled={isSubmitting}><FaTimesCircle size={18} /></button>
                                    </>
                                  )}
                                  {user?.permissions?.edit && (project.status !== 'Đã duyệt' || (project.status === 'Đã duyệt' && (project.enteredBy === user.username || user.role === 'admin' || user.permissions.approve))) && (
                                      <button onClick={(e)=>{e.stopPropagation(); openEditModal(project)}} className="action-btn text-blue-500" disabled={isSubmitting}><FaEdit size={17} /></button>
                                  )}
                                  {user?.permissions?.delete && (project.status !== 'Đã duyệt' || (project.status === 'Đã duyệt' && (project.enteredBy === user.username || user.role === 'admin' || user.permissions.approve))) && (
                                      <button onClick={(e)=>{e.stopPropagation(); deleteProject(project._id)}} className="action-btn text-red-500" disabled={isSubmitting}><FaTrash size={17} /></button>
                                  )}
                                  {/* Có thể thêm action Phân bổ/Phân công cho mobile nếu cần */}
                               </div>
                           </td>
                      </tr>
                   )}

                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {!isLoading && totalProjectsCount > 0 && (
         <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700 gap-3 bg-white dark:bg-gray-800 rounded-b-2xl shadow-md pagination-mobile">
           <span className="text-sm text-gray-600 dark:text-gray-400">
                Hiển thị {startItem}-{endItem} trên tổng số {totalProjectsCount} công trình
            </span>
            <div className="flex flex-wrap justify-center items-center gap-1">
               <button
                 onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                 disabled={currentPage === 1 || isLoading || isSubmitting}
                 className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 shadow-sm transition-all duration-150"
               >
                 Trước
               </button>
               {totalPages > 1 &&
                 [...Array(totalPages).keys()]
                   .map((num) => num + 1)
                   // Logic hiển thị ... (giữ nguyên hoặc cải tiến nếu cần)
                    .filter((page) => {
                      if (totalPages <= 7) return true;
                      if (page <= 1 || page >= totalPages ) return true; // Luôn hiện trang đầu và cuối
                      if (page >= currentPage - 1 && page <= currentPage + 1) return true; // Hiện trang trước, hiện tại, trang sau
                      if ((currentPage < 4 && page <= 3) || (currentPage > totalPages - 3 && page >= totalPages - 2)) return true; // Hiện nhiều hơn ở đầu/cuối
                      // Hiển thị dấu ...
                       if (page === currentPage - 2 || page === currentPage + 2) return true;

                      return false;
                    })
                   .map((page, index, arr) => (
                     <React.Fragment key={page}>
                       {/* Thêm dấu ... */}
                        {index > 0 && page - arr[index-1] > 1 && page !== currentPage + 2 && arr[index-1] !== currentPage - 2 && (
                            <span className="px-3 py-1.5 text-sm text-gray-500">...</span>
                        )}
                         {/* Điều kiện hiển thị số trang hoặc dấu ... */}
                        {(page === currentPage - 2 || page === currentPage + 2) && totalPages > 7 && page > 1 && page < totalPages && Math.abs(currentPage-page) === 2 ? (
                             <span className="px-3 py-1.5 text-sm text-gray-500">...</span>
                        ) : (
                            <button
                                onClick={() => setCurrentPage(page)}
                                className={`px-3 py-1.5 rounded-lg mx-0.5 text-sm font-medium border border-gray-300 dark:border-gray-600 shadow-sm
                                ${
                                currentPage === page
                                    ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-700 dark:border-blue-700'
                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }
                                disabled:opacity-50 transition-all duration-150`}
                                disabled={isLoading || isSubmitting}
                            >
                            {page}
                            </button>
                        )}

                     </React.Fragment>
                   ))}
               <button
                 onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                 disabled={currentPage === totalPages || isLoading || isSubmitting}
                 className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 shadow-sm transition-all duration-150"
               >
                 Sau
               </button>
            </div>
         </div>
      )}
    </div>
  );
}

export default ProjectTable;