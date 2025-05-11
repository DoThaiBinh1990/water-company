import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaCheckCircle, FaTimesCircle, FaBuilding, FaUser, FaEdit, FaTrash, FaPlus, FaSearch, FaEye, FaEyeSlash } from 'react-icons/fa';
import Modal from 'react-modal';
import 'react-toastify/dist/ReactToastify.css';
import { API_URL } from '../config';
import { toast } from 'react-toastify';
import debounce from 'lodash/debounce';

Modal.setAppElement('#root');

function ProjectManagement({ user, type, showHeader }) {
  const isCategory = type === 'category';
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('serial_asc');
  const [showFilter, setShowFilter] = useState(true);
  const [nextSerial, setNextSerial] = useState(1);

  const initialNewProjectState = useCallback(() => {
    if (isCategory) {
      return {
        name: '',
        allocatedUnit: '',
        constructionUnit: '',
        allocationWave: '',
        location: '',
        scale: '',
        initialValue: 0,
        estimator: '',
        supervisor: '',
        durationDays: 0,
        startDate: '',
        completionDate: '',
        taskDescription: '',
        contractValue: 0,
        progress: '',
        feasibility: '',
        notes: '',
      };
    } else {
      return {
        serial: nextSerial.toString(),
        name: '',
        allocatedUnit: '',
        supervisor: '',
        reportDate: '',
        inspectionDate: '',
        taskDescription: '',
        paymentDate: '',
        paymentValue: 0,
        notes: '',
      };
    }
  }, [isCategory, nextSerial]);

  const [newProject, setNewProject] = useState(initialNewProjectState());
  const [editProject, setEditProject] = useState(null);
  const [activeFormTab, setActiveFormTab] = useState('basic');

  const [allocateWaves, setAllocateWaves] = useState({});
  const [assignPersons, setAssignPersons] = useState({});

  const [filterStatus, setFilterStatus] = useState('');
  const [filterConstructionUnit, setFilterConstructionUnit] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterMinInitialValue, setFilterMinInitialValue] = useState('');
  const [filterMaxInitialValue, setFilterMaxInitialValue] = useState('');
  const [filterProgress, setFilterProgress] = useState('');
  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [constructionUnitsList, setConstructionUnitsList] = useState([]);
  const [allocationWavesList, setAllocationWavesList] = useState([]);

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
    if (filterName) params.append('search', filterName);
    if (filterMinInitialValue) params.append('minInitialValue', filterMinInitialValue);
    if (filterMaxInitialValue) params.append('maxInitialValue', filterMaxInitialValue);
    if (filterProgress) params.append('progress', filterProgress);
    if (sortOrder === 'serial_asc') {
      params.append('sort', 'serial');
      params.append('order', 'asc');
    } else if (sortOrder === 'created_desc') {
      params.append('sort', 'createdAt');
      params.append('order', 'desc');
    }

    try {
      const projectsRes = await axios.get(`${API_URL}/api/projects?${params.toString()}`);
      setFilteredProjects(projectsRes.data.projects);
      setTotalPages(projectsRes.data.pages || 1);

      if (!isCategory) {
        const maxSerial = projectsRes.data.projects.reduce((max, project) => {
          const serialNum = parseInt(project.minorRepairSerialNumber, 10);
          return serialNum > max ? serialNum : max;
        }, 0);
        setNextSerial(maxSerial + 1);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách công trình:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách công trình!', { position: "top-center" });
      setFilteredProjects([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [type, currentPage, filterStatus, filterConstructionUnit, filterName, filterMinInitialValue, filterMaxInitialValue, filterProgress, sortOrder, user, isCategory]);

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

  const debouncedFetchProjects = useCallback(
    debounce(() => {
      fetchProjects();
    }, 500),
    [fetchProjects]
  );

  useEffect(() => {
    if (user) {
      debouncedFetchProjects();
    } else {
      setFilteredProjects([]);
      setTotalPages(1);
      setCurrentPage(1);
    }
    return () => {
      debouncedFetchProjects.cancel();
    };
  }, [user, currentPage, filterStatus, filterConstructionUnit, filterName, filterMinInitialValue, filterMaxInitialValue, filterProgress, sortOrder, debouncedFetchProjects]);

  const handleFilterNameChange = (e) => {
    setCurrentPage(1);
    setFilterName(e.target.value);
  };

  const openAddNewModal = () => {
    console.log('Opening add new modal with initial state:', initialNewProjectState());
    setEditProject(null);
    setNewProject({ ...initialNewProjectState() });
    setActiveFormTab('basic');
    setShowModal(true);
  };

  const openEditModal = (project) => {
    console.log('Opening edit modal with project:', project);
    setEditProject(project);
    if (isCategory) {
      const newProjectData = {
        name: project.name || '',
        allocatedUnit: project.allocatedUnit || '',
        constructionUnit: project.constructionUnit || '',
        allocationWave: project.allocationWave || '',
        location: project.location || '',
        scale: project.scale || '',
        initialValue: project.initialValue || 0,
        estimator: project.estimator || '',
        supervisor: project.supervisor || '',
        durationDays: project.durationDays || 0,
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        completionDate: project.completionDate ? new Date(project.completionDate).toISOString().split('T')[0] : '',
        taskDescription: project.taskDescription || '',
        contractValue: project.contractValue || 0,
        progress: project.progress || '',
        feasibility: project.feasibility || '',
        notes: project.notes || '',
      };
      console.log('New project data for edit:', newProjectData);
      setNewProject(newProjectData);
    } else {
      const newProjectData = {
        serial: project.minorRepairSerialNumber || '',
        name: project.name || '',
        allocatedUnit: project.allocatedUnit || '',
        supervisor: project.supervisor || '',
        reportDate: project.reportDate ? new Date(project.reportDate).toISOString().split('T')[0] : '',
        inspectionDate: project.inspectionDate ? new Date(project.inspectionDate).toISOString().split('T')[0] : '',
        taskDescription: project.taskDescription || '',
        paymentDate: project.paymentDate ? new Date(project.paymentDate).toISOString().split('T')[0] : '',
        paymentValue: project.paymentValue || 0,
        notes: project.notes || '',
      };
      console.log('New project data for edit:', newProjectData);
      setNewProject(newProjectData);
    }
    setActiveFormTab('basic');
    setShowModal(true);
  };

  const validateForm = () => {
    const errors = [];

    if (isCategory) {
      if (activeFormTab === 'basic') {
        const projectDataForValidation = { ...newProject };
        const requiredFields = [
          { field: projectDataForValidation.name, name: 'Tên danh mục' },
          { field: projectDataForValidation.allocatedUnit, name: 'Công trình tại Chi nhánh' },
          { field: projectDataForValidation.location, name: 'Địa điểm XD' },
          { field: projectDataForValidation.scale, name: 'Quy mô' },
        ];

        requiredFields.forEach(({ field, name }) => {
          if (!field || (typeof field === 'string' && field.trim() === '')) {
            errors.push(`Trường "${name}" là bắt buộc.`);
          }
        });

        if (newProject.initialValue < 0) {
          errors.push('Giá trị phân bổ không được nhỏ hơn 0.');
        }
      }

      if (activeFormTab === 'assign') {
        if (newProject.durationDays < 0) {
          errors.push('Số ngày thực hiện không được nhỏ hơn 0.');
        }
        if (newProject.startDate && newProject.completionDate) {
          const start = new Date(newProject.startDate);
          const end = new Date(newProject.completionDate);
          if (start > end) {
            errors.push('Ngày bắt đầu không được muộn hơn ngày hoàn thành.');
          }
        }
      }

      if (activeFormTab === 'progress') {
        if (newProject.contractValue < 0) {
          errors.push('Giá trị giao khoán không được nhỏ hơn 0.');
        }
      }
    } else {
      const projectDataForValidation = { ...newProject };
      const requiredFields = [
        { field: projectDataForValidation.name, name: 'Tên công trình sửa chữa' },
        { field: projectDataForValidation.allocatedUnit, name: 'Chi nhánh thực hiện' },
      ];

      requiredFields.forEach(({ field, name }) => {
        if (!field || (typeof field === 'string' && field.trim() === '')) {
          errors.push(`Trường "${name}" là bắt buộc.`);
        }
      });

      if (newProject.paymentValue < 0) {
        errors.push('Giá trị thanh toán không được nhỏ hơn 0.');
      }
    }

    return errors;
  };

  const saveProject = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(errors.join(' '), { position: "top-center" });
      return;
    }

    setIsSubmitting(true);
    let projectPayload = { ...newProject, type };

    if (isCategory) {
      if (!isCategory && projectPayload.hasOwnProperty('scale')) {
        delete projectPayload.scale;
      }
    } else {
      const categoryFields = ['constructionUnit', 'allocationWave', 'location', 'scale', 'initialValue', 'estimator', 'durationDays', 'startDate', 'completionDate', 'contractValue', 'progress', 'feasibility'];
      categoryFields.forEach(field => {
        if (projectPayload.hasOwnProperty(field)) {
          delete projectPayload[field];
        }
      });
    }

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
          successMessage = response.data.message || (editProject.status === 'Đã duyệt' && user?.permissions?.edit && !user?.permissions?.approve ? 'Đã gửi yêu cầu sửa công trình!' : 'Đã cập nhật công trình thành công!');
        } else {
          response = await axios.post(`${API_URL}/api/projects`, projectPayload);
          successMessage = response.data.message || 'Đã đăng ký công trình thành công!';
          if (!isCategory) {
            setNextSerial(prev => prev + 1);
          }
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
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className={`flex justify-between items-center mb-8 transition-all duration-300 ${showHeader ? 'pt-16' : 'pt-4'}`}>
        <h1 className="text-3xl font-bold text-gray-800">
          {isCategory ? 'Quản lý Công trình Danh mục' : 'Quản lý Công trình Sửa chữa nhỏ'}
        </h1>
        <div className="flex items-center gap-4">
          {user?.permissions?.add && (
            <button
              onClick={openAddNewModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
              disabled={isSubmitting || isLoading}
            >
              <FaPlus /> Thêm
            </button>
          )}
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-200 flex items-center gap-2"
          >
            {showFilter ? <FaEyeSlash /> : <FaEye />}
            <span className="hidden sm:inline">{showFilter ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}</span>
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {(isLoading && !isSubmitting) && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 animate-fadeIn">
          <div className="text-white text-xl p-4 bg-blue-600 rounded-lg shadow-lg">Đang tải dữ liệu...</div>
        </div>
      )}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 animate-fadeIn">
          <div className="text-white text-xl p-4 bg-green-600 rounded-lg shadow-lg">Đang xử lý...</div>
        </div>
      )}

      {/* Modal for Add/Edit Project */}
      <Modal
        isOpen={showModal}
        onRequestClose={() => { if (!isSubmitting) setShowModal(false); }}
        className="card p-8 max-w-4xl w-full mx-auto mt-16 animate-fadeIn focus:outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center z-40 p-4 overflow-y-auto"
        shouldCloseOnOverlayClick={!isSubmitting}
      >
        <h2 className="text-2xl font-bold text-gray-800 mb-6">{editProject ? 'Sửa công trình' : 'Đăng ký công trình mới'}</h2>

        {isCategory ? (
          <>
            <div className="modal-tabs">
              {['basic', 'assign', 'progress'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveFormTab(tab)}
                  className={`modal-tab ${activeFormTab === tab ? 'active' : ''}`}
                  disabled={isSubmitting}
                >
                  {tab === 'basic' ? 'Thông tin cơ bản' : tab === 'assign' ? 'Phân công nhiệm vụ' : 'Cập nhật tiến độ'}
                </button>
              ))}
            </div>

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {activeFormTab === 'basic' && (
                <div className="modal-form-grid">
                  <div className="col-span-2">
                    <label className="form-label">Tên danh mục <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="Nhập tên công trình"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Quy mô <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="Nhập quy mô"
                      value={newProject.scale || ''}
                      onChange={(e) => setNewProject({ ...newProject, scale: e.target.value })}
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="form-label">Công trình tại Chi nhánh <span className="text-red-500">*</span></label>
                    <select
                      value={newProject.allocatedUnit}
                      onChange={(e) => setNewProject({ ...newProject, allocatedUnit: e.target.value })}
                      className="form-select"
                      disabled={isSubmitting}
                    >
                      <option value="">Chọn đơn vị phân bổ</option>
                      {allocatedUnits.map(unit => (
                        <option key={unit._id} value={unit.name}>{unit.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Loại công trình</label>
                    <input
                      type="text"
                      value="Danh mục"
                      readOnly
                      className="form-input bg-gray-100 cursor-not-allowed"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="form-label">Địa điểm XD <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="Nhập địa điểm"
                      value={newProject.location}
                      onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="form-label">Giá trị phân bổ (Triệu đồng)</label>
                    <input
                      type="number"
                      placeholder="Nhập giá trị phân bổ"
                      value={newProject.initialValue || ''}
                      onChange={(e) => setNewProject({ ...newProject, initialValue: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                      disabled={isSubmitting}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="form-label">Người nhập đăng ký <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editProject ? editProject.enteredBy : (user?.username || '')}
                      readOnly
                      className="form-input bg-gray-100 cursor-not-allowed"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}

              {activeFormTab === 'assign' && (
                <div className="modal-form-grid">
                  <div>
                    <label className="form-label">Phân bổ đợt</label>
                    <select
                      value={newProject.allocationWave}
                      onChange={(e) => setNewProject({ ...newProject, allocationWave: e.target.value })}
                      className="form-select"
                      disabled={isSubmitting}
                    >
                      <option value="">Chọn đợt phân bổ (nếu có)</option>
                      {allocationWavesList.map(wave => (
                        <option key={wave._id} value={wave.name}>{wave.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">NV lập hồ sơ dự toán</label>
                    <input
                      type="text"
                      placeholder="Nhập NV lập hồ sơ"
                      value={newProject.estimator}
                      onChange={(e) => setNewProject({ ...newProject, estimator: e.target.value })}
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="form-label">LĐ theo dõi</label>
                    <input
                      type="text"
                      placeholder="Nhập LĐ theo dõi"
                      value={newProject.supervisor}
                      onChange={(e) => setNewProject({ ...newProject, supervisor: e.target.value })}
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="form-label">Số ngày thực hiện</label>
                    <input
                      type="number"
                      placeholder="Nhập số ngày"
                      value={newProject.durationDays || ''}
                      onChange={(e) => setNewProject({ ...newProject, durationDays: parseInt(e.target.value) || 0 })}
                      className="form-input"
                      disabled={isSubmitting}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="form-label">Ngày bắt đầu lập hs dự toán</label>
                    <input
                      type="date"
                      value={newProject.startDate}
                      onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="form-label">Ngày hoàn thành hs dự toán</label>
                    <input
                      type="date"
                      value={newProject.completionDate}
                      onChange={(e) => setNewProject({ ...newProject, completionDate: e.target.value })}
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Nội dung giao việc</label>
                    <textarea
                      placeholder="Nhập nội dung giao việc"
                      value={newProject.taskDescription}
                      onChange={(e) => setNewProject({ ...newProject, taskDescription: e.target.value })}
                      className="form-textarea"
                      disabled={isSubmitting}
                      rows="4"
                    />
                  </div>
                </div>
              )}

              {activeFormTab === 'progress' && (
                <div className="modal-form-grid">
                  <div>
                    <label className="form-label">Giá trị giao khoán (Triệu đồng)</label>
                    <input
                      type="number"
                      placeholder="Nhập giá trị giao khoán"
                      value={newProject.contractValue || ''}
                      onChange={(e) => setNewProject({ ...newProject, contractValue: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                      disabled={isSubmitting}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="form-label">Đơn vị thi công</label>
                    <select
                      value={newProject.constructionUnit}
                      onChange={(e) => setNewProject({ ...newProject, constructionUnit: e.target.value })}
                      className="form-select"
                      disabled={isSubmitting}
                    >
                      <option value="">Chọn đơn vị thi công (nếu có)</option>
                      {constructionUnitsList.map(unit => (
                        <option key={unit._id} value={unit.name}>{unit.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Tiến độ thi công</label>
                    <input
                      type="text"
                      placeholder="Nhập tiến độ thi công"
                      value={newProject.progress}
                      onChange={(e) => setNewProject({ ...newProject, progress: e.target.value })}
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="form-label">Khả năng thực hiện</label>
                    <input
                      type="text"
                      placeholder="Nhập khả năng thực hiện"
                      value={newProject.feasibility}
                      onChange={(e) => setNewProject({ ...newProject, feasibility: e.target.value })}
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Ghi chú</label>
                    <textarea
                      placeholder="Nhập ghi chú"
                      value={newProject.notes}
                      onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                      className="form-textarea"
                      disabled={isSubmitting}
                      rows="4"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="modal-form-grid">
            <div>
              <label className="form-label">STT</label>
              <input
                type="text"
                value={newProject.serial}
                readOnly
                className="form-input bg-gray-100 cursor-not-allowed"
                disabled
              />
            </div>
            <div className="col-span-2">
              <label className="form-label">Tên công trình (bộ công trình) sửa chữa <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder="Nhập tên công trình sửa chữa"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="form-input"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="form-label">Chi nhánh thực hiện <span className="text-red-500">*</span></label>
              <select
                value={newProject.allocatedUnit}
                onChange={(e) => setNewProject({ ...newProject, allocatedUnit: e.target.value })}
                className="form-select"
                disabled={isSubmitting}
              >
                <option value="">Chọn chi nhánh</option>
                {allocatedUnits.map(unit => (
                  <option key={unit._id} value={unit.name}>{unit.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">NV theo dõi</label>
              <input
                type="text"
                placeholder="Nhập NV theo dõi"
                value={newProject.supervisor}
                onChange={(e) => setNewProject({ ...newProject, supervisor: e.target.value })}
                className="form-input"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="form-label">Ngày báo cáo</label>
              <input
                type="date"
                value={newProject.reportDate}
                onChange={(e) => setNewProject({ ...newProject, reportDate: e.target.value })}
                className="form-input"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="form-label">Ngày kiểm tra</label>
              <input
                type="date"
                value={newProject.inspectionDate}
                onChange={(e) => setNewProject({ ...newProject, inspectionDate: e.target.value })}
                className="form-input"
                disabled={isSubmitting}
              />
            </div>
            <div className="col-span-2">
              <label className="form-label">Nội dung thực hiện</label>
              <textarea
                placeholder="Nhập nội dung thực hiện"
                value={newProject.taskDescription}
                onChange={(e) => setNewProject({ ...newProject, taskDescription: e.target.value })}
                className="form-textarea"
                disabled={isSubmitting}
                rows="4"
              />
            </div>
            <div>
              <label className="form-label">Ngày thanh toán</label>
              <input
                type="date"
                value={newProject.paymentDate}
                onChange={(e) => setNewProject({ ...newProject, paymentDate: e.target.value })}
                className="form-input"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="form-label">Giá trị thanh toán (Triệu đồng)</label>
              <input
                type="number"
                placeholder="Nhập giá trị thanh toán"
                value={newProject.paymentValue || ''}
                onChange={(e) => setNewProject({ ...newProject, paymentValue: parseFloat(e.target.value) || 0 })}
                className="form-input"
                disabled={isSubmitting}
                min="0"
                step="0.01"
              />
            </div>
            <div className="col-span-2">
              <label className="form-label">Ghi chú</label>
              <textarea
                placeholder="Nhập ghi chú"
                value={newProject.notes}
                onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                className="form-textarea"
                disabled={isSubmitting}
                rows="4"
              />
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <button
            onClick={saveProject}
            className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg ${isSubmitting || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isSubmitting || isLoading || (!user?.permissions?.add && !editProject) || (editProject && !user?.permissions?.edit)}
          >
            <FaCheckCircle /> {editProject ? ((editProject.status === 'Đã duyệt' && user?.permissions?.edit && !user?.permissions?.approve) ? 'Gửi yêu cầu sửa' : 'Cập nhật') : 'Đăng ký'}
          </button>
          <button
            onClick={() => { if (!isSubmitting) setShowModal(false); }}
            className={`w-full sm:w-auto bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition-all duration-200 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isSubmitting}
          >
            Hủy
          </button>
        </div>
      </Modal>

      {/* Filter Section */}
      <div className={`card mb-6 p-6 ${showFilter ? '' : 'hidden'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 sm:mb-0">Bộ lọc</h3>
          <select
            value={sortOrder}
            onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
            className="form-select w-full sm:w-52"
          >
            <option value="serial_asc">Số thứ tự (Tăng dần)</option>
            <option value="created_desc">Công trình mới nhất</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <div>
            <label className="form-label">Tên công trình</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm theo tên..."
                value={filterName}
                onChange={handleFilterNameChange}
                className="form-input pl-10"
                disabled={isLoading || isSubmitting}
              />
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <div>
            <label className="form-label">Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => { setCurrentPage(1); setFilterStatus(e.target.value); }}
              className="form-select"
              disabled={isLoading || isSubmitting}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="Chờ duyệt">Chờ duyệt</option>
              <option value="Đã duyệt">Đã duyệt</option>
              <option value="Từ chối">Từ chối</option>
            </select>
          </div>
          <div>
            <label className="form-label">Đơn vị thi công</label>
            <select
              value={filterConstructionUnit}
              onChange={(e) => { setCurrentPage(1); setFilterConstructionUnit(e.target.value); }}
              className="form-select"
              disabled={isLoading || isSubmitting}
            >
              <option value="">Tất cả ĐVTC</option>
              {constructionUnitsList.map(unit => (
                <option key={unit._id} value={unit.name}>{unit.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Giá trị phân bổ (Tối thiểu)</label>
            <input
              type="number"
              placeholder="Tối thiểu"
              value={filterMinInitialValue}
              onChange={(e) => { setCurrentPage(1); setFilterMinInitialValue(e.target.value); }}
              className="form-input"
              disabled={isLoading || isSubmitting}
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="form-label">Giá trị phân bổ (Tối đa)</label>
            <input
              type="number"
              placeholder="Tối đa"
              value={filterMaxInitialValue}
              onChange={(e) => { setCurrentPage(1); setFilterMaxInitialValue(e.target.value); }}
              className="form-input"
              disabled={isLoading || isSubmitting}
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="form-label">Tiến độ thi công</label>
            <input
              type="text"
              placeholder="Tìm kiếm tiến độ..."
              value={filterProgress}
              onChange={(e) => { setCurrentPage(1); setFilterProgress(e.target.value); }}
              className="form-input"
              disabled={isLoading || isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Project List Table */}
      <div className="card overflow-hidden">
        {(filteredProjects.length === 0 && !isLoading) ? (
          <div className="text-center py-8 text-gray-500 text-lg">Không tìm thấy công trình nào.</div>
        ) : (
          <>
            <div className="overflow-x-auto table-container">
              <table className="table-fixed w-full">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Tên danh mục</th>
                    <th>Công trình tại Chi nhánh</th>
                    <th>Loại công trình</th>
                    {isCategory && <th>Quy mô</th>}
                    <th>Địa điểm XD</th>
                    <th>Giá trị phân bổ (Triệu đồng)</th>
                    <th>Người nhập đăng ký</th>
                    <th>Phân bổ đợt</th>
                    <th>NV lập hồ sơ dự toán</th>
                    <th>LĐ theo dõi</th>
                    <th>Số ngày thực hiện</th>
                    <th>Ngày bắt đầu lập hs dự toán</th>
                    <th>Ngày hoàn thành hs dự toán</th>
                    <th>Nội dung giao việc</th>
                    <th>Giá trị giao khoán (Triệu đồng)</th>
                    <th>Đơn vị thi công</th>
                    <th>Tiến độ thi công</th>
                    <th>Khả năng thực hiện</th>
                    <th>Ghi chú</th>
                    <th>Trạng thái</th>
                    <th className="min-w-[200px]">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProjects.map(project => (
                    <tr key={project._id} className="transition-colors duration-150">
                      <td className="text-sm text-gray-700">{isCategory ? project.categorySerialNumber : project.minorRepairSerialNumber}</td>
                      <td className="text-sm text-gray-700 font-medium">{project.name}</td>
                      <td className="text-sm text-gray-700">{project.allocatedUnit}</td>
                      <td className="text-sm text-gray-700">{isCategory ? 'Danh mục' : 'Sửa chữa nhỏ'}</td>
                      {isCategory && <td className="text-sm text-gray-700">{project.scale}</td>}
                      <td className="text-sm text-gray-700">{project.location}</td>
                      <td className="text-sm text-gray-700">{project.initialValue || '0'}</td>
                      <td className="text-sm text-gray-700">{project.enteredBy}</td>
                      <td className="text-sm text-gray-700">{project.allocationWave || 'N/A'}</td>
                      <td className="text-sm text-gray-700">{project.estimator || 'N/A'}</td>
                      <td className="text-sm text-gray-700">{project.supervisor || 'N/A'}</td>
                      <td className="text-sm text-gray-700">{project.durationDays || '0'}</td>
                      <td className="text-sm text-gray-700">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}</td>
                      <td className="text-sm text-gray-700">{project.completionDate ? new Date(project.completionDate).toLocaleDateString() : 'N/A'}</td>
                      <td className="text-sm text-gray-700">{project.taskDescription || 'N/A'}</td>
                      <td className="text-sm text-gray-700">{project.contractValue || '0'}</td>
                      <td className="text-sm text-gray-700">{project.constructionUnit || 'N/A'}</td>
                      <td className="text-sm text-gray-700">{project.progress || 'N/A'}</td>
                      <td className="text-sm text-gray-700">{project.feasibility || 'N/A'}</td>
                      <td className="text-sm text-gray-700">{project.notes || 'N/A'}</td>
                      <td className="text-sm">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${project.status === 'Chờ duyệt' ? 'bg-yellow-100 text-yellow-800' : project.status === 'Đã duyệt' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {project.status}
                          {project.pendingEdit && <span className="ml-1 px-1.5 py-0.5 bg-orange-200 text-orange-700 text-xs rounded-full">YC Sửa</span>}
                          {project.pendingDelete && <span className="ml-1 px-1.5 py-0.5 bg-pink-200 text-pink-700 text-xs rounded-full">YC Xóa</span>}
                        </span>
                      </td>
                      <td className="text-sm text-gray-700">
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
                                <select
                                  value={allocateWaves[project._id] || ''}
                                  onChange={(e) => setAllocateWaves(prev => ({ ...prev, [project._id]: e.target.value }))}
                                  className="border border-gray-300 p-1.5 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                  disabled={isSubmitting}
                                >
                                  <option value="">Chọn đợt PB</option>
                                  {allocationWavesList.map(wave => (
                                    <option key={wave._id} value={wave.name}>{wave.name}</option>
                                  ))}
                                </select>
                                <button onClick={() => allocateProject(project._id)} className="text-blue-500 hover:text-blue-700 disabled:opacity-50" disabled={isSubmitting || !allocateWaves[project._id]} title="Phân bổ đợt"><FaBuilding size={16}/></button>
                              </div>
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="Người PT"
                                  value={assignPersons[project._id] || ''}
                                  onChange={(e) => setAssignPersons(prev => ({ ...prev, [project._id]: e.target.value }))}
                                  className="border border-gray-300 p-1.5 rounded-md text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                  disabled={isSubmitting}
                                />
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
            </div>
            <div className="flex justify-end p-4 bg-gray-50 border-t border-gray-200">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg mx-1 text-sm font-medium ${currentPage === page ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-all duration-200 disabled:opacity-50`}
                  disabled={isLoading || isSubmitting}
                >
                  {page}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ProjectManagement;