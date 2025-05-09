// frontend/src/pages/ProjectManagement.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaCheckCircle, FaTimesCircle, FaBuilding, FaUser, FaEdit, FaTrash, FaPlus, FaBell, FaHardHat } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import Modal from 'react-modal';
import io from 'socket.io-client';
import 'react-toastify/dist/ReactToastify.css';
import { API_URL } from '../config';

const socket = io(API_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true
});
Modal.setAppElement('#root');

function ProjectManagement({ user, type }) {
  const isCategory = type === 'category';
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const initialNewProjectState = useCallback(() => ({
    type,
    name: '',
    allocatedUnit: '',
    constructionUnit: '',
    allocationWave: '',
    location: '',
    scale: isCategory ? '' : undefined,
    enteredBy: user?.username || '',
  }), [type, isCategory, user?.username]);

  const [newProject, setNewProject] = useState(initialNewProjectState());
  const [editProject, setEditProject] = useState(null);

  const [allocateWaves, setAllocateWaves] = useState({});
  const [assignPersons, setAssignPersons] = useState({});

  const [filterStatus, setFilterStatus] = useState('');
  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [constructionUnitsList, setConstructionUnitsList] = useState([]);
  const [allocationWavesList, setAllocationWavesList] = useState([]);
  const [filterConstructionUnit, setFilterConstructionUnit] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationTab, setNotificationTab] = useState('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
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
    } finally {
      setIsLoading(false);
    }
  }, [type, currentPage, filterStatus, filterConstructionUnit, user]);


  const fetchNotificationsByStatus = useCallback(async (status) => {
    if (!user?.permissions?.approve) {
        setNotifications([]); // Xóa thông báo nếu không có quyền
        return;
    }
    try {
      // setIsLoading(true); // Cân nhắc có nên set loading cho riêng notification không
      const res = await axios.get(`${API_URL}/api/notifications?status=${status}`);
      setNotifications(res.data);
    } catch (error) {
      console.error("Lỗi tải thông báo:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi tải thông báo!', { position: "top-center" });
    } finally {
      // setIsLoading(false);
    }
  }, [user?.permissions?.approve]);

  useEffect(() => {
    if (!user) {
      setFilteredProjects([]); // Xóa danh sách dự án nếu không có user
      setNotifications([]); // Xóa thông báo nếu không có user
      return;
    };

    const fetchInitialAuxData = async () => {
      setIsLoading(true); // Set loading ở đầu
      try {
        const [unitsRes, wavesRes, constUnitsRes, initialNotificationsRes] = await Promise.all([
          axios.get(`${API_URL}/api/allocated-units`),
          axios.get(`${API_URL}/api/allocation-waves`),
          axios.get(`${API_URL}/api/construction-units`),
          user.permissions?.approve ? axios.get(`${API_URL}/api/notifications?status=pending`) : Promise.resolve({ data: [] }),
        ]);
        setAllocatedUnits(unitsRes.data);
        setAllocationWavesList(wavesRes.data);
        setConstructionUnitsList(constUnitsRes.data);
        if(user.permissions?.approve) {
          setNotifications(initialNotificationsRes.data.filter(n => n.status === 'pending'));
        } else {
          setNotifications([]);
        }
      } catch (error) {
        console.error("Lỗi tải dữ liệu phụ trợ:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Lỗi khi tải dữ liệu phụ trợ!', { position: "top-center" });
      }
      // setIsLoading(false) sẽ được xử lý bởi fetchProjects
    };

    fetchInitialAuxData();

    const handleNewNotification = (notification) => {
        if (user?.permissions?.approve && notification.status === 'pending') {
            setNotifications(prev => [notification, ...prev.filter(n => n._id !== notification._id)]);
        }
        if (notification.projectId && notification.projectId.name) {
            toast.info(`Thông báo: ${notification.message} cho CT "${notification.projectId.name}"`, { position: "top-center" });
        } else {
            toast.info(`Thông báo: ${notification.message}`, { position: "top-center" });
        }
        if (user?.permissions?.approve && showNotifications && notificationTab === 'pending') {
            fetchNotificationsByStatus('pending');
        }
    };
    const handleNotificationProcessed = (notificationId) => {
        if (user?.permissions?.approve) {
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
            if (showNotifications) {
                fetchNotificationsByStatus(notificationTab);
            }
        }
    };

    socket.on('notification', handleNewNotification);
    socket.on('notification_processed', handleNotificationProcessed);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notification_processed', handleNotificationProcessed);
    };
  }, [user, fetchNotificationsByStatus, showNotifications, notificationTab]); // Thêm showNotifications, notificationTab

  useEffect(() => {
    if(user) {
        fetchProjects();
    } else {
        setFilteredProjects([]); // Xóa dự án nếu không có user
    }
  }, [user, currentPage, filterStatus, filterConstructionUnit, fetchProjects]); // Thêm fetchProjects vào deps

  const openAddNewModal = () => {
    setEditProject(null);
    setNewProject(initialNewProjectState());
    setShowModal(true);
  };

  const openEditModal = (project) => {
    setEditProject(project);
    setNewProject({
      type: project.type,
      name: project.name || '',
      allocatedUnit: project.allocatedUnit || '',
      constructionUnit: project.constructionUnit || '',
      allocationWave: project.allocationWave || '',
      location: project.location || '',
      scale: isCategory ? project.scale || '' : undefined,
      enteredBy: project.enteredBy || '',
    });
    setShowModal(true);
  };

  const saveProject = async () => {
    const requiredFields = [newProject.name, newProject.allocatedUnit, newProject.location];
    // Người nhập (enteredBy) sẽ được tự động gán ở backend nếu là tạo mới,
    // hoặc giữ nguyên nếu là sửa và không thay đổi.
    // Nếu bạn muốn user có thể sửa trường này (với quyền admin chẳng hạn), thì cần logic khác.
    // Hiện tại, `newProject.enteredBy` được khởi tạo từ `user?.username` hoặc từ `project.enteredBy` khi sửa.
    if (!editProject && !newProject.enteredBy) { // Chỉ kiểm tra enteredBy khi tạo mới nếu nó là trường bắt buộc từ UI
        requiredFields.push(undefined); // Coi như thiếu nếu không có người nhập khi tạo mới
    }

    if (isCategory && (!newProject.scale || newProject.scale.trim() === "")) {
      requiredFields.push(undefined);
    }

    if (requiredFields.some(field => field === undefined || field === null || (typeof field === 'string' && field.trim() === ""))) {
      toast.error('Vui lòng nhập đầy đủ các trường có dấu (*)!', { position: "top-center" });
      return;
    }
    setIsSubmitting(true);

    let projectPayload = { ...newProject };
    if (!isCategory && projectPayload.hasOwnProperty('scale')) {
      delete projectPayload.scale;
    }
    // Không gửi enteredBy nếu là sửa, trừ khi bạn muốn cho phép sửa trường này
    if (editProject) {
        delete projectPayload.enteredBy; // Backend sẽ không cập nhật trường này từ user thường
    }


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
        
        // Đảm bảo constructionUnit được gửi nếu có thay đổi, kể cả thành chuỗi rỗng
        if (projectPayload.constructionUnit !== editProject.constructionUnit) {
            changedData.constructionUnit = projectPayload.constructionUnit;
            hasChanges = true;
        }


        if (!hasChanges) {
            toast.info('Không có thay đổi nào để cập nhật.', { position: "top-center" });
            setIsSubmitting(false);
            setShowModal(false); // Đóng modal nếu không có gì thay đổi
            return;
        }
        response = await axios.patch(`${API_URL}/api/projects/${editProject._id}`, changedData);
        successMessage = response.data.message || (editProject.status === 'Đã duyệt' && user?.permissions?.edit && !user?.permissions?.approve ? 'Đã gửi yêu cầu sửa!' : 'Đã cập nhật công trình!');
      } else {
        // Khi thêm mới, backend sẽ tự gán enteredBy từ req.user.username
        const payloadForNew = {...projectPayload};
        delete payloadForNew.enteredBy; // Xóa nếu không muốn client tự set, để backend tự set

        response = await axios.post(`${API_URL}/api/projects`, payloadForNew);
        successMessage = response.data.message || 'Đã đăng ký công trình!';
      }

      toast.success(successMessage, { position: "top-center" });
      fetchProjects();
      setShowModal(false);
      setNewProject(initialNewProjectState());
      setEditProject(null);
    } catch (error) {
      console.error("Lỗi khi lưu công trình:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi khi lưu công trình!', { position: "top-center" });
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
            fetchProjects();
            if (showNotifications && user?.permissions?.approve) {
                fetchNotificationsByStatus(notificationTab);
            }
        } catch (error) {
            console.error("Lỗi hành động:", error.response?.data?.message || error.message);
            toast.error(error.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" });
        } finally {
            setIsSubmitting(false);
        }
    }
  };

  const deleteProject = (id) => handleActionWithConfirm(
    () => axios.delete(`${API_URL}/api/projects/${id}`),
    null,
    "Bạn có chắc muốn thực hiện thao tác xóa/yêu cầu xóa công trình này?"
  );

  const approveProject = (id) => handleActionWithConfirm(
    () => axios.patch(`${API_URL}/api/projects/${id}/approve`),
    'Đã duyệt công trình!',
    "Bạn có chắc muốn duyệt công trình này?"
  );
  const rejectProject = (id) => handleActionWithConfirm(
    () => axios.patch(`${API_URL}/api/projects/${id}/reject`),
    'Đã từ chối công trình!',
    "Bạn có chắc muốn từ chối công trình này?"
  );

  const allocateProject = (id) => {
    const wave = allocateWaves[id];
    if (!wave) return toast.error('Vui lòng chọn đợt phân bổ!', { position: "top-center" });
    handleActionWithConfirm(
        () => axios.patch(`${API_URL}/api/projects/${id}/allocate`, { allocationWave: wave }),
        'Đã phân bổ công trình!',
        `Bạn có chắc muốn phân bổ công trình vào đợt "${wave}"?`
    ).then(() => setAllocateWaves(prev => ({ ...prev, [id]: '' })));
  };

  const assignProject = (id) => {
    const person = assignPersons[id];
    if (!person || person.trim() === "") return toast.error('Vui lòng nhập người phụ trách!', { position: "top-center" });
     handleActionWithConfirm(
        () => axios.patch(`${API_URL}/api/projects/${id}/assign`, { assignedTo: person.trim() }),
        'Đã phân công công trình!',
        `Bạn có chắc muốn phân công cho "${person.trim()}"?`
    ).then(() => setAssignPersons(prev => ({ ...prev, [id]: '' })));
  };

  const approveEdit = (projectId) => handleActionWithConfirm(
    () => axios.patch(`${API_URL}/api/projects/${projectId}/approve-edit`), // Không cần gửi approvedEdit: true
    'Đã duyệt yêu cầu sửa công trình!',
    "Bạn có chắc muốn duyệt yêu cầu sửa này?"
  );
  const rejectEdit = (projectId) => handleActionWithConfirm(
    () => axios.patch(`${API_URL}/api/projects/${projectId}/reject-edit`),
    'Đã từ chối yêu cầu sửa công trình!',
    "Bạn có chắc muốn từ chối yêu cầu sửa này?"
  );
  const approveDelete = (projectId) => handleActionWithConfirm(
    () => axios.patch(`${API_URL}/api/projects/${projectId}/approve-delete`),
    'Đã duyệt yêu cầu xóa và xóa công trình!',
    "Bạn có chắc muốn duyệt yêu cầu xóa này (công trình sẽ bị xóa vĩnh viễn)?"
  );
  const rejectDelete = (projectId) => handleActionWithConfirm(
    () => axios.patch(`${API_URL}/api/projects/${projectId}/reject-delete`),
    'Đã từ chối yêu cầu xóa công trình!',
    "Bạn có chắc muốn từ chối yêu cầu xóa này?"
  );

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 md:mb-8">
        {isCategory ? 'Quản lý Công trình Danh mục' : 'Quản lý Công trình Sửa chữa nhỏ'}
      </h1>
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar={false} newestOnTop />

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
              value={newProject.enteredBy}
              // Người dùng không nên tự sửa trường này, nó được lấy từ user đăng nhập hoặc giữ nguyên khi sửa
              readOnly
              className={`w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 cursor-not-allowed`}
              disabled={isSubmitting} />
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

      {user?.permissions?.approve && (
        <button onClick={() => {setShowNotifications(true); setNotificationTab('pending'); fetchNotificationsByStatus('pending');}}
          className="mb-6 bg-yellow-500 text-white p-3 rounded-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg relative"
          disabled={isLoading || isSubmitting}
        >
          <FaBell /> Thông báo
          {notifications.filter(n => n.status === 'pending').length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
              {notifications.filter(n => n.status === 'pending').length}
            </span>
          )}
        </button>
      )}

      <Modal
        isOpen={showNotifications}
        onRequestClose={() => setShowNotifications(false)}
        className="bg-white rounded-2xl p-6 md:p-8 max-w-xl w-11/12 md:w-full mx-auto mt-10 md:mt-20 shadow-2xl animate-fadeIn focus:outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-[1000] p-4 overflow-y-auto"
      >
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">Trung tâm Thông báo</h2>
        <div className="flex border-b mb-4">
          <button onClick={() => { setNotificationTab('pending'); fetchNotificationsByStatus('pending');}} className={`py-2 px-4 transition-colors ${notificationTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-500 hover:text-blue-500'}`} disabled={isLoading || isSubmitting}>
            Chưa xử lý ({notifications.filter(n => n.status === 'pending').length})
          </button>
          <button onClick={() => { setNotificationTab('processed'); fetchNotificationsByStatus('processed');}} className={`py-2 px-4 transition-colors ${notificationTab === 'processed' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-500 hover:text-blue-500'}`} disabled={isLoading || isSubmitting}>
            Đã xử lý
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto custom-scrollbar pr-2">
          {notifications.filter(n=> n.status === notificationTab).length > 0 ? (
            notifications.filter(n=> n.status === notificationTab).map(notification => (
              <div key={notification._id} className="border-b py-3 last:border-b-0">
                <p className="text-gray-800">{notification.message}</p>
                <p className="text-xs text-gray-500">
                  CT: {notification.projectId?.name || 'N/A'} ({notification.projectId?.type === 'category' ? 'DM' : 'SCN'})
                  - Lúc: {new Date(notification.createdAt).toLocaleString('vi-VN')}
                </p>
                {notification.status === 'pending' && user?.permissions?.approve && notification.projectId?._id && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => {
                        if (notification.type === 'edit') {
                            approveEdit(notification.projectId._id);
                        } else if (notification.type === 'delete') {
                            approveDelete(notification.projectId._id);
                        }
                    }} className={`bg-green-500 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-green-600 disabled:opacity-50`} disabled={isSubmitting}><FaCheckCircle className="mr-1"/> Duyệt</button>
                    <button onClick={() => {
                        if (notification.type === 'edit') {
                            rejectEdit(notification.projectId._id);
                        } else if (notification.type === 'delete') {
                            rejectDelete(notification.projectId._id);
                        }
                    }} className={`bg-red-500 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-red-600 disabled:opacity-50`} disabled={isSubmitting}><FaTimesCircle className="mr-1"/> Từ chối</button>
                  </div>
                )}
              </div>
            ))
          ) : (<p className="text-gray-500 text-center py-4">Không có thông báo nào.</p>)}
        </div>
        <button onClick={() => setShowNotifications(false)} className="mt-6 bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 w-full" disabled={isSubmitting}>Đóng</button>
      </Modal>

      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4">Bộ lọc công trình</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
            <select value={filterStatus} onChange={(e) => { setCurrentPage(1); setFilterStatus(e.target.value);}} className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isLoading || isSubmitting}>
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
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${ project.status === 'Chờ duyệt' ? 'bg-yellow-100 text-yellow-800' : project.status === 'Đã duyệt' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>
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
                      {user?.permissions?.delete && (project.status !== 'Đã duyệt' || (project.status === 'Đã duyệt' && (project.enteredBy === user.username || user.role === 'admin'))) &&(
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