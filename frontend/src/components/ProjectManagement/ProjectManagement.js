import { FaPlus } from 'react-icons/fa';
import ProjectManagementLogic from './ProjectManagementLogic';
import ProjectManagementTabs from './ProjectManagementTabs';
import CategoryProjectFilter from './CategoryProjectFilter';
import MinorRepairProjectFilter from './MinorRepairProjectFilter';
import CategoryProjectForm from './CategoryProjectForm';
import MinorRepairProjectForm from './MinorRepairProjectForm';
import CategoryProjectTable from './CategoryProjectTable';
import MinorRepairProjectTable from './MinorRepairProjectTable';
import RejectedProjectTable from './RejectedProjectTable';

function ProjectManagement({ user, type, showHeader, addMessage }) {
  const {
    filteredProjects,
    pendingProjects,
    rejectedProjects,
    totalPages,
    currentPage,
    setCurrentPage,
    sortOrder,
    setSortOrder,
    showFilter,
    setShowFilter,
    totalProjectsCount,
    newProject,
    setNewProject,
    editProject,
    setEditProject,
    allocateWaves,
    setAllocateWaves,
    assignPersons,
    setAssignPersons,
    filterAllocatedUnit,
    setFilterAllocatedUnit,
    filterConstructionUnit,
    setFilterConstructionUnit,
    filterName,
    setFilterName,
    filterAllocationWave,
    setFilterAllocationWave,
    filterSupervisor,
    setFilterSupervisor,
    filterEstimator,
    setFilterEstimator,
    filterReportDate,
    setFilterReportDate,
    allocatedUnits,
    constructionUnitsList,
    allocationWavesList,
    usersList,
    showModal,
    setShowModal,
    isLoading,
    isSubmitting,
    activeTab,
    setActiveTab,
    initialNewProjectState,
    handleInputChange,
    handleNumericInputChange,
    saveProject,
    handleResetFilters,
    openAddNewModal,
    openEditModal,
    deleteProject,
    approveProject,
    rejectProject,
    allocateProject,
    assignProject,
    approveEditProject,
    rejectEditProject,
    approveDeleteProject,
    rejectDeleteProject,
    restoreRejectedProject, // Lấy hàm mới
    permanentlyDeleteRejectedProject, // Lấy hàm mới
  } = ProjectManagementLogic({ user, type, showHeader, addMessage });

  const isCategory = type === 'category';

  return (
    <div className={`flex flex-col min-h-screen py-3 px-1 md:py-4 md:px-2 lg:py-5 lg:px-3 ${!showHeader ? 'pt-4' : 'pt-16 md:pt-8'} bg-gradient-to-b from-gray-50 to-gray-100`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 animate-slideIn">
          {isCategory ? 'Công trình Danh mục' : 'Công trình Sửa chữa nhỏ'}
        </h1>
        <div className="flex items-center gap-4">
          {user?.permissions?.add && (
            <button
              onClick={openAddNewModal}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isLoading}
            >
              <FaPlus size={16} /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {(isLoading || isSubmitting) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E5E7EB',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #3B82F6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}></div>
            <span style={{
              color: '#1F2937',
              fontSize: '18px',
              fontWeight: '600',
            }}>
              {isLoading ? 'Đang tải dữ liệu...' : 'Đang xử lý...'}
            </span>
          </div>
        </div>
      )}

      {newProject && (
        <>
          {isCategory ? (
            <CategoryProjectForm
              key={editProject ? editProject._id : 'new'}
              showModal={showModal}
              setShowModal={setShowModal}
              isSubmitting={isSubmitting}
              editProject={editProject}
              newProject={newProject}
              handleInputChange={handleInputChange}
              handleNumericInputChange={handleNumericInputChange}
              saveProject={saveProject}
              user={user}
              allocatedUnits={allocatedUnits}
              allocationWavesList={allocationWavesList}
              constructionUnitsList={constructionUnitsList}
              usersList={usersList}
              initialNewProjectState={initialNewProjectState}
              setNewProject={setNewProject}
            />
          ) : (
            <MinorRepairProjectForm
              key={editProject ? editProject._id : 'new'}
              showModal={showModal}
              setShowModal={setShowModal}
              isSubmitting={isSubmitting}
              editProject={editProject}
              newProject={newProject}
              handleInputChange={handleInputChange}
              handleNumericInputChange={handleNumericInputChange}
              saveProject={saveProject}
              user={user}
              allocatedUnits={allocatedUnits}
              initialNewProjectState={initialNewProjectState}
              setNewProject={setNewProject}
              usersList={usersList}
            />
          )}
        </>
      )}

      <ProjectManagementTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLoading={isLoading}
        isSubmitting={isSubmitting}
      />

      {activeTab === 'projects' && (
        <>
          <div className="mb-3">
            {isCategory ? (
              <CategoryProjectFilter
                filterAllocatedUnit={filterAllocatedUnit}
                setFilterAllocatedUnit={setFilterAllocatedUnit}
                filterConstructionUnit={filterConstructionUnit}
                setFilterConstructionUnit={setFilterConstructionUnit}
                filterName={filterName}
                setFilterName={setFilterName}
                filterAllocationWave={filterAllocationWave}
                setFilterAllocationWave={setFilterAllocationWave}
                filterSupervisor={filterSupervisor}
                setFilterSupervisor={setFilterSupervisor}
                filterEstimator={filterEstimator}
                setFilterEstimator={setFilterEstimator}
                allocatedUnits={allocatedUnits}
                constructionUnitsList={constructionUnitsList}
                allocationWavesList={allocationWavesList}
                usersList={usersList}
                isLoading={isLoading || isSubmitting}
                onResetFilters={handleResetFilters}
                showFilter={showFilter}
                setShowFilter={setShowFilter}
              />
            ) : (
              <MinorRepairProjectFilter
                filterAllocatedUnit={filterAllocatedUnit}
                setFilterAllocatedUnit={setFilterAllocatedUnit}
                filterName={filterName}
                setFilterName={setFilterName}
                filterSupervisor={filterSupervisor}
                setFilterSupervisor={setFilterSupervisor}
                filterReportDate={filterReportDate}
                setFilterReportDate={setFilterReportDate}
                allocatedUnits={allocatedUnits}
                usersList={usersList}
                isLoading={isLoading || isSubmitting}
                onResetFilters={handleResetFilters}
                showFilter={showFilter}
                setShowFilter={setShowFilter}
              />
            )}
          </div>

          {isCategory ? (
            <CategoryProjectTable
              filteredProjects={filteredProjects}
              user={user}
              isSubmitting={isSubmitting}
              openEditModal={openEditModal}
              approveProject={approveProject}
              rejectProject={rejectProject}
              deleteProject={deleteProject}
              allocateProject={allocateProject}
              assignProject={assignProject}
              allocateWaves={allocateWaves}
              setAllocateWaves={setAllocateWaves}
              assignPersons={assignPersons}
              setAssignPersons={setAssignPersons}
              isLoading={isLoading}
              totalPages={totalPages}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              allocationWavesList={allocationWavesList}
              totalProjectsCount={totalProjectsCount}
            />
          ) : (
            <MinorRepairProjectTable
              filteredProjects={filteredProjects}
              user={user}
              isSubmitting={isSubmitting}
              openEditModal={openEditModal}
              approveProject={approveProject}
              rejectProject={rejectProject}
              deleteProject={deleteProject}
              assignProject={assignProject}
              assignPersons={assignPersons}
              setAssignPersons={setAssignPersons}
              isLoading={isLoading}
              totalPages={totalPages}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalProjectsCount={totalProjectsCount}
            />
          )}
        </>
      )}

      {activeTab === 'pending' && (
        isCategory ? (
          <CategoryProjectTable
            filteredProjects={pendingProjects}
            user={user}
            isSubmitting={isSubmitting}
            openEditModal={openEditModal} // Sửa/xem chi tiết công trình đang chờ duyệt
            approveProject={approveProject}
            rejectProject={rejectProject}
            approveEditProject={approveEditProject}
            rejectEditProject={rejectEditProject}
            approveDeleteProject={approveDeleteProject}
            rejectDeleteProject={rejectDeleteProject}
            // Các props không dùng cho tab pending
            // deleteProject, allocateProject, assignProject, allocateWaves, setAllocateWaves, assignPersons, setAssignPersons
            isLoading={isLoading}
            totalPages={1} // Giả định pendingProjects là danh sách đầy đủ hoặc trang đầu tiên
            currentPage={1}
            setCurrentPage={() => {}} // Không có phân trang riêng cho tab này (hiện tại)
            totalProjectsCount={pendingProjects.length}
            // allocationWavesList={allocationWavesList} // Không cần thiết cho tab này
            isPendingTab={true} // Flag để table biết đây là tab pending
          />
        ) : (
          <MinorRepairProjectTable
            filteredProjects={pendingProjects}
            user={user}
            isSubmitting={isSubmitting}
            openEditModal={openEditModal}
            approveProject={approveProject}
            rejectProject={rejectProject}
            approveEditProject={approveEditProject}
            rejectEditProject={rejectEditProject}
            approveDeleteProject={approveDeleteProject}
            rejectDeleteProject={rejectDeleteProject}
            // Các props không dùng cho tab pending
            // deleteProject, assignProject, assignPersons, setAssignPersons
            isLoading={isLoading}
            totalPages={1}
            currentPage={1}
            setCurrentPage={() => {}}
            totalProjectsCount={pendingProjects.length}
            isPendingTab={true} // Flag để table biết đây là tab pending
          />
        )
      )}

      {activeTab === 'rejected' && (
        <RejectedProjectTable
          rejectedProjects={rejectedProjects}
          isLoading={isLoading}
          user={user}
          type={type} // Để RejectedProjectTable có thể lọc theo type nếu cần
          restoreRejectedProject={restoreRejectedProject} // Truyền hàm mới
          permanentlyDeleteRejectedProject={permanentlyDeleteRejectedProject} // Truyền hàm mới
        />
      )}
    </div>
  );
}

export default ProjectManagement;