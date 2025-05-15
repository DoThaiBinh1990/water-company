import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

function ProjectManagementTabs({
  activeTab,
  setActiveTab,
  isLoading,
  isSubmitting,
  pendingProjects,
  rejectedProjects,
  user,
  isCategory,
  approveProject,
  rejectProject,
  approveEditProject,
  rejectEditProject,
  approveDeleteProject,
  rejectDeleteProject,
}) {
  return (
    <div className="flex flex-wrap gap-4 border-b mb-2">
      <button
        onClick={() => setActiveTab('projects')}
        className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'projects' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`}
        disabled={isLoading || isSubmitting}
      >
        Danh mục công trình
      </button>
      <button
        onClick={() => setActiveTab('pending')}
        className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`}
        disabled={isLoading || isSubmitting}
      >
        Danh sách công trình chờ duyệt
      </button>
      <button
        onClick={() => setActiveTab('rejected')}
        className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'rejected' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`}
        disabled={isLoading || isSubmitting}
      >
        Công trình bị từ chối
      </button>
    </div>
  );
}

export default ProjectManagementTabs;