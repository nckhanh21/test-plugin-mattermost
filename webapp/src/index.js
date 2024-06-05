import React from 'react';

import manifest from './manifest';

import Root from './components/root';
import AssigneeModal from './components/assignee_modal';
import SidebarRight from './components/sidebar_right';

// import {openAddCard, list, setShowRHSAction, telemetry, updateConfig, setHideTeamSidebar} from './actions';
import reducer from './reducer';
import PostTypeTodo from './components/post_type_todo';
import TeamSidebar from './components/team_sidebar';
import ChannelHeaderButton from './components/channel_header_button';
import {getPluginServerRoute} from './selectors';
import './app.scss'
let activityFunc;
let lastActivityTime = Number.MAX_SAFE_INTEGER;
const activityTimeout = 60 * 60 * 1000; // 1 hour
const {id: pluginId} = manifest;

export default class Plugin {
    initialize(registry, store) {
        const {toggleRHSPlugin, showRHSPlugin} = registry.registerRightHandSidebarComponent(SidebarRight, 'Bot kiến nghị');

        registry.registerReducer(reducer);
        registry.registerRootComponent(Root);
        registry.registerRootComponent(AssigneeModal);

        registry.registerBottomTeamSidebarComponent(TeamSidebar);

        registry.registerPostDropdownMenuAction(
            'Add Todo',
            (postID) => {
                // telemetry('post_action_click');
                // store.dispatch(openAddCard(postID));
                store.dispatch(showRHSPlugin);
            },
        );

        // store.dispatch(setShowRHSAction(() => store.dispatch(showRHSPlugin)));
        registry.registerChannelHeaderButtonAction(
            <ChannelHeaderButton/>,
            () => {
                // telemetry('channel_header_click');
                store.dispatch(toggleRHSPlugin);
            },
            'Todo',
            'Mở danh sách kiến nghị',
        );

        const getFrontendListName = (backendListName) => {
            let frontendListName = 'my';
            switch (backendListName) {
            case '':
                frontendListName = 'my';
                break;
            case '_in':
                frontendListName = 'in';
                break;
            case '_out':
                frontendListName = 'out';
                break;
            default:
                frontendListName = 'my';
                break;
            }
            return frontendListName;
        };

        // const refresh = ({data: {lists}}) => lists.forEach((listName) => store.dispatch(list(false, getFrontendListName(listName))));
        // const refreshAll = () => {
        //     store.dispatch(list(false));
        //     store.dispatch(list(false, 'in'));
        //     store.dispatch(list(false, 'out'));
        // };

        const iconURL = getPluginServerRoute(store.getState()) + '/public/bot-icon.png';
        registry.registerAppBarComponent(
            iconURL,
            () => store.dispatch(toggleRHSPlugin),
            'Mở danh sách kiến nghị',
        );

        // registry.registerWebSocketEventHandler(`custom_${pluginId}_refresh`, refresh);
        // registry.registerReconnectHandler(refreshAll);

        // store.dispatch(list(true));
        // store.dispatch(list(false, 'in'));
        // store.dispatch(list(false, 'out'));

        // register websocket event to track config changes
        const configUpdate = ({data}) => {
            // store.dispatch(setHideTeamSidebar(data.hide_team_sidebar));
        };

        registry.registerWebSocketEventHandler(`custom_${pluginId}_config_update`, configUpdate);

        // store.dispatch(updateConfig());

        activityFunc = () => {
            const now = new Date().getTime();
            if (now - lastActivityTime > activityTimeout) {
                // store.dispatch(list(true));
            }
            lastActivityTime = now;
        };

        document.addEventListener('click', activityFunc);

        registry.registerPostTypeComponent('custom_todo', PostTypeTodo);
    }

    deinitialize() {
        document.removeEventListener('click', activityFunc);
    }
}

window.registerPlugin(pluginId, new Plugin());
