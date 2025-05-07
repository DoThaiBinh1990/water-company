import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCheckCircle, FaTimesCircle, FaBuilding, FaUser, FaEdit, FaTrash, FaPlus, FaBell } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import Modal from 'react-modal';
import io from 'socket.io-client';
import 'react-toastify/dist/ReactToastify.css';
import { API_URL } from '../config';

const socket = io(API_URL);
Modal.setAppElement('#root');

function MinorRepairManagement({ user }) {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [newProject, setNewProject] = useState({
    type: 'minor_repair',
    name: '',
    allocatedUnit: '',
    allocationWave: '',
    location: '',
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

  useEffect(() => {
    axios.get(`${API_URL}/api/projects?type=minor_repair`)
      .then(response => {
        setProjects(response.data);
        setFilteredProjects(response.data);
      })
      .catch(error => toast.error('Lỗi khi tải công trình!'));

    axios.get(`${API_URL}/api/allocated-units`)
      .then(response => setAllocatedUnits(response.data))
      .catch(error => toast.error('Lỗi khi tải đơn vị!'));

    axios.get(`${API_URL}/api/allocation-waves`)
      .then(response => setAllocationWavesList(response.data))
      .catch(error => toast.error('Lỗi khi tải đợt phân bổ!'));

    axios.get(`${API_URL}/api/notifications?status=pending`)
      .then(response => setNotifications(response.data))
      .catch(error => toast.error('Lỗi khi tải thông báo!'));

    socket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      toast.info(notification.message);
    });

    return () => socket.off('notification');
  }, []);

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
      type: 'minor_repair',
      name: project.name || '',
      allocatedUnit: project.allocatedUnit || '',
      allocationWave: project.allocationWave || '',
      location: project.location || '',
      enteredBy: project.enteredBy || '',
    });
    setShowModal(true);
  };

  const saveProject = () => {
    const projectData = { ...newProject };
    const request = editProject
      ? axios.patch(`${API_URL}/api/projects/${editProject._id}`, projectData)
      : axios.post(`${API_URL}/api/projects`, projectData);

    request
      .then(response => {
        if (editProject) {
          setProjects(projects.map(p => p._id === editProject._id ? response.data : p));
          setFilteredProjects(projects.map(p => p._id === editProject._id ? response.data : p));
          toast.success('Đã gửi yêu cầu sửa!');
        } else {
          setProjects([...projects, response.data]);
          setFilteredProjects([...projects, response.data]);
          toast.success('Đã đăng ký công trình!');
        }
        setEditProject(null);
        setNewProject({ type: 'minor_repair', name: '', allocatedUnit: '', allocationWave: '', location: '', enteredBy: '' });
        setShowModal(false);
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi đăng ký/sửa công trình!'));
  };

  const deleteProject = (id) => {
    axios.delete(`${API_URL}/api/projects/${id}`)
      .then(response => {
        setProjects(projects.filter(p => p._id !== id));
        setFilteredProjects(projects.filter(p => p._id !== id));
        toast.success(response.data.message);
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi xóa công trình!'));
  };

  const approveProject = (id) => {
    axios.patch(`${API_URL}/api/projects/${id}/approve`)
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        toast.success('Đã duyệt công trình!');
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi duyệt!'));
  };

  const rejectProject = (id) => {
    axios.patch(`${API_URL}/api/projects/${id}/reject`)
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        toast.success('Đã từ chối công trình!');
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi từ chối!'));
  };

  const allocateProject = (id) => {
    const wave = allocateWaves[id];
    if (!wave) {
      toast.error('Vui lòng chọn đợt phân bổ!');
      return;
    }
    axios.patch(`${API_URL}/api/projects/${id}/allocate`, { allocationWave: wave })
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        setAllocateWaves(prev => ({ ...prev, [id]: '' }));
        toast.success('Đã phân bổ công trình!');
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi phân bổ!'));
  };

  const assignProject = (id) => {
    const person = assignPersons[id];
    if (!person) {
      toast.error('Vui lòng nhập người phụ trách!');
      return;
    }
    axios.patch(`${API_URL}/api/projects/${id}/assign`, { assignedTo: person })
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        setAssignPersons(prev => ({ ...prev, [id]: '' }));
        toast.success('Đã phân công công trình!');
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi phân công!'));
  };

  const approveEdit = (id) => {
    axios.patch(`${API_URL}/api/projects/${id}/approve-edit`)
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        const notification = notifications.find(n => n.projectId === id && n.type === 'edit');
        if (notification) {
          axios.patch(`${API_URL}/api/notifications/${notification._id}`, { status: 'processed' });
          setNotifications(notifications.filter(n => n.projectId !== id || n.type !== 'edit'));
        }
        toast.success('Đã duyệt sửa công trình!');
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi duyệt sửa!'));
  };

  const rejectEdit = (id) => {
    axios.patch(`${API_URL}/api/projects/${id}/reject-edit`)
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        const notification = notifications.find(n => n.projectId === id && n.type === 'edit');
        if (notification) {
          axios.patch(`${API_URL}/api/notifications/${notification._id}`, { status: 'processed' });
          setNotifications(notifications.filter(n => n.projectId !== id || n.type !== 'edit'));
        }
        toast.success('Đã từ chối sửa công trình!');
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi từ chối sửa!'));
  };

  const approveDelete = (id) => {
    axios.patch(`${API_URL}/api/projects/${id}/approve-delete`)
      .then(response => {
        setProjects(projects.filter(p => p._id !== id));
        setFilteredProjects(projects.filter(p => p._id !== id));
        const notification = notifications.find(n => n.projectId === id && n.type === 'delete');
        if (notification) {
          axios.patch(`${API_URL}/api/notifications/${notification._id}`, { status: 'processed' });
          setNotifications(notifications.filter(n => n.projectId !== id || n.type !== 'delete'));
        }
        toast.success('Đã xóa công trình!');
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi duyệt xóa!'));
  };

  const rejectDelete = (id) => {
    axios.patch(`${API_URL}/api/projects/${id}/reject-delete`)
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        const notification = notifications.find(n => n.projectId === id && n.type === 'delete');
        if (notification) {
          axios.patch(`${API_URL}/api/notifications/${notification._id}`, { status: 'processed' });
          setNotifications(notifications.filter(n => n.projectId !== id || n.type !== 'delete'));
        }
        toast.success('Đã từ chối xóa công trình!');
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi từ chối xóa!'));
  };

  return (
    <div className="p-6 bg-blue-50">
      <h1 className="text-3xl font-bold text-blue-800 mb-6">Quản lý công trình sửa chữa nhỏ</h1>
      <ToastContainer position="top-right" autoClose={3000} />

      {user?.permissions?.add && (
        <button
          onClick={() => {
            setEditProject(null);
            setNewProject({ type: 'minor_repair', name: '', allocatedUnit: '', allocationWave: '', location: '', enteredBy: '' });
            setShowModal(true);
          }}
          className="mb-4 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <FaPlus /> Thêm công trình
        </button>
      )}

      <Modal
        isOpen={showModal}
        onRequestClose={() => setShowModal(false)}
        style={{ overlay: { backgroundColor: 'rgba(0, 0, 0, 0.5)' } }}
        className="bg-white rounded-lg p-6 max-w-md mx-auto mt-20"
      >
        <h2 className="text-xl font-semibold text-blue-700 mb-4">{editProject ? 'Sửa công trình' : 'Đăng ký công trình'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Tên công trình"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newProject.allocatedUnit}
            onChange={(e) => setNewProject({ ...newProject, allocatedUnit: e.target.value })}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Chọn đơn vị phân bổ</option>
            {allocatedUnits.map(unit => (
              <option key={unit._id} value={unit.name}>{unit.name}</option>
            ))}
          </select>
          <select
            value={newProject.allocationWave}
            onChange={(e) => setNewProject({ ...newProject, allocationWave: e.target.value })}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Chọn đợt phân bổ</option>
            {allocationWavesList.map(wave => (
              <option key={wave._id} value={wave.name}>{wave.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Địa điểm"
            value={newProject.location}
            onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Người nhập"
            value={newProject.enteredBy}
            onChange={(e) => setNewProject({ ...newProject, enteredBy: e.target.value })}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mt-4 flex gap-4">
          <button
            onClick={saveProject}
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center gap-2"
            disabled={!(user?.permissions?.add || (editProject && user?.permissions?.edit))}
          >
            <FaCheckCircle /> {editProject ? 'Gửi yêu cầu sửa' : 'Đăng ký'}
          </button>
          <button
            onClick={() => setShowModal(false)}
            className="bg-gray-600 text-white p-2 rounded hover:bg-gray-700"
          >
            Hủy
          </button>
        </div>
      </Modal>

      {user?.permissions?.approve && (
        <button
          onClick={() => setShowNotifications(true)}
          className="mb-4 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <FaBell /> Thông báo ({notifications.length})
        </button>
      )}

      <Modal
        isOpen={showNotifications}
        onRequestClose={() => setShowNotifications(false)}
        style={{ overlay: { backgroundColor: 'rgba(0, 0, 0, 0.5)' } }}
        className="bg-white rounded-lg p-6 max-w-md mx-auto mt-20"
      >
        <h2 className="text-xl font-semibold text-blue-700 mb-4">Thông báo</h2>
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => {
              setNotificationTab('pending');
              axios.get(`${API_URL}/api/notifications?status=pending`)
                .then(response => setNotifications(response.data));
            }}
            className={`p-2 rounded ${notificationTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Chưa xử lý
          </button>
          <button
            onClick={() => {
              setNotificationTab('processed');
              axios.get(`${API_URL}/api/notifications?status=processed`)
                .then(response => setNotifications(response.data));
            }}
            className={`p-2 rounded ${notificationTab === 'processed' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Đã xử lý
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map(notification => (
              <div key={notification._id} className="border-b py-2">
                <p>{notification.message}</p>
                <p className="text-sm text-gray-500">{new Date(notification.createdAt).toLocaleString()}</p>
                {notification.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => notification.type === 'edit' ? approveEdit(notification.projectId) : approveDelete(notification.projectId)}
                      className="bg-green-600 text-white p-1 rounded hover:bg-green-700 flex items-center gap-1"
                    >
                      <FaCheckCircle /> Duyệt
                    </button>
                    <button
                      onClick={() => notification.type === 'edit' ? rejectEdit(notification.projectId) : rejectDelete(notification.projectId)}
                      className="bg-red-600 text-white p-1 rounded hover:bg-red-700 flex items-center gap-1"
                    >
                      <FaTimesCircle /> Từ chối
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500">Không có thông báo</p>
          )}
        </div>
        <button
          onClick={() => setShowNotifications(false)}
          className="mt-4 bg-gray-600 text-white p-2 rounded hover:bg-gray-700"
        >
          Đóng
        </button>
      </Modal>

      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <h3 className="text-lg font-semibold text-blue-700 mb-2">Lọc công trình</h3>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Chờ duyệt">Chờ duyệt</option>
          <option value="Đã duyệt">Đã duyệt</option>
          <option value="Từ chối">Từ chối</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-md max-h-[600px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-blue-200">
            <tr>
              <th className="p-3 text-left text-blue-800">STT</th>
              <th className="p-3 text-left text-blue-800">Tên công trình</th>
              <th className="p-3 text-left text-blue-800">Đơn vị phân bổ</th>
              <th className="p-3 text-left text-blue-800">Đợt phân bổ</th>
              <th className="p-3 text-left text-blue-800">Địa điểm</th>
              <th className="p-3 text-left text-blue-800">Người nhập</th>
              <th className="p-3 text-left text-blue-800">Trạng thái</th>
              <th className="p-3 text-left text-blue-800">Người phụ trách</th>
              <th className="p-3 text-left text-blue-800">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(project => (
              <tr key={project._id} className="border-t hover:bg-blue-50">
                <td className="p-3">{project.minorRepairSerialNumber}</td>
                <td className="p-3">{project.name}</td>
                <td className="p-3">{project.allocatedUnit}</td>
                <td className="p-3">{project.allocationWave || 'Chưa phân bổ'}</td>
                <td className="p-3">{project.location}</td>
                <td className="p-3">{project.enteredBy}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded ${
                      project.status === 'Chờ duyệt' ? 'bg-yellow-200 text-yellow-800' :
                      project.status === 'Đã duyệt' ? 'bg-green-200 text-green-800' :
                      'bg-red-200 text-red-800'
                    }`}
                  >
                    {project.status}
                  </span>
                </td>
                <td className="p-3">{project.assignedTo || 'Chưa phân công'}</td>
                <td className="p-3 flex gap-2">
                  {user?.permissions?.approve && project.status === 'Chờ duyệt' && (
                    <>
                      <button
                        onClick={() => approveProject(project._id)}
                        className="text-green-600 hover:text-green-800"
                        title="Duyệt"
                      >
                        <FaCheckCircle />
                      </button>
                      <button
                        onClick={() => rejectProject(project._id)}
                        className="text-red-600 hover:text-red-800"
                        title="Từ chối"
                      >
                        <FaTimesCircle />
                      </button>
                    </>
                  )}
                  {(project.status !== 'Đã duyệt' || user?.permissions?.edit) && (
                    <button
                      onClick={() => openEditModal(project)}
                      className="text-yellow-600 hover:text-yellow-800"
                      disabled={!user?.permissions?.edit}
                      title="Sửa"
                    >
                      <FaEdit />
                    </button>
                  )}
                  {(project.status !== 'Đã duyệt' || user?.permissions?.delete) && (
                    <button
                      onClick={() => deleteProject(project._id)}
                      className="text-red-600 hover:text-red-800"
                      disabled={!user?.permissions?.delete}
                      title="Xóa"
                    >
                      <FaTrash />
                    </button>
                  )}
                  <select
                    value={allocateWaves[project._id] || ''}
                    onChange={(e) => setAllocateWaves(prev => ({ ...prev, [project._id]: e.target.value }))}
                    className="border border-blue-300 p-1 rounded text-sm"
                    disabled={!user?.permissions?.edit}
                  >
                    <option value="">Chọn đợt</option>
                    {allocationWavesList.map(wave => (
                      <option key={wave._id} value={wave.name}>{wave.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => allocateProject(project._id)}
                    className="text-blue-600 hover:text-blue-800"
                    disabled={!user?.permissions?.edit || !allocateWaves[project._id]}
                    title="Phân bổ"
                  >
                    <FaBuilding />
                  </button>
                  <input
                    type="text"
                    placeholder="Người phụ trách"
                    value={assignPersons[project._id] || ''}
                    onChange={(e) => setAssignPersons(prev => ({ ...prev, [project._id]: e.target.value }))}
                    className="border border-blue-300 p-1 rounded text-sm w-24"
                    disabled={!user?.permissions?.edit}
                  />
                  <button
                    onClick={() => assignProject(project._id)}
                    className="text-blue-600 hover:text-blue-800"
                    disabled={!user?.permissions?.edit || !assignPersons[project._id]}
                    title="Phân công"
                  >
                    <FaUser />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MinorRepairManagement;