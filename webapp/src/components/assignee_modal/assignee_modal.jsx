import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
// import Form from 'react-bootstrap/Form';
// import Button from '../../widget/buttons/button';
// import Select from 'react-select';
import AutocompleteSelector from '../user_selector/autocomplete_selector.tsx';
import IconButton from '../../widget/iconButton/iconButton';
import './assignee_modal.scss';
import CompassIcon from '../icons/compassIcons';
import { Button, Col, DatePicker, Form, Input, Modal, notification, Popover, Row, Select, Table } from 'antd';
import { apiRequest } from '../../api/request';
import { apiCategory } from '../../api/category';


const AssigneeModal = (
    {
        visible,
        close,
        autocompleteUsers,
        theme,
        getAssignee,
        removeAssignee,
        removeEditingTodo,
        changeAssignee,
        editingTodo,
    },  
) => {
    const [assignee, setAssignee] = useState();
    const [lstCategory, setLstCategory] = useState([]);
    const [formAdd] = Form.useForm();


    useEffect(() => {

        function handleKeypress(e) {
            if (e.key === 'Escape' && visible) {
                close();
            }
        }

        document.addEventListener('keyup', handleKeypress);

        return () => {
            document.removeEventListener('keyup', handleKeypress);
        };
    }, [visible]);

    useEffect(() => {
        getAllCategory();
    }, []);

    const getAllCategory = async () => {
        await apiCategory.getAll()
            .then((res) => {
                console.log(res.data.data);
                if (res.data.data) {
                    setLstCategory(res.data.data);
                }

            })
            .catch((err) => {
                console.log(err);
            });
    }

    const submit = useCallback(() => {

        // close();
    }, [close, changeAssignee, removeAssignee, getAssignee, assignee, removeEditingTodo, editingTodo]);

    if (!visible) {
        return null;
    }

    const closeModal = () => {
        // removeEditingTodo();
        close();
    };

    const changeAssigneeDropdown = (selected) => {
        setAssignee(selected);
    };

    const style = getStyle(theme);

    // Hàm xử lý khi thêm mới kiến nghị
    const handleAddRequest = async (values) => {
        console.log(values);
        const { title, content, createDate, priority, category } = values;
        const newRequest = {
            // key: (lstRequest.length + 1).toString(),
            title,
            content,
            createdDate: new Date(),
            priority: parseInt(priority),
            categoryId: category,
            // statusRequest: 'Đã tạo'
        }

        console.log(newRequest);

        await apiRequest.create(newRequest)
            .then((res) => {
                console.log(res.data);
                if (res.data.message !== 'Tạo request thành công') {
                    notification.error({
                        message: 'Thêm mới thất bại!',
                        description: res.data.message,
                        duration: 3,
                    });
                }
                else {
                    notification.success({
                        message: 'Thêm mới thành công!',
                        description: 'Thêm mới kiến nghị thành công!',
                        duration: 3,
                    });
                    formAdd.resetFields();
                    // getAllRequest();
                }
            })
            .catch((err) => {
                console.log(err);
            });

        formAdd.resetFields();
    }

    // const getAllRequest = async () => {
    //     await apiRequest.getAll()
    //         .then((res) => {
    //             console.log(res.data.data);
    //             const data = res.data.data.map((item, index) => {
    //                 console.log(item.category.description);
    //                 return {
    //                     id: item._id,
    //                     key: (index + 1).toString(),
    //                     title: item.title,
    //                     content: item.content,
    //                     createDate: moment(item.createdDate).format('DD/MM/YYYY'),
    //                     priority: item.priority,
    //                     category: item.category.description,
    //                     categoryId: item.category._id,
    //                     statusRequest: item.status,
    //                     people: item.people,
    //                     process: item.processes,
    //                 }
    //             });
    //             console.log(data);

    //             // setLstRequest(data);
    //         })
    //         .catch((err) => {
    //             console.log(err);
    //         });
    // }

    return (
        // <div
        //     style={style.backdrop}
        // >
        //     <div style={style.modal}>
        //         <h1 style={style.heading}>Thêm kiến nghị</h1>
        //         <IconButton
        //             size='medium'
        //             style={style.closeIcon}
        //             onClick={closeModal}
        //             icon={<CompassIcon icon='close' />}
        //         />
        //         <Form>
        //             <Form.Group className="mb-3" controlId="title">
        //                 <Form.Label>Tiêu đề</Form.Label>
        //                 <Form.Control type="text" placeholder="Nhập tiêu đề" />
        //             </Form.Group>

        //             <Form.Group className="mb-3" controlId="content">
        //                 <Form.Label>Nội dung</Form.Label>
        //                 <Form.Control as="textarea" rows={3} placeholder="Nhập nội dung" />
        //             </Form.Group>

        //             <Form.Group className="mb-3" controlId="field">
        //                 <Form.Label>Lĩnh vực</Form.Label>
        //                 <Select
        //                     placeholder="Chọn lĩnh vực"
        //                     options={lstCategory.map((item) => {
        //                         return {
        //                             value: item._id,
        //                             label: item.description
        //                         }
        //                     })}
        //                     styles={{
        //                         control: (base, state) => ({
        //                             ...base,
        //                             borderColor: state.isFocused ? '#192a4d' : base.borderColor,
        //                             // boxShadow: state.isFocused ? '0 0 0 1px blue' : null,
        //                             '&:hover': {
        //                                 borderColor: state.isFocused ? '#192a4d' : base.borderColor
        //                             }
        //                         })
        //                     }}
        //                 />
        //             </Form.Group>

        //             <Form.Group className="mb-3" controlId="priority">
        //                 <Form.Label>Độ ưu tiên</Form.Label>
        //                 <Select
        //                     placeholder="Chọn độ ưu tiên"
        //                     options={[
        //                         { value: '1', label: '1' },
        //                         { value: '2', label: '2' },
        //                         { value: '3', label: '3' }
        //                     ]}
        //                     styles={{
        //                         control: (base, state) => ({
        //                             ...base,
        //                             borderColor: state.isFocused ? '#192a4d' : base.borderColor,
        //                             // boxShadow: state.isFocused ? '0 0 0 1px blue' : null,
        //                             '&:hover': {
        //                                 borderColor: state.isFocused ? '#192a4d' : base.borderColor
        //                             }
        //                         })
        //                     }}
        //                 />
        //             </Form.Group>
        //         </Form>
        //         <div
        //             className='todoplugin-button-container'
        //             style={style.buttons}
        //         >
        //             <Button
        //                 emphasis='tertiary'
        //                 size='medium'
        //                 onClick={closeModal}
        //             >
        //                 {'Hủy'}
        //             </Button>
        //             <Button
        //                 emphasis='primary'
        //                 size='medium'
        //                 onClick={submit}
        //                 disabled={!assignee}
        //             >
        //                 {'Tạo mới'}
        //             </Button>
        //         </div>
        //     </div>
        // </div>
        <Modal
            title="Thêm kiến nghị"
            visible={visible}
            onOk={formAdd.submit}
            onCancel={closeModal}
            okText='Lưu'
            cancelText='Hủy'
        >
            <Form
                name="editForm"
                layout='vertical'
                className='form-edit'
                form={formAdd}
                onFinish={handleAddRequest}
            >
                <Form.Item
                    label="Tiêu đề"
                    name="title"
                    className='form-item'
                    rules={[
                        {
                            required: true,
                            message: "Vui lòng nhập tiêu đề!"
                        }
                    ]}
                >
                    <Input placeholder='Nhập tiêu đề' />
                </Form.Item>

                <Form.Item
                    label="Nội dung"
                    name="content"
                    className='form-item'
                    rules={[
                        {
                            required: true,
                            message: "Vui lòng nhập nội dung!"
                        }
                    ]}
                >
                    <Input.TextArea placeholder='Nhập nội dung'
                        autoSize={{ minRows: 5, maxRows: 500 }}
                    />
                </Form.Item>


                <Form.Item
                    label="Độ ưu tiên"
                    name="priority"
                    className='form-item'
                    rules={[
                        {
                            required: true,
                            message: "Vui lòng chọn độ ưu tiên!"
                        }
                    ]}
                >
                    <Select placeholder='Chọn độ ưu tiên'>
                        <Select.Option value="1">1</Select.Option>
                        <Select.Option value="2">2</Select.Option>
                        <Select.Option value="3">3</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    label="Lĩnh vực"
                    name="category"
                    className='form-item'
                    rules={[
                        {
                            required: true,
                            message: "Vui lòng chọn lĩnh vực!"
                        }
                    ]}
                >
                    <Select placeholder='Chọn lĩnh vực' >
                        {lstCategory.map((item, index) => {
                            return (
                                <Select.Option key={index} value={item._id}>{item.description}</Select.Option>
                            )
                        })}
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
};

AssigneeModal.propTypes = {
    visible: PropTypes.bool.isRequired,
    close: PropTypes.func.isRequired,
    theme: PropTypes.object.isRequired,
    autocompleteUsers: PropTypes.func.isRequired,
    getAssignee: PropTypes.func.isRequired,
    editingTodo: PropTypes.string.isRequired,
    removeAssignee: PropTypes.func.isRequired,
    removeEditingTodo: PropTypes.func.isRequired,
    changeAssignee: PropTypes.func.isRequired,
};

const getStyle = (theme) => ({
    backdrop: {
        position: 'absolute',
        display: 'flex',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.50)',
        zIndex: 2000,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modal: {
        position: 'relative',
        width: 600,
        padding: 24,
        borderRadius: 8,
        maxWidth: '100%',
        color: theme.centerChannelColor,
        backgroundColor: theme.centerChannelBg,
    },
    buttons: {
        marginTop: 24,
    },
    heading: {
        fontSize: 20,
        fontWeight: 600,
        margin: '0 0 24px 0',
    },
    closeIcon: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
});

export default AssigneeModal;
