// frontend/src/components/ProjectForm.js
import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { FaCheckCircle, FaCalendarAlt, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify'; // << ----- ĐÃ THÊM DÒNG NÀY

function ProjectForm({
  showModal,
  setShowModal,
  isSubmitting,
  // isLoading không cần thiết trực tiếp ở đây
  editProject,
  newProject: initialProjectData, // Đổi tên để tránh nhầm lẫn với state nội bộ nếu có
  handleInputChange: onInputChange, // Đổi tên prop
  handleNumericInputChange: onNumericInputChange, // Đổi tên prop
  saveProject,
  user,
  isCategory,
  allocatedUnits,
  allocationWavesList,
  constructionUnitsList,
  initialNewProjectState, // Cần thiết để reset
  setNewProject: setParentProjectState, // Cần để reset form từ modal
}) {
  // State nội bộ cho form để dễ quản lý validation và reset
  const [formData, setFormData] = useState(initialProjectData);
  const [activeFormTab, setActiveFormTab] = useState('basic');
  const [formErrors, setFormErrors] = useState({}); // Dùng object để map lỗi với field

  // Cập nhật state nội bộ khi prop initialProjectData thay đổi (khi mở modal edit)
  useEffect(() => {
    setFormData(initialProjectData);
    setFormErrors({}); // Reset lỗi khi mở modal hoặc đổi project
    setActiveFormTab('basic'); // Reset tab khi mở modal
  }, [initialProjectData]);

  // Hàm xử lý input nội bộ, gọi prop để cập nhật state cha
  const handleLocalInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: newValue }));
    onInputChange(e); // Gọi hàm từ cha để cập nhật state ở ProjectManagement
    // Xóa lỗi của trường này khi người dùng bắt đầu nhập lại
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

   // Hàm xử lý input số nội bộ, gọi prop để cập nhật state cha
  const handleLocalNumericInputChange = (e) => {
    const { name, value } = e.target;
     // Chỉ cho phép số hoặc chuỗi rỗng hoặc dấu chấm (cho số thập phân)
     if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
        setFormData(prev => ({ ...prev, [name]: value }));
        onNumericInputChange(e); // Gọi hàm từ cha
        // Xóa lỗi của trường này khi người dùng bắt đầu nhập lại
        if (formErrors[name]) {
          setFormErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
          });
        }
     }
  };

  // --- Validation Logic ---
  const validateForm = () => {
    const errors = {};
    const projectDataForValidation = { ...formData }; // Validate state nội bộ

    // --- Validation chung ---
    if (!projectDataForValidation.name?.trim()) errors.name = 'Tên công trình là bắt buộc.';
    if (!projectDataForValidation.allocatedUnit?.trim()) errors.allocatedUnit = 'Chi nhánh là bắt buộc.';

    // --- Validation cho Category Project ---
    if (isCategory) {
       if (!projectDataForValidation.scale?.trim()) errors.scale = 'Quy mô là bắt buộc.'; // Ví dụ thêm validation

      if (projectDataForValidation.initialValue && parseFloat(projectDataForValidation.initialValue) < 0) {
        errors.initialValue = 'Giá trị phân bổ không được âm.';
      }
      if (projectDataForValidation.durationDays && parseInt(projectDataForValidation.durationDays, 10) < 0) {
        errors.durationDays = 'Số ngày thực hiện không được âm.';
      }
      if (projectDataForValidation.contractValue && parseFloat(projectDataForValidation.contractValue) < 0) {
        errors.contractValue = 'Giá trị giao khoán không được âm.';
      }
      if (projectDataForValidation.startDate && projectDataForValidation.completionDate) {
        if (new Date(projectDataForValidation.startDate) > new Date(projectDataForValidation.completionDate)) {
          errors.completionDate = 'Ngày hoàn thành không được trước ngày bắt đầu.';
        }
      }
    }
    // --- Validation cho Minor Repair Project ---
    else {
      if (projectDataForValidation.paymentValue && parseFloat(projectDataForValidation.paymentValue) < 0) {
        errors.paymentValue = 'Giá trị thanh toán không được âm.';
      }
       // Thêm validation khác nếu cần cho SCN
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0; // Trả về true nếu không có lỗi
  };
  // -------------------------

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      saveProject(); // Gọi hàm save từ cha (hàm này sẽ dùng state ở ProjectManagement đã được cập nhật)
    } else {
       // Tìm tab đầu tiên có lỗi và chuyển đến tab đó
        const firstErrorField = Object.keys(formErrors)[0];
        // Logic map field lỗi với tab (cần bổ sung nếu muốn tự động chuyển tab)
        // Ví dụ đơn giản:
        if (['name', 'allocatedUnit', 'scale', 'location', 'initialValue'].includes(firstErrorField)) {
           setActiveFormTab('basic');
        } else if (['allocationWave', 'estimator', 'supervisor', 'durationDays', 'startDate', 'completionDate', 'taskDescription'].includes(firstErrorField) && isCategory) {
           setActiveFormTab('assign');
        } else if (['contractValue', 'constructionUnit', 'progress', 'feasibility', 'notes'].includes(firstErrorField) && isCategory) {
            setActiveFormTab('progress');
        }
       toast.warn('Vui lòng kiểm tra lại các trường có lỗi.', { position: "top-center" });
    }
  };

  // Hàm đóng và reset modal
  const closeModalAndReset = () => {
    if (!isSubmitting) {
       setParentProjectState(initialNewProjectState()); // Reset state ở cha về trạng thái gốc
       setFormData(initialNewProjectState()); // Reset state nội bộ
       setFormErrors({});
       setActiveFormTab('basic');
       setShowModal(false);
    }
  };


  return (
    <Modal
      isOpen={showModal}
      onRequestClose={closeModalAndReset} // Gọi hàm reset khi đóng
      contentLabel={editProject ? 'Sửa Công trình' : 'Thêm Công trình'}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-4xl w-[95%] md:w-[90%] lg:w-4/5 max-h-[90vh] flex flex-col animate-slideIn focus:outline-none border border-gray-200 dark:border-gray-700" // Tăng width, max-height và flex col
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[1040]" // Đảm bảo z-index thấp hơn loading overlay
      shouldCloseOnOverlayClick={!isSubmitting}
    >
      {/* Header Modal */}
      <div className="flex justify-between items-center pb-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
            {editProject ? 'Sửa thông tin Công trình' : 'Đăng ký Công trình mới'}
          </h2>
          <button onClick={closeModalAndReset} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" disabled={isSubmitting}>
              <FaTimes size={20}/>
          </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
        {/* Tabs cho Category Project */}
        {isCategory && (
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 bg-gray-50 dark:bg-gray-700 rounded-t-xl overflow-x-auto custom-scrollbar">
            {['basic', 'assign', 'progress'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveFormTab(tab)}
                className={`form-tab ${activeFormTab === tab ? 'form-tab-active' : 'form-tab-inactive'}`}
                disabled={isSubmitting}
              >
                {tab === 'basic' ? 'Thông tin cơ bản' : tab === 'assign' ? 'Phân công & HS' : 'Thi công & Ghi chú'}
              </button>
            ))}
          </div>
        )}

        {/* Form Fields Container (Scrollable) */}
        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-6 pb-4">
          {/* --- Tab Basic (Category) hoặc Toàn bộ Form (Minor Repair) --- */}
          {(activeFormTab === 'basic' || !isCategory) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                {/* STT (Chỉ cho Minor Repair và khi Edit) */}
               {!isCategory && editProject && (
                 <div>
                   <label className="form-label">STT</label>
                   <input type="text" value={formData.serial || ''} readOnly className="form-input"/>
                 </div>
               )}

                {/* Tên Công trình */}
                <div className={isCategory ? "sm:col-span-2" : (editProject ? "" : "sm:col-span-2")}>
                  <label htmlFor={isCategory ? "cat_name" : "scn_name"} className="form-label">
                    {isCategory ? 'Tên danh mục' : 'Tên công trình sửa chữa'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={isCategory ? "cat_name" : "scn_name"}
                    name="name"
                    type="text"
                    placeholder={isCategory ? "VD: Xây dựng tuyến ống ABC" : "VD: Sửa chữa bể ống tại..."}
                    value={formData.name || ''}
                    onChange={handleLocalInputChange}
                    className={`form-input ${formErrors.name ? 'border-red-500' : ''}`}
                    disabled={isSubmitting}
                  />
                   {formErrors.name && <p className="form-error">{formErrors.name}</p>}
                </div>

                {/* Quy mô (Chỉ Category) */}
                 {isCategory && (
                    <div className="sm:col-span-2">
                         <label htmlFor="cat_scale" className="form-label">
                         Quy mô <span className="text-red-500">*</span>
                         </label>
                         <input
                         id="cat_scale"
                         name="scale"
                         type="text"
                         placeholder="VD: D100, L=500m"
                         value={formData.scale || ''}
                         onChange={handleLocalInputChange}
                         className={`form-input ${formErrors.scale ? 'border-red-500' : ''}`}
                         disabled={isSubmitting}
                         />
                         {formErrors.scale && <p className="form-error">{formErrors.scale}</p>}
                     </div>
                 )}


                {/* Chi nhánh */}
                <div>
                  <label htmlFor={isCategory ? "cat_allocatedUnit" : "scn_allocatedUnit"} className="form-label">
                    {isCategory ? 'Công trình tại Chi nhánh' : 'Chi nhánh thực hiện'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id={isCategory ? "cat_allocatedUnit" : "scn_allocatedUnit"}
                    name="allocatedUnit"
                    value={formData.allocatedUnit || ''}
                    onChange={handleLocalInputChange}
                    className={`form-select ${formErrors.allocatedUnit ? 'border-red-500' : ''}`}
                    disabled={isSubmitting}
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {allocatedUnits.map((unit) => (
                      <option key={unit._id} value={unit.name}>{unit.name}</option>
                    ))}
                  </select>
                   {formErrors.allocatedUnit && <p className="form-error">{formErrors.allocatedUnit}</p>}
                </div>

                {/* Loại Công trình (Chỉ Category) */}
                {isCategory && (
                    <div>
                       <label className="form-label">Loại công trình</label>
                       <input type="text" value="Danh mục" readOnly className="form-input" />
                    </div>
                 )}

                 {/* Địa điểm XD (Chỉ Category) */}
                {isCategory && (
                    <div className="sm:col-span-2">
                       <label htmlFor="cat_location" className="form-label">Địa điểm XD</label>
                       <input
                         id="cat_location"
                         name="location"
                         type="text"
                         placeholder="VD: Đường XYZ, Phường A, Quận B"
                         value={formData.location || ''}
                         onChange={handleLocalInputChange}
                         className="form-input"
                         disabled={isSubmitting}
                       />
                       {/* Không cần validation bắt buộc ở đây */}
                    </div>
                 )}

                {/* Giá trị phân bổ (Chỉ Category) */}
                {isCategory && (
                    <div>
                       <label htmlFor="cat_initialValue" className="form-label">Giá trị phân bổ (Triệu đồng)</label>
                       <input
                         id="cat_initialValue"
                         name="initialValue"
                         type="text" // Dùng text để cho phép nhập dấu chấm dễ hơn
                         inputMode="decimal" // Gợi ý bàn phím số trên mobile
                         placeholder="0"
                         value={formData.initialValue || ''}
                         onChange={handleLocalNumericInputChange} // Dùng hàm xử lý số
                         className={`form-input ${formErrors.initialValue ? 'border-red-500' : ''}`}
                         disabled={isSubmitting}
                       />
                        {formErrors.initialValue && <p className="form-error">{formErrors.initialValue}</p>}
                    </div>
                 )}

                 {/* Người nhập (Hiển thị, không cho sửa) */}
                 <div>
                    <label className="form-label">Người nhập</label>
                    <input
                        type="text"
                        value={editProject ? editProject.enteredBy : user?.username || ''}
                        readOnly
                        className="form-input"
                     />
                 </div>

                  {/* === Các trường của Sửa chữa nhỏ === */}
                  {!isCategory && (
                    <>
                      {/* NV theo dõi (SCN) */}
                       <div>
                         <label htmlFor="scn_supervisor" className="form-label">NV theo dõi</label>
                         <input
                           id="scn_supervisor"
                           name="supervisor"
                           type="text"
                           placeholder="Tên nhân viên"
                           value={formData.supervisor || ''}
                           onChange={handleLocalInputChange}
                           className="form-input"
                           disabled={isSubmitting}
                         />
                       </div>
                       {/* Ngày báo cáo (SCN) */}
                       <div className="input-with-icon">
                         <label htmlFor="scn_reportDate" className="form-label">Ngày báo cáo</label>
                         <input
                           id="scn_reportDate"
                           name="reportDate"
                           type="date"
                           value={formData.reportDate || ''}
                           onChange={handleLocalInputChange}
                           className="form-input pl-10" // Đảm bảo padding tồn tại
                           disabled={isSubmitting}
                         />
                         <FaCalendarAlt className="input-icon" />
                       </div>
                       {/* Ngày kiểm tra (SCN) */}
                       <div className="input-with-icon">
                         <label htmlFor="scn_inspectionDate" className="form-label">Ngày kiểm tra</label>
                         <input
                           id="scn_inspectionDate"
                           name="inspectionDate"
                           type="date"
                           value={formData.inspectionDate || ''}
                           onChange={handleLocalInputChange}
                           className="form-input pl-10"
                           disabled={isSubmitting}
                         />
                         <FaCalendarAlt className="input-icon" />
                       </div>
                       {/* Nội dung thực hiện (SCN) */}
                       <div className="sm:col-span-2">
                         <label htmlFor="scn_taskDescription" className="form-label">Nội dung thực hiện</label>
                         <textarea
                           id="scn_taskDescription"
                           name="taskDescription"
                           placeholder="Mô tả công việc sửa chữa"
                           value={formData.taskDescription || ''}
                           onChange={handleLocalInputChange}
                           className="form-textarea"
                           disabled={isSubmitting}
                           rows="3"
                         />
                       </div>
                       {/* Ngày thanh toán (SCN) */}
                       <div className="input-with-icon">
                         <label htmlFor="scn_paymentDate" className="form-label">Ngày thanh toán</label>
                         <input
                           id="scn_paymentDate"
                           name="paymentDate"
                           type="date"
                           value={formData.paymentDate || ''}
                           onChange={handleLocalInputChange}
                           className="form-input pl-10"
                           disabled={isSubmitting}
                         />
                         <FaCalendarAlt className="input-icon" />
                       </div>
                       {/* Giá trị thanh toán (SCN) */}
                       <div>
                         <label htmlFor="scn_paymentValue" className="form-label">Giá trị thanh toán (Triệu đồng)</label>
                         <input
                           id="scn_paymentValue"
                           name="paymentValue"
                           type="text"
                           inputMode="decimal"
                           placeholder="0"
                           value={formData.paymentValue || ''}
                           onChange={handleLocalNumericInputChange}
                           className={`form-input ${formErrors.paymentValue ? 'border-red-500' : ''}`}
                           disabled={isSubmitting}
                         />
                          {formErrors.paymentValue && <p className="form-error">{formErrors.paymentValue}</p>}
                       </div>
                       {/* Ghi chú (SCN) */}
                       <div className="sm:col-span-2">
                         <label htmlFor="scn_notes" className="form-label">Ghi chú</label>
                         <textarea
                           id="scn_notes"
                           name="notes"
                           placeholder="Các thông tin ghi chú khác"
                           value={formData.notes || ''}
                           onChange={handleLocalInputChange}
                           className="form-textarea"
                           disabled={isSubmitting}
                           rows="3"
                         />
                       </div>
                    </>
                  )}
                  {/* --- Kết thúc các trường SCN --- */}

            </div>
          )}
          {/* --- End Tab Basic / Form SCN --- */}


           {/* --- Tab Assign (Chỉ Category) --- */}
          {isCategory && activeFormTab === 'assign' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {/* Phân bổ đợt */}
              <div>
                <label htmlFor="cat_allocationWave" className="form-label">Phân bổ đợt</label>
                <select
                  id="cat_allocationWave"
                  name="allocationWave"
                  value={formData.allocationWave || ''}
                  onChange={handleLocalInputChange}
                  className="form-select"
                  disabled={isSubmitting}
                >
                  <option value="">-- Chọn đợt --</option>
                  {allocationWavesList.map((wave) => (<option key={wave._id} value={wave.name}>{wave.name}</option>))}
                </select>
              </div>
              {/* NV lập HS dự toán */}
              <div>
                <label htmlFor="cat_estimator" className="form-label">NV lập HS dự toán</label>
                <input
                  id="cat_estimator"
                  name="estimator"
                  type="text"
                  placeholder="Tên nhân viên"
                  value={formData.estimator || ''}
                  onChange={handleLocalInputChange}
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>
              {/* LĐ theo dõi */}
              <div>
                <label htmlFor="cat_supervisor" className="form-label">LĐ theo dõi</label>
                <input
                  id="cat_supervisor"
                  name="supervisor"
                  type="text"
                  placeholder="Tên lãnh đạo"
                  value={formData.supervisor || ''}
                  onChange={handleLocalInputChange}
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>
              {/* Số ngày thực hiện HS */}
              <div>
                <label htmlFor="cat_durationDays" className="form-label">Số ngày thực hiện HS</label>
                <input
                  id="cat_durationDays"
                  name="durationDays"
                  type="text" // Để text cho dễ nhập
                   inputMode="numeric" // Gợi ý bàn phím số
                  placeholder="0"
                  value={formData.durationDays || ''}
                  onChange={(e) => { // Chỉ cho nhập số nguyên
                       if (e.target.value === '' || /^[0-9]+$/.test(e.target.value)) {
                          handleLocalInputChange(e);
                       }
                  }}
                  className={`form-input ${formErrors.durationDays ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                />
                 {formErrors.durationDays && <p className="form-error">{formErrors.durationDays}</p>}
              </div>
              {/* Ngày bắt đầu lập HS */}
              <div className="input-with-icon">
                <label htmlFor="cat_startDate" className="form-label">Ngày bắt đầu lập HS</label>
                <input
                  id="cat_startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate || ''}
                  onChange={handleLocalInputChange}
                  className="form-input pl-10"
                  disabled={isSubmitting}
                />
                <FaCalendarAlt className="input-icon" />
              </div>
              {/* Ngày hoàn thành HS */}
              <div className="input-with-icon">
                <label htmlFor="cat_completionDate" className="form-label">Ngày hoàn thành HS</label>
                <input
                  id="cat_completionDate"
                  name="completionDate"
                  type="date"
                  value={formData.completionDate || ''}
                  onChange={handleLocalInputChange}
                  className={`form-input pl-10 ${formErrors.completionDate ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                />
                <FaCalendarAlt className="input-icon" />
                 {formErrors.completionDate && <p className="form-error">{formErrors.completionDate}</p>}
              </div>
              {/* Nội dung giao việc (HS) */}
              <div className="sm:col-span-2">
                <label htmlFor="cat_taskDescription" className="form-label">Nội dung giao việc (HS)</label>
                <textarea
                  id="cat_taskDescription"
                  name="taskDescription"
                  placeholder="Mô tả công việc liên quan đến hồ sơ"
                  value={formData.taskDescription || ''}
                  onChange={handleLocalInputChange}
                  className="form-textarea"
                  disabled={isSubmitting}
                  rows="3"
                />
              </div>
            </div>
          )}
          {/* --- End Tab Assign --- */}


          {/* --- Tab Progress (Chỉ Category) --- */}
          {isCategory && activeFormTab === 'progress' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
               {/* Giá trị giao khoán */}
               <div>
                 <label htmlFor="cat_contractValue" className="form-label">Giá trị giao khoán (Triệu đồng)</label>
                 <input
                   id="cat_contractValue"
                   name="contractValue"
                   type="text"
                   inputMode="decimal"
                   placeholder="0"
                   value={formData.contractValue || ''}
                   onChange={handleLocalNumericInputChange}
                   className={`form-input ${formErrors.contractValue ? 'border-red-500' : ''}`}
                   disabled={isSubmitting}
                 />
                  {formErrors.contractValue && <p className="form-error">{formErrors.contractValue}</p>}
               </div>
               {/* Đơn vị thi công */}
               <div>
                 <label htmlFor="cat_constructionUnit" className="form-label">Đơn vị thi công</label>
                 <select
                   id="cat_constructionUnit"
                   name="constructionUnit"
                   value={formData.constructionUnit || ''}
                   onChange={handleLocalInputChange}
                   className="form-select"
                   disabled={isSubmitting}
                 >
                   <option value="">-- Chọn ĐVTC --</option>
                   {constructionUnitsList.map((unit) => (<option key={unit._id} value={unit.name}>{unit.name}</option>))}
                 </select>
               </div>
               {/* Tiến độ thi công */}
               <div className="sm:col-span-2">
                 <label htmlFor="cat_progress" className="form-label">Tiến độ thi công</label>
                 <textarea
                   id="cat_progress"
                   name="progress"
                   placeholder="Cập nhật tiến độ thi công"
                   value={formData.progress || ''}
                   onChange={handleLocalInputChange}
                   className="form-textarea"
                   disabled={isSubmitting}
                   rows="3"
                 />
               </div>
               {/* Khả năng thực hiện */}
               <div className="sm:col-span-2">
                 <label htmlFor="cat_feasibility" className="form-label">Khả năng thực hiện</label>
                 <textarea
                   id="cat_feasibility"
                   name="feasibility"
                   placeholder="Đánh giá khả năng thực hiện"
                   value={formData.feasibility || ''}
                   onChange={handleLocalInputChange}
                   className="form-textarea"
                   disabled={isSubmitting}
                   rows="3"
                 />
               </div>
               {/* Ghi chú chung */}
               <div className="sm:col-span-2">
                 <label htmlFor="cat_notes" className="form-label">Ghi chú chung</label>
                 <textarea
                   id="cat_notes"
                   name="notes"
                   placeholder="Các thông tin ghi chú khác"
                   value={formData.notes || ''}
                   onChange={handleLocalInputChange}
                   className="form-textarea"
                   disabled={isSubmitting}
                   rows="3"
                 />
               </div>
             </div>
           )}
           {/* --- End Tab Progress --- */}

        </div>
        {/* End Form Fields Container */}

        {/* Form Actions */}
        <div className="mt-auto pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center sm:justify-end gap-x-4 gap-y-3">
          <button
            type="submit"
            className="form-btn form-btn-primary w-full sm:w-auto"
            disabled={isSubmitting || (editProject && !user?.permissions?.edit) || (!editProject && !user?.permissions?.add) } // Logic disable dựa trên quyền
          >
            <FaCheckCircle size={16} />
            {editProject
              ? (editProject.status === 'Đã duyệt' && user?.permissions?.edit && !user?.permissions?.approve ? 'Gửi YC Sửa' : 'Cập nhật')
              : 'Đăng ký'}
          </button>
          <button
            type="button"
            onClick={closeModalAndReset}
            className="form-btn form-btn-secondary w-full sm:w-auto"
            disabled={isSubmitting}
          >
            Hủy
          </button>
        </div>
      </form>
      {/* End Form */}
    </Modal>
  );
}

export default ProjectForm;