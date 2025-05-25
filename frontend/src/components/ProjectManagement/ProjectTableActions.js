// d:\CODE\water-company\frontend\src\components\ProjectManagement\ProjectTableActions.js
import React from 'react';
// Đảm bảo activeTab được truyền vào nếu bạn muốn sử dụng nó ở đây
import { FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaSpinner, FaCheckSquare, FaArrowCircleRight } from 'react-icons/fa'; // Thêm icon mới

function ProjectTableActions({
  project,
  user,
  isPendingTab,
  isSubmitting, // General submitting state for all actions on this row
  openEditModal,
  deleteProject,
  approveProject,
  rejectProject,
  approveEditProject,
  rejectEditProject,
  approveDeleteProject,
  rejectDeleteProject,
  markProjectAsCompleted, // Action mới
  moveProjectToNextYear, // Action mới
  // allocateProject, // Removed
  // assignProject, // Removed
  // allocateWaves, // Removed
  // setAllocateWaves, // Removed
  // allocationWavesList, // Removed
  // assignPersons, // Removed
  // activeTab, // Thêm activeTab nếu bạn cần nó để kiểm tra điều kiện hiển thị nút
  // setAssignPersons, // Removed
  isCategoryProject,
}) {
  const canEdit = user?.permissions?.edit;
  const canDelete = user?.permissions?.delete;
  const canApprove = user?.permissions?.approve; 
  const canMarkComplete = user?.role === 'admin' || user?.role.includes('manager') || user?.role.includes('director'); // Ví dụ quyền
  const canMoveNextYear = user?.role === 'admin' || user?.role.includes('manager') || user?.role.includes('director'); // Ví dụ quyền
  // const canAllocate = user?.permissions?.allocate && isCategoryProject; // Unused
  // const canAssign = user?.permissions?.assign; // Unused
 
  const hasPendingAction = !!project.pendingEdit || !!project.pendingDelete;

  // const currentAllocateWave = allocateWaves && project._id ? allocateWaves[project._id] : ''; // Removed
  // const currentAssignPerson = assignPersons && project._id ? assignPersons[project._id] : ''; // Removed

  // Helper function để kiểm tra quyền duyệt/từ chối cho yêu cầu cụ thể này
  const canUserActOnThisRequest = (projectToCheck) => {
    // console.log(`[PTA Debug] Checking canUserActOnThisRequest for project ID: ${projectToCheck?._id}, Name: ${projectToCheck?.name}`);
    // console.log(`[PTA Debug] Current user ID: ${user?._id}, Username: ${user?.username}`);
    // console.log(`[PTA Debug] Project approvedBy (raw):`, projectToCheck?.approvedBy);
    // console.log(`[PTA Debug] Project pendingEdit.data.approvedBy (raw):`, projectToCheck?.pendingEdit?.data?.approvedBy);

    // 1. Admin luôn có quyền thực hiện action nếu họ có quyền duyệt chung
    if (user?.role === 'admin' && user?.permissions?.approve) {
      // console.log('[PTA Debug] User is admin with approve permission. Returning true.');
      return true;
    }

    let designatedApproverIdString = null;

    // Ưu tiên người duyệt được gán cho YÊU CẦU SỬA (pendingEdit)
    if (projectToCheck?.pendingEdit?.data?.approvedBy) {
      const approverForEdit = projectToCheck.pendingEdit.data.approvedBy;
      if (typeof approverForEdit === 'string') {
        designatedApproverIdString = approverForEdit;
      } else if (typeof approverForEdit === 'object' && approverForEdit._id) {
        designatedApproverIdString = String(approverForEdit._id);
      }
    // Nếu không có YC sửa, hoặc YC sửa không có người duyệt riêng,
    // thì kiểm tra người duyệt của YÊU CẦU TẠO MỚI hoặc YÊU CẦU XÓA
    } else if (projectToCheck && (projectToCheck.status === 'Chờ duyệt' || projectToCheck.pendingDelete) && projectToCheck.approvedBy) {
      const mainApprover = projectToCheck.approvedBy;
      if (typeof mainApprover === 'string') {
        designatedApproverIdString = mainApprover;
      } else if (typeof mainApprover === 'object' && mainApprover._id) {
        designatedApproverIdString = String(mainApprover._id);
      }
    }
    // console.log(`[PTA Debug] Designated approver ID string (processed): ${designatedApproverIdString}`);

    if (designatedApproverIdString) { // Nếu có người duyệt cụ thể được gán và đã lấy được ID dạng string
      const canAct = String(user._id) === designatedApproverIdString;
      // console.log(`[PTA Debug] Comparison: String(user._id) === designatedApproverIdString -> ${String(user._id)} === ${designatedApproverIdString} = ${canAct}`);
      return canAct; // Nếu người dùng hiện tại là người được chỉ định, cho phép action (bất kể quyền approve chung)
    }
    // Nếu không có ai cụ thể được chỉ định, kiểm tra quyền duyệt chung của user
    console.log(`[PTA Debug] No designated approver. Checking general approve permission: ${user?.permissions?.approve}`);
    return !!user?.permissions?.approve; // Chỉ cho phép nếu user có quyền duyệt chung (và không có người được chỉ định)
  };
  const isActionAllowedForThis = canUserActOnThisRequest(project);
  // console.log(`[PTA Debug] Final isActionAllowedForThis for project ${project?._id}: ${isActionAllowedForThis}`);
  return (
    <div className="flex justify-center items-center gap-1 flex-wrap">
      {!isPendingTab && !hasPendingAction && ( // Chỉ hiển thị nút Sửa/Xóa/Hoàn thành/Chuyển năm khi không có YC đang chờ
        <>
          {canEdit && (
            <div className="action-btn-wrapper" title={project.pendingEdit ? "YC sửa đang chờ" : project.pendingDelete ? "YC xóa đang chờ" : "Sửa/Xem"}>
              <button
                onClick={() => openEditModal(project)}
                className={`btn-icon btn-icon-teal ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting}
              >
                <FaEdit size={18} />
              </button>
            </div>
          )}
          {canDelete && (
            <div className="action-btn-wrapper" title={project.pendingDelete ? "Đang chờ duyệt xóa" : "Xóa/YC Xóa"}>
              <button
                onClick={() => deleteProject(project._id)}
                className={`btn-icon btn-icon-red ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting}
              >
                <FaTrash size={18} />
              </button>
            </div>
          )}
          {/* Nút Đánh dấu hoàn thành và Chuyển năm */}
          {/* Giả sử activeTab được truyền vào props nếu cần */}
          {canMarkComplete && !project.isCompleted && ( // Chỉ hiển thị khi chưa hoàn thành và không có YC đang chờ (đã check ở group ngoài)
            <div className="action-btn-wrapper" title="Đánh dấu hoàn thành">
              <button
                onClick={() => markProjectAsCompleted(project._id)}
                className={`btn-icon btn-icon-emerald ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting}
              >
                <FaCheckSquare size={18} />
              </button>
            </div>
          )}
          {canMoveNextYear && !project.isCompleted && ( // Chỉ hiển thị khi chưa hoàn thành và không có YC đang chờ (đã check ở group ngoài)
            <div className="action-btn-wrapper" title="Chuyển sang năm sau">
              <button
                onClick={() => moveProjectToNextYear(project._id)}
                className={`btn-icon btn-icon-sky ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting}
              >
                <FaArrowCircleRight size={18} />
              </button>
            </div>
          )}
          {/* {canAllocate && project.status === 'Đã duyệt' && !hasPendingAction && allocateProject && (
            <div className="action-btn-wrapper flex items-center">
              <select
                value={currentAllocateWave}
                onChange={(e) => setAllocateWaves((prev) => ({ ...prev, [project._id]: e.target.value }))}
                className={`form-input text-xs py-1 px-1.5 w-20 sm:w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Chọn đợt</option>
                {(allocationWavesList || []).map((wave) => (<option key={wave} value={wave}>{wave}</option>))}
              </select>
              <button
                onClick={() => allocateProject(project._id)} // allocateProject from logic will use the state
                className={`btn-icon btn-icon-purple ml-1 ${isSubmitting || !currentAllocateWave ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting || !currentAllocateWave}
                title="Phân bổ"
              >
                {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaWrench size={16} />}
              </button>
            </div>
          )} */}
          {/* {canAssign && (project.status === 'Đã duyệt' || project.status === 'Đã phân bổ' || project.status === 'Đang thực hiện') && !hasPendingAction && assignProject && (
             <div className="action-btn-wrapper flex items-center">
              <input
                type="text"
                value={currentAssignPerson}
                onChange={(e) => setAssignPersons((prev) => ({ ...prev, [project._id]: e.target.value }))}
                placeholder="ID Giám sát" // Hoặc "ID GS, ID DT" nếu gộp
                className={`form-input text-xs py-1 px-1.5 w-20 sm:w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting}
              />
              <button
                onClick={() => assignProject(project._id)} // assignProject from logic will use the state
                className={`btn-icon btn-icon-blue ml-1 ${isSubmitting || !currentAssignPerson ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting || !currentAssignPerson}
                title="Phân công"
              >
                 {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaUser size={16} />}
              </button>
            </div>
          )} */}
        </>
      )}

      {isPendingTab && isActionAllowedForThis && ( // Chỉ hiển thị nếu user này được phép action
        <>
          {project.status === 'Chờ duyệt' && !project.pendingEdit && !project.pendingDelete && (
            <div className="flex items-center gap-1">
              <div className="action-btn-wrapper" title="Duyệt mới">
                <button onClick={() => approveProject(project._id)} className={`btn-icon btn-icon-green ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting && project._id === window.currentActionProjectId ? <FaSpinner className="animate-spin" /> : <FaCheckCircle size={20} />}
                </button>
              </div>
              <div className="action-btn-wrapper" title="Từ chối mới">
                <button onClick={() => rejectProject(project._id)} className={`btn-icon btn-icon-orange ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting && project._id === window.currentActionProjectId ? <FaSpinner className="animate-spin" /> : <FaTimesCircle size={20} />}
                </button>
              </div>
            </div>
          )}
          {project.pendingEdit && project.status === 'Đã duyệt' && (
            <div className="flex items-center gap-1">
              <div className="action-btn-wrapper" title="Xem chi tiết YC sửa">
                 <button onClick={() => openEditModal(project)} className={`btn-icon btn-icon-teal ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}><FaEdit size={18} /></button>
              </div>
              <div className="action-btn-wrapper" title="Duyệt YC sửa">
                <button onClick={() => approveEditProject(project._id)} className={`btn-icon btn-icon-blue ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting && project._id === window.currentActionProjectId ? <FaSpinner className="animate-spin" /> : <FaCheckCircle size={20} />}
                </button>
              </div>
              <div className="action-btn-wrapper" title="Từ chối YC sửa">
                <button onClick={() => rejectEditProject(project._id)} className={`btn-icon btn-icon-yellow ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting && project._id === window.currentActionProjectId ? <FaSpinner className="animate-spin" /> : <FaTimesCircle size={20} />}
                </button>
              </div>
            </div>
          )}
          {project.pendingDelete && project.status === 'Đã duyệt' && (
            <div className="flex items-center gap-1">
              <div className="action-btn-wrapper" title="Xem chi tiết YC xóa">
                 <button onClick={() => openEditModal(project)} className={`btn-icon btn-icon-teal ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}><FaEdit size={18} /></button>
              </div>
              <div className="action-btn-wrapper" title="Duyệt YC xóa">
                <button onClick={() => approveDeleteProject(project._id)} className={`btn-icon btn-icon-red ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting && project._id === window.currentActionProjectId ? <FaSpinner className="animate-spin" /> : <FaCheckCircle size={20} />}
                </button>
              </div>
              <div className="action-btn-wrapper" title="Từ chối YC xóa">
                <button onClick={() => rejectDeleteProject(project._id)} className={`btn-icon btn-icon-gray ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting && project._id === window.currentActionProjectId ? <FaSpinner className="animate-spin" /> : <FaTimesCircle size={20} />}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProjectTableActions;
