// d:\CODE\water-company\frontend\src\components\ProjectManagement\ProjectTableActions.js
import React from 'react';
import { FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaWrench, FaUser, FaSpinner } from 'react-icons/fa';

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
  // allocateProject, // Removed
  // assignProject, // Removed
  // allocateWaves, // Removed
  // setAllocateWaves, // Removed
  // allocationWavesList, // Removed
  // assignPersons, // Removed
  // setAssignPersons, // Removed
  isCategoryProject,
}) {
  const canEdit = user?.permissions?.edit;
  const canDelete = user?.permissions?.delete;
  const canApprove = user?.permissions?.approve;
  const canAllocate = user?.permissions?.allocate && isCategoryProject;
  const canAssign = user?.permissions?.assign;

  const hasPendingAction = !!project.pendingEdit || !!project.pendingDelete;

  // const currentAllocateWave = allocateWaves && project._id ? allocateWaves[project._id] : ''; // Removed
  // const currentAssignPerson = assignPersons && project._id ? assignPersons[project._id] : ''; // Removed

  return (
    <div className="flex justify-center items-center gap-1 flex-wrap">
      {!isPendingTab && (
        <>
          {canEdit && (
            <div className="action-btn-wrapper" title={project.pendingEdit ? "YC sửa đang chờ" : project.pendingDelete ? "YC xóa đang chờ" : "Sửa/Xem"}>
              <button
                onClick={() => openEditModal(project)}
                className={`btn-icon btn-icon-teal ${isSubmitting || hasPendingAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting || hasPendingAction}
              >
                <FaEdit size={18} />
              </button>
            </div>
          )}
          {canDelete && (
            <div className="action-btn-wrapper" title={project.pendingDelete ? "Đang chờ duyệt xóa" : "Xóa/YC Xóa"}>
              <button
                onClick={() => deleteProject(project._id)}
                className={`btn-icon btn-icon-red ${isSubmitting || hasPendingAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSubmitting || hasPendingAction}
              >
                <FaTrash size={18} />
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

      {isPendingTab && canApprove && (
        <>
          {project.status === 'Chờ duyệt' && !project.pendingEdit && !project.pendingDelete && (
            <div className="flex items-center gap-1">
              <div className="action-btn-wrapper" title="Duyệt mới">
                <button onClick={() => approveProject(project._id)} className={`btn-icon btn-icon-green ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaCheckCircle size={20} />}
                </button>
              </div>
              <div className="action-btn-wrapper" title="Từ chối mới">
                <button onClick={() => rejectProject(project._id)} className={`btn-icon btn-icon-orange ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaTimesCircle size={20} />}
                </button>
              </div>
            </div>
          )}
          {project.pendingEdit && project.status === 'Đã duyệt' && (
            <div className="flex items-center gap-1">
              <div className="action-btn-wrapper" title="Xem YC sửa">
                 <button onClick={() => openEditModal(project)} className={`btn-icon btn-icon-teal ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}><FaEdit size={18} /></button>
              </div>
              <div className="action-btn-wrapper" title="Duyệt YC sửa">
                <button onClick={() => approveEditProject(project._id)} className={`btn-icon btn-icon-blue ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaCheckCircle size={20} />}
                </button>
              </div>
              <div className="action-btn-wrapper" title="Từ chối YC sửa">
                <button onClick={() => rejectEditProject(project._id)} className={`btn-icon btn-icon-yellow ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaTimesCircle size={20} />}
                </button>
              </div>
            </div>
          )}
          {project.pendingDelete && project.status === 'Đã duyệt' && (
            <div className="flex items-center gap-1">
              <div className="action-btn-wrapper" title="Xem YC xóa">
                 <button onClick={() => openEditModal(project)} className={`btn-icon btn-icon-teal ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}><FaEdit size={18} /></button>
              </div>
              <div className="action-btn-wrapper" title="Duyệt YC xóa">
                <button onClick={() => approveDeleteProject(project._id)} className={`btn-icon btn-icon-red ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaCheckCircle size={20} />}
                </button>
              </div>
              <div className="action-btn-wrapper" title="Từ chối YC xóa">
                <button onClick={() => rejectDeleteProject(project._id)} className={`btn-icon btn-icon-gray ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
                  {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaTimesCircle size={20} />}
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
