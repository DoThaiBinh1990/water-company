import { FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaUser } from 'react-icons/fa';

function MinorRepairProjectTable({
  filteredProjects,
  user,
  isSubmitting,
  openEditModal,
  approveProject,
  rejectProject,
  approveEditProject,
  rejectEditProject,
  approveDeleteProject,
  rejectDeleteProject,
  deleteProject,
  assignProject,
  assignPersons,
  setAssignPersons,
  isLoading,
  totalPages,
  currentPage,
  setCurrentPage,
  totalProjectsCount,
  isPendingTab,
}) {
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-all duration-200 ${
            currentPage === i
              ? 'bg-[var(--primary)] text-white'
              : 'bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300'
          }`}
          disabled={isSubmitting}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="flex justify-center items-center mt-6">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          className="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300 text-sm font-medium transition-all duration-200"
          disabled={currentPage === 1 || isSubmitting}
        >
          Trước
        </button>
        {startPage > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300 text-sm font-medium transition-all duration-200"
            >
              1
            </button>
            {startPage > 2 && <span className="px-2 text-sm text-[var(--text-secondary)]">...</span>}
          </>
        )}
        {pages}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2 text-sm text-[var(--text-secondary)]">...</span>}
            <button
              onClick={() => handlePageChange(totalPages)}
              className="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300 text-sm font-medium transition-all duration-200"
            >
              {totalPages}
            </button>
          </>
        )}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          className="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300 text-sm font-medium transition-all duration-200"
          disabled={currentPage === totalPages || isSubmitting}
        >
          Sau
        </button>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Chờ duyệt':
        return { className: 'status-badge-yellow', icon: '🟡', text: 'Chờ duyệt' };
      case 'Đã duyệt':
        return { className: 'status-badge-green', icon: '🟢', text: 'Đã duyệt' };
      default:
        return { className: 'status-badge-gray', icon: '⚪', text: status || 'Không xác định' };
    }
  };

  const formatDate = (dateString) => {
    return dateString ? new Date(dateString).toLocaleDateString('vi-VN') : 'N/A';
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    return `${Number(value).toLocaleString('vi-VN')} VND`;
  };

  // Helper function to safely get nested property
  const getNestedProperty = (obj, path) => {
    if (!path) return obj;
    const properties = path.split('.');
    return properties.reduce((acc, prop) => (acc && acc[prop] !== undefined ? acc[prop] : undefined), obj);
  };

  const getCellDisplayData = (projectItem, fieldName) => {
    if (isPendingTab && projectItem.pendingEdit && projectItem.status === 'Đã duyệt') {
      const originalData = projectItem;
      const pendingChanges = projectItem.pendingEdit;
      
      const originalValue = getNestedProperty(originalData, fieldName);
      const pendingValue = getNestedProperty(pendingChanges, fieldName);

      const hasPendingValue = fieldName.includes('.') ? 
        getNestedProperty(pendingChanges, fieldName) !== undefined : 
        Object.prototype.hasOwnProperty.call(pendingChanges, fieldName);
        
      const displayValue = hasPendingValue ? pendingValue : originalValue;
      let isChanged = false;
      if (hasPendingValue) {
        const normOriginal = (originalValue === undefined || originalValue === null) ? "" : String(originalValue);
        const normPending = (pendingValue === undefined || pendingValue === null) ? "" : String(pendingValue);
        isChanged = normOriginal !== normPending;
      }
      return {
        value: displayValue,
        originalValue: originalValue,
        isChanged: isChanged,
      };
    }
    return { value: getNestedProperty(projectItem, fieldName), originalValue: null, isChanged: false };
  };

  if (isLoading) {
    return (
      <div className="table-container">
        <table className="table-fixed">
          <thead>
            <tr>{Array(16).fill().map((_, idx) => (<th key={idx}><div className="skeleton h-6 w-full rounded"></div></th>))}</tr>
          </thead>
          <tbody>
            {Array(5).fill().map((_, rowIdx) => (
              <tr key={rowIdx}>{Array(16).fill().map((_, colIdx) => (<td key={colIdx}><div className="skeleton h-6 w-full rounded"></div></td>))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!filteredProjects || filteredProjects.length === 0) {
    return <div className="text-center text-[var(--text-secondary)] py-10">Không tìm thấy công trình nào.</div>;
  }

  const renderCell = (project, colConfig) => {
    const cellData = getCellDisplayData(project, colConfig.field);
    let displayValue;
    let originalDisplayValue;

    if (colConfig.format === 'date') {
      displayValue = formatDate(cellData.value);
      originalDisplayValue = formatDate(cellData.originalValue);
    } else if (colConfig.format === 'currency') {
      displayValue = formatCurrency(cellData.value);
      originalDisplayValue = formatCurrency(cellData.originalValue);
    } else {
      // For approvedBy.username, if cellData.value is undefined (e.g. approvedBy is null), it will become 'N/A'
      displayValue = cellData.value || 'N/A'; 
      originalDisplayValue = cellData.originalValue || 'N/A';
    }
    
    return (
      <td
        key={`${project._id}-${colConfig.field}`} // Ensure unique key for re-renders
        className={colConfig.className}
        style={{
          borderRight: '1px solid #E5E7EB',
          padding: '12px 16px',
          backgroundColor: cellData.isChanged ? '#fffacd' : (colConfig.style?.backgroundColor || 'transparent'), // LemonChiffon for changed cells
          textAlign: colConfig.align || 'left',
          ...colConfig.style
        }}
      >
        {displayValue}
        {cellData.isChanged && (
          <span className="block text-xs text-gray-500 mt-1 italic">(Trước đó: {originalDisplayValue})</span>
        )}
      </td>
    );
  };


  return (
    <div className="flex flex-col">
      <div className="table-container" style={{ border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '8px', overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        <table style={{ width: '2000px', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="sticky-col-1" style={{ width: '40px', position: 'sticky', top: 0, left: 0, backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', zIndex: 40 }}>STT</th>
              <th className="sticky-col-2" style={{ width: '200px', position: 'sticky', top: 0, left: '40px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', zIndex: 30 }}>Tên công trình</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Đơn vị phân bổ</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Địa điểm</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Quy mô</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0, textAlign: 'center' }}>Ngày xảy ra sự cố</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0, textAlign: 'center' }}>Người phê duyệt</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Người theo dõi</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0, textAlign: 'center' }}>Ngày kiểm tra</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0, textAlign: 'center' }}>Ngày thanh toán</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0, textAlign: 'right' }}>Giá trị thanh toán</th>
              <th style={{ width: '120px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0, textAlign: 'center' }}>Tình trạng</th>
              <th style={{ width: '120px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0, textAlign: 'center' }}>Trạng thái</th>
              <th style={{ width: '200px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Bút phê lãnh đạo</th>
              <th style={{ width: '200px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Ghi chú</th>
              <th className="sticky-col-last" style={{ width: '120px', position: 'sticky', top: 0, right: 0, backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 8px', zIndex: 30 }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project, index) => (
              <tr key={project._id} className="hover:bg-blue-100 transition-colors duration-200" style={{ borderBottom: '1px solid #E5E7EB' }}>
                <td className="sticky-col-1" style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 30, textAlign: 'center' }}>{(currentPage - 1) * 10 + index + 1}</td>
                {renderCell(project, { field: 'name', className: "sticky-col-2", style: { position: 'sticky', left: '40px', backgroundColor: 'white', zIndex: 20 } })}
                {renderCell(project, { field: 'allocatedUnit' })}
                {renderCell(project, { field: 'location' })}
                {renderCell(project, { field: 'scale' })}
                {renderCell(project, { field: 'reportDate', format: 'date', align: 'center' })}
                {renderCell(project, { field: 'approvedBy.username', align: 'center' })}
                {renderCell(project, { field: 'supervisor' })}
                {renderCell(project, { field: 'inspectionDate', format: 'date', align: 'center' })}
                {renderCell(project, { field: 'paymentDate', format: 'date', align: 'center' })}
                {renderCell(project, { field: 'paymentValue', format: 'currency', align: 'right' })}
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px', textAlign: 'center' }}>
                  <span className={`status-badge ${getStatusBadge(project.status).className}`}>
                    <span className="status-icon">{getStatusBadge(project.status).icon}</span>
                    {getStatusBadge(project.status).text}
                  </span>
                  {project.assignedTo && (<span className="status-badge-sub status-badge-pink"><FaUser size={12} className="inline mr-1" /> {project.assignedTo}</span>)}
                </td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px', textAlign: 'center' }}>
                  {isPendingTab ? (
                    project.pendingEdit ? 'Chờ duyệt sửa' : project.pendingDelete ? 'Chờ duyệt xóa' : (project.status === 'Chờ duyệt' ? 'Chờ duyệt mới' : 'Đã duyệt')
                  ) : (
                    project.pendingEdit ? <span className="text-yellow-600 font-semibold">Đang chờ duyệt sửa</span> :
                    project.pendingDelete ? <span className="text-red-600 font-semibold">Đang chờ duyệt xóa</span> :
                    (project.status === 'Chờ duyệt' ? 'Chờ duyệt mới' : 'Đã duyệt')
                  )}
                </td>
                {renderCell(project, { field: 'leadershipApproval' })}
                {renderCell(project, { field: 'notes' })}
                <td className="sticky-col-last" style={{ borderRight: '1px solid #E5E7EB', padding: '12px 8px', position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 20 }}>
                  <div className="flex justify-center items-center gap-2">
                    {user?.permissions?.edit && !isPendingTab && (
                      <div className="action-btn-wrapper" title={project.pendingEdit ? "Yêu cầu sửa đang chờ duyệt" : project.pendingDelete ? "Yêu cầu xóa đang chờ duyệt" : "Sửa/Xem chi tiết"}>
                        <button onClick={() => openEditModal(project)} className="btn-icon btn-icon-teal" disabled={isSubmitting || !!project.pendingEdit || !!project.pendingDelete }><FaEdit size={18} /></button>
                      </div>
                    )}
                    {user?.permissions?.delete && !isPendingTab && (
                      <div className="action-btn-wrapper" title={project.pendingDelete ? "Đang chờ duyệt xóa" : "Xóa"}>
                        <button onClick={() => deleteProject(project._id)} className="btn-icon btn-icon-red" disabled={isSubmitting || !!project.pendingDelete}><FaTrash size={18} /></button>
                      </div>
                    )}
                    {/* Actions for PENDING TAB */}
                    {isPendingTab && user?.permissions?.approve && (
                      <>
                        {project.status === 'Chờ duyệt' && !project.pendingEdit && !project.pendingDelete && ( // Yêu cầu tạo mới
                           <div className="flex items-center gap-2">
                            <div className="action-btn-wrapper" title="Duyệt công trình mới">
                              <button onClick={() => approveProject(project._id)} className="btn-icon btn-icon-green" disabled={isSubmitting}><FaCheckCircle size={20} /></button>
                            </div>
                            <div className="action-btn-wrapper" title="Từ chối công trình mới">
                              <button onClick={() => rejectProject(project._id)} className="btn-icon btn-icon-orange" disabled={isSubmitting}><FaTimesCircle size={20} /></button>
                            </div>
                          </div>
                        )}
                        {project.pendingEdit && project.status === 'Đã duyệt' && ( // Yêu cầu sửa
                          <div className="flex items-center gap-2">
                            {/* Nút xem chi tiết bị loại bỏ theo yêu cầu */}
                            {/* <div className="action-btn-wrapper" title="Xem chi tiết & Duyệt yêu cầu sửa">
                              <button onClick={() => openEditModal(project)} className="btn-icon btn-icon-teal mr-1" disabled={isSubmitting}><FaEdit size={18} /></button>
                            </div> */}
                            <div className="action-btn-wrapper" title="Duyệt yêu cầu sửa">
                              <button onClick={() => approveEditProject(project._id)} className="btn-icon btn-icon-blue" disabled={isSubmitting}><FaCheckCircle size={20} /></button>
                            </div>
                            <div className="action-btn-wrapper" title="Từ chối yêu cầu sửa">
                              <button onClick={() => rejectEditProject(project._id)} className="btn-icon btn-icon-yellow" disabled={isSubmitting}><FaTimesCircle size={20} /></button>
                            </div>
                          </div>
                        )}
                        {project.pendingDelete && project.status === 'Đã duyệt' && ( // Yêu cầu xóa
                          <div className="flex items-center gap-2">
                             {/* Nút xem chi tiết bị loại bỏ theo yêu cầu */}
                             {/* <div className="action-btn-wrapper" title="Xem chi tiết & Duyệt yêu cầu xóa">
                              <button onClick={() => openEditModal(project)} className="btn-icon btn-icon-teal mr-1" disabled={isSubmitting}><FaEdit size={18} /></button>
                            </div> */}
                            <div className="action-btn-wrapper" title="Duyệt yêu cầu xóa">
                              <button onClick={() => approveDeleteProject(project._id)} className="btn-icon btn-icon-red" disabled={isSubmitting}><FaCheckCircle size={20} /></button>
                            </div>
                            <div className="action-btn-wrapper" title="Từ chối yêu cầu xóa">
                              <button onClick={() => rejectDeleteProject(project._id)} className="btn-icon btn-icon-gray" disabled={isSubmitting}><FaTimesCircle size={20} /></button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {user?.permissions?.assign && !isPendingTab && (project.status === 'Đã duyệt' || project.status === 'allocated') && !project.pendingEdit && !project.pendingDelete && (
                      <div className="action-btn-wrapper">
                        <input type="text" value={assignPersons[project._id] || ''} onChange={(e) => setAssignPersons((prev) => ({ ...prev, [project._id]: e.target.value }))} placeholder="Nhập người phụ trách" className="form-input text-sm py-1 px-2 w-20" disabled={isSubmitting || !!project.pendingEdit || !!project.pendingDelete} />
                        <button onClick={() => assignProject(project._id)} className="btn-icon btn-icon-purple" disabled={isSubmitting || !assignPersons[project._id] || !!project.pendingEdit || !!project.pendingDelete}><FaUser size={16} /></button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-center mt-4">
        <div className="text-center text-[var(--text-secondary)] text-sm">Hiển thị {filteredProjects.length} trên tổng số {totalProjectsCount} công trình</div>
        {totalPages > 1 && !isPendingTab && renderPagination()}
      </div>
    </div>
  );
}

export default MinorRepairProjectTable;
