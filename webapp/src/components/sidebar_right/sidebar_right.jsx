// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import Scrollbars from 'react-custom-scrollbars';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
// import Form from 'react-bootstrap/Form';
// import Modal from 'react-bootstrap/Modal';
import AddIssue from '../add_issue';
import Button from '../../widget/buttons/button';
import TodoToast from '../../widget/todo_toast';
import CompassIcon from '../icons/compassIcons';

import Menu from '../../widget/menu';
import MenuItem from '../../widget/menuItem';
import MenuWrapper from '../../widget/menuWrapper';


import { isKeyPressed } from '../../utils.js';
import Constants from '../../constants';
import { Col, DatePicker, Form, Input, Modal, notification, Popover, Row, Select, Table } from 'antd';
import { apiRequest } from '../../api/request';
import { apiCategory } from '../../api/category';
import './sidebar_right.scss';
import ToDoIssues from '../todo_issues';
import ToDoEditor from '../todo_editor';
import ToDoSynthetic from '../todo_synthetic';
import ToDoUpdate from '../todo_update';

export function renderView(props) {
    return (
        <div
            {...props}
            className='scrollbar--view'
        />);
}

export function renderThumbHorizontal(props) {
    return (
        <div
            {...props}
            className='scrollbar--horizontal'
        />);
}

export function renderThumbVertical(props) {
    return (
        <div
            {...props}
            className='scrollbar--vertical'
        />);
}

const Home = 'home';
const Editor = 'editor';
const Synthetic = 'synthetic';
const Update = 'update';
const Approve = 'approve';


export default class SidebarRight extends React.PureComponent {
    static propTypes = {
        todos: PropTypes.arrayOf(PropTypes.object),
        inTodos: PropTypes.arrayOf(PropTypes.object),
        outTodos: PropTypes.arrayOf(PropTypes.object),
        todoToast: PropTypes.object,
        theme: PropTypes.object.isRequired,
        siteURL: PropTypes.string.isRequired,
        rhsState: PropTypes.string,
        actions: PropTypes.shape({
            remove: PropTypes.func.isRequired,
            complete: PropTypes.func.isRequired,
            accept: PropTypes.func.isRequired,
            bump: PropTypes.func.isRequired,
            list: PropTypes.func.isRequired,
            openAddCard: PropTypes.func.isRequired,
            closeAddCard: PropTypes.func.isRequired,
            openAssigneeModal: PropTypes.func.isRequired,
            setVisible: PropTypes.func.isRequired,
            telemetry: PropTypes.func.isRequired,
        }).isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            list: props.rhsState || Home,
            showInbox: true,
            showMy: true,
            addTodo: false,
            isOpenAddModal: false,
            lstCategory: [],
            numberCallApi: 0,
        };
    }

    openList(listName) {
        if (this.state.list !== listName) {
            this.setState({ list: listName });
        }
    }

    toggleInbox() {
        this.props.actions.telemetry('toggle_inbox', { action: this.state.showInbox ? 'collapse' : 'expand' });
        this.setState({ showInbox: !this.state.showInbox });
    }

    toggleMy() {
        this.props.actions.telemetry('toggle_my', { action: this.state.showMy ? 'collapse' : 'expand' });
        this.setState({ showMy: !this.state.showMy });
    }

    componentDidMount() {
        document.addEventListener('keydown', this.handleKeypress);
        this.props.actions.list(false, 'home');
        this.props.actions.list(false, 'synthetic');
        this.props.actions.list(false, 'editor');
        this.props.actions.list(false, 'update');
        this.props.actions.list(false, 'approve');
        this.props.actions.setVisible(true);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeypress);
        this.props.actions.setVisible(false);
    }

    handleKeypress = (e) => {
        if (e.altKey && isKeyPressed(e, Constants.KeyCodes.A)) {
            e.preventDefault();
            this.props.actions.openAddCard('');
        }
    };

    componentDidUpdate(prevProps) {
        if (prevProps.rhsState !== this.props.rhsState) {
            this.openList(this.props.rhsState);
        }
    }

    getInIssues() {
        return this.props.inTodos.length;
    }

    getOutIssues() {
        return this.props.outTodos.length;
    }

    getMyIssues() {
        return this.props.todos.length;
    }

    addTodoItem() {
        this.props.actions.openAddCard('');
        // this.props.actions.openAssigneeModal('');
        // this.props.setIsOpenAddModal(true);
        // this.setState({ isOpenAddModal: true });
    }

    closeAddBox = () => {
        this.props.actions.closeAddCard();
        this.setState({ numberCallApi: this.state.numberCallApi + 1 });

    }

    closeModal = () => {
        this.setState({ isOpenAddModal: false });
    }

    render() {
        const style = getStyle();
        let todos = [];
        let listHeading = 'Danh sách kiến nghị';
        let addButton = '';
        let inboxList = [];

        switch (this.state.list) {
            case Home:
                todos = this.props.todos || [];
                addButton = 'Thêm kiến nghị mới';
                inboxList = this.props.inTodos || [];
                break;
            case Editor:
                todos = this.props.outTodos || [];
                listHeading = 'Danh sách biên tập';
                // addButton = 'Request a Todo from someone';
                break;
            case Synthetic:
                todos = this.props.todos || [];
                listHeading = 'Danh sách tổng hợp';
                break;
            case Update:
                todos = this.props.todos || [];
                listHeading = 'Danh sách cập nhật kết quả';
                break;
            case Approve:
                todos = this.props.todos || [];
                listHeading = 'Danh sách phê duyệt';
                break;

        }

        let inbox;

        if (inboxList.length > 0) {
            const actionName = this.state.showInbox ? (
                <CompassIcon
                    style={style.todoHeaderIcon}
                    icon='chevron-down'
                />
            ) : (
                <CompassIcon
                    style={style.todoHeaderIcon}
                    icon='chevron-right'
                />
            );
            inbox = (
                <div>
                    <div
                        className='todo-separator'
                        onClick={() => this.toggleInbox()}
                    >
                        {actionName}
                        <div>{`Incoming Todos (${inboxList.length})`}</div>
                    </div>
                    {this.state.showInbox ?
                        <ToDoIssues
                            issues={inboxList}
                            theme={this.props.theme}
                            list={Synthetic}
                            remove={this.props.actions.remove}
                            complete={this.props.actions.complete}
                            accept={this.props.actions.accept}
                            bump={this.props.actions.bump}
                            numberCallApi={this.state.numberCallApi}
                        />
                        :
                        ''
                    }
                </div>
            );
        }

        let separator;
        if ((inboxList.length > 0) && (todos.length > 0)) {
            const actionName = this.state.showMy ? (
                <CompassIcon
                    style={style.todoHeaderIcon}
                    icon='chevron-down'
                />
            ) : (
                <CompassIcon
                    style={style.todoHeaderIcon}
                    icon='chevron-right'
                />
            );
            separator = (
                <div
                    className='todo-separator'
                    onClick={() => this.toggleMy()}
                >
                    {actionName}
                    {`My Todos (${todos.length})`}
                </div>
            );
        }

        return (
            <React.Fragment>
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbHorizontal={renderThumbHorizontal}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    className='SidebarRight'
                >
                    <div className='todolist-header'>

                        {/* <div
                            className='todolist-header__title'
                        >
                            Danh sách kiến nghị
                        </div> */}

                        <MenuWrapper>
                            <button
                                className='todolist-header__dropdown'
                            >
                                {listHeading}
                                <CompassIcon
                                    style={style.todoHeaderIcon}
                                    icon='chevron-down'
                                />
                            </button>
                            <Menu position='right'>
                                <MenuItem
                                    onClick={() => this.openList(Home)}
                                    action={() => this.openList(Home)}
                                    text={'Danh sách kiến nghị'}
                                />
                                <MenuItem
                                    action={() => this.openList(Editor)}
                                    text={'Danh sách biên tập'}
                                />
                                <MenuItem
                                    action={() => this.openList(Synthetic)}
                                    text={'Danh sách tổng hợp'}
                                />
                                <MenuItem
                                    action={() => this.openList(Update)}
                                    text={'Danh sách cập nhật kết quả'}
                                />
                                <MenuItem
                                    action={() => this.openList(Approve)}
                                    text={'Danh sách phê duyệt'}
                                />

                            </Menu>
                        </MenuWrapper>
                        {this.state.list === Home && (
                            <OverlayTrigger
                                id='addOverlay'
                                placement={'bottom'}
                                overlay={(
                                    <Tooltip
                                        id='addTooltip'
                                    >
                                        <div className='shortcut-line'>
                                            <mark className='shortcut-key shortcut-key--tooltip'>{'OPT'}</mark>
                                            <mark className='shortcut-key shortcut-key--tooltip'>{'A'}</mark>
                                        </div>
                                    </Tooltip>
                                )}
                            >
                                <div>
                                    <Button
                                        emphasis='primary'
                                        icon={<CompassIcon icon='plus' />}
                                        size='small'
                                        onClick={() => {
                                            this.props.actions.telemetry('rhs_add', {
                                                list: this.state.list,
                                            });
                                            this.addTodoItem();
                                        }}
                                    >
                                        {addButton}
                                    </Button>
                                </div>
                            </OverlayTrigger>
                        )}
                    </div>
                    {
                        this.state.list === Home && (
                            <div>
                                {inbox}
                                {separator}
                                <AddIssue
                                    theme={this.props.theme}
                                    closeAddBox={this.closeAddBox}
                                />
                                {(inboxList.length === 0) || (this.state.showMy && todos.length > 0) ?
                                    <ToDoIssues
                                        issues={todos}
                                        theme={this.props.theme}
                                        list={this.state.list}
                                        remove={this.props.actions.remove}
                                        complete={this.props.actions.complete}
                                        accept={this.props.actions.accept}
                                        bump={this.props.actions.bump}
                                        siteURL={this.props.siteURL}
                                        numberCallApi={this.state.numberCallApi}
                                    /> : ''
                                }
                            </div>
                        )
                    }
                    {
                        this.state.list === Editor && (
                            <div>
                                {inbox}
                                {separator}
                                <AddIssue
                                    theme={this.props.theme}
                                    closeAddBox={this.closeAddBox}
                                />
                                {(inboxList.length === 0) || (this.state.showMy && todos.length > 0) ?
                                    <ToDoEditor
                                        issues={todos}
                                        theme={this.props.theme}
                                        list={this.state.list}
                                        remove={this.props.actions.remove}
                                        complete={this.props.actions.complete}
                                        accept={this.props.actions.accept}
                                        bump={this.props.actions.bump}
                                        siteURL={this.props.siteURL}
                                        numberCallApi={this.state.numberCallApi}
                                    /> : ''
                                }
                            </div>
                        )
                    }
{
                        this.state.list === Synthetic && (
                            <div>
                                {inbox}
                                {separator}
                                <AddIssue
                                    theme={this.props.theme}
                                    closeAddBox={this.closeAddBox}
                                />
                                {(inboxList.length === 0) || (this.state.showMy && todos.length > 0) ?
                                    <ToDoSynthetic
                                        issues={todos}
                                        theme={this.props.theme}
                                        list={this.state.list}
                                        remove={this.props.actions.remove}
                                        complete={this.props.actions.complete}
                                        accept={this.props.actions.accept}
                                        bump={this.props.actions.bump}
                                        siteURL={this.props.siteURL}
                                        numberCallApi={this.state.numberCallApi}
                                    /> : ''
                                }
                            </div>
                        )
                    }
                    {
                     this.state.list === Update && (
                        <div>
                            {inbox}
                            {separator}
                            <AddIssue
                                theme={this.props.theme}
                                closeAddBox={this.closeAddBox}
                            />
                            {(inboxList.length === 0) || (this.state.showMy && todos.length > 0) ?
                                <ToDoUpdate
                                    issues={todos}
                                    theme={this.props.theme}
                                    list={this.state.list}
                                    remove={this.props.actions.remove}
                                    complete={this.props.actions.complete}
                                    accept={this.props.actions.accept}
                                    bump={this.props.actions.bump}
                                    siteURL={this.props.siteURL}
                                    numberCallApi={this.state.numberCallApi}
                                /> : ''
                            }
                        </div>
                    )   
                    }
                    {this.props.todoToast && (
                        <TodoToast />
                    )}
                </Scrollbars>
            </React.Fragment>
        );
    }
}

const getStyle = () => {
    return {
        todoHeaderIcon: {
            fontSize: 18,
            marginLeft: 2,
        },
    };
};
