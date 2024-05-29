import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { makeStyleFromTheme, changeOpacity } from 'mattermost-redux/utils/theme_utils';

import TextareaAutosize from 'react-textarea-autosize';

import FullScreenModal from '../modals/modals.jsx';
import Button from '../../widget/buttons/button';
import Chip from '../../widget/chip/chip';
import AutocompleteSelector from '../user_selector/autocomplete_selector.tsx';
import './add_issue.scss';
import CompassIcon from '../icons/compassIcons';
import { getProfilePicture } from '../../utils';
import { Col, DatePicker, Form, Input, Modal, notification, Popover, Row, Select, Table } from 'antd';
import { apiRequest } from '../../api/request';
import { apiCategory } from '../../api/category';

const PostUtils = window.PostUtils;

const AddIssue = (props) => {
    const {
        visible,
        message: propMessage,
        postID,
        assignee,
        closeAddBox,
        submit,
        theme,
        autocompleteUsers,
        openAssigneeModal,
        removeAssignee,
    } = props;

    const [message, setMessage] = useState(propMessage || '');
    const [description, setDescription] = useState('');
    const [sendTo, setSendTo] = useState(null);
    const [attachToThread, setAttachToThread] = useState(false);
    const [previewMarkdown, setPreviewMarkdown] = useState(false);
    const [assigneeModal, setAssigneeModal] = useState(false);
    const [lstCategory, setLstCategory] = useState([]);

    const [formAdd] = Form.useForm();

    useEffect(() => {
        if (visible && !message && propMessage !== message) {
            setMessage(propMessage);
        }
        if (!visible && (message || sendTo)) {
            setMessage('');
            setSendTo(null);
            setAttachToThread(false);
            setPreviewMarkdown(false);
        }
    }, [visible, propMessage, message, sendTo]);

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
    const handleAttachChange = (e) => {
        setAttachToThread(e.target.checked);
    };

    const close = () => {
        removeAssignee();
        closeAddBox();
    };

    const handleSubmit = async (values) => {
        console.log('submit');
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
    };

    const toggleAssigneeModal = (value) => {
        setAssigneeModal(value);
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            handleSubmit();
        }

        if (e.key === 'Escape') {
            close();
        }
    };

    if (!visible) {
        return null;
    }

    const style = getStyle(theme);

    return (
        <Modal
            title="Thêm kiến nghị"
            visible={visible}
            onOk={formAdd.submit}
            onCancel={closeAddBox}
            okText='Lưu'
            cancelText='Hủy'
        >
            <Form
                name="editForm"
                layout='vertical'
                className='form-edit'
                form={formAdd}
                onFinish={handleSubmit}
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
                    <Select placeholder='Chọn lĩnh vực'>
                        {lstCategory.map((item, index) => (
                            <Select.Option key={index} value={item._id}>
                                {item.description}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
};

AddIssue.propTypes = {
    visible: PropTypes.bool.isRequired,
    message: PropTypes.string.isRequired,
    postID: PropTypes.string.isRequired,
    assignee: PropTypes.object,
    closeAddBox: PropTypes.func.isRequired,
    submit: PropTypes.func.isRequired,
    theme: PropTypes.object.isRequired,
    autocompleteUsers: PropTypes.func.isRequired,
    openAssigneeModal: PropTypes.func.isRequired,
    removeAssignee: PropTypes.func.isRequired,
};

const getStyle = makeStyleFromTheme((theme) => {
    return {
        modal: {
            color: changeOpacity(theme.centerChannelColor, 0.88),
        },
        textarea: {
            backgroundColor: theme.centerChannelBg,
        },
        helpText: {
            color: changeOpacity(theme.centerChannelColor, 0.64),
        },
        button: {
            color: theme.buttonColor,
            backgroundColor: theme.buttonBg,
            marginRight: 4,
            fontSize: 11,
            height: 24,
            padding: '0 10px',
        },
        inactiveButton: {
            color: changeOpacity(theme.buttonColor, 0.88),
            backgroundColor: changeOpacity(theme.buttonBg, 0.32),
        },
        markdown: {
            minHeight: '149px',
            fontSize: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'end',
        },
        assigneeImage: {
            width: 12,
            height: 12,
            marginRight: 6,
            borderRadius: 12,
        },
        assigneeContainer: {
            borderRadius: 50,
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.08),
            height: 24,
            padding: '4px 10px',
            fontWeight: 600,
            alignItems: 'center',
            justifyContent: 'center',
            display: 'inline-flex',
            border: 0,
        },
        buttons: {
            marginTop: 16,
        },
        chipsContainer: {
            marginTop: 8,
        },
        textareaResizeMessage: {
            border: 0,
            padding: 0,
            fontSize: 14,
            width: '100%',
            backgroundColor: 'transparent',
            resize: 'none',
            boxShadow: 'none',
        },
        textareaResizeDescription: {
            fontSize: 12,
            color: changeOpacity(theme.centerChannelColor, 0.72),
            marginTop: 1,
            border: 0,
            padding: 0,
            width: '100%',
            backgroundColor: 'transparent',
            resize: 'none',
            boxShadow: 'none',
        },
    };
});

export default AddIssue;
