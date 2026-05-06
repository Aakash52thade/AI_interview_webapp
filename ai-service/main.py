# //uvicorn => it runs backend api server so it can receive req from browser or frontend;
# fastapi => FastAPI is a modern python web framewrok used to build api's
# pydantic => pydantic is a python library used for data validation and data parsing
# => it check wheater data we receive is correct, clean and right formate or not;
# openai-whisper => this an ai model for speech to text, convert audio to text;
# pydub => used to precess and manipulate audio files
# ffmpeg-python => ffmpeg is a powerful system tool used to convert audio/video formate exract audio from video
#   mp3 => .wav. && mp4 => audio
# python-mulitpart => used in framework like fastAPI to handle file upload
# => user upload voice => fastAPI  receives files using this


from typing import Optional
from pydub import AudioSegment
import whisper
import uvicorn    # like nodemon
import os     # process.env
import io    # io for websocket
import json
import tempfile
import re

from groq import Groq
# like express help to create api
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware  # like cores
from pydantic import BaseModel  # validate req and res data
from dotenv import load_dotenv  # dotenv.config(); help to read .env
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)
GROQ_MODEL = "llama-3.1-8b-instant"
     # like axios or fetch make api call

 # for read .evn file
AI_SERVICE_PORT = int(os.getenv('AI_SERVICE_PORT', 8000));

# like const app = express();
app = FastAPI(title="AI Interviewer Microservices", version="1.0")

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # which frontend URL's
    allow_credentials=True,  # allow cookies/auth headers
    allow_methods=["*"],  # allow GET, POST, PUT, DELETE
    allow_headers=["*"],  # allow any header
)

WHISPER_MODEL = None

try:
    print("Loading Whisper Model...")
    WHISPER_MODEL = whisper.load_model("base.en")
    print("Whisper Model Loaded Successfully")
except Exception as e:
    print("Error while loading Whisper Model")
    print(e)


class QuestionRequest(BaseModel):
    role: str = "AI Engineer"
    level: str = "Senior"
    count: int = 10
    interview_type: str = "coding-mix"


class QuestionResponse(BaseModel):
    questions: list[str]
    model_used: str


class EvaluationRequest(BaseModel):
    question: str
    question_type: str
    role: str
    level: str
    user_answer: Optional[str] = None
    user_code: Optional[str] = None


class EvaluationResponse(BaseModel):
    technicalScore: int
    confidenceScore: int
    aiFeedback: str
    idealAnswer: str


@app.get("/")
async def root():
    return {"message": "Hello from AI Interviewer Microservice!", "model": GROQ_MODEL}


# response_model = QuestionResponse => this is something powerful compare to express
# it tells FastAPI the response must follow this structure

@app.post("/generate-questions", response_model=QuestionResponse)
async def generate_questions(request: QuestionRequest):
    try:
        if request.interview_type == "coding-mix":
            # if 10 question 2 will be coding
            coding_count = int(request.count * 0.2)
            oral_count = int(request.count) - int(coding_count)  # FIX: was oral_oral (typo) — would crash the f-string below

            instruction = (
                f"The first {coding_count} questions MUST be coding challenge requiring function implementation."
                f"The reamining {oral_count} question MUST be conceptual oral questions."
            )
        else:
            instruction = "All questions MUST be conceptual oral questions. Do Not generate any coding or implementation challenges."

        # system_prompt → "How the AI should behave"
        system_prompt = (
        "You are a strict and professional technical interviewer.\n"

        "Rules:\n"
        "- Output only questions\n"
        "- No numbering\n"
        "- No explanations\n"
        "- No greetings or extra text\n"
        "- Each question must be on a new line\n"
        "- Generate EXACTLY the requested number of questions\n"

        f"Question Type Rule:\n- {instruction}\n"

        "Quality Guidelines:\n"
        "- Questions must be clear and concise\n"
        "- Avoid duplicates\n"
        "- Match the candidate's level strictly\n"
        )

        # user_prompt → "What the AI should do right now"
        user_prompt = (
            f"Generate exactly {request.count} unique interview questions for a {request.level} level {request.role} "
        )

        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.6,
        )

        # response what you got from groq; strip() remove the extra space from each question;
        raw_text = response.choices[0].message.content.strip()

        questions = [q.strip() for q in raw_text.split('\n') if q.strip()]

        return QuestionResponse(
            questions=questions[:request.count],
            model_used=GROQ_MODEL
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# //now we convert audio file into text;
@app.post("/transcribe")
# using FastAPI + python-multipart we accept file from frontend;
# UploadFile = Optimized file handler (better than raw bytes)
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        # reads upload file gives binary data;
        audio_bytes = await file.read()

        # create file like object in ram or convert to in-memory file
        # //bytes raw data  //ByestIO file folder holding those papers;
        audio_in_memory = io.BytesIO(audio_bytes)

        # Load audio using pydub
        # convert raw bytes => audio object  // handle different formate of audio
        audio_segment = AudioSegment.from_file(audio_in_memory)

        # //tempfile => is python module for creting temporary files
        # tempfile.NamedTemporaryFile => it's create temporary file on our system and give us file path
        # delete = False => do not auto delete //delete = true imp file get's delete as soon as block ends; that time whisper won't find the file
        # suffix = ".mp3" => file will look like /tmp/tmpabc123.mp3
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            #  get file path
            temp_audio_path = tmp.name

            #  save audio into file in mp3 formate
            audio_segment.export(temp_audio_path, format="mp3")

        # if not whisper model
        if WHISPER_MODEL is None:
            raise HTTPException(status_code=503, detail="Whisper Model is not loaded")

        # this is the heart of audio pipeline everything before this was just prepration
        # Takes your audio file → converts speech → into text
        # what is whisper_model is instance of openai-whisper
        result = WHISPER_MODEL.transcribe(temp_audio_path)

        # using os.module we delete temporary file from your system;
        os.remove(temp_audio_path)

        return {"transcription": result["text"].strip()}

    except Exception as e:
        # if the variable created before error happened and path exists  then we remove it; and show error message
        if 'temp_audio_path' in locals() and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

        raise HTTPException(status_code=500, detail=str(e))


@app.post("/evaluate", response_model=EvaluationResponse)
async def evaluate(request: EvaluationRequest):
    try:
        # just like generate-questions, different instructions based on question type
        if request.question_type == "oral":
            assessment_instruction = (
                "This is a conceptual oral question. Focus purely on candidate's verbal explanation. "
                "Ignore any code blocks. "
                "CRITICAL: If the transcript is empty, nonsense (e.g. 'blah blah', 'testing') or irrelevant to the question, SCORE 0."
            )
        else:
            assessment_instruction = (
                "This is a coding challenge question. Evaluate the code logic and efficiency. "
                "Use the transcription only for insight into their thought process. "
                "CRITICAL: If the code is 'undefined', empty, just random comments, or random characters, SCORE 0."
            )

        # system_prompt → how the AI should behave (strict evaluator)
        system_prompt = (
            "You are a strict technical interviewer.\n"
            "Do NOT hallucinate positive reviews for bad input.\n"
            "RULE 1: If the answer is gibberish, irrelevant, or missing, return technicalScore: 0 and confidenceScore: 0.\n"
            "RULE 2: For idealAnswer, provide a clean Markdown string. Do NOT return a nested JSON object.\n"
            f"Context: {assessment_instruction}\n"
            "Respond ONLY with a valid JSON object.\n"
            "Required keys: technicalScore (0-100), confidenceScore (0-100), aiFeedback, idealAnswer.\n"
        )

        # user_prompt → what the AI should evaluate right now
        user_prompt = (
            f"Role: {request.role}\n"
            f"Question: {request.question}\n"
            f"Level: {request.level}\n"
            f"Verbal Answer: {request.user_answer or 'No verbal answer provided'}\n"
            f"Code Answer: {request.user_code or 'No code provided'}\n"
        )

        # groq does not support format="json" like ollama
        # so we tell it strictly in the system_prompt to return JSON only
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,  # low temperature = more consistent structured output
        )

        # extract response text just like in generate-questions
        response_text = response.choices[0].message.content.strip()

        # try to parse JSON directly
        try:
            evaluation_data = json.loads(response_text)

            # idealAnswer must be a string, not a nested object
            if 'idealAnswer' in evaluation_data and not isinstance(evaluation_data['idealAnswer'], str):
                evaluation_data['idealAnswer'] = json.dumps(evaluation_data['idealAnswer'])

            return EvaluationResponse(**evaluation_data)

        except json.JSONDecodeError:
            # sometimes groq wraps response in ```json ... ``` — strip that
            # remove markdown code fences if present
            cleaned = re.sub(r'```json|```', '', response_text).strip()
            try:
                evaluation_data = json.loads(cleaned)
                if 'idealAnswer' in evaluation_data and not isinstance(evaluation_data['idealAnswer'], str):
                    evaluation_data['idealAnswer'] = json.dumps(evaluation_data['idealAnswer'])
                return EvaluationResponse(**evaluation_data)
            except:
                print(f"Failed to parse response: {response_text}")
                return EvaluationResponse(
                    technicalScore=0,
                    confidenceScore=0,
                    aiFeedback="Failed to parse AI response",
                    idealAnswer="Failed to parse AI response"
                )

    except Exception as e:
        print(f"Failed to generate response: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=AI_SERVICE_PORT)