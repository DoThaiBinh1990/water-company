// frontend/src/pages/ProjectManagement.js
import { useState, useEffect, useCallback, useMemo } from 'react'; // Thêm useMemo
import axios from 'axios';
import { FaPlus, FaEye, FaEyeSlash } from 'react-icons/fa';
import Modal from 'react-modal';
import { API_URL } from '../config';
import { toast } from 'react-toastify';
import debounce from 'lodash/debounce'; // Đảm bảo lodash được cài đặt: npm install lodash
import ProjectFilter from '../components/ProjectFilter';
import ProjectTable from '../components/ProjectTable';
import ProjectForm from '../components/ProjectForm';

Modal.setAppElement('#root'); // Đảm bảo điều này được gọi

function ProjectManagement({ user, type, showHeader }) {
  const isCategory = type === 'category';
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('serial_asc'); // Giá trị sort mặc định
  const [showFilter, setShowFilter] = useState(true);
  const [nextSerial, setNextSerial] = useState(1);
  const [totalProjectsCount, setTotalProjectsCount] = useState(0); // State tổng số công trình

  const [newProject, setNewProject] = useState(null); // Sẽ được khởi tạo trong useEffect
  const [editProject, setEditProject] = useState(null);

  const [allocateWaves, setAllocateWaves] = useState({});
  const [assignPersons, setAssignPersons] = useState({});

  // --- State cho Filters ---
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAllocatedUnit, setFilterAllocatedUnit] = useState('');
  const [filterConstructionUnit, setFilterConstructionUnit] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterMinInitialValue, setFilterMinInitialValue] = useState('');
  const [filterMaxInitialValue, setFilterMaxInitialValue] = useState('');
  const [filterProgress, setFilterProgress] = useState('');
  // -------------------------

  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [constructionUnitsList, setConstructionUnitsList] = useState([]);
  const [allocationWavesList, setAllocationWavesList] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // State cho việc tải dữ liệu bảng
  const [isSubmitting, setIsSubmitting] = useState(false); // State cho việc gửi form/action

  const LOADING_OVERLAY_Z_INDEX = 'z-[1050]'; // z-index cao cho loading overlay

  // --- Giá trị filter ban đầu để reset ---
  const initialFilters = useMemo(() => ({
    status: '',
    allocatedUnit: '',
    constructionUnit: '',
    name: '',
    minInitialValue: '',
    maxInitialValue: '',
    progress: '',
  }), []);
  // ------------------------------------

  // Hàm khởi tạo state cho dự án mới
   const initialNewProjectState = useCallback(() => {
    const baseState = {
      name: '',
      allocatedUnit: '', // Đặt giá trị mặc định là chuỗi rỗng thay vì null/undefined
      supervisor: '',
      taskDescription: '',
      notes: '',
    };
    if (isCategory) {
      return {
        ...baseState,
        constructionUnit: '',
        allocationWave: '',
        location: '',
        scale: '',
        initialValue: '', // Để trống thay vì 0 cho dễ nhập
        estimator: '',
        durationDays: '', // Để trống
        startDate: '',
        completionDate: '',
        contractValue: '', // Để trống
        progress: '',
        feasibility: '',
      };
    } else {
      // Tạo serial ở backend hoặc fetch trước khi mở modal nếu cần độ chính xác cao
      // Hoặc để trống và backend xử lý
      return {
        ...baseState,
        serial: '', // Để backend tự tạo hoặc fetch trước khi mở modal
        reportDate: '',
        inspectionDate: '',
        paymentDate: '',
        paymentValue: '', // Để trống
      };
    }
  }, [isCategory]); // Không phụ thuộc nextSerial nữa nếu backend xử lý

  // Khởi tạo newProject khi component mount hoặc initialNewProjectState thay đổi
  useEffect(() => {
    setNewProject(initialNewProjectState());
  }, [initialNewProjectState]);


  // Hàm gọi API lấy danh sách công trình
  const fetchProjects = useCallback(
    async (pageToFetch = 1, currentSortOrder = sortOrder, filters = {}) => {
      if (!user) {
        setFilteredProjects([]);
        setTotalPages(1);
        setTotalProjectsCount(0);
        return;
      }
      setIsLoading(true);
      const params = new URLSearchParams({ type, page: pageToFetch, limit: 10 }); // Có thể tăng limit nếu muốn

      // Append filters từ state hoặc từ tham số filters (nếu dùng cho reset)
      if (filters.status ?? filterStatus) params.append('status', filters.status ?? filterStatus);
      if (filters.allocatedUnit ?? filterAllocatedUnit) params.append('allocatedUnit', filters.allocatedUnit ?? filterAllocatedUnit);
      if (isCategory && (filters.constructionUnit ?? filterConstructionUnit)) params.append('constructionUnit', filters.constructionUnit ?? filterConstructionUnit);
      if (filters.name ?? filterName) params.append('search', filters.name ?? filterName); // Đổi tên param thành 'search' nếu backend dùng tên này
      if (isCategory && (filters.minInitialValue ?? filterMinInitialValue)) params.append('minInitialValue', filters.minInitialValue ?? filterMinInitialValue);
      if (isCategory && (filters.maxInitialValue ?? filterMaxInitialValue)) params.append('maxInitialValue', filters.maxInitialValue ?? filterMaxInitialValue);
      if (isCategory && (filters.progress ?? filterProgress)) params.append('progress', filters.progress ?? filterProgress);

      // Append sorting
      if (currentSortOrder === 'serial_asc') {
        params.append('sort', isCategory ? 'categorySerialNumber' : 'minorRepairSerialNumber');
        params.append('order', 'asc');
      } else if (currentSortOrder === 'created_desc') {
        params.append('sort', 'createdAt');
        params.append('order', 'desc');
      }
       // Thêm các trường hợp sort khác nếu cần

      try {
        const projectsRes = await axios.get(`${API_URL}/api/projects?${params.toString()}`);
        setFilteredProjects(projectsRes.data.projects || []);
        setTotalPages(projectsRes.data.pages || 1);
        setTotalProjectsCount(projectsRes.data.total || 0); // Cập nhật tổng số

        // Xử lý chuyển trang nếu trang hiện tại không hợp lệ sau khi lọc/xóa
        if (pageToFetch > projectsRes.data.pages && projectsRes.data.pages > 0) {
          setCurrentPage(projectsRes.data.pages); // Chuyển về trang cuối nếu trang hiện tại vượt quá
        } else if (projectsRes.data.projects.length === 0 && pageToFetch > 1) {
          setCurrentPage(1); // Chuyển về trang 1 nếu trang hiện tại trống (trừ trang 1)
        }

        // Cập nhật nextSerial nếu là Sửa chữa nhỏ (cách này có thể không chính xác nếu có phân trang và sort)
        // Nên để backend trả về nextSerial hoặc không cần hiển thị STT trước khi tạo
        // if (!isCategory) { ... }

      } catch (error) {
        console.error("Lỗi khi tải danh sách công trình:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách công trình!', { position: "top-center" });
        setFilteredProjects([]);
        setTotalPages(1);
        setTotalProjectsCount(0);
      } finally {
        setIsLoading(false);
      }
    },
    [
      user, type, isCategory, sortOrder, // Các state ảnh hưởng đến query API
      filterStatus, filterAllocatedUnit, filterConstructionUnit, filterName,
      filterMinInitialValue, filterMaxInitialValue, filterProgress
    ]
  );

  // Fetch dữ liệu phụ trợ (units, waves)
  useEffect(() => {
    if (!user) return;
    const fetchAuxData = async () => {
      try {
        const [unitsRes, wavesRes, constUnitsRes] = await Promise.all([
          axios.get(`${API_URL}/api/allocated-units`),
          axios.get(`${API_URL}/api/allocation-waves`),
          axios.get(`${API_URL}/api/construction-units`),
        ]);
        setAllocatedUnits(unitsRes.data || []);
        setAllocationWavesList(wavesRes.data || []);
        setConstructionUnitsList(constUnitsRes.data || []);
      } catch (error) {
        console.error("Lỗi tải dữ liệu phụ trợ:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Lỗi khi tải dữ liệu phụ trợ!', { position: "top-center" });
      }
    };
    fetchAuxData();
  }, [user]);

  // Debounce hàm fetch chính
  const debouncedFetchProjects = useCallback(debounce(fetchProjects, 500), [fetchProjects]);

  // Effect gọi fetch khi trang, sort thay đổi (không gọi debounced ở đây)
  useEffect(() => {
    if (user) {
      fetchProjects(currentPage, sortOrder);
    } else {
      // Clear state khi logout
      setFilteredProjects([]);
      setTotalPages(1);
      setCurrentPage(1);
      setTotalProjectsCount(0);
    }
    // Không đưa fetchProjects vào đây để tránh vòng lặp nếu fetchProjects thay đổi thường xuyên
  }, [user, type, currentPage, sortOrder]); // Chỉ fetch lại khi các yếu tố chính này thay đổi

  // Effect gọi fetch (debounced) khi filter thay đổi
   useEffect(() => {
    if (user) {
      // Chỉ gọi fetch nếu không phải lần render đầu tiên hoặc filter thực sự thay đổi
      // Cần cơ chế kiểm tra thay đổi phức tạp hơn hoặc chấp nhận gọi lại khi filter thay đổi
      // Reset về trang 1 khi filter thay đổi
      if (currentPage !== 1) {
        setCurrentPage(1);
        // fetch sẽ được gọi bởi useEffect trên khi currentPage thay đổi về 1
      } else {
          // Nếu đang ở trang 1, gọi fetch trực tiếp (hoặc debounced)
          debouncedFetchProjects(1, sortOrder);
      }
    }
  }, [
    filterStatus, filterAllocatedUnit, filterConstructionUnit, filterName,
    filterMinInitialValue, filterMaxInitialValue, filterProgress,
    user, debouncedFetchProjects, sortOrder, currentPage // Thêm currentPage để xử lý reset về trang 1
  ]);


  // Xử lý thay đổi Sắp xếp
  const handleSortChange = (e) => {
    const newSortOrder = e.target.value;
    setSortOrder(newSortOrder);
    if (currentPage !== 1) {
      setCurrentPage(1); // Fetch sẽ được gọi bởi useEffect của currentPage
    } else {
      fetchProjects(1, newSortOrder); // Gọi fetch ngay nếu đang ở trang 1
    }
  };

  // === Hàm xử lý Reset Filters ===
  const handleResetFilters = useCallback(() => {
    setFilterStatus(initialFilters.status);
    setFilterAllocatedUnit(initialFilters.allocatedUnit);
    setFilterConstructionUnit(initialFilters.constructionUnit);
    setFilterName(initialFilters.name);
    setFilterMinInitialValue(initialFilters.minInitialValue);
    setFilterMaxInitialValue(initialFilters.maxInitialValue);
    setFilterProgress(initialFilters.progress);
    // Không reset sortOrder ở đây
    // useEffect của filter sẽ tự động trigger việc fetch lại dữ liệu và reset trang nếu cần
  }, [initialFilters]);
  // ==============================

  // Mở modal Thêm mới
  const openAddNewModal = () => {
    setEditProject(null);
    setNewProject(initialNewProjectState()); // Reset form về trạng thái ban đầu
    setIsLoading(false); // Đảm bảo không có loading state nào ảnh hưởng modal
    setIsSubmitting(false);
    setShowModal(true);
  };

  // Mở modal Chỉnh sửa
  const openEditModal = (project) => {
    setEditProject(project);
    // Chuẩn bị dữ liệu để hiển thị trong form (chuyển đổi date nếu cần)
    const formatForInput = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    let projectDataToSet;

    if (isCategory) {
      projectDataToSet = {
        name: project.name || '',
        allocatedUnit: project.allocatedUnit || '',
        constructionUnit: project.constructionUnit || '',
        allocationWave: project.allocationWave || '',
        location: project.location || '',
        scale: project.scale || '',
        initialValue: project.initialValue ?? '', // Dùng ?? '' để hiển thị input rỗng thay vì 0
        estimator: project.estimator || '',
        supervisor: project.supervisor || '',
        durationDays: project.durationDays ?? '',
        startDate: formatForInput(project.startDate),
        completionDate: formatForInput(project.completionDate),
        taskDescription: project.taskDescription || '',
        contractValue: project.contractValue ?? '',
        progress: project.progress || '',
        feasibility: project.feasibility || '',
        notes: project.notes || '',
        // Không cần các trường chỉ đọc như serial, status, _id ở đây
      };
    } else {
      projectDataToSet = {
        serial: project.minorRepairSerialNumber || '', // Hiển thị serial hiện tại
        name: project.name || '',
        allocatedUnit: project.allocatedUnit || '',
        supervisor: project.supervisor || '',
        reportDate: formatForInput(project.reportDate),
        inspectionDate: formatForInput(project.inspectionDate),
        taskDescription: project.taskDescription || '',
        paymentDate: formatForInput(project.paymentDate),
        paymentValue: project.paymentValue ?? '',
        notes: project.notes || '',
      };
    }
    setNewProject(projectDataToSet);
    setIsLoading(false);
    setIsSubmitting(false);
    setShowModal(true);
  };

  // Xử lý thay đổi input chung
  const handleInputChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    setNewProject((prev) => ({
      ...prev,
      [name]: inputType === 'checkbox' ? checked : value,
    }));
  };

  // Xử lý thay đổi input số (cho phép rỗng)
  const handleNumericInputChange = (e) => {
    const { name, value } = e.target;
    // Chỉ cho phép số hoặc chuỗi rỗng
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
       setNewProject((prev) => ({
         ...prev,
         // Lưu giá trị số nếu hợp lệ, hoặc chuỗi rỗng
         [name]: value,
       }));
    }
  };


  // Lưu công trình (Thêm mới / Cập nhật)
  const saveProject = async () => {
    setIsSubmitting(true);
    let projectPayload = { ...newProject, type }; // Bắt đầu với dữ liệu form hiện tại

    // Chuyển đổi các trường số từ chuỗi (có thể rỗng) sang số hoặc null/0 trước khi gửi
    const numericFieldsCategory = ['initialValue', 'durationDays', 'contractValue'];
    const numericFieldsMinor = ['paymentValue'];
    const fieldsToParse = isCategory ? numericFieldsCategory : numericFieldsMinor;

    fieldsToParse.forEach((field) => {
      const value = projectPayload[field];
      if (value === '' || value === null || isNaN(parseFloat(value))) {
        projectPayload[field] = null; // Gửi null nếu rỗng hoặc không phải số
      } else {
        projectPayload[field] = parseFloat(value);
      }
    });

    // Dọn dẹp các trường không thuộc type hiện tại
    if (isCategory) {
        const minorRepairOnlyFields = ['serial', 'reportDate', 'inspectionDate', 'paymentDate', 'paymentValue', 'minorRepairSerialNumber'];
        minorRepairOnlyFields.forEach(field => delete projectPayload[field]);
    } else {
        const categoryOnlyFields = ['constructionUnit', 'allocationWave', 'location', 'scale', 'initialValue', 'estimator', 'durationDays', 'startDate', 'completionDate', 'contractValue', 'progress', 'feasibility', 'categorySerialNumber'];
        categoryOnlyFields.forEach(field => delete projectPayload[field]);
        // Không gửi serial khi tạo mới SCN, backend sẽ tự tạo
        if (!editProject) {
            delete projectPayload.serial;
        }
    }

    // --- Logic gọi API ---
    try {
      let response;
      let successMessage = '';

      if (editProject) {
        // Chỉ gửi các trường có thay đổi (tùy chọn, có thể gửi toàn bộ payload đã xử lý)
        // const changedData = {}; // Logic tìm changedData phức tạp hơn
        // response = await axios.patch(`${API_URL}/api/projects/${editProject._id}?type=${type}`, changedData);

        // Gửi toàn bộ payload đã xử lý đơn giản hơn
        response = await axios.patch(`${API_URL}/api/projects/${editProject._id}?type=${type}`, projectPayload);
        successMessage = response.data.message || 'Đã cập nhật công trình thành công!';
        // Xử lý message cho yêu cầu sửa nếu cần dựa trên response
        if (editProject.status === 'Đã duyệt' && user?.permissions?.edit && !user?.permissions?.approve && response.data?.pendingEdit) {
            successMessage = 'Đã gửi yêu cầu sửa công trình!';
        }

      } else {
        // Thêm mới
        response = await axios.post(`${API_URL}/api/projects`, projectPayload);
        successMessage = response.data.message || 'Đã đăng ký công trình thành công!';
      }

      toast.success(successMessage, { position: "top-center" });
      // Fetch lại trang hiện tại nếu sửa, fetch trang đầu nếu thêm mới
      fetchProjects(editProject ? currentPage : 1, sortOrder);
      setShowModal(false);
      // Không cần reset form ở đây vì modal đóng sẽ tự reset nếu cần

    } catch (err) {
       const errorMessage = err.response?.data?.message || 'Lỗi khi lưu công trình!';
       console.error('Lỗi khi lưu công trình:', errorMessage, err.response?.data); // Log thêm data lỗi nếu có
       toast.error(errorMessage, { position: "top-center" });
    } finally {
      setIsSubmitting(false);
    }
  };


 // Hàm chung cho các hành động cần xác nhận
 const handleActionWithConfirm = async (actionPromise, successMessage, confirmMessage = "Bạn có chắc chắn?") => {
   if (window.confirm(confirmMessage)) {
     setIsSubmitting(true); // Dùng submitting state để khóa các hành động khác
     try {
       const response = await actionPromise();
       toast.success(successMessage || response?.data?.message || "Thao tác thành công!", { position: "top-center" });
       // Fetch lại trang hiện tại sau khi hành động thành công
       fetchProjects(currentPage, sortOrder);
     } catch (err) {
       console.error("Lỗi hành động:", err.response?.data?.message || err.message);
       toast.error(err.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" });
     } finally {
       setIsSubmitting(false);
     }
   }
 };

  // Các hàm gọi action cụ thể
  const deleteProject = (id) =>
    handleActionWithConfirm(
      () => axios.delete(`${API_URL}/api/projects/${id}?type=${type}`),
      null, // Message sẽ dựa vào response hoặc message mặc định của handleActionWithConfirm
      "Xác nhận Xóa/Yêu cầu xóa công trình này?" // Rút gọn confirm message
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
    if (!wave) return toast.error('Vui lòng chọn đợt phân bổ!', { position: "top-center" });
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/allocate?type=${type}`, { allocationWave: wave }),
      'Đã phân bổ công trình!',
      `Phân bổ công trình vào đợt "${wave}"?`
    ).then(() => setAllocateWaves((prev) => ({ ...prev, [id]: '' }))); // Reset select sau khi thành công
  };

  const assignProject = (id) => {
    const person = assignPersons[id];
    if (!person || person.trim() === "") return toast.error('Vui lòng nhập người phụ trách!', { position: "top-center" });
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/assign?type=${type}`, { assignedTo: person.trim() }),
      'Đã phân công công trình!',
      `Phân công cho "${person.trim()}"?`
    ).then(() => setAssignPersons((prev) => ({ ...prev, [id]: '' }))); // Reset input sau khi thành công
  };


  // --- JSX Return ---
  return (
    <div className={`flex flex-col min-h-screen p-4 md:p-6 lg:p-8 ${!showHeader ? 'pt-4' : 'pt-20 md:pt-8 lg:pt-10'} dark:bg-gray-900`}>
      {/* Header Section */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 gap-4 sm:gap-6`}>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100">
          {isCategory ? 'Công trình Danh mục' : 'Công trình Sửa chữa nhỏ'}
        </h1>
        <div className="flex items-center gap-3 sm:gap-4">
          {user?.permissions?.add && (
            <button
              onClick={openAddNewModal}
              className="form-btn form-btn-primary py-2.5 px-5" // Sử dụng class từ App.css
              disabled={isSubmitting || isLoading} // Khóa khi đang load bảng hoặc submit action khác
            >
              <FaPlus size={14} /> Thêm mới
            </button>
          )}
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="form-btn bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-400 py-2.5 px-5" // Style tương tự
            title={showFilter ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
          >
            {showFilter ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            <span className="hidden sm:inline">{showFilter ? 'Ẩn' : 'Hiện'} bộ lọc</span>
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && ( // Chỉ hiện khi đang load bảng
        <div className={`fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center ${LOADING_OVERLAY_Z_INDEX} animate-fadeIn`}>
          <div className="text-white text-lg p-4 bg-blue-600 rounded-lg shadow-md">Đang tải dữ liệu...</div>
        </div>
      )}
      {isSubmitting && ( // Hiện khi đang submit form hoặc action
        <div className={`fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center ${LOADING_OVERLAY_Z_INDEX} animate-fadeIn`}>
          <div className="text-white text-lg p-4 bg-green-600 rounded-lg shadow-md">Đang xử lý...</div>
        </div>
      )}

      {/* Project Form Modal */}
      {/* Chỉ render Modal khi newProject có giá trị (đã được khởi tạo) */}
      {newProject && (
        <ProjectForm
          key={editProject ? editProject._id : 'new'} // Thêm key để reset state khi đổi từ edit sang new
          showModal={showModal}
          setShowModal={setShowModal}
          isSubmitting={isSubmitting}
          // isLoading không cần thiết cho form, chỉ cho bảng
          editProject={editProject}
          newProject={newProject}
          handleInputChange={handleInputChange}
          handleNumericInputChange={handleNumericInputChange}
          saveProject={saveProject}
          user={user}
          isCategory={isCategory}
          allocatedUnits={allocatedUnits}
          allocationWavesList={allocationWavesList}
          constructionUnitsList={constructionUnitsList}
          initialNewProjectState={initialNewProjectState} // Truyền để reset form
          setNewProject={setNewProject} // Truyền để reset form
        />
      )}

      {/* Project Filter Section */}
      {showFilter && (
        <div className="mb-6 md:mb-8">
          <ProjectFilter
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
            isCategory={isCategory}
            sortOrder={sortOrder}
            handleSortChange={handleSortChange}
            isLoading={isLoading || isSubmitting} // Disable filter khi đang loading hoặc submitting
            onResetFilters={handleResetFilters} // Truyền hàm reset
          />
        </div>
      )}

      {/* Project Table Section */}
      <ProjectTable
        filteredProjects={filteredProjects}
        isCategory={isCategory}
        user={user}
        isSubmitting={isSubmitting} // Truyền để disable nút action
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
        isLoading={isLoading} // Truyền để table biết khi nào hiển thị skeleton
        totalPages={totalPages}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        allocationWavesList={allocationWavesList}
        totalProjectsCount={totalProjectsCount} // Truyền tổng số công trình
      />
    </div>
  );
}

export default ProjectManagement;