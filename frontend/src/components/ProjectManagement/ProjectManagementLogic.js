import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import debounce from 'lodash/debounce';
import { toast } from 'react-toastify';
import { API_URL } from 'config';

const socket = io(API_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

function ProjectManagementLogic({ user, type, showHeader, addMessage }) {
  const isCategory = type === 'category';
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [pendingProjects, setPendingProjects] = useState([]);
  const [rejectedProjects, setRejectedProjects] = useState([]);
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
  const [filterAllocationWave, setFilterAllocationWave] = useState('');
  const [filterSupervisor, setFilterSupervisor] = useState('');
  const [filterEstimator, setFilterEstimator] = useState('');
  const [filterReportDate, setFilterReportDate] = useState('');

  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [constructionUnitsList, setConstructionUnitsList] = useState([]);
  const [allocationWavesList, setAllocationWavesList] = useState([]);
  const [usersList, setUsersList] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');

  const initialFilters = useMemo(() => ({
    status: '',
    allocatedUnit: '',
    constructionUnit: '',
    name: '',
    minInitialValue: '',
    maxInitialValue: '',
    progress: '',
    allocationWave: '',
    supervisor: '',
    estimator: '',
    reportDate: '',
  }), []);

  const initialNewProjectState = useCallback(() => {
    const baseState = {
      name: '',
      allocatedUnit: '',
      supervisor: '',
      taskDescription: '',
      notes: '',
      approvedBy: '',
      createdBy: user?._id || '',
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
        location: '',
        scale: '',
        leadershipApproval: '',
      };
    }
  }, [isCategory, user]);

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
        allocationWave: isCategory ? (filters.allocationWave ?? filterAllocationWave) : undefined,
        supervisor: filters.supervisor ?? filterSupervisor,
        estimator: isCategory ? (filters.estimator ?? filterEstimator) : undefined,
        reportDate: !isCategory ? (filters.reportDate ?? filterReportDate) : undefined,
      };

      console.log('Fetching projects with filters:', currentFilters, 'Page:', pageToFetch);

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
        if (isPending) {
          params.append('pending', 'true');
        }

        console.log('API URL:', `${API_URL}/api/projects?${params.toString()}`);
        const projectsRes = await axios.get(`${API_URL}/api/projects?${params.toString()}`);
        console.log('API Response:', projectsRes.data);

        const filteredData = projectsRes.data.projects || [];
        let finalProjects = filteredData;

        if (isPending) {
          finalProjects = filteredData.filter(project =>
            project.status === 'Chờ duyệt' ||
            (project.status === 'Đã duyệt' && (project.pendingEdit || project.pendingDelete))
          );
          setPendingProjects(finalProjects);
        } else {
          finalProjects = filteredData.filter(project =>
            project.status === 'Đã duyệt' && !project.pendingEdit && !project.pendingDelete
          );
          setFilteredProjects(finalProjects);
          setTotalProjectsCount(projectsRes.data.total || 0);
          setTotalPages(projectsRes.data.pages || 1);
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách công trình:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách công trình!', { position: "top-center" });
        if (isPending) {
          setPendingProjects([]);
        } else {
          setFilteredProjects([]);
          setTotalProjectsCount(0);
          setTotalPages(1);
          setCurrentPage(1);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      user,
      type,
      isCategory,
      sortOrder,
      filterStatus,
      filterAllocatedUnit,
      filterConstructionUnit,
      filterName,
      filterMinInitialValue,
      filterMaxInitialValue,
      filterProgress,
      filterAllocationWave,
      filterSupervisor,
      filterEstimator,
      filterReportDate,
    ]
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

  const debouncedFetchProjects = useCallback(
    debounce((page, sort, filters, isPending) => {
      fetchProjects(page, sort, filters, isPending);
    }, 500),
    [fetchProjects]
  );

  useEffect(() => {
    if (user) {
      fetchProjects(currentPage, sortOrder, {
        status: filterStatus,
        allocatedUnit: filterAllocatedUnit,
        constructionUnit: filterConstructionUnit,
        name: filterName,
        minInitialValue: filterMinInitialValue,
        maxInitialValue: filterMaxInitialValue,
        progress: filterProgress,
        allocationWave: filterAllocationWave,
        supervisor: filterSupervisor,
        estimator: filterEstimator,
        reportDate: filterReportDate,
      }, false);
    }
  }, [
    user,
    type,
    currentPage,
    sortOrder,
    fetchProjects,
    filterStatus,
    filterAllocatedUnit,
    filterConstructionUnit,
    filterName,
    filterMinInitialValue,
    filterMaxInitialValue,
    filterProgress,
    filterAllocationWave,
    filterSupervisor,
    filterEstimator,
    filterReportDate,
  ]);

  useEffect(() => {
    if (user) {
      fetchProjects(1, sortOrder, {}, true);
      fetchRejectedProjects();

      if (!socket.connected) {
        socket.connect();
      }

      socket.on('project_deleted', ({ projectId, projectType }) => {
        if (projectType === type) {
          fetchProjects(currentPage, sortOrder, {}, false);
          fetchProjects(1, sortOrder, {}, true);
        }
      });

      socket.on('project_rejected', ({ projectId, projectType }) => {
        if (projectType === type) {
          fetchProjects(currentPage, sortOrder, {}, false);
          fetchProjects(1, sortOrder, {}, true);
          fetchRejectedProjects();
        }
      });

      socket.on('notification_processed', () => {
        fetchProjects(currentPage, sortOrder, {}, false);
        fetchProjects(1, sortOrder, {}, true);
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
  }, [
    user,
    type,
    sortOrder,
    fetchProjects,
    fetchRejectedProjects,
    currentPage,
  ]);

  useEffect(() => {
    if (user) {
      debouncedFetchProjects(currentPage, sortOrder, {
        status: filterStatus,
        allocatedUnit: filterAllocatedUnit,
        constructionUnit: filterConstructionUnit,
        name: filterName,
        minInitialValue: filterMinInitialValue,
        maxInitialValue: filterMaxInitialValue,
        progress: filterProgress,
        allocationWave: filterAllocationWave,
        supervisor: filterSupervisor,
        estimator: filterEstimator,
        reportDate: filterReportDate,
      }, false);
      debouncedFetchProjects(1, sortOrder, {}, true);
    }
  }, [
    filterStatus,
    filterAllocatedUnit,
    filterConstructionUnit,
    filterName,
    filterMinInitialValue,
    filterMaxInitialValue,
    filterProgress,
    filterAllocationWave,
    filterSupervisor,
    filterEstimator,
    filterReportDate,
    user,
    sortOrder,
    debouncedFetchProjects,
    currentPage,
  ]);

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
    setFilterAllocationWave(initialFilters.allocationWave);
    setFilterSupervisor(initialFilters.supervisor);
    setFilterEstimator(initialFilters.estimator);
    setFilterReportDate(initialFilters.reportDate);
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
      approvedBy: project.approvedBy?._id || '',
      createdBy: project.createdBy?._id || project.createdBy || user?._id || '',
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
        location: project.location || '',
        scale: project.scale || '',
        leadershipApproval: project.leadershipApproval || '',
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
    if (isCategory) {
      if (!newProject.name || !newProject.allocatedUnit || !newProject.projectType || !newProject.scale || !newProject.location) {
        toast.error('Vui lòng nhập đầy đủ các trường bắt buộc: Tên danh mục, Đơn vị phân bổ, Loại công trình, Quy mô, và Địa điểm XD!', { position: "top-center" });
        return;
      }
    } else {
      if (!newProject.name || !newProject.allocatedUnit || !newProject.location || !newProject.scale || !newProject.reportDate || !newProject.approvedBy) {
        toast.error('Vui lòng nhập đầy đủ các trường bắt buộc: Tên công trình, Đơn vị phân bổ, Địa điểm, Quy mô, Ngày xảy ra sự cố, và Người phê duyệt!', { position: "top-center" });
        return;
      }
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
      : ['constructionUnit', 'allocationWave', 'estimator', 'durationDays', 'startDate', 'completionDate', 'contractValue', 'progress', 'feasibility', 'projectType', 'estimatedValue', 'categorySerialNumber'];
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

      setNewProject(initialNewProjectState());

      if (fetchPage !== currentPage) {
        setCurrentPage(fetchPage);
      } else {
        fetchProjects(currentPage, sortOrder, {}, false);
        fetchProjects(1, sortOrder, {}, true);
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
        fetchProjects(1, sortOrder, {}, true);
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

  return {
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
    filterStatus,
    setFilterStatus,
    filterAllocatedUnit,
    setFilterAllocatedUnit,
    filterConstructionUnit,
    setFilterConstructionUnit,
    filterName,
    setFilterName,
    filterMinInitialValue,
    setFilterMinInitialValue,
    filterMaxInitialValue,
    setFilterMaxInitialValue,
    filterProgress,
    setFilterProgress,
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
    fetchProjects,
    fetchRejectedProjects,
    debouncedFetchProjects,
    handleSortChange,
    handleResetFilters,
    openAddNewModal,
    openEditModal,
    handleInputChange,
    handleNumericInputChange,
    saveProject,
    deleteProject,
    approveProject,
    rejectProject,
    allocateProject,
    assignProject,
    approveEditProject,
    rejectEditProject,
    approveDeleteProject,
    rejectDeleteProject,
  };
}

export default ProjectManagementLogic;