// frontend/src/pages/ProjectManagement.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaCheckCircle, FaTimesCircle, FaBuilding, FaUser, FaEdit, FaTrash, FaPlus, FaHardHat } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Modal from 'react-modal';
import 'react-toastify/dist/ReactToastify.css';
import { API_URL } from '../config';

Modal.setAppElement('#root');

function ProjectManagement({ user, type }) {
  const isCategory = type === 'category';
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const initialNewProjectState = useCallback(() => ({
    name: '',
    allocatedUnit: '',
    constructionUnit: '',
    allocationWave: '',
    location: '',
    scale: isCategory ? '' : undefined,
  }), [isCategory]);

  const [newProject, setNewProject] = useState(initialNewProjectState());
  const [editProject, setEditProject] = useState(null);

  const [allocateWaves, setAllocateWaves] = useState({});
  const [assignPersons, setAssignPersons] = useState({});

  const [filterStatus, setFilterStatus] = useState('');
  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [constructionUnitsList, setConstructionUnitsList] = useState([]);
  const [allocationWavesList, setAllocationWavesList] = useState([]);
  const [filterConstructionUnit, setFilterConstructionUnit] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setFilteredProjects([]);
      setTotalPages(1);
      return;
    }
    setIsLoading(true);
    const params = new URLSearchParams({ type, page: currentPage, limit: 10 });
    if (filterStatus) params.append('status', filterStatus);
    if (filterConstructionUnit) params.append('constructionUnit', filterConstructionUnit);

    try {
      const projectsRes = await axios.get(`${API_URL}/api/projects?${params.toString()}`);
      setFilteredProjects(projectsRes.data.projects);
      setTotalPages(projectsRes.data.pages || 1);
    } catch (error) {
      console.error("Lỗi khi tải danh sách công trình:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách công trình!', { position: "top-center" });
      setFilteredProjects([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [type, currentPage, filterStatus, filterConstructionUnit, user]);

  useEffect(() => {
    if (!user) return;
    const fetchAuxData = async () => {
      try {
        const [unitsRes, wavesRes, constUnitsRes] = await Promise.all([
          axios.get(`${API_URL}/api/allocated-units`),
          axios.get(`${API_URL}/api/allocation-waves`),
          axios.get(`${API_URL}/api/construction-units`),
        ]);
        setAllocatedUnits(unitsRes.data);
        setAllocationWavesList(wavesRes.data);
        setConstructionUnitsList(constUnitsRes.data);
      } catch (error) {
        console.error("Lỗi tải dữ liệu phụ trợ:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Lỗi khi tải dữ liệu phụ trợ!', { position: "top-center" });
      }
    };
    fetchAuxData();
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProjects();
    } else {
      setFilteredProjects([]);
      setTotalPages(1);
      setCurrentPage(1);
    }
  }, [user, currentPage, filterStatus, filterConstructionUnit, fetchProjects]);

  const openAddNewModal = () => {
    setEditProject(null);
    setNewProject({ ...initialNewProjectState() });
    setShowModal(true);
  };

  const openEditModal = (project) => {
    setEditProject(project);
    setNewProject({
      name: project.name || '',
      allocatedUnit: project.allocatedUnit || '',
      constructionUnit: project.constructionUnit || '',
      allocationWave: project.allocationWave || '',
      location: project.location || '',
      scale: isCategory ? project.scale || '' : undefined,
      enteredBy: project.enteredBy,
    });
    setShowModal(true);
  };

  const saveProject = async () => {
    const projectDataForValidation = { ...newProject };
    const requiredFields = [projectDataForValidation.name, projectDataForValidation.allocatedUnit, projectDataForValidation.location];

    if (isCategory && (!projectDataForValidation.scale || String(projectDataForValidation.scale).trim() === "")) {
      requiredFields.push(undefined);
    }

    if (requiredFields.some(field => field === undefined || field === null || (typeof field === 'string' && field.trim() === ""))) {
      toast.error('Vui lòng nhập đầy đủ các trường có dấu (*)!', { position: "top-center" });
      return;
    }
    setIsSubmitting(true);

    let projectPayload = { ...newProject, type };
    if (!isCategory && projectPayload.hasOwnProperty('scale')) {
      delete projectPayload.scale;
    }
    delete projectPayload.enteredBy;

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        let response;
        let successMessage = '';

        if (editProject) {
          const changedData = {};
          let hasChanges = false;
          Object.keys(projectPayload).forEach(key => {
            const fieldsToIgnoreOnEdit = ['type', '_id', 'categorySerialNumber', 'minorRepairSerialNumber', 'status', 'pendingEdit', 'pendingDelete', 'createdAt', 'updatedAt', '__v', 'enteredBy'];
            if (!fieldsToIgnoreOnEdit.includes(key) && projectPayload[key] !== editProject[key]) {
              changedData[key] = projectPayload[key];
              hasChanges = true;
            }
          });

          if (projectPayload.constructionUnit !== editProject.constructionUnit) {
            changedData.constructionUnit = projectPayload.constructionUnit;
            hasChanges = true;
          }

          if (!hasChanges) {
            toast.info('Không có thay đổi nào để cập nhật.', { position: "top-center" });
            setIsSubmitting(false);
            setShowModal(false);
            return;
          }
          response = await axios.patch(`${API_URL}/api/projects/${editProject._id}?type=${type}`, changedData);
          successMessage = response.data.message || (editProject.status === 'Đã duyệt' && user?.permissions?.edit && !user?.permissions?.approve ? 'Đã gửi yêu cầu sửa!' : 'Đã cập nhật công trình!');
        } else {
          response = await axios.post(`${API_URL}/api/projects`, projectPayload);
          successMessage = response.data.message || 'Đã đăng ký công trình!';
        }

        toast.success(successMessage, { position: "top-center" });
        fetchProjects();
        setShowModal(false);
        setNewProject(initialNewProjectState());
        setEditProject(null);
        break;
      } catch (error) {
        console.error("Lỗi khi lưu công trình:", error.response?.data?.message || error.message);
        if (error.response?.data?.message?.includes('Lỗi tạo số thứ tự') && retryCount < maxRetries - 1) {
          retryCount++;
          toast.warn(`Lỗi số thứ tự, đang thử lại (${retryCount}/${maxRetries})...`, { position: "top-center" });
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        toast.error(error.response?.data?.message || 'Lỗi khi lưu công trình!', { position: "top-center" });
        break;
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleActionWithConfirm = async (actionPromise, successMessage, confirmMessage = "Bạn có chắc chắn?") => {
    if (window.confirm(confirmMessage)) {
      setIsSubmitting(true);
      try {
        const response = await actionPromise();
        toast.success(successMessage || response?.data?.message || "Thao tác thành công!", { position: "top-center" });
        fetchProjects();
      } catch (error) {
        console.error("Lỗi hành động:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const deleteProject = (id) => handleActionWithConfirm(
    () => axios.delete(`${API_URL}/api/projects/${id}?type=${type}`),
    null,
    "Bạn có chắc muốn thực hiện thao tác xóa/yêu cầu xóa công trình này?"
  );

  const approveProject = (id) => handleActionWithConfirm(
    () => axios.patch(`${API_URL}/api/projects/${id}/approve?type=${type}`),
    'Đã duyệt công trình!',
    "Bạn có chắc muốn duyệt công trình này?"
  );

  const rejectProject = (id) => handleActionWithConfirm(
    () => axios.patch(`${API_URL}/api/projects/${id}/reject?type=${type}`),
    'Đã từ chối công trình!',
    "Bạn có chắc muốn từ chối công trình này?"
  );

  const allocateProject = (id) => {
    const wave = allocateWaves[id];
    if (!wave) return toast.error('Vui lòng chọn đợt phân bổ!', { position: "top-center" });
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/allocate?type=${type}`, { allocationWave: wave }),
      'Đã phân bổ công trình!',
      `Bạn có chắc muốn phân bổ công trình vào đợt "${wave}"?`
    ).then(() => setAllocateWaves(prev => ({ ...prev, [id]: '' })));
  };

  const assignProject = (id) => {
    const person = assignPersons[id];
    if (!person || person.trim() === "") return toast.error('Vui lòng nhập người phụ trách!', { position: "top-center" });
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/assign?type=${type}`, { assignedTo: person.trim() }),
      'Đã phân công công trình!',
      `Bạn có chắc muốn phân công cho "${person.trim()}"?`
    ).then(() => setAssignPersons(prev => ({ ...prev, [id]: '' })));
  };

  return (
    <div className="p-0">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 md:mb-8">
        {isCategory ? 'Quản lý Công trình Danh mục' : 'Quản lý Công trình Sửa chữa nhỏ'}
      </h1>
      
      {(isLoading && !isSubmitting) && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[1001] animate-fadeIn">
          <div className="text-white text-xl p-4 bg-blue-600 rounded-lg shadow-lg">Đang tải dữ liệu...</div>
        </div>
      )}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[1002] animate-fadeIn">
          <div className="text-white text-xl p-4 bg-green-600 rounded-lg shadow-lg">Đang xử lý...</div>
        </div>
      )}

      {user?.permissions?.add && (
        <button onClick={openAddNewModal} className="mb-6 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg" disabled={isSubmitting || isLoading}>
          <FaPlus /> Thêm công trình
        </button>
      )}

      <Modal
        isOpen={showModal}
        onRequestClose={() => { if (!isSubmitting) setShowModal(false); }}
        className="bg-white rounded-2xl p-6 md:p-8 max-w-2xl w-11/12 md:w-full mx-auto mt-10 md:mt-20 shadow-2xl animate-fadeIn focus:outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-[1000] p-4 overflow-y-auto"
        shouldCloseOnOverlayClick={!isSubmitting}
      >
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">{editProject ? 'Sửa công trình' : 'Đăng ký công trình mới'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên công trình <span className="text-red-500">*</span></label>
            <input type="text" placeholder="Nhập tên công trình" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị phân bổ <span className="text-red-500">*</span></label>
            <select value={newProject.allocatedUnit} onChange={(e) => setNewProject({ ...newProject, allocatedUnit: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting}>
              <option value="">Chọn đơn vị phân bổ</option>
              {allocatedUnits.map(unit => (<option key={unit._id} value={unit.name}>{unit.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị thi công</label>
            <select value={newProject.constructionUnit} onChange={(e) => setNewProject({ ...newProject, constructionUnit: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting}>
              <option value="">Chọn đơn vị thi công (nếu có)</option>
              {constructionUnitsList.map(unit => (<option key={unit._id} value={unit.name}>{unit.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đợt phân bổ</label>
            <select value={newProject.allocationWave} onChange={(e) => setNewProject({ ...newProject, allocationWave: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting}>
              <option value="">Chọn đợt phân bổ (nếu có)</option>
              {allocationWavesList.map(wave => (<option key={wave._id} value={wave.name}>{wave.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa điểm <span className="text-red-500">*</span></label>
            <input type="text" placeholder="Nhập địa điểm" value={newProject.location} onChange={(e) => setNewProject({ ...newProject, location: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting} />
          </div>
          {isCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quy mô <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Nhập quy mô" value={newProject.scale || ''} onChange={(e) => setNewProject({ ...newProject, scale: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Người nhập <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={editProject ? editProject.enteredBy : (user?.username || '')}
              readOnly
              className={`w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 cursor-not-allowed`}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={saveProject}
            className={`w-full sm:w-auto bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg ${isSubmitting || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isSubmitting || isLoading || (!user?.permissions?.add && !editProject) || (editProject && !user?.permissions?.edit)}
          >
            <FaCheckCircle /> {editProject ? ((editProject.status === 'Đã duyệt' && user?.permissions?.edit && !user?.permissions?.approve) ? 'Gửi yêu cầu sửa' : 'Cập nhật') : 'Đăng ký'}
          </button>
          <button onClick={() => { if (!isSubmitting) setShowModal(false); }} className={`w-full sm:w-auto bg-gray-500 text-white px-4 py-2.5 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition-all duration-200 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isSubmitting}>
            Hủy
          </button>
        </div>
      </Modal>

      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4">Bộ lọc công trình</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
            <select value={filterStatus} onChange={(e) => { setCurrentPage(1); setFilterStatus(e.target.value); }} className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isLoading || isSubmitting}>
              <option value="">Tất cả trạng thái</option>
              <option value="Chờ duyệt">Chờ duyệt</option>
              <option value="Đã duyệt">Đã duyệt</option>
              <option value="Từ chối">Từ chối</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị thi công</label>
            <select value={filterConstructionUnit} onChange={(e) => { setCurrentPage(1); setFilterConstructionUnit(e.target.value); }} className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isLoading || isSubmitting}>
              <option value="">Tất cả ĐVTC</option>
              {constructionUnitsList.map(unit => (
                <option key={unit._id} value={unit.name}>{unit.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-center items-center mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button key={page} onClick={() => setCurrentPage(page)} className={`px-4 py-2 rounded-lg mx-1 text-sm font-medium ${currentPage === page ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-all duration-200`} disabled={isLoading || isSubmitting}>{page}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        {(filteredProjects.length === 0 && !isLoading) ? (
          <div className="text-center py-8 text-gray-500">Không tìm thấy công trình nào.</div>
        ) : (
          <table className="w-full table-auto border-collapse">
            <thead className="sticky top-0 bg-blue-100 z-10">
              <tr>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">STT</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">Tên công trình</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">ĐV Phân bổ</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">ĐV Thi công</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">Đợt Phân bổ</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">Địa điểm</th>
                {isCategory && <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">Quy mô</th>}
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">Người nhập</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">Trạng thái</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">Phụ trách</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b min-w-[200px]">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProjects.map(project => (
                <tr key={project._id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="p-3 text-sm text-gray-700">{isCategory ? project.categorySerialNumber : project.minorRepairSerialNumber}</td>
                  <td className="p-3 text-sm text-gray-700 font-medium">{project.name}</td>
                  <td className="p-3 text-sm text-gray-700">{project.allocatedUnit}</td>
                  <td className="p-3 text-sm text-gray-700">{project.constructionUnit || 'N/A'}</td>
                  <td className="p-3 text-sm text-gray-700">{project.allocationWave || 'N/A'}</td>
                  <td className="p-3 text-sm text-gray-700">{project.location}</td>
                  {isCategory && <td className="p-3 text-sm text-gray-700">{project.scale}</td>}
                  <td className="p-3 text-sm text-gray-700">{project.enteredBy}</td>
                  <td className="p-3 text-sm">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${project.status === 'Chờ duyệt' ? 'bg-yellow-100 text-yellow-800' : project.status === 'Đã duyệt' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {project.status}
                      {project.pendingEdit && <span className="ml-1 px-1.5 py-0.5 bg-orange-200 text-orange-700 text-xs rounded-full">YC Sửa</span>}
                      {project.pendingDelete && <span className="ml-1 px-1.5 py-0.5 bg-pink-200 text-pink-700 text-xs rounded-full">YC Xóa</span>}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-gray-700">{project.assignedTo || 'N/A'}</td>
                  <td className="p-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2 flex-wrap">
                      {user?.permissions?.approve && project.status === 'Chờ duyệt' && (
                        <>
                          <button onClick={() => approveProject(project._id)} className="text-green-600 hover:text-green-800 disabled:opacity-50" title="Duyệt" disabled={isSubmitting}><FaCheckCircle size={18}/></button>
                          <button onClick={() => rejectProject(project._id)} className="text-red-500 hover:text-red-700 disabled:opacity-50" title="Từ chối" disabled={isSubmitting}><FaTimesCircle size={18}/></button>
                        </>
                      )}
                      {user?.permissions?.edit && (project.status !== 'Đã duyệt' || (project.status === 'Đã duyệt' && (project.enteredBy === user.username || user.role === 'admin'))) && (
                        <button onClick={() => openEditModal(project)} className="text-yellow-500 hover:text-yellow-700 disabled:opacity-50" title="Sửa" disabled={isSubmitting}><FaEdit size={16}/></button>
                      )}
                      {user?.permissions?.delete && (project.status !== 'Đã duyệt' || (project.status === 'Đã duyệt' && (project.enteredBy === user.username || user.role === 'admin'))) && (
                        <button onClick={() => deleteProject(project._id)} className="text-red-500 hover:text-red-700 disabled:opacity-50" title="Xóa" disabled={isSubmitting}><FaTrash size={16}/></button>
                      )}
                      {user?.permissions?.edit && project.status === 'Đã duyệt' && (
                        <>
                          <div className="flex items-center gap-1">
                            <select value={allocateWaves[project._id] || ''} onChange={(e) => setAllocateWaves(prev => ({ ...prev, [project._id]: e.target.value }))} className={`border border-gray-300 p-1.5 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50`} disabled={isSubmitting}>
                              <option value="">Chọn đợt PB</option>
                              {allocationWavesList.map(wave => (<option key={wave._id} value={wave.name}>{wave.name}</option>))}
                            </select>
                            <button onClick={() => allocateProject(project._id)} className="text-blue-500 hover:text-blue-700 disabled:opacity-50" disabled={isSubmitting || !allocateWaves[project._id]} title="Phân bổ đợt"><FaBuilding size={16}/></button>
                          </div>
                          <div className="flex items-center gap-1">
                            <input type="text" placeholder="Người PT" value={assignPersons[project._id] || ''} onChange={(e) => setAssignPersons(prev => ({ ...prev, [project._id]: e.target.value }))} className={`border border-gray-300 p-1.5 rounded-md text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50`} disabled={isSubmitting} />
                            <button onClick={() => assignProject(project._id)} className="text-indigo-500 hover:text-indigo-700 disabled:opacity-50" disabled={isSubmitting || !assignPersons[project._id]?.trim()} title="Phân công"><FaUser size={16}/></button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ProjectManagement;