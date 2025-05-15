import { FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaUser } from 'react-icons/fa';

function MinorRepairProjectTable({
  filteredProjects,
  user,
  isSubmitting,
  openEditModal,
  approveProject,
  rejectProject,
  deleteProject,
  assignProject,
  assignPersons,
  setAssignPersons,
  isLoading,
  totalPages,
  currentPage,
  setCurrentPage,
  totalProjectsCount,
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
      case 'pending':
        return { className: 'status-badge-yellow', icon: '🟡', text: 'Chờ duyệt' };
      case 'approved':
        return { className: 'status-badge-green', icon: '🟢', text: 'Đã duyệt' };
      case 'rejected':
        return { className: 'status-badge-red', icon: '🔴', text: 'Từ chối' };
      case 'allocated':
        return { className: 'status-badge-orange', icon: '🟠', text: 'Đã phân bổ' };
      case 'assigned':
        return { className: 'status-badge-pink', icon: '🔵', text: 'Đã phân công' };
      default:
        return { className: 'status-badge-gray', icon: '⚪', text: 'Không xác định' };
    }
  };

  if (isLoading) {
    return (
      <div className="table-container">
        <table className="table-fixed">
          <thead>
            <tr>
              {Array(11)
                .fill()
                .map((_, idx) => (
                  <th key={idx}>
                    <div className="skeleton h-6 w-full rounded"></div>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {Array(5)
              .fill()
              .map((_, rowIdx) => (
                <tr key={rowIdx}>
                  {Array(11)
                    .fill()
                    .map((_, colIdx) => (
                      <td key={colIdx}>
                        <div className="skeleton h-6 w-full rounded"></div>
                      </td>
                    ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!filteredProjects || filteredProjects.length === 0) {
    return (
      <div className="text-center text-[var(--text-secondary)] py-10">
        Không tìm thấy công trình nào.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="table-container" style={{ border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '8px', overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        <table style={{ width: '2000px', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {/* Tab Cơ bản */}
              <th className="sticky-col-1" style={{ width: '40px', position: 'sticky', top: 0, left: 0, backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', zIndex: 40 }}>STT</th>
              <th className="sticky-col-2" style={{ width: '200px', position: 'sticky', top: 0, left: '40px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', zIndex: 30 }}>Tên công trình</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Đơn vị phân bổ</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Địa điểm</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Quy mô</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Ngày xảy ra sự cố</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Người phê duyệt</th>
              {/* Tab Phân công */}
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Người theo dõi</th>
              {/* Tab Cập nhật tiến độ */}
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Ngày kiểm tra</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Ngày thanh toán</th>
              <th style={{ width: '150px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Giá trị thanh toán</th>
              <th style={{ width: '120px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Tình trạng</th>
              <th style={{ width: '120px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Trạng thái</th>
              {/* Các trường chuyển xuống cuối */}
              <th style={{ width: '200px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Bút phê lãnh đạo</th>
              <th style={{ width: '200px', backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 16px', position: 'sticky', top: 0 }}>Ghi chú</th>
              <th className="sticky-col-last" style={{ width: '100px', position: 'sticky', top: 0, right: 0, backgroundColor: '#3B82F6', color: 'white', borderRight: '1px solid #2563EB', borderBottom: '1px solid #2563EB', padding: '12px 8px', zIndex: 30 }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project, index) => (
              <tr
                key={project._id}
                className="hover:bg-blue-100 transition-colors duration-200"
                style={{ borderBottom: '1px solid #E5E7EB' }}
              >
                {/* Tab Cơ bản */}
                <td className="sticky-col-1" style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 30 }}>
                  {(currentPage - 1) * 10 + index + 1}
                </td>
                <td className="sticky-col-2" style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px', position: 'sticky', left: '40px', backgroundColor: 'white', zIndex: 20 }}>
                  {project.name}
                </td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px' }}>{project.allocatedUnit || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px' }}>{project.location || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px' }}>{project.scale || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px' }}>{project.reportDate ? new Date(project.reportDate).toLocaleDateString('vi-VN') : 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px', textAlign: 'center' }}>{project.approvedBy ? project.approvedBy.username : 'N/A'}</td>
                {/* Tab Phân công */}
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px' }}>{project.supervisor || 'N/A'}</td>
                {/* Tab Cập nhật tiến độ */}
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px' }}>{project.inspectionDate ? new Date(project.inspectionDate).toLocaleDateString('vi-VN') : 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px' }}>{project.paymentDate ? new Date(project.paymentDate).toLocaleDateString('vi-VN') : 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px', textAlign: 'right' }}>{project.paymentValue ? `${project.paymentValue.toLocaleString()} VND` : 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px', textAlign: 'center' }}>
                  <span className={`status-badge ${getStatusBadge(project.status).className}`}>
                    <span className="status-icon">{getStatusBadge(project.status).icon}</span>
                    {getStatusBadge(project.status).text}
                  </span>
                  {project.assignedTo && (
                    <span className={`status-badge-sub ${getStatusBadge('assigned').className}`}>
                      {project.assignedTo}
                    </span>
                  )}
                </td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px', textAlign: 'center' }}>
                  {project.pendingEdit ? 'Chờ duyệt sửa' : project.pendingDelete ? 'Chờ duyệt xóa' : 'Đã duyệt'}
                </td>
                {/* Các trường chuyển xuống cuối */}
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px' }}>{project.leadershipApproval || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '12px 16px' }}>{project.notes || 'N/A'}</td>
                <td className="sticky-col-last" style={{ borderRight: '1px solid #E5E7EB', padding: '12px 8px', position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 20 }}>
                  <div className="flex justify-center items-center gap-0.5">
                    {user?.permissions?.edit && (
                      <div className="action-btn-wrapper">
                        <button
                          onClick={() => openEditModal(project)}
                          className="btn-icon btn-icon-teal"
                          disabled={isSubmitting}
                        >
                          <FaEdit size={16} />
                        </button>
                        <span className="tooltip"></span>
                      </div>
                    )}
                    {user?.permissions?.delete && (
                      <div className="action-btn-wrapper">
                        <button
                          onClick={() => deleteProject(project._id)}
                          className="btn-icon btn-icon-red"
                          disabled={isSubmitting}
                        >
                          <FaTrash size={16} />
                        </button>
                        <span className="tooltip"></span>
                      </div>
                    )}
                    {user?.permissions?.approve && project.status === 'pending' && (
                      <>
                        <div className="action-btn-wrapper">
                          <button
                            onClick={() => approveProject(project._id)}
                            className="btn-icon btn-icon-green"
                            disabled={isSubmitting}
                          >
                            <FaCheckCircle size={16} />
                          </button>
                          <span className="tooltip"></span>
                        </div>
                        <div className="action-btn-wrapper">
                          <button
                            onClick={() => rejectProject(project._id)}
                            className="btn-icon btn-icon-orange"
                            disabled={isSubmitting}
                          >
                            <FaTimesCircle size={16} />
                          </button>
                          <span className="tooltip"></span>
                        </div>
                      </>
                    )}
                    {user?.permissions?.assign && (project.status === 'approved' || project.status === 'allocated') && (
                      <div className="action-btn-wrapper">
                        <input
                          type="text"
                          value={assignPersons[project._id] || ''}
                          onChange={(e) =>
                            setAssignPersons((prev) => ({
                              ...prev,
                              [project._id]: e.target.value,
                            }))
                          }
                          placeholder="Nhập người phụ trách"
                          className="form-input text-sm py-1 px-2 w-20"
                          disabled={isSubmitting}
                        />
                        <button
                          onClick={() => assignProject(project._id)}
                          className="btn-icon btn-icon-purple"
                          disabled={isSubmitting || !assignPersons[project._id]}
                        >
                          <FaUser size={16} />
                        </button>
                        <span className="tooltip"></span>
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
        <div className="text-center text-[var(--text-secondary)] text-sm">
          Hiển thị {filteredProjects.length} trên tổng số {totalProjectsCount} công trình
        </div>
        {totalPages > 1 && renderPagination()}
      </div>
    </div>
  );
}

export default MinorRepairProjectTable;