import axios from 'axios';
import { API_URL } from '../common/enum'

const URL = API_URL.HOST + '/auth';

export const apiAuth = {
    login(payload: any) {
        return axios.post(`${URL}/login`, payload);
    },

    logout() {
        return axios.post(`${URL}/logout`);
    }
};
