import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCheckCircle, FaTimesCircle, FaBuilding, FaUser, FaEdit, FaTrash, FaPlus, FaBell } from 'react-icons/fa';
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
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [newProject, setNewProject] = useState({
    type,
    name: '',
    allocatedUnit: '',
    allocationWave: '',
    location: '',
    scale: isCategory ? '' : undefined,
    enteredBy: '',
  });
  const [editProject, setEditProject] = useState(null);
  const [allocateWaves, setAllocateWaves] = useState({});
  const [assignPersons, setAssignPersons] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [allocationWavesList, setAllocationWavesList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationTab, setNotificationTab] = useState('pending');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const fetchData = async () => {
      try {
        const [projectsRes, unitsRes, wavesRes, notificationsRes] = await Promise.all([
          axios.get(`${API_URL}/api/projects?type=${type}&page=${currentPage}&limit=10`),
          axios.get(`${API_URL}/api/allocated-units`),
          axios.get(`${API_URL}/api/allocation-waves`),
          axios.get(`${API_URL}/api/notifications?status=pending`),
        ]);
        setProjects(projectsRes.data.projects);
        setFilteredProjects(projectsRes.data.projects);
        setTotalPages(projectsRes.data.pages);
        setAllocatedUnits(unitsRes.data);
        setAllocationWavesList(wavesRes.data);
        setNotifications(notificationsRes.data);
      } catch (error) {
        toast.error('Lỗi khi tải dữ liệu!', { position: "top-center" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    socket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      toast.info(notification.message, { position: "top-center" });
    });

    return () => socket.off('notification');
  }, [type, currentPage]);

  useEffect(() => {
    if (filterStatus) {
      setFilteredProjects(projects.filter(project => project.status === filterStatus));
    } else {
      setFilteredProjects(projects);
    }
  }, [filterStatus, projects]);

  const openEditModal = (project) => {
    setEditProject(project);
    setNewProject({
      type,
      name: project.name || '',
      allocatedUnit: project.allocatedUnit || '',
      allocationWave: project.allocationWave || '',
      location: project.location || '',
      scale: isCategory ? project.scale || '' : undefined,
      enteredBy: project.enteredBy || '',
    });
    setShowModal(true);
  };

  const saveProject = async () => {
    if (!newProject.name || !newProject.allocatedUnit || !newProject.location || !newProject.enteredBy || (isCategory && !newProject.scale)) {
      toast.error('Vui lòng nhập đầy đủ thông tin!', { position: "top-center" });
      return;
    }
    setIsLoading(true);
    try {
      const projectData = { ...newProject };
      const request = editProject
        ? axios.patch(`${API_URL}/api/projects/${editProject._id}`, projectData)
        : axios.post(`${API_URL}/api/projects`, projectData);
      const response = await request; // Sử dụng response.data
      if (editProject) {
        setProjects(projects.map(p => p._id === editProject._id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === editProject._id ? response.data : p));
        toast.success('Đã gửi yêu cầu sửa!', { position: "top-center" });
      } else {
        setProjects([...projects, response.data]);
        setFilteredProjects([...projects, response.data]);
        toast.success('Đã đăng ký công trình!', { position: "top-center" });
      }
      setEditProject(null);
      setNewProject({ type, name: '', allocatedUnit: '', allocationWave: '', location: '', scale: isCategory ? '' : undefined, enteredBy: '' });
      setShowModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi đăng ký/sửa công trình!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = async (id) => {
    setIsLoading(true);
    try {
      const response = await axios.delete(`${API_URL}/api/projects/${id}`);
      setProjects(projects.filter(p => p._id !== id));
      setFilteredProjects(projects.filter(p => p._id !== id));
      toast.success(response.data.message, { position: "top-center" });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi xóa công trình!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const approveProject = async (id) => {
    setIsLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/api/projects/${id}/approve`);
      setProjects(projects.map(p => p._id === id ? response.data : p));
      setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
      toast.success('Đã duyệt công trình!', { position: "top-center" });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi duyệt!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const rejectProject = async (id) => {
    setIsLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/api/projects/${id}/reject`);
      setProjects(projects.map(p => p._id === id ? response.data : p));
      setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
      toast.success('Đã từ chối công trình!', { position: "top-center" });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi từ chối!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const allocateProject = async (id) => {
    const wave = allocateWaves[id];
    if (!wave) {
      toast.error('Vui lòng chọn đợt phân bổ!', { position: "top-center" });
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/api/projects/${id}/allocate`, { allocationWave: wave });
      setProjects(projects.map(p => p._id === id ? response.data : p));
      setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
      setAllocateWaves(prev => ({ ...prev, [id]: '' }));
      toast.success('Đã phân bổ công trình!', { position: "top-center" });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi phân bổ!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const assignProject = async (id) => {
    const person = assignPersons[id];
    if (!person) {
      toast.error('Vui lòng nhập người phụ trách!', { position: "top-center" });
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/api/projects/${id}/assign`, { assignedTo: person });
      setProjects(projects.map(p => p._id === id ? response.data : p));
      setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
      setAssignPersons(prev => ({ ...prev, [id]: '' }));
      toast.success('Đã phân công công trình!', { position: "top-center" });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi phân công!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const approveEdit = async (id) => {
    setIsLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/api/projects/${id}/approve-edit`);
      setProjects(projects.map(p => p._id === id ? response.data : p));
      setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
      const notification = notifications.find(n => n.projectId === id && n.type === 'edit');
      if (notification) {
        await axios.patch(`${API_URL}/api/notifications/${notification._id}`, { status: 'processed' });
        setNotifications(notifications.filter(n => n.projectId !== id || n.type !== 'edit'));
      }
      toast.success('Đã duyệt sửa công trình!', { position: "top-center" });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi duyệt sửa!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const rejectEdit = async (id) => {
    setIsLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/api/projects/${id}/reject-edit`);
      setProjects(projects.map(p => p._id === id ? response.data : p));
      setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
      const notification = notifications.find(n => n.projectId === id && n.type === 'edit');
      if (notification) {
        await axios.patch(`${API_URL}/api/notifications/${notification._id}`, { status: 'processed' });
        setNotifications(notifications.filter(n => n.projectId !== id || n.type !== 'edit'));
      }
      toast.success('Đã từ chối sửa công trình!', { position: "top-center" });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi từ chối sửa!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const approveDelete = async (id) => {
    setIsLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/api/projects/${id}/approve-delete`);
      setProjects(projects.filter(p => p._id !== id));
      setFilteredProjects(projects.filter(p => p._id !== id));
      const notification = notifications.find(n => n.projectId === id && n.type === 'delete');
      if (notification) {
        await axios.patch(`${API_URL}/api/notifications/${notification._id}`, { status: 'processed' });
        setNotifications(notifications.filter(n => n.projectId !== id || n.type !== 'delete'));
      }
      toast.success('Đã xóa công trình!', { position: "top-center" });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi duyệt xóa!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  const rejectDelete = async (id) => {
    setIsLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/api/projects/${id}/reject-delete`);
      setProjects(projects.map(p => p._id === id ? response.data : p));
      setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
      const notification = notifications.find(n => n.projectId === id && n.type === 'delete');
      if (notification) {
        await axios.patch(`${API_URL}/api/notifications/${notification._id}`, { status: 'processed' });
        setNotifications(notifications.filter(n => n.projectId !== id || n.type !== 'delete'));
      }
      toast.success('Đã từ chối xóa công trình!', { position: "top-center" });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi từ chối xóa!', { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        {isCategory ? 'Quản lý công trình danh mục' : 'Quản lý công trình sửa chữa nhỏ'}
      </h1>
      <ToastContainer position="top-center" autoClose={3000} />

      {user?.permissions?.add && (
        <button
          onClick={() => {
            setEditProject(null);
            setNewProject({ type, name: '', allocatedUnit: '', allocationWave: '', location: '', scale: isCategory ? '' : undefined, enteredBy: '' });
            setShowModal(true);
          }}
          className="mb-8 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
          disabled={isLoading}
        >
          <FaPlus /> Thêm công trình
        </button>
      )}

      <Modal
        isOpen={showModal}
        onRequestClose={() => setShowModal(false)}
        style={{ overlay: { backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 1000 } }}
        className="bg-white rounded-2xl p-8 max-w-2xl mx-auto mt-24 shadow-2xl animate-fadeIn"
      >
        <h2 className="text-2xl font-bold text-gray-800 mb-6">{editProject ? 'Sửa công trình' : 'Đăng ký công trình'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Tên công trình</label>
            <input
              type="text"
              placeholder="Nhập tên công trình"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Đơn vị phân bổ</label>
            <select
              value={newProject.allocatedUnit}
              onChange={(e) => setNewProject({ ...newProject, allocatedUnit: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              disabled={isLoading}
            >
              <option value="">Chọn đơn vị phân bổ</option>
              {allocatedUnits.map(unit => (
                <option key={unit._id} value={unit.name}>{unit.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Đợt phân bổ</label>
            <select
              value={newProject.allocationWave}
              onChange={(e) => setNewProject({ ...newProject, allocationWave: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              disabled={isLoading}
            >
              <option value="">Chọn đợt phân bổ</option>
              {allocationWavesList.map(wave => (
                <option key={wave._id} value={wave.name}>{wave.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Địa điểm</label>
            <input
              type="text"
              placeholder="Nhập địa điểm"
              value={newProject.location}
              onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              disabled={isLoading}
            />
          </div>
          {isCategory && (
            <div>
              <label className="block text-gray-700 mb-2">Quy mô</label>
              <input
                type="text"
                placeholder="Nhập quy mô"
                value={newProject.scale}
                onChange={(e) => setNewProject({ ...newProject, scale: e.target.value })}
                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                disabled={isLoading}
              />
            </div>
          )}
          <div>
            <label className="block text-gray-700 mb-2">Người nhập</label>
            <input
              type="text"
              placeholder="Nhập tên người nhập"
              value={newProject.enteredBy}
              onChange={(e) => setNewProject({ ...newProject, enteredBy: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="mt-6 flex gap-4">
          <button
            onClick={saveProject}
            className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading || !(user?.permissions?.add || (editProject && user?.permissions?.edit))}
          >
            <FaCheckCircle /> {editProject ? 'Gửi yêu cầu sửa' : 'Đăng ký'}
          </button>
          <button
            onClick={() => setShowModal(false)}
            className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            Hủy
          </button>
        </div>
      </Modal>

      {user?.permissions?.approve && (
        <button
          onClick={() => setShowNotifications(true)}
          className="mb-8 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
          disabled={isLoading}
        >
          <FaBell /> Thông báo ({notifications.length})
        </button>
      )}

      <Modal
        isOpen={showNotifications}
        onRequestClose={() => setShowNotifications(false)}
        style={{ overlay: { backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 1000 } }}
        className="bg-white rounded-2xl p-8 max-w-2xl mx-auto mt-24 shadow-2xl animate-fadeIn"
      >
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Thông báo</h2>
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => {
              setNotificationTab('pending');
              axios.get(`${API_URL}/api/notifications?status=pending`)
                .then(response => setNotifications(response.data));
            }}
            className={`p-3 rounded-lg transition-all duration-200 ${
              notificationTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={isLoading}
          >
            Chưa xử lý
          </button>
          <button
            onClick={() => {
              setNotificationTab('processed');
              axios.get(`${API_URL}/api/notifications?status=processed`)
                .then(response => setNotifications(response.data));
            }}
            className={`p-3 rounded-lg transition-all duration-200 ${
              notificationTab === 'processed' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={isLoading}
          >
            Đã xử lý
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map(notification => (
              <div key={notification._id} className="border-b py-3">
                <p className="text-gray-800">{notification.message}</p>
                <p className="text-sm text-gray-500">{new Date(notification.createdAt).toLocaleString()}</p>
                {notification.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => notification.type === 'edit' ? approveEdit(notification.projectId) : approveDelete(notification.projectId)}
                      className={`bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-all duration-200 flex items-center gap-1 shadow-md hover:shadow-lg ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isLoading}
                    >
                      <FaCheckCircle /> Duyệt
                    </button>
                    <button
                      onClick={() => notification.type === 'edit' ? rejectEdit(notification.projectId) : rejectDelete(notification.projectId)}
                      className={`bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-all duration-200 flex items-center gap-1 shadow-md hover:shadow-lg ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isLoading}
                    >
                      <FaTimesCircle /> Từ chối
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center">Không có thông báo</p>
          )}
        </div>
        <button
          onClick={() => setShowNotifications(false)}
          className={`mt-6 bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 transition-all duration-200 w-full ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isLoading}
        >
          Đóng
        </button>
      </Modal>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Lọc công trình</h3>
        <div className="flex gap-4 items-center">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 w-full md:w-1/3"
            disabled={isLoading}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Chờ duyệt">Chờ duyệt</option>
            <option value="Đã duyệt">Đã duyệt</option>
            <option value="Từ chối">Từ chối</option>
          </select>
          <div className="flex gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded-lg ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-all duration-200`}
                disabled={isLoading}
              >
                {page}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-8">Đang tải...</div>
        ) : (
          <table className="w-full table-auto border-collapse">
            <thead className="sticky top-0 bg-blue-50">
              <tr>
                <th className="p-4 text-left text-gray-700 font-bold border-b">STT</th>
                <th className="p-4 text-left text-gray-700 font-bold border-b">Tên công trình</th>
                <th className="p-4 text-left text-gray-700 font-bold border-b">Đơn vị phân bổ</th>
                <th className="p-4 text-left text-gray-700 font-bold border-b">Đợt phân bổ</th>
                <th className="p-4 text-left text-gray-700 font-bold border-b">Địa điểm</th>
                {isCategory && <th className="p-4 text-left text-gray-700 font-bold border-b">Quy mô</th>}
                <th className="p-4 text-left text-gray-700 font-bold border-b">Người nhập</th>
                <th className="p-4 text-left text-gray-700 font-bold border-b">Trạng thái</th>
                <th className="p-4 text-left text-gray-700 font-bold border-b">Người phụ trách</th>
                <th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(project => (
                <tr key={project._id} className="border-t hover:bg-blue-50 transition-all duration-200">
                  <td className="p-4">{isCategory ? project.categorySerialNumber : project.minorRepairSerialNumber}</td>
                  <td className="p-4">{project.name}</td>
                  <td className="p-4">{project.allocatedUnit}</td>
                  <td className="p-4">{project.allocationWave || 'Chưa phân bổ'}</td>
                  <td className="p-4">{project.location}</td>
                  {isCategory && <td className="p-4">{project.scale}</td>}
                  <td className="p-4">{project.enteredBy}</td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        project.status === 'Chờ duyệt' ? 'bg-yellow-100 text-yellow-700' :
                        project.status === 'Đã duyệt' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="p-4">{project.assignedTo || 'Chưa phân công'}</td>
                  <td className="p-4 flex gap-2 flex-wrap">
                    {user?.permissions?.approve && project.status === 'Chờ duyệt' && (
                      <>
                        <button
                          onClick={() => approveProject(project._id)}
                          className={`text-green-600 hover:text-green-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Duyệt"
                          disabled={isLoading}
                        >
                          <FaCheckCircle />
                        </button>
                        <button
                          onClick={() => rejectProject(project._id)}
                          className={`text-red-600 hover:text-red-800 transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Từ chối"
                          disabled={isLoading}
                        >
                          <FaTimesCircle />
                        </button>
                      </>
                    )}
                    {(project.status !== 'Đã duyệt' || user?.permissions?.edit) && (
                      <button
                        onClick={() => openEditModal(project)}
                        className={`text-yellow-600 hover:text-yellow-800 transition-all duration-200 ${isLoading || !user?.permissions?.edit ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isLoading || !user?.permissions?.edit}
                        title="Sửa"
                      >
                        <FaEdit />
                      </button>
                    )}
                    {(project.status !== 'Đã duyệt' || user?.permissions?.delete) && (
                      <button
                        onClick={() => deleteProject(project._id)}
                        className={`text-red-600 hover:text-red-800 transition-all duration-200 ${isLoading || !user?.permissions?.delete ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isLoading || !user?.permissions?.delete}
                        title="Xóa"
                      >
                        <FaTrash />
                      </button>
                    )}
                    <select
                      value={allocateWaves[project._id] || ''}
                      onChange={(e) => setAllocateWaves(prev => ({ ...prev, [project._id]: e.target.value }))}
                      className={`border border-gray-300 p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${isLoading || !user?.permissions?.edit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isLoading || !user?.permissions?.edit}
                    >
                      <option value="">Chọn đợt</option>
                      {allocationWavesList.map(wave => (
                        <option key={wave._id} value={wave.name}>{wave.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => allocateProject(project._id)}
                      className={`text-blue-600 hover:text-blue-800 transition-all duration-200 ${isLoading || !user?.permissions?.edit || !allocateWaves[project._id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isLoading || !user?.permissions?.edit || !allocateWaves[project._id]}
                      title="Phân bổ"
                    >
                      <FaBuilding />
                    </button>
                    <input
                      type="text"
                      placeholder="Người phụ trách"
                      value={assignPersons[project._id] || ''}
                      onChange={(e) => setAssignPersons(prev => ({ ...prev, [project._id]: e.target.value }))}
                      className={`border border-gray-300 p-2 rounded-lg text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${isLoading || !user?.permissions?.edit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isLoading || !user?.permissions?.edit}
                    />
                    <button
                      onClick={() => assignProject(project._id)}
                      className={`text-blue-600 hover:text-blue-800 transition-all duration-200 ${isLoading || !user?.permissions?.edit || !assignPersons[project._id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isLoading || !user?.permissions?.edit || !assignPersons[project._id]}
                      title="Phân công"
                    >
                      <FaUser />
                    </button>
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