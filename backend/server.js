import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import { Server } from 'socket.io';
import connetDB from './config/db.js';
import { notFound, errorMiddleware } from "./middleware/errorMiddleware.js";
import userRoutes from './routes/userRoutes.js';
// import sessionRoutes from './routes/sessionRoutes.js'
import {clerkMiddleware, protect, attachUser} from './middleware/authMiddleware.js'

//dotenv config
dotenv.config();

//connect to database
connetDB();

const app = express();

//create an HTTP server the express app to handle incoming requests;
//if we use websocket as well it willhandle real time communication between client and server
const server = http.createServer(app); 

// ======== CORS =============
const allowedOrigins = [
  "http://localhost:5173", // Vite dev server
  process.env.CLIENT_URL,  // Production frontend URL
].filter(Boolean);

// ❌ FIX: need 'new' keyword



// ❌ allowOrigin not defined → comment this block for now
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins, // ❌ allowOrigin not defined yet → temporary fix
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true,
        allowedHeaders : ['Content-Type', 'Authorization'],
    }
})

// ✅ simple cors for now
app.use(cors());


//some other middleware
app.use(express.json()); //reads json data from req.body and convert into js object

//this read the token from the request header and makes user
//info available via req.auth. it comes before the route
app.use(clerkMiddleware())

app.use("/api/users", userRoutes);

app.get("/api/test", protect, attachUser, (req, res) => {
  res.json({
    message: "Auth working!",
    mongoUser: req.user,
  });
});



app.set('io', io); 

app.get('/', (req, res) => {
    res.send("API is running")
})

app.use('/api/sessions', protect, attachUser);

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
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

server.listen(
    PORT, 
    () => console.log(`server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
)