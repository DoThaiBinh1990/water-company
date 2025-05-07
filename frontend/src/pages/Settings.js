import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaUserPlus, FaBuilding, FaHardHat, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API_URL } from '../config';

function Settings({ user }) {
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'staff',
    permissions: { add: false, edit: false, delete: false, approve: false }
  });
  const [newAllocatedUnit, setNewAllocatedUnit] = useState('');
  const [editAllocatedUnit, setEditAllocatedUnit] = useState(null);
  const [newConstructionUnit, setNewConstructionUnit] = useState('');
  const [editConstructionUnit, setEditConstructionUnit] = useState(null);
  const [newAllocationWave, setNewAllocationWave] = useState('');
  const [editAllocationWave, setEditAllocationWave] = useState(null);
  const [users, setUsers] = useState([]);
  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [constructionUnits, setConstructionUnits] = useState([]);
  const [allocationWaves, setAllocationWaves] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    axios.get(`${API_URL}/api/users`)
      .then(response => setUsers(response.data))
      .catch(error => toast.error('Lỗi khi tải người dùng!', { position: "top-center" }));

    axios.get(`${API_URL}/api/allocated-units`)
      .then(response => setAllocatedUnits(response.data))
      .catch(error => toast.error('Lỗi khi tải đơn vị phân bổ!', { position: "top-center" }));

    axios.get(`${API_URL}/api/construction-units`)
      .then(response => setConstructionUnits(response.data))
      .catch(error => toast.error('Lỗi khi tải đơn vị thi công!', { position: "top-center" }));

    axios.get(`${API_URL}/api/allocation-waves`)
      .then(response => setAllocationWaves(response.data))
      .catch(error => toast.error('Lỗi khi tải đợt phân bổ!', { position: "top-center" }));
  };

  const saveUser = () => {
    const userData = { ...newUser };
    if (!userData.password) delete userData.password;
    const request = editingUserId
      ? axios.patch(`${API_URL}/api/users/${editingUserId}`, userData)
      : axios.post(`${API_URL}/api/users`, userData);

    request
      .then(response => {
        if (editingUserId) {
          setUsers(users.map(u => u._id === editingUserId ? response.data : u));
          toast.success('Đã cập nhật người dùng!', { position: "top-center" });
        } else {
          setUsers([...users, response.data]);
          toast.success('Đã thêm người dùng!', { position: "top-center" });
        }
        setNewUser({ username: '', password: '', role: 'staff', permissions: { add: false, edit: false, delete: false, approve: false } });
        setEditingUserId(null);
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi thêm/cập nhật người dùng!', { position: "top-center" }));
  };

  const editUser = (user) => {
    setNewUser({
      username: user.username,
      password: '',
      role: user.role,
      permissions: user.permissions
    });
    setEditingUserId(user._id);
  };

  const deleteUser = (id) => {
    axios.delete(`${API_URL}/api/users/${id}`)
      .then(() => {
        setUsers(users.filter(u => u._id !== id));
        toast.success('Đã xóa người dùng!', { position: "top-center" });
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi xóa người dùng!', { position: "top-center" }));
  };

  const saveAllocatedUnit = () => {
    const request = editAllocatedUnit
      ? axios.patch(`${API_URL}/api/allocated-units/${editAllocatedUnit._id}`, { name: newAllocatedUnit })
      : axios.post(`${API_URL}/api/allocated-units`, { name: newAllocatedUnit });

    request
      .then(response => {
        if (editAllocatedUnit) {
          setAllocatedUnits(allocatedUnits.map(u => u._id === editAllocatedUnit._id ? response.data : u));
          toast.success('Đã cập nhật đơn vị phân bổ!', { position: "top-center" });
        } else {
          setAllocatedUnits([...allocatedUnits, response.data]);
          toast.success('Đã thêm đơn vị phân bổ!', { position: "top-center" });
        }
        setNewAllocatedUnit('');
        setEditAllocatedUnit(null);
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi thêm/cập nhật đơn vị phân bổ!', { position: "top-center" }));
  };

  const deleteAllocatedUnit = (id) => {
    axios.delete(`${API_URL}/api/allocated-units/${id}`)
      .then(() => {
        setAllocatedUnits(allocatedUnits.filter(u => u._id !== id));
        toast.success('Đã xóa đơn vị phân bổ!', { position: "top-center" });
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi xóa đơn vị phân bổ!', { position: "top-center" }));
  };

  const saveConstructionUnit = () => {
    const request = editConstructionUnit
      ? axios.patch(`${API_URL}/api/construction-units/${editConstructionUnit._id}`, { name: newConstructionUnit })
      : axios.post(`${API_URL}/api/construction-units`, { name: newConstructionUnit });

    request
      .then(response => {
        if (editConstructionUnit) {
          setConstructionUnits(constructionUnits.map(u => u._id === editConstructionUnit._id ? response.data : u));
          toast.success('Đã cập nhật đơn vị thi công!', { position: "top-center" });
        } else {
          setConstructionUnits([...constructionUnits, response.data]);
          toast.success('Đã thêm đơn vị thi công!', { position: "top-center" });
        }
        setNewConstructionUnit('');
        setEditConstructionUnit(null);
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi thêm/cập nhật đơn vị thi công!', { position: "top-center" }));
  };

  const deleteConstructionUnit = (id) => {
    axios.delete(`${API_URL}/api/construction-units/${id}`)
      .then(() => {
        setConstructionUnits(constructionUnits.filter(u => u._id !== id));
        toast.success('Đã xóa đơn vị thi công!', { position: "top-center" });
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi xóa đơn vị thi công!', { position: "top-center" }));
  };

  const saveAllocationWave = () => {
    const request = editAllocationWave
      ? axios.patch(`${API_URL}/api/allocation-waves/${editAllocationWave._id}`, { name: newAllocationWave })
      : axios.post(`${API_URL}/api/allocation-waves`, { name: newAllocationWave });

    request
      .then(response => {
        if (editAllocationWave) {
          setAllocationWaves(allocationWaves.map(w => w._id === editAllocationWave._id ? response.data : w));
          toast.success('Đã cập nhật đợt phân bổ!', { position: "top-center" });
        } else {
          setAllocationWaves([...allocationWaves, response.data]);
          toast.success('Đã thêm đợt phân bổ!', { position: "top-center" });
        }
        setNewAllocationWave('');
        setEditAllocationWave(null);
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi thêm/cập nhật đợt phân bổ!', { position: "top-center" }));
  };

  const deleteAllocationWave = (id) => {
    axios.delete(`${API_URL}/api/allocation-waves/${id}`)
      .then(() => {
        setAllocationWaves(allocationWaves.filter(w => w._id !== id));
        toast.success('Đã xóa đợt phân bổ!', { position: "top-center" });
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi xóa đợt phân bổ!', { position: "top-center" }));
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-semibold text-gray-800 mb-8">Thiết lập</h1>
      <ToastContainer position="top-center" autoClose={3000} />

      <div className="bg-white p-8 rounded-2xl shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">{editingUserId ? 'Cập nhật người dùng' : 'Thêm người dùng'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-gray-700 mb-2">Tên người dùng</label>
            <input
              type="text"
              placeholder="Nhập tên người dùng"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Mật khẩu</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu (để trống nếu không đổi)"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Vai trò</label>
            <select
              value={newUser.role}
              onChange={(e) => {
                const role = e.target.value;
                const defaultPermissions = {
                  admin: { add: true, edit: true, delete: true, approve: true },
                  director: { add: true, edit: true, delete: true, approve: true },
                  deputy_director: { add: true, edit: true, delete: true, approve: true },
                  manager: { add: true, edit: true, delete: false, approve: true },
                  deputy_manager: { add: true, edit: true, delete: false, approve: false },
                  staff: { add: true, edit: false, delete: false, approve: false },
                  branch_director: { add: true, edit: true, delete: true, approve: true },
                  branch_deputy_director: { add: true, edit: true, delete: false, approve: false },
                  branch_staff: { add: true, edit: false, delete: false, approve: false },
                  worker: { add: false, edit: false, delete: false, approve: false },
                }[role] || { add: false, edit: false, delete: false, approve: false };
                setNewUser({ ...newUser, role, permissions: defaultPermissions });
              }}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            >
              <option value="admin">Admin</option>
              <option value="director">Tổng giám đốc</option>
              <option value="deputy_director">Phó tổng giám đốc</option>
              <option value="manager">Trưởng phòng</option>
              <option value="deputy_manager">Phó phòng</option>
              <option value="staff">Nhân viên phòng</option>
              <option value="branch_director">Giám đốc chi nhánh</option>
              <option value="branch_deputy_director">Phó giám đốc chi nhánh</option>
              <option value="branch_staff">Nhân viên chi nhánh</option>
              <option value="worker">Công nhân trực tiếp</option>
            </select>
          </div>
        </div>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Phân quyền</h3>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newUser.permissions.add}
                onChange={(e) => setNewUser({ ...newUser, permissions: { ...newUser.permissions, add: e.target.checked } })}
                className="mr-2 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Thêm
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newUser.permissions.edit}
                onChange={(e) => setNewUser({ ...newUser, permissions: { ...newUser.permissions, edit: e.target.checked } })}
                className="mr-2 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Sửa
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newUser.permissions.delete}
                onChange={(e) => setNewUser({ ...newUser, permissions: { ...newUser.permissions, delete: e.target.checked } })}
                className="mr-2 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Xóa
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newUser.permissions.approve}
                onChange={(e) => setNewUser({ ...newUser, permissions: { ...newUser.permissions, approve: e.target.checked } })}
                className="mr-2 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Duyệt
            </label>
          </div>
        </div>
        <button
          onClick={saveUser}
          className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
        >
          <FaUserPlus /> {editingUserId ? 'Cập nhật' : 'Thêm'} người dùng
        </button>
        {editingUserId && (
          <button
            onClick={() => {
              setNewUser({ username: '', password: '', role: 'staff', permissions: { add: false, edit: false, delete: false, approve: false } });
              setEditingUserId(null);
            }}
            className="mt-3 bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 transition-all duration-200"
          >
            Hủy
          </button>
        )}
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Quản lý đơn vị phân bổ</h2>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-gray-700 mb-2">Tên đơn vị phân bổ</label>
            <input
              type="text"
              placeholder="Nhập tên đơn vị phân bổ"
              value={newAllocatedUnit}
              onChange={(e) => setNewAllocatedUnit(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
          </div>
          <div className="flex items-end gap-4">
            <button
              onClick={saveAllocatedUnit}
              className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <FaBuilding /> {editAllocatedUnit ? 'Cập nhật' : 'Thêm'} đơn vị
            </button>
            {editAllocatedUnit && (
              <button
                onClick={() => {
                  setNewAllocatedUnit('');
                  setEditAllocatedUnit(null);
                }}
                className="bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 transition-all duration-200"
              >
                Hủy
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Tên đơn vị</th>
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {allocatedUnits.map(unit => (
                <tr key={unit._id} className="border-t hover:bg-blue-50 transition-all duration-200">
                  <td className="p-4">{unit.name}</td>
                  <td className="p-4 flex gap-2">
                    <button
                      onClick={() => {
                        setNewAllocatedUnit(unit.name);
                        setEditAllocatedUnit(unit);
                      }}
                      className="text-yellow-600 hover:text-yellow-800 transition-all duration-200"
                      title="Sửa"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => deleteAllocatedUnit(unit._id)}
                      className="text-red-600 hover:text-red-800 transition-all duration-200"
                      title="Xóa"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Quản lý đơn vị thi công</h2>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-gray-700 mb-2">Tên đơn vị thi công</label>
            <input
              type="text"
              placeholder="Nhập tên đơn vị thi công"
              value={newConstructionUnit}
              onChange={(e) => setNewConstructionUnit(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
          </div>
          <div className="flex items-end gap-4">
            <button
              onClick={saveConstructionUnit}
              className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <FaHardHat /> {editConstructionUnit ? 'Cập nhật' : 'Thêm'} đơn vị
            </button>
            {editConstructionUnit && (
              <button
                onClick={() => {
                  setNewConstructionUnit('');
                  setEditConstructionUnit(null);
                }}
                className="bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 transition-all duration-200"
              >
                Hủy
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Tên đơn vị</th>
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {constructionUnits.map(unit => (
                <tr key={unit._id} className="border-t hover:bg-blue-50 transition-all duration-200">
                  <td className="p-4">{unit.name}</td>
                  <td className="p-4 flex gap-2">
                    <button
                      onClick={() => {
                        setNewConstructionUnit(unit.name);
                        setEditConstructionUnit(unit);
                      }}
                      className="text-yellow-600 hover:text-yellow-800 transition-all duration-200"
                      title="Sửa"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => deleteConstructionUnit(unit._id)}
                      className="text-red-600 hover:text-red-800 transition-all duration-200"
                      title="Xóa"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Quản lý đợt phân bổ</h2>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-gray-700 mb-2">Tên đợt phân bổ</label>
            <input
              type="text"
              placeholder="Nhập tên đợt phân bổ"
              value={newAllocationWave}
              onChange={(e) => setNewAllocationWave(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
          </div>
          <div className="flex items-end gap-4">
            <button
              onClick={saveAllocationWave}
              className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <FaPlus /> {editAllocationWave ? 'Cập nhật' : 'Thêm'} đợt phân bổ
            </button>
            {editAllocationWave && (
              <button
                onClick={() => {
                  setNewAllocationWave('');
                  setEditAllocationWave(null);
                }}
                className="bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 transition-all duration-200"
              >
                Hủy
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Tên đợt phân bổ</th>
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {allocationWaves.map(wave => (
                <tr key={wave._id} className="border-t hover:bg-blue-50 transition-all duration-200">
                  <td className="p-4">{wave.name}</td>
                  <td className="p-4 flex gap-2">
                    <button
                      onClick={() => {
                        setNewAllocationWave(wave.name);
                        setEditAllocationWave(wave);
                      }}
                      className="text-yellow-600 hover:text-yellow-800 transition-all duration-200"
                      title="Sửa"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => deleteAllocationWave(wave._id)}
                      className="text-red-600 hover:text-red-800 transition-all duration-200"
                      title="Xóa"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Danh sách người dùng</h2>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Tên người dùng</th>
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Vai trò</th>
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Quyền</th>
                <th className="p-4 text-left text-gray-700 font-semibold border-b">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-t hover:bg-blue-50 transition-all duration-200">
                  <td className="p-4">{u.username}</td>
                  <td className="p-4">{u.role}</td>
                  <td className="p-4">
                    {u.permissions.add && 'Thêm, '}
                    {u.permissions.edit && 'Sửa, '}
                    {u.permissions.delete && 'Xóa, '}
                    {u.permissions.approve && 'Duyệt'}
                  </td>
                  <td className="p-4 flex gap-2">
                    <button
                      onClick={() => editUser(u)}
                      className="text-yellow-600 hover:text-yellow-800 transition-all duration-200"
                      title="Sửa"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => deleteUser(u._id)}
                      className="text-red-600 hover:text-red-800 transition-all duration-200"
                      disabled={u.role === 'admin'}
                      title={u.role === 'admin' ? 'Không thể xóa admin' : 'Xóa'}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Settings;