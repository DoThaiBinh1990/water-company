import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCheckCircle, FaTimesCircle, FaBuilding, FaUser } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [newProject, setNewProject] = useState({
    name: '',
    allocatedUnit: '',
    location: '',
    scale: '',
    enteredBy: '',
  });
  const [allocateUnit, setAllocateUnit] = useState('');
  const [assignPerson, setAssignPerson] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [allocatedUnits, setAllocatedUnits] = useState([]);

  // Lấy danh sách công trình và đơn vị phân bổ
  useEffect(() => {
    axios.get('http://localhost:5000/api/projects')
      .then(response => {
        setProjects(response.data);
        setFilteredProjects(response.data);
      })
      .catch(error => {
        console.error('Lỗi khi lấy công trình:', error);
        toast.error('Lỗi khi tải dữ liệu!');
      });

    axios.get('http://localhost:5000/api/allocated-units')
      .then(response => setAllocatedUnits(response.data))
      .catch(error => console.error('Lỗi khi lấy đơn vị phân bổ:', error));
  }, []);

  // Lọc công trình theo trạng thái
  useEffect(() => {
    if (filterStatus) {
      setFilteredProjects(projects.filter(project => project.status === filterStatus));
    } else {
      setFilteredProjects(projects);
    }
  }, [filterStatus, projects]);

  // Đăng ký công trình
  const registerProject = () => {
    axios.post('http://localhost:5000/api/projects', newProject)
      .then(response => {
        setProjects([...projects, response.data]);
        setFilteredProjects([...projects, response.data]);
        setNewProject({ name: '', allocatedUnit: '', location: '', scale: '', enteredBy: '' });
        toast.success('Đã đăng ký công trình!');
      })
      .catch(error => {
        console.error('Lỗi khi đăng ký:', error);
        toast.error('Lỗi khi đăng ký công trình!');
      });
  };

  // Duyệt công trình
  const approveProject = (id) => {
    axios.patch(`http://localhost:5000/api/projects/${id}/approve`)
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        toast.success('Đã duyệt công trình!');
      })
      .catch(error => {
        console.error('Lỗi khi duyệt:', error);
        toast.error('Lỗi khi duyệt công trình!');
      });
  };

  // Từ chối công trình
  const rejectProject = (id) => {
    axios.patch(`http://localhost:5000/api/projects/${id}/reject`)
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        toast.success('Đã từ chối công trình!');
      })
      .catch(error => {
        console.error('Lỗi khi từ chối:', error);
        toast.error('Lỗi khi từ chối công trình!');
      });
  };

  // Phân bổ công trình
  const allocateProject = (id) => {
    axios.patch(`http://localhost:5000/api/projects/${id}/allocate`, { allocatedUnit: allocateUnit })
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        setAllocateUnit('');
        toast.success('Đã phân bổ công trình!');
      })
      .catch(error => {
        console.error('Lỗi khi phân bổ:', error);
        toast.error('Lỗi khi phân bổ công trình!');
      });
  };

  // Phân công công trình
  const assignProject = (id) => {
    axios.patch(`http://localhost:5000/api/projects/${id}/assign`, { assignedTo: assignPerson })
      .then(response => {
        setProjects(projects.map(p => p._id === id ? response.data : p));
        setFilteredProjects(projects.map(p => p._id === id ? response.data : p));
        setAssignPerson('');
        toast.success('Đã phân công công trình!');
      })
      .catch(error => {
        console.error('Lỗi khi phân công:', error);
        toast.error('Lỗi khi phân công công trình!');
      });
  };

  return (
    <div className="p-6 bg-blue-50">
      <h1 className="text-3xl font-bold text-blue-800 mb-6">Quản lý công trình</h1>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Form đăng ký công trình */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">Đăng ký công trình</h2>
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
          <input
            type="text"
            placeholder="Địa điểm"
            value={newProject.location}
            onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Quy mô"
            value={newProject.scale}
            onChange={(e) => setNewProject({ ...newProject, scale: e.target.value })}
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
        <button
          onClick={registerProject}
          className="mt-4 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <FaCheckCircle /> Đăng ký
        </button>
      </div>

      {/* Bộ lọc */}
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

      {/* Danh sách công trình */}
      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-blue-200">
              <th className="p-3 text-left text-blue-800">STT</th>
              <th className="p-3 text-left text-blue-800">Tên công trình</th>
              <th className="p-3 text-left text-blue-800">Đơn vị phân bổ</th>
              <th className="p-3 text-left text-blue-800">Địa điểm</th>
              <th className="p-3 text-left text-blue-800">Quy mô</th>
              <th className="p-3 text-left text-blue-800">Người nhập</th>
              <th className="p-3 text-left text-blue-800">Trạng thái</th>
              <th className="p-3 text-left text-blue-800">Người phụ trách</th>
              <th className="p-3 text-left text-blue-800">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(project => (
              <tr key={project._id} className="border-t hover:bg-blue-50">
                <td className="p-3">{project.serialNumber}</td>
                <td className="p-3">{project.name}</td>
                <td className="p-3">{project.allocatedUnit}</td>
                <td className="p-3">{project.location}</td>
                <td className="p-3">{project.scale}</td>
                <td className="p-3">{project.enteredBy}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded ${
                      project.status === 'Chờ duyệt'
                        ? 'bg-yellow-200 text-yellow-800'
                        : project.status === 'Đã duyệt'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {project.status}
                  </span>
                </td>
                <td className="p-3">{project.assignedTo || 'Chưa phân công'}</td>
                <td className="p-3">
                  {project.status === 'Chờ duyệt' && (
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => approveProject(project._id)}
                        className="bg-green-600 text-white p-1 rounded hover:bg-green-700 flex items-center gap-1"
                      >
                        <FaCheckCircle /> Duyệt
                      </button>
                      <button
                        onClick={() => rejectProject(project._id)}
                        className="bg-red-600 text-white p-1 rounded hover:bg-red-700 flex items-center gap-1"
                      >
                        <FaTimesCircle /> Từ chối
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2 mb-2">
                    <select
                      value={allocateUnit}
                      onChange={(e) => setAllocateUnit(e.target.value)}
                      className="border border-blue-300 p-1 rounded"
                    >
                      <option value="">Chọn đơn vị</option>
                      {allocatedUnits.map(unit => (
                        <option key={unit._id} value={unit.name}>{unit.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => allocateProject(project._id)}
                      className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 flex items-center gap-1"
                      disabled={!allocateUnit}
                    >
                      <FaBuilding /> Phân bổ
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Người phụ trách"
                      value={assignPerson}
                      onChange={(e) => setAssignPerson(e.target.value)}
                      className="border border-blue-300 p-1 rounded"
                    />
                    <button
                      onClick={() => assignProject(project._id)}
                      className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 flex items-center gap-1"
                      disabled={!assignPerson}
                    >
                      <FaUser /> Phân công
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectManagement;