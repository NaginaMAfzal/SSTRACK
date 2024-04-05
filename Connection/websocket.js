import express from 'express';
import http from 'http';
import mysql from 'mysql2';
import bodyParser from 'body-parser';
import path from 'path';
import cors from 'cors';
import socketIO from 'socket.io'; // Import socket.io

const Port = 8080;
const app = express();
const server = http.createServer(app);
const io = socketIO(server); // Attach socket.io to the HTTP server
app.use(cors());
app.use(bodyParser.json());
io.on('connection', (socket) => {
    console.log("socket connected");
    fetchUserDataFromDatabase((userData) => {
        console.log("users");
        socket.emit('user-data', userData); // Use 'emit' to send data to the connected client
    });
    socket.on("user-joined", (newUserData) => {
        console.log("emit user-joined", newUserData);
        userList.push(newUserData); // Push the new user data into the 'userList' array
    });
    socket.on('new-user-joined', (name) => {
        console.log('new user', name);
        socket.broadcast.emit('user-joined', name);
    });
});