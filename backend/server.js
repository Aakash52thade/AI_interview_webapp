import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import { Server } from 'socket.io';
import connetDB from './config/db.js';
import { notFound, errorHandler } from "./middleware/errorHandler.js";
// import userRoutes from './routes/userRoutes.js';
// import sessionRoutes from './routes/sessionRoutes.js'
import {protect, attachUser} from './middleware/authMiddleware.js'

//dotenv config
dotenv.config();

//connect to database
connetDB();

const app = express();

//create an HTTP server the express app to handle incoming requests;
//if we use websocket as well it willhandle real time communication between client and server
const server = http.createServer(app); 

// ❌ FIX: need 'new' keyword
const io = new Server(server, {
    cors: {
        origin: "*", // ❌ allowOrigin not defined yet → temporary fix
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true,
        allowedHeaders : ['Content-Type', 'Authorization'],
    }
})


// ❌ allowOrigin not defined → comment this block for now
/*
app.use(cors({
    origin: (origin, callback) => {
        if(!origin) return callback(null, true);
        if(allowOrigin.includes(origin)){
            callback(null, true)
        }else{
            if(process.env.NODE_ENV === 'production'){
                callback(null, true)
            }else{
                callback(new Error("Not allwed by cors"))
            }
        }
    },
     credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders : ['Content-Type', 'Authorization']
}))
*/

// ✅ simple cors for now
app.use(cors());


//some other middleware
app.use(express.json()); //reads json data from req.body and convert into js object

// ❌ sessionRoutes not created yet
// app.use('/api/sessions', sessionRoutes);

// Store io globally in app So all files can use it
//OR store socket.io instance globally to use in routes/controller
app.set('io', io); 

app.get('/', (req, res) => {
    res.send("API is running")
})

app.use('/api/sessions', protect, attachUser, sessionRoutes);

// ❌ userRoutes not created yet
// app.use("/api/users", userRoutes);

// ❌ duplicate + not defined
// app.use('/api/sessions', sessionRoutes)


//socket 
//io.on is listen which triger every time when new user open app
io.on("connection", (socket) => {

    console.log(`A user connected ${socket.id}`);

    //create room for that we have to get user Id from socket handshake
    const userId = socket.handshake.query.userId;

    // ❌ FIX: use after defining
    if(userId){
       socket.join(userId);  //this add user in room  //room's are server side channel
       console.log(`User ${socket.id} joined room: ${userId}`);
    }

    socket.on("disconnect", () => {
        console.log(`User Disconnected ${socket.id}`);
    })
})

// ❌ not created yet
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(
    PORT, 
    () => console.log(`server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
)