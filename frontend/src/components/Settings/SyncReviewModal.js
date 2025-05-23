// d:\CODE\water-company\frontend\src\components\Settings\SyncReviewModal.js
import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'react-modal';
import { FaSave, FaTimes, FaExclamationTriangle, FaCheckCircle, FaTrash, FaSpinner } from 'react-icons/fa'; // Thêm FaTrash, FaSpinner
import { toast } from 'react-toastify';
import { categoryFormConfig, minorRepairFormConfig } from '../../config/formConfigs'; // Để lấy thông tin trường
import { useMediaQuery } from '../../hooks/useMediaQuery'; // Import hook
import { formatDateToLocale } from '../../utils/dateUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // Thêm useMutation, useQueryClient
import { deleteProject as deleteProjectAPI } from '../../apiService'; // API để xóa

Modal.setAppElement('#root');

const SyncReviewModal = ({
  isOpen,
  onRequestClose,
  preparedData = [],
  onConfirmSync,
  isExecutingSync,
  dataSources, // Nhận dataSources từ Settings.js
  currentUser, // Nhận currentUser để kiểm tra quyền admin
}) => {
  const [projectsToSync, setProjectsToSync] = useState([]);
  const [editableData, setEditableData] = useState({}); // { [projectId]: { field: value } }
  const [areAllSelected, setAreAllSelected] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    // Chỉ cập nhật projectsToSync và editableData khi preparedData thực sự thay đổi
    // hoặc khi modal được mở lần đầu với dữ liệu mới.
    if (isOpen) {
      const initialSyncSelection = preparedData
        .filter(p => !p.isDuplicateInNewSystem) // Mặc định không chọn những cái bị trùng
        .map(p => p._id);
      setProjectsToSync(initialSyncSelection);

      const initialEditable = {};
      preparedData.forEach(p => {
        initialEditable[p._id] = { ...p.syncData }; // Khởi tạo editableData từ syncData
      });
      setEditableData(initialEditable);
      setAreAllSelected(initialSyncSelection.length === preparedData.filter(p => !p.isDuplicateInNewSystem).length && initialSyncSelection.length > 0);
    } else if (!isOpen) { // Reset khi modal đóng
      setProjectsToSync([]);
      setEditableData({});
      setAreAllSelected(false);
    }
  }, [isOpen, preparedData]);

  const queryClient = useQueryClient();

  const handleToggleProjectSync = (projectId) => {
    setProjectsToSync(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  useEffect(() => {
    // Cập nhật trạng thái của checkbox "Chọn tất cả"
    const nonDuplicateProjects = preparedData.filter(p => !p.isDuplicateInNewSystem);
    setAreAllSelected(nonDuplicateProjects.length > 0 && projectsToSync.length === nonDuplicateProjects.length);
  }, [projectsToSync, preparedData]);

  const handleSelectAllToggle = () => {
    const nonDuplicateProjectIds = preparedData.filter(p => !p.isDuplicateInNewSystem).map(p => p._id);
    setProjectsToSync(prev => 
      prev.length === nonDuplicateProjectIds.length ? [] : nonDuplicateProjectIds
    );
  };

  const handleInputChange = (projectId, fieldName, value) => {
    setEditableData(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [fieldName]: value,
      },
    }));
  };

  const getFieldLabel = (fieldName, projectType) => {
    const config = projectType === 'category' ? categoryFormConfig : minorRepairFormConfig;
    for (const tab of config.tabs) {
      const field = tab.fields.find(f => f.name === fieldName);
      if (field) return field.label;
    }
    return fieldName;
  };

  const getOptionsForMissingField = (fieldConfig) => {
    if (!fieldConfig || !dataSources) return [];
    // Đảm bảo dataSources có các key đúng như mong đợi
    switch (fieldConfig.optionsSource) {
      case 'allocatedUnits': 
        return dataSources.allocatedUnits?.map(opt => ({ value: opt.name || opt, label: opt.name || opt })) || [];
      case 'users': 
        return dataSources.usersList?.map(u => ({ value: u._id, label: u.fullName || u.username })) || [];
      case 'approvers': 
        // Giả sử approversList có cấu trúc tương tự usersList
        return dataSources.usersList?.filter(u => u.permissions?.approve).map(a => ({ value: a._id, label: a.fullName || a.username })) || [];
      case 'projectTypes': 
        return dataSources.projectTypesList?.map(pt => ({ value: pt.name || pt, label: pt.name || pt })) || [];
      case 'constructionUnits':
        return dataSources.constructionUnitsList?.map(cu => ({ value: cu.name || cu, label: cu.name || cu })) || [];
      case 'allocationWaves':
        return dataSources.allocationWavesList?.map(aw => ({ value: aw.name || aw, label: aw.name || aw })) || [];
      // Thêm các case khác nếu cần
      default: return [];
    }
  };


  const handleConfirm = () => {
    let allValid = true;
    const projectsPayload = [];

    preparedData.forEach(p => {
      if (projectsToSync.includes(p._id)) { // Chỉ xử lý những project được chọn
        const currentData = editableData[p._id] || {};
        let missingFieldsForThisProject = [];

        // Kiểm tra các trường bắt buộc dựa trên p.missingMandatoryFields
        // (p.missingMandatoryFields chứa { field, label })
        p.missingMandatoryFields.forEach(mf => {
          const value = currentData[mf.field];
          if (value === null || value === undefined || String(value).trim() === '') {
            missingFieldsForThisProject.push(mf.label);
          }
        });

        if (missingFieldsForThisProject.length > 0) {
          allValid = false;
          toast.error(`Công trình "${p.originalData.name || p._id}" còn thiếu: ${missingFieldsForThisProject.join(', ')}`, { autoClose: 5000 });
        } else {
          projectsPayload.push({
            _id: p._id, // ID gốc của công trình
            projectData: p.originalData, // Dữ liệu gốc
            userInputData: currentData, // Dữ liệu người dùng đã sửa/nhập
            projectType: p.projectType, // Loại công trình
          });
        }
      }
    });

    if (allValid && projectsPayload.length > 0) {
      onConfirmSync(projectsPayload);
    } else if (projectsPayload.length === 0 && allValid) {
      toast.info("Không có công trình nào được chọn để đồng bộ.");
    }
  };

  const deleteProjectMutation = useMutation({
    mutationFn: ({ projectId, projectType }) => deleteProjectAPI({ projectId, type: projectType }),
    onSuccess: (data, variables) => {
      toast.success(data.message || `Đã xóa công trình ${variables.projectId}.`, { autoClose: 3000 });
      // Cập nhật lại preparedData ở component cha (Settings.js) bằng cách gọi lại prepareSyncMutation
      // Hoặc, nếu muốn xử lý ngay tại modal:
      // Cần một cách để component cha (Settings.js) gọi lại prepareSyncMutation
      // và truyền preparedData mới xuống.
      // Cách đơn giản hơn là đóng modal và yêu cầu người dùng mở lại để thấy thay đổi.
      // Hoặc, nếu có hàm refetchPreparedData từ props:
      // if (typeof refetchPreparedData === 'function') refetchPreparedData();
      // Hiện tại, để đơn giản, sẽ đóng modal và người dùng cần "Chuẩn bị & Review" lại.
      // Để cập nhật UI ngay lập tức trong modal:
      // 1. Xóa project khỏi preparedData (cần hàm setPreparedData từ props)
      // 2. Xóa project khỏi projectsToSync
      // 3. Xóa project khỏi editableData
      // Vì preparedData là prop, ta không thể sửa trực tiếp.
      // Giải pháp tốt nhất là Settings.js quản lý preparedData và truyền hàm để refresh nó.
      // Tạm thời, sẽ đóng modal và yêu cầu người dùng làm mới.
      onRequestClose(); // Đóng modal sau khi xóa
      queryClient.invalidateQueries(['projects']); // Invalidate các query liên quan đến projects
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi xóa công trình!', { autoClose: 4000 }),
  });

  const renderFieldValue = (value, fieldName) => {
    if (fieldName.toLowerCase().includes('date') && value) {
        return formatDateToLocale(value);
    }
    if (typeof value === 'boolean') return value ? 'Có' : 'Không';
    // Xử lý trường hợp value là object
    if (typeof value === 'object' && value !== null && !React.isValidElement(value)) {
      return '[Dữ liệu đối tượng]'; // Hoặc JSON.stringify(value) để debug
    }
    return value || 'N/A';
  }

  const systemLockedFields = useMemo(() => [
    // Các trường hệ thống không bao giờ cho sửa ở màn hình này
    '_id', '__v', 'createdAt', 'updatedAt', 'type', 
    'categorySerialNumber', 'minorRepairSerialNumber',
    'history', 
    'pendingEdit', 'pendingDelete', // Thông tin về pending actions
    'status', // Trạng thái sẽ được hệ thống quản lý sau khi duyệt
    'projectCode', // Mã công trình được tạo tự động, chỉ admin sửa ở form chính
  ], []);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={{
        overlay: {
          zIndex: 10001,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        content: {
          position: 'relative',
          inset: 'auto', // Quan trọng để flexbox của overlay căn giữa
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          border: '1px solid #ccc',
          borderRadius: '8px',
          background: '#f9fafb',
          boxSizing: 'border-box',
          ...(isMobile ? {
            width: 'auto', // Để flexbox tự quyết định width dựa trên content và margins
            marginLeft: '1rem', // Khoảng đệm trái
            marginRight: '1rem', // Khoảng đệm phải
            maxWidth: 'calc(100vw - 2rem)', // Đảm bảo không vượt quá viewport trừ đi margins
          } : {
            width: '95%', // Giữ nguyên cho desktop
            maxWidth: '1000px', // Giữ nguyên cho desktop
            margin: 'auto', // Căn giữa cho desktop
          })
        }
      }}
      contentLabel="Review và Đồng bộ Dữ liệu Công trình"
    >
      <div className="p-5 bg-gray-800 text-white border-b border-gray-700 flex justify-between items-center rounded-t-lg">
        <h2 className="text-xl font-semibold">Review và Đồng bộ Dữ liệu</h2>
        <button onClick={onRequestClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors" disabled={isExecutingSync}><FaTimes size={16} /></button>
      </div>

      {preparedData.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center">
          <input
            type="checkbox"
            id="selectAllSync"
            checked={areAllSelected}
            onChange={handleSelectAllToggle}
            className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-400 focus:ring-blue-500 disabled:opacity-50"
            disabled={isExecutingSync || preparedData.filter(p => !p.isDuplicateInNewSystem).length === 0}
          />
          <label htmlFor="selectAllSync" className="ml-2 text-sm font-medium text-gray-700">
            {areAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả công trình hợp lệ'}
          </label>
        </div>
      )}

      <div className="p-5 overflow-y-auto flex-grow bg-white">
        {preparedData.length === 0 ? (
          <p className="text-center text-gray-500 py-10">Không có dữ liệu công trình để review.</p>
        ) : (
          <div className="space-y-4">
            {preparedData.map((p, index) => (
              <div key={p._id} className={`p-4 rounded-lg shadow-md border ${p.isDuplicateInNewSystem ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-700">
                      {index + 1}. {p.originalData.name || `Công trình ID: ${p._id}`}
                      {p.isDuplicateInNewSystem && <span className="ml-2 text-xs font-bold text-red-600">(TRÙNG LẶP)</span>}
                    </h3>
                    <p className="text-xs text-gray-500">ID gốc: {p._id} - Loại: {p.projectType === 'category' ? 'Danh mục' : 'Sửa chữa nhỏ'}</p>
                  </div>
                  {!p.isDuplicateInNewSystem && (
                    <input
                      type="checkbox"
                      checked={projectsToSync.includes(p._id)}
                      onChange={() => handleToggleProjectSync(p._id)}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-400 focus:ring-blue-500 disabled:opacity-50"
                      disabled={isExecutingSync}
                    />
                  )}
                </div>

                {p.isDuplicateInNewSystem && (
                  <div className="text-sm text-red-700 mb-3 p-3 bg-red-100 rounded-md border border-red-300">
                    <div className="flex items-center mb-2">
                      <FaExclamationTriangle className="inline mr-2 text-red-600" size={16}/>
                      <span className="font-semibold">Công trình này (trùng tên, đơn vị, năm) đã tồn tại trong hệ thống mới và sẽ không được đồng bộ.</span>
                    </div>
                    {currentUser?.role === 'admin' && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN công trình "${p.originalData.name || p._id}" này khỏi hệ thống? Hành động này không thể hoàn tác.`)) {
                            deleteProjectMutation.mutate({ projectId: p._id, projectType: p.projectType });
                          }
                        }}
                        className={`btn btn-danger btn-sm flex items-center gap-1 ${deleteProjectMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={deleteProjectMutation.isLoading || isExecutingSync}
                      >
                        {deleteProjectMutation.isLoading && deleteProjectMutation.variables?.projectId === p._id ? <FaSpinner className="animate-spin" /> : <FaTrash />} Xóa vĩnh viễn
                      </button>
                    )}
                  </div>
                )}

                {isMobile ? (
                  <div className="space-y-3 text-sm">
                    {/* Thông tin tự động điền */}
                    {Object.keys(p.autoFilledFields).length > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                        <h4 className="font-semibold text-green-700 mb-1 text-xs">Thông tin tự động điền (không sửa):</h4>
                        {Object.entries(p.autoFilledFields).map(([key, value]) => (
                          <div key={key} className="mb-1">
                            <span className="text-gray-600 text-xs">{getFieldLabel(key, p.projectType)}:</span>
                            <span className="block text-green-700 font-medium bg-gray-100 px-2 py-0.5 rounded-sm text-xs">{renderFieldValue(value, key)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Thông tin cần nhập thủ công */}
                    {p.missingMandatoryFields.length > 0 && (
                       <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <h4 className="font-semibold text-yellow-700 mb-1 text-xs">Thông tin cần nhập:</h4>
                        {p.missingMandatoryFields.map(mf => (
                          <div key={mf.field} className="mb-2">
                            <label htmlFor={`${p._id}-${mf.field}-mobile`} className="block text-xs font-medium text-gray-700 mb-0.5">
                              {mf.label} <span className="text-red-500">*</span>
                            </label>
                            {mf.optionsSource && dataSources ? (
                              <select
                                id={`${p._id}-${mf.field}-mobile`}
                                value={editableData[p._id]?.[mf.field] || ''}
                                onChange={(e) => handleInputChange(p._id, mf.field, e.target.value)}
                                className={`form-select w-full p-2 text-xs border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 
                                            ${(isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)) ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300 bg-white'}`}
                                disabled={isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)}
                              >
                                <option value="">-- Chọn {mf.label.toLowerCase()} --</option>
                                {getOptionsForMissingField(mf).map(opt => (
                                  <option key={opt.value || opt.label} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            ) : mf.type === 'textarea' ? (
                              <textarea
                                id={`${p._id}-${mf.field}-mobile`}
                                value={editableData[p._id]?.[mf.field] || ''}
                                onChange={(e) => handleInputChange(p._id, mf.field, e.target.value)}
                                className={`form-textarea w-full p-2 text-xs border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500
                                            ${(isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)) ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300 bg-white'}`}
                                disabled={isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)}
                                rows={2}
                              />
                            ) : (
                              <input
                                id={`${p._id}-${mf.field}-mobile`}
                                type={mf.field.toLowerCase().includes('date') ? 'date' : (editableData[p._id]?.[mf.field]?.toString().match(/^\d+(\.\d+)?$/) ? 'number' : 'text')}
                                value={editableData[p._id]?.[mf.field] || ''}
                                onChange={(e) => handleInputChange(p._id, mf.field, e.target.value)}
                                className={`form-input w-full p-2 text-xs border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500
                                            ${(isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)) ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300 bg-white'}`}
                                disabled={isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Thông tin khác */}
                    {Object.entries(p.syncData).filter(([key]) => !p.missingMandatoryFields.find(mf => mf.field === key) && !p.autoFilledFields[key] && !systemLockedFields.includes(key)).length > 0 && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <h4 className="font-semibold text-gray-700 mb-1 text-xs">Thông tin khác (không sửa):</h4>
                        {Object.entries(p.syncData)
                          .filter(([key]) => !p.missingMandatoryFields.find(mf => mf.field === key) && !p.autoFilledFields[key] && !systemLockedFields.includes(key))
                          .map(([key, value]) => (
                            <div key={key} className="mb-1">
                              <span className="text-gray-600 text-xs">{getFieldLabel(key, p.projectType)}:</span>
                              <div className="w-full p-1.5 text-xs border border-gray-200 bg-gray-100 rounded-md shadow-sm min-h-[28px] flex items-center">
                                {renderFieldValue(editableData[p._id]?.[key], key)}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Desktop view (original grid)
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {Object.keys(p.autoFilledFields).length > 0 && (
                      <div className="md:col-span-2 p-3 bg-green-50 border border-green-200 rounded-md mb-2">
                        <h4 className="font-semibold text-green-700 mb-1 text-xs">Thông tin tự động điền (không sửa):</h4>
                        {Object.entries(p.autoFilledFields).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-1 items-center mb-0.5">
                            <span className="text-gray-600 col-span-1 text-xs">{getFieldLabel(key, p.projectType)}:</span>
                            <span className="text-green-700 font-medium col-span-2 bg-gray-100 px-2 py-0.5 rounded-sm text-xs">{renderFieldValue(value, key)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.missingMandatoryFields.map(mf => (
                      <div key={mf.field}>
                        <label htmlFor={`${p._id}-${mf.field}`} className="block text-xs font-medium text-gray-700 mb-0.5">
                          {mf.label} <span className="text-red-500">*</span>
                        </label>
                        {mf.optionsSource && dataSources ? (
                          <select
                            id={`${p._id}-${mf.field}`}
                            value={editableData[p._id]?.[mf.field] || ''}
                            onChange={(e) => handleInputChange(p._id, mf.field, e.target.value)}
                            className={`form-select w-full p-1.5 text-xs border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 
                                        ${(isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)) ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300 bg-white'}`}
                            disabled={isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)}
                          >
                            <option value="">-- Chọn {mf.label.toLowerCase()} --</option>
                            {getOptionsForMissingField(mf).map(opt => (
                              <option key={opt.value || opt.label} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : mf.type === 'textarea' ? (
                          <textarea
                            id={`${p._id}-${mf.field}`}
                            value={editableData[p._id]?.[mf.field] || ''}
                            onChange={(e) => handleInputChange(p._id, mf.field, e.target.value)}
                            className={`form-textarea w-full p-1.5 text-xs border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500
                                        ${(isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)) ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300 bg-white'}`}
                            disabled={isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)}
                            rows={2}
                          />
                        ) : (
                          <input
                            id={`${p._id}-${mf.field}`}
                            type={mf.field.toLowerCase().includes('date') ? 'date' : (editableData[p._id]?.[mf.field]?.toString().match(/^\d+(\.\d+)?$/) ? 'number' : 'text')}
                            value={editableData[p._id]?.[mf.field] || ''}
                            onChange={(e) => handleInputChange(p._id, mf.field, e.target.value)}
                            className={`form-input w-full p-1.5 text-xs border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500
                                        ${(isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)) ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300 bg-white'}`}
                            disabled={isExecutingSync || p.isDuplicateInNewSystem || !projectsToSync.includes(p._id)}
                          />
                        )}
                      </div>
                    ))}
                    {Object.entries(p.syncData)
                      .filter(([key]) => !p.missingMandatoryFields.find(mf => mf.field === key) && !p.autoFilledFields[key] && !systemLockedFields.includes(key))
                      .map(([key, value]) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-700 mb-0.5">{getFieldLabel(key, p.projectType)}</label>
                          <div className="w-full p-1.5 text-xs border border-gray-200 bg-gray-100 rounded-md shadow-sm min-h-[28px] flex items-center">
                            {renderFieldValue(editableData[p._id]?.[key], key)}
                          </div>
                       </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-100 border-t border-gray-300 flex justify-end gap-3 rounded-b-lg">
        <button
          type="button" onClick={onRequestClose} disabled={isExecutingSync}
          className="px-4 py-2 border border-gray-400 shadow-sm text-sm font-medium rounded-md text-gray-800 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <FaTimes className="mr-2" /> Hủy
        </button>
        <button
          type="button" onClick={handleConfirm} disabled={isExecutingSync || preparedData.length === 0 || projectsToSync.length === 0}
          className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-blue-300"
        >
          <FaSave className="mr-2" /> {isExecutingSync ? 'Đang đồng bộ...' : `Đồng bộ (${projectsToSync.length}) công trình đã chọn`}
        </button>
      </div>
    </Modal>
  );
};

export default SyncReviewModal;