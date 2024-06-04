import axios from 'axios';
import { API_URL } from '../common/enum'

const URL = API_URL.HOST + '/users';

export const apiUser = {
    getAll() {
        return axios.get(`${URL}`);
    },
    register(user: any) {
        return axios.post(`${URL}/register`, user);
    }
};
