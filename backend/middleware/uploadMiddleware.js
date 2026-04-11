
import multer from 'multer'
import path from 'path'

//we use multer becuase express.json() is not able to handle file or file data 
// which came from frontend;
// so muslter unable this to handle file or image file which stroge and then ai work on it
const storage = multer.diskStorage({

    //destination =>“It specifies the folder where uploaded files will be stored.”
    destination(req, file, cb) { //cb == callback
       cb(null, "uploads/");  //uploads. if everything is fine the file updload and process
    },

    filename(req, file, cb){
        const ext = path.extname(file.originalname);
        const sessionId = req.params.id || 'unknown';
        cb(null, `${sessionId}-${Date.now()}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    //file.mimetype ==>It tells the type of file, like audio/mp3 or image/png.”
    if(file.mimetype.startsWith("audio/") || 
      file.mimetype === "application/octet-stream"){
        cb(null, true);
    }else{
        cb(new Error("Not an audio file"), false)
    }
}

//initialize middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {fileSize: 1024 * 1024 * 10}, //10MB
});

const uploadSingleAudio = upload.single("audio")

//name export
export {uploadSingleAudio};

