import React from 'react';
import { FaInfoCircle, FaUndo, FaTrash } from 'react-icons/fa';
import { formatDate } from '../../utils/helpers'; // Import formatDate
import { toast } from 'react-toastify';

function RejectedProjectTable({
  rejectedProjects,
  isLoading,
  user,
  type,
  restoreRejectedProject,
  permanentlyDeleteRejectedProject,
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
        <p className="text-lg text-gray-600">Đang tải danh sách công trình bị từ chối...</p>
      </div>
    );
  }

  // Lọc dựa trên prop 'type' (category hoặc minor_repair)
  const filteredRejectedProjects = rejectedProjects.filter(p => {
    // Backend đã trả về projectType là 'category' hoặc 'minor_repair'
    if (p.projectType === type) return true;
    return false;
  });


  if (!filteredRejectedProjects || filteredRejectedProjects.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10 bg-white shadow-md rounded-lg">
        <FaInfoCircle size={48} className="mx-auto text-blue-400 mb-4" />
        <p className="text-xl">Không có công trình nào bị từ chối.</p>
      </div>
    );
  }

  const getActionTypeDisplay = (actionType) => {
    switch (actionType) {
      case 'new': return 'Yêu cầu tạo mới';
      case 'edit': return 'Yêu cầu sửa';
      case 'delete': return 'Yêu cầu xóa';
      default: return actionType || 'Không xác định';
    }
  };

  return (
    <div className="flex flex-col mt-4">
      <div className="table-container" style={{ border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '8px', overflow: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
        <table style={{ minWidth: '800px', width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="bg-gray-50">
            <tr>
              <th style={{ width: '50px', backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>STT</th>
              <th style={{ backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>Tên công trình</th>
              <th style={{ backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>Địa điểm</th>
              <th style={{ backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>Quy mô</th>
              <th style={{ backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>Chi nhánh PB</th>
              <th style={{ backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>Loại yêu cầu bị từ chối</th>
              <th style={{ backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>Người yêu cầu</th>
              <th style={{ backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>Người từ chối</th>
              <th style={{ backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>Ngày từ chối</th>
              <th style={{ backgroundColor: '#4A5568', color: 'white', borderRight: '1px solid #2D3748', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, minWidth: '200px' }}>Lý do từ chối</th>
              <th
                className="sticky-col-last-header"
                style={{ width: '120px', backgroundColor: '#4A5568', color: 'white', borderBottom: '1px solid #2D3748', padding: '12px 16px', position: 'sticky', top: 0, right: 0, zIndex: 30 }}
              >
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRejectedProjects.map((project, index) => (
              <tr key={project._id || project.projectId} className="hover:bg-gray-100 transition-colors duration-150">
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>{index + 1}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', verticalAlign: 'top' }}>{project.name || project.details?.name || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', verticalAlign: 'top' }}>{project.location || project.details?.location || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', verticalAlign: 'top' }}>{project.scale || project.details?.scale || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', verticalAlign: 'top' }}>{project.allocatedUnit || project.details?.allocatedUnit || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', verticalAlign: 'top' }}>{getActionTypeDisplay(project.actionType)}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>{project.createdBy?.fullName || project.createdBy?.username || project.enteredBy || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>{project.rejectedBy?.fullName || project.rejectedBy?.username || 'N/A'}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>{formatDate(project.rejectedAt)}</td>
                <td style={{ borderRight: '1px solid #E5E7EB', padding: '10px 12px', verticalAlign: 'top', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{project.rejectionReason || 'N/A'}</td>
                <td
                  className="sticky-col-last"
                  style={{ padding: '8px', textAlign: 'center', position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 20, borderLeft: '1px solid #E5E7EB' }}
                >
                  <div className="flex justify-center items-center gap-2"> {/* Increased gap */}
                    {user?.permissions?.approve && restoreRejectedProject && (
                      <div className="action-btn-wrapper" title="Khôi phục công trình">
                        <button
                          onClick={() => restoreRejectedProject(project._id, project.details, project.projectModel, project.projectId, project.actionType)}
                          className="btn-icon btn-icon-green"
                          disabled={isLoading}
                        >
                          <FaUndo size={18} /> {/* Increased icon size */}
                        </button>
                      </div>
                    )}
                    {user?.permissions?.delete && permanentlyDeleteRejectedProject && (
                      <div className="action-btn-wrapper" title="Xóa vĩnh viễn">
                        <button
                          onClick={() => permanentlyDeleteRejectedProject(project._id)}
                          className="btn-icon btn-icon-red"
                          disabled={isLoading}
                        >
                          <FaTrash size={18} /> {/* Increased icon size */}
                        </button>
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
        <div className="text-center text-gray-500 text-sm">
          Hiển thị {filteredRejectedProjects.length} công trình bị từ chối.
        </div>
      </div>
    </div>
  );
}

export default RejectedProjectTable;
