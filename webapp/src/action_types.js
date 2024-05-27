import manifest from './manifest';

const {id: pluginId} = manifest;
export const OPEN_ROOT_MODAL = pluginId + '_open_root_modal';
export const CLOSE_ROOT_MODAL = pluginId + '_close_root_modal';
export const OPEN_ADD_CARD = pluginId + '_open_add_card';
export const CLOSE_ADD_CARD = pluginId + '_close_add_card';
export const OPEN_ASSIGNEE_MODAL = pluginId + '_open_assignee_modal';
export const CLOSE_ASSIGNEE_MODAL = pluginId + '_close_assignee_modal';
export const OPEN_TODO_TOAST = pluginId + '_open_todo_toast';
export const CLOSE_TODO_TOAST = pluginId + '_close_todo_toast';
export const GET_ASSIGNEE = pluginId + '_get_assignee';
export const SET_EDITING_TODO = pluginId + '_set_editing_todo';
export const REMOVE_EDITING_TODO = pluginId + '_remove_editing_todo';
export const REMOVE_ASSIGNEE = pluginId + '_remove_assignee';
export const GET_ISSUES = pluginId + '_get_issues';
export const GET_OUT_ISSUES = pluginId + '_get_out_issues';
export const GET_IN_ISSUES = pluginId + '_get_in_issues';
export const RECEIVED_SHOW_RHS_ACTION = pluginId + '_show_rhs';
export const UPDATE_RHS_STATE = pluginId + '_update_rhs_state';
export const SET_RHS_VISIBLE = pluginId + '_set_rhs_visible';
export const SET_HIDE_TEAM_SIDEBAR_BUTTONS = pluginId + '_set_hide_team_sidebar';