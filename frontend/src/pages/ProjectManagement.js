import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { FaPlus, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API_URL } from '../config';
import debounce from 'lodash/debounce';
import CategoryProjectFilter from '../components/CategoryProjectFilter';
import MinorRepairProjectFilter from '../components/MinorRepairProjectFilter';
import CategoryProjectTable from '../components/CategoryProjectTable';
import MinorRepairProjectTable from '../components/MinorRepairProjectTable';
import CategoryProjectForm from '../components/CategoryProjectForm';
import MinorRepairProjectForm from '../components/MinorRepairProjectForm';
import io from 'socket.io-client';

const socket = io(API_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

function ProjectManagement({ user, type, showHeader, addMessage }) {
  const isCategory = type === 'category';
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [pendingProjects, setPendingProjects] = useState([]); // Công trình chờ duyệt
  const [rejectedProjects, setRejectedProjects] = useState([]); // Công trình bị từ chối
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('serial_asc');
  const [showFilter, setShowFilter] = useState(true);
  const [totalProjectsCount, setTotalProjectsCount] = useState(0);

  const [newProject, setNewProject] = useState(null);
  const [editProject, setEditProject] = useState(null);

  const [allocateWaves, setAllocateWaves] = useState({});
  const [assignPersons, setAssignPersons] = useState({});

  const [filterStatus, setFilterStatus] = useState('');
  const [filterAllocatedUnit, setFilterAllocatedUnit] = useState('');
  const [filterConstructionUnit, setFilterConstructionUnit] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterMinInitialValue, setFilterMinInitialValue] = useState('');
  const [filterMaxInitialValue, setFilterMaxInitialValue] = useState('');
  const [filterProgress, setFilterProgress] = useState('');

  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [constructionUnitsList, setConstructionUnitsList] = useState([]);
  const [allocationWavesList, setAllocationWavesList] = useState([]);
  const [usersList, setUsersList] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('projects'); // Thêm tab pending

  const initialFilters = useMemo(() => ({
    status: '',
    allocatedUnit: '',
    constructionUnit: '',
    name: '',
    minInitialValue: '',
    maxInitialValue: '',
    progress: '',
  }), []);

  const initialNewProjectState = useCallback(() => {
    const baseState = {
      name: '',
      allocatedUnit: '',
      supervisor: '',
      taskDescription: '',
      notes: '',
      approvedBy: '', // Thêm trường approvedBy vào state mặc định
    };
    if (isCategory) {
      return {
        ...baseState,
        constructionUnit: '',
        allocationWave: '',
        location: '',
        scale: '',
        initialValue: '',
        estimator: '',
        durationDays: '',
        startDate: '',
        completionDate: '',
        contractValue: '',
        progress: '',
        feasibility: '',
        projectType: '',
        estimatedValue: '',
        leadershipApproval: '',
      };
    } else {
      return {
        ...baseState,
        serial: '',
        reportDate: '',
        inspectionDate: '',
        paymentDate: '',
        paymentValue: '',
      };
    }
  }, [isCategory]);

  useEffect(() => {
    setNewProject(initialNewProjectState());
  }, [initialNewProjectState]);

  const fetchProjects = useCallback(
    async (pageToFetch = 1, currentSortOrder = sortOrder, filters = {}, isPending = false) => {
      if (!user) {
        setFilteredProjects([]);
        setPendingProjects([]);
        setTotalPages(1);
        setTotalProjectsCount(0);
        return;
      }
      setIsLoading(true);
      const params = new URLSearchParams({ type, page: pageToFetch, limit: 10 });

      const currentFilters = {
        status: filters.status ?? filterStatus,
        allocatedUnit: filters.allocatedUnit ?? filterAllocatedUnit,
        constructionUnit: isCategory ? (filters.constructionUnit ?? filterConstructionUnit) : undefined,
        search: filters.name ?? filterName,
        minInitialValue: isCategory ? (filters.minInitialValue ?? filterMinInitialValue) : undefined,
        maxInitialValue: isCategory ? (filters.maxInitialValue ?? filterMaxInitialValue) : undefined,
        progress: isCategory ? (filters.progress ?? filterProgress) : undefined,
      };

      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      if (currentSortOrder === 'serial_asc') {
        params.append('sort', isCategory ? 'categorySerialNumber' : 'minorRepairSerialNumber');
        params.append('order', 'asc');
      } else if (currentSortOrder === 'created_desc') {
        params.append('sort', 'createdAt');
        params.append('order', 'desc');
      }

      try {
        // Thêm tham số pending để gọi API chính xác
        if (isPending) {
          params.append('pending', 'true');
        }

        const projectsRes = await axios.get(`${API_URL}/api/projects?${params.toString()}`);

        // Lọc thêm ở phía client để đảm bảo logic chính xác
        const filteredData = projectsRes.data.projects || [];
        let finalProjects = filteredData;

        if (isPending) {
          // Tab "Công trình chờ duyệt": Chỉ hiển thị các công trình có status "Chờ duyệt"
          // hoặc có status "Đã duyệt" nhưng đang có pendingEdit hoặc pendingDelete
          finalProjects = filteredData.filter(project =>
            project.status === 'Chờ duyệt' ||
            (project.status === 'Đã duyệt' && (project.pendingEdit || project.pendingDelete))
          );
        } else {
          // Tab "Danh mục công trình": Chỉ hiển thị các công trình có status "Đã duyệt"
          // và không có pendingEdit hoặc pendingDelete
          finalProjects = filteredData.filter(project =>
            project.status === 'Đã duyệt' && !project.pendingEdit && !project.pendingDelete
          );
        }

        if (isPending) {
          setPendingProjects(finalProjects);
        } else {
          setFilteredProjects(finalProjects);
        }
        setTotalPages(projectsRes.data.pages || 1);
        setTotalProjectsCount(projectsRes.data.total || 0);

        if (pageToFetch > projectsRes.data.pages && projectsRes.data.pages > 0) {
          setCurrentPage(projectsRes.data.pages);
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách công trình:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách công trình!', { position: "top-center" });
        if (isPending) {
          setPendingProjects([]);
        } else {
          setFilteredProjects([]);
        }
        setTotalPages(1);
        setTotalProjectsCount(0);
      } finally {
        setIsLoading(false);
      }
    },
    [user, type, isCategory, sortOrder, filterStatus, filterAllocatedUnit, filterConstructionUnit, filterName, filterMinInitialValue, filterMaxInitialValue, filterProgress]
  );

  const fetchRejectedProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/rejected-projects`);
      setRejectedProjects(res.data || []);
    } catch (error) {
      console.error("Lỗi khi tải danh sách công trình bị từ chối:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách công trình bị từ chối!', { position: "top-center" });
      setRejectedProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchAuxData = async () => {
      try {
        const results = await Promise.allSettled([
          axios.get(`${API_URL}/api/allocated-units`),
          axios.get(`${API_URL}/api/allocation-waves`),
          axios.get(`${API_URL}/api/construction-units`),
          axios.get(`${API_URL}/api/users`),
        ]);

        if (results[0].status === 'fulfilled') {
          const units = results[0].value.data || [];
          setAllocatedUnits(units.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)));
        } else {
          console.error("Lỗi tải Allocated Units:", results[0].reason);
          setAllocatedUnits([]);
        }

        if (results[1].status === 'fulfilled') {
          const waves = results[1].value.data || [];
          setAllocationWavesList(waves.map(wave => wave.name || String(wave)));
        } else {
          console.error("Lỗi tải Allocation Waves:", results[1].reason);
          setAllocationWavesList([]);
        }

        if (results[2].status === 'fulfilled') {
          const constructionUnits = results[2].value.data || [];
          setConstructionUnitsList(constructionUnits.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)));
        } else {
          console.error("Lỗi tải Construction Units:", results[2].reason);
          setConstructionUnitsList([]);
        }

        if (results[3].status === 'fulfilled') {
          const users = results[3].value.data || [];
          setUsersList(users.map(user => user.username || String(user)));
        } else {
          console.error("Lỗi tải Users:", results[3].reason);
          setUsersList([]);
        }
      } catch (error) {
        console.error("Lỗi không xác định khi tải dữ liệu phụ trợ:", error);
        toast.error('Lỗi không xác định khi tải dữ liệu phụ trợ!', { position: "top-center" });
        setAllocatedUnits([]);
        setAllocationWavesList([]);
        setConstructionUnitsList([]);
        setUsersList([]);
      }
    };
    fetchAuxData();
  }, [user]);

  const debouncedFetchProjects = useCallback(debounce((page, sort, filters, isPending) => fetchProjects(page, sort, filters, isPending), 500), [fetchProjects]);

  useEffect(() => {
    if (user) {
      fetchProjects(currentPage, sortOrder, {
        status: filterStatus,
        allocatedUnit: filterAllocatedUnit,
        constructionUnit: filterConstructionUnit,
        name: filterName,
        minInitialValue: filterMinInitialValue,
        maxInitialValue: filterMaxInitialValue,
        progress: filterProgress
      }, false);
      fetchProjects(currentPage, sortOrder, {}, true); // Lấy danh sách công trình chờ duyệt
      fetchRejectedProjects();

      // Kết nối Socket.IO để làm mới danh sách công trình
      if (!socket.connected) {
        socket.connect();
      }

      socket.on('project_deleted', ({ projectId, projectType }) => {
        if (projectType === type) {
          fetchProjects(currentPage, sortOrder, {}, false);
          fetchProjects(currentPage, sortOrder, {}, true);
        }
      });

      socket.on('project_rejected', ({ projectId, projectType }) => {
        if (projectType === type) {
          fetchProjects(currentPage, sortOrder, {}, false);
          fetchProjects(currentPage, sortOrder, {}, true);
          fetchRejectedProjects();
        }
      });

      socket.on('notification_processed', () => {
        fetchProjects(currentPage, sortOrder, {}, false);
        fetchProjects(currentPage, sortOrder, {}, true);
      });

      return () => {
        socket.off('project_deleted');
        socket.off('project_rejected');
        socket.off('notification_processed');
      };
    } else {
      setFilteredProjects([]);
      setPendingProjects([]);
      setRejectedProjects([]);
      setTotalPages(1);
      setCurrentPage(1);
      setTotalProjectsCount(0);
    }
  }, [user, type, currentPage, sortOrder, fetchProjects, fetchRejectedProjects, filterStatus, filterAllocatedUnit, filterConstructionUnit, filterName, filterMinInitialValue, filterMaxInitialValue, filterProgress]);

  useEffect(() => {
    const isMounted = user !== null;
    if (!isMounted) return;

    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      debouncedFetchProjects(1, sortOrder, {
        status: filterStatus,
        allocatedUnit: filterAllocatedUnit,
        constructionUnit: filterConstructionUnit,
        name: filterName,
        minInitialValue: filterMinInitialValue,
        maxInitialValue: filterMaxInitialValue,
        progress: filterProgress
      }, false);
      debouncedFetchProjects(1, sortOrder, {}, true);
    }
  }, [filterStatus, filterAllocatedUnit, filterConstructionUnit, filterName, filterMinInitialValue, filterMaxInitialValue, filterProgress, user, sortOrder, debouncedFetchProjects, currentPage]);

  const handleSortChange = (e) => {
    const newSortOrder = e.target.value;
    setSortOrder(newSortOrder);
  };

  const handleResetFilters = useCallback(() => {
    setFilterStatus(initialFilters.status);
    setFilterAllocatedUnit(initialFilters.allocatedUnit);
    setFilterConstructionUnit(initialFilters.constructionUnit);
    setFilterName(initialFilters.name);
    setFilterMinInitialValue(initialFilters.minInitialValue);
    setFilterMaxInitialValue(initialFilters.maxInitialValue);
    setFilterProgress(initialFilters.progress);
  }, [initialFilters]);

  const openAddNewModal = () => {
    setEditProject(null);
    setNewProject(initialNewProjectState());
    setIsLoading(false);
    setIsSubmitting(false);
    setShowModal(true);
  };

  const openEditModal = (project) => {
    setEditProject(project);
    const formatForInput = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    let projectDataToSet = {};

    const baseData = {
      name: project.name || '',
      allocatedUnit: project.allocatedUnit || '',
      supervisor: project.supervisor || '',
      taskDescription: project.taskDescription || '',
      notes: project.notes || '',
      approvedBy: project.approvedBy?._id || '', // Populate approvedBy
    };

    if (isCategory) {
      projectDataToSet = {
        ...baseData,
        constructionUnit: project.constructionUnit || '',
        allocationWave: project.allocationWave || '',
        location: project.location || '',
        scale: project.scale || '',
        initialValue: project.initialValue ?? '',
        estimator: project.estimator || '',
        durationDays: project.durationDays ?? '',
        startDate: formatForInput(project.startDate),
        completionDate: formatForInput(project.completionDate),
        contractValue: project.contractValue ?? '',
        progress: project.progress || '',
        feasibility: project.feasibility || '',
        projectType: project.projectType || '',
        estimatedValue: project.estimatedValue ?? '',
        leadershipApproval: project.leadershipApproval || '',
      };
    } else {
      projectDataToSet = {
        ...baseData,
        serial: project.minorRepairSerialNumber || '',
        reportDate: formatForInput(project.reportDate),
        inspectionDate: formatForInput(project.inspectionDate),
        paymentDate: formatForInput(project.paymentDate),
        paymentValue: project.paymentValue ?? '',
      };
    }
    setNewProject(projectDataToSet);
    setIsLoading(false);
    setIsSubmitting(false);
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    setNewProject((prev) => ({
      ...prev,
      [name]: inputType === 'checkbox' ? checked : value,
    }));
  };

  const handleNumericInputChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setNewProject((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const saveProject = async () => {
    // Kiểm tra các trường bắt buộc trong tab Cơ bản
    if (!newProject.name || !newProject.allocatedUnit || !newProject.projectType || !newProject.scale || !newProject.location) {
      toast.error('Vui lòng nhập đầy đủ các trường bắt buộc: Tên danh mục, Đơn vị phân bổ, Loại công trình, Quy mô, và Địa điểm XD!', { position: "top-center" });
      return;
    }

    setIsSubmitting(true);
    let projectPayload = { ...newProject, type };
    console.log("Dữ liệu gửi đi để lưu công trình:", projectPayload);

    const numericFieldsCategory = ['initialValue', 'durationDays', 'contractValue', 'estimatedValue'];
    const numericFieldsMinor = ['paymentValue'];
    const fieldsToParse = isCategory ? numericFieldsCategory : numericFieldsMinor;

    fieldsToParse.forEach((field) => {
      const value = projectPayload[field];
      if (value === '' || value === null || value === undefined || isNaN(parseFloat(value))) {
        projectPayload[field] = null;
      } else {
        projectPayload[field] = parseFloat(value);
      }
    });

    if (projectPayload.durationDays !== null && projectPayload.durationDays !== undefined) {
      projectPayload.durationDays = parseInt(projectPayload.durationDays, 10) || null;
    }

    const fieldsToRemove = isCategory
      ? ['serial', 'reportDate', 'inspectionDate', 'paymentDate', 'paymentValue', 'minorRepairSerialNumber']
      : ['constructionUnit', 'allocationWave', 'location', 'scale', 'initialValue', 'estimator', 'durationDays', 'startDate', 'completionDate', 'contractValue', 'progress', 'feasibility', 'projectType', 'estimatedValue', 'leadershipApproval', 'categorySerialNumber'];
    fieldsToRemove.forEach(field => delete projectPayload[field]);

    if (!isCategory && !editProject) {
      delete projectPayload.serial;
    }

    try {
      let response;
      let successMessage = '';
      let fetchPage = currentPage;

      if (editProject) {
        response = await axios.patch(`${API_URL}/api/projects/${editProject._id}?type=${type}`, projectPayload);
        successMessage = response.data.message || 'Đã cập nhật công trình thành công!';
        if (response.data?.pendingEdit) {
          successMessage = 'Đã gửi yêu cầu sửa công trình!';
        }
      } else {
        response = await axios.post(`${API_URL}/api/projects`, projectPayload);
        successMessage = response.data.message || 'Đã đăng ký công trình thành công!';
        fetchPage = 1;
      }

      toast.success(successMessage, { position: "top-center" });

      // Reset newProject về trạng thái rỗng sau khi lưu thành công
      setNewProject(initialNewProjectState());

      if (fetchPage !== currentPage) {
        setCurrentPage(fetchPage);
      } else {
        fetchProjects(currentPage, sortOrder, {}, false);
        fetchProjects(currentPage, sortOrder, {}, true);
      }

      setShowModal(false);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Lỗi khi lưu công trình!';
      console.error('Lỗi khi lưu công trình:', errorMessage, err.response?.data);
      toast.error(errorMessage, { position: "top-center" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionWithConfirm = async (actionPromise, successMessage, confirmMessage = "Bạn có chắc chắn?") => {
    if (window.confirm(confirmMessage)) {
      setIsSubmitting(true);
      try {
        const response = await actionPromise();
        toast.success(successMessage || response?.data?.message || "Thao tác thành công!", { position: "top-center" });
        fetchProjects(currentPage, sortOrder, {}, false);
        fetchProjects(currentPage, sortOrder, {}, true);
      } catch (err) {
        console.error("Lỗi hành động:", err.response?.data?.message || err.message);
        toast.error(err.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const deleteProject = (id) =>
    handleActionWithConfirm(
      () => axios.delete(`${API_URL}/api/projects/${id}?type=${type}`),
      null,
      "Xác nhận Xóa hoặc gửi Yêu cầu xóa công trình này?"
    );

  const approveProject = (id) =>
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/approve?type=${type}`),
      'Đã duyệt công trình!',
      "Xác nhận DUYỆT công trình này?"
    );

  const rejectProject = (id) =>
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/reject?type=${type}`),
      'Đã từ chối công trình!',
      "Xác nhận TỪ CHỐI công trình này?"
    );

  const allocateProject = (id) => {
    const wave = allocateWaves[id];
    if (!wave) {
      toast.error('Vui lòng chọn đợt phân bổ!', { position: "top-center" });
      return;
    }
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/allocate?type=${type}`, { allocationWave: wave }),
      'Đã phân bổ công trình!',
      `Phân bổ công trình vào đợt "${wave}"?`
    ).then(() => setAllocateWaves((prev) => ({ ...prev, [id]: '' })));
  };

  const assignProject = (id) => {
    const person = assignPersons[id];
    if (!person || person.trim() === "") {
      toast.error('Vui lòng nhập người phụ trách!', { position: "top-center" });
      return;
    }
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/assign?type=${type}`, { assignedTo: person.trim() }),
      'Đã phân công công trình!',
      `Phân công cho "${person.trim()}"?`
    ).then(() => setAssignPersons((prev) => ({ ...prev, [id]: '' })));
  };

  const approveEditProject = (id) =>
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/approve-edit?type=${type}`),
      'Đã duyệt yêu cầu sửa!',
      "Xác nhận DUYỆT yêu cầu sửa công trình này?"
    );

  const rejectEditProject = (id) =>
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/reject-edit?type=${type}`),
      'Đã từ chối yêu cầu sửa!',
      "Xác nhận TỪ CHỐI yêu cầu sửa công trình này?"
    );

  const approveDeleteProject = (id) =>
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/approve-delete?type=${type}`),
      'Đã duyệt yêu cầu xóa!',
      "Xác nhận DUYỆT yêu cầu xóa công trình này?"
    );

  const rejectDeleteProject = (id) =>
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/reject-delete?type=${type}`),
      'Đã từ chối yêu cầu xóa!',
      "Xác nhận TỪ CHỐI yêu cầu xóa công trình này?"
    );

  return (
    <div className={`flex flex-col min-h-screen p-8 md:p-10 lg:p-12 ${!showHeader ? 'pt-8' : 'pt-24 md:pt-10'} bg-gradient-to-b from-gray-50 to-gray-100`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
        <h1 className="text-heading bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400 animate-slideIn">
          {isCategory ? 'Công trình Danh mục' : 'Công trình Sửa chữa nhỏ'}
        </h1>
        <div className="flex items-center gap-4">
          {user?.permissions?.add && (
            <button
              onClick={openAddNewModal}
              className="btn btn-primary hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
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
            />
          )}
        </>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-4 border-b mb-6">
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

      {activeTab === 'projects' && (
        <>
          <div className="mb-10">
            {isCategory ? (
              <CategoryProjectFilter
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterAllocatedUnit={filterAllocatedUnit}
                setFilterAllocatedUnit={setFilterAllocatedUnit}
                filterConstructionUnit={filterConstructionUnit}
                setFilterConstructionUnit={setFilterConstructionUnit}
                filterName={filterName}
                setFilterName={setFilterName}
                filterMinInitialValue={filterMinInitialValue}
                setFilterMinInitialValue={setFilterMinInitialValue}
                filterMaxInitialValue={filterMaxInitialValue}
                setFilterMaxInitialValue={setFilterMaxInitialValue}
                filterProgress={filterProgress}
                setFilterProgress={setFilterProgress}
                allocatedUnits={allocatedUnits}
                constructionUnitsList={constructionUnitsList}
                sortOrder={sortOrder}
                handleSortChange={handleSortChange}
                isLoading={isLoading || isSubmitting}
                onResetFilters={handleResetFilters}
                showFilter={showFilter}
                setShowFilter={setShowFilter}
              />
            ) : (
              <MinorRepairProjectFilter
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterAllocatedUnit={filterAllocatedUnit}
                setFilterAllocatedUnit={setFilterAllocatedUnit}
                filterName={filterName}
                setFilterName={setFilterName}
                allocatedUnits={allocatedUnits}
                sortOrder={sortOrder}
                handleSortChange={handleSortChange}
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
              showStatusColumn={true} // Thêm cột trạng thái
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
              showStatusColumn={true} // Thêm cột trạng thái
            />
          )}
        </>
      )}

      {activeTab === 'pending' && (
        <div className="mt-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Danh sách công trình chờ duyệt</h2>
          {pendingProjects.length === 0 && !isLoading ? (
            <p className="text-gray-600 text-center">Không có công trình nào đang chờ duyệt.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Tên công trình</th>
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Loại công trình</th>
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th>
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Người tạo</th>
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Thời gian tạo</th>
                    {user?.permissions?.approve && (
                      <th className="p-4 text-left text-gray-700 font-bold border-b">Thao tác</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pendingProjects.map(project => (
                    <tr key={project._id} className="border-t hover:bg-blue-50 transition-all duration-200">
                      <td className="p-4 text-gray-700">{project.name}</td>
                      <td className="p-4 text-gray-700">{isCategory ? 'Danh mục' : 'Sửa chữa nhỏ'}</td>
                      <td className="p-4 text-gray-700">
                        {project.status === 'Chờ duyệt' ? 'Thêm mới' : project.pendingEdit ? 'Sửa' : 'Xóa'}
                      </td>
                      <td className="p-4 text-gray-700">{project.enteredBy || 'Không xác định'}</td>
                      <td className="p-4 text-gray-700">{new Date(project.createdAt).toLocaleString('vi-VN')}</td>
                      {user?.permissions?.approve && (
                        <td className="p-4 text-gray-700">
                          <div className="flex gap-2">
                            {project.status === 'Chờ duyệt' ? (
                              <>
                                <button
                                  onClick={() => approveProject(project._id)}
                                  className="text-green-600 hover:text-green-800"
                                  disabled={isSubmitting}
                                >
                                  <FaCheckCircle size={16} /> Duyệt
                                </button>
                                <button
                                  onClick={() => rejectProject(project._id)}
                                  className="text-red-600 hover:text-red-800"
                                  disabled={isSubmitting}
                                >
                                  <FaTimesCircle size={16} /> Từ chối
                                </button>
                              </>
                            ) : project.pendingEdit ? (
                              <>
                                <button
                                  onClick={() => approveEditProject(project._id)}
                                  className="text-green-600 hover:text-green-800"
                                  disabled={isSubmitting}
                                >
                                  <FaCheckCircle size={16} /> Duyệt sửa
                                </button>
                                <button
                                  onClick={() => rejectEditProject(project._id)}
                                  className="text-red-600 hover:text-red-800"
                                  disabled={isSubmitting}
                                >
                                  <FaTimesCircle size={16} /> Từ chối sửa
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => approveDeleteProject(project._id)}
                                  className="text-green-600 hover:text-green-800"
                                  disabled={isSubmitting}
                                >
                                  <FaCheckCircle size={16} /> Duyệt xóa
                                </button>
                                <button
                                  onClick={() => rejectDeleteProject(project._id)}
                                  className="text-red-600 hover:text-red-800"
                                  disabled={isSubmitting}
                                >
                                  <FaTimesCircle size={16} /> Từ chối xóa
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rejected' && (
        <div className="mt-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Danh sách công trình bị từ chối</h2>
          {rejectedProjects.length === 0 && !isLoading ? (
            <p className="text-gray-600 text-center">Không có công trình nào bị từ chối.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Tên công trình</th>
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Loại công trình</th>
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Hành động bị từ chối</th>
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Người từ chối</th>
                    <th className="p-4 text-left text-gray-700 font-bold border-b">Thời gian từ chối</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedProjects.map(project => (
                    <tr key={project._id} className="border-t hover:bg-blue-50 transition-all duration-200">
                      <td className="p-4 text-gray-700">{project.projectName}</td>
                      <td className="p-4 text-gray-700">{project.projectModel === 'CategoryProject' ? 'Danh mục' : 'Sửa chữa nhỏ'}</td>
                      <td className="p-4 text-gray-700">{project.actionType === 'edit' ? 'Sửa' : project.actionType === 'delete' ? 'Xóa' : 'Thêm mới'}</td>
                      <td className="p-4 text-gray-700">{project.rejectedBy?.username || 'Không xác định'}</td>
                      <td className="p-4 text-gray-700">{new Date(project.rejectedAt).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectManagement;