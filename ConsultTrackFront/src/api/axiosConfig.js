import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8081/api', // L'adresse de votre Backend Java
});

export default api;