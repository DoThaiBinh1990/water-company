// d:\CODE\water-company\frontend\src\components\ProjectManagement\GenericFormModal.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { FaSave, FaTimes } from 'react-icons/fa';

Modal.setAppElement('#root');

function GenericFormModal({
  showModal,
  setShowModal,
  isSubmitting,
  editProject,
  formData,
  setFormData,
  formConfig,
  saveProject,
  initialFormState, // Nhận initialFormState từ ProjectManagementLogic
  allocatedUnits = [],
  user,
  allocationWavesList = [],
  constructionUnitsList = [],
  usersList = [],
  approversList = [],
  projectTypesList = [],
}) {
  const visibleTabs = useMemo(() => {
    if (!formConfig || !formConfig.tabs) return [];
    if (!user) return [];

    return formConfig.tabs.filter(tab => {
      if (tab.name === 'assignment') {
        return user.role === 'admin' ||
               user.role === 'director' ||
               user.role === 'deputy_director' ||
               user.role.includes('manager-office') ||
               (user.role.includes('manager-branch') && (user.permissions?.allocate || user.permissions?.assign)) ||
               (user.role.includes('deputy_manager-branch') && (user.permissions?.allocate || user.permissions?.assign));
      }
      return true;
    });
  }, [formConfig, user]);

  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.name || 'basic');

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(tab => tab.name === activeTab)) {
      setActiveTab(visibleTabs[0].name);
    } else if (visibleTabs.length > 0 && !activeTab) {
      setActiveTab(visibleTabs[0].name);
    }
  }, [visibleTabs, activeTab]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type: inputType, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: inputType === 'checkbox' ? checked : value,
    }));
  }, [setFormData]);

  const handleNumericInputChange = useCallback((e) => {
    const { name, value } = e.target;
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  }, [setFormData]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    if (typeof initialFormState === 'function') {
        setFormData(initialFormState()); // Gọi hàm để lấy state khởi tạo
    }
    if (visibleTabs.length > 0) setActiveTab(visibleTabs[0].name);
  }, [setShowModal, setFormData, initialFormState, visibleTabs]);

  const handleSaveClick = () => {
    for (const tab of visibleTabs) {
      for (const field of tab.fields) {
        if (field.required && (formData[field.name] === undefined || formData[field.name] === null || String(formData[field.name]).trim() === '')) {
          // Cho phép trường checkbox 'isCompleted' không bắt buộc phải check
          if (field.type === 'checkbox' && field.name === 'isCompleted') continue;

          toast.error(`Vui lòng nhập đầy đủ thông tin cho trường "${field.label}".`, { position: "top-center" });
          setActiveTab(tab.name);
          return;
        }
      }
    }
    saveProject();
  };

  const isFieldDisabled = (field) => {
    if (isSubmitting) return true;
    if (editProject && field.name === 'approvedBy') {
        if (editProject.status === 'Đã duyệt' && user.role !== 'admin') {
            return true;
        }
    }
    // Chỉ admin mới được sửa projectCode, và chỉ khi đang edit
    if (field.name === 'projectCode') {
        if (!editProject || user.role !== 'admin') { // Nếu là tạo mới, hoặc không phải admin khi edit
            return true;
        }
    }
    return field.disabled || false;
  };

  const isSaveDisabled = isSubmitting || visibleTabs.some(tab =>
    tab.fields.some(field => {
        if (field.type === 'checkbox' && field.name === 'isCompleted') return false; // isCompleted không bắt buộc
        return field.required && (formData[field.name] === undefined || formData[field.name] === null || String(formData[field.name]).trim() === '');
    })
  );

  const getOptionsForField = (field) => {
    switch (field.optionsSource) {
      case 'allocatedUnits': return allocatedUnits.map(opt => ({ value: typeof opt === 'string' ? opt : opt.name, label: typeof opt === 'string' ? opt : opt.name }));
      case 'allocationWaves': return allocationWavesList.map(opt => ({ value: typeof opt === 'string' ? opt : opt.name, label: typeof opt === 'string' ? opt : opt.name }));
      case 'constructionUnits': return constructionUnitsList.map(opt => ({ value: typeof opt === 'string' ? opt : opt.name, label: typeof opt === 'string' ? opt : opt.name }));
      case 'users': return usersList.map(u => ({ value: u._id, label: u.fullName || u.username }));
      case 'approvers': return approversList.map(approver => ({ value: approver._id, label: approver.fullName || approver.username }));
      case 'projectTypes': return projectTypesList.map(opt => ({ value: typeof opt === 'string' ? opt : opt.name, label: typeof opt === 'string' ? opt : opt.name }));
      default: return field.options || [];
    }
  };

  if (!formConfig || !visibleTabs || visibleTabs.length === 0) return null;

  return (
    <Modal
      isOpen={showModal}
      onRequestClose={handleCloseModal}
      style={{
        overlay: {
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(3px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        },
        content: {
          position: 'relative', maxWidth: '720px', width: '90%', maxHeight: '90vh',
          overflowY: 'hidden', backgroundColor: 'var(--background)', borderRadius: '12px',
          boxShadow: 'var(--shadow)', border: '1px solid var(--border)',
          padding: '0', zIndex: 1001, inset: 'auto', display: 'flex', flexDirection: 'column',
        },
      }}
      contentLabel={editProject ? formConfig.editTitle : formConfig.addTitle}
    >
      <div className="p-6 bg-white rounded-t-lg border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">
          {editProject ? formConfig.editTitle : formConfig.addTitle}
        </h2>
      </div>

      <div className="px-6 pt-2 pb-4 border-b border-gray-200 bg-gray-50">
        <div className="flex border-b border-gray-300">
          {visibleTabs.map(tab => (
            <button
              key={tab.name} onClick={() => setActiveTab(tab.name)}
              className={`px-4 py-2 -mb-px text-sm font-medium transition-colors duration-200 ease-in-out
                ${activeTab === tab.name ? 'border-b-2 border-blue-500 text-blue-600 bg-white rounded-t-md' : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              disabled={isSubmitting}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 bg-white overflow-y-auto flex-grow">
        {visibleTabs.map(tab => activeTab === tab.name && (
          <div key={tab.name} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 animate-fadeIn">
            {tab.fields.map(field => (
              <div key={field.name} className={`${field.fullWidth ? 'sm:col-span-2' : ''} ${field.type === 'checkbox' ? 'sm:col-span-2 flex items-center' : ''}`}>
                <label htmlFor={field.name} className={`block text-sm font-medium text-gray-700 ${field.type === 'checkbox' ? 'mr-2' : 'mb-1'}`}>
                  {field.label} {field.required && field.type !== 'checkbox' && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    id={field.name} name={field.name} value={formData[field.name] || ''}
                    onChange={handleInputChange} required={field.required} disabled={isFieldDisabled(field)}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  >
                    <option value="">{field.placeholder || `Chọn ${field.label.toLowerCase()}`}</option>
                    {getOptionsForField(field).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={field.name} name={field.name} value={formData[field.name] || ''}
                    onChange={handleInputChange} required={field.required} disabled={isFieldDisabled(field)}
                    rows={field.rows || 3} placeholder={field.placeholder}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  />
                ) : field.type === 'checkbox' ? (
                  <input
                    type="checkbox" id={field.name} name={field.name}
                    checked={formData[field.name] || false}
                    onChange={handleInputChange}
                    disabled={isFieldDisabled(field)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                ) : (
                  <input
                    type={field.type || 'text'} id={field.name} name={field.name}
                    value={formData[field.name] || ''}
                    onChange={field.numeric ? handleNumericInputChange : handleInputChange}
                    required={field.required} disabled={isFieldDisabled(field)}
                    placeholder={field.placeholder}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
        <button
          type="button" onClick={handleCloseModal} disabled={isSubmitting}
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
        >
          <FaTimes className="mr-2 h-4 w-4" /> Hủy
        </button>
        <button
          type="button" onClick={handleSaveClick} disabled={isSaveDisabled}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-blue-300"
        >
          <FaSave className="mr-2 h-4 w-4" /> {isSubmitting ? 'Đang lưu...' : (editProject ? 'Cập nhật' : 'Lưu mới')}
        </button>
      </div>
    </Modal>
  );
}

export default GenericFormModal;
