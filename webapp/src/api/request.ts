import axios from 'axios';
import { API_URL } from '../common/enum'

const URL = API_URL.HOST + '/requests';

export const apiRequest = {
    getAll() {
        return axios.get(`${URL}`);
    },
    create(request: any) {
        return axios.post(`${URL}`, request);
    },
    update(id: any, request: any) {
        return axios.put(`${URL}/${id}`, request);
    },
    delete(id: any) {
        return axios.delete(`${URL}/${id}`);
    },
    forward(id: any, request: any) {
        return axios.post(`${URL}/forward/${id}`, request);
    }
};
